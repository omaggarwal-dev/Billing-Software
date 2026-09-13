import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const createLeaveSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  startDate: z.union([z.string(), z.date()]).transform((val) => {
    const d = new Date(val);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }),
  endDate: z.union([z.string(), z.date()]).transform((val) => {
    const d = new Date(val);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }),
  reason: z.string().trim().min(1, "Reason is required"),
});

export async function listLeaveRequests(
  franchiseId: string | null,
  filters: { employeeId?: string; status?: LeaveStatus }
) {
  if (!franchiseId) return [];

  return prisma.leaveRequest.findMany({
    where: {
      franchiseId,
      employeeId: filters.employeeId || undefined,
      status: filters.status || undefined,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLeaveRequest(
  input: z.input<typeof createLeaveSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const data = createLeaveSchema.parse(input);
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });

  if (!employee || employee.franchiseId !== franchiseId) {
    throw new AppError("Employee not found in this franchise", 404);
  }

  const start = new Date(data.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(data.endDate);
  end.setUTCHours(23, 59, 59, 999);

  if (end < start) {
    throw new AppError("End date cannot be before start date", 400);
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      franchiseId,
      employeeId: data.employeeId,
      startDate: start,
      endDate: end,
      reason: data.reason,
      status: LeaveStatus.PENDING,
    },
    include: { employee: true },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "CREATE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: leave.id,
    newData: leave,
  });

  return leave;
}

export async function approveLeaveRequest(id: string, franchiseId: string, approverName: string, currentUserId?: string) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave || leave.franchiseId !== franchiseId) {
    throw new AppError("Leave request not found", 404);
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new AppError(`Cannot approve leave request in ${leave.status} status`, 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedBy: approverName,
      },
      include: { employee: true },
    });

    // Populate Attendance records for the leave period
    const current = new Date(leave.startDate);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(leave.endDate);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      await tx.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: leave.employeeId,
            date: new Date(current),
          },
        },
        create: {
          franchiseId: leave.franchiseId,
          employeeId: leave.employeeId,
          date: new Date(current),
          status: AttendanceStatus.LEAVE,
          notes: `Leave: ${leave.reason || "Approved Leave"}`,
        },
        update: {
          status: AttendanceStatus.LEAVE,
          notes: `Leave: ${leave.reason || "Approved Leave"}`,
        },
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return res;
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "APPROVE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: id,
    oldData: { status: leave.status },
    newData: { status: LeaveStatus.APPROVED, approvedBy: approverName },
  });

  return updated;
}

export async function rejectLeaveRequest(id: string, franchiseId: string, rejectorName: string, currentUserId?: string) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave || leave.franchiseId !== franchiseId) {
    throw new AppError("Leave request not found", 404);
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new AppError(`Cannot reject leave request in ${leave.status} status`, 400);
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: LeaveStatus.REJECTED,
      approvedBy: rejectorName,
    },
    include: { employee: true },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "REJECT_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: id,
    oldData: { status: leave.status },
    newData: { status: LeaveStatus.REJECTED },
  });

  return updated;
}
