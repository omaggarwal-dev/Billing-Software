import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  checkInSchema,
  checkOutSchema,
  employeeCheckIn,
  employeeCheckOut,
  listAttendance,
  recordAttendance,
  recordAttendanceSchema,
} from "./attendance.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      month: req.query.month ? parseInt(req.query.month as string, 10) : undefined,
      year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
    };
    const records = await listAttendance(franchiseId, filters);
    return res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

export async function record(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const validated = recordAttendanceSchema.parse(req.body);
    const result = await recordAttendance(validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function checkIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const { employeeId, notes } = checkInSchema.parse(req.body);
    const result = await employeeCheckIn(employeeId, franchiseId, notes);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const { employeeId, notes } = checkOutSchema.parse(req.body);
    const result = await employeeCheckOut(employeeId, franchiseId, notes);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
