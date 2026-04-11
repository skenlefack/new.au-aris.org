"""Seed 48 fishery referentials via direct SQL on VM-DB."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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

# Build SQL
values = []
for r in ALL_REFS:
    name_json = json.dumps(r["name"]).replace("'", "''")
    fao = f"'{r['faoCode']}'" if r.get("faoCode") else "NULL"
    values.append(
        f"(gen_random_uuid(), '{r['category']}', '{r['code']}', "
        f"'{name_json}'::jsonb, {fao}, {r['sortOrder']}, true, "
        f"'{{}}'::jsonb, now(), now())"
    )

sql = (
    "INSERT INTO public.fishery_referentials "
    "(id, category, code, name, fao_code, sort_order, is_active, metadata, created_at, updated_at) "
    "VALUES\n" + ",\n".join(values) +
    "\nON CONFLICT (category, code) DO NOTHING;\n"
)

# Connect to DB VM
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting to VM-DB (10.202.101.185)...")
ssh.connect("10.202.101.185", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

# SFTP the SQL file
sftp = ssh.open_sftp()
with sftp.file("/tmp/seed_fishery_refs.sql", "w") as f:
    f.write(sql)
sftp.close()
print(f"SQL written ({len(ALL_REFS)} rows)")

# Execute
SUDO = "echo '@u-1baR.0rg$U24' | sudo -S"
_, stdout, stderr = ssh.exec_command(
    f"{SUDO} docker exec -i aris-postgres psql -U aris -d aris -f - < /tmp/seed_fishery_refs.sql 2>&1",
    timeout=30)
out = stdout.read().decode(errors="replace").strip()
print(f"Result: {out}")

# Verify
_, stdout, _ = ssh.exec_command(
    f"{SUDO} docker exec aris-postgres psql -U aris -d aris "
    "-c 'SELECT category, count(*) FROM public.fishery_referentials GROUP BY 1 ORDER BY 1;' 2>/dev/null",
    timeout=15)
print(stdout.read().decode(errors="replace"))

ssh.close()
print("DONE")
