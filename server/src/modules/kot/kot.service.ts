import { KOTStatus, OrderStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";
import { emitToFranchise, emitToStation } from "../../lib/socket.js";

export const generateKOTSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  itemIds: z.array(z.string()).optional(), // optional subset of orderItemIds, or all if omitted
});

export const updateKOTStatusSchema = z.object({
  status: z.nativeEnum(KOTStatus),
});

export async function listKOTs(
  franchiseId: string | null,
  filters: { status?: KOTStatus; stationId?: string; orderId?: string }
) {
  if (!franchiseId) return [];

  return prisma.kOT.findMany({
    where: {
      franchiseId,
      status: filters.status || undefined,
      stationId: filters.stationId || undefined,
      orderId: filters.orderId || undefined,
    },
    include: {
      station: true,
      order: {
        include: {
          tableSession: { include: { table: true } },
        },
      },
      items: {
        include: {
          menuItem: {
            include: { category: true, station: true },
          },
          orderItem: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKOTById(id: string, franchiseId: string | null) {
  const kot = await prisma.kOT.findUnique({
    where: { id },
    include: {
      station: true,
      order: {
        include: {
          tableSession: { include: { table: true } },
        },
      },
      items: {
        include: {
          menuItem: true,
          orderItem: true,
        },
      },
      franchise: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!kot || (franchiseId && kot.franchiseId !== franchiseId)) {
    throw new AppError("KOT not found", 404);
  }

  return kot;
}

export async function generateKOTsForOrder(
  orderId: string,
  franchiseId: string,
  itemIds?: string[],
  currentUserId?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          menuItem: { include: { station: true } },
          kotItems: true,
        },
      },
      tableSession: { include: { table: true } },
    },
  });

  if (!order || order.franchiseId !== franchiseId) {
    throw new AppError("Order not found in this franchise", 404);
  }

  // Filter items that need KOT generation (e.g. not yet in any KOT or specific itemIds requested)
  let candidateItems = order.items;
  if (itemIds && itemIds.length > 0) {
    candidateItems = candidateItems.filter((i) => itemIds.includes(i.id));
  } else {
    // Exclude items already generated in previous KOTs
    candidateItems = candidateItems.filter((i) => i.kotItems.length === 0);
  }

  if (candidateItems.length === 0) {
    // If all items already generated, allow re-generating for the entire order
    candidateItems = order.items;
  }

  // Group candidate items by stationId
  const stationGroups = new Map<string | null, typeof candidateItems>();
  for (const item of candidateItems) {
    const stationId = item.menuItem.stationId ?? null;
    if (!stationGroups.has(stationId)) {
      stationGroups.set(stationId, []);
    }
    stationGroups.get(stationId)!.push(item);
  }

  const generatedKOTs = [];

  for (const [stationId, items] of stationGroups.entries()) {
    const kotCount = await prisma.kOT.count({ where: { franchiseId } });
    const kotNumber = `KOT-${String(kotCount + 1).padStart(4, "0")}`;

    const kot = await prisma.kOT.create({
      data: {
        franchiseId,
        orderId,
        stationId,
        kotNumber,
        status: KOTStatus.CREATED,
        items: {
          create: items.map((i) => ({
            orderItemId: i.id,
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            notes: i.notes,
          })),
        },
      },
      include: {
        station: true,
        order: {
          include: {
            tableSession: { include: { table: true } },
          },
        },
        items: {
          include: {
            menuItem: true,
            orderItem: true,
          },
        },
      },
    });

    generatedKOTs.push(kot);

    emitToFranchise(franchiseId, "kot:new", kot);
    if (stationId) {
      emitToStation(franchiseId, stationId, "kot:new", kot);
    }
  }

  // Update order status to PREPARING if it was OPEN or CONFIRMED
  if (order.status === OrderStatus.OPEN || order.status === OrderStatus.CONFIRMED) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PREPARING },
    });
    emitToFranchise(franchiseId, "order:status_changed", { orderId, status: OrderStatus.PREPARING });
  }

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "GENERATE_KOT",
    entity: "KOT",
    entityId: orderId,
    newData: { kotCount: generatedKOTs.length, kotNumbers: generatedKOTs.map((k) => k.kotNumber) },
  });

  return generatedKOTs;
}

export async function updateKOTStatus(
  id: string,
  status: KOTStatus,
  franchiseId: string,
  currentUserId?: string
) {
  const kot = await prisma.kOT.findUnique({
    where: { id },
    include: { order: { include: { kots: true } } },
  });

  if (!kot || kot.franchiseId !== franchiseId) {
    throw new AppError("KOT not found", 404);
  }

  const updateData: {
    status: KOTStatus;
    printedAt?: Date;
    completedAt?: Date;
  } = { status };

  if (status === KOTStatus.PRINTED && !kot.printedAt) {
    updateData.printedAt = new Date();
  } else if (status === KOTStatus.READY || status === KOTStatus.SERVED) {
    updateData.completedAt = new Date();
  }

  const updatedKOT = await prisma.kOT.update({
    where: { id },
    data: updateData,
    include: {
      station: true,
      order: {
        include: {
          tableSession: { include: { table: true } },
        },
      },
      items: {
        include: {
          menuItem: true,
          orderItem: true,
        },
      },
    },
  });

  // Check if all KOTs for the order are READY
  if (status === KOTStatus.READY) {
    const allKots = await prisma.kOT.findMany({
      where: { orderId: kot.orderId, status: { not: KOTStatus.CANCELLED } },
    });
    const allReady = allKots.every((k) => k.status === KOTStatus.READY || k.status === KOTStatus.SERVED);
    if (allReady) {
      await prisma.order.update({
        where: { id: kot.orderId },
        data: { status: OrderStatus.READY },
      });
      emitToFranchise(franchiseId, "order:status_changed", { orderId: kot.orderId, status: OrderStatus.READY });
    }
  }

  emitToFranchise(franchiseId, "kot:status_changed", updatedKOT);
  if (updatedKOT.stationId) {
    emitToStation(franchiseId, updatedKOT.stationId, "kot:status_changed", updatedKOT);
  }

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: `KOT_${status}`,
    entity: "KOT",
    entityId: id,
    oldData: { status: kot.status },
    newData: { status },
  });

  return updatedKOT;
}
