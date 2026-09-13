import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  statusCode: number;
  errors?: unknown;

  constructor(message: string, statusCode = 400, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta?.target.join(", ") : "Resource";
      return res.status(409).json({
        success: false,
        message: `${target} already exists`,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Foreign key constraint failed",
      });
    }
  }

  if (err instanceof Error) {
    console.error("Unhandled Error:", err.message, err.stack);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }

  console.error("Unknown Error:", err);
  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred",
  });
}
