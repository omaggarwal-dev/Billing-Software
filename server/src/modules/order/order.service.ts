import { OrderStatus, Prisma, TableStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise } from "../../lib/socket.js";

export const orderItemInputSchema = z.object({
  menuItemId: z.string().min(1, "Menu item ID is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  notes: z.string().trim().optional().nullable(),
});

export const createOrderSchema = z.object({
  tableSessionId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(5), // 5% default tax
  items: z.array(orderItemInputSchema).min(1, "At least one item is required"),
});

export const updateOrderSchema = z.object({
  discount: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  items: z.array(orderItemInputSchema).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
});

export async function listOrders(
  franchiseId: string | null,
  filters: { status?: OrderStatus; tableId?: string; startDate?: string; endDate?: string }
) {
  if (!franchiseId) return [];

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (filters.startDate || filters.endDate) {
    dateFilter = {};
    if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const e = new Date(filters.endDate);
      e.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = e;
    }
  }

  return prisma.order.findMany({
    where: {
      franchiseId,
      status: filters.status || undefined,
      createdAt: dateFilter,
      tableSession: filters.tableId ? { tableId: filters.tableId } : undefined,
    },
    include: {
      items: {
        include: {
          menuItem: {
            include: { category: true, station: true },
          },
        },
      },
      tableSession: {
        include: { table: true },
      },
      kots: {
        include: {
          station: true,
          items: {
            include: { menuItem: true },
          },
        },
      },
      invoice: {
        include: { payments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderById(id: string, franchiseId: string | null) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          menuItem: {
            include: { category: true, station: true },
          },
        },
      },
      tableSession: {
        include: { table: true },
      },
      kots: {
        include: {
          station: true,
          items: {
            include: { menuItem: true },
          },
        },
      },
      invoice: {
        include: { payments: true },
      },
      franchise: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!order || (franchiseId && order.franchiseId !== franchiseId)) {
    throw new AppError("Order not found", 404);
  }

  return order;
}

export async function createOrder(
  data: z.infer<typeof createOrderSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  // If tableId provided without tableSessionId, find or open session
  let finalSessionId = data.tableSessionId;
  if (!finalSessionId && data.tableId) {
    const table = await prisma.restaurantTable.findUnique({
      where: { id: data.tableId },
      include: { sessions: { where: { endedAt: null } } },
    });
    if (!table || table.franchiseId !== franchiseId) {
      throw new AppError("Table not found in this franchise", 404);
    }
    if (table.sessions.length > 0) {
      finalSessionId = table.sessions[0].id;
    } else {
      const newSession = await prisma.tableSession.create({
        data: {
          tableId: data.tableId,
          startedAt: new Date(),
        },
      });
      await prisma.restaurantTable.update({
        where: { id: data.tableId },
        data: { status: TableStatus.OCCUPIED },
      });
      finalSessionId = newSession.id;
    }
  }

  // Fetch prices from DB for all items
  const menuItemIds = data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      franchiseId,
    },
    include: { category: true, station: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new AppError("One or more selected menu items are invalid or belong to another franchise", 400);
  }

  const itemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotalNum = 0;
  const processedItems = data.items.map((item) => {
    const dbItem = itemMap.get(item.menuItemId)!;
    if (!dbItem.isAvailable) {
      throw new AppError(`Menu item '${dbItem.name}' is currently marked unavailable`, 400);
    }
    const unitPriceNum = Number(dbItem.price);
    const totalPriceNum = unitPriceNum * item.quantity;
    subtotalNum += totalPriceNum;

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(unitPriceNum.toFixed(2)),
      totalPrice: new Prisma.Decimal(totalPriceNum.toFixed(2)),
      notes: item.notes || null,
    };
  });

  const discountNum = Math.min(data.discount || 0, subtotalNum);
  const taxableAmount = Math.max(0, subtotalNum - discountNum);
  const taxRate = data.taxRate !== undefined ? data.taxRate : 5;
  const taxNum = (taxableAmount * taxRate) / 100;
  const totalNum = taxableAmount + taxNum;

  // Generate unique order number per franchise
  const franchise = await prisma.franchise.findUnique({
    where: { id: franchiseId },
    select: { code: true },
  });
  const fCode = franchise?.code ? `${franchise.code}-` : "";
  const countToday = await prisma.order.count({
    where: { franchiseId },
  });
  const now = new Date();
  const datePrefix = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const orderNumber = `ORD-${fCode}${datePrefix}-${String(countToday + 1).padStart(4, "0")}`;

  const order = await prisma.order.create({
    data: {
      franchiseId,
      tableSessionId: finalSessionId || null,
      orderNumber,
      status: OrderStatus.OPEN,
      subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
      discount: new Prisma.Decimal(discountNum.toFixed(2)),
      tax: new Prisma.Decimal(taxNum.toFixed(2)),
      total: new Prisma.Decimal(totalNum.toFixed(2)),
      items: {
        create: processedItems,
      },
    },
    include: {
      items: {
        include: {
          menuItem: {
            include: { category: true, station: true },
          },
        },
      },
      tableSession: {
        include: { table: true },
      },
    },
  });

  emitToFranchise(franchiseId, "order:created", order);

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_ORDER",
    entity: "Order",
    entityId: order.id,
    newData: { id: order.id, orderNumber: order.orderNumber, total: order.total },
  });

  return order;
}

export async function updateOrder(
  id: string,
  data: z.infer<typeof updateOrderSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Order not found", 404);
  }

  if (["BILLED", "CANCELLED"].includes(existing.status)) {
    throw new AppError(`Cannot modify order in ${existing.status} status`, 400);
  }

  // If items are being updated, recalculate totals
  let subtotalNum = Number(existing.subtotal);
  let processedItems = undefined;

  if (data.items) {
    const menuItemIds = data.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        franchiseId,
      },
    });

    const itemMap = new Map(menuItems.map((m) => [m.id, m]));
    subtotalNum = 0;

    processedItems = data.items.map((item) => {
      const dbItem = itemMap.get(item.menuItemId);
      if (!dbItem) throw new AppError(`Menu item ${item.menuItemId} not found`, 400);

      const unitPriceNum = Number(dbItem.price);
      const totalPriceNum = unitPriceNum * item.quantity;
      subtotalNum += totalPriceNum;

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPriceNum.toFixed(2)),
        totalPrice: new Prisma.Decimal(totalPriceNum.toFixed(2)),
        notes: item.notes || null,
      };
    });
  }

  const discountNum = data.discount !== undefined ? data.discount : Number(existing.discount);
  const taxableAmount = Math.max(0, subtotalNum - discountNum);
  const taxRate = data.taxRate !== undefined ? data.taxRate : 5;
  const taxNum = (taxableAmount * taxRate) / 100;
  const totalNum = taxableAmount + taxNum;

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (processedItems) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: processedItems.map((i) => ({ ...i, orderId: id })),
      });
    }

    return tx.order.update({
      where: { id },
      data: {
        status: data.status || undefined,
        subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
        discount: new Prisma.Decimal(discountNum.toFixed(2)),
        tax: new Prisma.Decimal(taxNum.toFixed(2)),
        total: new Prisma.Decimal(totalNum.toFixed(2)),
      },
      include: {
        items: {
          include: {
            menuItem: { include: { category: true, station: true } },
          },
        },
        tableSession: { include: { table: true } },
        kots: true,
      },
    });
  });

  emitToFranchise(franchiseId, "order:updated", updatedOrder);

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "UPDATE_ORDER",
    entity: "Order",
    entityId: id,
    oldData: existing,
    newData: updatedOrder,
  });

  return updatedOrder;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.order.findUnique({
    where: { id },
    include: { tableSession: true },
  });

  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Order not found", 404);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      items: { include: { menuItem: true } },
      tableSession: { include: { table: true } },
    },
  });

  emitToFranchise(franchiseId, "order:status_changed", { orderId: id, status });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: `ORDER_${status}`,
    entity: "Order",
    entityId: id,
    oldData: { status: existing.status },
    newData: { status },
  });

  return updated;
}
