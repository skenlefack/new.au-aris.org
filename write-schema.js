const fs = require("fs");
const schema = [
  'generator client {',
  '  provider = "prisma-client-js"',
  '}',
  '',
  'datasource db {',
  '  provider = "postgresql"',
  '  url = env("DATABASE_URL")',
  '}',
  '',
  'model TestPing {',
  '  id Int @id @default(autoincrement())',
  '}',
].join("\n");
fs.writeFileSync("test-schema.prisma", schema);
console.log("Written OK");
