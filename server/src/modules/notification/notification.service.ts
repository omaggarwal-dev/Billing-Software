import prisma from "../../lib/prisma.js";

export async function listNotifications(franchiseId: string | null, isRead?: boolean) {
  if (!franchiseId) return [];

  return prisma.notification.findMany({
    where: {
      franchiseId,
      isRead: isRead !== undefined ? isRead : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationAsRead(id: string, franchiseId: string) {
  return prisma.notification.updateMany({
    where: { id, franchiseId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(franchiseId: string) {
  return prisma.notification.updateMany({
    where: { franchiseId, isRead: false },
    data: { isRead: true },
  });
}