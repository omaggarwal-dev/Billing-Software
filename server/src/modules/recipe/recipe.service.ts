import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const upsertRecipeSchema = z.object({
  name: z.string().trim().min(1, "Recipe name is required"),
  prepInstructions: z.string().trim().optional(),
  servingSize: z.string().trim().optional(),
  wastageAllowance: z.number().min(0).max(100).default(0),
  items: z.array(
    z.object({
      inventoryItemId: z.string().min(1, "Inventory item is required"),
      quantity: z.number().positive("Quantity must be greater than 0"),
      unit: z.string().trim().min(1, "Unit is required"),
      wastageAllowance: z.number().min(0).max(100).default(0),
    })
  ).min(1, "Recipe must contain at least one ingredient"),
});

export async function getRecipeForMenuItem(menuItemId: string, franchiseId: string | null) {
  if (!franchiseId) return null;

  return prisma.recipe.findFirst({
    where: { menuItemId, franchiseId },
    include: {
      items: {
        include: { inventoryItem: true },
      },
      menuItem: true,
    },
  });
}

export async function listRecipes(franchiseId: string | null) {
  if (!franchiseId) return [];

  return prisma.recipe.findMany({
    where: { franchiseId },
    include: {
      menuItem: true,
      items: {
        include: { inventoryItem: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertRecipe(
  menuItemId: string,
  data: z.infer<typeof upsertRecipeSchema>,
  franchiseId: string,
  userId?: string
) {
  const menuItem = await prisma.menuItem.findFirst({
    where: { id: menuItemId, franchiseId },
  });
  if (!menuItem) throw new AppError("Menu item not found", 404);

  // Verify all inventory items exist in franchise
  for (const it of data.items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { id: it.inventoryItemId, franchiseId },
    });
    if (!inv) throw new AppError(`Inventory item not found: ${it.inventoryItemId}`, 400);
  }

  return prisma.$transaction(async (tx) => {
    // Delete existing recipe items if recipe exists
    const existing = await tx.recipe.findUnique({
      where: { menuItemId },
      include: { items: true },
    });

    let recipe;
    if (existing) {
      await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
      recipe = await tx.recipe.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          prepInstructions: data.prepInstructions,
          servingSize: data.servingSize,
          wastageAllowance: new Prisma.Decimal(data.wastageAllowance),
          items: {
            create: data.items.map((i) => ({
              inventoryItemId: i.inventoryItemId,
              quantity: new Prisma.Decimal(i.quantity),
              unit: i.unit.toLowerCase(),
              wastageAllowance: new Prisma.Decimal(i.wastageAllowance),
            })),
          },
        },
        include: { items: { include: { inventoryItem: true } }, menuItem: true },
      });
    } else {
      recipe = await tx.recipe.create({
        data: {
          franchiseId,
          menuItemId,
          name: data.name,
          prepInstructions: data.prepInstructions,
          servingSize: data.servingSize,
          wastageAllowance: new Prisma.Decimal(data.wastageAllowance),
          items: {
            create: data.items.map((i) => ({
              inventoryItemId: i.inventoryItemId,
              quantity: new Prisma.Decimal(i.quantity),
              unit: i.unit.toLowerCase(),
              wastageAllowance: new Prisma.Decimal(i.wastageAllowance),
            })),
          },
        },
        include: { items: { include: { inventoryItem: true } }, menuItem: true },
      });
    }

    await logAudit({
      franchiseId,
      userId,
      action: "UPSERT_SOP_RECIPE",
      entity: "Recipe",
      entityId: recipe.id,
      newData: recipe,
    });

    return recipe;
  });
}

export async function deleteRecipe(menuItemId: string, franchiseId: string, userId?: string) {
  const existing = await prisma.recipe.findFirst({
    where: { menuItemId, franchiseId },
  });
  if (!existing) throw new AppError("Recipe not found", 404);

  await prisma.recipe.delete({ where: { id: existing.id } });

  await logAudit({
    franchiseId,
    userId,
    action: "DELETE_SOP_RECIPE",
    entity: "Recipe",
    entityId: existing.id,
  });

  return { success: true };
}