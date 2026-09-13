import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { generate, get, list, setStatus } from "./kot.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF"), list);
router.get("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF"), get);
router.post("/generate", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER"), generate);
router.patch("/:id/status", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF", "CASHIER", "WAITER"), setStatus);

export default router;
