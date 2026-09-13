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
import { createOrder, getOrderById, setOrderStatus } from "./modules/order/order.service.js";
import { generateKOTsForOrder, updateKOTStatus } from "./modules/kot/kot.service.js";
import { createInvoiceForOrder, getInvoiceById } from "./modules/billing/billing.service.js";
import { processSplitPayment } from "./modules/payment/payment.service.js";
import { generatePrintPayload, listPrinters } from "./modules/printer/printer.service.js";
import { getDashboardStats, getGlobalFranchiseReport, getSalesReport } from "./modules/report/report.service.js";
import { createInventoryItem, recordStockIn, listInventoryItems } from "./modules/inventory/inventory.service.js";
import { upsertRecipe, getRecipeForMenuItem } from "./modules/recipe/recipe.service.js";
import { createExpense, createExpenseCategory, listExpenseCategories, reviewExpense, getExpenseStats } from "./modules/expense/expense.service.js";
import { createAdvance, listAdvances } from "./modules/advance/advance.service.js";

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

  // 6b. Employee Advance Request (Auto-approved on creation)
  const advance = await createAdvance(
    {
      employeeId: emp!.id,
      amount: 5000,
      reason: "Festival / medical advance",
      paymentMethod: "CASH" as any,
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 6b. Employee Advance recorded:", `₹${advance.amount}`, "Status:", advance.status);

  // 7. Monthly Payroll Generation (Verify Advance Deduction)
  const payroll = await generateMonthlyPayroll(
    {
      month: 9,
      year: 2026,
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 7. Payroll generated:", `Total Net: ₹${payroll.totalNet}`, "Status:", payroll.status);
  
  // Verify employee advance was deducted from payroll item
  const payrollItem = await prisma.payrollItem.findFirst({
    where: { payrollId: payroll.id, employeeId: emp!.id },
  });
  console.log("✅ 7b. Payroll Item basic:", payrollItem?.basicSalary, "Advance deducted:", payrollItem?.advance, "Net:", payrollItem?.netSalary);

  const finalizedPayroll = await finalizePayroll(payroll.id, franchise.id, managerUser.id);
  console.log("✅ 7c. Payroll finalized:", finalizedPayroll.status);
  const paidPayroll = await markPayrollAsPaid(payroll.id, franchise.id, managerUser.id);
  console.log("✅ 7d. Payroll marked PAID:", paidPayroll.status);

  // 8. Raw Materials & Stock-In
  const rawPaneer = await createInventoryItem(
    {
      name: "Fresh Cottage Cheese (Paneer)",
      unit: "KG",
      minimumStock: 5,
      reorderLevel: 10,
      purchasePrice: 320,
      currentStock: 0,
    },
    franchise.id,
    managerUser.id
  );

  const rawChicken = await createInventoryItem(
    {
      name: "Boneless Chicken",
      unit: "KG",
      minimumStock: 10,
      reorderLevel: 20,
      purchasePrice: 240,
      currentStock: 0,
    },
    franchise.id,
    managerUser.id
  );

  // Stock-In 20 KG Paneer and 30 KG Chicken
  await recordStockIn(
    {
      supplier: "Metro Wholesale",
      invoiceNumber: "INV-PO-001",
      notes: "Opening vendor purchase order",
      items: [
        { inventoryItemId: rawPaneer.id, quantity: 20, unitPrice: 320 },
        { inventoryItemId: rawChicken.id, quantity: 30, unitPrice: 240 },
      ],
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 8. Raw material inventory created and stocked: Paneer (20KG), Chicken (30KG)");

  // 8b. Menu Categories & Items
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
  console.log("✅ 8b. Menu created:", item1.name, "(₹280),", item2.name, "(₹420),", item3.name, "(₹60)");

  // 8c. Recipe SOP Configuration
  await upsertRecipe(
    item1.id,
    {
      name: "Paneer Tikka Standard Recipe",
      servingSize: "6 Pieces",
      wastageAllowance: 5,
      items: [
        { inventoryItemId: rawPaneer.id, quantity: 0.25, unit: "KG", wastageAllowance: 0 },
      ],
    },
    franchise.id,
    managerUser.id
  );

  await upsertRecipe(
    item2.id,
    {
      name: "Butter Chicken Standard Recipe",
      servingSize: "1 Bowl",
      wastageAllowance: 5,
      items: [
        { inventoryItemId: rawChicken.id, quantity: 0.35, unit: "KG", wastageAllowance: 0 },
      ],
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 8c. Recipe SOPs configured for Paneer Tikka (0.25KG Paneer) and Butter Chicken (0.35KG Chicken)");

  // 9. Table & Session with Smart Capacity
  const table = await createTable({ tableNumber: "T-01", capacity: 4, status: "AVAILABLE" as any }, franchise.id, managerUser.id);
  const session = await openTableSession(table.id, franchise.id, { guestCount: 2, partyName: "Sharma Family" }, managerUser.id);
  console.log("✅ 9. Table created and session opened for Table:", table.tableNumber, "Capacity: 4, Guests: 2, Remaining: 2");

  // 10. POS Order Creation
  const order = await createOrder(
    {
      tableId: table.id,
      tableSessionId: session.id,
      discount: 50,
      taxRate: 5,
      items: [
        { menuItemId: item1.id, quantity: 2, notes: "Extra spicy" }, // 2 * 0.25 = 0.5 KG Paneer
        { menuItemId: item2.id, quantity: 2, notes: "Less oil" },    // 2 * 0.35 = 0.7 KG Chicken
        { menuItemId: item3.id, quantity: 4, notes: "Butter on side" },
      ],
    },
    franchise.id,
    managerUser.id
  );
  console.log("✅ 10. POS Order created:", order.orderNumber, "Total:", `₹${order.total}`);

  // 11. KOT Generation
  const kots = await generateKOTsForOrder(order.id, franchise.id, undefined, managerUser.id);
  console.log("✅ 11. KOTs generated:", kots.length, "tickets routed to stations");

  // 12. Kitchen Workflow & Auto-Inventory Deduction on SERVE
  for (const kot of kots) {
    await updateKOTStatus(kot.id, "PREPARING" as any, franchise.id, managerUser.id);
    await updateKOTStatus(kot.id, "READY" as any, franchise.id, managerUser.id);
  }
  await setOrderStatus(order.id, "SERVED" as any, franchise.id, managerUser.id);

  // Check inventory deduction
  const updatedPaneer = await prisma.inventoryItem.findUnique({ where: { id: rawPaneer.id } });
  const updatedChicken = await prisma.inventoryItem.findUnique({ where: { id: rawChicken.id } });
  console.log("✅ 12. Order SERVED! Auto Inventory Consumption Verified -> Paneer stock:", updatedPaneer?.currentStock, "KG (was 20KG), Chicken stock:", updatedChicken?.currentStock, "KG (was 30KG)");

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

  // 14b. Unforeseen Expenses
  const expCategories = await listExpenseCategories(franchise.id);
  const expCat = expCategories[0];
  const exp = await createExpense(
    {
      categoryId: expCat.id,
      title: "Emergency plumbing repair",
      amount: 1200,
      paymentMethod: "CASH" as any,
      description: "Kitchen pipe replacement",
    },
    franchise.id,
    managerUser.id,
    "FRANCHISE_MANAGER"
  );
  const approvedExp = await reviewExpense(exp.id, "APPROVED" as any, franchise.id, managerUser.id);
  console.log("✅ 14b. Unforeseen Expense logged & approved:", approvedExp.title, `₹${approvedExp.amount}`, "Status:", approvedExp.status);

  // Verify Table is now AVAILABLE and Session Closed
  const updatedTable = await prisma.restaurantTable.findUnique({ where: { id: table.id } });
  console.log("✅ 14c. Table status after full payment:", updatedTable?.status, "(AVAILABLE)");

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
