const fs = require("fs");
const f = "services/credential/src/auth/auth.controller.ts";
let c = fs.readFileSync(f, "utf8");
// Change route prefix to avoid conflict with middleware AuthModule
c = c.replace("@Controller('api/v1/auth')", "@Controller('api/v1/credential/auth')");
fs.writeFileSync(f, c);
console.log("Changed route to api/v1/credential/auth");

// Also update frontend hook
const h = "apps/web/src/lib/api/hooks.ts";
let hc = fs.readFileSync(h, "utf8");
hc = hc.replace("'/auth/login'", "'/credential/auth/login'");
fs.writeFileSync(h, hc);
console.log("Updated frontend hook");
