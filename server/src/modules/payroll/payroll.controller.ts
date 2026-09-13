import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  finalizePayroll,
  generateMonthlyPayroll,
  generatePayrollSchema,
  getPayrollById,
  listPayrolls,
  markPayrollAsPaid,
} from "./payroll.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const payrolls = await listPayrolls(franchiseId);
    return res.json({ success: true, data: payrolls });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const payroll = await getPayrollById(id, franchiseId);
    return res.json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
}

export async function generate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required to generate payroll", 400);
    }
    const validated = generatePayrollSchema.parse(req.body);
    const payroll = await generateMonthlyPayroll(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
}

export async function finalize(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const payroll = await finalizePayroll(id, franchiseId, req.user?.userId);
    return res.json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
}

export async function pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const payroll = await markPayrollAsPaid(id, franchiseId, req.user?.userId);
    return res.json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
}
