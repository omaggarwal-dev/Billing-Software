import type { Response, NextFunction } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getFranchiseId } from "../../middleware/auth.js";
import {
  categorySchema,
  createCategory,
  createMenuItem,
  createStation,
  deleteCategory,
  getMenuItemById,
  listCategories,
  listMenuItems,
  listStations,
  menuItemSchema,
  setMenuItemAvailability,
  updateCategory,
  updateMenuItem,
  updateMenuItemSchema,
} from "./menu.service.js";
import { AppError } from "../../middleware/error.js";

// Categories
export async function getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const categories = await listCategories(franchiseId);
    return res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function addCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = categorySchema.parse(req.body);
    const result = await createCategory(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function editCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = categorySchema.partial().parse(req.body);
    const result = await updateCategory(id, validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function removeCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const result = await deleteCategory(id, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// Menu Items
export async function getItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const filters = {
      categoryId: req.query.categoryId as string | undefined,
      stationId: req.query.stationId as string | undefined,
      isAvailable: req.query.isAvailable ? req.query.isAvailable === "true" : undefined,
    };
    const items = await listMenuItems(franchiseId, filters);
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    const item = await getMenuItemById(id, franchiseId);
    return res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function addItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = menuItemSchema.parse(req.body);
    const result = await createMenuItem(validated, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function editItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const validated = updateMenuItemSchema.parse(req.body);
    const result = await updateMenuItem(id, validated, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function toggleAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
    const result = await setMenuItemAvailability(id, isAvailable, franchiseId, req.user?.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// Stations
export async function getStations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    const stations = await listStations(franchiseId);
    return res.json({ success: true, data: stations });
  } catch (error) {
    next(error);
  }
}

export async function addStation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) throw new AppError("Franchise ID is required", 400);
    const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body);
    const result = await createStation(name, franchiseId, req.user?.userId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
