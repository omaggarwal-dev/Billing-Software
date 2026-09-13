import { PayrollStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  bonusMap: z.record(z.string(), z.number().min(0)).optional(),
  deductionsMap: z.record(z.string(), z.number().min(0)).optional(),
  advanceMap: z.record(z.string(), z.number().min(0)).optional(),
});

export const updatePayrollItemSchema = z.object({
  bonus: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  advance: z.number().min(0).optional(),
  allowances: z.number().min(0).optional(),
  overtime: z.number().min(0).optional(),
});

export async function listPayrolls(
  franchiseId: string | null,
  filters: { year?: number; status?: PayrollStatus } = {}
) {
  if (!franchiseId) return [];

  return prisma.payroll.findMany({
    where: {
      franchiseId,
      year: filters.year || undefined,
      status: filters.status || undefined,
    },
    include: {
      items: {
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
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getPayrollById(id: string, franchiseId: string | null) {
  if (!franchiseId) return null;

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: {
            include: {
              salaryStructure: true,
            },
          },
        },
      },
    },
  });

  if (!payroll || payroll.franchiseId !== franchiseId) {
    throw new AppError("Payroll record not found", 404);
  }

  return payroll;
}

export async function generateMonthlyPayroll(
  data: z.infer<typeof generatePayrollSchema>,
  franchiseId: string,
  currentUserId?: string
) {
  const existing = await prisma.payroll.findUnique({
    where: {
      franchiseId_month_year: {
        franchiseId,
        month: data.month,
        year: data.year,
      },
    },
    include: { items: true },
  });

  if (existing && existing.status !== PayrollStatus.DRAFT) {
    throw new AppError(`Payroll for ${data.month}/${data.year} is already ${existing.status} and cannot be regenerated`, 400);
  }

  const employees = await prisma.employee.findMany({
    where: {
      franchiseId,
      status: { not: "TERMINATED" },
    },
    include: {
      salaryStructure: true,
    },
  });

  if (employees.length === 0) {
    throw new AppError("No employees found to generate payroll for this franchise", 400);
  }

  const totalDaysInMonth = new Date(data.year, data.month, 0).getDate();
  const startOfMonth = new Date(Date.UTC(data.year, data.month - 1, 1));
  const endOfMonth = new Date(Date.UTC(data.year, data.month, 0, 23, 59, 59, 999));

  const attendances = await prisma.attendance.findMany({
    where: {
      franchiseId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  // Automatically fetch employee advances for this period
  const advances = await prisma.employeeAdvance.findMany({
    where: {
      franchiseId,
      status: "APPROVED",
      advanceDate: { gte: startOfMonth, lte: endOfMonth },
      payrollId: null,
    },
  });

  let totalGrossSum = 0;
  let totalDeductionsSum = 0;
  let totalNetSum = 0;

  const itemsToCreate = employees.map((emp) => {
    const basic = emp.salaryStructure ? Number(emp.salaryStructure.basicSalary) : 0;
    const allowances = emp.salaryStructure ? Number(emp.salaryStructure.allowances) : 0;

    const empAttendances = attendances.filter((a) => a.employeeId === emp.id);
    const absentCount = empAttendances.filter((a) => a.status === "ABSENT").length;
    const halfDayCount = empAttendances.filter((a) => a.status === "HALF_DAY").length;

    const dailyRate = totalDaysInMonth > 0 ? basic / totalDaysInMonth : 0;
    const attendanceDeduction = (absentCount * dailyRate) + (halfDayCount * dailyRate * 0.5);

    const bonus = (data.bonusMap && data.bonusMap[emp.id]) ? data.bonusMap[emp.id] : 0;
    const extraDeduction = (data.deductionsMap && data.deductionsMap[emp.id]) ? data.deductionsMap[emp.id] : 0;
    
    // Auto-calculated advance total
    const empAutoAdvance = advances
      .filter((adv) => adv.employeeId === emp.id)
      .reduce((sum, adv) => sum + Number(adv.amount), 0);
    const manualAdvance = (data.advanceMap && data.advanceMap[emp.id]) ? data.advanceMap[emp.id] : 0;
    const advance = empAutoAdvance + manualAdvance;
    const overtime = 0;

    const gross = basic + allowances + overtime + bonus;
    const totalDeductions = attendanceDeduction + extraDeduction + advance;
    const net = Math.max(0, gross - totalDeductions);

    totalGrossSum += gross;
    totalDeductionsSum += totalDeductions;
    totalNetSum += net;

    return {
      employeeId: emp.id,
      basicSalary: new Prisma.Decimal(basic.toFixed(2)),
      allowances: new Prisma.Decimal(allowances.toFixed(2)),
      overtime: new Prisma.Decimal(overtime.toFixed(2)),
      bonus: new Prisma.Decimal(bonus.toFixed(2)),
      deductions: new Prisma.Decimal((attendanceDeduction + extraDeduction).toFixed(2)),
      advance: new Prisma.Decimal(advance.toFixed(2)),
      advancesDeducted: new Prisma.Decimal(empAutoAdvance.toFixed(2)),
      netSalary: new Prisma.Decimal(net.toFixed(2)),
    };
  });

  const payroll = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.payrollItem.deleteMany({ where: { payrollId: existing.id } });
      await tx.payroll.delete({ where: { id: existing.id } });
    }

    const createdPayroll = await tx.payroll.create({
      data: {
        franchiseId,
        month: data.month,
        year: data.year,
        status: PayrollStatus.DRAFT,
        totalGross: new Prisma.Decimal(totalGrossSum.toFixed(2)),
        totalDeductions: new Prisma.Decimal(totalDeductionsSum.toFixed(2)),
        totalNet: new Prisma.Decimal(totalNetSum.toFixed(2)),
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            employee: true,
          },
        },
      },
    });

    return createdPayroll;
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "GENERATE_PAYROLL",
    entity: "Payroll",
    entityId: payroll.id,
    newData: { id: payroll.id, month: data.month, year: data.year, totalNet: totalNetSum },
  });

  return payroll;
}

export async function finalizePayroll(id: string, franchiseId: string, currentUserId?: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } });
  if (!payroll || payroll.franchiseId !== franchiseId) {
    throw new AppError("Payroll not found", 404);
  }

  if (payroll.status !== PayrollStatus.DRAFT) {
    throw new AppError(`Payroll is already ${payroll.status}`, 400);
  }

  const updated = await prisma.payroll.update({
    where: { id },
    data: { status: PayrollStatus.FINALIZED },
    include: { items: { include: { employee: true } } },
  });

  await logAudit({
    franchiseId,
    userId: currentUserId,
    action: "FINALIZE_PAYROLL",
    entity: "Payroll",
    entityId: id,
  });

  return updated;
}

export async function markPayrollPaid(id: string, franchiseId: string, currentUserId?: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } });
  if (!payroll || payroll.franchiseId !== franchiseId) {
    throw new AppError("Payroll not found", 404);
  }

  if (payroll.status === PayrollStatus.PAID) {
    throw new AppError("Payroll is already marked as PAID", 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payroll.update({
      where: { id },
      data: { status: PayrollStatus.PAID },
      include: { items: { include: { employee: true } } },
    });

    // Mark all associated advances as DEDUCTED
    const startOfMonth = new Date(Date.UTC(payroll.year, payroll.month - 1, 1));
    const endOfMonth = new Date(Date.UTC(payroll.year, payroll.month, 0, 23, 59, 59, 999));

    await tx.employeeAdvance.updateMany({
      where: {
        franchiseId,
        advanceDate: { gte: startOfMonth, lte: endOfMonth },
        status: "APPROVED",
        payrollId: null,
      },
      data: {
        status: "DEDUCTED",
        payrollId: id,
      },
    });

    await logAudit({
      franchiseId,
      userId: currentUserId,
      action: "MARK_PAYROLL_PAID",
      entity: "Payroll",
      entityId: id,
    });

    return updated;
  });
}
export const markPayrollAsPaid = markPayrollPaid;
