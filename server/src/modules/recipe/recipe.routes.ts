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

// Manage recipes - Manager, Super Admin, Chef
router.post("/menu-item/:menuItemId", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CHEF), upsertRecipeHandler);
router.delete("/menu-item/:menuItemId", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER), deleteRecipeHandler);

export default router;