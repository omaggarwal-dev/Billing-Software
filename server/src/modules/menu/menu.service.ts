import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

// ========================
// CATEGORIES
// ========================

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function listCategories(franchiseId: string | null) {
  if (!franchiseId) return [];
  return prisma.category.findMany({
    where: { franchiseId },
    include: {
      _count: { select: { menuItems: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: z.infer<typeof categorySchema>, franchiseId: string, currentUserId?: string) {
  const existing = await prisma.category.findUnique({
    where: {
      franchiseId_name: {
        franchiseId,
        name: data.name,
      },
    },
  });

  if (existing) {
    throw new AppError("A category with this name already exists in this franchise", 409);
  }

  const category = await prisma.category.create({
    data: {
      franchiseId,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_CATEGORY",
    entity: "Category",
    entityId: category.id,
    newData: category,
  });

  return category;
}

export async function updateCategory(
  id: string,
  data: Partial<z.infer<typeof categorySchema>>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Category not found", 404);
  }

  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.category.findUnique({
      where: {
        franchiseId_name: {
          franchiseId,
          name: data.name,
        },
      },
    });
    if (conflict) {
      throw new AppError("A category with this name already exists in this franchise", 409);
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data,
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "UPDATE_CATEGORY",
    entity: "Category",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function deleteCategory(id: string, franchiseId: string, currentUserId?: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { menuItems: true } } },
  });

  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Category not found", 404);
  }

  if (existing._count.menuItems > 0) {
    throw new AppError("Cannot delete category with associated menu items. Move or delete the items first.", 400);
  }

  await prisma.category.delete({ where: { id } });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "DELETE_CATEGORY",
    entity: "Category",
    entityId: id,
    oldData: existing,
  });

  return { success: true, message: "Category deleted" };
}

// ========================
// MENU ITEMS
// ========================

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  stationId: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().optional().nullable(),
  price: z.number().positive("Price must be greater than 0"),
  isAvailable: z.boolean().default(true),
});

export const updateMenuItemSchema = menuItemSchema.partial();

export async function listMenuItems(
  franchiseId: string | null,
  filters: { categoryId?: string; isAvailable?: boolean; stationId?: string }
) {
  if (!franchiseId) return [];

  return prisma.menuItem.findMany({
    where: {
      franchiseId,
      categoryId: filters.categoryId || undefined,
      stationId: filters.stationId || undefined,
      isAvailable: filters.isAvailable !== undefined ? filters.isAvailable : undefined,
    },
    include: {
      category: {
        select: { id: true, name: true },
      },
      station: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
}

export async function getMenuItemById(id: string, franchiseId: string | null) {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      category: true,
      station: true,
    },
  });

  if (!item || (franchiseId && item.franchiseId !== franchiseId)) {
    throw new AppError("Menu item not found", 404);
  }

  return item;
}

export async function createMenuItem(
  data: z.infer<typeof menuItemSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.franchiseId !== franchiseId) {
    throw new AppError("Invalid category selected for this franchise", 400);
  }

  if (data.stationId) {
    const station = await prisma.preparationStation.findUnique({ where: { id: data.stationId } });
    if (!station || station.franchiseId !== franchiseId) {
      throw new AppError("Invalid preparation station selected for this franchise", 400);
    }
  }

  const item = await prisma.menuItem.create({
    data: {
      franchiseId,
      categoryId: data.categoryId,
      stationId: data.stationId || null,
      name: data.name,
      description: data.description,
      price: new Prisma.Decimal(data.price),
      isAvailable: data.isAvailable,
    },
    include: {
      category: true,
      station: true,
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_MENU_ITEM",
    entity: "MenuItem",
    entityId: item.id,
    newData: item,
  });

  return item;
}

export async function updateMenuItem(
  id: string,
  data: z.infer<typeof updateMenuItemSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Menu item not found", 404);
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.franchiseId !== franchiseId) {
      throw new AppError("Invalid category selected", 400);
    }
  }

  if (data.stationId) {
    const station = await prisma.preparationStation.findUnique({ where: { id: data.stationId } });
    if (!station || station.franchiseId !== franchiseId) {
      throw new AppError("Invalid preparation station selected", 400);
    }
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: {
      categoryId: data.categoryId,
      stationId: data.stationId !== undefined ? (data.stationId || null) : undefined,
      name: data.name,
      description: data.description,
      price: data.price !== undefined ? new Prisma.Decimal(data.price) : undefined,
      isAvailable: data.isAvailable,
    },
    include: {
      category: true,
      station: true,
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "UPDATE_MENU_ITEM",
    entity: "MenuItem",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function setMenuItemAvailability(
  id: string,
  isAvailable: boolean,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.franchiseId !== franchiseId) {
    throw new AppError("Menu item not found", 404);
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable },
    include: { category: true, station: true },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: isAvailable ? "ENABLE_MENU_ITEM" : "DISABLE_MENU_ITEM",
    entity: "MenuItem",
    entityId: id,
    oldData: { isAvailable: existing.isAvailable },
    newData: { isAvailable },
  });

  return updated;
}

// ========================
// PREPARATION STATIONS
// ========================

export async function listStations(franchiseId: string | null) {
  if (!franchiseId) return [];

  return prisma.preparationStation.findMany({
    where: { franchiseId },
    include: {
      printers: true,
      _count: { select: { menuItems: true, kots: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createStation(name: string, franchiseId: string, currentUserId?: string) {
  const existing = await prisma.preparationStation.findUnique({
    where: {
      franchiseId_name: {
        franchiseId,
        name: name.trim(),
      },
    },
  });

  if (existing) {
    throw new AppError("Station with this name already exists", 409);
  }

  const station = await prisma.preparationStation.create({
    data: {
      franchiseId,
      name: name.trim(),
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_STATION",
    entity: "PreparationStation",
    entityId: station.id,
    newData: station,
  });

  return station;
}
