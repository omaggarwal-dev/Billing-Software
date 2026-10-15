import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getBrandSettings, updateBrandSettings } from "./brand.service.js";

export async function getSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const settings = await getBrandSettings();
    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const updated = await updateBrandSettings(req.body);
    return res.json({
      success: true,
      data: updated,
      message: "Business profile and brand settings updated successfully",
    });
  } catch (error) {
    next(error);
  }
}
