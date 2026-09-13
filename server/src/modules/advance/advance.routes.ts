import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import {
  listAdvancesHandler,
  createAdvanceHandler,
  getUnsettledHandler,
} from "./advance.controller.js";

const router = Router();

router.use(authenticate);

// View advances - HR, Accountant, Manager, Cashier, Super Admin
router.get("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.HR, UserRole.ACCOUNTANT, UserRole.CASHIER), listAdvancesHandler);
router.get("/employee/:employeeId/unsettled", getUnsettledHandler);

// Cashiers, HR, and Managers can record employee mid-month advance payouts
router.post("/", authorizeRole(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_MANAGER, UserRole.HR, UserRole.CASHIER), createAdvanceHandler);

export default router;