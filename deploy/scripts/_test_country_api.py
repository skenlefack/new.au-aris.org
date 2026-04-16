#!/usr/bin/env python3
"""Test the public country API on prod and staging."""
import json
import urllib.request
import urllib.error

urls = [
    ("PROD", "https://au-aris.org/api/v1/public/countries/KE"),
    ("STG", "https://test.au-aris.org/api/v1/public/countries/KE"),
    ("PROD", "https://au-aris.org/api/v1/public/countries/ET"),
    ("PROD", "https://au-aris.org/api/v1/public/countries/NG"),
]

for env, url in urls:
    print(f"\n{'=' * 60}")
    print(f"  {env}: {url}")
    print("=" * 60)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ARIS-Check/1.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())

        d = data.get("data", data)
        print(f"  name:        {d.get('name', {}).get('en', 'N/A')}")
        print(f"  isActive:    {d.get('isActive', 'N/A')}")
        print(f"  hasInterop:  {d.get('hasInterop', 'N/A')}")
        print(f"  tenantId:    {d.get('tenantId', 'N/A')}")

        stats = d.get("statistics", [])
        kpis = d.get("kpiScores", [])
        print(f"  statistics:  {len(stats)} items")
        if stats:
            for s in stats[:3]:
                print(f"    - {s.get('code', '?')}: {s.get('value', '?')} ({s.get('domain', '?')})")

        print(f"  kpiScores:   {len(kpis)} items")
        if kpis:
            for k in kpis[:3]:
                print(f"    - {k.get('code', '?')}: {k.get('score', '?')}%")

        recs = d.get("recs", [])
        print(f"  recs:        {len(recs)} items")

    except urllib.error.HTTPError as e:
        print(f"  HTTP ERROR: {e.code} {e.reason}")
        try:
            body = e.read().decode()[:500]
            print(f"  Body: {body}")
        except:
            pass
    except Exception as e:
        print(f"  ERROR: {e}")
