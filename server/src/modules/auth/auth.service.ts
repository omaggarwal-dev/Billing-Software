import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

function getJwtSecret() {
  return process.env.JWT_SECRET ?? "development-secret";
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim(),
    },
    include: {
      franchise: true,
    },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Your account has been deactivated. Please contact your administrator.", 403);
  }

  if (user.franchise && !user.franchise.isActive && user.role !== "SUPER_ADMIN") {
    throw new AppError("Your franchise is currently inactive. Please contact the administrator.", 403);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      franchiseId: user.franchiseId,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );

  await logAudit({
    franchiseId: user.franchiseId,
    userId: user.id,
    action: "USER_LOGIN",
    entity: "User",
    entityId: user.id,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      franchiseId: user.franchiseId,
      franchise: user.franchise
        ? {
            id: user.franchise.id,
            name: user.franchise.name,
            code: user.franchise.code,
            isActive: user.franchise.isActive,
          }
        : null,
    },
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      franchise: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    franchiseId: user.franchiseId,
    franchise: user.franchise
      ? {
          id: user.franchise.id,
          name: user.franchise.name,
          code: user.franchise.code,
          isActive: user.franchise.isActive,
        }
      : null,
  };
}