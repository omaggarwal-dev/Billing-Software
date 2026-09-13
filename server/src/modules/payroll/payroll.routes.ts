import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { finalize, generate, get, list, pay } from "./payroll.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), list);
router.get("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), get);
router.post("/generate", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), generate);
router.post("/:id/finalize", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"), finalize);
router.post("/:id/pay", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"), pay);

export default router;
