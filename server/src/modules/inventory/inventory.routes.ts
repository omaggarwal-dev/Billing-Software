import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import {
  getInventoryItemsHandler,
  createInventoryItemHandler,
  updateInventoryItemHandler,
  stockInHandler,
  adjustStockHandler,
  getTransactionsHandler,
  getStatsHandler,
} from "./inventory.controller.js";

const router = Router();

router.use(authenticate);

// List & Stats - Cashier, Chef, Manager, Super Admin
router.get("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CASHIER, UserRole.CHEF), getInventoryItemsHandler);
router.get("/stats", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CASHIER), getStatsHandler);
router.get("/transactions", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CASHIER), getTransactionsHandler);

// Stock-In (Cashier and Manager can log fresh inventory)
router.post("/stock-in", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CASHIER), stockInHandler);

// Create item, update, adjust (Manager & Super Admin)
router.post("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER), createInventoryItemHandler);
router.put("/:id", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER), updateInventoryItemHandler);
router.post("/adjust", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.CASHIER), adjustStockHandler);

export default router;