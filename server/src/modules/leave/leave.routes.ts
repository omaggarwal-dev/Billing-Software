import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { approve, create, list, reject } from "./leave.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), list);
router.post("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), create);
router.patch("/:id/approve", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), approve);
router.patch("/:id/reject", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"), reject);

export default router;
