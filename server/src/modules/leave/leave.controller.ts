import type { Response, NextFunction } from "express";
import { LeaveStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  approveLeaveRequest,
  createLeaveRequest,
  createLeaveSchema,
  listLeaveRequests,
  rejectLeaveRequest,
} from "./leave.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as LeaveStatus | undefined,
    };
    const leaves = await listLeaveRequests(franchiseId, filters);
    return res.json({ success: true, data: leaves });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const validated = createLeaveSchema.parse(req.body);
    const leave = await createLeaveRequest(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
}

export async function approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const approverName = req.user?.role || "Manager";
    const leave = await approveLeaveRequest(id, franchiseId, approverName, req.user?.userId);
    return res.json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
}

export async function reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required", 400);
    }
    const rejectorName = req.user?.role || "Manager";
    const leave = await rejectLeaveRequest(id, franchiseId, rejectorName, req.user?.userId);
    return res.json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
}
