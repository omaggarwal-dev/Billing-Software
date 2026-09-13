import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const recordAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  date: z.string().transform((val) => {
    const d = new Date(val);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }),
  status: z.nativeEnum(AttendanceStatus),
  checkIn: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  checkOut: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  notes: z.string().optional().nullable(),
});

export const checkInSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  notes: z.string().optional().nullable(),
});

export const checkOutSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  notes: z.string().optional().nullable(),
});

export async function listAttendance(
  franchiseId: string | null,
  filters: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }
) {
  if (!franchiseId) return [];

  let dateFilter: { gte?: Date; lte?: Date } | undefined;

  if (filters.startDate || filters.endDate) {
    dateFilter = {};
    if (filters.startDate) {
      const s = new Date(filters.startDate);
      s.setUTCHours(0, 0, 0, 0);
      dateFilter.gte = s;
    }
    if (filters.endDate) {
      const e = new Date(filters.endDate);
      e.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = e;
    }
  } else if (filters.month && filters.year) {
    const startOfMonth = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const endOfMonth = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));
    dateFilter = { gte: startOfMonth, lte: endOfMonth };
  }

  return prisma.attendance.findMany({
    where: {
      franchiseId,
      employeeId: filters.employeeId || undefined,
      date: dateFilter,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          status: true,
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function recordAttendance(
  data: z.infer<typeof recordAttendanceSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });

  if (!employee || employee.franchiseId !== franchiseId) {
    throw new AppError("Employee not found in this franchise", 404);
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: data.date,
      },
    },
    create: {
      franchiseId,
      employeeId: data.employeeId,
      date: data.date,
      status: data.status,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      notes: data.notes,
    },
    update: {
      status: data.status,
      checkIn: data.checkIn !== undefined ? data.checkIn : undefined,
      checkOut: data.checkOut !== undefined ? data.checkOut : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
    },
    include: {
      employee: true,
    },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "RECORD_ATTENDANCE",
    entity: "Attendance",
    entityId: attendance.id,
    newData: attendance,
  });

  return attendance;
}

export async function employeeCheckIn(employeeId: string, franchiseId: string, notes?: string | null) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.franchiseId !== franchiseId) {
    throw new AppError("Employee not found in this franchise", 404);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date: today,
      },
    },
  });

  if (existing && existing.checkIn) {
    throw new AppError("Employee is already checked in for today", 400);
  }

  const now = new Date();

  return prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId,
        date: today,
      },
    },
    create: {
      franchiseId,
      employeeId,
      date: today,
      status: AttendanceStatus.PRESENT,
      checkIn: now,
      notes,
    },
    update: {
      status: AttendanceStatus.PRESENT,
      checkIn: now,
      notes: notes || undefined,
    },
    include: {
      employee: true,
    },
  });
}

export async function employeeCheckOut(employeeId: string, franchiseId: string, notes?: string | null) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.franchiseId !== franchiseId) {
    throw new AppError("Employee not found in this franchise", 404);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date: today,
      },
    },
  });

  if (!existing) {
    throw new AppError("No attendance check-in found for today", 400);
  }

  const now = new Date();

  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      notes: notes ? (existing.notes ? `${existing.notes}; ${notes}` : notes) : undefined,
    },
    include: {
      employee: true,
    },
  });
}
