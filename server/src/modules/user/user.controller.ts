import type { Response, NextFunction } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  createUser,
  createUserSchema,
  getUserById,
  listUsers,
  setUserStatus,
  updateUser,
  updateUserSchema,
} from "./user.service.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const targetFranchiseId = req.query.franchiseId as string | undefined;
    const users = await listUsers(req.user?.role, req.user?.franchiseId, targetFranchiseId);
    return res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const user = await getUserById(id, req.user?.role, req.user?.franchiseId);
    return res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const validated = createUserSchema.parse(req.body);
    const user = await createUser(validated, req.user?.role, req.user?.franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const validated = updateUserSchema.parse(req.body);
    const user = await updateUser(id, validated, req.user?.role, req.user?.franchiseId, req.user?.userId);
    return res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const user = await setUserStatus(id, isActive, req.user?.role, req.user?.franchiseId, req.user?.userId);
    return res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}