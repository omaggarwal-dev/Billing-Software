import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

export async function cleanDatabase() {
  console.log("--- Starting Database Cleanup & Brand Owner Bootstrap ---");

  // Foreign-key safe cleanup
  console.log("Cleaning communications and campaigns...");
  await prisma.communicationLog.deleteMany({});
  await prisma.campaignRule.deleteMany({});
  await prisma.campaign.deleteMany({});

  console.log("Cleaning CRM records...");
  await prisma.customerPreference.deleteMany({});
  await prisma.customerVisit.deleteMany({});
  await prisma.customer.deleteMany({});

  console.log("Cleaning payments and billing...");
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});

  console.log("Cleaning orders and KOTs...");
  await prisma.kOTItem.deleteMany({});
  await prisma.kOT.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.tableSession.deleteMany({});
  await prisma.restaurantTable.deleteMany({});

  console.log("Cleaning recipes and inventory...");
  await prisma.recipeItem.deleteMany({});
  await prisma.recipe.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.inventoryItem.deleteMany({});

  console.log("Cleaning HR and payroll...");
  await prisma.leaveRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.payrollItem.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.employeeAdvance.deleteMany({});
  await prisma.salaryStructure.deleteMany({});
  await prisma.employee.deleteMany({});

  console.log("Cleaning expenses and hardware...");
  await prisma.expense.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.preparationStation.deleteMany({});
  await prisma.printer.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log("Cleaning users and test franchises...");
  await prisma.user.deleteMany({});
  await prisma.franchise.deleteMany({});

  console.log("Seeding platform bootstrap account (Brand Owner)...");
  const passwordHash = await bcrypt.hash("Admin@12345", 12);
  const brandOwner = await prisma.user.create({
    data: {
      name: "Brand Owner",
      email: "admin@restaurant.local",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      franchiseId: null,
    },
  });

  console.log("Database cleanup complete!");
  console.log(`Bootstrap Account created: ${brandOwner.name} (${brandOwner.email}) [${brandOwner.role}]`);

  return brandOwner;
}

if (process.argv[1]?.includes("clean-db")) {
  cleanDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Cleanup failed:", err);
      process.exit(1);
    });
}
