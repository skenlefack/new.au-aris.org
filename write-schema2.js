const fs = require("fs");
const schema = [
  'generator client {',
  '  provider = "prisma-client-js"',
  '}',
  '',
  'datasource db {',
  '  provider = "postgresql"',
  '  url = "postgresql://aris:aris_dev_2024@localhost:5432/aris"',
  '}',
  '',
  'model TestPing {',
  '  id Int @id @default(autoincrement())',
  '}',
].join("\n");
fs.writeFileSync("test-schema2.prisma", schema);
console.log("Written OK");
