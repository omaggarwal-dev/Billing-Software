import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  getAttendanceReport,
  getDashboardStats,
  getGlobalFranchiseReport,
  getMenuReport,
  getPaymentsReport,
  getPayrollReport,
  getSalesReport,
} from "./report.service.js";

export async function sales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      period: req.query.period as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const report = await getSalesReport(franchiseId, filters);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function payments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      period: req.query.period as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const report = await getPaymentsReport(franchiseId, filters);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function menu(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      period: req.query.period as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const report = await getMenuReport(franchiseId, filters);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function attendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const report = await getAttendanceReport(franchiseId, month, year);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function payroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const report = await getPayrollReport(franchiseId, year);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function global(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const filters = {
      period: req.query.period as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const report = await getGlobalFranchiseReport(filters);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";
    const franchiseId = getFranchiseId(req);
    const stats = await getDashboardStats(franchiseId, isSuperAdmin);
    return res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}
