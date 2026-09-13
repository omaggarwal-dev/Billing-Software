import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import {
  attendance,
  dashboard,
  global,
  menu,
  payments,
  payroll,
  sales,
} from "./report.controller.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", dashboard);
router.get("/sales", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"), sales);
router.get("/payments", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"), payments);
router.get("/menu", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"), menu);
router.get("/attendance", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), attendance);
router.get("/payroll", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), payroll);
router.get("/global", authorize("SUPER_ADMIN"), global);

export default router;
