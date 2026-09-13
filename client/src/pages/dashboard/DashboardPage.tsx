import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  DollarSign,
  ShoppingCart,
  Users,
  Grid3X3,
  ChefHat,
  Banknote,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Card } from "../../components/common/Card.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { Button } from "../../components/common/Button.js";

export const DashboardPage: React.FC = () => {
  const { user, selectedFranchiseId } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN" && !selectedFranchiseId;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/reports/dashboard");
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const { data: globalReport } = useQuery({
    queryKey: ["global-report"],
    queryFn: async () => {
      const res = await api.get("/reports/global");
      return res.data.data;
    },
    enabled: isSuperAdmin,
  });

  if (isLoading) {
    return <LoadingState message="Loading live operational metrics..." />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-950/50">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Welcome back, {user?.name} 👋
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            {isSuperAdmin
              ? "Centralized Global Franchise Overview & Business Health"
              : `Operational Control Dashboard for ${user?.franchise?.name || "Your Franchise"}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isSuperAdmin && (
            <Link to="/pos">
              <Button variant="primary" size="md" icon={<ShoppingCart className="w-4 h-4" />}>
                Open POS Terminal
              </Button>
            </Link>
          )}
          <Link to="/reports">
            <Button variant="secondary" size="md" icon={<TrendingUp className="w-4 h-4" />}>
              View Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Franchises"
            value={stats?.totalFranchises || 0}
            subtitle={`${stats?.activeFranchises || 0} Active Units`}
            icon={<Building2 className="w-6 h-6" />}
            color="indigo"
          />
          <StatCard
            title="Today's Revenue"
            value={`₹${(stats?.todayRevenue || 0).toLocaleString("en-IN")}`}
            subtitle={`${stats?.todayOrdersCount || 0} Orders Today`}
            icon={<DollarSign className="w-6 h-6" />}
            color="emerald"
          />
          <StatCard
            title="Monthly Revenue"
            value={`₹${(stats?.monthlyRevenue || 0).toLocaleString("en-IN")}`}
            subtitle={`${stats?.monthlyOrdersCount || 0} Monthly Orders`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="cyan"
          />
          <StatCard
            title="Total Staff"
            value={stats?.totalEmployees || 0}
            subtitle={`${stats?.pendingPayrollCount || 0} Draft Payrolls`}
            icon={<Users className="w-6 h-6" />}
            color="purple"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Today's Revenue"
            value={`₹${(stats?.todayRevenue || 0).toLocaleString("en-IN")}`}
            subtitle={`${stats?.todayOrdersCount || 0} Orders Placed`}
            icon={<DollarSign className="w-6 h-6" />}
            color="emerald"
          />
          <StatCard
            title="Active Tables"
            value={`${stats?.occupiedTables || 0} / ${stats?.totalTables || 0}`}
            subtitle={`${stats?.availableTables || 0} Tables Available`}
            icon={<Grid3X3 className="w-6 h-6" />}
            color="indigo"
          />
          <StatCard
            title="Kitchen Tickets"
            value={stats?.activeKOTsCount || 0}
            subtitle="Tickets in Preparation"
            icon={<ChefHat className="w-6 h-6" />}
            color="amber"
          />
          <StatCard
            title="Staff on Shift"
            value={`${stats?.presentStaffCount || 0} / ${stats?.totalEmployees || 0}`}
            subtitle="Present Today"
            icon={<Users className="w-6 h-6" />}
            color="purple"
          />
        </div>
      )}

      {/* Global Franchises Performance Table (Super Admin only) */}
      {isSuperAdmin && globalReport && (
        <Card
          title="Franchise Performance Overview"
          subtitle="Real-time performance ranking across all operational franchises"
          action={
            <Link to="/franchises">
              <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                Manage All Franchises
              </Button>
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                <tr>
                  <th className="px-6 py-3">Franchise</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Orders</th>
                  <th className="px-6 py-3">Revenue</th>
                  <th className="px-6 py-3">Avg Order Value</th>
                  <th className="px-6 py-3">Employees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {globalReport.franchises?.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{f.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{f.code}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          f.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {f.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{f.ordersCount}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">
                      ₹{f.revenue.toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      ₹{Math.round(f.averageOrderValue).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{f.employeesCount} Staff</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick Access Grid for Franchise Operations */}
      {!isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Fast Operations"
            subtitle="Quick jump to key operational screens"
          >
            <div className="grid grid-cols-2 gap-3">
              <Link to="/pos">
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 font-semibold text-sm flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                  <ShoppingCart className="w-6 h-6 mb-2" />
                  <span>POS Billing</span>
                </div>
              </Link>
              <Link to="/kitchen">
                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-amber-700 font-semibold text-sm flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                  <ChefHat className="w-6 h-6 mb-2" />
                  <span>Kitchen Display</span>
                </div>
              </Link>
              <Link to="/tables">
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-semibold text-sm flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                  <Grid3X3 className="w-6 h-6 mb-2" />
                  <span>Floor Tables</span>
                </div>
              </Link>
              <Link to="/payroll">
                <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50 hover:bg-purple-50 text-purple-700 font-semibold text-sm flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                  <Banknote className="w-6 h-6 mb-2" />
                  <span>Payroll</span>
                </div>
              </Link>
            </div>
          </Card>

          <Card
            title="Shift & Attendance"
            subtitle="Daily staff check-ins and workforce status"
            className="md:col-span-2"
            action={
              <Link to="/attendance">
                <Button variant="outline" size="sm">
                  Attendance Sheet
                </Button>
              </Link>
            }
          >
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {stats?.presentStaffCount || 0} Employees Checked In Today
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ensure all floor staff, chefs and cashiers record daily check-in
                </p>
              </div>
              <Link to="/attendance">
                <Button variant="primary" size="sm">
                  Mark Attendance
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
