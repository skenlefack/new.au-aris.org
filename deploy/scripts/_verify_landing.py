#!/usr/bin/env python3
"""Verify continental stats and country page behavior after fix."""
import json
import urllib.request

# Check continental stats
print("=== Continental Stats ===")
for env, base in [("PROD", "https://au-aris.org"), ("STG", "https://test.au-aris.org")]:
    try:
        req = urllib.request.Request(f"{base}/api/v1/public/stats", headers={"User-Agent": "ARIS/1.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())
        d = data.get("data", data)
        print(f"\n  {env}:")
        print(f"    Total countries: {d.get('totalCountries', '?')}")
        print(f"    Operational: {d.get('operationalCountries', '?')}")
        print(f"    RECs: {d.get('totalRecs', '?')}")
        print(f"    Population: {d.get('totalPopulation', '?')}")
    except Exception as e:
        print(f"  {env}: ERROR - {e}")

# Check a few countries - should all show isActive=false now
print("\n\n=== Country Status Check ===")
countries = ["KE", "ET", "NG", "SN", "ZA", "CM", "DZ", "EG"]
for code in countries:
    try:
        req = urllib.request.Request(f"https://au-aris.org/api/v1/public/countries/{code}", headers={"User-Agent": "ARIS/1.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())
        d = data.get("data", data)
        name = d.get("name", {}).get("en", "?") if isinstance(d.get("name"), dict) else "?"
        active = d.get("isActive", "?")
        interop = d.get("hasInterop", "?")
        status = "FALLBACK MESSAGE" if not active and not interop else "REAL SECTIONS"
        print(f"  {code} ({name:20s}): isActive={str(active):5s}  hasInterop={str(interop):5s}  -> {status}")
    except Exception as e:
        print(f"  {code}: ERROR - {e}")
