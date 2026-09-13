import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true, passwordHash: true },
  });
  console.log("Found", users.length, "users:");
  for (const u of users) {
    console.log(`- [${u.role}] ${u.email} (${u.name})`);
  }

  const admin = await prisma.user.findUnique({ where: { email: "admin@restaurant.local" } });
  if (admin) {
    const is12345 = await bcrypt.compare("Admin@12345", admin.passwordHash);
    const is123 = await bcrypt.compare("Admin@123", admin.passwordHash);
    console.log("Password check for 'Admin@12345':", is12345);
    console.log("Password check for 'Admin@123':", is123);
  } else {
    console.log("admin@restaurant.local does NOT exist in DB!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
