import prisma from "../../lib/prisma.js";

interface ReportDateFilter {
  startDate?: string;
  endDate?: string;
  period?: "today" | "yesterday" | "this_week" | "this_month" | "this_year" | "custom";
}

function resolveDateRange(filters: ReportDateFilter): { gte: Date; lte: Date } {
  const now = new Date();
  let gte = new Date(now);
  let lte = new Date(now);

  if (filters.period === "today") {
    gte.setUTCHours(0, 0, 0, 0);
    lte.setUTCHours(23, 59, 59, 999);
  } else if (filters.period === "yesterday") {
    gte.setUTCDate(now.getUTCDate() - 1);
    gte.setUTCHours(0, 0, 0, 0);
    lte.setUTCDate(now.getUTCDate() - 1);
    lte.setUTCHours(23, 59, 59, 999);
  } else if (filters.period === "this_week") {
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
    gte = new Date(now.setUTCDate(diff));
    gte.setUTCHours(0, 0, 0, 0);
    lte = new Date();
    lte.setUTCHours(23, 59, 59, 999);
  } else if (filters.period === "this_month") {
    gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    lte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  } else if (filters.period === "this_year") {
    gte = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    lte = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
  } else if (filters.startDate || filters.endDate) {
    if (filters.startDate) {
      gte = new Date(filters.startDate);
      gte.setUTCHours(0, 0, 0, 0);
    } else {
      gte = new Date(0);
    }
    if (filters.endDate) {
      lte = new Date(filters.endDate);
      lte.setUTCHours(23, 59, 59, 999);
    } else {
      lte = new Date();
    }
  } else {
    // Default: this month
    gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    lte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  return { gte, lte };
}

// 1. SALES REPORT
export async function getSalesReport(franchiseId: string | null, filters: ReportDateFilter) {
  const { gte, lte } = resolveDateRange(filters);

  const orders = await prisma.order.findMany({
    where: {
      franchiseId: franchiseId || undefined,
      status: { notIn: ["CANCELLED"] },
      createdAt: { gte, lte },
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const totalOrders = orders.length;
  const totalSubtotal = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount), 0);
  const totalTax = orders.reduce((sum, o) => sum + Number(o.tax), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Daily timeline breakdown
  const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const o of orders) {
    const dStr = o.createdAt.toISOString().split("T")[0];
    if (!dailyMap.has(dStr)) {
      dailyMap.set(dStr, { date: dStr, revenue: 0, orders: 0 });
    }
    const cur = dailyMap.get(dStr)!;
    cur.revenue += Number(o.total);
    cur.orders += 1;
  }

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    totalDiscount,
    totalTax,
    totalSubtotal,
    dailyBreakdown: Array.from(dailyMap.values()),
  };
}

// 2. PAYMENT METHODS REPORT
export async function getPaymentsReport(franchiseId: string | null, filters: ReportDateFilter) {
  const { gte, lte } = resolveDateRange(filters);

  const payments = await prisma.payment.findMany({
    where: {
      franchiseId: franchiseId || undefined,
      status: "COMPLETED",
      createdAt: { gte, lte },
    },
  });

  const methodSummary: Record<string, { count: number; total: number }> = {
    CASH: { count: 0, total: 0 },
    UPI: { count: 0, total: 0 },
    CARD: { count: 0, total: 0 },
    OTHER: { count: 0, total: 0 },
  };

  let grandTotal = 0;

  for (const p of payments) {
    const amt = Number(p.amount);
    grandTotal += amt;
    if (methodSummary[p.method]) {
      methodSummary[p.method].count += 1;
      methodSummary[p.method].total += amt;
    }
  }

  return {
    grandTotal,
    totalTransactions: payments.length,
    byMethod: Object.entries(methodSummary).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : "0",
    })),
  };
}

// 3. MENU ITEMS REPORT
export async function getMenuReport(franchiseId: string | null, filters: ReportDateFilter) {
  const { gte, lte } = resolveDateRange(filters);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        franchiseId: franchiseId || undefined,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte, lte },
      },
    },
    include: {
      menuItem: {
        include: { category: true },
      },
    },
  });

  const itemMap = new Map<string, { id: string; name: string; category: string; quantity: number; revenue: number }>();
  const categoryMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const oi of orderItems) {
    const id = oi.menuItemId;
    const name = oi.menuItem.name;
    const catName = oi.menuItem.category.name;
    const qty = oi.quantity;
    const rev = Number(oi.totalPrice);

    if (!itemMap.has(id)) {
      itemMap.set(id, { id, name, category: catName, quantity: 0, revenue: 0 });
    }
    const it = itemMap.get(id)!;
    it.quantity += qty;
    it.revenue += rev;

    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { name: catName, quantity: 0, revenue: 0 });
    }
    const cat = categoryMap.get(catName)!;
    cat.quantity += qty;
    cat.revenue += rev;
  }

  const topItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);
  const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);

  return {
    topItems,
    topCategories,
    totalItemsSold: topItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// 4. ATTENDANCE REPORT
export async function getAttendanceReport(franchiseId: string | null, month?: number, year?: number) {
  const now = new Date();
  const m = month || now.getUTCMonth() + 1;
  const y = year || now.getUTCFullYear();

  const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const employees = await prisma.employee.findMany({
    where: { franchiseId: franchiseId || undefined },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true },
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      franchiseId: franchiseId || undefined,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  const summary = employees.map((emp) => {
    const records = attendances.filter((a) => a.employeeId === emp.id);
    const present = records.filter((a) => a.status === "PRESENT").length;
    const absent = records.filter((a) => a.status === "ABSENT").length;
    const halfDay = records.filter((a) => a.status === "HALF_DAY").length;
    const leave = records.filter((a) => a.status === "LEAVE").length;
    const holiday = records.filter((a) => a.status === "HOLIDAY").length;

    return {
      employee: emp,
      present,
      absent,
      halfDay,
      leave,
      holiday,
      totalRecorded: records.length,
    };
  });

  return { month: m, year: y, summary };
}

// 5. PAYROLL REPORT
export async function getPayrollReport(franchiseId: string | null, year?: number) {
  const y = year || new Date().getUTCFullYear();

  const payrolls = await prisma.payroll.findMany({
    where: {
      franchiseId: franchiseId || undefined,
      year: y,
    },
    include: {
      franchise: { select: { id: true, name: true, code: true } },
    },
    orderBy: { month: "asc" },
  });

  const totalGross = payrolls.reduce((sum, p) => sum + Number(p.totalGross), 0);
  const totalDeductions = payrolls.reduce((sum, p) => sum + Number(p.totalDeductions), 0);
  const totalNet = payrolls.reduce((sum, p) => sum + Number(p.totalNet), 0);

  return {
    year: y,
    totalGross,
    totalDeductions,
    totalNet,
    payrolls,
  };
}

// 6. GLOBAL FRANCHISE REPORT (Super Admin only)
export async function getGlobalFranchiseReport(filters: ReportDateFilter) {
  const { gte, lte } = resolveDateRange(filters);

  const franchises = await prisma.franchise.findMany({
    include: {
      _count: { select: { employees: true, tables: true, users: true } },
      orders: {
        where: {
          status: { notIn: ["CANCELLED"] },
          createdAt: { gte, lte },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const comparison = franchises.map((f) => {
    const ordersCount = f.orders.length;
    const revenue = f.orders.reduce((sum, o) => sum + Number(o.total), 0);
    const aov = ordersCount > 0 ? revenue / ordersCount : 0;

    return {
      id: f.id,
      name: f.name,
      code: f.code,
      isActive: f.isActive,
      employeesCount: f._count.employees,
      tablesCount: f._count.tables,
      ordersCount,
      revenue,
      averageOrderValue: aov,
    };
  });

  const totalGlobalRevenue = comparison.reduce((sum, c) => sum + c.revenue, 0);
  const totalGlobalOrders = comparison.reduce((sum, c) => sum + c.ordersCount, 0);
  const totalGlobalEmployees = comparison.reduce((sum, c) => sum + c.employeesCount, 0);

  return {
    totalGlobalRevenue,
    totalGlobalOrders,
    totalGlobalEmployees,
    totalFranchises: franchises.length,
    activeFranchises: franchises.filter((f) => f.isActive).length,
    franchises: comparison,
  };
}

// 7. DASHBOARD SUMMARY STATS
export async function getDashboardStats(franchiseId: string | null, isSuperAdmin: boolean) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  if (isSuperAdmin && !franchiseId) {
    const [
      franchisesCount,
      activeFranchisesCount,
      todayOrders,
      monthOrders,
      totalEmployees,
      pendingPayrolls,
    ] = await Promise.all([
      prisma.franchise.count(),
      prisma.franchise.count({ where: { isActive: true } }),
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, status: { notIn: ["CANCELLED"] } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart }, status: { notIn: ["CANCELLED"] } },
      }),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.payroll.count({ where: { status: "DRAFT" } }),
    ]);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const aov = monthOrders.length > 0 ? monthRevenue / monthOrders.length : 0;

    return {
      isSuperAdmin: true,
      totalFranchises: franchisesCount,
      activeFranchises: activeFranchisesCount,
      todayRevenue,
      todayOrdersCount: todayOrders.length,
      monthlyRevenue: monthRevenue,
      monthlyOrdersCount: monthOrders.length,
      averageOrderValue: aov,
      totalEmployees,
      pendingPayrollCount: pendingPayrolls,
    };
  }

  // Franchise-specific dashboard
  const fid = franchiseId!;
  const [
    todayOrders,
    monthOrders,
    tables,
    activeKOTs,
    todayAttendance,
    totalEmployees,
    activeUsers,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { franchiseId: fid, createdAt: { gte: todayStart }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.order.findMany({
      where: { franchiseId: fid, createdAt: { gte: monthStart }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.restaurantTable.findMany({ where: { franchiseId: fid } }),
    prisma.kOT.findMany({
      where: { franchiseId: fid, status: { in: ["CREATED", "PRINTED", "ACCEPTED", "PREPARING"] } },
    }),
    prisma.attendance.findMany({
      where: { franchiseId: fid, date: { gte: todayStart } },
    }),
    prisma.employee.count({ where: { franchiseId: fid, status: "ACTIVE" } }),
    prisma.user.count({ where: { franchiseId: fid, isActive: true } }),
  ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED" || t.status === "BILLING").length;
  const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;
  const presentStaff = todayAttendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;

  return {
    isSuperAdmin: false,
    franchiseId: fid,
    todayRevenue,
    todayOrdersCount: todayOrders.length,
    occupiedTables,
    availableTables,
    totalTables: tables.length,
    activeKOTsCount: activeKOTs.length,
    totalEmployees,
    presentStaffCount: presentStaff,
    activeUsersCount: activeUsers,
  };
}
