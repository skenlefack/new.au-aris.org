#!/usr/bin/env python3
"""
ARIS 4.0 — Normalize disease column in Monthly Animal Health Reports
─────────────────────────────────────────────────────────────────────
Converts all textual disease names to their ref_diseases UUID.
Handles EN/FR names, codes, abbreviations, typos, and common variants.

Usage:
    python deploy/scripts/_normalize_historical_diseases.py --dry-run
    python deploy/scripts/_normalize_historical_diseases.py
    python deploy/scripts/_normalize_historical_diseases.py --env prod
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

SSH_USER = os.environ.get("ARIS_DEPLOY_USER", "arisadmin")
SSH_PASS = os.environ.get("ARIS_DEPLOY_PASS", "@u-1baR.0rg$U24")

ENV_CONFIG = {
    "prod": {"db_host": "10.202.101.185", "db_container": "aris-postgres"},
    "stg":  {"db_host": "10.202.101.148", "db_container": "aris-stg-postgres"},
}
DB_USER = "aris"
DB_PASS_MAP = {"prod": "Ar1s_Pr0d_2024!xK9mZ", "stg": "Ar1s_Stg_2024!xK9mZ"}

TABLE = "historical.hist_monthly_animal_health_reports_2008_2025_animal_health"

# ── UUID base ────────────────────────────────────────────────────────
UUID_PREFIX = "30000000-0000-4000-b000-"

def uid(n: int) -> str:
    return f"{UUID_PREFIX}{n:012d}"

# ── Comprehensive text → UUID mapping ────────────────────────────────
# Built from: ref_diseases codes (EN), French names, common typos/variants
# found in ARIS 3 data. Case-insensitive matching is done at runtime.
DISEASE_MAP: dict[str, str] = {}

def add(uuid: str, *aliases: str):
    for a in aliases:
        DISEASE_MAP[a.strip().lower()] = uuid

# 001 — Foot and Mouth Disease
add(uid(1), "FMD", "Foot and Mouth Disease", "Foot & Mouth Disease",
    "Foot-and-Mouth Disease", "FOOT-AND-MOUTH DISEASE (FMD)", "Fièvre Aphteuse",
    "Fievre Aphteuse", "fievre aphteuse", "FA", "FMDSAT1", "FMDSAT2", "FMDSAT3",
    "FMD-O", "FMD-A", "FMD SAT1", "FMD SAT2", "FMD SAT3", "FMD_SAT1", "FMD_SAT2",
    "Foot and mouth", "Foot & mouth", "foot and mouth disease",
    "Foot and Mouth disease", "foot & mouth disease", "Aphteuse")

# 002 — CBPP
add(uid(2), "CBPP", "Contagious Bovine Pleuropneumonia",
    "Contagious Bovine Pleuro-pneumonia", "Péripneumonie Contagieuse Bovine",
    "PERIPNEUMONIE CONTAGIEUSE BOVINE", "Péripneumonie contagieuse bovine",
    "Péripneumonie contagieuse", "Péripneumonie", "Peripneumonie Contagieuse Bovine",
    "Peripneumonie contagieuse bovine", "PERIPNEUMONIE CONTAGIEUSE",
    "Contagious Bovine Pleuro-Pneumonia", "contagious bovine pleuropneumonia",
    "contagieuse bovine")

# 003 — PPR
add(uid(3), "PPR", "Peste des Petits Ruminants", "Peste des petits ruminants",
    "Peste des Petits Ruminates", "Peste des Petit Ruminants",
    "Peste des petit ruminants", "Peste des Petit Ruminantis",
    "Pest des petits ruminants", "Pest Des Pettit Ruminant",
    "Pest Des Petit Ruminant", "Peste de petit ruminant",
    "Pestes des Petite Ruminantes", "Pestes des Petits Ruminant",
    "Pestes des Petits Ruminantes", "Pestes de petite ruminant",
    "Peste des Petis Ruminant (PPR)", "Peste des petits ruminant",
    "Peste de Petit ruminant", "Peste de petit ruminat",
    "PEST DES PETITS RUMINANTS", "Peste des petit ruminants,CCPP(tentative)",
    "Peste des pettits ruminants", "Peste petits", "Peste des petits",
    "Peste des Petits Ruminantes", "PPR KATA",
    "peste des petits ruminants")

# 004 — ASF
add(uid(4), "ASF", "African Swine Fever", "Peste Porcine Africaine",
    "african swine fever", "Peste porcine africaine", "PPA")

# 005 — HPAI
add(uid(5), "HPAI", "Highly Pathogenic Avian Influenza",
    "Influenza Aviaire Hautement Pathogène", "Avian Influenza",
    "Avia Influenza", "Avian influenza", "AVIAN INFLUENZA",
    "Grippe aviaire", "LPAI6", "hautement pathogène")

# 006 — RVF
add(uid(6), "RVF", "Rift Valley Fever", "Fièvre de la Vallée du Rift",
    "Riftvalley Fever", "Rift valley fever", "Fievre de la Vallee du Rift")

# 007 — LSD
add(uid(7), "LSD", "Lumpy Skin Disease", "Dermatose Nodulaire",
    "Dermatose nodulaire contagieuse bovine", "Dermatose Nodulaire Contagieuse",
    "Lumpy skin disease", "lumpy skin disease", "LUMPY SKIN DISEASE",
    "Lumbyskin", "L.S.D", "Lumpy skin", "Dermatose nodulaire")

# 008 — Rabies
add(uid(8), "RABIES", "Rabies", "Rage", "rabies", "rage",
    "Rage canine", "rage canine", "RAGE", "canine rabies", "Rabies virus",
    "Infection with rabies virus")

# 009 — Anthrax
add(uid(9), "ANTHRAX", "Anthrax", "Charbon Bactéridien", "anthrax",
    "Charbon bacteridien", "CHARBON", "Charbon", "charbon")

# 010 — Brucellosis
add(uid(10), "BRUCELLA", "Brucellosis", "Brucellose", "brucellosis",
    "BRUCELLOSIS", "Brucella", "brucella", "Bovine brucelosis",
    "Bovine Brucelosis", "BOVINE BRUCELLOSIS", "Bovine brucellosis",
    "CAPRINE BRUCELLOSIS", "Bov. Brucellosis", "COBru", "PBru",
    "BRUC", "brucellose")

# 011 — Bovine Tuberculosis
add(uid(11), "TB", "Bovine Tuberculosis", "Tuberculose Bovine",
    "tuberculose bovine", "Tuberculosis", "tuberculosis",
    "Tuberculosebovine  (découverte  d'abattoirs)", "Tuberculoosis",
    "BOVINE TUBERCULOSIS")

# 012 — Newcastle Disease
add(uid(12), "ND", "Newcastle Disease", "Maladie de Newcastle",
    "New Castle Disease", "New Castle", "Newcastle disease Not typed",
    "Newcastle disease", "new castle disease", "NEWCASTLE DISEASE",
    "Newcastle     A160", "Maladie de Newcastle", "Newcastle",
    "New Castle disease", "Newcastle/Infectious bronchitis",
    "Maladie Newcastle", "Maladie de Newcaste", "NCD")

# 013 — East Coast Fever
add(uid(13), "ECF", "East Coast Fever", "Theilériose",
    "east coast fever", "East coast fever", "EAST COAST FEVER",
    "Thaileria Parva")

# 014 — Trypanosomosis
add(uid(14), "TRYP", "Trypanosomosis", "Trypanosomose",
    "trypanosomosis", "Trypanosomiasi", "Typanosomosis",
    "TRYPANOSOMIASIS", "TRYPANASOMIASIS", "Trypanosomiasis",
    "trypanosomiasis", "Trypanosomiase animale", "TRYP Total")

# 015 — Blackleg
add(uid(15), "BLACKLEG", "Blackleg", "Charbon Symptomatique",
    "blackleg", "BLACKQUARTER", "Blackquarter", "BlackQuarter",
    "Symptomatic Carbuncle", "charbon symptomatique")

# 016 — Sheep Pox
add(uid(16), "SHEEP_POX", "Sheep Pox", "Clavelée", "sheep pox",
    "SHEEP POX", "Sheep pox", "Variole ovine", "Clavelée", "Sheep/Goat pox",
    "sh- pox", "Shoatpox", "SHEEP  MANGE")

# 017 — Goat Pox
add(uid(17), "GOAT_POX", "Goat Pox", "Variole Caprine", "goat pox",
    "GOAT POX", "Goat pox", "Variole caprine")

# 018 — AHS
add(uid(18), "AHS", "African Horse Sickness", "Peste équine",
    "african horse sickness", "Peste equine", "Peste équine   A110")

# 019 — CCPP
add(uid(19), "CCPP", "Contagious Caprine Pleuropneumonia", "PPCC",
    "Contagious Caprine Pleuro-pneumonia",
    "contagious caprine pleuropneumonia", "CCPP",
    "Contagious caprine pleuropneumonia",
    "contagieuse caprine")

# 020 — Heartwater
add(uid(20), "HEARTWATER", "Heartwater", "Cowdriose", "heartwater",
    "HEARTWATER", "Cowdriose")

# 021 — Anaplasmosis
add(uid(21), "ANAPLASMOSIS", "Anaplasmosis", "Anaplasmose",
    "anaplasmosis", "Bov. Anaplasmosis", "ANAPLASMOSIS")

# 022 — Babesiosis
add(uid(22), "BABESIOSIS", "Babesiosis", "Babésiose", "babesiosis",
    "BABESIOSIS", "Babésiose bovine", "Piroplasmose", "piroplasmosis")

# 023 — Fasciolosis
add(uid(23), "FASCIOLOSIS", "Fasciolosis", "Fasciolose", "fasciolosis",
    "FASCIOLOSIS", "Distomatose", "LIVER FLUKE", "Liver Fluke",
    "Fascioasis", "Fasciolose")

# 024 — Mange
add(uid(24), "MANGE", "Mange", "Gale", "mange", "MANGE",
    "SHEEP & GOAT MANGE", "Scabies", "scabies", "Scrabies", "Gale")

# 025 — Mastitis
add(uid(25), "MASTITIS", "Mastitis", "Mammite", "mastitis",
    "MASTITIS", "Mammite contagieuse ovine")

# 026 — Bluetongue
add(uid(26), "BLUETONGUE", "Bluetongue", "Fièvre catarrhale du mouton",
    "bluetongue", "Blue tongue", "Fièvre Catarrhale Ovine",
    "Fievre Catarrhale Ovine", "FCO")

# 027 — Rinderpest
add(uid(27), "RINDERPEST", "Rinderpest", "Peste bovine", "rinderpest")

# 028 — CSF
add(uid(28), "CSF", "Classical Swine Fever", "Peste porcine classique",
    "classical swine fever", "Peste Porcine Classique")

# 029 — Dourine
add(uid(29), "DOURINE", "Dourine", "dourine", "DUR")

# 030 — Glanders
add(uid(30), "GLANDERS", "Glanders", "Morve", "glanders")

# 031 — Equine Influenza
add(uid(31), "EQUINE_INFLUENZA", "Equine Influenza", "Grippe équine",
    "equine influenza", "Grippe equine")

# 032 — Equine Infectious Anaemia
add(uid(32), "EQUINE_INFECTIOUS_ANAEMIA", "Equine Infectious Anaemia",
    "Anémie infectieuse des équidés", "EIA")

# 033 — Equine Piroplasmosis
add(uid(33), "EQUINE_PIROPLASMOSIS", "Equine Piroplasmosis",
    "Piroplasmose équine", "Canine Piroplasmosis")

# 034 — Equine Rhinopneumonitis
add(uid(34), "EQUINE_RHINOPNEUMONITIS", "Equine Rhinopneumonitis",
    "Rhinopneumonie équine")

# 035 — Equine Viral Arteritis
add(uid(35), "EQUINE_VIRAL_ARTERITIS", "Equine Viral Arteritis",
    "Artérite virale équine", "ARV")

# 036 — Equine Encephalomyelitis
add(uid(36), "EQUINE_ENCEPHALOMYELITIS",
    "Equine Encephalomyelitis (Eastern/Western)",
    "Encéphalomyélite équine")

# 037 — Venezuelan Equine Encephalomyelitis
add(uid(37), "VEE", "Venezuelan Equine Encephalomyelitis",
    "Encéphalomyélite équine vénézuélienne")

# 038 — Camelpox
add(uid(38), "CAMELPOX", "Camelpox", "Variole du chameau",
    "Variole cameline")

# 039 — BSE
add(uid(39), "BSE", "Bovine Spongiform Encephalopathy",
    "Encéphalopathie spongiforme bovine")

# 040 — Enzootic Bovine Leukosis
add(uid(40), "EBL", "Enzootic Bovine Leukosis",
    "Leucose bovine enzootique", "Leucose bovine")

# 041 — IBR/IPV
add(uid(41), "IBR_IPV", "Infectious Bovine Rhinotracheitis / IPV",
    "Rhinotrachéite infectieuse bovine / IPV", "IBR/IPV", "IBR",
    "Infectious Bovine Rhinotracheitis")

# 042 — Haemorrhagic Septicaemia
add(uid(42), "HAEMORRHAGIC_SEPTICAEMIA", "Haemorrhagic Septicaemia",
    "Septicémie hémorragique", "Heamorrhagic Septicaemia",
    "HAEMORRHAGIC SEPTICAEMIA", "septicémie hémorragique",
    "Septicémie hémorrargique", "Hemorrhagic Septicaemia")

# 043 — Bovine Genital Campylobacteriosis
add(uid(43), "BOV_GENITAL_CAMP", "Bovine Genital Campylobacteriosis",
    "Campylobactériose génitale bovine", "Campylobacteriosis",
    "Campylobactériose", "BGC")

# 044 — Maedi-Visna
add(uid(44), "MAEDI_VISNA", "Maedi-Visna")

# 045 — Contagious Agalactia
add(uid(45), "CONTAGIOUS_AGALACTIA", "Contagious Agalactia",
    "Agalaxie contagieuse", "Agalactia")

# 046 — Nairobi Sheep Disease
add(uid(46), "NAIROBI_SHEEP", "Nairobi Sheep Disease",
    "Maladie de Nairobi")

# 047 — Scrapie
add(uid(47), "SCRAPIE", "Scrapie", "Tremblante")

# 048 — Aujeszky's Disease
add(uid(48), "AUJESZKY", "Aujeszky's Disease",
    "Maladie d'Aujeszky", "Aujeszky")

# 049 — PRRS
add(uid(49), "PRRS", "Porcine Reproductive & Respiratory Syndrome", "SDRP")

# 050 — Cysticercosis
add(uid(50), "CYSTICERCOSIS", "Cysticercosis", "Cysticercose",
    "cysticercosis", "PCys")

# 051 — Trichinellosis
add(uid(51), "TRICHINELLOSIS", "Trichinellosis", "Trichinellose",
    "Trichomonose")

# 052 — Avian Salmonellosis
add(uid(52), "AVIAN_SALMONELLOSIS", "Avian Salmonellosis (S. pullorum)",
    "Salmonellose aviaire", "Avian salmonellosis",
    "Avian Salmonellosis", "AVIAN_SALMONELLOSIS",
    "Avian salmonellosis (excluding B308 and B313)")

# 053 — Fowl Typhoid
add(uid(53), "FOWL_TYPHOID", "Fowl Typhoid", "Typhose aviaire",
    "Tyhpose aviaire", "Pullorum disease", "Pullorum",
    "FTYP", "Fowl typhoid")

# 054 — IBD (Gumboro)
add(uid(54), "IBD", "Infectious Bursal Disease (Gumboro)",
    "Maladie de Gumboro", "IBD", "Infectious bussal disease",
    "Infectious Bursai Disease (Gumboro)", "Gumboro", "GUMBORO")

# 055 — Marek's Disease
add(uid(55), "MAREKS", "Marek's Disease", "Maladie de Marek")

# 056 — Avian Infectious Bronchitis
add(uid(56), "AVIAN_IB", "Avian Infectious Bronchitis",
    "Bronchite infectieuse aviaire", "infectieuse aviaire")

# 057 — Avian Tuberculosis
add(uid(57), "AVIAN_TB", "Avian Tuberculosis", "Tuberculose aviaire")

# 058 — Fowl Pox
add(uid(58), "FOWL_POX", "Fowl Pox", "Variole aviaire", "fowl pox",
    "Turkey pox", "Tukey Pox", "TURKEY FOX", "Turkey rhinotracheitis",
    "Pox disease", "Cowpox", "Fowl pox", "Avian pox")

# 059 — Echinococcosis
add(uid(59), "ECHINOCOCCOSIS", "Echinococcosis / Hydatidosis",
    "Échinococcose / Hydatidose", "Echinococcosis", "ECHINOCOCCOSIS",
    "Hydatidosis")

# 060 — Leptospirosis
add(uid(60), "LEPTOSPIROSIS", "Leptospirosis", "Leptospirose",
    "leptospirosis", "LEPTOSPIROSIS", "LEP")

# 061 — Listeriosis
add(uid(61), "LISTERIOSIS", "Listeriosis", "Listériose")

# 062 — Botulism
add(uid(62), "BOTULISM", "Botulism", "Botulisme", "botulism")

# 063 — Leishmaniosis
add(uid(63), "LEISHMANIOSIS", "Leishmaniosis", "Leishmaniose")

# 064 — Coccidiosis
add(uid(64), "COCCIDIOSIS", "Coccidiosis", "Coccidiose", "coccidiosis",
    "Coccidia")

# 065 — Q Fever
add(uid(65), "Q_FEVER", "Q Fever (Coxiellosis)", "Fièvre Q",
    "Q Fever", "Coxiellosis")

# 066 — Theileriosis
add(uid(66), "THEILERIOSIS", "Theileriosis (tropical)",
    "Theiléliose", "theileriosis", "Theileriosis", "THEILERIOSIS",
    "Tick Fever", "Tick fever", "tick fever", "CORRIDOR DISEASE",
    "theileriose et DNS")

# 067 — Crimean-Congo
add(uid(67), "CRIMEAN_CONGO", "Crimean-Congo Haemorrhagic Fever",
    "Fièvre hémorragique de Crimée-Congo", "CCHF")

# 068 — Filariasis
add(uid(68), "FILARIASIS", "Filariasis", "Filariose")

# 069 — Myxomatosis
add(uid(69), "MYXOMATOSIS", "Myxomatosis", "Myxomatose")

# 070 — Rabbit Haemorrhagic Disease
add(uid(70), "RABBIT_HAEMORRHAGIC", "Rabbit Haemorrhagic Disease",
    "Maladie hémorragique du lapin")

# 071 — Paratuberculosis
add(uid(71), "PARATUBERCULOSIS", "Paratuberculosis (Johne's)",
    "Paratuberculose", "Paratuberculosis")

# 072 — Strangles
add(uid(72), "STRANGLES", "Strangles", "Gourme")

# 073 — EHD
add(uid(73), "EHD", "Epizootic Haemorrhagic Disease",
    "Maladie hémorragique épizootique")

# 074 — Infectious Coryza
add(uid(74), "INFECTIOUS_CORYZA", "Infectious Coryza",
    "Coryza infectieux", "Coryza", "COR", "Infctious Coryza",
    "Infectious coryza", "CRD")

# 075 — Vesicular Stomatitis
add(uid(75), "VESICULAR_STOMATITIS", "Vesicular Stomatitis",
    "Stomatite vésiculeuse")

# 076 — SVD
add(uid(76), "SVD", "Swine Vesicular Disease",
    "Maladie vésiculeuse du porc")

# 077 — Tularemia
add(uid(77), "TULAREMIA", "Tularemia", "Tularémie")

# Additional common diseases seen in data that may map to existing refs
# or are legitimate disease names without a direct ref_disease match:
# Dermatophilosis, Ectoparasitism, Myasis, Enteritis, etc.
# These don't have ref_diseases entries — they stay as text.


def ssh_connect(host: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS,
                timeout=20, allow_agent=False, look_for_keys=False)
    return ssh


def db_exec(ssh, container, db_pass, sql, timeout=120):
    escaped = sql.replace("'", "'\\''")
    cmd = (f"docker exec -e PGPASSWORD='{db_pass}' {container} "
           f"psql -U {DB_USER} -d aris -t -A -c '{escaped}'")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if err and "warning" not in err.lower() and "notice" not in err.lower():
        print(f"  [stderr] {err[:300]}", flush=True)
    return out


UUID_NOT_SPECIFIED = uid(0)  # 30000000-0000-4000-b000-000000000000


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default="stg", choices=["prod", "stg"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cfg = ENV_CONFIG[args.env]
    db_pass = DB_PASS_MAP[args.env]
    dry = args.dry_run

    print(f"[env] {args.env} — DB: {cfg['db_host']}")
    if dry:
        print("[mode] DRY RUN\n")

    ssh = ssh_connect(cfg["db_host"])
    c = cfg["db_container"]

    # ── Step 0: Ensure NOT_SPECIFIED disease exists ──────────────────
    print("[0] Ensuring NOT_SPECIFIED disease in ref_diseases...", flush=True)
    if not dry:
        # Write SQL to host, copy into container, execute
        sftp = ssh.open_sftp()
        sql_script = """
DELETE FROM animal_health.ref_diseases WHERE id = '30000000-0000-4000-b000-000000000000';
INSERT INTO animal_health.ref_diseases (id, code, name, description, is_notifiable, is_zoonotic, category, scope, is_active, is_default, sort_order, created_at, updated_at)
VALUES (
  '30000000-0000-4000-b000-000000000000', 'NOT_SPECIFIED',
  '{"en": "Not Specified", "fr": "Non renseigné", "pt": "Não especificado", "ar": "غير محدد"}'::jsonb,
  '{"en": "Disease not specified in the original report", "fr": "Maladie non renseignée dans le rapport original"}'::jsonb,
  false, false, 'UNKNOWN', 'ALL', true, false, 999, NOW(), NOW()
);
"""
        with sftp.file('/tmp/aris_not_specified.sql', 'w') as f:
            f.write(sql_script)
        sftp.close()
        ssh.exec_command(f"docker cp /tmp/aris_not_specified.sql {c}:/tmp/aris_not_specified.sql", timeout=10)[1].read()
        cmd = f"docker exec -e PGPASSWORD='{db_pass}' {c} psql -U {DB_USER} -d aris -f /tmp/aris_not_specified.sql"
        _, stdout, _ = ssh.exec_command(cmd, timeout=30)
        stdout.read()
        print("  NOT_SPECIFIED disease ensured.")

        # Fill empty disease rows
        print("  Filling empty disease rows...", flush=True)
        result = db_exec(ssh, c, db_pass,
            f"UPDATE {TABLE} SET disease = '{UUID_NOT_SPECIFIED}' WHERE disease IS NULL OR disease = ''",
            timeout=300)
        print(f"  {result}")

    # ── Step 1: Get all distinct textual disease values ──────────────
    print("[1] Fetching distinct textual disease values...", flush=True)
    raw = db_exec(ssh, c, db_pass,
        f"SELECT disease, COUNT(*) FROM {TABLE} "
        f"WHERE disease IS NOT NULL AND disease != '' "
        f"AND disease NOT LIKE '30000000%' "
        f"GROUP BY disease ORDER BY COUNT(*) DESC")

    text_values = []
    for line in raw.split("\n"):
        if "|" in line:
            parts = line.rsplit("|", 1)
            text_values.append((parts[0], int(parts[1])))

    print(f"  {len(text_values)} distinct textual values, {sum(v[1] for v in text_values):,} rows")

    # ── Step 2: Match text values to UUIDs ───────────────────────────
    print("\n[2] Matching to ref_diseases...", flush=True)
    matched = []      # (text_value, uuid, count)
    unmatched = []     # (text_value, count)
    matched_rows = 0
    unmatched_rows = 0

    for text_val, cnt in text_values:
        key = text_val.strip().lower()
        # Also try with underscores replaced by spaces
        key_spaced = key.replace("_", " ")

        uuid = DISEASE_MAP.get(key) or DISEASE_MAP.get(key_spaced)

        if uuid:
            matched.append((text_val, uuid, cnt))
            matched_rows += cnt
        else:
            unmatched.append((text_val, cnt))
            unmatched_rows += cnt

    print(f"  Matched: {len(matched)} values ({matched_rows:,} rows)")
    print(f"  Unmatched: {len(unmatched)} values ({unmatched_rows:,} rows)")

    # Show top unmatched
    print(f"\n  Top 30 unmatched values:")
    for val, cnt in unmatched[:30]:
        print(f"    {cnt:>6,}  {val}")

    if dry:
        print(f"\n  Top 20 matched values:")
        for val, uuid, cnt in matched[:20]:
            suffix = uuid.split("-")[-1].lstrip("0") or "0"
            print(f"    {cnt:>6,}  '{val}' → ...{suffix}")
        ssh.close()
        return

    # ── Step 3: Execute UPDATEs ──────────────────────────────────────
    print(f"\n[3] Executing {len(matched)} UPDATE statements...", flush=True)

    # Group by UUID for efficiency
    uuid_groups: dict[str, list[str]] = defaultdict(list)
    uuid_row_counts: dict[str, int] = defaultdict(int)
    for text_val, uuid, cnt in matched:
        uuid_groups[uuid].append(text_val)
        uuid_row_counts[uuid] += cnt

    total_updated = 0
    for i, (uuid, text_vals) in enumerate(sorted(uuid_groups.items(),
                                                   key=lambda x: -uuid_row_counts[x[0]])):
        row_est = uuid_row_counts[uuid]
        # Build IN clause with properly escaped values
        in_values = ", ".join(
            f"'{v.replace(chr(39), chr(39)+chr(39))}'" for v in text_vals
        )

        sql = (f"UPDATE {TABLE} SET disease = '{uuid}' "
               f"WHERE disease IN ({in_values})")

        result = db_exec(ssh, c, db_pass, sql, timeout=300)
        # Parse "UPDATE N"
        updated = 0
        if result.startswith("UPDATE"):
            try:
                updated = int(result.split()[-1])
            except (ValueError, IndexError):
                pass
        total_updated += updated

        suffix = uuid.split("-")[-1].lstrip("0") or "0"
        print(f"  [{i+1}/{len(uuid_groups)}] ...{suffix}: "
              f"{updated:,} rows updated ({len(text_vals)} variants)",
              flush=True)

    # ── Step 4: Summary ──────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total rows updated: {total_updated:,}")
    print(f"  Unmatched values remaining: {len(unmatched)} ({unmatched_rows:,} rows)")

    # Verify final state
    print("\n[verify] Final disease distribution:", flush=True)
    r = db_exec(ssh, c, db_pass,
        f"SELECT "
        f"  SUM(CASE WHEN disease LIKE '30000000%' THEN 1 ELSE 0 END) as uuid_rows, "
        f"  SUM(CASE WHEN disease IS NULL OR disease = '' THEN 1 ELSE 0 END) as empty_rows, "
        f"  SUM(CASE WHEN disease NOT LIKE '30000000%' AND disease IS NOT NULL AND disease != '' THEN 1 ELSE 0 END) as text_rows, "
        f"  COUNT(*) as total "
        f"FROM {TABLE}")
    if r:
        parts = r.split("|")
        if len(parts) >= 4:
            print(f"  UUID rows:  {int(parts[0]):>10,}")
            print(f"  Empty rows: {int(parts[1]):>10,}")
            print(f"  Text rows:  {int(parts[2]):>10,}")
            print(f"  Total:      {int(parts[3]):>10,}")

    ssh.close()
    print("\n[done]")


if __name__ == "__main__":
    main()
