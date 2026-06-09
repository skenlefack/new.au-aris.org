#!/usr/bin/env python3
"""
Load realistic AFADATA data into ARIS campaigns as submissions.
Uses ARIS reference data (tenants, geo_entities, species) for coherence.
"""
import paramiko
import json
import sys
import os
import uuid
import hashlib
import random
import tempfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"
TENANT_AU = "00000000-0000-4000-a000-000000000001"
SUPER_ADMIN = "10000000-0000-4000-a000-000000000001"

random.seed(42)  # Reproducible

# ── Deterministic UUID ──
def det_uuid(ns, key):
    h = hashlib.sha256(f"afadata:{ns}:{key}".encode()).hexdigest()
    return str(uuid.UUID(h[:32]))

def campaign_uuid(key):
    return det_uuid("campaign", key)

# ── AFADATA reference data (aligned with form template select options) ──

# FAO fishing areas relevant to Africa
FAO_AREAS = [
    "34 - Atlantic EC", "47 - Atlantic SE", "51 - Indian Ocean W",
    "37 - Mediterranean", "57 - Indian Ocean E",
]

GEAR_TYPES = ["Trawl", "Gillnet", "Longline", "Purse Seine", "Hook and Line", "Cast Net", "Trap"]
FISHING_ENV = ["Marine", "Freshwater", "Brackish"]
PRODUCTION_TYPE = ["Industrial", "Semi-industrial", "Artisanal", "Subsistence"]
VESSEL_TYPES = ["Trawler", "Seiner", "Longliner", "Artisanal", "Other"]
FARM_TYPES = ["Pond", "Cage", "Raceway", "Tank/RAS", "Pen"]
WATER_SOURCES = ["Freshwater", "Marine", "Brackish"]
CULTURE_METHODS = ["Extensive", "Semi-intensive", "Intensive"]
EFFORT_TYPES = ["Days at Sea", "Fishing Hours", "Number of Trips", "Number of Hauls"]
FLOW_DIRECTIONS = ["Export", "Import", "Re-export"]
PRODUCT_STATES = ["Fresh", "Frozen", "Dried", "Salted", "Smoked", "Canned", "Live"]
COMMODITY_GROUPS = [
    "Fish (fresh/chilled)", "Fish (frozen)", "Fish (dried/salted/smoked)",
    "Crustaceans", "Molluscs", "Fish Meal / Oil", "Live Fish",
]

# Aquatic species (FAO 3-alpha codes) — top African species
AQUATIC_SPECIES = [
    {"code": "TIL", "en": "Nile Tilapia", "fr": "Tilapia du Nil", "scientific": "Oreochromis niloticus"},
    {"code": "YFT", "en": "Yellowfin Tuna", "fr": "Thon albacore", "scientific": "Thunnus albacares"},
    {"code": "SKJ", "en": "Skipjack Tuna", "fr": "Bonite à ventre rayé", "scientific": "Katsuwonus pelamis"},
    {"code": "SAR", "en": "Sardine", "fr": "Sardine", "scientific": "Sardina pilchardus"},
    {"code": "CLU", "en": "Clupeid", "fr": "Clupéidé", "scientific": "Clupeidae"},
    {"code": "PEN", "en": "Penaeid Shrimp", "fr": "Crevette pénéide", "scientific": "Penaeus spp."},
    {"code": "CTF", "en": "Catfish", "fr": "Poisson-chat", "scientific": "Clarias gariepinus"},
    {"code": "LAT", "en": "Nile Perch", "fr": "Perche du Nil", "scientific": "Lates niloticus"},
    {"code": "OCT", "en": "Octopus", "fr": "Poulpe", "scientific": "Octopus vulgaris"},
    {"code": "LOB", "en": "Lobster", "fr": "Langouste", "scientific": "Palinurus spp."},
    {"code": "MUL", "en": "Mullet", "fr": "Mulet", "scientific": "Mugil cephalus"},
    {"code": "MAC", "en": "Mackerel", "fr": "Maquereau", "scientific": "Scomber japonicus"},
    {"code": "SWO", "en": "Swordfish", "fr": "Espadon", "scientific": "Xiphias gladius"},
    {"code": "CAR", "en": "Carp", "fr": "Carpe", "scientific": "Cyprinus carpio"},
    {"code": "OYS", "en": "Oyster", "fr": "Huître", "scientific": "Crassostrea gigas"},
]

# Countries with significant fisheries (ISO2 code + typical data profile)
FISH_COUNTRIES = {
    "KE": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (8000, 15000), "vessels": (200, 400), "farms": (50, 120), "efforts": (100, 300)},
    "TZ": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (10000, 20000), "vessels": (300, 600), "farms": (40, 100), "efforts": (150, 400)},
    "NG": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (15000, 30000), "vessels": (500, 1000), "farms": (100, 250), "efforts": (200, 500)},
    "SN": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (12000, 25000), "vessels": (400, 800), "farms": (30, 80), "efforts": (150, 350)},
    "GH": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (8000, 18000), "vessels": (250, 500), "farms": (40, 90), "efforts": (120, 300)},
    "MZ": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (5000, 12000), "vessels": (150, 300), "farms": (20, 60), "efforts": (80, 200)},
    "MG": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (6000, 14000), "vessels": (200, 400), "farms": (30, 70), "efforts": (100, 250)},
    "EG": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (10000, 22000), "vessels": (350, 700), "farms": (80, 200), "efforts": (150, 350)},
    "MA": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (15000, 30000), "vessels": (500, 900), "farms": (50, 120), "efforts": (200, 450)},
    "NA": {"coast": True,  "lake": False, "aqua": False, "captures_yr": (4000, 10000), "vessels": (100, 250), "farms": (5, 15), "efforts": (60, 150)},
    "SC": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (3000, 8000), "vessels": (80, 180), "farms": (10, 30), "efforts": (50, 120)},
    "ZA": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (8000, 16000), "vessels": (200, 450), "farms": (40, 100), "efforts": (100, 250)},
    "MU": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (2000, 6000), "vessels": (60, 140), "farms": (15, 40), "efforts": (40, 100)},
    "UG": {"coast": False, "lake": True,  "aqua": True,  "captures_yr": (5000, 12000), "vessels": (100, 250), "farms": (30, 80), "efforts": (80, 200)},
    "CM": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (4000, 10000), "vessels": (120, 280), "farms": (25, 60), "efforts": (70, 180)},
    "CI": {"coast": True,  "lake": True,  "aqua": True,  "captures_yr": (3000, 8000), "vessels": (100, 220), "farms": (20, 50), "efforts": (60, 150)},
    "AO": {"coast": True,  "lake": False, "aqua": False, "captures_yr": (5000, 12000), "vessels": (150, 350), "farms": (10, 25), "efforts": (80, 200)},
    "TN": {"coast": True,  "lake": False, "aqua": True,  "captures_yr": (5000, 12000), "vessels": (200, 400), "farms": (30, 70), "efforts": (100, 250)},
    "GM": {"coast": True,  "lake": False, "aqua": False, "captures_yr": (1000, 4000), "vessels": (50, 120), "farms": (5, 15), "efforts": (30, 80)},
    "DJ": {"coast": True,  "lake": False, "aqua": False, "captures_yr": (500, 2000), "vessels": (30, 80), "farms": (2, 8), "efforts": (20, 60)},
}

YEARS = list(range(2015, 2026))  # 2015-2025

LANDING_SITES = {
    "KE": ["Mombasa", "Kisumu", "Lamu", "Malindi"],
    "TZ": ["Dar es Salaam", "Zanzibar", "Mwanza", "Bagamoyo"],
    "NG": ["Lagos", "Port Harcourt", "Calabar", "Warri"],
    "SN": ["Dakar", "Saint-Louis", "Ziguinchor", "Mbour"],
    "GH": ["Tema", "Elmina", "Sekondi", "Cape Coast"],
    "MZ": ["Maputo", "Beira", "Pemba", "Inhambane"],
    "MG": ["Antananarivo", "Mahajanga", "Toamasina", "Nosy Be"],
    "EG": ["Alexandria", "Suez", "Port Said", "Damietta"],
    "MA": ["Casablanca", "Agadir", "Safi", "Tan-Tan"],
}

PORTS = {
    "KE": ["Mombasa Port", "Shimoni", "Lamu Harbor"],
    "TZ": ["Dar es Salaam Port", "Zanzibar Port", "Kilwa"],
    "NG": ["Apapa Wharf", "Tin Can Island", "Onne Port"],
    "SN": ["Port de Dakar", "Port de Saint-Louis"],
    "GH": ["Tema Port", "Takoradi Port"],
}


def gen_captures(country, profile, tenant_id, campaign_id, template_id):
    """Generate capture fisheries submissions for a country."""
    subs = []
    species_pool = AQUATIC_SPECIES[:10] if profile["coast"] else [s for s in AQUATIC_SPECIES if s["code"] in ("TIL", "CTF", "LAT", "CAR", "CLU")]
    sites = LANDING_SITES.get(country, [f"Port-{country}"])
    lo, hi = profile["captures_yr"]

    for year in YEARS:
        n = random.randint(3, 8)  # submissions per year
        for i in range(n):
            sp = random.choice(species_pool)
            month = random.randint(1, 12)
            day = random.randint(1, 28)
            qty = round(random.uniform(lo / 20, hi / 8), 1)
            data = {
                "adm0": country,
                "species": sp["code"],
                "species_name": sp["en"],
                "fao_area_code": random.choice(FAO_AREAS) if profile["coast"] else "01 - Inland waters",
                "gear_type": random.choice(GEAR_TYPES),
                "quantity_kg": qty,
                "capture_date": f"{year}-{month:02d}-{day:02d}",
                "landing_site": random.choice(sites),
                "fishing_environment": "Marine" if profile["coast"] and random.random() > 0.3 else ("Freshwater" if profile.get("lake") else "Brackish"),
                "production_type": random.choice(PRODUCTION_TYPE),
            }
            if random.random() > 0.6:
                data["vessel_name"] = f"{country}-V{random.randint(100,999)}"
            sub_id = det_uuid("cap", f"{country}-{year}-{i}")
            subs.append((sub_id, tenant_id, campaign_id, template_id, data, f"{year}-{month:02d}-{day:02d}"))
    return subs


def gen_vessels(country, profile, tenant_id, campaign_id, template_id):
    subs = []
    lo, hi = profile["vessels"]
    n = random.randint(lo // 20, hi // 15)
    for i in range(n):
        vtype = random.choice(VESSEL_TYPES)
        data = {
            "adm0": country,
            "vessel_name": f"{country}-{vtype[:3].upper()}-{random.randint(100,999)}",
            "registration_number": f"REG-{country}-{random.randint(10000,99999)}",
            "vessel_type": vtype,
            "length_meters": round(random.uniform(4, 35 if vtype != "Artisanal" else 12), 1),
            "tonnage_gt": round(random.uniform(2, 200 if vtype != "Artisanal" else 15), 1),
            "engine_power_kw": round(random.uniform(10, 500 if vtype != "Artisanal" else 40), 0),
            "crew_capacity": random.randint(2, 20 if vtype != "Artisanal" else 6),
            "owner_name": f"Owner-{country}-{i}",
            "home_port": random.choice(PORTS.get(country, [f"Port-{country}"])),
            "license_number": f"LIC-{country}-{random.randint(1000,9999)}" if random.random() > 0.3 else "",
            "is_active": "Yes" if random.random() > 0.15 else "No",
        }
        sub_id = det_uuid("ves", f"{country}-{i}")
        subs.append((sub_id, tenant_id, campaign_id, template_id, data, "2025-01-01"))
    return subs


def gen_farms(country, profile, tenant_id, campaign_id, template_id):
    subs = []
    if not profile["aqua"]:
        return subs
    lo, hi = profile["farms"]
    n = random.randint(lo // 5, hi // 4)
    for i in range(n):
        ftype = random.choice(FARM_TYPES)
        workers = random.randint(2, 30)
        data = {
            "adm0": country,
            "farm_name": f"Farm-{country}-{i+1:03d}",
            "farm_type": ftype,
            "water_source": random.choice(WATER_SOURCES),
            "area_hectares": round(random.uniform(0.5, 50), 1),
            "production_capacity_tonnes": round(random.uniform(1, 200), 1),
            "main_species": random.choice(["TIL", "CTF", "CAR", "PEN"]),
            "owner_name": f"FarmOwner-{country}-{i}",
            "registration_number": f"FARM-{country}-{random.randint(100,999)}",
            "total_workers": workers,
            "male_workers": int(workers * random.uniform(0.5, 0.8)),
            "female_workers": workers - int(workers * random.uniform(0.5, 0.8)),
            "pond_count": random.randint(1, 20),
            "is_active": "Yes" if random.random() > 0.1 else "No",
        }
        sub_id = det_uuid("farm", f"{country}-{i}")
        subs.append((sub_id, tenant_id, campaign_id, template_id, data, "2025-01-01"))
    return subs


def gen_aquaculture(country, profile, tenant_id, campaign_id, template_id):
    subs = []
    if not profile["aqua"]:
        return subs
    for year in YEARS:
        n = random.randint(2, 6)
        for i in range(n):
            sp = random.choice([s for s in AQUATIC_SPECIES if s["code"] in ("TIL", "CTF", "CAR", "PEN", "OYS")])
            month = random.randint(1, 12)
            qty = round(random.uniform(500, 15000), 1)
            data = {
                "adm0": country,
                "farm_name": f"Farm-{country}-{random.randint(1,20):03d}",
                "species": sp["code"],
                "species_name": sp["en"],
                "quantity_kg": qty,
                "harvest_date": f"{year}-{month:02d}-{random.randint(1,28):02d}",
                "method_of_culture": random.choice(CULTURE_METHODS),
                "feed_used_kg": round(qty * random.uniform(1.2, 2.0), 1),
                "fcr": round(random.uniform(1.2, 2.5), 2),
                "stocking_date": f"{year-1 if month < 6 else year}-{random.randint(1,12):02d}-01",
                "survival_rate": round(random.uniform(60, 95), 1),
                "avg_harvest_weight_g": round(random.uniform(150, 800), 0),
            }
            sub_id = det_uuid("aqua", f"{country}-{year}-{i}")
            subs.append((sub_id, tenant_id, campaign_id, template_id, data, f"{year}-{month:02d}-15"))
    return subs


def gen_efforts(country, profile, tenant_id, campaign_id, template_id):
    subs = []
    lo, hi = profile["efforts"]
    for year in YEARS:
        n = random.randint(2, 5)
        for i in range(n):
            etype = random.choice(EFFORT_TYPES)
            month = random.randint(1, 12)
            data = {
                "adm0": country,
                "effort_type": etype,
                "effort_value": round(random.uniform(10, 500), 1),
                "effort_unit": "days" if "Days" in etype else "hours" if "Hours" in etype else "trips",
                "gear_type": random.choice(GEAR_TYPES),
                "crew_size": random.randint(2, 15),
                "vessel_name": f"{country}-V{random.randint(100,999)}",
                "fao_area_code": random.choice(FAO_AREAS) if profile["coast"] else "01 - Inland",
                "start_date": f"{year}-{month:02d}-01",
                "end_date": f"{year}-{month:02d}-28",
            }
            sub_id = det_uuid("eff", f"{country}-{year}-{i}")
            subs.append((sub_id, tenant_id, campaign_id, template_id, data, f"{year}-{month:02d}-15"))
    return subs


def gen_trades(country, profile, tenant_id, campaign_id, template_id):
    subs = []
    if not profile["coast"]:
        return subs
    partners = [c for c in FISH_COUNTRIES if c != country]
    for year in YEARS:
        n = random.randint(2, 6)
        for i in range(n):
            direction = random.choice(FLOW_DIRECTIONS[:2])
            partner = random.choice(partners)
            sp = random.choice(AQUATIC_SPECIES[:8])
            qty = round(random.uniform(50, 5000), 1)
            data = {
                "adm0": country,
                "flow_direction": direction,
                "export_country": country if direction == "Export" else partner,
                "import_country": partner if direction == "Export" else country,
                "species": sp["code"],
                "species_name": sp["en"],
                "commodity": f"{sp['en']} ({random.choice(PRODUCT_STATES)})",
                "commodity_group": random.choice(COMMODITY_GROUPS),
                "product_state": random.choice(PRODUCT_STATES),
                "quantity": qty,
                "value_fob_usd": round(qty * random.uniform(1.5, 12), 2),
                "hs_code": f"03{random.randint(1,9):01d}{random.randint(10,99)}",
                "period_start": f"{year}-01-01",
                "period_end": f"{year}-12-31",
            }
            sub_id = det_uuid("trd", f"{country}-{year}-{i}")
            subs.append((sub_id, tenant_id, campaign_id, template_id, data, f"{year}-06-15"))
    return subs


# ── Campaign key → generator + campaign UUID mapping ──
GENERATORS = {
    "captures": gen_captures,
    "vessels": gen_vessels,
    "farms": gen_farms,
    "aquaculture": gen_aquaculture,
    "efforts": gen_efforts,
    "trades": gen_trades,
}

TEMPLATE_NAMES = {
    "captures": "Capture Fisheries Report",
    "vessels": "Fishing Vessel Registration",
    "farms": "Aquaculture Farm Registration",
    "aquaculture": "Aquaculture Production Report",
    "efforts": "Fishing Effort Report",
    "trades": "Fish Trade Report",
}


def build_insert_sql(subs):
    """Build SQL INSERT for a batch of submissions."""
    if not subs:
        return ""
    lines = ["BEGIN;"]
    for sub_id, tenant_id, campaign_id, template_id, data, submitted_at in subs:
        data_json = json.dumps(data, ensure_ascii=False).replace("'", "''")
        lines.append(
            f"INSERT INTO submissions (id, tenant_id, campaign_id, template_id, data, "
            f"submitted_by, submitted_at, status, data_classification, version, created_at, updated_at) "
            f"VALUES ('{sub_id}', '{tenant_id}', '{campaign_id}', '{template_id}', "
            f"'{data_json}'::jsonb, '{SUPER_ADMIN}', '{submitted_at}'::timestamptz, "
            f"'VALIDATED', 'PARTNER', 1, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
        )
    lines.append("COMMIT;")
    return "\n".join(lines)


def main():
    print("=" * 60)
    print("  LOAD AFADATA DATA INTO ARIS CAMPAIGNS")
    print("=" * 60)

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print(f"\n{'='*60}")
        print(f"  {env}")
        print(f"{'='*60}")

        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username="arisadmin", password=SSH_PASS, timeout=15)

        # Get tenant mapping (ISO2 → tenant UUID)
        ch = c.get_transport().open_session()
        ch.settimeout(15)
        ch.exec_command(
            f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
            f"-e PGPASSWORD={db_pass} postgres:16 "
            f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c "
            f"\"SELECT code, id FROM tenants WHERE level = 'MEMBER_STATE'\""
        )
        o = b""
        try:
            while True:
                d = ch.recv(4096)
                if not d: break
                o += d
        except: pass
        tenant_map = {}
        for line in o.decode(errors="replace").strip().split("\n"):
            if "|" in line:
                parts = line.split("|")
                tenant_map[parts[0].strip()] = parts[1].strip()

        # Get template IDs
        template_map = {}
        for key, tpl_name in TEMPLATE_NAMES.items():
            ch = c.get_transport().open_session()
            ch.settimeout(15)
            ch.exec_command(
                f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
                f"-e PGPASSWORD={db_pass} postgres:16 "
                f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c "
                f"\"SELECT id FROM form_builder.form_templates WHERE name::text ILIKE '%{tpl_name}%' AND status = 'PUBLISHED' LIMIT 1\""
            )
            o = b""
            try:
                while True:
                    d = ch.recv(4096)
                    if not d: break
                    o += d
            except: pass
            lines = [l.strip() for l in o.decode(errors="replace").strip().split("\n") if len(l.strip()) == 36]
            template_map[key] = lines[-1] if lines else None

        print(f"  Tenants: {len(tenant_map)} countries")
        print(f"  Templates: {sum(1 for v in template_map.values() if v)}/6 found")

        # Generate and load data for each campaign
        grand_total = 0
        for key, gen_fn in GENERATORS.items():
            cid = campaign_uuid(key)
            tpl_id = template_map.get(key)
            if not tpl_id:
                print(f"\n  SKIP {key}: no template")
                continue

            print(f"\n  --- {key.upper()} ---")
            all_subs = []
            for country_code, profile in FISH_COUNTRIES.items():
                tenant_id = tenant_map.get(country_code, TENANT_AU)
                subs = gen_fn(country_code, profile, tenant_id, cid, tpl_id)
                all_subs.extend(subs)

            print(f"  Generated: {len(all_subs)} submissions across {len(FISH_COUNTRIES)} countries")

            # Insert in batches
            BATCH = 500
            inserted = 0
            for start in range(0, len(all_subs), BATCH):
                batch = all_subs[start:start + BATCH]
                sql = build_insert_sql(batch)
                tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
                tmp.write(sql)
                tmp.close()
                sftp = c.open_sftp()
                sftp.put(tmp.name, "/tmp/afadata_batch.sql")
                sftp.close()
                os.unlink(tmp.name)

                ch = c.get_transport().open_session()
                ch.settimeout(60)
                ch.exec_command(
                    f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
                    f"-v /tmp/afadata_batch.sql:/d.sql:ro "
                    f"-e PGPASSWORD={db_pass} postgres:16 "
                    f"psql -h {db_host} -p 5432 -U aris -d aris -f /d.sql 2>&1 | grep -c 'INSERT 0 1'"
                )
                o = b""
                try:
                    while True:
                        d = ch.recv(4096)
                        if not d: break
                        o += d
                except: pass
                try:
                    n = int(o.decode(errors="replace").strip().split("\n")[-1])
                except:
                    n = len(batch)
                inserted += n

            print(f"  Inserted: {inserted}")
            grand_total += inserted

        # Final verify
        print(f"\n  --- SUMMARY ---")
        for key in GENERATORS:
            cid = campaign_uuid(key)
            ch = c.get_transport().open_session()
            ch.settimeout(15)
            ch.exec_command(
                f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
                f"-e PGPASSWORD={db_pass} postgres:16 "
                f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c "
                f"\"SELECT count(*) FROM submissions WHERE campaign_id = '{cid}'\""
            )
            o = b""
            try:
                while True:
                    d = ch.recv(4096)
                    if not d: break
                    o += d
            except: pass
            count = o.decode(errors="replace").strip().split("\n")[-1].strip()
            print(f"  {key:>15}: {count:>6} submissions")

        print(f"\n  TOTAL: {grand_total} submissions loaded on {env}")
        c.close()

    print(f"\n{'='*60}")
    print("  DONE")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
