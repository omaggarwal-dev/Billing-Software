import { Router } from "express";
import type { Response, NextFunction } from "express";
import { authenticate, authorize, type AuthenticatedRequest, getFranchiseId } from "../../middleware/auth.js";
import prisma from "../../lib/prisma.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPER_ADMIN", "FRANCHISE_MANAGER"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const franchiseId = getFranchiseId(req);
    const entity = req.query.entity as string | undefined;
    const action = req.query.action as string | undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        franchiseId: req.user?.role === "SUPER_ADMIN" ? (franchiseId || undefined) : franchiseId!,
        entity: entity || undefined,
        action: action ? { contains: action, mode: "insensitive" } : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        franchise: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

export default router;
