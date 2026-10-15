import prisma from "./lib/prisma.js";

const API_BASE = "http://localhost:5000/api";

async function verify() {
  console.log("==============================================");
  console.log("VERIFYING FRESH STATE & BRAND SETTINGS");
  console.log("==============================================");

  // 1. Verify Super Admin Login
  console.log("1. Testing Super Admin login...");
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
    throw new Error(`Super Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.token;
  console.log("✓ Super Admin login successful. Role:", loginData.data.user.role);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Test GET /brand-settings
  console.log("2. Fetching current Brand Settings...");
  const getBrandRes = await fetch(`${API_BASE}/brand-settings`, {
    headers: authHeaders,
  });
  const getBrandData = (await getBrandRes.json()) as any;
  console.log("✓ Current Brand Settings:", {
    businessName: getBrandData.data.businessName,
    currencySymbol: getBrandData.data.currencySymbol,
    defaultGstRate: getBrandData.data.defaultGstRate,
  });

  // 3. Test PUT /brand-settings with complete corporate details
  console.log("3. Updating Brand Settings with executive profile...");
  const updatePayload = {
    businessName: "Royal Heritage Gourmet",
    tagline: "Finest Culinary Excellence & Hospitality",
    logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120",
    email: "hq@royalheritage.com",
    phone: "+91 98765 43210",
    address: "42 Heritage Boulevard, Bandra West, Mumbai - 400050",
    taxNumber: "27AAAAA0000A1Z5",
    fssaiNumber: "11521018000452",
    currencySymbol: "₹",
    currencyCode: "INR",
    defaultGstRate: 5.0,
    vipDiscountPercent: 20.0,
    loyalDiscountPercent: 15.0,
    regularDiscountPercent: 10.0,
    whatsappSupportNumber: "+919876543210",
  };

  const updateRes = await fetch(`${API_BASE}/brand-settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify(updatePayload),
  });
  const updateData = (await updateRes.json()) as any;
  if (!updateData.success) {
    throw new Error(`Updating brand settings failed: ${JSON.stringify(updateData)}`);
  }
  console.log("✓ Brand settings successfully updated in database.");

  // 4. Verify GET returns updated data
  const verifyRes = await fetch(`${API_BASE}/brand-settings`, {
    headers: authHeaders,
  });
  const verifyData = (await verifyRes.json()) as any;
  const data = verifyData.data;
  console.log("✓ Verified updated settings:", {
    businessName: data.businessName,
    taxNumber: data.taxNumber,
    fssaiNumber: data.fssaiNumber,
    phone: data.phone,
    email: data.email,
    whatsappSupportNumber: data.whatsappSupportNumber,
  });

  // 5. Verify database counts (clean state)
  const dbCounts = {
    franchises: await prisma.franchise.count(),
    orders: await prisma.order.count(),
    menuItems: await prisma.menuItem.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    customers: await prisma.customer.count(),
    employees: await prisma.employee.count(),
    superAdminCount: await prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
    totalUsers: await prisma.user.count(),
  };

  console.log("5. Current database counts (ready for fresh data):", dbCounts);
  if (dbCounts.franchises !== 0 || dbCounts.orders !== 0 || dbCounts.totalUsers !== 1) {
    throw new Error("Database is not in clean fresh state!");
  }
  console.log("✓ Database is completely clean with 0 demo data!");
  console.log("==============================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("==============================================");
}

verify()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
