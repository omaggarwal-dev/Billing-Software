import { InventoryTxType, NotificationType, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise } from "../../lib/socket.js";

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().optional(),
  category: z.string().trim().optional(),
  unit: z.string().trim().min(1, "Unit is required"),
  currentStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
  reorderLevel: z.number().min(0).default(0),
  purchasePrice: z.number().min(0).default(0),
  supplier: z.string().trim().optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const stockInSchema = z.object({
  supplier: z.string().trim().min(1, "Supplier is required"),
  invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
  notes: z.string().trim().optional(),
  items: z.array(
    z.object({
      inventoryItemId: z.string().min(1),
      quantity: z.number().positive("Quantity must be greater than 0"),
      unitPrice: z.number().min(0, "Unit price must be >= 0"),
    })
  ).min(1, "At least one item is required"),
});

export const adjustStockSchema = z.object({
  inventoryItemId: z.string().min(1),
  type: z.enum(["ADJUSTMENT", "WASTAGE", "RETURN", "OPENING_STOCK"]),
  quantity: z.number(),
  notes: z.string().trim().min(1, "Reason is required"),
});

export async function listInventoryItems(
  franchiseId: string | null,
  filters: { category?: string; search?: string; status?: "all" | "low" | "critical" }
) {
  if (!franchiseId) return [];

  const items = await prisma.inventoryItem.findMany({
    where: {
      franchiseId,
      isActive: true,
      category: filters.category || undefined,
      name: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined,
    },
    orderBy: { name: "asc" },
  });

  if (filters.status === "low") {
    return items.filter((item) => Number(item.currentStock) <= Number(item.minimumStock));
  }
  if (filters.status === "critical") {
    return items.filter(
      (item) => Number(item.currentStock) <= Number(item.minimumStock) * 0.5 || Number(item.currentStock) === 0
    );
  }

  return items;
}

export async function createInventoryItem(
  data: z.infer<typeof createInventoryItemSchema>,
  franchiseId: string,
  userId?: string
) {
  const existing = await prisma.inventoryItem.findFirst({
    where: { franchiseId, name: { equals: data.name, mode: "insensitive" } },
  });

  if (existing) {
    throw new AppError("An inventory item with this name already exists in this franchise", 400);
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        franchiseId,
        name: data.name,
        code: data.code,
        category: data.category,
        unit: data.unit.toLowerCase(),
        currentStock: new Prisma.Decimal(data.currentStock),
        minimumStock: new Prisma.Decimal(data.minimumStock),
        reorderLevel: new Prisma.Decimal(data.reorderLevel),
        purchasePrice: new Prisma.Decimal(data.purchasePrice),
        supplier: data.supplier,
      },
    });

    if (data.currentStock > 0) {
      await tx.inventoryTransaction.create({
        data: {
          franchiseId,
          inventoryItemId: item.id,
          type: InventoryTxType.OPENING_STOCK,
          quantity: new Prisma.Decimal(data.currentStock),
          previousStock: new Prisma.Decimal(0),
          newStock: new Prisma.Decimal(data.currentStock),
          unitPrice: new Prisma.Decimal(data.purchasePrice),
          referenceType: "MANUAL",
          notes: "Initial opening stock",
          performedBy: userId,
        },
      });
    }

    await logAudit({
      franchiseId,
      userId,
      action: "CREATE_INVENTORY_ITEM",
      entity: "InventoryItem",
      entityId: item.id,
      newData: item,
    });

    return item;
  });
}

export async function updateInventoryItem(
  id: string,
  data: z.infer<typeof updateInventoryItemSchema>,
  franchiseId: string,
  userId?: string
) {
  const existing = await prisma.inventoryItem.findFirst({ where: { id, franchiseId } });
  if (!existing) throw new AppError("Inventory item not found", 404);

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      category: data.category,
      unit: data.unit ? data.unit.toLowerCase() : undefined,
      minimumStock: data.minimumStock !== undefined ? new Prisma.Decimal(data.minimumStock) : undefined,
      reorderLevel: data.reorderLevel !== undefined ? new Prisma.Decimal(data.reorderLevel) : undefined,
      purchasePrice: data.purchasePrice !== undefined ? new Prisma.Decimal(data.purchasePrice) : undefined,
      supplier: data.supplier,
    },
  });

  await logAudit({
    franchiseId,
    userId,
    action: "UPDATE_INVENTORY_ITEM",
    entity: "InventoryItem",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function recordStockIn(
  data: z.infer<typeof stockInSchema>,
  franchiseId: string,
  userId?: string
) {
  return prisma.$transaction(async (tx) => {
    let totalAmount = 0;
    for (const item of data.items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    const purchase = await tx.purchase.create({
      data: {
        franchiseId,
        invoiceNumber: data.invoiceNumber,
        supplier: data.supplier,
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        notes: data.notes,
        receivedBy: userId,
        status: "COMPLETED",
        items: {
          create: data.items.map((it) => ({
            inventoryItemId: it.inventoryItemId,
            quantity: new Prisma.Decimal(it.quantity),
            unitPrice: new Prisma.Decimal(it.unitPrice),
            totalPrice: new Prisma.Decimal((it.quantity * it.unitPrice).toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });

    for (const item of data.items) {
      const invItem = await tx.inventoryItem.findFirst({
        where: { id: item.inventoryItemId, franchiseId },
      });
      if (!invItem) continue;

      const prevStock = Number(invItem.currentStock);
      const newStock = prevStock + item.quantity;

      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: {
          currentStock: new Prisma.Decimal(newStock.toFixed(3)),
          purchasePrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          supplier: data.supplier,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          franchiseId,
          inventoryItemId: invItem.id,
          type: InventoryTxType.PURCHASE,
          quantity: new Prisma.Decimal(item.quantity.toFixed(3)),
          previousStock: new Prisma.Decimal(prevStock.toFixed(3)),
          newStock: new Prisma.Decimal(newStock.toFixed(3)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          notes: `Stock in Invoice #${data.invoiceNumber} from ${data.supplier}`,
          performedBy: userId,
        },
      });
    }

    await logAudit({
      franchiseId,
      userId,
      action: "STOCK_IN_PURCHASE",
      entity: "Purchase",
      entityId: purchase.id,
      newData: purchase,
    });

    emitToFranchise(franchiseId, "inventory:stock_updated", { purchaseId: purchase.id });
    return purchase;
  });
}

export async function adjustStock(
  data: z.infer<typeof adjustStockSchema>,
  franchiseId: string,
  userId?: string
) {
  return prisma.$transaction(async (tx) => {
    const invItem = await tx.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, franchiseId },
    });
    if (!invItem) throw new AppError("Inventory item not found", 404);

    const prevStock = Number(invItem.currentStock);
    const newStock = prevStock + data.quantity;

    if (newStock < 0) {
      throw new AppError(`Cannot adjust stock below 0. Current: ${prevStock} ${invItem.unit}`, 400);
    }

    await tx.inventoryItem.update({
      where: { id: invItem.id },
      data: { currentStock: new Prisma.Decimal(newStock.toFixed(3)) },
    });

    const txRecord = await tx.inventoryTransaction.create({
      data: {
        franchiseId,
        inventoryItemId: invItem.id,
        type: data.type as InventoryTxType,
        quantity: new Prisma.Decimal(data.quantity.toFixed(3)),
        previousStock: new Prisma.Decimal(prevStock.toFixed(3)),
        newStock: new Prisma.Decimal(newStock.toFixed(3)),
        referenceType: "MANUAL",
        notes: data.notes,
        performedBy: userId,
      },
    });

    return txRecord;
  });
}

export async function deductInventoryForOrder(orderId: string, franchiseId: string, customTx?: Prisma.TransactionClient) {
  const execute = async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipe: {
                  include: { items: { include: { inventoryItem: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!order || order.franchiseId !== franchiseId) return;

    for (const item of order.items) {
      if (item.inventoryDeducted) continue;

      const recipe = item.menuItem.recipe;
      if (!recipe || !recipe.items || recipe.items.length === 0) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { inventoryDeducted: true },
        });
        continue;
      }

      for (const rItem of recipe.items) {
        const invItem = rItem.inventoryItem;
        if (!invItem) continue;

        const baseQty = Number(rItem.quantity) * item.quantity;
        const wastagePct = Number(rItem.wastageAllowance || 0);
        const totalDeduct = baseQty * (1 + wastagePct / 100);

        const currentStock = Number(invItem.currentStock);
        const newStock = Math.max(0, currentStock - totalDeduct);

        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { currentStock: new Prisma.Decimal(newStock.toFixed(3)) },
        });

        await tx.inventoryTransaction.create({
          data: {
            franchiseId,
            inventoryItemId: invItem.id,
            type: InventoryTxType.CONSUMPTION,
            quantity: new Prisma.Decimal((-totalDeduct).toFixed(3)),
            previousStock: new Prisma.Decimal(currentStock.toFixed(3)),
            newStock: new Prisma.Decimal(newStock.toFixed(3)),
            referenceType: "ORDER",
            referenceId: order.id,
            notes: `Consumed for Order #${order.orderNumber} (${item.quantity}x ${item.menuItem.name})`,
          },
        });

        const minStock = Number(invItem.minimumStock);
        if (newStock <= minStock && minStock > 0) {
          const isCritical = newStock <= minStock * 0.5 || newStock === 0;
          await tx.notification.create({
            data: {
              franchiseId,
              type: isCritical ? NotificationType.CRITICAL_STOCK : NotificationType.LOW_STOCK,
              title: isCritical ? `Critical Stock Alert: ${invItem.name}` : `Low Stock Alert: ${invItem.name}`,
              message: `${invItem.name} current stock is ${newStock.toFixed(2)} ${invItem.unit} (Minimum: ${minStock} ${invItem.unit})`,
              metadata: { inventoryItemId: invItem.id, currentStock: newStock, minStock },
            },
          });

          emitToFranchise(franchiseId, "inventory:low_stock", {
            itemId: invItem.id,
            name: invItem.name,
            currentStock: newStock,
            unit: invItem.unit,
          });
        }
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: { inventoryDeducted: true },
      });
    }
  };

  if (customTx) {
    await execute(customTx);
  } else {
    await prisma.$transaction(execute);
  }
}

export async function listInventoryTransactions(
  franchiseId: string | null,
  filters: { inventoryItemId?: string; type?: InventoryTxType; limit?: number }
) {
  if (!franchiseId) return [];

  return prisma.inventoryTransaction.findMany({
    where: {
      franchiseId,
      inventoryItemId: filters.inventoryItemId || undefined,
      type: filters.type || undefined,
    },
    include: { inventoryItem: true },
    orderBy: { createdAt: "desc" },
    take: filters.limit || 100,
  });
}

export async function getInventoryStats(franchiseId: string | null) {
  if (!franchiseId) {
    return { totalItems: 0, totalValue: 0, lowStockCount: 0, criticalStockCount: 0 };
  }

  const items = await prisma.inventoryItem.findMany({
    where: { franchiseId, isActive: true },
  });

  let totalValue = 0;
  let lowStockCount = 0;
  let criticalStockCount = 0;

  for (const it of items) {
    const stock = Number(it.currentStock);
    const min = Number(it.minimumStock);
    const price = Number(it.purchasePrice);
    totalValue += stock * price;

    if (stock <= min && min > 0) {
      lowStockCount++;
      if (stock <= min * 0.5 || stock === 0) {
        criticalStockCount++;
      }
    }
  }

  return {
    totalItems: items.length,
    totalValue: Number(totalValue.toFixed(2)),
    lowStockCount,
    criticalStockCount,
  };
}