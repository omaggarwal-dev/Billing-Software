import { Response } from "express";
import { AuthenticatedRequest, getFranchiseId } from "../../middleware/auth.js";
import {
  listExpenseCategories,
  createExpenseCategory,
  listExpenses,
  createExpense,
  reviewExpense,
  getExpenseStats,
  createExpenseCategorySchema,
  createExpenseSchema,
} from "./expense.service.js";
import { ExpenseStatus } from "@prisma/client";

export async function getCategoriesHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const categories = await listExpenseCategories(franchiseId);
  res.json({ success: true, data: categories });
}

export async function createCategoryHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = createExpenseCategorySchema.parse(req.body);
  const cat = await createExpenseCategory(parsed, franchiseId);
  res.status(201).json({ success: true, data: cat });
}

export async function listExpensesHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const expenses = await listExpenses(franchiseId, {
    categoryId: req.query.categoryId as string,
    status: req.query.status as any,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
  });
  res.json({ success: true, data: expenses });
}

export async function createExpenseHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = createExpenseSchema.parse(req.body);
  const expense = await createExpense(parsed, franchiseId, req.user?.userId || req.user?.id, req.user?.role);
  res.status(201).json({ success: true, data: expense });
}

export async function reviewExpenseHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const { status, notes } = req.body;
  const expense = await reviewExpense(req.params.id as string, status as ExpenseStatus, franchiseId, req.user?.userId || req.user?.id, notes);
  res.json({ success: true, data: expense });
}

export async function getExpenseStatsHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const stats = await getExpenseStats(franchiseId);
  res.json({ success: true, data: stats });
}