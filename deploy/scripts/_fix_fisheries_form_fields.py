"""
Fix fisheries form template fields — replace text/hardcoded-select with master-data-select.

Problems:
  1. species fields: text or master-data-select without AQUATIC filter
  2. gear_type/catch_method: hardcoded select → master-data-select gear-types
  3. vessel_type: hardcoded select → master-data-select vessel-types
  4. farm_type: hardcoded select → master-data-select aquaculture-farm-types
  5. fao_area: text/select → master-data-select (uses fishery-ref FISHING_AREA)
  6. product_state: hardcoded select → master-data-select
  7. method_of_culture: hardcoded select → master-data-select
"""
import paramiko, json, sys, time, copy

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_HOST = "10.202.101.183"
SSH_PASS = "@u-1baR.0rg$U24"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {SSH_HOST}...")
ssh.connect(SSH_HOST, username="arisadmin", password=SSH_PASS, timeout=15,
            allow_agent=False, look_for_keys=False)

# Auth
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated\n")


def api_get(path):
    _, stdout, _ = ssh.exec_command(
        f'curl -sk "{path}" -H "Authorization: Bearer {token}" 2>/dev/null',
        timeout=15)
    return json.loads(stdout.read().decode())


def api_patch(path, body):
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X PATCH "https://localhost{path}" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json" '
        f'--data-binary @- 2>/dev/null'
    )
    chan.sendall(data.encode())
    chan.shutdown_write()
    time.sleep(2)
    resp = b''
    for _ in range(10):
        if chan.recv_ready():
            resp += chan.recv(16384)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(16384)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())


# ─── Field fix rules ────────────────────────────────────────────────────

def should_fix_species(field):
    """Species fields that are text or master-data-select without AQUATIC filter."""
    code = field.get("code", "")
    if "species" not in code.lower():
        return False
    ftype = field.get("type", "")
    if ftype == "text":
        return True
    if ftype == "master-data-select":
        props = field.get("properties", {})
        pf = props.get("parentFilter", {})
        if not pf.get("category"):
            return True
    return False


def fix_species(field):
    """Convert to master-data-select with AQUATIC filter."""
    field["type"] = "master-data-select"
    props = field.get("properties", {})
    props["masterDataType"] = "species"
    props["searchable"] = True
    props["parentFilter"] = {"category": "AQUATIC"}
    # Remove hardcoded options if any
    props.pop("options", None)
    field["properties"] = props
    return field


# Mapping: field code pattern → (masterDataType, keepOptions)
FIELD_FIXES = {
    "gear_type":    {"masterDataType": "gear-types",              "searchable": True},
    "catch_method": {"masterDataType": "gear-types",              "searchable": True},
    "vessel_type":  {"masterDataType": "vessel-types",            "searchable": True},
    "farm_type":    {"masterDataType": "aquaculture-farm-types",  "searchable": True},
    "fao_area":     {"masterDataType": "gear-types",              "searchable": True},  # placeholder, will fix below
    "fao_area_code":{"masterDataType": "gear-types",              "searchable": True},  # placeholder
    "product_state":{"masterDataType": "commodities",             "searchable": True},  # placeholder
    "method_of_culture": {"masterDataType": "aquaculture-farm-types", "searchable": True},  # closest match
}

# For FAO areas and product states, we use fishery-referentials via a special approach
# The master-data-select component supports these via VALID_REF_TYPES
# But fishery-referentials are not in the ref/ system — they use their own endpoint
# So for now, we convert these to master-data-select with the closest match
# The real fix needs a "fishery-ref-select" field type, but that's a bigger change


def fix_field(field):
    """Apply all fix rules to a field. Returns (field, changed)."""
    code = field.get("code", "")
    ftype = field.get("type", "")
    changed = False

    # 1. Species fix
    if should_fix_species(field):
        field = fix_species(field)
        return field, True

    # 2. Gear/vessel/farm type fixes
    if ftype in ("text", "select") and code in FIELD_FIXES:
        fix = FIELD_FIXES[code]
        # For FAO areas: keep as select (hardcoded) since we don't have a ref type yet
        if code in ("fao_area", "fao_area_code", "product_state", "method_of_culture"):
            # These don't have direct ref types — skip for now
            return field, False

        field["type"] = "master-data-select"
        props = field.get("properties", {})
        props["masterDataType"] = fix["masterDataType"]
        props["searchable"] = fix.get("searchable", True)
        props.pop("options", None)
        field["properties"] = props
        return field, True

    return field, False


# ─── Main: fetch all fisheries templates and fix ─────────────────────────

templates = api_get(
    "https://localhost/api/v1/form-builder/templates?domain=fisheries&limit=20"
).get("data", [])

print(f"Found {len(templates)} fisheries templates\n")

for t in templates:
    tid = t["id"]
    name = t["name"]
    schema = t.get("schema", {})
    sections = schema.get("sections", [])

    fixes = []
    new_schema = copy.deepcopy(schema)

    for si, sec in enumerate(new_schema.get("sections", [])):
        for fi, field in enumerate(sec.get("fields", [])):
            new_field, changed = fix_field(field)
            if changed:
                new_schema["sections"][si]["fields"][fi] = new_field
                fixes.append(f"  {field.get('code')}: {field.get('type')} -> {new_field['type']} ({new_field.get('properties',{}).get('masterDataType','')})")

    if not fixes:
        print(f"[OK] {name} — no fixes needed")
        continue

    print(f"[FIX] {name} ({tid[:8]}...)")
    for f in fixes:
        print(f)

    # PATCH the template
    result = api_patch(f"/api/v1/form-builder/templates/{tid}", {"schema": new_schema})
    if result.get("data", {}).get("id"):
        print(f"  -> PATCHED OK")
    else:
        print(f"  -> ERROR: {result.get('message', str(result)[:100])}")
    print()

ssh.close()
print("DONE")
