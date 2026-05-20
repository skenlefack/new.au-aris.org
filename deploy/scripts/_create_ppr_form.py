#!/usr/bin/env python3
"""Create PPR Epidemiological Survey form template on PROD via API."""

import paramiko
import json
import sys
import uuid

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
VM_APP = "10.202.101.183"


def uid():
    return str(uuid.uuid4())


def ml(en, fr=""):
    return {"en": en, "fr": fr or en, "pt": en, "ar": en}


def field(code, label_en, label_fr, ftype="text", order=0, required=False, **props):
    f = {
        "id": uid(),
        "type": ftype,
        "code": code,
        "label": ml(label_en, label_fr),
        "placeholder": ml(""),
        "helpText": ml(""),
        "column": 0,
        "columnSpan": props.pop("columnSpan", 1),
        "order": order,
        "required": required,
        "readOnly": False,
        "hidden": False,
        "validation": {},
        "conditions": [],
        "properties": props,
    }
    return f


def section(name_en, name_fr, order, columns=2, fields_list=None, color=None, collapsible=True, desc_en="", desc_fr=""):
    return {
        "id": uid(),
        "name": ml(name_en, name_fr),
        "description": ml(desc_en, desc_fr) if desc_en else None,
        "columns": columns,
        "order": order,
        "isCollapsible": collapsible,
        "isCollapsed": False,
        "isRepeatable": False,
        "icon": None,
        "color": color,
        "conditions": [],
        "fields": fields_list or [],
    }


def select_opts(pairs):
    """Build options from list of (value, label_en, label_fr) tuples."""
    return [{"label": ml(en, fr), "value": val} for val, en, fr in pairs]


def yes_no():
    return select_opts([("yes", "Yes", "Oui"), ("no", "No", "Non")])


def yes_no_dontknow():
    return select_opts([("yes", "Yes", "Oui"), ("no", "No", "Non"), ("dont_know", "Don't know", "Ne sait pas")])


# ═══════════════════════════════════════════════
# BUILD SCHEMA
# ═══════════════════════════════════════════════

sections = []

# ── S0: LOCALISATION ADMINISTRATIVE ──
sections.append(section(
    "Administrative Location", "Localisation Administrative", 0,
    columns=1, color="#1E40AF", collapsible=False,
    desc_en="Select the administrative location (levels 1-3 required)",
    desc_fr="Sélectionnez la localisation administrative (niveaux 1-3 obligatoires)",
    fields_list=[
        field("admin_location", "Administrative Location", "Localisation Administrative",
              ftype="admin-location", order=0, required=True, columnSpan=1,
              levels=[0, 1, 2, 3, 4], requiredLevels=[0, 1, 2]),
    ],
))

# ── S1: IDENTIFICATION GENERALE ──
sections.append(section(
    "General Identification", "Identification Générale", 1,
    columns=2, color="#059669",
    fields_list=[
        field("survey_date", "Survey Date", "Date de l'enquête",
              ftype="date", order=0, required=True),
        field("surveyor_name", "Surveyor Name", "Nom de l'agent enquêteur",
              ftype="text", order=1, required=True),
    ],
))

# ── S2: IDENTIFICATION DU TROUPEAU ──
sections.append(section(
    "Herd Identification", "Identification du Troupeau", 2,
    columns=2, color="#7C3AED",
    fields_list=[
        field("owner_name", "Owner Name", "Nom du propriétaire majoritaire",
              ftype="text", order=0, required=True),
        field("owner_phone", "Phone Number (required)", "Contact téléphone (obligatoire)",
              ftype="text", order=1, required=True,
              **{"validation": {"pattern": "^[0-9+\\-\\s]{8,15}$"}}),
        field("animal_ownership", "Who owns the animals?", "A qui appartient ces animaux?",
              ftype="select", order=2, required=True,
              options=select_opts([
                  ("husband", "Husband", "Mari"),
                  ("wife", "Wife", "Femme"),
                  ("boys", "Boys", "Enfants (garçons)"),
                  ("girls", "Girls", "Enfants (filles)"),
                  ("other", "Other", "Autres"),
              ])),
        field("main_activity", "Main activity of household head", "Activité principale du chef de ménage",
              ftype="select", order=3, required=True,
              options=select_opts([
                  ("agriculture", "Agriculture", "Agriculture"),
                  ("livestock", "Livestock", "Elevage"),
                  ("fishing", "Fishing", "Pêche"),
                  ("commerce", "Commerce", "Commerce"),
                  ("crafts", "Crafts", "Artisanat"),
                  ("civil_servant", "Civil Servant", "Fonctionnaire"),
                  ("private_sector", "Private Sector", "Secteur privé"),
                  ("student", "Student", "Elève/étudiant"),
                  ("retired", "Retired/Housewife", "Ménagère/retraité"),
                  ("other", "Other", "Autres"),
              ])),
        field("producer_association", "Member of small ruminant producer association?",
              "Membre d'une association de producteurs de petits ruminants?",
              ftype="select", order=4, options=yes_no()),
        field("association_name", "Association Name", "Nom de l'association",
              ftype="text", order=5),
    ],
))

# ── S3: EFFECTIF ET CONDUITE ──
sections.append(section(
    "Small Ruminant Population & Management",
    "Effectif et Conduite de l'Exploitation des Petits Ruminants", 3,
    columns=2, color="#D97706",
    fields_list=[
        field("sheep_count", "Number of Sheep", "Nombre de moutons",
              ftype="number", order=0, required=True, **{"validation": {"min": 0}}),
        field("goat_count", "Number of Goats", "Nombre de chèvres",
              ftype="number", order=1, required=True, **{"validation": {"min": 0}}),
        field("breeds", "Breeds raised", "Races élevées",
              ftype="multi-select", order=2, columnSpan=2,
              options=select_opts([
                  ("djallonke_sheep", "Djallonke Sheep", "Moutons Djallonké"),
                  ("arab_choa_sheep", "Arab Choa Sheep", "Moutons Arabe Choa"),
                  ("sahel_goat", "Sahel Goat", "Chèvres du Sahel"),
                  ("dwarf_goat", "Dwarf Goat", "Chèvres naines"),
                  ("hybrid", "Hybrid Breeds", "Races hybrides"),
                  ("other", "Other", "Autres"),
              ])),
        field("other_animals", "Other animals owned", "Autres animaux possédés",
              ftype="multi-select", order=3, columnSpan=2,
              options=select_opts([
                  ("cattle", "Cattle", "Bovins"),
                  ("pigs", "Pigs", "Porcs"),
                  ("poultry", "Poultry", "Volailles"),
                  ("other", "Other", "Autres"),
              ])),
        field("farming_system", "Farming system", "Système d'élevage pratiqué",
              ftype="select", order=4, required=True,
              options=select_opts([
                  ("traditional", "Traditional (free-range)", "Traditionnel (divagation)"),
                  ("semi_intensive", "Semi-intensive", "Semi-intensif"),
                  ("intensive", "Intensive (modern)", "Intensif (système moderne)"),
              ])),
        field("farming_reasons", "Reasons for raising small ruminants",
              "Raisons de l'élevage des petits ruminants",
              ftype="multi-select", order=5, columnSpan=2,
              options=select_opts([
                  ("school_fees", "School fees", "Scolarité enfants"),
                  ("self_consumption", "Self-consumption", "Autoconsommation"),
                  ("family_care", "Family care", "Prise en charge famille"),
                  ("cultural_rites", "Cultural rites", "Rites culturels"),
                  ("income", "Income generation", "Génération de revenus"),
                  ("other", "Other", "Autres"),
              ])),
        field("animal_source", "Source of sheep and goats",
              "Provenance des moutons et chèvres",
              ftype="multi-select", order=6, columnSpan=2,
              options=select_opts([
                  ("local_market", "Local livestock market", "Marché de bétail local"),
                  ("neighboring_farms", "Neighboring farms", "Exploitations voisines"),
                  ("own_breeding", "Own breeding", "Naisseur (élevage propre)"),
                  ("acquired_gift", "Gift/Acquired", "Acquis/Don"),
                  ("other", "Other", "Autres"),
              ])),
        field("communal_pasture", "Use communal village pastures?",
              "Utilisez-vous les pâturages communs du village?",
              ftype="select", order=7, options=yes_no()),
        field("seasonal_movement", "Seasonal movements with animals?",
              "Mouvements saisonniers avec vos animaux?",
              ftype="select", order=8, options=yes_no()),
        field("movement_destinations", "Movement destinations",
              "Zones de destination des mouvements",
              ftype="multi-select", order=9, columnSpan=2,
              options=select_opts([
                  ("village_pastures", "Village communal pastures", "Pâturages communs du village"),
                  ("commune_pastures", "Commune pastures", "Pâturages de la commune"),
                  ("other_regions", "Other regions", "Autres régions du pays"),
                  ("neighboring_countries", "Neighboring countries", "Pays voisins"),
              ])),
    ],
))

# ── S4: HISTORIQUE SANTE ──
sections.append(section(
    "Recent Health Problems History",
    "Historique Récente des Problèmes de Santé", 4,
    columns=2, color="#DC2626",
    fields_list=[
        field("animals_sick", "Do your animals often show disease signs?",
              "Vos animaux manifestent-ils souvent des signes de maladies?",
              ftype="select", order=0, required=True, options=yes_no()),
        field("disease_signs", "Most common disease signs",
              "Signes de maladies les plus courants",
              ftype="multi-select", order=1, columnSpan=2,
              options=select_opts([
                  ("diarrhea", "Diarrhea", "Diarrhée"),
                  ("nasal_discharge", "Nasal discharge", "Jetage nasal"),
                  ("oral_discharge", "Oral discharge", "Jetage buccal"),
                  ("abortions", "Abortions", "Avortements"),
                  ("sudden_death", "Sudden death", "Mortalité subite"),
                  ("mucopurulent_tearing", "Mucopurulent tearing", "Larmoiement muco-purulent"),
                  ("oral_lesions", "Oral lesions", "Lésions buccales"),
                  ("skin_nodules", "Skin nodules", "Nodules cutanés"),
                  ("other", "Other", "Autres"),
              ])),
        field("last_disease_signs", "When were disease signs last recorded?",
              "Quand avez-vous enregistré les derniers signes?",
              ftype="select", order=2,
              options=select_opts([
                  ("less_1_month", "Less than 1 month", "Moins d'un mois"),
                  ("1_to_3_months", "1 to 3 months", "1 à 3 mois"),
                  ("6_months", "6 months ago", "Il y a 6 mois"),
                  ("more_1_year", "More than 1 year", "Plus d'un an"),
              ])),
        field("frequent_mortality", "Do you often record mortalities?",
              "Enregistrez-vous souvent des mortalités?",
              ftype="select", order=3, options=yes_no()),
        field("mortality_season", "Season of most recent mortalities",
              "Saison des mortalités les plus récentes",
              ftype="multi-select", order=4, columnSpan=2,
              options=select_opts([
                  ("dry_season", "Dry season", "Saison sèche"),
                  ("cold_season", "Cold season", "Saison froide"),
                  ("rainy_season", "Rainy season", "Saison pluvieuse"),
              ])),
        field("mortality_month", "Specify month", "Précisez le mois",
              ftype="text", order=5),
        field("mortality_signs", "How did mortalities manifest?",
              "Comment se sont-ils manifestés?",
              ftype="multi-select", order=6, columnSpan=2,
              options=select_opts([
                  ("diarrhea", "Diarrhea", "Diarrhée"),
                  ("nasal_discharge", "Nasal discharge", "Jetage nasal"),
                  ("oral_discharge", "Oral discharge", "Jetage buccal"),
                  ("abortions", "Abortions", "Avortements"),
                  ("sudden_death", "Sudden death", "Mortalité subite"),
                  ("mucopurulent_tearing", "Mucopurulent tearing", "Larmoiement muco-purulent"),
                  ("oral_lesions", "Oral lesions", "Lésions buccales"),
                  ("other", "Other", "Autres"),
              ])),
        field("survivors_in_herd", "Survivors from last disease episode?",
              "Survivants de la dernière maladie dans le troupeau?",
              ftype="select", order=7, options=yes_no()),
        field("sick_animal_management", "How do you manage sick animals?",
              "Comment gérez-vous les animaux malades?",
              ftype="multi-select", order=8, columnSpan=2,
              options=select_opts([
                  ("isolated", "Isolated from herd", "Isolés du reste du troupeau"),
                  ("with_others", "Taken to pasture with others", "Conduits au pâturage avec les autres"),
                  ("sell", "Sold progressively", "Vendus progressivement"),
                  ("slaughter", "Slaughtered", "Abattus"),
                  ("nothing", "Nothing", "Rien"),
              ])),
        field("vet_follow_up", "Is your herd followed by a veterinarian?",
              "Votre élevage est-il suivi par un vétérinaire?",
              ftype="select", order=9, options=yes_no()),
    ],
))

# ── S5: CONNAISSANCES, ATTITUDES, PRATIQUES ──
sections.append(section(
    "Knowledge, Attitudes, Practices & Impact of PPR",
    "Connaissances, Attitudes, Pratiques et Impact de la PPR", 5,
    columns=2, color="#7C3AED",
    fields_list=[
        field("heard_of_ppr", "Have you heard of PPR?",
              "Avez-vous déjà entendu parler de la PPR?",
              ftype="select", order=0, required=True, options=yes_no()),
        field("ppr_description", "Describe PPR as you know it",
              "Décrivez la PPR telle que vous la connaissez",
              ftype="textarea", order=1, columnSpan=2),
        field("ppr_local_name", "Local name of the disease",
              "Nom local de la maladie (si connu)",
              ftype="text", order=2),
        field("animals_had_ppr", "Have your animals had PPR?",
              "Vos animaux ont-ils déjà eu la PPR?",
              ftype="select", order=3, options=yes_no()),
        field("species_affected", "Species affected",
              "Espèces touchées",
              ftype="select", order=4,
              options=select_opts([
                  ("sheep", "Sheep", "Moutons"),
                  ("goats", "Goats", "Chèvres"),
                  ("both", "Both", "Les deux"),
              ])),
        field("transmission_mode", "Most frequent transmission modes",
              "Modes de transmission les plus fréquents",
              ftype="multi-select", order=5, columnSpan=2,
              options=select_opts([
                  ("animal_contact", "Contact between animals", "Contact entre animaux"),
                  ("drinking_water", "Drinking water", "Eau de boisson"),
                  ("feed", "Feed", "Aliment"),
                  ("fomites", "Contaminated tools/equipment", "Outils contaminés"),
                  ("other", "Other", "Autres"),
              ])),
        field("wildlife_transmission", "Can PPR be transmitted by wildlife?",
              "La PPR peut-elle être transmise par les animaux sauvages?",
              ftype="select", order=6, options=yes_no()),
        field("human_transmission", "Can PPR be transmitted to humans?",
              "La PPR peut-elle être transmise à l'homme?",
              ftype="select", order=7, options=yes_no()),
        field("treatment_approach", "How do you treat this disease?",
              "Comment soignez-vous cette maladie?",
              ftype="multi-select", order=8, columnSpan=2,
              options=select_opts([
                  ("call_vet", "Call veterinarian", "J'appelle mon vétérinaire"),
                  ("indigenous_medicine", "Indigenous medicine", "Médicaments indigènes"),
                  ("market_drugs", "Buy drugs at market", "Achète des médicaments au marché"),
                  ("nothing", "Do nothing", "Ne fais rien"),
                  ("other", "Other", "Autres"),
              ])),
        field("frequent_mortality_ppr", "Do you record mortalities frequently?",
              "Enregistrez-vous souvent des mortalités?",
              ftype="select", order=9, options=yes_no()),
        field("high_mortality_seasons", "Seasons of high mortality",
              "Saisons des fortes mortalités",
              ftype="multi-select", order=10, columnSpan=2,
              options=select_opts([
                  ("dry_season", "Dry season", "Saison sèche"),
                  ("cold_season", "Cold season", "Saison froide"),
                  ("rainy_season", "Rainy season", "Saison pluvieuse"),
              ])),
        field("high_mortality_month", "Specify month", "Précisez le mois",
              ftype="text", order=11),
        field("avg_annual_mortality", "Average annual mortality from PPR",
              "Mortalités moyennes par an dues à la PPR",
              ftype="select", order=12,
              options=select_opts([
                  ("1_to_2", "1 to 2 animals", "Un à deux sujets"),
                  ("young_only", "Young only", "Uniquement les jeunes"),
                  ("young_adults", "Young and adults", "Les jeunes et les adultes"),
                  ("most_herd", "Most of the herd", "La majorité du troupeau"),
              ])),
        field("neighbors_same_disease", "Neighbors have same disease at same period?",
              "Observez-vous cette maladie chez les voisins à la même période?",
              ftype="select", order=13, options=yes_no()),
        field("sheep_price", "Average sheep price (FCFA)",
              "Prix moyen d'un mouton (FCFA)",
              ftype="number", order=14, **{"validation": {"min": 0}}),
        field("goat_price", "Average goat price (FCFA)",
              "Prix moyen d'une chèvre (FCFA)",
              ftype="number", order=15, **{"validation": {"min": 0}}),
        field("prevention_measures", "What do you do to prevent disease?",
              "Que faites-vous pour éviter la maladie?",
              ftype="multi-select", order=16, columnSpan=2,
              options=select_opts([
                  ("vaccinate", "Vaccinate via local vet", "Vaccination par le vétérinaire"),
                  ("sell_during_season", "Sell during mortality seasons", "Vendre pendant les saisons de mortalité"),
                  ("isolate_new", "Isolate new animals", "Isoler les nouveaux animaux"),
                  ("nothing", "Nothing", "Rien"),
                  ("other", "Other", "Autres"),
              ])),
    ],
))

# ── S6: CONTROLE ET ERADICATION ──
sections.append(section(
    "PPR Control & Eradication",
    "Contrôle et Eradication de la PPR", 6,
    columns=2, color="#0891B2",
    fields_list=[
        field("vaccinated_ppr", "Is your herd vaccinated against PPR?",
              "Votre troupeau est-il vacciné contre la PPR?",
              ftype="select", order=0, required=True, options=yes_no_dontknow()),
        field("last_vaccination_year", "Last vaccination year",
              "Dernière année de vaccination",
              ftype="select", order=1,
              options=select_opts([
                  ("2020", "2020", "2020"), ("2021", "2021", "2021"),
                  ("2022", "2022", "2022"), ("2023", "2023", "2023"),
                  ("2024", "2024", "2024"), ("2025", "2025", "2025"),
                  ("2026", "2026 (this year)", "2026 (cette année)"),
              ])),
        field("vaccination_provider", "Who performed the vaccination?",
              "Par qui la vaccination a été effectuée?",
              ftype="select", order=2,
              options=select_opts([
                  ("campaign", "Vaccination campaign", "Campagne de vaccination"),
                  ("private_vet", "Private veterinarian", "Vétérinaire privé"),
                  ("ngo", "NGO", "ONG"),
                  ("other", "Other", "Autres"),
              ])),
        field("vaccination_effect", "Effect of vaccination on mortality",
              "Effet de la vaccination sur les mortalités",
              ftype="select", order=3,
              options=select_opts([
                  ("decreased", "Decreased significantly", "Baissé considérablement"),
                  ("increased", "Increased after vaccination", "Augmenté après la vaccination"),
                  ("no_change", "No change", "Rien n'a changé"),
                  ("dont_know", "Don't know", "Ne sait pas"),
              ])),
        field("health_register", "Do you have a health register?",
              "Disposez-vous d'un registre sanitaire?",
              ftype="select", order=4, options=yes_no()),
        field("main_problems", "3 main problems in small ruminant farming",
              "3 principaux problèmes dans l'élevage des petits ruminants",
              ftype="textarea", order=5, columnSpan=2),
        field("vaccination_importance", "What do you think of PPR vaccination?",
              "Que pensez-vous de la vaccination contre la PPR?",
              ftype="select", order=6, columnSpan=2,
              options=select_opts([
                  ("important", "Important - protects against mortality", "Importante - protège contre les mortalités"),
                  ("no_interest", "No interest", "Sans intérêt"),
                  ("other", "Other", "Autres"),
              ])),
        field("willing_to_revaccinate", "Willing to vaccinate again?",
              "Prêt à recommencer la vaccination?",
              ftype="select", order=7, options=yes_no()),
        field("willing_to_pay", "Willing to pay the cost?",
              "Prêt à payer le coût?",
              ftype="select", order=8, options=yes_no()),
        field("refusal_reasons", "Reasons for refusal (if applicable)",
              "Raisons du refus de vaccination",
              ftype="multi-select", order=9, columnSpan=2,
              options=select_opts([
                  ("no_trust_vet", "No trust in vet services", "Non-confiance aux services vétérinaires"),
                  ("rumors", "Rumors/Disinformation", "Rumeurs/Désinformation"),
                  ("religious_reasons", "Religious reasons", "Raisons religieuses"),
                  ("too_expensive", "Too expensive", "Trop cher"),
                  ("not_available", "Not available", "Non disponible"),
                  ("other", "Other", "Autres"),
              ])),
        field("accept_ear_notch", "Accept ear notch marking during vaccination?",
              "Acceptez-vous le marquage par encoche à l'oreille?",
              ftype="select", order=10, options=yes_no()),
        field("ear_notch_refusal_reasons", "Reasons for refusing ear notch",
              "Raisons du refus du marquage",
              ftype="multi-select", order=11, columnSpan=2,
              options=select_opts([
                  ("loses_value", "Animal loses value", "L'animal perd sa valeur"),
                  ("religious", "Religious beliefs", "Croyances religieuses"),
                  ("traditional", "Traditional beliefs", "Croyances traditionnelles"),
                  ("other", "Other", "Autres"),
              ])),
    ],
))

# ── S7: TABLEAU DES PRELEVEMENTS ──
sections.append(section(
    "Sampling Table (15 subjects per herd/village)",
    "Tableau des Prélèvements (15 sujets par troupeau/village)", 7,
    columns=1, color="#EA580C",
    desc_en="Non-vaccinated animals only. Sample types: SE=Serum, ECN=Conjunctival-Nasal Swab, EON=Oro-nasal Swab",
    desc_fr="Uniquement animaux non vaccinés. Types: SE=Sérum, ECN=Écouvillon Conjonctivo-Nasal, EON=Écouvillon Oro-nasal",
    fields_list=[
        field("samples", "Samples", "Prélèvements",
              ftype="repeater", order=0, columnSpan=1,
              repeatMin=1, repeatMax=15,
              fields=[
                  {"code": "sample_species", "label": ml("Species", "Espèce"), "type": "select",
                   "options": select_opts([("goat", "Goat", "Chèvre"), ("sheep", "Sheep", "Mouton")])},
                  {"code": "sample_sex", "label": ml("Sex", "Sexe"), "type": "select",
                   "options": select_opts([("male", "Male", "Mâle"), ("female", "Female", "Femelle")])},
                  {"code": "sample_age", "label": ml("Age", "Âge"), "type": "select",
                   "options": select_opts([("4_12m", "4-12 months", "4-12 mois"), ("over_12m", ">12 months", ">12 mois")])},
                  {"code": "sample_code", "label": ml("Sample Code", "Code Prélèvement"), "type": "text"},
                  {"code": "se", "label": ml("Serum (SE)", "Sérum (SE)"), "type": "checkbox"},
                  {"code": "ecn", "label": ml("Conjunctival Swab (ECN)", "Écouvillon CN (ECN)"), "type": "checkbox"},
                  {"code": "eon", "label": ml("Oro-nasal Swab (EON)", "Écouvillon ON (EON)"), "type": "checkbox"},
                  {"code": "lab_status", "label": ml("Lab Status", "Statut LANAVET"), "type": "select",
                   "options": select_opts([("positive", "Positive", "Positif"), ("negative", "Negative", "Négatif"), ("doubtful", "Doubtful", "Douteux")])},
              ]),
    ],
))

# ── S8: COORDONNEES GPS ──
sections.append(section(
    "GPS Coordinates (Required)", "Coordonnées GPS (Obligatoire)", 8,
    columns=1, color="#1E3A5F", collapsible=False,
    fields_list=[
        field("geo_coordinates", "GPS Location", "Localisation GPS",
              ftype="geo-selector", order=0, required=True, columnSpan=1),
    ],
))

# ── Build full schema ──
schema = {
    "sections": sections,
    "settings": {
        "allowDraft": True,
        "allowAttachments": True,
        "maxAttachments": 5,
        "allowOffline": True,
        "requireGeoLocation": True,
        "autoSaveInterval": 60,
        "submissionWorkflow": "standard",
        "notifyOnSubmit": [],
        "duplicateDetection": {"enabled": False, "fields": []},
    },
    "validationRules": [],
}

template = {
    "name": "Enquête épidémiologique PPR (Peste des Petits Ruminants)",
    "domain": "animal-health",
    "formType": "CAMPAIGN",
    "status": "PUBLISHED",
    "dataClassification": "RESTRICTED",
    "description": "Ce questionnaire a pour but de collecter des informations relatives à la peste des petits ruminants dans les élevages des différentes régions des pays. Toutes les informations recueillies seront anonymes et confidentielles. Les résultats seront utilisés en vue de fournir des données épidémiologiques de référence nécessaires à la planification et à l'évaluation du Programme National de Contrôle et d'Eradication de la Peste des Petits Ruminants.",
    "schema": schema,
    "uiSchema": {},
}

# ═══════════════════════════════════════════════
# DEPLOY TO PROD
# ═══════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  Creating PPR Survey Form Template on PROD")
    print("=" * 60)

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)

    # Login
    sftp = c.open_sftp()
    with sftp.file("/tmp/login.json", "w") as f:
        f.write(json.dumps({"email": "admin@au-aris.org", "password": "Aris2026@@4!0"}))
    sftp.close()

    chan = c.get_transport().open_session()
    chan.exec_command('curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/login.json')
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass
    token = json.loads(out.decode())["data"]["accessToken"]
    print(f"  Login: OK")

    # Upload template JSON via SFTP
    body = json.dumps(template, ensure_ascii=False)
    sftp = c.open_sftp()
    with sftp.file("/tmp/ppr_template.json", "w") as f:
        f.write(body)
    sftp.close()
    print(f"  Template JSON uploaded ({len(body)} bytes)")

    # Create template via API
    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X POST http://localhost:3010/api/v1/form-builder/templates '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'-d @/tmp/ppr_template.json'
    )
    chan.settimeout(30)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass

    try:
        resp = json.loads(out.decode(errors="replace"))
        if "data" in resp:
            tpl = resp["data"]
            print(f"  CREATED!")
            print(f"  ID:      {tpl.get('id')}")
            print(f"  Name:    {tpl.get('name')}")
            print(f"  Status:  {tpl.get('status')}")
            print(f"  Domain:  {tpl.get('domain')}")
            sections = tpl.get("schema", {}).get("sections", [])
            total_fields = sum(len(s.get("fields", [])) for s in sections)
            print(f"  Sections: {len(sections)}")
            print(f"  Fields:   {total_fields}")
        else:
            print(f"  FAILED: {resp.get('message', out.decode()[:300])}")
    except Exception as e:
        print(f"  ERROR: {e}")
        print(f"  Raw: {out.decode(errors='replace')[:300]}")

    c.close()
    print("\nDONE")


if __name__ == "__main__":
    main()
