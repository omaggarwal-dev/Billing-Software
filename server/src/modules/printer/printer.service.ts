import { PrinterType } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const printerSchema = z.object({
  name: z.string().trim().min(1, "Printer name is required"),
  type: z.nativeEnum(PrinterType),
  ipAddress: z.string().trim().optional().nullable(),
  port: z.number().int().optional().nullable().default(9100),
  stationId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updatePrinterSchema = printerSchema.partial();

export async function listPrinters(franchiseId: string | null) {
  if (!franchiseId) return [];

  return prisma.printer.findMany({
    where: { franchiseId },
    include: {
      station: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createPrinter(
  data: z.infer<typeof printerSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  if (data.stationId) {
    const station = await prisma.preparationStation.findUnique({ where: { id: data.stationId } });
    if (!station || station.franchiseId !== franchiseId) {
      throw new AppError("Invalid preparation station selected", 400);
    }
  }

  const printer = await prisma.printer.create({
    data: {
      franchiseId,
      name: data.name,
      type: data.type,
      ipAddress: data.ipAddress || null,
      port: data.port || 9100,
      stationId: data.stationId || null,
      isActive: data.isActive,
    },
    include: { station: true },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_PRINTER",
    entity: "Printer",
    entityId: printer.id,
    newData: printer,
  });

  return printer;
}

export async function updatePrinter(
  id: string,
  data: z.infer<typeof updatePrinterSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.printer.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Printer not found", 404);
  }

  if (data.stationId) {
    const station = await prisma.preparationStation.findUnique({ where: { id: data.stationId } });
    if (!station || station.franchiseId !== franchiseId) {
      throw new AppError("Invalid preparation station selected", 400);
    }
  }

  const updated = await prisma.printer.update({
    where: { id },
    data,
    include: { station: true },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "UPDATE_PRINTER",
    entity: "Printer",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function deletePrinter(id: string, franchiseId: string, currentUserId?: string) {
  const existing = await prisma.printer.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Printer not found", 404);
  }

  await prisma.printer.delete({ where: { id } });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "DELETE_PRINTER",
    entity: "Printer",
    entityId: id,
    oldData: existing,
  });

  return { success: true, message: "Printer configuration deleted" };
}

/**
 * Generate formatted text / ESC-POS representation for KOT or Receipt printing
 */
export async function generatePrintPayload(type: "KOT" | "RECEIPT", targetId: string, franchiseId: string) {
  if (type === "KOT") {
    const kot = await prisma.kOT.findUnique({
      where: { id: targetId },
      include: {
        station: true,
        order: {
          include: {
            tableSession: { include: { table: true } },
          },
        },
        items: {
          include: { menuItem: true },
        },
        franchise: true,
      },
    });

    if (!kot || kot.franchiseId !== franchiseId) {
      throw new AppError("KOT not found", 404);
    }

    const tableStr = kot.order.tableSession?.table ? `Table: ${kot.order.tableSession.table.tableNumber}` : "Takeaway";
    const stationStr = kot.station ? kot.station.name : "Main Kitchen";
    const dateStr = new Date(kot.createdAt).toLocaleString();

    let lines = [
      "================================",
      `     KITCHEN ORDER TICKET       `,
      `          ${stationStr}         `,
      "================================",
      `KOT #: ${kot.kotNumber}`,
      `Order: ${kot.order.orderNumber}`,
      `${tableStr}`,
      `Time: ${dateStr}`,
      "--------------------------------",
      "Item                     Qty",
      "--------------------------------",
    ];

    for (const item of kot.items) {
      const name = item.menuItem.name.padEnd(24, " ").substring(0, 24);
      const qty = String(item.quantity).padStart(4, " ");
      lines.push(`${name} ${qty}`);
      if (item.notes) {
        lines.push(`  * Note: ${item.notes}`);
      }
    }

    lines.push("--------------------------------");
    lines.push("\n\n\n");

    return {
      type: "KOT",
      rawText: lines.join("\n"),
      kot,
    };
  }

  // RECEIPT
  const invoice = await prisma.invoice.findUnique({
    where: { id: targetId },
    include: {
      order: {
        include: {
          items: { include: { menuItem: true } },
          tableSession: { include: { table: true } },
        },
      },
      payments: true,
      franchise: true,
    },
  });

  if (!invoice || invoice.franchiseId !== franchiseId) {
    throw new AppError("Invoice not found", 404);
  }

  const tableStr = invoice.order.tableSession?.table ? `Table: ${invoice.order.tableSession.table.tableNumber}` : "Takeaway";
  const dateStr = new Date(invoice.createdAt).toLocaleString();

  let lines = [
    "================================",
    `     ${invoice.franchise.name.toUpperCase()}     `,
    `  ${invoice.franchise.address || ""}  `,
    `  Phone: ${invoice.franchise.phone || "N/A"}  `,
    "================================",
    `Invoice: ${invoice.invoiceNumber}`,
    `Order  : ${invoice.order.orderNumber}`,
    `${tableStr}`,
    `Date   : ${dateStr}`,
    "--------------------------------",
    "Item             Qty      Price",
    "--------------------------------",
  ];

  for (const item of invoice.order.items) {
    const name = item.menuItem.name.padEnd(16, " ").substring(0, 16);
    const qty = String(item.quantity).padStart(3, " ");
    const price = Number(item.totalPrice).toFixed(2).padStart(9, " ");
    lines.push(`${name} ${qty} ${price}`);
  }

  lines.push("--------------------------------");
  lines.push(`Subtotal:             Rs.${Number(invoice.subtotal).toFixed(2)}`);
  if (Number(invoice.discount) > 0) {
    lines.push(`Discount:            -Rs.${Number(invoice.discount).toFixed(2)}`);
  }
  lines.push(`Tax:                  Rs.${Number(invoice.tax).toFixed(2)}`);
  lines.push("================================");
  lines.push(`TOTAL:                Rs.${Number(invoice.total).toFixed(2)}`);
  lines.push("================================");

  if (invoice.payments.length > 0) {
    lines.push("PAYMENTS:");
    for (const p of invoice.payments) {
      lines.push(`  ${p.method.padEnd(8, " ")}: Rs.${Number(p.amount).toFixed(2)} [${p.status}]`);
    }
  }

  lines.push("--------------------------------");
  lines.push("    Thank you for dining with us!   ");
  lines.push("          Please visit again        ");
  lines.push("\n\n\n");

  return {
    type: "RECEIPT",
    rawText: lines.join("\n"),
    invoice,
  };
}
