const fs = require("fs");
const path = "packages/db-schemas/prisma/schema.prisma";
let content = fs.readFileSync(path, "utf8");
content = content.replace(
  'url      = "postgresql://aris:aris_dev_2024@localhost:5432/aris"',
  'url      = env("DATABASE_URL")'
);
fs.writeFileSync(path, content);
console.log("Schema restored to env()");
