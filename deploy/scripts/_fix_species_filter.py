"""Fix species parentFilter: change category=AQUATIC to groupId=<UUID>."""
import paramiko, json, sys, time, copy

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AQUATIC_GROUP_ID = "10000000-0000-4000-b000-000000000007"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

# Auth
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated\n")


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


# Get all v2 PUBLISHED fisheries templates
_, stdout, _ = ssh.exec_command(
    f'curl -sk "https://localhost/api/v1/form-builder/templates?domain=fisheries&limit=30&status=PUBLISHED" '
    f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=15)
templates = [t for t in json.loads(stdout.read().decode()).get("data", []) if t.get("version") == 2]

print(f"Found {len(templates)} v2 templates\n")

for t in templates:
    tid = t["id"]
    name = t["name"]
    schema = t.get("schema", {})
    new_schema = copy.deepcopy(schema)
    fixed = []

    for si, sec in enumerate(new_schema.get("sections", [])):
        for fi, field in enumerate(sec.get("fields", [])):
            code = field.get("code", "")
            ftype = field.get("type", "")
            props = field.get("properties", {})

            if ftype == "master-data-select" and props.get("masterDataType") == "species":
                pf = props.get("parentFilter", {})
                if pf.get("category") == "AQUATIC" or not pf.get("groupId"):
                    props["parentFilter"] = {"groupId": AQUATIC_GROUP_ID}
                    field["properties"] = props
                    new_schema["sections"][si]["fields"][fi] = field
                    fixed.append(code)

    if not fixed:
        print(f"  [OK] {name}")
        continue

    print(f"  [FIX] {name} — fields: {', '.join(fixed)}")
    result = api_patch(f"/api/v1/form-builder/templates/{tid}", {"schema": new_schema})
    if result.get("data", {}).get("id"):
        new_tid = result["data"]["id"]
        # Publish the v3
        _, stdout, _ = ssh.exec_command(
            f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates/{new_tid}/publish" '
            f'-H "Authorization: Bearer {token}" '
            f'-H "Content-Type: application/json" -d "{{}}" 2>/dev/null', timeout=15)
        r = json.loads(stdout.read().decode())
        print(f"    -> v{r.get('data',{}).get('version','?')} {r.get('data',{}).get('status','?')}")
    else:
        print(f"    -> ERROR: {result.get('message', '')[:80]}")

ssh.close()
print("\nDONE")
