import { Response } from "express";
import { AuthenticatedRequest, getFranchiseId } from "../../middleware/auth.js";
import {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  recordStockIn,
  adjustStock,
  listInventoryTransactions,
  getInventoryStats,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  stockInSchema,
  adjustStockSchema,
} from "./inventory.service.js";

export async function getInventoryItemsHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const items = await listInventoryItems(franchiseId, {
    category: req.query.category as string,
    search: req.query.search as string,
    status: req.query.status as any,
  });
  res.json({ success: true, data: items });
}

export async function createInventoryItemHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = createInventoryItemSchema.parse(req.body);
  const item = await createInventoryItem(parsed, franchiseId, req.user?.userId || req.user?.id);
  res.status(201).json({ success: true, data: item });
}

export async function updateInventoryItemHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = updateInventoryItemSchema.parse(req.body);
  const item = await updateInventoryItem(req.params.id as string, parsed, franchiseId, req.user?.userId || req.user?.id);
  res.json({ success: true, data: item });
}

export async function stockInHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = stockInSchema.parse(req.body);
  const purchase = await recordStockIn(parsed, franchiseId, req.user?.userId || req.user?.id);
  res.status(201).json({ success: true, data: purchase });
}

export async function adjustStockHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req)!;
  const parsed = adjustStockSchema.parse(req.body);
  const tx = await adjustStock(parsed, franchiseId, req.user?.userId || req.user?.id);
  res.json({ success: true, data: tx });
}

export async function getTransactionsHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const txs = await listInventoryTransactions(franchiseId, {
    inventoryItemId: req.query.inventoryItemId as string,
    type: req.query.type as any,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ success: true, data: txs });
}

export async function getStatsHandler(req: AuthenticatedRequest, res: Response) {
  const franchiseId = getFranchiseId(req);
  const stats = await getInventoryStats(franchiseId);
  res.json({ success: true, data: stats });
}