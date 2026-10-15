import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import {
  listRecipesHandler,
  getRecipeHandler,
  upsertRecipeHandler,
  deleteRecipeHandler,
} from "./recipe.controller.js";

const router = Router();

router.use(authenticate);

// View recipes - Chef, Manager, Cashier, Super Admin
router.get("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CHEF, UserRole.CASHIER), listRecipesHandler);
router.get("/menu-item/:menuItemId", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CHEF, UserRole.CASHIER), getRecipeHandler);

// Manage recipes (SOP) - Super Admin / Brand Owner only
router.post("/menu-item/:menuItemId", authorizeRole(UserRole.SUPER_ADMIN), upsertRecipeHandler);
router.delete("/menu-item/:menuItemId", authorizeRole(UserRole.SUPER_ADMIN), deleteRecipeHandler);

export default router;