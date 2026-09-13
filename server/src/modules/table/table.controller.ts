import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  closeTableSession,
  createTable,
  getTableById,
  listTables,
  openTableSession,
  openSessionSchema,
  tableSchema,
  updateTable,
  updateTableSchema,
} from "./table.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const tables = await listTables(franchiseId);
    return res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const table = await getTableById(id, franchiseId);
    return res.json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = tableSchema.parse(req.body);
    const table = await createTable(validated, franchiseId, req.user?.id || req.user?.userId);
    return res.status(201).json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = updateTableSchema.parse(req.body);
    const table = await updateTable(id, validated, franchiseId, req.user?.id || req.user?.userId);
    return res.json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
}

export async function openSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const parsed = openSessionSchema.safeParse(req.body);
    const options = parsed.success ? parsed.data : { guestCount: req.body.guestCount || 1, partyName: req.body.partyName };
    const session = await openTableSession(id, franchiseId, options, req.user?.id || req.user?.userId);
    return res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

export async function closeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const sessionId = (req.body.sessionId || req.query.sessionId) as string | undefined;
    const result = await closeTableSession(id, franchiseId, sessionId, req.user?.id || req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}