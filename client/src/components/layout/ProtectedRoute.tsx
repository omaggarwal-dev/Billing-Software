import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";
import type { UserRole } from "../../types/index.js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function getDefaultRoleHome(role?: string): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "FRANCHISE_MANAGER":
      return "/dashboard";
    case "CASHIER":
      return "/pos";
    case "CHEF":
      return "/kitchen";
    case "WAITER":
      return "/tables";
    case "HR":
      return "/employees";
    case "ACCOUNTANT":
      return "/billing";
    default:
      return "/login";
  }
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const roleHome = getDefaultRoleHome(user.role);
    return <Navigate to={roleHome} replace />;
  }

  return <>{children}</>;
};
