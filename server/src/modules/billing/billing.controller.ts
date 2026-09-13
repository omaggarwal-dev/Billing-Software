import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  createInvoiceForOrder,
  createInvoiceSchema,
  getInvoiceById,
  listInvoices,
} from "./billing.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const invoices = await listInvoices(franchiseId, filters);
    return res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const invoice = await getInvoiceById(id, franchiseId);
    return res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = createInvoiceSchema.parse(req.body);
    const invoice = await createInvoiceForOrder(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}
