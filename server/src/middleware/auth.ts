import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret() {
  return process.env.JWT_SECRET ?? "development-secret";
}

export interface AuthenticatedUser {
  userId: string;
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

    req.user = decoded as AuthenticatedUser;
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

/**
 * Resolves the effective franchiseId for the request:
 * - If user is SUPER_ADMIN, allows query/body/header franchiseId override, or null if omitted (to view all).
 * - For all other roles, ALWAYS uses the authenticated user's franchiseId.
 */
export function getFranchiseId(req: AuthenticatedRequest, explicitFranchiseId?: string | null): string | null {
  if (req.user?.role === "SUPER_ADMIN") {
    if (explicitFranchiseId) return explicitFranchiseId;
    const fromQuery = req.query.franchiseId as string | undefined;
    const fromBody = req.body?.franchiseId as string | undefined;
    const fromHeader = req.headers["x-franchise-id"] as string | undefined;
    return fromQuery || fromBody || fromHeader || null;
  }
  return req.user?.franchiseId ?? null;
}

/**
 * Enforces that a franchiseId is present and resolved.
 */
export function requireFranchise(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const franchiseId = getFranchiseId(req);
  if (!franchiseId) {
    return res.status(400).json({
      success: false,
      message: "A franchise ID is required for this operation",
    });
  }
  next();
}