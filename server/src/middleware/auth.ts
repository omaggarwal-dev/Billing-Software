import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret() {
  return process.env.JWT_SECRET ?? "development-secret";
}

export interface AuthenticatedUser {
  userId: string;
  id?: string;
  role: string;
  franchiseId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded !== "object" || !decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    const payload = decoded as any;
    req.user = {
      userId: payload.userId || payload.id,
      id: payload.userId || payload.id,
      role: payload.role,
      franchiseId: payload.franchiseId,
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
}

export const authorizeRole = authorize;

export function getFranchiseId(req: AuthenticatedRequest): string | null {
  if (req.user?.role === "SUPER_ADMIN") {
    const headerFranchise = req.headers["x-franchise-id"];
    if (typeof headerFranchise === "string") return headerFranchise;
    return req.user.franchiseId ?? null;
  }
  return req.user?.franchiseId ?? null;
}