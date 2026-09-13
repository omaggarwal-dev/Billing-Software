import type { Response, NextFunction } from "express";
import { KOTStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  generateKOTSchema,
  generateKOTsForOrder,
  getKOTById,
  listKOTs,
  updateKOTStatus,
  updateKOTStatusSchema,
} from "./kot.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      status: req.query.status as KOTStatus | undefined,
      stationId: req.query.stationId as string | undefined,
      orderId: req.query.orderId as string | undefined,
    };
    const kots = await listKOTs(franchiseId, filters);
    return res.json({ success: true, data: kots });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const kot = await getKOTById(id, franchiseId);
    return res.json({ success: true, data: kot });
  } catch (error) {
    next(error);
  }
}

export async function generate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const { orderId, itemIds } = generateKOTSchema.parse(req.body);
    const kots = await generateKOTsForOrder(orderId, franchiseId, itemIds, req.user?.userId);
    return res.status(201).json({ success: true, data: kots });
  } catch (error) {
    next(error);
  }
}

export async function setStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const { status } = updateKOTStatusSchema.parse(req.body);
    const kot = await updateKOTStatus(id, status, franchiseId, req.user?.userId);
    return res.json({ success: true, data: kot });
  } catch (error) {
    next(error);
  }
}
