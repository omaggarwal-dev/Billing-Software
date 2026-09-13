import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  createPrinter,
  deletePrinter,
  generatePrintPayload,
  listPrinters,
  printerSchema,
  updatePrinter,
  updatePrinterSchema,
} from "./printer.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const printers = await listPrinters(franchiseId);
    return res.json({ success: true, data: printers });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = printerSchema.parse(req.body);
    const printer = await createPrinter(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: printer });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = updatePrinterSchema.parse(req.body);
    const printer = await updatePrinter(id, validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: printer });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const result = await deletePrinter(id, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function printJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const { type, targetId } = req.body as { type: "KOT" | "RECEIPT"; targetId: string };
    if (!type || !targetId) throw new AppError("Type (KOT/RECEIPT) and targetId are required", 400);
    const payload = await generatePrintPayload(type, targetId, franchiseId);
    return res.json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
}
