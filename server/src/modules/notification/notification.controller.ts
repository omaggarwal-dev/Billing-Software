import { Request, Response } from "express";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notification.service.js";

export async function getNotificationsHandler(req: Request, res: Response) {
  const franchiseId = getFranchiseId(req);
  const isRead = req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : undefined;
  const notifications = await listNotifications(franchiseId, isRead);
  res.json({ success: true, data: notifications });
}

export async function markAsReadHandler(req: Request, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  await markNotificationAsRead(req.params.id as string, franchiseId);
  res.json({ success: true });
}

export async function markAllAsReadHandler(req: Request, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  await markAllNotificationsAsRead(franchiseId);
  res.json({ success: true });
}