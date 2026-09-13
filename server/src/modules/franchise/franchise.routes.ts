import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { create, get, list, update, updateStatus } from "./franchise.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", list);
router.get("/:id", get);
router.post("/", authorize("SUPER_ADMIN"), create);
router.put("/:id", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), update);
router.patch("/:id/status", authorize("SUPER_ADMIN"), updateStatus);

export default router;