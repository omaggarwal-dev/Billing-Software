import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import {
  getCategoriesHandler,
  createCategoryHandler,
  listExpensesHandler,
  createExpenseHandler,
  reviewExpenseHandler,
  getExpenseStatsHandler,
} from "./expense.controller.js";

const router = Router();

router.use(authenticate);

// View & Stats - Manager, Cashier, Accountant, Super Admin
router.get("/categories", getCategoriesHandler);
router.post("/categories", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER), createCategoryHandler);

router.get("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER), listExpensesHandler);
router.get("/stats", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER), getExpenseStatsHandler);

// Cashiers and Managers can create unforeseen expenses
router.post("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER), createExpenseHandler);

// Only Manager, Accountant, Super Admin can review/approve
router.patch("/:id/review", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.ACCOUNTANT), reviewExpenseHandler);

export default router;