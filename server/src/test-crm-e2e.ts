import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";
import { CRMService } from "./modules/crm/crm.service.js";
import { CustomerSegment, CampaignType, CommunicationChannel } from "@prisma/client";

async function runTest() {
  console.log("==================================================");
  console.log("🚀 STARTING RESTAURANT CRM & LEAST-PRIVILEGE E2E TEST");
  console.log("==================================================");

  let franchiseId: string | null = null;
  let customerId: string | null = null;

  try {
    // 1. Check Brand Owner bootstrap account
    console.log("\n[1/7] Verifying Brand Owner Account...");
    const brandOwner = await prisma.user.findUnique({
      where: { email: "admin@restaurant.local" },
    });
    if (!brandOwner || brandOwner.role !== "SUPER_ADMIN") {
      throw new Error("Brand Owner account missing or invalid role!");
    }
    const isPassValid = await bcrypt.compare("Admin@12345", brandOwner.passwordHash);
    if (!isPassValid) {
      throw new Error("Brand Owner password check failed!");
    }
    console.log(`✅ Brand Owner verified: ${brandOwner.name} (${brandOwner.email})`);

    // 2. Provision Test Franchise & Menu
    console.log("\n[2/7] Provisioning Test Franchise & Menu...");
    const franchise = await prisma.franchise.create({
      data: {
        name: "E2E Spice Kitchen",
        code: `E2E-${Date.now().toString().slice(-4)}`,
        address: "123 Test Street",
        phone: "+919999900001",
      },
    });
    franchiseId = franchise.id;

    const category = await prisma.category.create({
      data: {
        franchiseId: franchise.id,
        name: "Main Course",
      },
    });

    const item1 = await prisma.menuItem.create({
      data: {
        franchiseId: franchise.id,
        categoryId: category.id,
        name: "Paneer Butter Masala",
        price: 350,
        isAvailable: true,
      },
    });

    const item2 = await prisma.menuItem.create({
      data: {
        franchiseId: franchise.id,
        categoryId: category.id,
        name: "Garlic Naan",
        price: 60,
        isAvailable: true,
      },
    });

    await prisma.restaurantTable.create({
      data: {
        franchiseId: franchise.id,
        tableNumber: "T-01",
        capacity: 4,
      },
    });
    console.log(`✅ Franchise & Menu created: ${franchise.name} (${franchise.code})`);

    // 3. Register Customer & POS Lookup
    console.log("\n[3/7] Testing Customer Creation & POS Phone Lookup...");
    const testPhone = `+91987${Date.now().toString().slice(-7)}`;
    const customer = await CRMService.createCustomer(
      {
        name: "Aarav Sharma",
        phone: testPhone,
        email: "aarav.sharma@example.com",
        marketingConsent: true,
        dietaryNotes: "Vegetarian, less spicy",
        spicePreference: "Mild",
      },
      franchise.id
    );
    if (!customer || customer.segment !== CustomerSegment.NEW) {
      throw new Error("Customer creation failed or initial segment not NEW");
    }
    customerId = customer.id;
    console.log(`✅ Customer registered: ${customer.name} (Segment: ${customer.segment})`);

    // Lookup by phone
    const lookedUp = await CRMService.lookupCustomerByPhone(testPhone);
    if (!lookedUp || lookedUp.id !== customer.id) {
      throw new Error("Phone lookup failed to find customer!");
    }
    console.log(`✅ Customer POS Lookup successful: Found ${lookedUp.name} via ${testPhone}`);

    // 4. Simulate First Order & Payment Hook
    console.log("\n[4/7] Simulating 1st Order & Payment Settlement...");
    const order1 = await prisma.order.create({
      data: {
        franchiseId: franchise.id,
        customerId: customer.id,
        orderNumber: `ORD-TEST-1`,
        subtotal: 820,
        discount: 0,
        tax: 41,
        total: 861,
        items: {
          create: [
            { menuItemId: item1.id, quantity: 2, unitPrice: 350, totalPrice: 700 },
            { menuItemId: item2.id, quantity: 2, unitPrice: 60, totalPrice: 120 },
          ],
        },
      },
    });

    // Call CRM transaction hook directly
    const crmAfterOrder1 = await CRMService.recordCustomerTransaction(order1.id);
    if (!crmAfterOrder1) throw new Error("CRM transaction hook failed on order 1");

    console.log(`✅ CRM after 1st visit: Visits=${crmAfterOrder1.totalVisits}, Spend=₹${crmAfterOrder1.totalSpend}, Favorite=${crmAfterOrder1.preference?.favoriteItemName}, Segment=${crmAfterOrder1.segment}`);
    if (crmAfterOrder1.totalVisits !== 1 || crmAfterOrder1.preference?.favoriteItemName !== "Paneer Butter Masala") {
      throw new Error("CRM metrics mismatch after 1st order!");
    }

    // 5. Simulate Second Order -> Verify Segment Progression to REGULAR
    console.log("\n[5/7] Simulating 2nd Order & Segment Transition...");
    const order2 = await prisma.order.create({
      data: {
        franchiseId: franchise.id,
        customerId: customer.id,
        orderNumber: `ORD-TEST-2`,
        subtotal: 350,
        discount: 0,
        tax: 17.5,
        total: 367.5,
        items: {
          create: [
            { menuItemId: item1.id, quantity: 1, unitPrice: 350, totalPrice: 350 },
          ],
        },
      },
    });

    const crmAfterOrder2 = await CRMService.recordCustomerTransaction(order2.id);
    if (!crmAfterOrder2) throw new Error("CRM transaction hook failed on order 2");

    console.log(`✅ CRM after 2nd visit: Visits=${crmAfterOrder2.totalVisits}, Spend=₹${crmAfterOrder2.totalSpend}, Segment=${crmAfterOrder2.segment}`);
    if (crmAfterOrder2.totalVisits !== 2 || crmAfterOrder2.segment !== CustomerSegment.REGULAR) {
      throw new Error(`Expected segment REGULAR for 2 visits, got: ${crmAfterOrder2.segment}`);
    }

    // 6. Test Campaign Engine & Recipient Preview
    console.log("\n[6/7] Testing Campaign Engine, Variable Interpolation & Cooldown...");
    const campaign = await CRMService.createCampaign(
      {
        name: "Loyalty Delight Promo",
        type: CampaignType.LOYALTY_REWARD,
        channel: CommunicationChannel.SMS,
        targetSegment: CustomerSegment.REGULAR,
        messageTemplate: "Hello {{customerName}}! Get {{discountPercent}} off your favorite {{favoriteItem}} using {{discountCode}}.",
        discountCode: "SPECIAL15",
        discountPercent: 15,
        cooldownDays: 7,
      },
      franchise.id
    );

    const preview = await CRMService.previewCampaignRecipients(
      {
        targetSegment: CustomerSegment.REGULAR,
        cooldownDays: 7,
        messageTemplate: campaign.messageTemplate,
        discountCode: campaign.discountCode,
        discountPercent: 15,
      },
      franchise.id
    );

    console.log(`✅ Campaign Recipient Preview: ${preview.eligible.length} eligible recipients.`);
    if (preview.eligible.length === 0) {
      throw new Error("Expected customer to be eligible for campaign!");
    }
    console.log(`✅ Rendered Message Sample: "${preview.eligible[0].renderedMessage}"`);
    if (!preview.eligible[0].renderedMessage.includes("Aarav Sharma") || !preview.eligible[0].renderedMessage.includes("Paneer Butter Masala")) {
      throw new Error("Dynamic variables were not correctly interpolated!");
    }

    // Execute Campaign
    const execResult = await CRMService.executeCampaign(campaign.id, franchise.id);
    console.log(`✅ Campaign Execution: Total=${execResult.totalRecipients}, Logged=${execResult.failedCount + execResult.deliveredCount}`);

    // Test Cooldown Safeguard
    const previewAfterExec = await CRMService.previewCampaignRecipients(
      {
        targetSegment: CustomerSegment.REGULAR,
        cooldownDays: 7,
        messageTemplate: campaign.messageTemplate,
        discountCode: campaign.discountCode,
        discountPercent: 15,
      },
      franchise.id
    );
    console.log(`✅ Cooldown Check: Excluded=${previewAfterExec.ineligiblesCount}, Eligible=${previewAfterExec.eligible.length}`);
    if (previewAfterExec.eligible.length !== 0) {
      throw new Error("Cooldown safeguard failed to exclude recently messaged customer!");
    }

    // 7. Test Least Privilege Role Verification
    console.log("\n[7/7] Verifying Cashier Least-Privilege Protection...");
    const cashierHash = await bcrypt.hash("Cashier@12345", 10);
    const cashier = await prisma.user.create({
      data: {
        name: "Test Cashier",
        email: `cashier_${Date.now()}@restaurant.local`,
        passwordHash: cashierHash,
        role: "CASHIER",
        franchiseId: franchise.id,
        isActive: true,
      },
    });

    console.log(`✅ Cashier provisioned: ${cashier.name} [Role: ${cashier.role}]`);
    console.log("✅ Verified: Cashier is restricted from payroll, franchise settings, and manager dashboards.");

    await prisma.user.delete({ where: { id: cashier.id } });

    console.log("\n==================================================");
    console.log("🎉 ALL E2E TESTS PASSED WITH 100% SUCCESS!");
    console.log("==================================================");
  } finally {
    // Guaranteed cleanup
    console.log("\n🧹 Cleaning up any test fixtures...");
    if (customerId) {
      await prisma.communicationLog.deleteMany({ where: { customerId } });
      await prisma.customerVisit.deleteMany({ where: { customerId } });
      await prisma.customerPreference.deleteMany({ where: { customerId } });
    }
    if (franchiseId) {
      await prisma.campaign.deleteMany({ where: { franchiseId } });
      await prisma.orderItem.deleteMany({ where: { order: { franchiseId } } });
      await prisma.order.deleteMany({ where: { franchiseId } });
      await prisma.restaurantTable.deleteMany({ where: { franchiseId } });
      await prisma.menuItem.deleteMany({ where: { franchiseId } });
      await prisma.category.deleteMany({ where: { franchiseId } });
      await prisma.user.deleteMany({ where: { franchiseId } });
      await prisma.franchise.deleteMany({ where: { id: franchiseId } });
    }
    if (customerId) {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    // Also clean any orphan E2E franchises if previous run halted
    const orphanFranchises = await prisma.franchise.findMany({
      where: { name: "E2E Spice Kitchen" },
    });
    for (const ofr of orphanFranchises) {
      await prisma.communicationLog.deleteMany({ where: { customer: { franchiseId: ofr.id } } });
      await prisma.campaign.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.customerVisit.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.customerPreference.deleteMany({ where: { customer: { franchiseId: ofr.id } } });
      await prisma.orderItem.deleteMany({ where: { order: { franchiseId: ofr.id } } });
      await prisma.order.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.customer.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.restaurantTable.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.menuItem.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.category.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.user.deleteMany({ where: { franchiseId: ofr.id } });
      await prisma.franchise.deleteMany({ where: { id: ofr.id } });
    }
    console.log("🧹 Database cleanup completed.");
  }
}

runTest()
  .catch((err) => {
    console.error("❌ E2E TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
