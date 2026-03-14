#!/usr/bin/env python3
"""Restart all ARIS containers on production."""
import time
from ssh_config import ssh, VM_APP

containers = [
    "aris-master-data",
    "aris-credential",
    "aris-tenant",
    "aris-web",
    "aris-workflow",
    "aris-form-builder",
    "aris-collecte",
    "aris-animal-health",
    "aris-livestock-prod",
    "aris-fisheries",
    "aris-wildlife",
    "aris-apiculture",
    "aris-trade-sps",
    "aris-governance",
    "aris-climate-env",
    "aris-analytics",
    "aris-geo-services",
    "aris-knowledge-hub",
    "aris-realtime",
    "aris-message",
    "aris-drive",
    "aris-data-quality",
    "aris-data-contract",
    "aris-interop-hub",
]

print("Restarting all ARIS service containers...")
for name in containers:
    code, out, _ = ssh(VM_APP, f"docker restart {name} 2>&1", timeout=30)
    status = "OK" if code == 0 else f"FAIL({code})"
    print(f"  {name}: {status}")

print("\nWaiting 8 seconds for services to start...")
time.sleep(8)

print("\nVerifying...")
code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost/ 2>&1")
print(f"  http://localhost/ => {out.strip()}")

code, out, _ = ssh(VM_APP, "curl -s http://localhost:3003/health 2>&1")
print(f"  master-data /health => {out.strip()[:200]}")

print("\nAll containers restarted!")
