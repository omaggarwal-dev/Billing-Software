import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, list, refund } from "./payment.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"), list);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"), create);
router.post("/:id/refund", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"), refund);

export default router;
