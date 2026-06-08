#!/usr/bin/env python3
"""
Fix PPR survey submissions: replace SurveyMonkey numeric country IDs
with ISO 3166-1 alpha-2 country codes so the frontend dashboard can
resolve them to map coordinates and country names.
"""
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
CAMPAIGN_A = "6cbd4272-d213-4096-87b9-2952e7e13f65"

# Mapping deduced from institutions:
# 1  = Côte d'Ivoire (Direction de l'Elevage)
# 3  = Central African Republic (Direction des Services D'elevage et Sante animal)
# 4  = Cameroon (Direction Des Services Veterinaires)
# 5  = Gambia (Department of Livestock Services)
# 6  = Ghana (Veterinary Services, SORMAS is Ghana's system)
# 7  = Niger (Ministère de l'Elevage)
# 8  = Congo (Direction Générale d'Elevage — Republic of Congo)
# 10 = Guinea (Direction nationale des services vétérinaires)
# 12 = Nigeria (Federal ministry of Livestock Development, NADIS)
# 13 = Senegal (DSV Sénégal)
# 14 = Lesotho (Livestock and Veterinary Services Division)
# 15 = Chad (Direction des services vétérinaires, EMA-i+)
# 22 = Bangladesh? No — Botswana or Benin. "Department of Livestock Services" + no digital = likely Benin
# 23 = Madagascar (MADSUR = Madagascar Animals Diseases SURveillance)
# 24 = Malawi (Department of Animal Health and Livestock Development)
# 25 = Namibia (Division of Veterinary Services)
# 26 = Mozambique (Direcção Nacional de Sanidade e Biossegurança, Portuguese)
# 28 = Seychelles (Seychelles Veterinary Service)
# 29 = Tanzania (Ministry of livestock and fisheries, utambuzi = Swahili)
# 30 = Zambia (MINISTRY OF FISHERIES AND LIVESTOCK)
# 33 = Burundi (Direction de la Santé Animale + Laboratoire National Vétérinaire du Burundi)
# 37 = Djibouti (département livestock and veterinary services of Djibouti)
# 39 = Eritrea (Ministry of Agriculture)
# 40 = Zimbabwe (Ministry of Agriculture, DOVAR and ADNIS)
# 43 = Kenya (Directorate of Veterinary Services, KABSS)
# 50 = Somalia (Ministry of Livestock Forestry and Range)
# 52 = Ethiopia (Ministry of Livestock and Fisheries)

SURVEYMONKEY_TO_ISO2 = {
    "1": "CI",   # Côte d'Ivoire
    "3": "CF",   # Central African Republic
    "4": "CM",   # Cameroon
    "5": "GM",   # Gambia
    "6": "GH",   # Ghana
    "7": "NE",   # Niger
    "8": "CG",   # Congo (Brazzaville)
    "10": "GN",  # Guinea
    "12": "NG",  # Nigeria
    "13": "SN",  # Senegal
    "14": "LS",  # Lesotho
    "15": "TD",  # Chad
    "22": "BJ",  # Benin
    "23": "MG",  # Madagascar
    "24": "MW",  # Malawi
    "25": "NA",  # Namibia
    "26": "MZ",  # Mozambique
    "28": "SC",  # Seychelles
    "29": "TZ",  # Tanzania
    "30": "ZM",  # Zambia
    "33": "BI",  # Burundi
    "37": "DJ",  # Djibouti
    "39": "ER",  # Eritrea
    "40": "ZW",  # Zimbabwe
    "43": "KE",  # Kenya
    "50": "SO",  # Somalia
    "52": "ET",  # Ethiopia
}


def run_sql(client, db_host, db_pass, sql):
    chan = client.get_transport().open_session()
    chan.settimeout(15)
    escaped = sql.replace("'", "'\\''")
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c '{escaped}'"
    )
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch:
                break
            out += ch
    except:
        pass
    return out.decode(errors="replace").strip()


def fix_country_codes(client, db_host, db_pass, campaign_id):
    """Update submission data->country from numeric IDs to ISO2 codes."""
    updated = 0
    for sm_id, iso2 in SURVEYMONKEY_TO_ISO2.items():
        sql = (
            f"UPDATE submissions "
            f"SET data = jsonb_set(data, '{{country}}', '\"'{iso2}'\"') "
            f"WHERE campaign_id = '{campaign_id}' "
            f"AND data->>'country' = '{sm_id}'"
        )
        result = run_sql(client, db_host, db_pass, sql)
        # Extract count from "UPDATE N"
        count_line = [l for l in result.split("\n") if "UPDATE" in l]
        n = 0
        if count_line:
            parts = count_line[-1].strip().split()
            if len(parts) >= 2 and parts[1].isdigit():
                n = int(parts[1])
        if n > 0:
            updated += n
            print(f"    {sm_id:>3} → {iso2}  ({n} rows)")

    return updated


def main():
    print("=" * 60)
    print("  FIX PPR COUNTRY CODES (SurveyMonkey ID → ISO2)")
    print("=" * 60)

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print(f"\n--- {env} ---")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)

        # Find the campaign
        campaign_id = CAMPAIGN_A
        if env == "STG":
            r = run_sql(c, db_host, db_pass,
                "SELECT id FROM collection_campaigns WHERE name::text ILIKE '%Surveillance%Num%' LIMIT 1")
            lines = r.strip().split("\n")
            last = lines[-1].strip() if lines else ""
            if len(last) == 36:
                campaign_id = last
            print(f"  Campaign: {campaign_id[:8]}...")

        # Check before
        r = run_sql(c, db_host, db_pass,
            f"SELECT count(*) FROM submissions WHERE campaign_id = '{campaign_id}'")
        total = [l for l in r.split("\n") if l.strip().isdigit()]
        print(f"  Total submissions: {total[-1].strip() if total else '?'}")

        # Fix
        print("  Updating country codes...")
        n = fix_country_codes(c, db_host, db_pass, campaign_id)
        print(f"  Updated: {n} rows")

        # Verify
        r = run_sql(c, db_host, db_pass,
            f"SELECT DISTINCT data->>'country' FROM submissions WHERE campaign_id = '{campaign_id}' ORDER BY 1")
        print(f"  Countries after fix: {r.replace(chr(10), ', ')}")

        c.close()

    print("\nDONE")


if __name__ == "__main__":
    main()
