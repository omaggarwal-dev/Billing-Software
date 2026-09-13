import { ExpenseStatus, PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  description: z.string().trim().optional(),
});

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "OTHER"]).default("CASH"),
  receiptUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  expenseDate: z.string().optional(),
});

export async function listExpenseCategories(franchiseId: string | null) {
  if (!franchiseId) return [];

  // If no categories exist, auto-seed default categories
  const count = await prisma.expenseCategory.count({ where: { franchiseId } });
  if (count === 0) {
    const defaults = [
      { name: "Emergency Repairs", description: "Urgent kitchen & restaurant maintenance" },
      { name: "Cleaning & Hygiene", description: "Sanitation, cleaning chemicals, supplies" },
      { name: "Packaging & Disposables", description: "Containers, napkins, bags" },
      { name: "Transportation & Fuel", description: "Deliveries, gas, transit" },
      { name: "Utilities", description: "Gas cylinder, electricity, water" },
      { name: "Miscellaneous", description: "General unforeseen day-to-day expenses" },
    ];
    for (const cat of defaults) {
      await prisma.expenseCategory.create({
        data: { franchiseId, name: cat.name, description: cat.description },
      });
    }
  }

  return prisma.expenseCategory.findMany({
    where: { franchiseId },
    orderBy: { name: "asc" },
  });
}

export async function createExpenseCategory(
  data: z.infer<typeof createExpenseCategorySchema>,
  franchiseId: string
) {
  const existing = await prisma.expenseCategory.findFirst({
    where: { franchiseId, name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new AppError("Category already exists", 400);

  return prisma.expenseCategory.create({
    data: { franchiseId, name: data.name, description: data.description },
  });
}

export async function listExpenses(
  franchiseId: string | null,
  filters: { categoryId?: string; status?: ExpenseStatus; startDate?: string; endDate?: string }
) {
  if (!franchiseId) return [];

  return prisma.expense.findMany({
    where: {
      franchiseId,
      categoryId: filters.categoryId || undefined,
      status: filters.status || undefined,
      expenseDate: {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      },
    },
    include: { category: true },
    orderBy: { expenseDate: "desc" },
  });
}

export async function createExpense(
  data: z.infer<typeof createExpenseSchema>,
  franchiseId: string,
  userId?: string,
  userRole?: string
) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, franchiseId },
  });
  if (!category) throw new AppError("Expense category not found", 404);

  // Managers automatically approve, Cashiers submit as PENDING
  const isManager = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"].includes(userRole || "");
  const status: ExpenseStatus = isManager ? ExpenseStatus.APPROVED : ExpenseStatus.PENDING;

  const expense = await prisma.expense.create({
    data: {
      franchiseId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      amount: new Prisma.Decimal(data.amount.toFixed(2)),
      paymentMethod: data.paymentMethod as PaymentMethod,
      status,
      recordedBy: userId,
      approvedBy: isManager ? userId : undefined,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      receiptUrl: data.receiptUrl,
      notes: data.notes,
    },
    include: { category: true },
  });

  await logAudit({
    franchiseId,
    userId,
    action: "CREATE_EXPENSE",
    entity: "Expense",
    entityId: expense.id,
    newData: expense,
  });

  return expense;
}

export async function reviewExpense(
  id: string,
  status: ExpenseStatus,
  franchiseId: string,
  userId?: string,
  notes?: string
) {
  const existing = await prisma.expense.findFirst({ where: { id, franchiseId } });
  if (!existing) throw new AppError("Expense not found", 404);

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status,
      approvedBy: userId,
      notes: notes !== undefined ? notes : existing.notes,
    },
    include: { category: true },
  });

  await logAudit({
    franchiseId,
    userId,
    action: `REVIEW_EXPENSE_${status}`,
    entity: "Expense",
    entityId: id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}

export async function getExpenseStats(franchiseId: string | null) {
  if (!franchiseId) return { totalApproved: 0, pendingCount: 0, thisMonth: 0 };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const approved = await prisma.expense.aggregate({
    where: { franchiseId, status: ExpenseStatus.APPROVED },
    _sum: { amount: true },
    _count: true,
  });

  const pending = await prisma.expense.count({
    where: { franchiseId, status: ExpenseStatus.PENDING },
  });

  const monthApproved = await prisma.expense.aggregate({
    where: { franchiseId, status: ExpenseStatus.APPROVED, expenseDate: { gte: startOfMonth } },
    _sum: { amount: true },
  });

  return {
    totalApproved: Number(approved._sum.amount || 0),
    totalCount: approved._count,
    pendingCount: pending,
    thisMonthApproved: Number(monthApproved._sum.amount || 0),
  };
}