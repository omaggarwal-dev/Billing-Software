import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  getNotificationsHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from "./notification.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getNotificationsHandler);
router.patch("/:id/read", markAsReadHandler);
router.post("/read-all", markAllAsReadHandler);

export default router;