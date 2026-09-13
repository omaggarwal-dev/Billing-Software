import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import {
  cancel,
  confirm,
  create,
  get,
  list,
  serve,
  update,
  kotDecision,
} from "./order.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.CHEF,
    UserRole.WAITER,
    UserRole.ACCOUNTANT
  ),
  list
);

router.get(
  "/:id",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.CHEF,
    UserRole.WAITER,
    UserRole.ACCOUNTANT
  ),
  get
);

router.post(
  "/",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.WAITER
  ),
  create
);

router.put(
  "/:id",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.WAITER
  ),
  update
);

router.patch(
  "/:id/confirm",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.WAITER
  ),
  confirm
);

router.patch(
  "/:id/cancel",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER
  ),
  cancel
);

router.patch(
  "/:id/serve",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CHEF,
    UserRole.WAITER,
    UserRole.CASHIER
  ),
  serve
);

router.patch(
  "/:id/kot-decision",
  authorizeRole(
    UserRole.SUPER_ADMIN,
    UserRole.FRANCHISE_MANAGER,
    UserRole.CASHIER,
    UserRole.WAITER
  ),
  kotDecision
);

export default router;