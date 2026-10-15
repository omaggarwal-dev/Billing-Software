import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "./lib/prisma.js";

async function main() {
  console.log("==================================================");
  console.log("STARTING COMPREHENSIVE DEMO DATA CLEANUP & RESET");
  console.log("==================================================");

  // 1. Wipe CRM & Communications
  console.log("Deleting communication logs & campaigns...");
  await prisma.communicationLog.deleteMany({});
  await prisma.campaignRule.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.customerPreference.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.customer.deleteMany({});

  // 2. Wipe Logs & Notifications
  console.log("Deleting audit logs & notifications...");
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});

  // 3. Wipe Orders, Billing, KOTs & Tables
  console.log("Deleting payments, invoices, KOTs, orders, and tables...");
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.kOTItem.deleteMany({});
  await prisma.kOT.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.tableSession.deleteMany({});
  await prisma.restaurantTable.deleteMany({});

  // 4. Wipe Inventory, Recipes & Purchases
  console.log("Deleting recipes, inventory transactions, purchases, items...");
  await prisma.recipeItem.deleteMany({});
  await prisma.recipe.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.inventoryItem.deleteMany({});

  // 5. Wipe Menu & Stations
  console.log("Deleting preparation stations, menu items, and categories...");
  await prisma.preparationStation.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});

  // 6. Wipe HR, Payroll & Expenses
  console.log("Deleting payroll, attendance, leaves, employees, and expenses...");
  await prisma.payrollItem.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.employeeAdvance.deleteMany({});
  await prisma.salaryStructure.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.printer.deleteMany({});

  // 7. Wipe Users & Franchises
  console.log("Unlinking franchise references from Super Admin accounts...");
  await prisma.user.updateMany({
    where: { role: "SUPER_ADMIN" },
    data: { franchiseId: null },
  });

  console.log("Deleting all non-super-admin users...");
  await prisma.user.deleteMany({
    where: { role: { not: "SUPER_ADMIN" } },
  });

  // Delete all other superadmins if any, preserving or creating admin@restaurant.local
  await prisma.user.deleteMany({
    where: {
      email: { not: "admin@restaurant.local" },
      role: "SUPER_ADMIN",
    },
  });

  console.log("Deleting all franchises...");
  await prisma.franchise.deleteMany({});

  // 8. Ensure clean Super Admin account exists
  console.log("Ensuring platform super admin (admin@restaurant.local) is ready...");
  const hashedPassword = await bcrypt.hash("Admin@12345", 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@restaurant.local" },
    update: {
      name: "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash: hashedPassword,
      isActive: true,
      franchiseId: null,
    },
    create: {
      email: "admin@restaurant.local",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash: hashedPassword,
      isActive: true,
      franchiseId: null,
    },
  });

  // 9. Reset Brand Settings to clean state
  console.log("Resetting brand settings to clean starting state...");
  await prisma.brandSettings.deleteMany({});
  const brandSettings = await prisma.brandSettings.create({
    data: {
      businessName: "My Restaurant Brand",
      tagline: "Fine Dining & Hospitality",
      currencySymbol: "₹",
      currencyCode: "INR",
      defaultGstRate: 5.0,
      vipDiscountPercent: 20.0,
      loyalDiscountPercent: 15.0,
      regularDiscountPercent: 10.0,
    },
  });

  // 10. Audit Counts Verification
  const counts = {
    franchises: await prisma.franchise.count(),
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    menuItems: await prisma.menuItem.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    recipes: await prisma.recipe.count(),
    orders: await prisma.order.count(),
    invoices: await prisma.invoice.count(),
    customers: await prisma.customer.count(),
    employees: await prisma.employee.count(),
    expenses: await prisma.expense.count(),
    brandSettings: await prisma.brandSettings.count(),
  };

  console.log("==================================================");
  console.log("DATABASE CLEANUP SUMMARY:");
  console.log(JSON.stringify(counts, null, 2));
  console.log("SUPER ADMIN VERIFIED:", superAdmin.email, "Role:", superAdmin.role);
  console.log("BRAND SETTINGS ID:", brandSettings.id, "Name:", brandSettings.businessName);
  console.log("==================================================");
  console.log("DATABASE IS CLEAN AND READY FOR FRESH COMMERCIAL DATA");
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
