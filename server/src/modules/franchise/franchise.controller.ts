import type { Response, NextFunction } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  createFranchise,
  franchiseInputSchema,
  franchiseUpdateSchema,
  getFranchiseById,
  listFranchises,
  setFranchiseStatus,
  updateFranchise,
} from "./franchise.service.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchises = await listFranchises(req.user?.role, req.user?.franchiseId);
    return res.json({ success: true, data: franchises });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchise = await getFranchiseById(id, req.user?.role, req.user?.franchiseId);
    return res.json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const validated = franchiseInputSchema.parse(req.body);
    const franchise = await createFranchise(validated, req.user?.userId);
    return res.status(201).json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const validated = franchiseUpdateSchema.parse(req.body);
    const franchise = await updateFranchise(id, validated, req.user?.userId);
    return res.json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const franchise = await setFranchiseStatus(id, isActive, req.user?.userId);
    return res.json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
}