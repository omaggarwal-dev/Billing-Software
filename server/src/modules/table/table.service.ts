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

export const openSessionSchema = z.object({
  partyName: z.string().trim().optional(),
  guestCount: z.number().int().positive("Guest count must be at least 1").default(1),
});

export async function listTables(franchiseId: string | null) {
  if (!franchiseId) return [];

  const tables = await prisma.restaurantTable.findMany({
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
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: { tableNumber: "asc" },
  });

  return tables.map((t) => {
    const remaining = Math.max(0, t.capacity - (t.currentOccupancy || 0));
    return {
      ...t,
      remainingCapacity: remaining,
    };
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
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!table || (franchiseId && table.franchiseId !== franchiseId)) {
    throw new AppError("Table not found", 404);
  }

  const remaining = Math.max(0, table.capacity - (table.currentOccupancy || 0));
  return {
    ...table,
    remainingCapacity: remaining,
  };
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
      currentOccupancy: 0,
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

export async function openTableSession(
  tableId: string,
  franchiseId: string,
  options: { guestCount?: number; partyName?: string } = {},
  currentUserId?: string
) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      sessions: { where: { endedAt: null } },
    },
  });

  if (!table || table.franchiseId !== franchiseId) {
    throw new AppError("Table not found", 404);
  }

  const guests = options.guestCount || 1;
  const currentOcc = table.currentOccupancy || 0;
  const remainingCap = Math.max(0, table.capacity - currentOcc);

  if (remainingCap < guests) {
    // Find intelligent suggested tables
    const allTables = await prisma.restaurantTable.findMany({
      where: { franchiseId, status: { not: TableStatus.OUT_OF_SERVICE } },
    });
    const suggested = allTables
      .filter((t) => t.id !== tableId && (t.capacity - t.currentOccupancy) >= guests)
      .map((t) => ({
        id: t.id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        availableSeats: t.capacity - t.currentOccupancy,
        status: t.status,
      }))
      .slice(0, 3);

    throw new AppError(
      `Table ${table.tableNumber} cannot accommodate ${guests} guests (Capacity: ${table.capacity}, Current Seated: ${currentOcc}, Available Seats: ${remainingCap}).`,
      400,
      { suggestedTables: suggested }
    );
  }

  const session = await prisma.$transaction(async (tx) => {
    const newSession = await tx.tableSession.create({
      data: {
        tableId,
        partyName: options.partyName || `Party of ${guests}`,
        guestCount: guests,
        startedAt: new Date(),
      },
    });

    await tx.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: TableStatus.OCCUPIED,
        currentOccupancy: currentOcc + guests,
      },
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

export async function closeTableSession(
  tableId: string,
  franchiseId: string,
  sessionId?: string,
  currentUserId?: string
) {
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

  const sessionToClose = sessionId
    ? table.sessions.find((s) => s.id === sessionId)
    : table.sessions[0];

  if (!sessionToClose) {
    await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.AVAILABLE, currentOccupancy: 0 },
    });
    return { success: true, message: "Table marked available" };
  }

  if (sessionToClose.orders.length > 0) {
    throw new AppError("Cannot close table session with active unpaid/unbilled orders", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({
      where: { id: sessionToClose.id },
      data: { endedAt: new Date() },
    });

    const remainingActiveSessions = table.sessions.filter((s) => s.id !== sessionToClose.id);
    const newOccupancy = Math.max(0, (table.currentOccupancy || 0) - sessionToClose.guestCount);
    const newStatus = remainingActiveSessions.length === 0 ? TableStatus.AVAILABLE : TableStatus.OCCUPIED;

    await tx.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: newStatus,
        currentOccupancy: remainingActiveSessions.length === 0 ? 0 : newOccupancy,
      },
    });
  });

  emitToFranchise(franchiseId, "table:session_closed", { tableId, sessionId: sessionToClose.id });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CLOSE_TABLE_SESSION",
    entity: "TableSession",
    entityId: sessionToClose.id,
  });

  return { success: true, message: "Table session closed" };
}