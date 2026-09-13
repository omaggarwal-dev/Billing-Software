import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, get, list, update, updateStatus } from "./employee.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), list);
router.get("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), get);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), create);
router.put("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), update);
router.patch("/:id/status", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), updateStatus);

export default router;
