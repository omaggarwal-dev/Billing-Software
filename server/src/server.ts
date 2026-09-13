import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes.js";
import franchiseRoutes from "./modules/franchise/franchise.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import employeeRoutes from "./modules/employee/employee.routes.js";
import attendanceRoutes from "./modules/attendance/attendance.routes.js";
import leaveRoutes from "./modules/leave/leave.routes.js";
import payrollRoutes from "./modules/payroll/payroll.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import tableRoutes from "./modules/table/table.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import kotRoutes from "./modules/kot/kot.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import printerRoutes from "./modules/printer/printer.routes.js";
import reportRoutes from "./modules/report/report.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";

import { initSocket } from "./lib/socket.js";
import { errorHandler } from "./middleware/error.js";
import prisma from "./lib/prisma.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost on any port, Vite dev server, or direct tools
      if (!origin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health & diagnostics
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Restaurant Management & POS API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/db-test", async (_req, res) => {
  try {
    const franchiseCount = await prisma.franchise.count();
    res.json({
      success: true,
      message: "Database connection successful",
      franchiseCount,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Register all API Modules
app.use("/api/auth", authRoutes);
app.use("/api/franchises", franchiseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/kot", kotRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/printers", printerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit-logs", auditRoutes);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Restaurant Management API running on http://localhost:${PORT}`);
});

export default app;