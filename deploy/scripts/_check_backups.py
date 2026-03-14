#!/usr/bin/env python3
"""
ARIS 4.0 — Verify backup health across all VMs.

Checks that recent backups exist, are not empty, and meet size thresholds.

Usage:
  export ARIS_DEPLOY_PASS='...'
  python _check_backups.py
"""
from ssh_config import ssh, step, VM_DB, VM_CACHE

# Minimum expected sizes (bytes) — alerts if smaller
MIN_PG_DUMP_SIZE = 1_000_000       # 1 MB — production DB should be larger
MIN_REDIS_DUMP_SIZE = 10_000       # 10 KB
MIN_OPENSEARCH_SNAPSHOT_COUNT = 1

ERRORS = []


def check(label, ok, detail=""):
    status = "OK" if ok else "FAIL"
    marker = "  [+]" if ok else "  [!]"
    msg = f"{marker} {label}: {status}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    if not ok:
        ERRORS.append(label)


# ══════════════════════════════════════════════════════════════
# VM-DB: PostgreSQL backups
# ══════════════════════════════════════════════════════════════
step("VM-DB: PostgreSQL Backup Health")

# Check if any recent daily dump exists (last 24h)
code, out, _ = ssh(VM_DB, "find /backups/postgres/daily -name 'aris_backup_*.dump' -mtime -1 2>/dev/null | head -5")
recent_dumps = [f for f in out.strip().split("\n") if f]
check("Recent daily dump (last 24h)", len(recent_dumps) > 0,
      f"{len(recent_dumps)} found" if recent_dumps else "NONE found")

# Check dump size
if recent_dumps:
    code, out, _ = ssh(VM_DB, f"stat -c %s '{recent_dumps[0]}' 2>/dev/null")
    try:
        size = int(out.strip())
        size_mb = size / (1024 * 1024)
        check("Dump size", size >= MIN_PG_DUMP_SIZE,
              f"{size_mb:.1f} MB (min: {MIN_PG_DUMP_SIZE / 1_000_000:.0f} MB)")
    except ValueError:
        check("Dump size", False, "Could not read size")

# Check total daily count
code, out, _ = ssh(VM_DB, "find /backups/postgres/daily -name '*.dump' | wc -l")
daily_count = out.strip()
check("Daily dump inventory", int(daily_count or 0) > 0, f"{daily_count} dumps")

# Check weekly count
code, out, _ = ssh(VM_DB, "find /backups/postgres/weekly -name '*.dump' | wc -l")
weekly_count = out.strip()
print(f"  [i] Weekly dumps: {weekly_count}")

# Disk space
code, out, _ = ssh(VM_DB, "df -h /backups 2>/dev/null | tail -1")
if out.strip():
    print(f"  [i] Disk: {out.strip()}")

# ══════════════════════════════════════════════════════════════
# VM-CACHE: Redis backups
# ══════════════════════════════════════════════════════════════
step("VM-CACHE: Redis Backup Health")

# Check recent RDB backup
code, out, _ = ssh(VM_CACHE, "find /backups/redis -name 'redis_dump_*.rdb' -mtime -1 2>/dev/null | head -5")
recent_rdb = [f for f in out.strip().split("\n") if f]
check("Recent Redis dump (last 24h)", len(recent_rdb) > 0,
      f"{len(recent_rdb)} found" if recent_rdb else "NONE found")

# Check RDB size
if recent_rdb:
    code, out, _ = ssh(VM_CACHE, f"stat -c %s '{recent_rdb[0]}' 2>/dev/null")
    try:
        size = int(out.strip())
        size_kb = size / 1024
        check("Redis dump size", size >= MIN_REDIS_DUMP_SIZE,
              f"{size_kb:.1f} KB (min: {MIN_REDIS_DUMP_SIZE / 1024:.0f} KB)")
    except ValueError:
        check("Redis dump size", False, "Could not read size")

# Check total backup count
code, out, _ = ssh(VM_CACHE, "find /backups/redis -name 'redis_*' | wc -l")
redis_count = out.strip()
check("Redis backup inventory", int(redis_count or 0) > 0, f"{redis_count} files")

# ══════════════════════════════════════════════════════════════
# VM-CACHE: OpenSearch backups
# ══════════════════════════════════════════════════════════════
step("VM-CACHE: OpenSearch Backup Health")

# Check snapshot count via API
code, out, _ = ssh(VM_CACHE,
    "curl -s http://localhost:9200/_snapshot/aris_backup/_all 2>/dev/null"
    " | python3 -c \"import sys,json; d=json.load(sys.stdin); print(len(d.get('snapshots',[])))\" 2>/dev/null"
    " || echo 0")
try:
    snap_count = int(out.strip())
except ValueError:
    snap_count = 0
check("OpenSearch snapshots", snap_count >= MIN_OPENSEARCH_SNAPSHOT_COUNT,
      f"{snap_count} snapshots")

# Check latest snapshot status
code, out, _ = ssh(VM_CACHE,
    "curl -s http://localhost:9200/_snapshot/aris_backup/_all 2>/dev/null"
    " | python3 -c \""
    "import sys,json; d=json.load(sys.stdin); snaps=d.get('snapshots',[]); "
    "print(snaps[-1]['state'] if snaps else 'NONE')\" 2>/dev/null"
    " || echo UNKNOWN")
latest_state = out.strip()
check("Latest snapshot status", latest_state == "SUCCESS",
      f"state={latest_state}")

# Disk space
code, out, _ = ssh(VM_CACHE, "df -h /backups 2>/dev/null | tail -1")
if out.strip():
    print(f"  [i] Disk: {out.strip()}")

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
step("Backup Health Summary")
if ERRORS:
    print(f"  ISSUES FOUND: {len(ERRORS)}")
    for e in ERRORS:
        print(f"    - {e}")
    print("\n  Action required: investigate failed checks above.")
else:
    print("  All backup checks PASSED!")
    print("  PostgreSQL, Redis, and OpenSearch backups are healthy.")
