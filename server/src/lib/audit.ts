import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";

interface AuditLogOptions {
  franchiseId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}

export async function logAudit(options: AuditLogOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        franchiseId: options.franchiseId ?? null,
        userId: options.userId ?? null,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId ?? null,
        oldData: (options.oldData ? (options.oldData as Prisma.InputJsonValue) : Prisma.JsonNull),
        newData: (options.newData ? (options.newData as Prisma.InputJsonValue) : Prisma.JsonNull),
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
