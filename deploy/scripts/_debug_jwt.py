#!/usr/bin/env python3
"""Debug JWT key loading inside the credential container."""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import VM_PASS, VM_USER
import paramiko

STG_APP = "10.202.101.146"

# Node.js script to test JWT signing
test_script = """
const fs = require('fs');
const jwt = require('jsonwebtoken');

const keyPath = process.env.JWT_PRIVATE_KEY_PATH || '/app/keys/private.pem';
console.log('Key path:', keyPath);

try {
  const key = fs.readFileSync(keyPath, 'utf8');
  console.log('Key loaded, length:', key.length);
  console.log('Key starts with:', key.substring(0, 40));

  // Try signing a token
  const token = jwt.sign(
    { sub: 'test', email: 'test@test.com' },
    key,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
  console.log('JWT sign SUCCESS, token length:', token.length);
  console.log('Token preview:', token.substring(0, 50) + '...');
} catch (e) {
  console.log('ERROR:', e.message);
}
"""

# Upload script via SFTP
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
          timeout=15, allow_agent=False, look_for_keys=False)

local_tmp = tempfile.mktemp(suffix=".js")
with open(local_tmp, "w", newline="\n") as f:
    f.write(test_script)

sftp = c.open_sftp()
sftp.put(local_tmp, "/tmp/test_jwt.js")
sftp.close()
os.unlink(local_tmp)
c.close()

# Execute inside the container
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
          timeout=15, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = c.exec_command(
    "sudo -S docker cp /tmp/test_jwt.js aris-stg-credential:/tmp/test_jwt.js && "
    "sudo -S docker exec aris-stg-credential node /tmp/test_jwt.js 2>&1",
    timeout=20
)
if VM_PASS:
    stdin.write(VM_PASS + "\n")
    stdin.flush()
stdin.channel.shutdown_write()
stdout.channel.settimeout(20)
out = stdout.read().decode("utf-8", errors="replace")
# Filter out sudo password prompt
lines = [l for l in out.splitlines() if "[sudo]" not in l and "password" not in l.lower()]
print("\n".join(lines))
c.close()

# Also check login response pattern
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
          timeout=15, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = c.exec_command(
    "sudo -S docker logs aris-stg-credential 2>&1 | grep -A 2 'request completed' | tail -20",
    timeout=15
)
if VM_PASS:
    stdin.write(VM_PASS + "\n")
    stdin.flush()
stdin.channel.shutdown_write()
stdout.channel.settimeout(15)
out = stdout.read().decode("utf-8", errors="replace")
lines = [l for l in out.splitlines() if "[sudo]" not in l and "password" not in l.lower()]
print("\n=== Recent completed requests ===")
print("\n".join(lines[:20]))
c.close()
