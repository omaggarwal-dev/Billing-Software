import { Response } from "express";
import { AuthenticatedRequest, getFranchiseId } from "../../middleware/auth.js";
import {
  listAdvances,
  createAdvance,
  getUnsettledAdvancesTotal,
  createAdvanceSchema,
} from "./advance.service.js";

export async function listAdvancesHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const advances = await listAdvances(franchiseId, {
    employeeId: req.query.employeeId as string,
    status: req.query.status as any,
  });
  res.json({ success: true, data: advances });
}

export async function createAdvanceHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = createAdvanceSchema.parse(req.body);
  const advance = await createAdvance(parsed, franchiseId, req.user?.userId || req.user?.id);
  res.status(201).json({ success: true, data: advance });
}

export async function getUnsettledHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const total = await getUnsettledAdvancesTotal(req.params.employeeId as string, franchiseId);
  res.json({ success: true, data: { totalUnsettled: total } });
}