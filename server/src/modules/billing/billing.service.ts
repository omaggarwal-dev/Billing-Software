import { OrderStatus, Prisma, TableStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise } from "../../lib/socket.js";

export const createInvoiceSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  discount: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
});

export async function listInvoices(
  franchiseId: string | null,
  filters: { startDate?: string; endDate?: string }
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

  return prisma.invoice.findMany({
    where: {
      franchiseId,
      createdAt: dateFilter,
    },
    include: {
      order: {
        include: {
          items: {
            include: { menuItem: true },
          },
          tableSession: {
            include: { table: true },
          },
        },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoiceById(id: string, franchiseId: string | null) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: {
            include: { menuItem: true },
          },
          tableSession: {
            include: { table: true },
          },
        },
      },
      payments: true,
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!invoice || (franchiseId && invoice.franchiseId !== franchiseId)) {
    throw new AppError("Invoice not found", 404);
  }

  // Compute total paid so far
  const totalPaid = invoice.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const remainingBalance = Math.max(0, Number(invoice.total) - totalPaid);

  return {
    ...invoice,
    totalPaid,
    remainingBalance,
    isFullyPaid: remainingBalance <= 0.01,
  };
}

export async function createInvoiceForOrder(
  data: z.infer<typeof createInvoiceSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: {
      items: true,
      invoice: true,
      tableSession: { include: { table: true } },
    },
  });

  if (!order || order.franchiseId !== franchiseId) {
    throw new AppError("Order not found in this franchise", 404);
  }

  if (order.invoice) {
    return getInvoiceById(order.invoice.id, franchiseId);
  }

  if (order.status === OrderStatus.CANCELLED) {
    throw new AppError("Cannot generate invoice for a cancelled order", 400);
  }

  // Recalculate if discount is overridden
  let subtotalNum = Number(order.subtotal);
  let discountNum = data.discount !== undefined ? data.discount : Number(order.discount);
  let taxNum = Number(order.tax);

  if (data.discount !== undefined || data.taxRate !== undefined) {
    const taxable = Math.max(0, subtotalNum - discountNum);
    const rate = data.taxRate !== undefined ? data.taxRate : 5;
    taxNum = (taxable * rate) / 100;
  }
  const totalNum = Math.max(0, subtotalNum - discountNum + taxNum);

  // Generate unique invoice number
  const franchise = await prisma.franchise.findUnique({
    where: { id: franchiseId },
    select: { code: true },
  });
  const fCode = franchise?.code ? `${franchise.code}-` : "";
  const countToday = await prisma.invoice.count({ where: { franchiseId } });
  const now = new Date();
  const datePrefix = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `INV-${fCode}${datePrefix}-${String(countToday + 1).padStart(4, "0")}`;

  const invoice = await prisma.$transaction(async (tx) => {
    const newInvoice = await tx.invoice.create({
      data: {
        franchiseId,
        orderId: data.orderId,
        invoiceNumber,
        subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
        discount: new Prisma.Decimal(discountNum.toFixed(2)),
        tax: new Prisma.Decimal(taxNum.toFixed(2)),
        total: new Prisma.Decimal(totalNum.toFixed(2)),
      },
      include: {
        order: {
          include: {
            items: { include: { menuItem: true } },
            tableSession: { include: { table: true } },
          },
        },
        payments: true,
      },
    });

    await tx.order.update({
      where: { id: data.orderId },
      data: {
        status: OrderStatus.BILLED,
        discount: new Prisma.Decimal(discountNum.toFixed(2)),
        tax: new Prisma.Decimal(taxNum.toFixed(2)),
        total: new Prisma.Decimal(totalNum.toFixed(2)),
      },
    });

    if (order.tableSession?.tableId) {
      await tx.restaurantTable.update({
        where: { id: order.tableSession.tableId },
        data: { status: TableStatus.BILLING },
      });
    }

    return newInvoice;
  });

  if (order.tableSession?.tableId) {
    emitToFranchise(franchiseId, "table:status_changed", {
      tableId: order.tableSession.tableId,
      status: TableStatus.BILLING,
    });
  }

  emitToFranchise(franchiseId, "order:status_changed", { orderId: order.id, status: OrderStatus.BILLED });
  emitToFranchise(franchiseId, "invoice:created", invoice);

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_INVOICE",
    entity: "Invoice",
    entityId: invoice.id,
    newData: { invoiceNumber: invoice.invoiceNumber, total: invoice.total },
  });

  return invoice;
}
