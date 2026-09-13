import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { cancel, confirm, create, get, list, serve, update } from "./order.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF", "ACCOUNTANT"), list);
router.get("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF", "ACCOUNTANT"), get);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER"), create);
router.put("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER"), update);
router.post("/:id/confirm", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER"), confirm);
router.post("/:id/cancel", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER"), cancel);
router.post("/:id/serve", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF"), serve);

export default router;
