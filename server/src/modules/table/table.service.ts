import { TableStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise } from "../../lib/socket.js";

export const tableSchema = z.object({
  tableNumber: z.string().trim().min(1, "Table number is required").toUpperCase(),
  capacity: z.number().int().positive("Capacity must be at least 1"),
  status: z.nativeEnum(TableStatus).default(TableStatus.AVAILABLE),
});

export const updateTableSchema = tableSchema.partial();

export async function listTables(franchiseId: string | null) {
  if (!franchiseId) return [];

  return prisma.restaurantTable.findMany({
    where: { franchiseId },
    include: {
      sessions: {
        where: { endedAt: null },
        include: {
          orders: {
            where: { status: { notIn: ["CANCELLED", "BILLED"] } },
            include: {
              items: {
                include: { menuItem: true },
              },
            },
          },
        },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: { tableNumber: "asc" },
  });
}

export async function getTableById(id: string, franchiseId: string | null) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id },
    include: {
      sessions: {
        where: { endedAt: null },
        include: {
          orders: {
            include: {
              items: { include: { menuItem: true } },
              kots: { include: { items: true } },
              invoice: true,
            },
          },
        },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!table || (franchiseId && table.franchiseId !== franchiseId)) {
    throw new AppError("Table not found", 404);
  }

  return table;
}

export async function createTable(
  data: z.infer<typeof tableSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.restaurantTable.findUnique({
    where: {
      franchiseId_tableNumber: {
        franchiseId,
        tableNumber: data.tableNumber,
      },
    },
  });

  if (existing) {
    throw new AppError(`Table '${data.tableNumber}' already exists in this franchise`, 409);
  }

  const table = await prisma.restaurantTable.create({
    data: {
      franchiseId,
      tableNumber: data.tableNumber,
      capacity: data.capacity,
      status: data.status,
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_TABLE",
    entity: "RestaurantTable",
    entityId: table.id,
    newData: table,
  });

  emitToFranchise(franchiseId, "table:created", table);
  return table;
}

export async function updateTable(
  id: string,
  data: z.infer<typeof updateTableSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.restaurantTable.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Table not found", 404);
  }

  if (data.tableNumber && data.tableNumber !== existing.tableNumber) {
    const conflict = await prisma.restaurantTable.findUnique({
      where: {
        franchiseId_tableNumber: {
          franchiseId,
          tableNumber: data.tableNumber,
        },
      },
    });
    if (conflict) {
      throw new AppError(`Table '${data.tableNumber}' already exists in this franchise`, 409);
    }
  }

  const updated = await prisma.restaurantTable.update({
    where: { id },
    data,
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "UPDATE_TABLE",
    entity: "RestaurantTable",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  emitToFranchise(franchiseId, "table:updated", updated);
  return updated;
}

export async function openTableSession(tableId: string, franchiseId: string, currentUserId?: string) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      sessions: { where: { endedAt: null } },
    },
  });

  if (!table || table.franchiseId !== franchiseId) {
    throw new AppError("Table not found", 404);
  }

  if (table.sessions.length > 0) {
    return table.sessions[0];
  }

  const session = await prisma.$transaction(async (tx) => {
    const newSession = await tx.tableSession.create({
      data: {
        tableId,
        startedAt: new Date(),
      },
    });

    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });

    return newSession;
  });

  emitToFranchise(franchiseId, "table:session_opened", { tableId, session });
  emitToFranchise(franchiseId, "table:status_changed", { tableId, status: TableStatus.OCCUPIED });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "OPEN_TABLE_SESSION",
    entity: "TableSession",
    entityId: session.id,
    newData: session,
  });

  return session;
}

export async function closeTableSession(tableId: string, franchiseId: string, currentUserId?: string) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      sessions: {
        where: { endedAt: null },
        include: {
          orders: {
            where: { status: { notIn: ["BILLED", "CANCELLED"] } },
          },
        },
      },
    },
  });

  if (!table || table.franchiseId !== franchiseId) {
    throw new AppError("Table not found", 404);
  }

  const activeSession = table.sessions[0];
  if (!activeSession) {
    await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.AVAILABLE },
    });
    return { success: true, message: "Table marked available" };
  }

  if (activeSession.orders.length > 0) {
    throw new AppError("Cannot close table session with active unpaid/unbilled orders", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({
      where: { id: activeSession.id },
      data: { endedAt: new Date() },
    });

    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.AVAILABLE },
    });
  });

  emitToFranchise(franchiseId, "table:session_closed", { tableId, sessionId: activeSession.id });
  emitToFranchise(franchiseId, "table:status_changed", { tableId, status: TableStatus.AVAILABLE });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CLOSE_TABLE_SESSION",
    entity: "TableSession",
    entityId: activeSession.id,
  });

  return { success: true, message: "Table session closed and table is now available" };
}
