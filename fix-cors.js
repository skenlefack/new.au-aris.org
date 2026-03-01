const fs = require("fs");
const files = [
  "services/credential/src/main.ts",
  "services/tenant/src/main.ts",
  "services/master-data/src/main.ts",
  "services/analytics/src/main.ts"
];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, "utf8");
  if (content.includes("app.enableCors")) return;
  content = content.replace(
    "app.useGlobalPipes(",
    "app.enableCors({ origin: true, credentials: true });\n\n  app.useGlobalPipes("
  );
  fs.writeFileSync(f, content);
  console.log("Fixed CORS in " + f);
});
