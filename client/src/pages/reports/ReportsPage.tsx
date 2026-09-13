import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  CreditCard,
  UtensilsCrossed,
  UserCheck,
  Banknote,
} from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import { Card } from "../../components/common/Card.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Select } from "../../components/common/Select.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";

export const ReportsPage: React.FC = () => {
  const { selectedFranchiseId } = useAuthStore();

  const [period, setPeriod] = useState<string>("this_month");
  const [activeTab, setActiveTab] = useState<"sales" | "payments" | "menu" | "attendance" | "payroll">("sales");

  // Fetch Sales Report
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["report-sales", selectedFranchiseId, period],
    queryFn: async () => {
      const res = await api.get(`/reports/sales?period=${period}`);
      return res.data.data;
    },
    enabled: activeTab === "sales",
  });

  // Fetch Payment Methods Report
  const { data: paymentData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["report-payments", selectedFranchiseId, period],
    queryFn: async () => {
      const res = await api.get(`/reports/payments?period=${period}`);
      return res.data.data;
    },
    enabled: activeTab === "payments",
  });

  // Fetch Menu Report
  const { data: menuData, isLoading: isLoadingMenu } = useQuery({
    queryKey: ["report-menu", selectedFranchiseId, period],
    queryFn: async () => {
      const res = await api.get(`/reports/menu?period=${period}`);
      return res.data.data;
    },
    enabled: activeTab === "menu",
  });

  // Fetch Attendance Report
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["report-attendance", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/reports/attendance");
      return res.data.data;
    },
    enabled: activeTab === "attendance",
  });

  // Fetch Payroll Report
  const { data: payrollData, isLoading: isLoadingPayroll } = useQuery({
    queryKey: ["report-payroll", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/reports/payroll");
      return res.data.data;
    },
    enabled: activeTab === "payroll",
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Business Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational telemetry, sales revenue, payment split channels, and top menu performers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            options={[
              { value: "today", label: "📅 Today" },
              { value: "yesterday", label: "📅 Yesterday" },
              { value: "this_week", label: "📅 This Week" },
              { value: "this_month", label: "📅 This Month" },
              { value: "this_year", label: "📅 This Year" },
            ]}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44 font-semibold"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("sales")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 shrink-0 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "sales"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Sales & Revenue
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 shrink-0 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Payment Channels
        </button>
        <button
          onClick={() => setActiveTab("menu")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 shrink-0 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "menu"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" /> Top Dishes
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 shrink-0 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "attendance"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Attendance Metrics
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 shrink-0 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "payroll"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Banknote className="w-4 h-4" /> Payroll Summary
        </button>
      </div>

      {/* ================= 1. SALES REPORT ================= */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          {isLoadingSales ? (
            <LoadingState message="Calculating sales metrics..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                  title="Total Revenue"
                  value={`₹${(salesData?.totalRevenue || 0).toLocaleString("en-IN")}`}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="emerald"
                />
                <StatCard
                  title="Total Orders"
                  value={salesData?.totalOrders || 0}
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="indigo"
                />
                <StatCard
                  title="Average Order Value"
                  value={`₹${Math.round(salesData?.averageOrderValue || 0).toLocaleString("en-IN")}`}
                  icon={<BarChart3 className="w-6 h-6" />}
                  color="cyan"
                />
                <StatCard
                  title="Total Tax Collected"
                  value={`₹${(salesData?.totalTax || 0).toLocaleString("en-IN")}`}
                  subtitle={`₹${(salesData?.totalDiscount || 0).toLocaleString("en-IN")} Discounts Given`}
                  icon={<CreditCard className="w-6 h-6" />}
                  color="purple"
                />
              </div>

              {/* Timeline Breakdown Table */}
              <Card title="Daily Sales Timeline" subtitle="Breakdown by individual calendar days">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Completed Orders</th>
                        <th className="px-6 py-3">Total Daily Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {salesData?.dailyBreakdown?.map((day: any) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-medium text-gray-900">{day.date}</td>
                          <td className="px-6 py-3.5 text-gray-700">{day.orders} orders</td>
                          <td className="px-6 py-3.5 font-bold text-emerald-600">
                            ₹{day.revenue.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                      {(!salesData?.dailyBreakdown || salesData.dailyBreakdown.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                            No sales records found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ================= 2. PAYMENTS REPORT ================= */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {isLoadingPayments ? (
            <LoadingState message="Aggregating payment methods..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <StatCard
                  title="Grand Total Collected"
                  value={`₹${(paymentData?.grandTotal || 0).toLocaleString("en-IN")}`}
                  subtitle={`${paymentData?.totalTransactions || 0} Transactions`}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="emerald"
                />
                <StatCard
                  title="Active Payment Channels"
                  value={paymentData?.byMethod?.length || 0}
                  icon={<CreditCard className="w-6 h-6" />}
                  color="indigo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paymentData?.byMethod?.map((item: any) => (
                  <Card key={item.method} title={`${item.method} Payments`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-gray-900">
                          ₹{Number(item.total).toLocaleString("en-IN")}
                        </span>
                        <Badge variant="primary">{item.percentage}% of volume</Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>

                      <p className="text-xs text-gray-500">{item.count} Successful transactions</p>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= 3. TOP MENU REPORT ================= */}
      {activeTab === "menu" && (
        <div className="space-y-6">
          {isLoadingMenu ? (
            <LoadingState message="Ranking top dishes..." />
          ) : (
            <Card title="Top Selling Dishes" subtitle="Ranked by volume ordered">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Rank</th>
                      <th className="px-6 py-3">Dish</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Quantity Sold</th>
                      <th className="px-6 py-3">Gross Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {menuData?.topItems?.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3.5 font-bold text-gray-400">#{idx + 1}</td>
                        <td className="px-6 py-3.5 font-bold text-gray-900">{item.name}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant="primary">{item.category}</Badge>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-gray-800">{item.quantity} units</td>
                        <td className="px-6 py-3.5 font-bold text-emerald-600">
                          ₹{Number(item.revenue).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {(!menuData?.topItems || menuData.topItems.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                          No dish sales recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================= 4. ATTENDANCE REPORT ================= */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          {isLoadingAttendance ? (
            <LoadingState message="Compiling staff attendance..." />
          ) : (
            <Card
              title="Monthly Staff Attendance Summary"
              subtitle={`Month ${attendanceData?.month}/${attendanceData?.year}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Employee</th>
                      <th className="px-6 py-3">Designation</th>
                      <th className="px-6 py-3">Present Days</th>
                      <th className="px-6 py-3">Half Days</th>
                      <th className="px-6 py-3">Approved Leave</th>
                      <th className="px-6 py-3">Absent Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceData?.summary?.map((row: any) => (
                      <tr key={row.employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3.5 font-bold text-gray-900">
                          {row.employee.firstName} {row.employee.lastName || ""}
                          <span className="block text-[10px] text-gray-400 font-mono">
                            {row.employee.employeeCode}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-600">{row.employee.designation || "Staff"}</td>
                        <td className="px-6 py-3.5 font-bold text-emerald-600">{row.present}</td>
                        <td className="px-6 py-3.5 text-amber-600">{row.halfDay}</td>
                        <td className="px-6 py-3.5 text-indigo-600">{row.leave}</td>
                        <td className="px-6 py-3.5 text-rose-600 font-bold">{row.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================= 5. PAYROLL REPORT ================= */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          {isLoadingPayroll ? (
            <LoadingState message="Aggregating annual payroll..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <StatCard
                  title="Annual Gross Payroll"
                  value={`₹${(payrollData?.totalGross || 0).toLocaleString("en-IN")}`}
                  icon={<Banknote className="w-6 h-6" />}
                  color="indigo"
                />
                <StatCard
                  title="Total Deductions"
                  value={`₹${(payrollData?.totalDeductions || 0).toLocaleString("en-IN")}`}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="rose"
                />
                <StatCard
                  title="Total Net Disbursed"
                  value={`₹${(payrollData?.totalNet || 0).toLocaleString("en-IN")}`}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="emerald"
                />
              </div>

              <Card title={`Payroll Ledger (${payrollData?.year || 2026})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                      <tr>
                        <th className="px-6 py-3">Month</th>
                        <th className="px-6 py-3">Gross Total</th>
                        <th className="px-6 py-3">Deductions</th>
                        <th className="px-6 py-3">Net Disbursed</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payrollData?.payrolls?.map((p: any) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-bold text-gray-900">Month {p.month}</td>
                          <td className="px-6 py-3.5">₹{Number(p.totalGross).toLocaleString("en-IN")}</td>
                          <td className="px-6 py-3.5 text-rose-600">-₹{Number(p.totalDeductions).toLocaleString("en-IN")}</td>
                          <td className="px-6 py-3.5 font-bold text-emerald-600">
                            ₹{Number(p.totalNet).toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge variant={p.status === "PAID" ? "success" : "warning"}>{p.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};
