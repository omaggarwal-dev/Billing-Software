import type { Response, NextFunction } from "express";
import { z } from "zod";
import { EmployeeStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  createEmployee,
  createEmployeeSchema,
  getEmployeeById,
  listEmployees,
  setEmployeeStatus,
  updateEmployee,
  updateEmployeeSchema,
} from "./employee.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const employees = await listEmployees(franchiseId);
    return res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const employee = await getEmployeeById(id, franchiseId);
    return res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) {
      throw new AppError("Franchise ID is required to create employee", 400);
    }
    const validated = createEmployeeSchema.parse(req.body);
    const employee = await createEmployee(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const validated = updateEmployeeSchema.parse(req.body);
    const employee = await updateEmployee(id, validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const { status } = z.object({ status: z.nativeEnum(EmployeeStatus) }).parse(req.body);
    const employee = await setEmployeeStatus(id, status, franchiseId, req.user?.userId);
    return res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}
