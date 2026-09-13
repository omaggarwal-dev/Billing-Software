import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, get, list, update, updateStatus } from "./user.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), list);
router.get("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), get);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), create);
router.put("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), update);
router.patch("/:id/status", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), updateStatus);

export default router;