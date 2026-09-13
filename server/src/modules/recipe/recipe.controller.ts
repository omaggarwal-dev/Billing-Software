import { Response } from "express";
import { AuthenticatedRequest, getFranchiseId } from "../../middleware/auth.js";
import {
  listRecipes,
  getRecipeForMenuItem,
  upsertRecipe,
  deleteRecipe,
  upsertRecipeSchema,
} from "./recipe.service.js";

export async function listRecipesHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const recipes = await listRecipes(franchiseId);
  res.json({ success: true, data: recipes });
}

export async function getRecipeHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const recipe = await getRecipeForMenuItem(req.params.menuItemId as string, franchiseId);
  res.json({ success: true, data: recipe });
}

export async function upsertRecipeHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = upsertRecipeSchema.parse(req.body);
  const recipe = await upsertRecipe(req.params.menuItemId as string, parsed, franchiseId, req.user?.userId || req.user?.id);
  res.json({ success: true, data: recipe });
}

export async function deleteRecipeHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const result = await deleteRecipe(req.params.menuItemId as string, franchiseId, req.user?.userId || req.user?.id);
  res.json(result);
}