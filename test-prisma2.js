const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => { console.log("Prisma connected OK!"); return prisma.$disconnect(); })
  .catch(err => { console.error("Failed:", err.message); });
