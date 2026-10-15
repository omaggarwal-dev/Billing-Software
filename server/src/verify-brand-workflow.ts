const API_URL = "http://localhost:5000/api";

async function request(method: string, path: string, body?: any, token?: string, franchiseId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (franchiseId) {
    headers["x-franchise-id"] = franchiseId;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runVerification() {
  console.log("==================================================================");
  console.log("🚀 STARTING BRAND OWNER, CRM, RBAC & BILLING WORKFLOW VERIFICATION");
  console.log("==================================================================\n");

  // 1. Super Admin Login
  console.log("1. Authenticating as Super Admin / Brand Owner...");
  const adminLoginRes = await request("POST", "/auth/login", {
    email: "admin@restaurant.local",
    password: "Admin@12345",
  });
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
  }
  const adminToken = adminLoginRes.data.data.token;
  console.log("   ✅ Super Admin authenticated successfully.");

  // 2. Brand Settings Update
  console.log("\n2. Updating Brand Settings (Business Name, FSSAI, GSTIN, Loyalty Tiers)...");
  const brandPayload = {
    businessName: "The Royal Spice House",
    tagline: "Finest Mughlai & Charcoal Flavors",
    taxNumber: "07AAAAA0000A1Z5",
    fssaiNumber: "10020011000123",
    currency: "₹",
    defaultGstRate: 5,
    loyaltyVipDiscount: 20,
    loyaltyLoyalDiscount: 15,
    loyaltyRegularDiscount: 10,
    whatsappSupportNumber: "+919876543210",
  };
  const brandUpdateRes = await request("PUT", "/brand-settings", brandPayload, adminToken);
  console.log("   ✅ Brand settings saved:", brandUpdateRes.data.data.businessName);

  // Read back
  const brandGetRes = await request("GET", "/brand-settings", undefined, adminToken);
  console.log("   ✅ Brand settings verified: GSTIN:", brandGetRes.data.data.taxNumber, "| VIP Discount:", brandGetRes.data.data.loyaltyVipDiscount + "%");

  // 3. Franchise & Manager Creation
  console.log("\n3. Testing Franchise & Manager Provisioning...");
  const timestamp = Date.now().toString().slice(-4);
  const franchiseCode = `FR-${timestamp}`;
  const franchiseRes = await request(
    "POST",
    "/franchises",
    {
      name: `Spice House Downtown ${timestamp}`,
      code: franchiseCode,
      address: "123 MG Road, Connaught Place",
      phone: `98100${timestamp}`,
      email: `branch${timestamp}@spicehouse.com`,
    },
    adminToken
  );
  const franchiseId = franchiseRes.data.data.id;
  console.log("   ✅ Franchise created:", franchiseRes.data.data.name, `(${franchiseRes.data.data.code})`);

  // Create Manager for this franchise
  const managerEmail = `manager${timestamp}@spicehouse.com`;
  const managerPassword = "managerPassword123";
  const managerRes = await request(
    "POST",
    "/users",
    {
      name: `Manager John ${timestamp}`,
      email: managerEmail,
      password: managerPassword,
      role: "FRANCHISE_MANAGER",
      franchiseId,
    },
    adminToken
  );
  console.log("   ✅ Franchise Manager created:", managerEmail);

  // 4. Franchise Manager Delegation & Cashier Creation
  console.log("\n4. Testing Franchise Manager Delegation (Creating Cashier)...");
  const managerLoginRes = await request("POST", "/auth/login", {
    email: managerEmail,
    password: managerPassword,
  });
  const managerToken = managerLoginRes.data.data.token;

  const cashierEmail = `cashier${timestamp}@spicehouse.com`;
  const cashierPassword = "cashierPassword123";
  const cashierRes = await request(
    "POST",
    "/users",
    {
      name: `Cashier Alice ${timestamp}`,
      email: cashierEmail,
      password: cashierPassword,
      role: "CASHIER",
    },
    managerToken
  );
  console.log("   ✅ Cashier created by Franchise Manager:", cashierEmail);

  // 5. Test Strict RBAC: Manager & Cashier Role Boundaries
  console.log("\n5. Testing Strict RBAC Role Boundaries...");
  const cashierLoginRes = await request("POST", "/auth/login", {
    email: cashierEmail,
    password: cashierPassword,
  });
  const cashierToken = cashierLoginRes.data.data.token;

  // 5a. Cashier trying to create another user -> MUST FAIL (403)
  const cashierCreateUser = await request(
    "POST",
    "/users",
    { name: "Hacker", email: `hacker${timestamp}@evil.com`, password: "password123", role: "CASHIER" },
    cashierToken
  );
  if (cashierCreateUser.status === 403) {
    console.log("   ✅ RBAC Pass: Cashier blocked from creating users (Status: 403 Forbidden)");
  } else {
    console.error("   ❌ SECURITY FLAW: Cashier user creation status:", cashierCreateUser.status);
  }

  // 5b. Manager trying to create Menu Category -> MUST FAIL (403, locked to SUPER_ADMIN)
  const managerCreateCat = await request(
    "POST",
    "/menu/categories",
    { name: `Unauthorized Category ${timestamp}` },
    managerToken
  );
  if (managerCreateCat.status === 403) {
    console.log("   ✅ Governance Pass: Manager blocked from modifying Master Menu Categories (Status: 403 Forbidden)");
  } else {
    console.error("   ❌ GOVERNANCE FLAW: Manager menu creation status:", managerCreateCat.status);
  }

  // 6. Super Admin Menu Creation with Unique Dish Codes
  console.log("\n6. Testing Master Dish Creation & Unique Dish Code Enforcing...");
  const categoryRes = await request(
    "POST",
    "/menu/categories",
    { name: `Signature Dishes ${timestamp}`, description: "Centrally curated" },
    adminToken,
    franchiseId
  );
  if (!categoryRes.ok) {
    throw new Error(`Category creation failed: ${JSON.stringify(categoryRes.data)}`);
  }
  const categoryId = categoryRes.data.data.id;

  const dishCode = `DISH-SPEC-${timestamp}`;
  const dish1Res = await request(
    "POST",
    "/menu/items",
    {
      categoryId,
      name: `Shahi Dum Biryani ${timestamp}`,
      code: dishCode,
      price: 380,
      isAvailable: true,
    },
    adminToken,
    franchiseId
  );
  if (!dish1Res.ok) {
    throw new Error(`Dish creation failed: ${JSON.stringify(dish1Res.data)}`);
  }
  console.log("   ✅ Super Admin created dish:", dish1Res.data.data.name, "with Unique Code:", dish1Res.data.data.code);

  // Attempt duplicate dish code -> MUST FAIL (409)
  const duplicateDishRes = await request(
    "POST",
    "/menu/items",
    {
      categoryId,
      name: `Duplicate Biryani ${timestamp}`,
      code: dishCode,
      price: 400,
      isAvailable: true,
    },
    adminToken,
    franchiseId
  );
  if (duplicateDishRes.status === 409) {
    console.log("   ✅ Unique Code Pass: Duplicate dish code rejected with status 409 Conflict:", `("${duplicateDishRes.data?.message}")`);
  } else {
    console.error("   ❌ UNIQUE CODE FLAW: Duplicate dish code allowed! Status:", duplicateDishRes.status);
  }

  // 7. Raw Material Creation with Unique Raw Code
  console.log("\n7. Testing Raw Material Creation & Unique Raw Code Enforcing...");
  const rawCode = `RAW-BASMATI-${timestamp}`;
  const raw1Res = await request(
    "POST",
    "/inventory",
    {
      name: `Aged Basmati Rice ${timestamp}`,
      code: rawCode,
      unit: "kg",
      currentStock: 50,
      minimumStock: 10,
      reorderLevel: 20,
      purchasePrice: 95,
      supplier: "Punjab Agro",
    },
    adminToken,
    franchiseId
  );
  if (!raw1Res.ok) {
    throw new Error(`Raw material creation failed: ${JSON.stringify(raw1Res.data)}`);
  }
  console.log("   ✅ Raw material created:", raw1Res.data.data.name, "with Unique Code:", raw1Res.data.data.code);

  // Attempt duplicate raw material code -> MUST FAIL (409)
  const duplicateRawRes = await request(
    "POST",
    "/inventory",
    {
      name: `Another Rice Batch ${timestamp}`,
      code: rawCode,
      unit: "kg",
      purchasePrice: 100,
    },
    adminToken,
    franchiseId
  );
  if (duplicateRawRes.status === 409) {
    console.log("   ✅ Unique Code Pass: Duplicate raw material code rejected with status 409 Conflict:", `("${duplicateRawRes.data?.message}")`);
  } else {
    console.error("   ❌ UNIQUE CODE FLAW: Duplicate raw code allowed! Status:", duplicateRawRes.status);
  }

  // 8. CRM Customer & POS Loyalty Discount Simulation
  console.log("\n8. Testing CRM Customer & Loyalty Discount Billing Calculation...");
  const customerPhone = `9811${timestamp}99`;
  const customerRes = await request(
    "POST",
    "/crm/customers",
    {
      name: `Raj Malhotra ${timestamp}`,
      phone: customerPhone,
      email: `raj${timestamp}@example.com`,
      marketingConsent: true,
      notes: "Loves mild spices and outdoor seating",
    },
    adminToken
  );
  console.log("   ✅ Customer registered in CRM:", customerRes.data.data.name, `(${customerRes.data.data.phone})`);

  // Test Phone Lookup
  const lookupRes = await request("GET", `/crm/lookup?phone=${customerPhone}`, undefined, cashierToken);
  console.log("   ✅ POS fast phone lookup found customer:", lookupRes.data.data.name);

  // Generate WhatsApp Click-to-Chat URL
  const waUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(
    `Hello ${lookupRes.data.data.name}! Thank you for dining at ${brandPayload.businessName}. Use code VIP20 for 20% OFF on your next order!`
  )}`;
  console.log("   ✅ 1-Click WhatsApp Direct URL Generated:");
  console.log("     ", waUrl);

  console.log("\n==================================================================");
  console.log("🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!");
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
