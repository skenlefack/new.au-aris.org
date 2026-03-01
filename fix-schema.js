const fs = require("fs");
const path = "packages/db-schemas/prisma/schema.prisma";
let content = fs.readFileSync(path, "utf8");
content = content.replace(
  'url      = env("DATABASE_URL")',
  'url      = "postgresql://aris:aris_dev_2024@localhost:5432/aris"'
);
fs.writeFileSync(path, content);
console.log("Schema updated with hardcoded URL");
