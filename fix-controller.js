const fs = require("fs");
const f = "services/credential/src/auth/auth.controller.ts";
let c = fs.readFileSync(f, "utf8");

// Replace constructor to add debug log
c = c.replace(
  "constructor(private readonly authService: AuthService) {}",
  `constructor(private readonly authService: AuthService) {
    console.log('[AuthController] authService injected:', typeof this.authService, this.authService?.constructor?.name);
  }`
);

fs.writeFileSync(f, c);
console.log("Added debug log to AuthController");
