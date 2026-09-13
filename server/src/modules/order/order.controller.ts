import type { Response, NextFunction } from "express";
import { OrderStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  createOrder,
  createOrderSchema,
  getOrderById,
  listOrders,
  setOrderStatus,
  updateOrder,
  updateOrderSchema,
} from "./order.service.js";
import { AppError } from "../../middleware/error.js";

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      status: req.query.status as OrderStatus | undefined,
      tableId: req.query.tableId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const orders = await listOrders(franchiseId, filters);
    return res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const order = await getOrderById(id, franchiseId);
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = createOrderSchema.parse(req.body);
    const order = await createOrder(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = updateOrderSchema.parse(req.body);
    const order = await updateOrder(id, validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function confirm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const order = await setOrderStatus(id, OrderStatus.CONFIRMED, franchiseId, req.user?.userId);
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const order = await setOrderStatus(id, OrderStatus.CANCELLED, franchiseId, req.user?.userId);
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function serve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const order = await setOrderStatus(id, OrderStatus.SERVED, franchiseId, req.user?.userId);
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}
