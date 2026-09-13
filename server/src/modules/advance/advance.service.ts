import { AdvanceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const createAdvanceSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().min(1, "Reason is required"),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "OTHER"]).default("CASH"),
  notes: z.string().trim().optional(),
  advanceDate: z.string().optional(),
});

export async function listAdvances(
  franchiseId: string | null,
  filters: { employeeId?: string; status?: AdvanceStatus }
) {
  if (!franchiseId) return [];

  return prisma.employeeAdvance.findMany({
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
    orderBy: { advanceDate: "desc" },
  });
}

export async function createAdvance(
  data: z.infer<typeof createAdvanceSchema>,
  franchiseId: string,
  userId?: string
) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, franchiseId },
  });
  if (!employee) throw new AppError("Employee not found in this franchise", 404);

  const advance = await prisma.employeeAdvance.create({
    data: {
      franchiseId,
      employeeId: data.employeeId,
      amount: new Prisma.Decimal(data.amount.toFixed(2)),
      reason: data.reason,
      paymentMethod: data.paymentMethod as PaymentMethod,
      status: AdvanceStatus.APPROVED, // Immediate payout to employee
      advanceDate: data.advanceDate ? new Date(data.advanceDate) : new Date(),
      approvedBy: userId,
      notes: data.notes,
    },
    include: { employee: true },
  });

  await logAudit({
    franchiseId,
    userId,
    action: "RECORD_EMPLOYEE_ADVANCE",
    entity: "EmployeeAdvance",
    entityId: advance.id,
    newData: advance,
  });

  return advance;
}

export async function getUnsettledAdvancesTotal(employeeId: string, franchiseId: string) {
  const result = await prisma.employeeAdvance.aggregate({
    where: {
      franchiseId,
      employeeId,
      status: AdvanceStatus.APPROVED,
      payrollId: null,
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount || 0);
}