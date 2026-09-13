import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { checkIn, checkOut, list, record } from "./attendance.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"), list);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), record);
router.post("/check-in", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), checkIn);
router.post("/check-out", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), checkOut);

export default router;
