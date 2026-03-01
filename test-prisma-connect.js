const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://aris:aris_dev_2024@localhost:5432/aris"
    }
  }
});
prisma.$connect()
  .then(() => { console.log("Prisma connected OK!"); return prisma.$disconnect(); })
  .catch(err => { console.error("Failed:", err.message); process.exit(1); });
