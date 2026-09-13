import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, get, list } from "./billing.controller.js";

const router = Router();

router.use(authenticate);

router.get("/invoices", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"), list);
router.get("/invoices/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"), get);
router.post("/invoices", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER"), create);

export default router;
