#!/usr/bin/env python3
"""Quick check: which domains do the 21 campaigns belong to?"""
import paramiko, json, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("10.202.101.146", username="arisadmin", password="@u-1baR.0rg$U24", timeout=15)

# Login
stdin, stdout, stderr = client.exec_command(
    'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login '
    '-H "Content-Type: application/json" '
    '-d \'{"email":"admin@au-aris.org","password":"Aris2024!"}\'',
    timeout=30
)
login_out = stdout.read().decode("utf-8", errors="replace").strip()
token = json.loads(login_out).get("data", {}).get("accessToken")

if not token:
    print("Login failed")
    sys.exit(1)

print(f"Token: {token[:30]}...")

# Get all campaigns
stdin, stdout, stderr = client.exec_command(
    f'curl -sk "https://localhost/api/v1/workflow/campaigns?limit=50" '
    f'-H "Authorization: Bearer {token}"',
    timeout=30
)
resp = json.loads(stdout.read().decode("utf-8", errors="replace").strip())
campaigns = resp.get("data", [])

print(f"Total campaigns: {len(campaigns)}\n")

# Group by domain
domains = Counter()
for c in campaigns:
    d = c.get("domain", "none")
    domains[d] += 1

print("Campaigns by domain:")
for domain, count in domains.most_common():
    print(f"  {domain}: {count}")

# Show by status
print("\nCampaigns by status:")
statuses = Counter(c.get("status", "?") for c in campaigns)
for s, count in statuses.most_common():
    print(f"  {s}: {count}")

# Active campaigns by domain
print("\nACTIVE campaigns by domain:")
active = [c for c in campaigns if c.get("status") == "ACTIVE"]
active_domains = Counter(c.get("domain", "none") for c in active)
for domain, count in active_domains.most_common():
    print(f"  {domain}: {count}")

client.close()
