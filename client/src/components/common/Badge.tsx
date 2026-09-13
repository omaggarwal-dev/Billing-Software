import React from "react";

export type BadgeVariant =
  | "gray"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "cyan";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "gray",
  size = "sm",
  dot = false,
}) => {
  const variantStyles = {
    gray: "bg-gray-100 text-gray-800 border-gray-200",
    primary: "bg-indigo-50 text-indigo-700 border-indigo-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };

  const dotColors = {
    gray: "bg-gray-400",
    primary: "bg-indigo-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "AVAILABLE":
    case "COMPLETED":
    case "PAID":
    case "READY":
    case "SERVED":
    case "APPROVED":
    case "PRESENT":
      return "success";

    case "OPEN":
    case "OCCUPIED":
    case "PREPARING":
    case "ACCEPTED":
    case "DRAFT":
    case "HALF_DAY":
      return "primary";

    case "PENDING":
    case "BILLING":
    case "PRINTED":
    case "RESERVED":
    case "ON_LEAVE":
      return "warning";

    case "INACTIVE":
    case "CANCELLED":
    case "OUT_OF_SERVICE":
    case "FAILED":
    case "REFUNDED":
    case "REJECTED":
    case "TERMINATED":
    case "ABSENT":
      return "danger";

    default:
      return "gray";
  }
}
