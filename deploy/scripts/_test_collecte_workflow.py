#!/usr/bin/env python3
"""
ARIS 4.0 -- Test Collecte & Workflow routes on STAGING + PROD.

Tests workflow lifecycle using proper RBAC:
  - SUPER_ADMIN for continental-level reads + instance creation + L4 actions
  - NATIONAL_ADMIN for L1 (NATIONAL_TECHNICAL) and L2 (NATIONAL_OFFICIAL) actions
  - L3 (REC_HARMONIZATION) requires REC_ADMIN — verified as 403 for other roles
"""
import sys, io, json, argparse, requests, urllib3
urllib3.disable_warnings()
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# SUPER_ADMIN — continental access, can create instances + act at L4
SUPER_ADMIN_EMAIL = "admin@au-aris.org"
SUPER_ADMIN_PASSWORD = "Aris2026@@4!0"

# NATIONAL_ADMIN — can act at L1 (NATIONAL_TECHNICAL) and L2 (NATIONAL_OFFICIAL)
NATIONAL_ADMIN_EMAIL = "admin@ke.au-aris.org"
NATIONAL_ADMIN_PASSWORD = "Aris2026@@4!0"

passed = 0
failed = 0


def test(name, method, url, expected, headers, body=None, params=None):
    global passed, failed
    if method.upper() == "POST" and body is None:
        body = {}
    try:
        r = requests.request(method, url, headers=headers, json=body, params=params, verify=False, timeout=30)
        ok = r.status_code == expected
        icon = "PASS" if ok else "FAIL"
        print(f"  [{icon}] {name} -- {method} {r.status_code} (expected {expected})")
        if not ok:
            failed += 1
            print(f"        {r.text[:300]}")
            return None
        passed += 1
        try:
            return r.json()
        except:
            return {}
    except Exception as e:
        failed += 1
        print(f"  [FAIL] {name} -- {e}")
        return None


def do_login(base, email, password, label=""):
    """Login helper — returns (token, tenantId, headers) or (None, None, None)."""
    data = test(f"Login {label}".strip(), "POST", f"{base}/credential/auth/login", 200,
                {"Content-Type": "application/json"},
                body={"email": email, "password": password})
    if not data:
        return None, None, None
    token = data.get("data", {}).get("accessToken")
    tid = data.get("data", {}).get("user", {}).get("tenantId")
    role = data.get("data", {}).get("user", {}).get("role", "?")
    h = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "X-Tenant-Id": tid}
    print(f"        Token: {token[:20]}... | Tenant: {tid} | Role: {role}")
    return token, tid, h


def run_tests(base_url, env_label):
    global passed, failed
    passed = 0
    failed = 0

    BASE = f"{base_url}/api/v1"
    WF = f"{BASE}/workflow"
    COL = f"{BASE}/collecte"

    print(f"\n{'='*60}")
    print(f"  {env_label} -- Collecte & Workflow E2E Tests")
    print(f"{'='*60}")

    # -- 1. Login SUPER_ADMIN --
    print("\n-- 1a. Login SUPER_ADMIN --")
    sa_token, sa_tid, sa_h = do_login(BASE, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "(SUPER_ADMIN)")
    if not sa_token:
        print("FATAL: Cannot login SUPER_ADMIN"); return passed, failed

    # -- 1b. Login NATIONAL_ADMIN --
    print("\n-- 1b. Login NATIONAL_ADMIN --")
    na_token, na_tid, na_h = do_login(BASE, NATIONAL_ADMIN_EMAIL, NATIONAL_ADMIN_PASSWORD, "(NATIONAL_ADMIN)")
    if not na_token:
        print("WARN: Cannot login NATIONAL_ADMIN — workflow action tests will be skipped")

    # -- 2. List campaigns (SUPER_ADMIN — continental access) --
    print("\n-- 2. List campaigns --")
    data = test("List campaigns", "GET", f"{COL}/campaigns", 200, sa_h, params={"limit": "5"})
    campaigns = (data or {}).get("data", [])
    campaign_id = campaigns[0]["id"] if campaigns else None
    print(f"        Campaigns: {len(campaigns)} | Using: {campaign_id}")

    # -- 3. List submissions --
    print("\n-- 3. List submissions --")
    data = test("List all submissions", "GET", f"{COL}/submissions", 200, sa_h, params={"limit": "5"})
    if data:
        total = data.get("meta", {}).get("total", 0)
        subs = data.get("data", [])
        print(f"        Total: {total} | Page: {len(subs)}")

    if campaign_id:
        data = test("Filter by campaign", "GET", f"{COL}/submissions", 200, sa_h,
                     params={"campaign": campaign_id, "limit": "5"})
        if data:
            print(f"        Campaign submissions: {data.get('meta', {}).get('total', 0)}")

    data = test("Filter by status", "GET", f"{COL}/submissions", 200, sa_h,
                 params={"status": "SUBMITTED", "limit": "3"})
    if data:
        print(f"        SUBMITTED: {data.get('meta', {}).get('total', 0)}")

    # -- 4. Workflow dashboard --
    print("\n-- 4. Workflow dashboard --")
    data = test("Dashboard metrics", "GET", f"{WF}/dashboard", 200, sa_h)
    if data:
        d = data.get("data", {})
        print(f"        Pending: {d.get('totalPending', 0)} | Approved: {d.get('totalApproved', 0)}")
        print(f"        Rejected: {d.get('totalRejected', 0)} | Escalated: {d.get('totalEscalated', 0)}")
        print(f"        SLA Breaches: {d.get('slaBreaches', 0)}")
        pbl = d.get("pendingByLevel", {})
        if pbl:
            print(f"        L1={pbl.get('NATIONAL_TECHNICAL',0)} L2={pbl.get('NATIONAL_OFFICIAL',0)} L3={pbl.get('REC_HARMONIZATION',0)} L4={pbl.get('CONTINENTAL_PUBLICATION',0)}")
        print(f"        WAHIS Ready: {d.get('wahisReadyCount', 0)} | Analytics Ready: {d.get('analyticsReadyCount', 0)}")

    # -- 5. List workflow instances --
    print("\n-- 5. List workflow instances --")
    data = test("List instances", "GET", f"{WF}/instances", 200, sa_h, params={"limit": "5"})
    if data:
        insts = data.get("data", [])
        print(f"        Total: {data.get('meta', {}).get('total', 0)}")
        for inst in insts[:3]:
            print(f"          {inst.get('id','')[:8]} | {inst.get('currentLevel')} | {inst.get('status')} | campaign={inst.get('campaignId','N/A')}")

    # Filter by level
    data = test("Filter by level", "GET", f"{WF}/instances", 200, sa_h,
                 params={"level": "NATIONAL_TECHNICAL", "limit": "3"})
    if data:
        print(f"        NATIONAL_TECHNICAL: {data.get('meta', {}).get('total', 0)}")

    # Filter by status
    data = test("Filter by status", "GET", f"{WF}/instances", 200, sa_h,
                 params={"status": "PENDING", "limit": "3"})
    if data:
        print(f"        PENDING: {data.get('meta', {}).get('total', 0)}")

    # -- 6. Create workflow instance (SUPER_ADMIN — continental can create) --
    print("\n-- 6. Create workflow instance --")
    test_sub_id = "00000000-aaaa-bbbb-cccc-e2e000000001"
    data = test("Create instance", "POST", f"{WF}/instances", 201, sa_h,
                 body={"entityType": "E2ETest", "entityId": test_sub_id, "domain": "health",
                        "campaignId": campaign_id})
    instance_id = None
    if data:
        inst = data.get("data", {})
        instance_id = inst.get("id")
        print(f"        Instance: {instance_id}")
        print(f"        Level: {inst.get('currentLevel')} | Status: {inst.get('status')}")
        sla = inst.get("slaDeadline")
        print(f"        SLA Deadline: {sla or 'NOT SET'}")
        print(f"        Campaign ID: {inst.get('campaignId', 'N/A')}")
        if sla:
            print(f"        >> SLA auto-populated: YES")
        else:
            print(f"        >> SLA auto-populated: NO (no WorkflowDefinition for this tenant)")

    # -- 7. Filter by campaignId and entityId --
    print("\n-- 7. Campaign & entity filters --")
    if instance_id and campaign_id:
        data = test("Filter by campaignId", "GET", f"{WF}/instances", 200, sa_h,
                     params={"campaignId": campaign_id, "limit": "5"})
        if data:
            print(f"        Campaign instances: {data.get('meta', {}).get('total', 0)}")

    if instance_id:
        data = test("Filter by entityId", "GET", f"{WF}/instances", 200, sa_h,
                     params={"entityId": test_sub_id, "limit": "1"})
        if data:
            print(f"        Entity instances: {data.get('meta', {}).get('total', 0)}")

    # -- 8. Approve L1 -> L2 (NATIONAL_ADMIN — allowed at NATIONAL_TECHNICAL) --
    print("\n-- 8. Approve L1 -> L2 (NATIONAL_ADMIN) --")
    if instance_id and na_h:
        data = test("Approve (L1->L2)", "POST", f"{WF}/instances/{instance_id}/approve", 200, na_h,
                     body={"comment": "E2E test: L1 approved by NATIONAL_ADMIN"})
        if data:
            inst = data.get("data", {})
            print(f"        Level: {inst.get('currentLevel')} | Status: {inst.get('status')}")
    elif instance_id:
        print("  [SKIP] No NATIONAL_ADMIN token available")

    # -- 8b. Verify SUPER_ADMIN gets 403 at L1 (role check) --
    # (Already moved past L1, so create a second instance to verify)
    print("\n-- 8b. Verify SUPER_ADMIN cannot act at L1 --")
    test_sub_id_rbac = "00000000-aaaa-bbbb-cccc-e2erbac00001"
    data = test("Create RBAC test instance", "POST", f"{WF}/instances", 201, sa_h,
                 body={"entityType": "E2ETest", "entityId": test_sub_id_rbac, "domain": "health"})
    rbac_inst_id = data.get("data", {}).get("id") if data else None
    if rbac_inst_id:
        test("SUPER_ADMIN at L1 -> 403", "POST", f"{WF}/instances/{rbac_inst_id}/approve", 403, sa_h,
             body={"comment": "This should fail — SUPER_ADMIN not in LEVEL_ROLES[NATIONAL_TECHNICAL]"})

    # -- 9. Add comment (NATIONAL_ADMIN at L2) --
    print("\n-- 9. Add comment (NATIONAL_ADMIN) --")
    if instance_id and na_h:
        data = test("Add comment", "POST", f"{WF}/instances/{instance_id}/comment", 200, na_h,
                     body={"text": "E2E test: reviewing at L2"})
        if data:
            transitions = data.get("data", {}).get("transitions", [])
            comments = [t for t in transitions if t.get("action") == "COMMENT"]
            print(f"        COMMENT transitions: {len(comments)} | Total: {len(transitions)}")

    # -- 10. Approve L2 -> L3 (NATIONAL_ADMIN — allowed at NATIONAL_OFFICIAL) --
    print("\n-- 10. Approve L2 -> L3 (NATIONAL_ADMIN) --")
    if instance_id and na_h:
        data = test("Approve (L2->L3)", "POST", f"{WF}/instances/{instance_id}/approve", 200, na_h,
                     body={"comment": "E2E: L2 approved, WAHIS ready"})
        if data:
            inst = data.get("data", {})
            print(f"        Level: {inst.get('currentLevel')} | wahisReady: {inst.get('wahisReady')}")

    # -- 10b. Verify L3 (REC_HARMONIZATION) requires REC_ADMIN --
    # NATIONAL_ADMIN cannot act at L3 — expect 403
    print("\n-- 10b. Verify L3 requires REC_ADMIN --")
    if instance_id and na_h:
        test("NATIONAL_ADMIN at L3 -> 403", "POST", f"{WF}/instances/{instance_id}/approve", 403, na_h,
             body={"comment": "This should fail — NATIONAL_ADMIN not in LEVEL_ROLES[REC_HARMONIZATION]"})

    # -- 10c. SUPER_ADMIN also cannot act at L3 --
    if instance_id:
        test("SUPER_ADMIN at L3 -> 403", "POST", f"{WF}/instances/{instance_id}/approve", 403, sa_h,
             body={"comment": "This should fail — SUPER_ADMIN not in LEVEL_ROLES[REC_HARMONIZATION]"})

    # -- 11. Return for correction (use SUPER_ADMIN to create a fresh L4 instance for testing) --
    # Since we can't get past L3 without REC_ADMIN, test return on the L3 instance
    print("\n-- 11. Return for correction --")
    # We cannot return from L3 as NATIONAL_ADMIN (403), so skip this step.
    # Instead, create a new instance and test return at L1 level with NATIONAL_ADMIN.
    test_sub_id_return = "00000000-aaaa-bbbb-cccc-e2eret000001"
    data = test("Create return-test instance", "POST", f"{WF}/instances", 201, sa_h,
                 body={"entityType": "E2ETest", "entityId": test_sub_id_return, "domain": "health"})
    return_inst_id = data.get("data", {}).get("id") if data else None
    if return_inst_id and na_h:
        # Approve L1->L2 first
        test("Approve L1->L2 (for return test)", "POST", f"{WF}/instances/{return_inst_id}/approve", 200, na_h,
             body={"comment": "Setup for return test"})
        # Now return from L2
        data = test("Return from L2", "POST", f"{WF}/instances/{return_inst_id}/return", 200, na_h,
                     body={"reason": "E2E test: needs data fix"})
        if data:
            inst = data.get("data", {})
            print(f"        Level: {inst.get('currentLevel')} | Status: {inst.get('status')}")

    # -- 12. Get instance detail with full transitions --
    print("\n-- 12. Instance detail + transitions --")
    if instance_id:
        data = test("Get detail", "GET", f"{WF}/instances/{instance_id}", 200, sa_h)
        if data:
            inst = data.get("data", {})
            transitions = inst.get("transitions", [])
            print(f"        Transitions: {len(transitions)}")
            for t in transitions:
                c = (t.get("comment") or "")[:40]
                print(f"          {t.get('action'):8s} {t.get('fromLevel','')}->{t.get('toLevel','')} | {c}")

    # -- 13. Bulk action (NATIONAL_ADMIN for L1 bulk approve) --
    print("\n-- 13. Bulk action --")
    test_sub_id_2 = "00000000-aaaa-bbbb-cccc-e2e000000002"
    data = test("Create instance #2", "POST", f"{WF}/instances", 201, sa_h,
                 body={"entityType": "E2ETest", "entityId": test_sub_id_2, "domain": "health"})
    inst2_id = data.get("data", {}).get("id") if data else None

    if inst2_id and na_h:
        data = test("Bulk approve (NATIONAL_ADMIN, L1)", "POST", f"{WF}/instances/bulk-action", 200, na_h,
                     body={"ids": [inst2_id], "action": "APPROVE", "comment": "Bulk E2E"})
        if data:
            r = data.get("data", {})
            print(f"        Succeeded: {len(r.get('succeeded', []))} | Failed: {len(r.get('failed', []))}")

    # -- 14. Cleanup: reject test instances --
    print("\n-- 14. Cleanup: reject test instances --")
    # Use NATIONAL_ADMIN for instances at L1/L2, fallback to SUPER_ADMIN for L4
    cleanup_ids = [
        (return_inst_id, "#return"),
        (rbac_inst_id, "#rbac"),
        (inst2_id, "#2"),
    ]
    for iid, label in cleanup_ids:
        if iid and na_h:
            # Try with NATIONAL_ADMIN first (may fail if at L3/L4)
            data = test(f"Reject {label} (NATIONAL_ADMIN)", "POST", f"{WF}/instances/{iid}/reject", 200, na_h,
                         body={"reason": "E2E cleanup"})
            if not data and sa_h:
                test(f"Reject {label} (SUPER_ADMIN fallback)", "POST", f"{WF}/instances/{iid}/reject", 200, sa_h,
                     body={"reason": "E2E cleanup"})

    # Instance #1 is stuck at L3 — we can't reject it without REC_ADMIN. Leave it.
    if instance_id:
        print(f"  [INFO] Instance #1 ({instance_id[:8]}) stuck at L3 -- no REC_ADMIN to reject. Left as-is.")

    # -- Summary --
    print(f"\n{'='*60}")
    total = passed + failed
    print(f"  {env_label} RESULTS: {passed}/{total} passed, {failed} failed")
    print(f"{'='*60}")
    return passed, failed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", choices=["stg", "prod", "both"], default="both")
    args = parser.parse_args()

    total_p, total_f = 0, 0

    if args.env in ("stg", "both"):
        p, f = run_tests("https://test.au-aris.org", "STAGING")
        total_p += p; total_f += f

    if args.env in ("prod", "both"):
        p, f = run_tests("https://au-aris.org", "PRODUCTION")
        total_p += p; total_f += f

    if args.env == "both":
        print(f"\n{'='*60}")
        print(f"  TOTAL: {total_p}/{total_p+total_f} passed, {total_f} failed")
        print(f"{'='*60}")

    if total_f > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
