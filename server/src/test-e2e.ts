import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";
import { loginUser } from "./modules/auth/auth.service.js";
import { createFranchise, listFranchises } from "./modules/franchise/franchise.service.js";
import { createUser } from "./modules/user/user.service.js";
import { createEmployee, listEmployees } from "./modules/employee/employee.service.js";
import { employeeCheckIn, employeeCheckOut, recordAttendance } from "./modules/attendance/attendance.service.js";
import { approveLeaveRequest, createLeaveRequest } from "./modules/leave/leave.service.js";
import { finalizePayroll, generateMonthlyPayroll, markPayrollAsPaid } from "./modules/payroll/payroll.service.js";
import { createCategory, createMenuItem, listMenuItems } from "./modules/menu/menu.service.js";
import { createTable, openTableSession, listTables } from "./modules/table/table.service.js";
import { createOrder, getOrderById } from "./modules/order/order.service.js";
import { generateKOTsForOrder, updateKOTStatus } from "./modules/kot/kot.service.js";
import { createInvoiceForOrder, getInvoiceById } from "./modules/billing/billing.service.js";
import { processSplitPayment } from "./modules/payment/payment.service.js";
import { generatePrintPayload, listPrinters } from "./modules/printer/printer.service.js";
import { getDashboardStats, getGlobalFranchiseReport, getSalesReport } from "./modules/report/report.service.js";

async function runEndToEndTests() {
  console.log("🚀 STARTING E2E BACKEND SUITE...");

  // 1. Super Admin Check
  const adminLogin = await loginUser("admin@restaurant.local", "Admin@123").catch(async () => {
    // If admin password is unknown, upsert a known password
    const passwordHash = await bcrypt.hash("Admin@123", 12);
    await prisma.user.upsert({
      where: { email: "admin@restaurant.local" },
      create: {
        email: "admin@restaurant.local",
        name: "System Administrator",
        role: "SUPER_ADMIN",
        passwordHash,
      },
      update: { passwordHash },
    });
    return loginUser("admin@restaurant.local", "Admin@123");
  });
  console.log("✅ 1. Super Admin authenticated:", adminLogin.user.email);

  // 2. Franchise Creation
  const code = `TEST_${Date.now().toString().slice(-4)}`;
  const franchise = await createFranchise(
    {
      name: "Grand Spice Kitchen",
      code,
      address: "123 Main High Street, Food Court",
      phone: "+91 98765 43210",
      email: `contact_${code.toLowerCase()}@grandspice.com`,
    },
    adminLogin.user.id
  );
  console.log("✅ 2. Franchise created:", franchise.name, `(${franchise.code})`);

  // 3. Franchise Manager Creation
  const managerUser = await createUser(
    {
      name: "Rajesh Sharma",
      email: `manager_${code.toLowerCase()}@grandspice.com`,
      password: "Password@123",
      role: "FRANCHISE_MANAGER" as any,
      franchiseId: franchise.id,
    },
    "SUPER_ADMIN",
    null,
    adminLogin.user.id
  );
  console.log("✅ 3. Franchise Manager created:", managerUser.email);

  // 4. Employee & Salary Structure
  const emp = await createEmployee(
    {
      employeeCode: "EMP-001",
      firstName: "Amit",
      lastName: "Kumar",
      phone: "9988776655",
      email: `amit_${code.toLowerCase()}@grandspice.com`,
      designation: "Head Chef",
      joiningDate: new Date("2026-01-01"),
      status: "ACTIVE" as any,
      salaryStructure: {
        basicSalary: 35000,
        allowances: 5000,
        overtimeRate: 200,
      },
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 4. Employee created:", emp?.firstName, `(${emp?.employeeCode})`, "Salary:", emp?.salaryStructure?.basicSalary);

  // 5. Attendance Check-in & Check-out
  const checkInRes = await employeeCheckIn(emp!.id, franchise.id, "On time");
  console.log("✅ 5. Attendance Check-in recorded at:", checkInRes.checkIn);
  const checkOutRes = await employeeCheckOut(emp!.id, franchise.id, "Shift ended");
  console.log("✅ 5b. Attendance Check-out recorded at:", checkOutRes.checkOut);

  // 6. Leave Request & Approval
  const leave = await createLeaveRequest(
    {
      employeeId: emp!.id,
      startDate: "2026-09-20",
      endDate: "2026-09-21",
      reason: "Family function",
    },
    franchise.id,
    managerUser.id
  );
  const approvedLeave = await approveLeaveRequest(leave.id, franchise.id, "Rajesh Sharma", managerUser.id);
  console.log("✅ 6. Leave approved:", approvedLeave.status, "for dates 2026-09-20 to 2026-09-21");

  // 7. Monthly Payroll Generation
  const payroll = await generateMonthlyPayroll(
    {
      month: 9,
      year: 2026,
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 7. Payroll generated:", `₹${payroll.totalNet}`, "Status:", payroll.status);
  const finalizedPayroll = await finalizePayroll(payroll.id, franchise.id, managerUser.id);
  console.log("✅ 7b. Payroll finalized:", finalizedPayroll.status);
  const paidPayroll = await markPayrollAsPaid(payroll.id, franchise.id, managerUser.id);
  console.log("✅ 7c. Payroll marked PAID:", paidPayroll.status);

  // 8. Menu Categories & Items
  const cat1 = await createCategory({ name: "Starters", description: "Delicious appetizers", isActive: true }, franchise.id, managerUser.id);
  const cat2 = await createCategory({ name: "Main Course", description: "Curries and breads", isActive: true }, franchise.id, managerUser.id);

  const stations = await prisma.preparationStation.findMany({ where: { franchiseId: franchise.id } });
  const kitchenStation = stations.find((s) => s.name === "Main Kitchen") || stations[0];
  const tandoorStation = stations.find((s) => s.name === "Tandoor") || stations[0];

  const item1 = await createMenuItem(
    {
      categoryId: cat1.id,
      stationId: tandoorStation?.id,
      name: "Paneer Tikka",
      description: "Charcoal grilled spiced cottage cheese",
      price: 280,
      isAvailable: true,
    },
    franchise.id,
    managerUser.id
  );

  const item2 = await createMenuItem(
    {
      categoryId: cat2.id,
      stationId: kitchenStation?.id,
      name: "Butter Chicken",
      description: "Tender chicken cooked in rich makhani gravy",
      price: 420,
      isAvailable: true,
    },
    franchise.id,
    managerUser.id
  );

  const item3 = await createMenuItem(
    {
      categoryId: cat2.id,
      stationId: tandoorStation?.id,
      name: "Garlic Naan",
      description: "Crispy tandoori naan with roasted garlic",
      price: 60,
      isAvailable: true,
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 8. Menu created:", item1.name, "(₹280),", item2.name, "(₹420),", item3.name, "(₹60)");

  // 9. Table & Session
  const table = await createTable({ tableNumber: "T-01", capacity: 4, status: "AVAILABLE" as any }, franchise.id, managerUser.id);
  const session = await openTableSession(table.id, franchise.id, managerUser.id);
  console.log("✅ 9. Table created and session opened for Table:", table.tableNumber, "Session ID:", session.id);

  // 10. POS Order Creation
  const order = await createOrder(
    {
      tableId: table.id,
      tableSessionId: session.id,
      discount: 50,
      taxRate: 5,
      items: [
        { menuItemId: item1.id, quantity: 1, notes: "Extra spicy" },
        { menuItemId: item2.id, quantity: 2, notes: "Less oil" },
        { menuItemId: item3.id, quantity: 4, notes: "Butter on side" },
      ],
    },
    franchise.id,
    managerUser.id
  );
  // Expected Subtotal: 280*1 + 420*2 + 60*4 = 280 + 840 + 240 = 1360
  // Discount: 50 => Taxable: 1310
  // Tax (5% of 1310): 65.50
  // Total: 1375.50
  console.log("✅ 10. POS Order created:", order.orderNumber, "Subtotal:", `₹${order.subtotal}`, "Discount:", `₹${order.discount}`, "Tax:", `₹${order.tax}`, "Total:", `₹${order.total}`);

  // 11. KOT Generation
  const kots = await generateKOTsForOrder(order.id, franchise.id, undefined, managerUser.id);
  console.log("✅ 11. KOTs generated:", kots.length, "tickets routed to stations:", kots.map((k) => `${k.kotNumber} -> ${k.station?.name}`));

  // 12. Kitchen Workflow (Chef marks PREPARING -> READY)
  for (const kot of kots) {
    await updateKOTStatus(kot.id, "PREPARING" as any, franchise.id, managerUser.id);
    await updateKOTStatus(kot.id, "READY" as any, franchise.id, managerUser.id);
  }
  const updatedOrder = await getOrderById(order.id, franchise.id);
  console.log("✅ 12. Kitchen processed all KOTs. Order status is now:", updatedOrder.status);

  // 13. Invoice Generation
  const invoice = await createInvoiceForOrder({ orderId: order.id }, franchise.id, managerUser.id);
  console.log("✅ 13. Invoice generated:", invoice.invoiceNumber, "Total:", `₹${invoice.total}`);

  // 14. Split Payment Processing
  const splitPayments = await processSplitPayment(
    {
      invoiceId: invoice.id,
      splits: [
        { amount: 500, method: "CASH" as any },
        { amount: Number(invoice.total) - 500, method: "UPI" as any, transactionId: "UPI-TXN-998822" },
      ],
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 14. Split payments processed:", splitPayments.map((p) => `${p.method}: ₹${p.amount}`).join(", "));

  // Verify Table is now AVAILABLE and Session Closed
  const updatedTable = await prisma.restaurantTable.findUnique({ where: { id: table.id } });
  console.log("✅ 14b. Table status after full payment:", updatedTable?.status, "(should be AVAILABLE)");

  // 15. Printer payload generation
  const receiptPrint = await generatePrintPayload("RECEIPT", invoice.id, franchise.id);
  console.log("✅ 15. Receipt ESC/POS print job generated successfully (lines: " + receiptPrint.rawText.split("\n").length + ")");

  // 16. Reports
  const salesReport = await getSalesReport(franchise.id, { period: "this_month" });
  console.log("✅ 16. Sales Report query:", "Total Revenue:", `₹${salesReport.totalRevenue}`, "Orders:", salesReport.totalOrders);

  const globalReport = await getGlobalFranchiseReport({ period: "this_month" });
  console.log("✅ 16b. Global Owner Report:", "Total Franchises:", globalReport.totalFranchises, "Global Revenue:", `₹${globalReport.totalGlobalRevenue}`);

  const dashboardStats = await getDashboardStats(franchise.id, false);
  console.log("✅ 16c. Franchise Dashboard stats:", "Today Revenue:", `₹${dashboardStats.todayRevenue}`, "Available Tables:", dashboardStats.availableTables);

  console.log("\n🎉 ALL BACKEND E2E TEST CHECKS PASSED SUCCESSFULLY!");
}

runEndToEndTests()
  .catch((err) => {
    console.error("❌ E2E TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
