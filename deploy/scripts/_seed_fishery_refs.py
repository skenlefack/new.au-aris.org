"""Seed 48 fishery referentials on production via single SSH command."""
import paramiko, json, sys

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

ALL_REFS = [
    {"category":"GEAR_TYPE","code":"GILLNET","name":{"en":"Gillnet","fr":"Filet maillant"},"faoCode":"07.0.0","sortOrder":1},
    {"category":"GEAR_TYPE","code":"SEINE","name":{"en":"Seine net","fr":"Senne"},"faoCode":"02.0.0","sortOrder":2},
    {"category":"GEAR_TYPE","code":"TRAWL","name":{"en":"Trawl","fr":"Chalut"},"faoCode":"03.0.0","sortOrder":3},
    {"category":"GEAR_TYPE","code":"LONGLINE","name":{"en":"Longline","fr":"Palangre"},"faoCode":"09.3.0","sortOrder":4},
    {"category":"GEAR_TYPE","code":"TRAP","name":{"en":"Trap","fr":"Nasse / Casier"},"faoCode":"08.0.0","sortOrder":5},
    {"category":"GEAR_TYPE","code":"CAST_NET","name":{"en":"Cast net","fr":"Epervier"},"faoCode":"04.0.0","sortOrder":6},
    {"category":"GEAR_TYPE","code":"BEACH_SEINE","name":{"en":"Beach seine","fr":"Senne de plage"},"faoCode":"02.1.0","sortOrder":7},
    {"category":"GEAR_TYPE","code":"PURSE_SEINE","name":{"en":"Purse seine","fr":"Senne coulissante"},"faoCode":"02.2.0","sortOrder":8},
    {"category":"GEAR_TYPE","code":"DREDGE","name":{"en":"Dredge","fr":"Drague"},"faoCode":"06.0.0","sortOrder":9},
    {"category":"GEAR_TYPE","code":"HOOK_LINE","name":{"en":"Hook and line","fr":"Ligne et hamecon"},"faoCode":"09.0.0","sortOrder":10},
    {"category":"VESSEL_TYPE","code":"ARTISANAL","name":{"en":"Artisanal canoe / pirogue","fr":"Pirogue artisanale"},"sortOrder":1},
    {"category":"VESSEL_TYPE","code":"SEMI_INDUSTRIAL","name":{"en":"Semi-industrial vessel","fr":"Navire semi-industriel"},"sortOrder":2},
    {"category":"VESSEL_TYPE","code":"INDUSTRIAL","name":{"en":"Industrial vessel","fr":"Navire industriel"},"sortOrder":3},
    {"category":"VESSEL_TYPE","code":"TRAWLER","name":{"en":"Trawler","fr":"Chalutier"},"sortOrder":4},
    {"category":"VESSEL_TYPE","code":"PURSE_SEINER","name":{"en":"Purse seiner","fr":"Senneur"},"sortOrder":5},
    {"category":"VESSEL_TYPE","code":"LONGLINER","name":{"en":"Longliner","fr":"Palangrier"},"sortOrder":6},
    {"category":"VESSEL_TYPE","code":"GILLNETTER","name":{"en":"Gillnetter","fr":"Fileyeur"},"sortOrder":7},
    {"category":"FARM_TYPE","code":"POND","name":{"en":"Pond","fr":"Etang"},"sortOrder":1},
    {"category":"FARM_TYPE","code":"CAGE","name":{"en":"Cage","fr":"Cage flottante"},"sortOrder":2},
    {"category":"FARM_TYPE","code":"RACEWAY","name":{"en":"Raceway","fr":"Raceway / Canal"},"sortOrder":3},
    {"category":"FARM_TYPE","code":"TANK","name":{"en":"Tank","fr":"Bassin / Bac"},"sortOrder":4},
    {"category":"FARM_TYPE","code":"RAS","name":{"en":"Recirculating aquaculture system (RAS)","fr":"Systeme aquacole en recirculation (RAS)"},"sortOrder":5},
    {"category":"FARM_TYPE","code":"PEN","name":{"en":"Pen / Enclosure","fr":"Enclos"},"sortOrder":6},
    {"category":"CULTURE_METHOD","code":"POND_CULTURE","name":{"en":"Pond culture","fr":"Pisciculture en etang"},"sortOrder":1},
    {"category":"CULTURE_METHOD","code":"CAGE_CULTURE","name":{"en":"Cage culture","fr":"Elevage en cage"},"sortOrder":2},
    {"category":"CULTURE_METHOD","code":"RACEWAY_CULTURE","name":{"en":"Raceway culture","fr":"Elevage en raceway"},"sortOrder":3},
    {"category":"CULTURE_METHOD","code":"RAS_CULTURE","name":{"en":"RAS culture","fr":"Elevage en RAS"},"sortOrder":4},
    {"category":"CULTURE_METHOD","code":"PEN_CULTURE","name":{"en":"Pen culture","fr":"Elevage en enclos"},"sortOrder":5},
    {"category":"CULTURE_METHOD","code":"INTEGRATED","name":{"en":"Integrated aquaculture","fr":"Aquaculture integree"},"sortOrder":6},
    {"category":"FISHING_AREA","code":"01","name":{"en":"Africa - Inland waters","fr":"Afrique - Eaux interieures"},"faoCode":"01","sortOrder":1},
    {"category":"FISHING_AREA","code":"34","name":{"en":"Atlantic, Eastern Central","fr":"Atlantique, Centre-Est"},"faoCode":"34","sortOrder":2},
    {"category":"FISHING_AREA","code":"47","name":{"en":"Atlantic, Southeast","fr":"Atlantique, Sud-Est"},"faoCode":"47","sortOrder":3},
    {"category":"FISHING_AREA","code":"51","name":{"en":"Indian Ocean, Western","fr":"Ocean Indien, Ouest"},"faoCode":"51","sortOrder":4},
    {"category":"FISHING_AREA","code":"57","name":{"en":"Indian Ocean, Eastern","fr":"Ocean Indien, Est"},"faoCode":"57","sortOrder":5},
    {"category":"FISHING_AREA","code":"37","name":{"en":"Mediterranean and Black Sea","fr":"Mediterranee et Mer Noire"},"faoCode":"37","sortOrder":6},
    {"category":"FISH_CATEGORY","code":"FINFISH","name":{"en":"Finfish","fr":"Poissons"},"sortOrder":1},
    {"category":"FISH_CATEGORY","code":"CRUSTACEAN","name":{"en":"Crustacean","fr":"Crustace"},"sortOrder":2},
    {"category":"FISH_CATEGORY","code":"MOLLUSC","name":{"en":"Mollusc","fr":"Mollusque"},"sortOrder":3},
    {"category":"FISH_CATEGORY","code":"AQUATIC_PLANT","name":{"en":"Aquatic plant / Seaweed","fr":"Plante aquatique / Algue"},"sortOrder":4},
    {"category":"FISH_CATEGORY","code":"CEPHALOPOD","name":{"en":"Cephalopod","fr":"Cephalopode"},"sortOrder":5},
    {"category":"PRODUCT_STATE","code":"LIVE","name":{"en":"Live","fr":"Vivant"},"sortOrder":1},
    {"category":"PRODUCT_STATE","code":"FRESH","name":{"en":"Fresh","fr":"Frais"},"sortOrder":2},
    {"category":"PRODUCT_STATE","code":"FROZEN","name":{"en":"Frozen","fr":"Congele"},"sortOrder":3},
    {"category":"PRODUCT_STATE","code":"DRIED","name":{"en":"Dried","fr":"Seche"},"sortOrder":4},
    {"category":"PRODUCT_STATE","code":"SMOKED","name":{"en":"Smoked","fr":"Fume"},"sortOrder":5},
    {"category":"PRODUCT_STATE","code":"CANNED","name":{"en":"Canned","fr":"En conserve"},"sortOrder":6},
    {"category":"PRODUCT_STATE","code":"SALTED","name":{"en":"Salted","fr":"Sale"},"sortOrder":7},
    {"category":"PRODUCT_STATE","code":"FILLETED","name":{"en":"Filleted","fr":"En filets"},"sortOrder":8},
]

# Build a single bash script that runs all 48 curls sequentially
lines = ['#!/bin/bash', f'TOKEN="{token}"', 'OK=0; ERR=0']
for ref in ALL_REFS:
    escaped = json.dumps(ref).replace("'", "'\\''")
    lines.append(
        f"RES=$(curl -sk -X POST 'https://localhost/api/v1/master-data/fishery-referentials' "
        f"-H 'Authorization: Bearer '$TOKEN -H 'Content-Type: application/json' "
        f"-d '{escaped}' 2>/dev/null)"
    )
    lines.append(f'echo "{ref["category"]}/{ref["code"]}: $RES" | head -c 120')
    lines.append('echo ""')
    lines.append('if echo "$RES" | grep -q \'"id"\'; then OK=$((OK+1)); else ERR=$((ERR+1)); fi')

lines.append('echo "=== OK=$OK ERR=$ERR ==="')
script = '\n'.join(lines)

print(f"Executing batch seed ({len(ALL_REFS)} items)...\n")
_, stdout, stderr = ssh.exec_command(f"bash -c '{script.replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'", timeout=120)

# Simpler: write script to temp file
import tempfile, os
chan = ssh.get_transport().open_session()
chan.settimeout(120)
chan.exec_command("cat > /tmp/_seed_refs.sh && bash /tmp/_seed_refs.sh")
chan.sendall(script.encode())
chan.shutdown_write()

output = b''
import time
for _ in range(240):
    if chan.recv_ready():
        output += chan.recv(8192)
    elif chan.exit_status_ready():
        while chan.recv_ready():
            output += chan.recv(8192)
        break
    time.sleep(0.5)

lines_out = output.decode(errors='replace').split('\n')
for line in lines_out[-55:]:
    if line.strip():
        print(f"  {line.strip()[:120]}")

ssh.close()
print("\nDONE")
