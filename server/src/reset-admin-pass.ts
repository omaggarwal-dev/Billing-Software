import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";

async function main() {
  const hash12345 = await bcrypt.hash("Admin@12345", 12);
  await prisma.user.update({
    where: { email: "admin@restaurant.local" },
    data: { passwordHash: hash12345 },
  });
  console.log("Updated admin@restaurant.local password to: Admin@12345");

  // Also create/update a default demo manager
  const demoManagerHash = await bcrypt.hash("Password@123", 12);
  const existingFranchise = await prisma.franchise.findFirst();
  if (existingFranchise) {
    await prisma.user.upsert({
      where: { email: "manager@restaurant.local" },
      update: { passwordHash: demoManagerHash, franchiseId: existingFranchise.id },
      create: {
        name: "Demo Manager",
        email: "manager@restaurant.local",
        passwordHash: demoManagerHash,
        role: "FRANCHISE_MANAGER",
        franchiseId: existingFranchise.id,
      },
    });
    console.log("Upserted demo manager: manager@restaurant.local / Password@123");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
