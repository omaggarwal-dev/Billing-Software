import bcrypt from "bcryptjs";

import prisma from "../src/lib/prisma.js";

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@restaurant.local",
    },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@restaurant.local",
      passwordHash,
      role: "SUPER_ADMIN",
      franchiseId: null,
    },
  });

  console.log("Super Admin created:");
  console.log({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });