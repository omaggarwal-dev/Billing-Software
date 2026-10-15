import prisma from "./lib/prisma.js";

const API_BASE = "http://localhost:5000/api";

async function verifyFranchiseDistinctAddresses() {
  console.log("====================================================");
  console.log("VERIFYING DISTINCT ADDRESSES ON FRANCHISE BILLS");
  console.log("====================================================");

  // 1. Super Admin Login
  console.log("1. Authenticating Super Admin...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@restaurant.local",
      password: "Admin@12345",
    }),
  });
  const loginData = (await loginRes.json()) as any;
  if (!loginData.success || !loginData.data.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.token;
  console.log("✓ Super Admin authenticated.");

  // Helper auth headers
  const getHeaders = (franchiseId?: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(franchiseId ? { "x-franchise-id": franchiseId } : {}),
  });

  // 2. Create Franchise 1 (Delhi Outlet)
  console.log("2. Creating Franchise 1 (Connaught Place Outlet)...");
  const f1Address = "Shop 14, Inner Circle, Connaught Place, New Delhi - 110001";
  const f1Res = await fetch(`${API_BASE}/franchises`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: "Connaught Place Outlet",
      code: "CP-DEL-01",
      address: f1Address,
      phone: "+91 11 2345 6789",
      email: "delhi@royalheritage.com",
    }),
  });
  const f1Data = (await f1Res.json()) as any;
  if (!f1Data.success) {
    throw new Error(`Failed to create Franchise 1: ${JSON.stringify(f1Data)}`);
  }
  const f1 = f1Data.data;
  console.log("✓ Created Franchise 1:", f1.name, "| Address:", f1.address);

  // 3. Create Franchise 2 (Mumbai Outlet)
  console.log("3. Creating Franchise 2 (Bandra West Outlet)...");
  const f2Address = "Unit 4, Ground Floor, Linking Road, Bandra West, Mumbai - 400050";
  const f2Res = await fetch(`${API_BASE}/franchises`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: "Bandra West Outlet",
      code: "BND-MUM-01",
      address: f2Address,
      phone: "+91 22 8765 4321",
      email: "mumbai@royalheritage.com",
    }),
  });
  const f2Data = (await f2Res.json()) as any;
  if (!f2Data.success) {
    throw new Error(`Failed to create Franchise 2: ${JSON.stringify(f2Data)}`);
  }
  const f2 = f2Data.data;
  console.log("✓ Created Franchise 2:", f2.name, "| Address:", f2.address);

  try {
    // 4. Create master menu item in F1 and F2
    console.log("4. Setting up menu item in franchises...");
    const category1 = await prisma.category.create({
      data: { franchiseId: f1.id, name: "Main Course" },
    });
    const item1 = await prisma.menuItem.create({
      data: {
        franchiseId: f1.id,
        categoryId: category1.id,
        code: "DISH-CP-01",
        name: "Delhi Butter Chicken",
        price: 450,
      },
    });

    const category2 = await prisma.category.create({
      data: { franchiseId: f2.id, name: "Main Course" },
    });
    const item2 = await prisma.menuItem.create({
      data: {
        franchiseId: f2.id,
        categoryId: category2.id,
        code: "DISH-BND-01",
        name: "Mumbai Koliwada Prawns",
        price: 520,
      },
    });

    // 5. Generate Order and Invoice in Franchise 1
    console.log("5. Generating Bill in Franchise 1...");
    const order1Res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: getHeaders(f1.id),
      body: JSON.stringify({
        items: [{ menuItemId: item1.id, quantity: 2 }],
      }),
    });
    const order1Data = (await order1Res.json()) as any;
    const inv1Res = await fetch(`${API_BASE}/billing/invoices`, {
      method: "POST",
      headers: getHeaders(f1.id),
      body: JSON.stringify({ orderId: order1Data.data.id }),
    });
    const inv1Data = (await inv1Res.json()) as any;
    const invoice1 = inv1Data.data;
    console.log("✓ Generated Invoice 1:", invoice1.invoiceNumber, "in", f1.name);

    // 6. Generate Order and Invoice in Franchise 2
    console.log("6. Generating Bill in Franchise 2...");
    const order2Res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: getHeaders(f2.id),
      body: JSON.stringify({
        items: [{ menuItemId: item2.id, quantity: 1 }],
      }),
    });
    const order2Data = (await order2Res.json()) as any;
    const inv2Res = await fetch(`${API_BASE}/billing/invoices`, {
      method: "POST",
      headers: getHeaders(f2.id),
      body: JSON.stringify({ orderId: order2Data.data.id }),
    });
    const inv2Data = (await inv2Res.json()) as any;
    const invoice2 = inv2Data.data;
    console.log("✓ Generated Invoice 2:", invoice2.invoiceNumber, "in", f2.name);

    // 7. Request Print Payloads and Inspect Bill Headers
    console.log("7. Generating Thermal Print Payloads for both bills...");
    const print1Res = await fetch(`${API_BASE}/printers/print-job`, {
      method: "POST",
      headers: getHeaders(f1.id),
      body: JSON.stringify({ type: "RECEIPT", targetId: invoice1.id }),
    });
    const print1Data = (await print1Res.json()) as any;
    const receipt1 = print1Data.data.rawText as string;

    const print2Res = await fetch(`${API_BASE}/printers/print-job`, {
      method: "POST",
      headers: getHeaders(f2.id),
      body: JSON.stringify({ type: "RECEIPT", targetId: invoice2.id }),
    });
    const print2Data = (await print2Res.json()) as any;
    const receipt2 = print2Data.data.rawText as string;

    console.log("\n---------------- FRANCHISE 1 RECEIPT HEADER ----------------");
    console.log(receipt1.substring(0, 320));
    console.log("------------------------------------------------------------\n");

    console.log("---------------- FRANCHISE 2 RECEIPT HEADER ----------------");
    console.log(receipt2.substring(0, 320));
    console.log("------------------------------------------------------------\n");

    // 8. Assertions
    if (!receipt1.includes(f1Address)) {
      throw new Error(`Receipt 1 does NOT contain Franchise 1's distinct address: "${f1Address}"`);
    }
    console.log("✓ SUCCESS: Receipt 1 contains Franchise 1's exact address:", f1Address);

    if (!receipt2.includes(f2Address)) {
      throw new Error(`Receipt 2 does NOT contain Franchise 2's distinct address: "${f2Address}"`);
    }
    console.log("✓ SUCCESS: Receipt 2 contains Franchise 2's exact address:", f2Address);

    if (receipt1.includes(f2Address) || receipt2.includes(f1Address)) {
      throw new Error("Cross-contamination detected! Franchise addresses are leaking into wrong bills.");
    }
    console.log("✓ SUCCESS: Franchise addresses are completely isolated and distinct on every bill!");
  } finally {
    // 9. Clean up test data so database remains clean for user
    console.log("\nCleaning up test orders, menu items, and test franchises...");
    await prisma.invoice.deleteMany({ where: { franchiseId: { in: [f1.id, f2.id] } } });
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({ where: { franchiseId: { in: [f1.id, f2.id] } } });
    await prisma.menuItem.deleteMany({ where: { franchiseId: { in: [f1.id, f2.id] } } });
    await prisma.category.deleteMany({ where: { franchiseId: { in: [f1.id, f2.id] } } });
    await prisma.preparationStation.deleteMany({ where: { franchiseId: { in: [f1.id, f2.id] } } });
    await prisma.franchise.deleteMany({ where: { id: { in: [f1.id, f2.id] } } });
    console.log("✓ Test records cleaned. Database remains fresh.");
  }

  console.log("====================================================");
  console.log("ALL FRANCHISE DISTINCT ADDRESS CHECKS PASSED!");
  console.log("====================================================");
}

verifyFranchiseDistinctAddresses()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
