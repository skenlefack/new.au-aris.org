const fs = require("fs");
const f = "services/credential/src/auth/auth.service.ts";
let content = fs.readFileSync(f, "utf8");

const oldBlock = `    this.privateKey = process.env['JWT_PRIVATE_KEY'] ?? '';
    this.publicKey = process.env['JWT_PUBLIC_KEY'] ?? '';`;

const newBlock = `    // Load JWT keys: inline env vars or from file paths
    let privKey = (process.env['JWT_PRIVATE_KEY'] ?? '').replace(/\\\\n/g, '\\n');
    let pubKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\\\n/g, '\\n');
    if (!privKey && process.env['JWT_PRIVATE_KEY_PATH']) {
      try { privKey = require('fs').readFileSync(process.env['JWT_PRIVATE_KEY_PATH'], 'utf8'); } catch {}
    }
    if (!pubKey && process.env['JWT_PUBLIC_KEY_PATH']) {
      try { pubKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
    }
    this.privateKey = privKey;
    this.publicKey = pubKey;
    if (!this.privateKey) this.logger.warn('JWT_PRIVATE_KEY is empty! Auth will fail.');`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(f, content);
console.log("Fixed JWT key loading");
