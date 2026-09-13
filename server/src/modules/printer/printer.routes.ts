import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, list, printJob, remove, update } from "./printer.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), list);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), create);
router.put("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), update);
router.delete("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), remove);
router.post("/print-job", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "CASHIER", "CHEF"), printJob);

export default router;
