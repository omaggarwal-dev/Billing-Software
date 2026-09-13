import { PaymentMethod, PaymentStatus, Prisma, TableStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise } from "../../lib/socket.js";

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  method: z.nativeEnum(PaymentMethod),
  transactionId: z.string().trim().optional().nullable(),
});

export const splitPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  splits: z
    .array(
      z.object({
        amount: z.number().positive("Amount must be greater than 0"),
        method: z.nativeEnum(PaymentMethod),
        transactionId: z.string().trim().optional().nullable(),
      })
    )
    .min(1, "At least one payment split is required"),
});

export async function listPayments(
  franchiseId: string | null,
  filters: { method?: PaymentMethod; status?: PaymentStatus; startDate?: string; endDate?: string }
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

  return prisma.payment.findMany({
    where: {
      franchiseId,
      method: filters.method || undefined,
      status: filters.status || undefined,
      createdAt: dateFilter,
    },
    include: {
      invoice: {
        include: {
          order: {
            include: {
              tableSession: { include: { table: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function processPayment(
  data: z.infer<typeof recordPaymentSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: {
      payments: true,
      order: {
        include: {
          tableSession: { include: { table: true } },
        },
      },
    },
  });

  if (!invoice || invoice.franchiseId !== franchiseId) {
    throw new AppError("Invoice not found in this franchise", 404);
  }

  const existingPaid = invoice.payments
    .filter((p) => p.status === PaymentStatus.COMPLETED)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const remainingBalance = Number(invoice.total) - existingPaid;

  if (data.amount > remainingBalance + 0.01) {
    throw new AppError(
      `Payment amount (${data.amount}) exceeds remaining balance of ₹${remainingBalance.toFixed(2)}`,
      400
    );
  }

  const now = new Date();
  const payment = await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.payment.create({
      data: {
        franchiseId,
        invoiceId: data.invoiceId,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        method: data.method,
        status: PaymentStatus.COMPLETED,
        transactionId: data.transactionId || null,
        paidAt: now,
      },
      include: { invoice: true },
    });

    const newTotalPaid = existingPaid + data.amount;
    const isFullyPaid = newTotalPaid >= Number(invoice.total) - 0.01;

    // If fully paid and table session exists, close session and free up table
    if (isFullyPaid && invoice.order?.tableSession) {
      const sessionId = invoice.order.tableSession.id;
      const tableId = invoice.order.tableSession.tableId;

      await tx.tableSession.update({
        where: { id: sessionId },
        data: { endedAt: now },
      });

      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    return createdPayment;
  });

  const isFullyPaid = existingPaid + data.amount >= Number(invoice.total) - 0.01;
  if (isFullyPaid && invoice.order?.tableSession?.tableId) {
    const tableId = invoice.order.tableSession.tableId;
    emitToFranchise(franchiseId, "table:status_changed", {
      tableId,
      status: TableStatus.AVAILABLE,
    });
    emitToFranchise(franchiseId, "table:session_closed", {
      tableId,
      sessionId: invoice.order.tableSession.id,
    });
  }

  emitToFranchise(franchiseId, "payment:received", payment);

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "RECORD_PAYMENT",
    entity: "Payment",
    entityId: payment.id,
    newData: { invoiceId: data.invoiceId, amount: data.amount, method: data.method },
  });

  return payment;
}

export async function processSplitPayment(
  data: z.infer<typeof splitPaymentSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: {
      payments: true,
      order: {
        include: {
          tableSession: { include: { table: true } },
        },
      },
    },
  });

  if (!invoice || invoice.franchiseId !== franchiseId) {
    throw new AppError("Invoice not found in this franchise", 404);
  }

  const existingPaid = invoice.payments
    .filter((p) => p.status === PaymentStatus.COMPLETED)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalSplitAmount = data.splits.reduce((sum, s) => sum + s.amount, 0);
  const remainingBalance = Number(invoice.total) - existingPaid;

  if (totalSplitAmount > remainingBalance + 0.01) {
    throw new AppError(
      `Total split payments (₹${totalSplitAmount.toFixed(2)}) exceed remaining balance of ₹${remainingBalance.toFixed(2)}`,
      400
    );
  }

  const now = new Date();

  const createdPayments = await prisma.$transaction(async (tx) => {
    const payments = [];
    for (const split of data.splits) {
      const p = await tx.payment.create({
        data: {
          franchiseId,
          invoiceId: data.invoiceId,
          amount: new Prisma.Decimal(split.amount.toFixed(2)),
          method: split.method,
          status: PaymentStatus.COMPLETED,
          transactionId: split.transactionId || null,
          paidAt: now,
        },
      });
      payments.push(p);
    }

    const isFullyPaid = existingPaid + totalSplitAmount >= Number(invoice.total) - 0.01;

    if (isFullyPaid && invoice.order?.tableSession) {
      const sessionId = invoice.order.tableSession.id;
      const tableId = invoice.order.tableSession.tableId;

      await tx.tableSession.update({
        where: { id: sessionId },
        data: { endedAt: now },
      });

      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    return payments;
  });

  const isFullyPaid = existingPaid + totalSplitAmount >= Number(invoice.total) - 0.01;
  if (isFullyPaid && invoice.order?.tableSession?.tableId) {
    const tableId = invoice.order.tableSession.tableId;
    emitToFranchise(franchiseId, "table:status_changed", {
      tableId,
      status: TableStatus.AVAILABLE,
    });
    emitToFranchise(franchiseId, "table:session_closed", {
      tableId,
      sessionId: invoice.order.tableSession.id,
    });
  }

  for (const p of createdPayments) {
    emitToFranchise(franchiseId, "payment:received", p);
  }

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "RECORD_SPLIT_PAYMENT",
    entity: "Payment",
    entityId: data.invoiceId,
    newData: { splitCount: createdPayments.length, totalAmount: totalSplitAmount },
  });

  return createdPayments;
}

export async function refundPayment(id: string, franchiseId: string, currentUserId?: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.franchiseId !== franchiseId) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status !== PaymentStatus.COMPLETED) {
    throw new AppError(`Cannot refund payment in ${payment.status} status`, 400);
  }

  const refunded = await prisma.payment.update({
    where: { id },
    data: { status: PaymentStatus.REFUNDED },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "REFUND_PAYMENT",
    entity: "Payment",
    entityId: id,
    oldData: { status: payment.status },
    newData: { status: PaymentStatus.REFUNDED },
  });

  return refunded;
}
