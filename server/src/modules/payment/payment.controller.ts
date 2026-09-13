import type { Response, NextFunction } from "express";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  listPayments,
  processPayment,
  processSplitPayment,
  recordPaymentSchema,
  refundPayment,
  splitPaymentSchema,
} from "./payment.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      method: req.query.method as PaymentMethod | undefined,
      status: req.query.status as PaymentStatus | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const payments = await listPayments(franchiseId, filters);
    return res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);

    // Check if it's a split payment payload
    if (Array.isArray(req.body.splits)) {
      const validated = splitPaymentSchema.parse(req.body);
      const payments = await processSplitPayment(validated, franchiseId, req.user?.userId);
      return res.status(201).json({ success: true, data: payments });
    }

    const validated = recordPaymentSchema.parse(req.body);
    const payment = await processPayment(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

export async function refund(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const result = await refundPayment(id, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
