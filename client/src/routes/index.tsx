import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout.js";
import { ProtectedRoute, getDefaultRoleHome } from "../components/layout/ProtectedRoute.js";
import { useAuthStore } from "../store/authStore.js";

// Pages
import { LoginPage } from "../pages/auth/LoginPage.js";
import { DashboardPage } from "../pages/dashboard/DashboardPage.js";
import { FranchisesPage } from "../pages/franchise/FranchisesPage.js";
import { UsersPage } from "../pages/users/UsersPage.js";
import { EmployeesPage } from "../pages/employees/EmployeesPage.js";
import { AttendancePage } from "../pages/attendance/AttendancePage.js";
import { LeavePage } from "../pages/leave/LeavePage.js";
import { PayrollPage } from "../pages/payroll/PayrollPage.js";
import { MenuPage } from "../pages/menu/MenuPage.js";
import { TablesPage } from "../pages/tables/TablesPage.js";
import { POSPage } from "../pages/pos/POSPage.js";
import { OrdersPage } from "../pages/orders/OrdersPage.js";
import { KitchenPage } from "../pages/kitchen/KitchenPage.js";
import { BillingPage } from "../pages/billing/BillingPage.js";
import { PrintersPage } from "../pages/printers/PrintersPage.js";
import { ReportsPage } from "../pages/reports/ReportsPage.js";
import { AuditLogsPage } from "../pages/audit/AuditLogsPage.js";

function RootRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDefaultRoleHome(user.role)} replace />;
}

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Protected Routes enclosed in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pos"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "CASHIER", "WAITER"]}>
              <POSPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tables"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF"]}>
              <TablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF", "ACCOUNTANT"]}>
              <OrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "CHEF"]}>
              <KitchenPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"]}>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/menu"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"]}>
              <MenuPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/franchises"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <FranchisesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "HR", "ACCOUNTANT"]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "HR"]}>
              <AttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "HR"]}>
              <LeavePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll"
          element={
            <ProtectedRoute allowedRoles={["FRANCHISE_MANAGER", "HR", "ACCOUNTANT"]}>
              <PayrollPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/printers"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER"]}>
              <PrintersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "FRANCHISE_MANAGER"]}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};
