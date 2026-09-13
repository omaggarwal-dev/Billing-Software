import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const franchiseInputSchema = z.object({
  name: z.string().trim().min(2, "Franchise name must be at least 2 characters"),
  code: z.string().trim().min(2, "Franchise code must be at least 2 characters").max(30).toUpperCase(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
});

export const franchiseUpdateSchema = franchiseInputSchema.partial();

export type FranchiseInput = z.infer<typeof franchiseInputSchema>;
export type FranchiseUpdate = z.infer<typeof franchiseUpdateSchema>;

export async function listFranchises(userRole?: string, userFranchiseId?: string | null) {
  if (userRole === "SUPER_ADMIN") {
    return prisma.franchise.findMany({
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            tables: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!userFranchiseId) {
    return [];
  }

  return prisma.franchise.findMany({
    where: { id: userFranchiseId },
    include: {
      _count: {
        select: {
          users: true,
          employees: true,
          tables: true,
          orders: true,
        },
      },
    },
  });
}

export async function getFranchiseById(id: string, userRole?: string, userFranchiseId?: string | null) {
  if (userRole !== "SUPER_ADMIN" && userFranchiseId !== id) {
    throw new AppError("Access denied to this franchise", 403);
  }

  const franchise = await prisma.franchise.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
      stations: true,
      printers: true,
      _count: {
        select: {
          employees: true,
          menuItems: true,
          tables: true,
          orders: true,
        },
      },
    },
  });

  if (!franchise) {
    throw new AppError("Franchise not found", 404);
  }

  return franchise;
}

export async function createFranchise(data: FranchiseInput, currentUserId?: string) {
  const existing = await prisma.franchise.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw new AppError("Franchise code already exists", 409);
  }

  const franchise = await prisma.franchise.create({
    data: {
      name: data.name,
      code: data.code,
      address: data.address,
      phone: data.phone,
      email: data.email || null,
    },
  });

  // Seed default preparation stations for this franchise
  await prisma.preparationStation.createMany({
    data: [
      { franchiseId: franchise.id, name: "Main Kitchen" },
      { franchiseId: franchise.id, name: "Tandoor" },
      { franchiseId: franchise.id, name: "Bar / Beverage" },
      { franchiseId: franchise.id, name: "Dessert" },
    ],
    skipDuplicates: true,
  });

  await logAudit({
    franchiseId: franchise.id,
    userId: currentUserId,
    action: "CREATE_FRANCHISE",
    entity: "Franchise",
    entityId: franchise.id,
    newData: franchise,
  });

  return franchise;
}

export async function updateFranchise(id: string, data: FranchiseUpdate, currentUserId?: string) {
  const existing = await prisma.franchise.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Franchise not found", 404);
  }

  if (data.code && data.code !== existing.code) {
    const codeConflict = await prisma.franchise.findUnique({ where: { code: data.code } });
    if (codeConflict) {
      throw new AppError("Franchise code already in use", 409);
    }
  }

  const updated = await prisma.franchise.update({
    where: { id },
    data: {
      ...data,
      email: data.email === "" ? null : data.email,
    },
  });

  await logAudit({
    franchiseId: id,
    userId: currentUserId,
    action: "UPDATE_FRANCHISE",
    entity: "Franchise",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function setFranchiseStatus(id: string, isActive: boolean, currentUserId?: string) {
  const existing = await prisma.franchise.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Franchise not found", 404);
  }

  const updated = await prisma.franchise.update({
    where: { id },
    data: { isActive },
  });

  await logAudit({
    franchiseId: id,
    userId: currentUserId,
    action: isActive ? "ACTIVATE_FRANCHISE" : "DEACTIVATE_FRANCHISE",
    entity: "Franchise",
    entityId: id,
    oldData: { isActive: existing.isActive },
    newData: { isActive },
  });

  return updated;
}