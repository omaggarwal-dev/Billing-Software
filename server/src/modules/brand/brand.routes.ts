import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { getSettings, updateSettings } from "./brand.controller.js";

const router = Router();

router.use(authenticate);

// View settings (all authenticated users can read business details/rates)
router.get("/", getSettings);

// Update settings strictly restricted to SUPER_ADMIN (Brand Owner)
router.put("/", authorize("SUPER_ADMIN"), updateSettings);

export default router;
