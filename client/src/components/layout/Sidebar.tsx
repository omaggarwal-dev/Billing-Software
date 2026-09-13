import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  Banknote,
  UtensilsCrossed,
  Grid3X3,
  ShoppingCart,
  Receipt,
  ChefHat,
  Printer,
  BarChart3,
  ShieldCheck,
  LogOut,
  Store,
  Package,
  BookOpen,
  WalletCards,
  HandCoins,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore.js";

interface NavItem {
  name: string;
  to: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER"],
  },
  {
    name: "POS Terminal",
    to: "/pos",
    icon: <ShoppingCart className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "WAITER"],
  },
  {
    name: "Tables",
    to: "/tables",
    icon: <Grid3X3 className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF"],
  },
  {
    name: "Orders",
    to: "/orders",
    icon: <Receipt className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "WAITER", "CHEF", "ACCOUNTANT"],
  },
  {
    name: "Kitchen Display",
    to: "/kitchen",
    icon: <ChefHat className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CHEF"],
  },
  {
    name: "Billing & Payments",
    to: "/billing",
    icon: <Receipt className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"],
  },
  {
    name: "Inventory & Stock",
    to: "/inventory",
    icon: <Package className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF", "ACCOUNTANT"],
  },
  {
    name: "Recipes & SOP",
    to: "/recipes",
    icon: <BookOpen className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"],
  },
  {
    name: "Menu & Categories",
    to: "/menu",
    icon: <UtensilsCrossed className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER", "CHEF"],
  },
  {
    name: "Unforeseen Expenses",
    to: "/expenses",
    icon: <WalletCards className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "ACCOUNTANT"],
  },
  {
    name: "Franchises",
    to: "/franchises",
    icon: <Building2 className="w-5 h-5" />,
    roles: ["SUPER_ADMIN"],
  },
  {
    name: "Users & Staff Access",
    to: "/users",
    icon: <Users className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER"],
  },
  {
    name: "Employees",
    to: "/employees",
    icon: <UserCheck className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "HR", "ACCOUNTANT"],
  },
  {
    name: "Attendance",
    to: "/attendance",
    icon: <CalendarCheck className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "HR"],
  },
  {
    name: "Leave Requests",
    to: "/leave",
    icon: <CalendarDays className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "HR"],
  },
  {
    name: "Employee Advances",
    to: "/advances",
    icon: <HandCoins className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "CASHIER", "HR", "ACCOUNTANT"],
  },
  {
    name: "Payroll",
    to: "/payroll",
    icon: <Banknote className="w-5 h-5" />,
    roles: ["FRANCHISE_MANAGER", "HR", "ACCOUNTANT"],
  },
  {
    name: "Printers",
    to: "/printers",
    icon: <Printer className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER"],
  },
  {
    name: "Reports & Analytics",
    to: "/reports",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"],
  },
  {
    name: "Audit Logs",
    to: "/audit-logs",
    icon: <ShieldCheck className="w-5 h-5" />,
    roles: ["SUPER_ADMIN", "FRANCHISE_MANAGER"],
  },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const currentRole = user?.role || "";

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(currentRole)
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">
            RestoMaster
          </h1>
          <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">
            Enterprise POS
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
        <div className="px-3 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Navigation
          </span>
        </div>
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              }`
            }
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between">
          <div className="overflow-hidden mr-2">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-indigo-400 truncate">
              {user?.role.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
