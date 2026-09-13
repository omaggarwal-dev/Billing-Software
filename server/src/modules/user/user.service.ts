import bcrypt from "bcryptjs";
import { UserRole, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { logAudit } from "../../lib/audit.js";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email format").transform((val) => val.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(UserRole),
  franchiseId: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().transform((val) => val.toLowerCase()).optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  franchiseId: z.string().nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  franchiseId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  franchise: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function listUsers(requestingUserRole?: string, requestingUserFranchiseId?: string | null, targetFranchiseId?: string | null) {
  let whereClause: Prisma.UserWhereInput | undefined;

  if (requestingUserRole === "SUPER_ADMIN") {
    if (targetFranchiseId) {
      whereClause = { franchiseId: targetFranchiseId };
    }
  } else {
    if (!requestingUserFranchiseId) {
      return [];
    }
    whereClause = { franchiseId: requestingUserFranchiseId };
  }

  return prisma.user.findMany({
    where: whereClause,
    select: publicUserSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserById(id: string, requestingUserRole?: string, requestingUserFranchiseId?: string | null) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (requestingUserRole !== "SUPER_ADMIN" && user.franchiseId !== requestingUserFranchiseId) {
    throw new AppError("Access denied", 403);
  }

  return user;
}

export async function createUser(
  data: CreateUserInput,
  requestingUserRole?: string,
  requestingUserFranchiseId?: string | null,
  currentUserId?: string
) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError("A user with this email already exists", 409);
  }

  let finalFranchiseId = data.franchiseId;

  if (requestingUserRole !== "SUPER_ADMIN") {
    if (data.role === UserRole.SUPER_ADMIN || data.role === UserRole.FRANCHISE_MANAGER) {
      throw new AppError("You do not have permission to create this role", 403);
    }
    finalFranchiseId = requestingUserFranchiseId;
  }

  if (data.role !== UserRole.SUPER_ADMIN && !finalFranchiseId) {
    throw new AppError("Franchise ID is required for non-super admin users", 400);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      franchiseId: data.role === UserRole.SUPER_ADMIN ? null : finalFranchiseId,
    },
    select: publicUserSelect,
  });

  await logAudit({
    franchiseId: finalFranchiseId,
    userId: currentUserId,
    action: "CREATE_USER",
    entity: "User",
    entityId: newUser.id,
    newData: { id: newUser.id, email: newUser.email, role: newUser.role },
  });

  return newUser;
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  requestingUserRole?: string,
  requestingUserFranchiseId?: string | null,
  currentUserId?: string
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User not found", 404);
  }

  if (requestingUserRole !== "SUPER_ADMIN" && existing.franchiseId !== requestingUserFranchiseId) {
    throw new AppError("Access denied", 403);
  }

  if (data.email && data.email !== existing.email) {
    const emailConflict = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailConflict) {
      throw new AppError("A user with this email already exists", 409);
    }
  }

  let passwordHash = undefined;
  if (data.password) {
    passwordHash = await bcrypt.hash(data.password, 12);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: requestingUserRole === "SUPER_ADMIN" ? data.role : undefined,
      franchiseId: requestingUserRole === "SUPER_ADMIN" ? data.franchiseId : undefined,
    },
    select: publicUserSelect,
  });

  await logAudit({
    franchiseId: existing.franchiseId,
    userId: currentUserId,
    action: "UPDATE_USER",
    entity: "User",
    entityId: id,
    newData: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
  });

  return updatedUser;
}

export async function setUserStatus(
  id: string,
  isActive: boolean,
  requestingUserRole?: string,
  requestingUserFranchiseId?: string | null,
  currentUserId?: string
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User not found", 404);
  }

  if (requestingUserRole !== "SUPER_ADMIN" && existing.franchiseId !== requestingUserFranchiseId) {
    throw new AppError("Access denied", 403);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: publicUserSelect,
  });

  await logAudit({
    franchiseId: existing.franchiseId,
    userId: currentUserId,
    action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    entity: "User",
    entityId: id,
    newData: { isActive },
  });

  return updatedUser;
}