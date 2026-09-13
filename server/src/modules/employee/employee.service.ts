import { EmployeeStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const createEmployeeSchema = z.object({
  franchiseId: z.string().optional(),
  employeeCode: z.string().trim().min(1, "Employee code is required").toUpperCase(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Invalid email").optional().nullable().or(z.literal("")),
  designation: z.string().trim().optional().nullable(),
  joiningDate: z.string().transform((val) => new Date(val)),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
  salaryStructure: z
    .object({
      basicSalary: z.number().nonnegative(),
      allowances: z.number().nonnegative().default(0),
      overtimeRate: z.number().nonnegative().default(0),
    })
    .optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export async function listEmployees(franchiseId: string | null) {
  if (!franchiseId) return [];

  return prisma.employee.findMany({
    where: { franchiseId },
    include: {
      salaryStructure: true,
      _count: {
        select: {
          attendance: true,
          leaveRequests: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmployeeById(id: string, franchiseId: string | null) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      salaryStructure: true,
      attendance: {
        take: 30,
        orderBy: { date: "desc" },
      },
      leaveRequests: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  if (franchiseId && employee.franchiseId !== franchiseId) {
    throw new AppError("Access denied", 403);
  }

  return employee;
}

export async function createEmployee(data: CreateEmployeeInput, targetFranchiseId: string, currentUserId?: string) {
  const existingCode = await prisma.employee.findUnique({
    where: {
      franchiseId_employeeCode: {
        franchiseId: targetFranchiseId,
        employeeCode: data.employeeCode,
      },
    },
  });

  if (existingCode) {
    throw new AppError(`Employee code '${data.employeeCode}' already exists in this franchise`, 409);
  }

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        franchiseId: targetFranchiseId,
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        email: data.email ? data.email : null,
        designation: data.designation ?? null,
        joiningDate: data.joiningDate,
        status: data.status,
      },
    });

    if (data.salaryStructure) {
      await tx.salaryStructure.create({
        data: {
          employeeId: created.id,
          basicSalary: new Prisma.Decimal(data.salaryStructure.basicSalary),
          allowances: new Prisma.Decimal(data.salaryStructure.allowances || 0),
          overtimeRate: new Prisma.Decimal(data.salaryStructure.overtimeRate || 0),
        },
      });
    }

    return tx.employee.findUnique({
      where: { id: created.id },
      include: { salaryStructure: true },
    });
  });

  await logAudit({
    franchiseId: targetFranchiseId,
    userId: currentUserId,
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: employee?.id,
    newData: employee,
  });

  return employee;
}

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeInput,
  targetFranchiseId: string | null,
  currentUserId?: string
) {
  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { salaryStructure: true },
  });

  if (!existing) {
    throw new AppError("Employee not found", 404);
  }

  if (targetFranchiseId && existing.franchiseId !== targetFranchiseId) {
    throw new AppError("Access denied", 403);
  }

  if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
    const conflict = await prisma.employee.findUnique({
      where: {
        franchiseId_employeeCode: {
          franchiseId: existing.franchiseId,
          employeeCode: data.employeeCode,
        },
      },
    });
    if (conflict) {
      throw new AppError(`Employee code '${data.employeeCode}' already exists in this franchise`, 409);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName !== undefined ? data.lastName : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? (data.email || null) : undefined,
        designation: data.designation !== undefined ? data.designation : undefined,
        joiningDate: data.joiningDate,
        status: data.status,
      },
    });

    if (data.salaryStructure) {
      await tx.salaryStructure.upsert({
        where: { employeeId: id },
        create: {
          employeeId: id,
          basicSalary: new Prisma.Decimal(data.salaryStructure.basicSalary),
          allowances: new Prisma.Decimal(data.salaryStructure.allowances || 0),
          overtimeRate: new Prisma.Decimal(data.salaryStructure.overtimeRate || 0),
        },
        update: {
          basicSalary: new Prisma.Decimal(data.salaryStructure.basicSalary),
          allowances: new Prisma.Decimal(data.salaryStructure.allowances || 0),
          overtimeRate: new Prisma.Decimal(data.salaryStructure.overtimeRate || 0),
        },
      });
    }

    return tx.employee.findUnique({
      where: { id },
      include: { salaryStructure: true },
    });
  });

  await logAudit({
    franchiseId: existing.franchiseId,
    userId: currentUserId,
    action: "UPDATE_EMPLOYEE",
    entity: "Employee",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function setEmployeeStatus(
  id: string,
  status: EmployeeStatus,
  targetFranchiseId: string | null,
  currentUserId?: string
) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Employee not found", 404);
  }

  if (targetFranchiseId && existing.franchiseId !== targetFranchiseId) {
    throw new AppError("Access denied", 403);
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: { status },
    include: { salaryStructure: true },
  });

  await logAudit({
    franchiseId: existing.franchiseId,
    userId: currentUserId,
    action: "UPDATE_EMPLOYEE_STATUS",
    entity: "Employee",
    entityId: id,
    oldData: { status: existing.status },
    newData: { status },
  });

  return updated;
}
