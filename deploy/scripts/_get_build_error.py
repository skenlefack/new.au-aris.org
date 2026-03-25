#!/usr/bin/env python3
"""Get the full web build error from staging"""
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
print("[+] Connected")

cmd = "sudo -S bash -c 'cd /opt/aris-deploy/vm-app-stg && docker compose build web 2>&1'"
stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
stdin.write(SSH_PASS + "\n")
stdin.flush()
out = stdout.read().decode("utf-8", errors="replace")

# Find the error section
lines = out.split("\n")
# Look for Type error or error lines
error_lines = []
capture = False
for i, line in enumerate(lines):
    if "error" in line.lower() or "Error" in line or "failed" in line.lower():
        # Get some context before and after
        start = max(0, i - 5)
        end = min(len(lines), i + 5)
        for j in range(start, end):
            if lines[j] not in error_lines:
                error_lines.append(lines[j])

if error_lines:
    print("\n--- ERROR CONTEXT ---")
    for line in error_lines:
        print(line)
else:
    # Just print last 60 lines
    print("\n--- LAST 60 LINES ---")
    for line in lines[-60:]:
        print(line)

client.close()
