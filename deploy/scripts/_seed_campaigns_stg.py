#!/usr/bin/env python3
"""
ARIS 4.0 — Seed Realistic Campaigns for Staging (test.au-aris.org)
===================================================================
Creates one campaign per form template (21 total) with realistic
names, dates, target countries, and statuses.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python deploy/scripts/_seed_campaigns_stg.py
"""
import sys
import os
import io
import uuid
import json
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

DB_HOST = "10.202.101.148"
PASS = os.environ.get("ARIS_DEPLOY_PASS", "@u-1baR.0rg$U24")
ADMIN_ID = "10000000-0000-4000-a000-000000000001"   # admin@au-aris.org
AU_TENANT = "00000000-0000-4000-a000-000000000001"   # AU-IBAR

# ═══════════════════════════════════════════════════════════════
#  Campaign definitions — one per form template
# ═══════════════════════════════════════════════════════════════

CAMPAIGNS = [
    # ── Animal Health (6) ──
    {
        "form_name": "AU-IBAR Monthly Animal Health Report",
        "code": "AH_MONTHLY_2026_Q2",
        "name_en": "Monthly Animal Health Report — Q2 2026",
        "name_fr": "Rapport mensuel de santé animale — T2 2026",
        "desc_en": "Routine monthly animal health reporting across all Member States. Covers disease occurrence, morbidity, mortality, and control measures implemented.",
        "desc_fr": "Rapportage mensuel de routine sur la santé animale dans tous les États membres. Couvre les maladies, la morbidité, la mortalité et les mesures de contrôle.",
        "start": "2026-04-01", "end": "2026-06-30",
        "countries": ["KE", "ET", "NG", "SN", "ZA", "CM", "TZ", "UG", "GH", "CI"],
        "target": 300, "per_agent": 10, "frequency": "monthly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Emergency Disease Reporting",
        "code": "AH_EMERGENCY_2026",
        "name_en": "Emergency Disease Notification — Continuous 2026",
        "name_fr": "Notification d'urgence de maladie — Continue 2026",
        "desc_en": "Real-time emergency disease notification for outbreaks of transboundary animal diseases (TADs). Aligned with WAHIS immediate notification requirements.",
        "desc_fr": "Notification en temps réel des urgences sanitaires pour les maladies animales transfrontalières (MAT). Aligné sur les exigences WAHIS.",
        "start": "2026-01-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "NG", "SN", "ZA", "CM", "TZ", "UG", "GH", "CI", "CD", "MZ", "ML", "NE", "TD"],
        "target": 500, "per_agent": 20, "frequency": "one_time", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Mass Vaccination",
        "code": "AH_VACC_MASS_PPR_2026",
        "name_en": "PPR Mass Vaccination Campaign — East Africa 2026",
        "name_fr": "Campagne de vaccination de masse PPR — Afrique de l'Est 2026",
        "desc_en": "Pan-African programme for PPR eradication. Targets small ruminants in 8 IGAD member countries. Dose tracking, cold chain monitoring, and adverse reaction reporting.",
        "desc_fr": "Programme panafricain d'éradication de la PPR. Cible les petits ruminants dans 8 pays IGAD. Suivi des doses, chaîne du froid et effets indésirables.",
        "start": "2026-03-01", "end": "2026-09-30",
        "countries": ["KE", "ET", "UG", "TZ", "SO", "DJ", "ER", "SS"],
        "target": 1200, "per_agent": 30, "frequency": "weekly", "status": "ACTIVE",
        "scope": "rec",
    },
    {
        "form_name": "Meat Inspection",
        "code": "AH_MEAT_INSP_2026",
        "name_en": "Abattoir Meat Inspection Monitoring — 2026",
        "name_fr": "Suivi des inspections de viande en abattoir — 2026",
        "desc_en": "Systematic ante-mortem and post-mortem inspection data collection at registered abattoirs. Covers condemnation rates, parasite detection, and hygiene compliance.",
        "desc_fr": "Collecte systématique des données d'inspection ante-mortem et post-mortem dans les abattoirs enregistrés.",
        "start": "2026-01-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "NG", "ZA", "GH", "CM"],
        "target": 600, "per_agent": 15, "frequency": "weekly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Monthly Abattoir Report",
        "code": "AH_ABATTOIR_Q2_2026",
        "name_en": "Monthly Abattoir Performance Report — Q2 2026",
        "name_fr": "Rapport mensuel de performance des abattoirs — T2 2026",
        "desc_en": "Monthly aggregate reporting from all registered slaughterhouses: throughput volumes, species breakdown, condemnation rates, and revenue metrics.",
        "desc_fr": "Rapportage mensuel agrégé des abattoirs enregistrés : volumes, espèces, taux de saisie et revenus.",
        "start": "2026-04-01", "end": "2026-06-30",
        "countries": ["KE", "ET", "NG", "ZA", "TZ", "GH", "SN", "CI"],
        "target": 240, "per_agent": 8, "frequency": "monthly", "status": "PLANNED",
        "scope": "continental",
    },
    {
        "form_name": "Monthly Vaccination Report",
        "code": "AH_VACC_MONTHLY_2026",
        "name_en": "Monthly Vaccination Summary — 2026",
        "name_fr": "Résumé mensuel des vaccinations — 2026",
        "desc_en": "Aggregated monthly vaccination statistics by species, disease, and administrative area. Tracks coverage rates against national targets.",
        "desc_fr": "Statistiques mensuelles agrégées de vaccination par espèce, maladie et zone administrative. Suivi du taux de couverture.",
        "start": "2026-01-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "NG", "SN", "ZA", "CM", "TZ", "UG", "GH", "CI"],
        "target": 360, "per_agent": 12, "frequency": "monthly", "status": "ACTIVE",
        "scope": "continental",
    },

    # ── Livestock Production (7) ──
    {
        "form_name": "Animal Breeding and Genomics",
        "code": "LP_BREEDING_2026",
        "name_en": "Animal Breeding & Genomics Survey — 2026",
        "name_fr": "Enquête sur l'élevage et la génomique animale — 2026",
        "desc_en": "Annual survey of artificial insemination services, breed improvement programmes, and genomic selection initiatives. Aligned with AU-IBAR genetic improvement strategy.",
        "desc_fr": "Enquête annuelle sur l'insémination artificielle, les programmes d'amélioration des races et la sélection génomique.",
        "start": "2026-02-01", "end": "2026-11-30",
        "countries": ["KE", "ET", "ZA", "NG", "TZ", "GH", "SN"],
        "target": 200, "per_agent": 8, "frequency": "quarterly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Animal Population (Genetic Diversity)",
        "code": "LP_POP_GENETIC_2026",
        "name_en": "National Animal Genetic Diversity Assessment — 2026",
        "name_fr": "Évaluation nationale de la diversité génétique animale — 2026",
        "desc_en": "Breed composition and genetic diversity inventory for indigenous and exotic livestock breeds. Supports the Global Plan of Action for Animal Genetic Resources.",
        "desc_fr": "Inventaire de la composition des races et de la diversité génétique des espèces domestiques autochtones et exotiques.",
        "start": "2026-03-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "ZA", "NG", "TZ", "CM", "ML", "NE", "BF", "SN"],
        "target": 150, "per_agent": 5, "frequency": "one_time", "status": "PLANNED",
        "scope": "continental",
    },
    {
        "form_name": "Animal Population and Composition",
        "code": "LP_CENSUS_2026",
        "name_en": "Continental Livestock Census — 2026",
        "name_fr": "Recensement continental du cheptel — 2026",
        "desc_en": "Annual livestock census collecting herd/flock sizes by species, breed, sex, and age structure at administrative level 3. Foundation for FAOSTAT denominators.",
        "desc_fr": "Recensement annuel du cheptel par espèce, race, sexe et structure d'âge au niveau administratif 3. Base pour les dénominateurs FAOSTAT.",
        "start": "2026-01-15", "end": "2026-06-30",
        "countries": ["KE", "ET", "NG", "SN", "ZA", "CM", "TZ", "UG", "GH", "CI", "ML", "NE", "TD", "BF", "MZ"],
        "target": 2000, "per_agent": 25, "frequency": "one_time", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Breeder Association",
        "code": "LP_BREEDER_ASSOC_2026",
        "name_en": "Breeder Association Registry — 2026 Update",
        "name_fr": "Registre des associations d'éleveurs — Mise à jour 2026",
        "desc_en": "Annual update of registered breeder associations: membership, breeds managed, AI services, and capacity building activities.",
        "desc_fr": "Mise à jour annuelle des associations d'éleveurs : membres, races, services d'IA et renforcement des capacités.",
        "start": "2026-04-01", "end": "2026-09-30",
        "countries": ["KE", "ET", "ZA", "NG", "TZ", "GH", "SN"],
        "target": 100, "per_agent": 5, "frequency": "one_time", "status": "PLANNED",
        "scope": "continental",
    },
    {
        "form_name": "Disaster and Risk Management",
        "code": "LP_DISASTER_2026",
        "name_en": "Livestock Disaster Impact Assessment — Sahel 2026",
        "name_fr": "Évaluation de l'impact des catastrophes sur le bétail — Sahel 2026",
        "desc_en": "Rapid assessment of drought, flood, and epidemic impacts on livestock populations in the Sahel corridor. Emergency data for response planning.",
        "desc_fr": "Évaluation rapide de l'impact des sécheresses, inondations et épidémies sur le cheptel dans le couloir sahélien.",
        "start": "2026-05-01", "end": "2026-10-31",
        "countries": ["ML", "NE", "TD", "BF", "SN", "MR", "NG"],
        "target": 350, "per_agent": 15, "frequency": "monthly", "status": "PLANNED",
        "scope": "rec",
    },
    {
        "form_name": "Legislation",
        "code": "LP_LEGISLATION_2026",
        "name_en": "National Livestock Legislation Inventory — 2026",
        "name_fr": "Inventaire de la législation nationale sur l'élevage — 2026",
        "desc_en": "Comprehensive inventory of national laws, regulations, and policies governing livestock production, breeding, and animal welfare.",
        "desc_fr": "Inventaire complet des lois, règlements et politiques nationaux régissant la production animale, l'élevage et le bien-être animal.",
        "start": "2026-03-01", "end": "2026-08-31",
        "countries": ["KE", "ET", "NG", "ZA", "GH", "SN", "CM", "TZ", "CI", "ML"],
        "target": 55, "per_agent": 1, "frequency": "one_time", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "National Animal Genetic Resources Centre",
        "code": "LP_GENE_CENTRE_2026",
        "name_en": "Gene Bank & Genetic Resource Centre Survey — 2026",
        "name_fr": "Enquête sur les banques de gènes et centres de ressources génétiques — 2026",
        "desc_en": "Annual survey of national gene banks, cryopreservation capacity, and genetic resource conservation programmes.",
        "desc_fr": "Enquête annuelle sur les banques de gènes nationales, la capacité de cryoconservation et les programmes de conservation des ressources génétiques.",
        "start": "2026-06-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "ZA", "NG", "TZ"],
        "target": 30, "per_agent": 2, "frequency": "one_time", "status": "PLANNED",
        "scope": "continental",
    },

    # ── Trade & SPS (8) ──
    {
        "form_name": "Cost of Production",
        "code": "TR_COST_PROD_2026",
        "name_en": "Livestock Production Cost Survey — Q2 2026",
        "name_fr": "Enquête sur les coûts de production animale — T2 2026",
        "desc_en": "Quarterly cost of production survey covering feed, veterinary services, labour, and transport costs for key livestock commodities (beef, poultry, dairy).",
        "desc_fr": "Enquête trimestrielle sur les coûts de production : alimentation, services vétérinaires, main-d'œuvre et transport.",
        "start": "2026-04-01", "end": "2026-06-30",
        "countries": ["KE", "ET", "NG", "ZA", "GH", "SN", "CM", "TZ"],
        "target": 400, "per_agent": 12, "frequency": "quarterly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Import and Export",
        "code": "TR_IMPORT_EXPORT_2026",
        "name_en": "Cross-Border Trade Flow Monitoring — AfCFTA 2026",
        "name_fr": "Suivi des flux commerciaux transfrontaliers — ZLECAf 2026",
        "desc_en": "Monitoring of live animal and animal product trade flows across AU Member States. Aligned with AfCFTA implementation. Covers SPS certification, volumes, and values.",
        "desc_fr": "Suivi des flux commerciaux d'animaux vivants et de produits animaux entre États membres de l'UA. Aligné sur la ZLECAf.",
        "start": "2026-01-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "NG", "ZA", "GH", "SN", "CM", "TZ", "CI", "UG", "CD", "MZ"],
        "target": 600, "per_agent": 15, "frequency": "monthly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Market Demand",
        "code": "TR_MARKET_DEMAND_2026",
        "name_en": "Livestock Market Demand Analysis — West & East Africa 2026",
        "name_fr": "Analyse de la demande du marché de l'élevage — Afrique de l'Ouest et de l'Est 2026",
        "desc_en": "Consumer demand analysis for livestock products: meat, dairy, eggs, and hides. Covers urban and peri-urban markets in target countries.",
        "desc_fr": "Analyse de la demande des consommateurs pour les produits d'élevage : viande, produits laitiers, œufs et cuirs.",
        "start": "2026-03-01", "end": "2026-09-30",
        "countries": ["KE", "NG", "GH", "SN", "CI", "ET", "TZ"],
        "target": 250, "per_agent": 10, "frequency": "monthly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Market Price",
        "code": "TR_MARKET_PRICE_2026",
        "name_en": "Livestock Market Price Intelligence — 2026",
        "name_fr": "Intelligence des prix du marché de l'élevage — 2026",
        "desc_en": "Weekly market price data collection for live animals, meat, dairy, and eggs at sentinel markets. Powers the ARIS price dashboard and early warning system.",
        "desc_fr": "Collecte hebdomadaire des prix sur les marchés sentinelles pour les animaux vivants, la viande, les produits laitiers et les œufs.",
        "start": "2026-01-01", "end": "2026-12-31",
        "countries": ["KE", "ET", "NG", "SN", "ZA", "CM", "TZ", "UG", "GH", "CI", "ML", "NE", "TD", "BF", "CD"],
        "target": 2500, "per_agent": 50, "frequency": "weekly", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Market Requirement and Location",
        "code": "TR_MARKET_LOC_2026",
        "name_en": "Livestock Market Infrastructure Survey — 2026",
        "name_fr": "Enquête sur les infrastructures de marché de l'élevage — 2026",
        "desc_en": "Geolocation and characterisation of livestock markets: infrastructure, services available, capacity, accessibility, and operational schedules.",
        "desc_fr": "Géolocalisation et caractérisation des marchés à bétail : infrastructures, services, capacité, accessibilité et calendriers.",
        "start": "2026-02-01", "end": "2026-08-31",
        "countries": ["KE", "ET", "NG", "SN", "GH", "CM", "TZ", "ML", "NE", "BF"],
        "target": 500, "per_agent": 15, "frequency": "one_time", "status": "ACTIVE",
        "scope": "continental",
    },
    {
        "form_name": "Quality Standards (Inputs & Services)",
        "code": "TR_QUALITY_INPUT_2026",
        "name_en": "Quality Standards Compliance — Inputs & Services 2026",
        "name_fr": "Conformité aux normes de qualité — Intrants et services 2026",
        "desc_en": "Assessment of quality compliance for veterinary drugs, animal feeds, breeding materials, and veterinary service providers.",
        "desc_fr": "Évaluation de la conformité qualité des médicaments vétérinaires, aliments pour animaux, matériel d'élevage et prestataires de services vétérinaires.",
        "start": "2026-04-01", "end": "2026-10-31",
        "countries": ["KE", "NG", "ZA", "GH", "ET", "SN"],
        "target": 180, "per_agent": 8, "frequency": "quarterly", "status": "PLANNED",
        "scope": "continental",
    },
    {
        "form_name": "Quality Standards (Poultry/Hatchery)",
        "code": "TR_QUALITY_POULTRY_2026",
        "name_en": "Poultry & Hatchery Quality Standards — 2026",
        "name_fr": "Normes de qualité avicole et couvoir — 2026",
        "desc_en": "Quality assessment of poultry hatcheries, day-old chick supply chains, and compliance with biosecurity and food safety standards.",
        "desc_fr": "Évaluation qualité des couvoirs, chaînes d'approvisionnement de poussins d'un jour et conformité biosécurité et sécurité alimentaire.",
        "start": "2026-05-01", "end": "2026-11-30",
        "countries": ["KE", "NG", "ZA", "GH", "ET", "CM", "CI"],
        "target": 150, "per_agent": 6, "frequency": "quarterly", "status": "PLANNED",
        "scope": "continental",
    },
    {
        "form_name": "Volume and Availability of Transport",
        "code": "TR_TRANSPORT_2026",
        "name_en": "Livestock Transport Logistics Survey — 2026",
        "name_fr": "Enquête sur la logistique du transport de bétail — 2026",
        "desc_en": "Assessment of livestock transport capacity, vehicle types, cold chain availability, and compliance with animal welfare during transit standards.",
        "desc_fr": "Évaluation de la capacité de transport de bétail, types de véhicules, chaîne du froid et conformité au bien-être animal pendant le transit.",
        "start": "2026-03-01", "end": "2026-09-30",
        "countries": ["KE", "ET", "NG", "SN", "GH", "CM", "TZ", "ML"],
        "target": 200, "per_agent": 8, "frequency": "one_time", "status": "ACTIVE",
        "scope": "continental",
    },
]


def main():
    print("=" * 70)
    print("  ARIS STAGING — Seed Campaigns for all 21 Form Templates")
    print(f"  Target DB: {DB_HOST}")
    print("=" * 70)

    # ── Connect to DB VM ──
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(DB_HOST, 22, "arisadmin", PASS, timeout=15, allow_agent=False, look_for_keys=False)

    def psql(query):
        full_cmd = f'echo "{query}" | docker exec -i aris-stg-postgres psql -U aris -d aris -t -A -F \'|\''
        stdin, stdout, stderr = c.exec_command(full_cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        return out

    # ── Get form template IDs ──
    print("\n  Loading form templates...")
    raw = psql("SELECT id, name, domain FROM form_builder.form_templates ORDER BY domain, name")
    templates = {}
    for line in raw.splitlines():
        parts = line.split("|")
        if len(parts) >= 3:
            templates[parts[1]] = {"id": parts[0], "domain": parts[2]}
    print(f"  Found {len(templates)} form templates")

    if not templates:
        print("  ERROR: No form templates found. Run form-builder seed first.")
        c.close()
        sys.exit(1)

    # ── Delete existing collection campaigns (reset) ──
    print("\n  Clearing existing collection campaigns...")
    psql("DELETE FROM public.campaign_assignments")
    psql("DELETE FROM public.collection_campaigns")
    cnt = psql("SELECT count(*) FROM public.collection_campaigns")
    print(f"  Remaining: {cnt}")

    # ── Insert campaigns ──
    print("\n  Creating campaigns...\n")
    success = 0
    failed = 0

    for camp in CAMPAIGNS:
        form_name = camp["form_name"]
        tmpl = templates.get(form_name)
        if not tmpl:
            print(f"  [SKIP] Form not found: {form_name}")
            failed += 1
            continue

        campaign_id = str(uuid.uuid4())
        name_json = json.dumps({"en": camp["name_en"], "fr": camp["name_fr"]}).replace("'", "''")
        desc_json = json.dumps({"en": camp["desc_en"], "fr": camp["desc_fr"]}).replace("'", "''")
        countries_json = json.dumps(camp["countries"]).replace("'", "''")

        sql = f"""INSERT INTO public.collection_campaigns (
            id, code, name, description, domain, form_template_id,
            start_date, end_date, target_countries, target_submissions,
            target_per_agent, frequency, status, scope, owner_type,
            send_reminders, reminder_days_before, created_by,
            created_at, updated_at
        ) VALUES (
            '{campaign_id}',
            '{camp["code"]}',
            '{name_json}',
            '{desc_json}',
            '{tmpl["domain"]}',
            '{tmpl["id"]}',
            '{camp["start"]}',
            '{camp["end"]}',
            '{countries_json}',
            {camp["target"]},
            {camp["per_agent"]},
            '{camp["frequency"]}',
            '{camp["status"]}',
            '{camp["scope"]}',
            '{camp["scope"]}',
            true,
            3,
            '{ADMIN_ID}',
            NOW(),
            NOW()
        ) ON CONFLICT DO NOTHING"""

        result = psql(sql.replace('"', '\\"'))
        if "ERROR" in (result or ""):
            print(f"  [FAIL] {camp['code']}: {result[:100]}")
            failed += 1
        else:
            status_icon = "ACTIVE" if camp["status"] == "ACTIVE" else "PLANNED"
            print(f"  [{status_icon:>7}] {camp['code']:30s} | {form_name}")
            success += 1

    # ── Verify ──
    print(f"\n  {'='*60}")
    count = psql("SELECT count(*) FROM public.collection_campaigns")
    print(f"  Total campaigns in DB: {count}")

    by_domain = psql("SELECT domain, count(*), string_agg(status::text, ', ') FROM public.collection_campaigns GROUP BY domain ORDER BY domain")
    print(f"\n  By domain:")
    for line in by_domain.splitlines():
        parts = line.split("|")
        if len(parts) >= 2:
            print(f"    {parts[0]:20s} {parts[1]} campaigns")

    by_status = psql("SELECT status, count(*) FROM public.collection_campaigns GROUP BY status ORDER BY status")
    print(f"\n  By status:")
    for line in by_status.splitlines():
        parts = line.split("|")
        if len(parts) >= 2:
            print(f"    {parts[0]:15s} {parts[1]}")

    c.close()

    print(f"\n  Result: {success} created, {failed} failed")
    print("=" * 70)
    print("  CAMPAIGNS SEEDED!")
    print("=" * 70)


if __name__ == "__main__":
    main()
