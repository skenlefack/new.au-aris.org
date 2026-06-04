#!/usr/bin/env python3
"""
Create PPR Epidemiological Survey form template — Draft 5 (28/05/2026).
Aligned with: "Fiche de collecte des donnees draft 5 du 280526.docx"

Changes vs v2:
  S1: +CODE FICHE, N° D'ORDRE, Consentement, CZV/Poste Vétérinaire
  S2: +Sexe éleveur, +Tranche d'âge, +Chasse in main_activity
  S3: +Plaisir in farming_reasons, animal_source updated (border/neighbor market)
  S4: disease_signs updated, +cadaver_management, +health_register (moved from S6),
      sick_mgmt expanded
  S5: +9 new questions (S5Q2,Q6,Q8,Q9,Q17,Q19,Q20,Q21), +insects in transmission,
      avg_mortality options updated, prevention updated
  S6: vaccination_importance +aggravates, refusal_reasons updated, health_register removed
  S7: EON → EV (Ecouvillon Vaginal)
  S9: NEW section Signatures (agent, superviseur, labo)
"""

import paramiko
import json
import sys
import uuid

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
VM_APP = "10.202.101.183"  # PROD
# VM_APP = "10.202.101.146"  # STG


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
        "helpText": ml(props.pop("helpText_en", ""), props.pop("helpText_fr", "")),
        "column": 0,
        "columnSpan": props.pop("columnSpan", 1),
        "order": order,
        "required": required,
        "readOnly": False,
        "hidden": False,
        "validation": props.pop("validation", {}),
        "conditions": props.pop("conditions", []),
        "properties": props,
    }
    return f


def section(name_en, name_fr, order, columns=2, fields_list=None, color=None,
            collapsible=True, desc_en="", desc_fr=""):
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
    return [{"label": ml(en, fr), "value": val} for val, en, fr in pairs]


def yes_no():
    return select_opts([("yes", "Yes", "Oui"), ("no", "No", "Non")])


def yes_no_dontknow():
    return select_opts([
        ("yes", "Yes", "Oui"),
        ("no", "No", "Non"),
        ("dont_know", "Don't know", "Ne sait pas"),
    ])


# ═══════════════════════════════════════════════
# BUILD SCHEMA — Draft 5 (28/05/2026)
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
    desc_en="Adapt header to country letterhead. Fill in validated questions for your country while keeping harmonized codes.",
    desc_fr="Adapter le timbre à l'entête du pays. Remplir les questions validées dans vos pays respectifs tout en gardant strictement les codes harmonisés.",
    fields_list=[
        field("form_code", "Form Code", "Code Fiche",
              ftype="text", order=0, required=True),
        field("form_serial", "Form Serial Number", "N° d'ordre de fiche",
              ftype="text", order=1),
        field("consent", "Informed consent", "Consentement éleveur",
              ftype="select", order=2, required=True,
              helpText_en="Verbally informed consent",
              helpText_fr="Oui informé verbalement",
              options=select_opts([
                  ("yes", "Yes — verbally informed", "Oui — informé verbalement"),
              ])),
        field("survey_date", "Survey Date (DD/MM/YYYY)", "Date de l'enquête (JJ/MM/AAAA)",
              ftype="date", order=3, required=True),
        field("surveyor_name", "Surveyor Name", "Nom de l'agent enquêteur",
              ftype="text", order=4, required=True),
        field("czv_post", "CZV / Veterinary Post / Agricultural Sector",
              "CZV / Poste Vétérinaire / Secteur agricole/élevage",
              ftype="text", order=5),
        field("village_name", "Village", "Village",
              ftype="text", order=6, required=True),
    ],
))

# ── S2: IDENTIFICATION DU TROUPEAU ──
sections.append(section(
    "Herd Identification", "Identification du Troupeau", 2,
    columns=2, color="#7C3AED",
    fields_list=[
        field("owner_name", "Owner Name (majority animal owner)",
              "Nom de l'éleveur (ou propriétaire majoritaire des animaux)",
              ftype="text", order=0, required=True),
        field("owner_phone", "Phone Number (owner or relative in village)",
              "Numéro de téléphone (éleveur ou parenté dans le village)",
              ftype="text", order=1, required=True,
              validation={"pattern": "^[0-9+\\-\\s]{8,15}$"}),
        # ── NEW: S2Q3 ──
        field("owner_sex", "Sex of the farmer", "Sexe de l'éleveur",
              ftype="select", order=2, required=True,
              options=select_opts([
                  ("male", "Male", "Homme"),
                  ("female", "Female", "Femme"),
              ])),
        # ── NEW: S2Q4 ──
        field("owner_age_range", "Age range of the farmer", "Tranche d'âge de l'éleveur",
              ftype="select", order=3, required=True,
              options=select_opts([
                  ("15_30", "15-30 years", "15-30 ans"),
                  ("31_45", "31-45 years", "31-45 ans"),
                  ("46_55", "46-55 years", "46-55 ans"),
                  ("56_plus", "56+ years", "+56 ans"),
              ])),
        field("animal_ownership", "Who owns these sheep and goats in the household?",
              "A qui appartiennent ces moutons et chèvres du ménage?",
              ftype="select", order=4, required=True,
              options=select_opts([
                  ("husband", "Husband", "Mari"),
                  ("wife", "Wife", "Femme"),
                  ("boys", "Boys", "Enfants (garçons)"),
                  ("girls", "Girls", "Enfants (filles)"),
                  ("other", "Other", "Autres"),
              ])),
        # ── UPDATED: S2Q6 — added hunting (chasse) ──
        field("main_activity", "Main activity of the owner",
              "Activité principale du propriétaire",
              ftype="select", order=5, required=True,
              options=select_opts([
                  ("agriculture", "Agriculture", "Agriculture"),
                  ("livestock", "Livestock", "Elevage"),
                  ("fishing", "Fishing", "Pêche"),
                  ("hunting", "Hunting", "Chasse"),
                  ("commerce", "Commerce", "Commerce"),
                  ("crafts", "Crafts", "Artisanat"),
                  ("civil_servant", "Civil Servant", "Fonctionnaire"),
                  ("private_sector", "Private Sector", "Secteur privé"),
                  ("student", "Student", "Elève/étudiant"),
                  ("housewife_retired", "Housewife/Retired", "Ménagère/retraité"),
                  ("other", "Other", "Autres"),
              ])),
        field("producer_association",
              "Member of a small ruminant producer association/group?",
              "Faites-vous partie d'une association ou groupes de producteurs des petits ruminants?",
              ftype="select", order=6, options=yes_no()),
        field("association_name", "If yes, name the association(s)",
              "Si oui, nommez-la (les)",
              ftype="text", order=7),
    ],
))

# ── S3: EFFECTIF ET CONDUITE ──
sections.append(section(
    "Small Ruminant Population & Management",
    "Effectif et Conduite de l'Exploitation des Petits Ruminants", 3,
    columns=2, color="#D97706",
    fields_list=[
        field("sheep_count", "Number of Sheep", "Nombre de moutons",
              ftype="number", order=0, required=True, validation={"min": 0}),
        field("goat_count", "Number of Goats", "Nombre de chèvres",
              ftype="number", order=1, required=True, validation={"min": 0}),
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
                  ("traditional", "Traditional (free-range / communal pasture)",
                   "Traditionnel (divagation / pâturage commun)"),
                  ("semi_intensive", "Semi-intensive (pen + supplement + care)",
                   "Semi-intensif (étable + supplément + soins)"),
                  ("intensive", "Intensive (modern)", "Intensif (système moderne)"),
              ])),
        # ── UPDATED: added "pleasure" ──
        field("farming_reasons",
              "Reasons for raising small ruminants (multiple choice)",
              "Raisons de l'élevage des petits ruminants (choix multiple)",
              ftype="multi-select", order=5, columnSpan=2,
              options=select_opts([
                  ("school_fees", "School fees", "Scolarité enfants"),
                  ("self_consumption", "Self-consumption", "Autoconsommation"),
                  ("family_care", "Family care", "Prise en charge famille"),
                  ("cultural_rites", "Cultural rites", "Rites culturels"),
                  ("income", "Income generation", "Augmenter revenus"),
                  ("pleasure", "Pleasure", "Plaisir"),
                  ("other", "Other", "Autres"),
              ])),
        # ── UPDATED: replaced gift/acquired with border/neighbor markets ──
        field("animal_source",
              "Source of sheep and goats (multiple choice)",
              "Provenance des moutons et chèvres (choix multiple)",
              ftype="multi-select", order=6, columnSpan=2,
              options=select_opts([
                  ("local_market", "Local livestock market", "Marché de bétail local"),
                  ("neighboring_farms", "Neighboring farms", "Exploitations voisines"),
                  ("own_breeding", "Own breeding", "Naisseur (élevage propre)"),
                  ("border_market", "Border market", "Acquis d'un marché frontalier"),
                  ("neighbor_country_market", "Market in neighboring country",
                   "Acquis d'un marché dans le pays voisin"),
              ])),
        field("communal_pasture", "Use communal village pastures?",
              "Conduisez-vous vos animaux dans les pâturages communs du village?",
              ftype="select", order=7, options=yes_no()),
        field("seasonal_movement", "Seasonal movements with animals?",
              "Effectuez-vous des mouvements saisonniers avec vos animaux?",
              ftype="select", order=8, options=yes_no()),
        field("movement_destinations", "If yes, destination areas",
              "Si oui, quelles zones de destination?",
              ftype="multi-select", order=9, columnSpan=2,
              options=select_opts([
                  ("village_pastures", "Village communal pastures",
                   "Pâturages communs du village"),
                  ("commune_pastures", "Commune communal pastures",
                   "Pâturages communs de la commune"),
                  ("other_regions", "Other regions of the country",
                   "Autres régions du pays"),
                  ("neighboring_countries", "Neighboring countries (specify)",
                   "Pays voisins (précisez le pays)"),
              ])),
    ],
))

# ── S4: HISTORIQUE RECENTE DES PROBLEMES DE SANTE ──
sections.append(section(
    "Recent Health Problems History",
    "Historique Récente des Problèmes de Santé", 4,
    columns=2, color="#DC2626",
    fields_list=[
        # S4Q1
        field("animals_sick", "Do your animals often show disease signs?",
              "Vos animaux manifestent-ils souvent des signes de maladies?",
              ftype="select", order=0, required=True, options=yes_no()),
        # S4Q2 — UPDATED: added loss_appetite, ocular_discharge; removed oral_lesions, skin_nodules
        field("disease_signs",
              "If yes, most common disease signs (multiple choice)",
              "Si oui, signes de maladies les plus couramment rencontrés (choix multiple)",
              ftype="multi-select", order=1, columnSpan=2,
              options=select_opts([
                  ("loss_appetite", "Loss of appetite", "Animal ne mange pas"),
                  ("nasal_discharge", "Nasal discharge", "Jetage nasal"),
                  ("ocular_discharge", "Ocular discharge", "Décharge oculaire"),
                  ("diarrhea", "Diarrhea", "Diarrhée"),
                  ("abortions", "Abortions", "Avortements"),
                  ("sudden_death", "Sudden death", "Mortalité subite"),
                  ("mucopurulent_tearing", "Mucopurulent tearing",
                   "Larmoiement muco-purulent"),
                  ("other", "Other", "Autres"),
              ])),
        # S4Q3
        field("last_disease_signs", "When were disease signs last recorded?",
              "Quand avez-vous enregistré les signes de maladies pour la dernière fois?",
              ftype="select", order=2,
              options=select_opts([
                  ("less_1_month", "Less than 1 month", "Il y a moins d'un mois"),
                  ("1_to_3_months", "1 to 3 months", "Entre 1 à 3 mois"),
                  ("6_months", "6 months ago", "Il y a 6 mois"),
                  ("more_1_year", "More than 1 year", "Plus d'un an"),
              ])),
        # S4Q4 — UPDATED: expanded options
        field("sick_animal_management",
              "How do you generally manage sick animals? (multiple choice)",
              "Comment gérez-vous de façon générale les animaux une fois malades? (choix multiple)",
              ftype="multi-select", order=3, columnSpan=2,
              options=select_opts([
                  ("isolated", "Isolated from the herd",
                   "Isolés du reste du troupeau"),
                  ("with_others", "Taken to pasture with others",
                   "Conduits au pâturage avec les autres animaux"),
                  ("sell_progressively", "Sold progressively",
                   "Vendus progressivement"),
                  ("slaughter_sell", "Slaughtered to sell",
                   "Tué certains pour vendre"),
                  ("slaughter_eat", "Slaughtered for family consumption",
                   "Tué d'autres pour manger en famille"),
                  ("other", "Other", "Autres"),
              ])),
        # S4Q5
        field("frequent_mortality", "Do you often record mortalities?",
              "Enregistrez-vous souvent des cas de mortalités dans les troupeaux?",
              ftype="select", order=4, options=yes_no()),
        # S4Q6
        field("recent_mortality_period",
              "When were the most recent mortalities?",
              "A quand remontent les mortalités les plus récentes?",
              ftype="select", order=5,
              options=select_opts([
                  ("dry_season", "Dry season (specify month)", "Saison sèche (précisez le mois)"),
                  ("rainy_season", "Rainy season (specify month)", "Saison pluvieuse (précisez le mois)"),
              ])),
        field("recent_mortality_month", "Specify month",
              "Précisez le mois",
              ftype="text", order=6),
        # S4Q7 — NEW: cadaver management
        field("cadaver_management",
              "What do you do with carcasses? (multiple choice)",
              "Que faites-vous des cadavres? (choix multiple)",
              ftype="multi-select", order=7, columnSpan=2,
              options=select_opts([
                  ("eat", "We eat them", "Nous les mangeons"),
                  ("sell_butchers", "We sell to butchers/restaurants",
                   "Nous les vendons aux bouchers ou restaurateurs"),
                  ("destroy", "We destroy them", "Nous les détruisons"),
                  ("discard_bush", "Discarded in the bush",
                   "On jette dans les poubelles en brousse"),
                  ("other", "Other", "Autres"),
              ])),
        # S4Q8
        field("survivors_in_herd",
              "Are there currently survivors from the last disease in the herd?",
              "Y a-t-il actuellement dans le troupeau des animaux survivants de la dernière maladie?",
              ftype="select", order=8, options=yes_no()),
        # S4Q9
        field("vet_follow_up", "Is your herd followed by a veterinarian?",
              "Faites-vous suivre votre élevage par un vétérinaire?",
              ftype="select", order=9, options=yes_no()),
        # S4Q10 — NEW (moved from S6)
        field("health_register",
              "If yes, do you have a health register for animal health monitoring?",
              "Si oui, avez-vous un cahier ou registre de santé dédié au suivi sanitaire de vos animaux?",
              ftype="select", order=10, options=yes_no()),
    ],
))

# ── S5: CONNAISSANCES, ATTITUDES, PRATIQUES ET IMPACT DE LA PPR ──
sections.append(section(
    "Knowledge, Attitudes, Practices & Impact of PPR",
    "Connaissances, Attitudes, Pratiques et Impact de la PPR", 5,
    columns=2, color="#7C3AED",
    fields_list=[
        # S5Q1
        field("heard_of_ppr", "Have you heard of PPR?",
              "Avez-vous déjà entendu parler de la Peste des Petits Ruminants (PPR)?",
              ftype="select", order=0, required=True, options=yes_no()),
        # S5Q2 — NEW
        field("ppr_is_sheep_goat_disease",
              "Is it a disease of sheep and goats?",
              "Est-ce une maladie des moutons et des chèvres?",
              ftype="select", order=1, options=yes_no()),
        # S5Q3
        field("ppr_description", "If you know it, how do you describe it?",
              "Si vous la connaissez, comment la décrivez-vous?",
              ftype="textarea", order=2, columnSpan=2),
        # S5Q4
        field("animals_had_ppr", "Have your animals ever had this disease?",
              "Vos animaux ont-ils déjà eu cette maladie?",
              ftype="select", order=3, options=yes_no()),
        # S5Q5
        field("ppr_local_name", "Local name of the disease (if known)",
              "Avez-vous un nom local de cette maladie (si connu)?",
              ftype="text", order=4),
        # S5Q6 — NEW: PPR clinical signs observed
        field("ppr_clinical_signs",
              "Have you observed the following clinical signs in your flock? (multiple choice)",
              "Avez-vous déjà observé les signes cliniques suivants dans votre troupeau? (choix multiple)",
              ftype="multi-select", order=5, columnSpan=2,
              options=select_opts([
                  ("blocked_nose", "Blocked nose", "Le nez qui est bouché"),
                  ("mucopurulent_tearing", "Mucopurulent tearing (ocular discharge)",
                   "Larmoiement muco-purulent (décharge oculaire)"),
                  ("diarrhea", "Diarrhea", "Diarrhée"),
                  ("mortality_all_ages", "Mortality at all ages (young and old)",
                   "Mortalité des animaux à tout âge (petits ou grands)"),
              ])),
        # S5Q7
        field("species_affected", "Which species were affected?",
              "Quelles sont les espèces animales qui ont été touchées?",
              ftype="select", order=6,
              options=select_opts([
                  ("sheep", "Sheep", "Moutons"),
                  ("goats", "Goats", "Chèvres"),
                  ("both", "Both", "Les deux"),
              ])),
        # S5Q8 — NEW: proportion sick
        field("proportion_sick",
              "How many animals get sick relative to total herd size?",
              "Combien d'animaux tombent-ils malades par rapport à l'effectif total du troupeau?",
              ftype="select", order=7,
              options=select_opts([
                  ("25_pct", "25% of herd", "25% du troupeau"),
                  ("50_pct", "50%", "50%"),
                  ("75_pct", "75%", "75%"),
                  ("85_pct", "85%", "85%"),
                  ("100_pct", "Entire herd", "Tout le troupeau"),
              ])),
        # S5Q9 — NEW: when last PPR signs
        field("last_ppr_signs",
              "When did you last record signs of this disease?",
              "Quand avez-vous enregistré les signes de maladies pour la dernière fois?",
              ftype="select", order=8,
              options=select_opts([
                  ("less_1_month", "Less than 1 month", "Moins de 1 mois"),
                  ("1_to_3_months", "1 to 3 months", "1 à 3 mois"),
                  ("4_to_6_months", "4 to 6 months", "4 à 6 mois"),
                  ("more_6_months", "More than 6 months", "Plus de 6 mois"),
              ])),
        # S5Q10 — UPDATED: added insects
        field("transmission_mode",
              "Possible transmission routes (multiple choice)",
              "Voies de transmission possibles de cette maladie (choix multiple)",
              ftype="multi-select", order=9, columnSpan=2,
              options=select_opts([
                  ("animal_contact", "Contact between animals", "Par contact entre animaux"),
                  ("drinking_water", "Drinking water", "Dans l'eau de boisson"),
                  ("feed", "Feed", "Dans l'aliment"),
                  ("insects", "Insects", "Par des insectes"),
                  ("other", "Other", "Autres"),
              ])),
        # S5Q11
        field("wildlife_transmission",
              "Can this disease be transmitted by wildlife?",
              "Cette maladie peut-elle être transmise par les animaux sauvages?",
              ftype="select", order=10, options=yes_no()),
        # S5Q12
        field("human_transmission",
              "Can this disease be transmitted to humans?",
              "Cette maladie peut-elle être transmise à l'homme?",
              ftype="select", order=11, options=yes_no()),
        # S5Q13
        field("treatment_approach",
              "How do you treat this disease? (multiple choice)",
              "En cas de signes cliniques, comment soignez cette maladie? (choix multiple)",
              ftype="multi-select", order=12, columnSpan=2,
              options=select_opts([
                  ("call_vet", "Call veterinarian", "J'appelle mon vétérinaire"),
                  ("indigenous_medicine", "Indigenous medicine",
                   "J'utilise des médicaments indigènes"),
                  ("market_drugs", "Buy drugs at village market",
                   "J'achète des médicaments au marché de mon village"),
                  ("other", "Other", "Autres"),
              ])),
        # S5Q14
        field("frequent_mortality_ppr", "Do you often record mortalities?",
              "Enregistrez-vous souvent des mortalités?",
              ftype="select", order=13, options=yes_no()),
        # S5Q15
        field("high_mortality_seasons",
              "If yes, which seasons have the highest mortalities?",
              "Si oui, quelles sont les saisons des fortes mortalités?",
              ftype="select", order=14,
              options=select_opts([
                  ("dry_season", "Dry season (specify month)", "Saison sèche (préciser le mois)"),
                  ("rainy_season", "Rainy season (specify month)", "Saison pluvieuse (préciser le mois)"),
              ])),
        field("high_mortality_month", "Specify month", "Précisez le mois",
              ftype="text", order=15),
        # S5Q16 — UPDATED: options match Draft 5
        field("avg_annual_mortality",
              "Average annual mortality in your farm?",
              "Combien de mortalités enregistrez-vous en moyenne par an dans votre exploitation?",
              ftype="select", order=16,
              options=select_opts([
                  ("few_per_year", "A few animals per year",
                   "Quelques sujets par an"),
                  ("half_herd", "Half the herd can die",
                   "Souvent la moitié du troupeau peut mourir"),
                  ("most_herd", "Most of the herd",
                   "Une majeure partie du troupeau"),
                  ("almost_all", "Almost the entire herd",
                   "Presque tout le troupeau"),
              ])),
        # S5Q17 — NEW: most affected subjects
        field("most_affected_subjects",
              "Which animals pay the heaviest toll (die most)? (multiple choice)",
              "Quels sujets paient le plus lourd tribut (qui meurent le plus)? (choix multiple)",
              ftype="multi-select", order=17, columnSpan=2,
              options=select_opts([
                  ("young", "Young animals", "Les jeunes animaux"),
                  ("adults", "Adults", "Les adultes"),
                  ("young_and_adults", "Young and adults", "Les jeunes et les adultes"),
                  ("sheep_only", "Sheep only", "Les moutons uniquement"),
                  ("goats_only", "Goats only", "Les chèvres seulement"),
                  ("both_species", "Both species", "Les deux espèces"),
              ])),
        # S5Q18
        field("neighbors_same_disease",
              "Do you also observe this disease in neighboring farms during high mortality periods?",
              "Observez-vous cette maladie dans les élevages voisins lors des périodes de fortes mortalités?",
              ftype="select", order=18, options=yes_no()),
        # S5Q19 — NEW
        field("survivors_last_disease",
              "Are there currently survivors from the last disease in your herd?",
              "Y a-t-il actuellement dans votre troupeau des animaux survivants de la dernière maladie?",
              ftype="select", order=19, options=yes_no()),
        # S5Q20 — NEW: management of sick animals (expanded)
        field("sick_mgmt_ppr",
              "If yes, how do you manage these sick animals? (multiple choice)",
              "Si oui, comment gérez-vous ces animaux malades? (choix multiple)",
              ftype="multi-select", order=20, columnSpan=2,
              options=select_opts([
                  ("call_vet", "Call a veterinarian",
                   "Je fais appel à un vétérinaire"),
                  ("buy_market_drugs", "Buy vet products at local market and treat myself",
                   "J'achète des produits vétérinaires sur le marché local et je traite moi-même"),
                  ("traditional_treatment", "Traditional treatment (specify if possible)",
                   "Je traite avec des produits traditionnels (préciser si possible)"),
                  ("isolate", "Isolate sick animals",
                   "J'isole les animaux malades"),
                  ("sell_sick", "Sell animals showing signs",
                   "Je vends les animaux présentant les signes de la maladie"),
                  ("kill_consume", "Kill and consume with family",
                   "Je tue pour consommer avec ma famille"),
                  ("kill_sell_meat", "Kill and sell the meat",
                   "Je tue et je vends la viande"),
                  ("other", "Other", "Autres"),
              ])),
        # S5Q21 — NEW: carcass management
        field("carcass_management_ppr",
              "What do you do with carcasses? (multiple choice)",
              "Que faites-vous des cadavres? (choix multiple)",
              ftype="multi-select", order=21, columnSpan=2,
              options=select_opts([
                  ("consume", "I consume the meat", "Je consomme la viande"),
                  ("discard_nature", "I discard in nature", "Je jette dans la nature"),
                  ("bury", "I bury them", "Je fais enfouir"),
                  ("burn", "I burn them", "Je fais brûler"),
                  ("other", "Other", "Autres"),
              ])),
        # S5Q22
        field("sheep_price", "Average sheep price on local market (FCFA)",
              "Prix moyen d'un mouton sur le marché local (FCFA)",
              ftype="number", order=22, validation={"min": 0}),
        field("goat_price", "Average goat price on local market (FCFA)",
              "Prix moyen d'une chèvre sur le marché local (FCFA)",
              ftype="number", order=23, validation={"min": 0}),
        # S5Q23 — UPDATED: options match Draft 5
        field("prevention_measures",
              "What do you do to protect your animals from PPR? (multiple choice)",
              "Que faites-vous pour protéger vos animaux de la PPR? (choix multiple)",
              ftype="multi-select", order=24, columnSpan=2,
              options=select_opts([
                  ("vaccinate_vet", "Vaccinate via local vet",
                   "Je vaccine mes animaux par le vétérinaire de ma localité"),
                  ("sell_mortality_season", "Sell during mortality seasons",
                   "Je vends mes animaux pendant les saisons de mortalités"),
                  ("no_communal_pasture", "No communal pasture",
                   "Je ne pratique pas de pâturage commun dans le village"),
                  ("tethered", "Animals tethered on rope",
                   "Mes animaux sont attachés à la corde"),
                  ("nothing", "Nothing", "Je ne fais rien"),
                  ("other", "Other", "Autres"),
              ])),
    ],
))

# ── S6: CONTROLE ET ERADICATION DE LA PPR ──
sections.append(section(
    "PPR Control & Eradication",
    "Contrôle et Eradication de la PPR", 6,
    columns=2, color="#0891B2",
    fields_list=[
        # S6Q1
        field("vaccinated_ppr",
              "Is your herd vaccinated against PPR?",
              "Votre troupeau est-il vacciné contre la peste des petits ruminants?",
              ftype="select", order=0, required=True, options=yes_no_dontknow()),
        # S6Q2
        field("last_vaccination_year",
              "If yes, last year of PPR vaccination?",
              "Si oui, dernière année de vaccination contre la PPR?",
              ftype="select", order=1,
              options=select_opts([
                  ("2020", "2020", "2020"), ("2021", "2021", "2021"),
                  ("2022", "2022", "2022"), ("2023", "2023", "2023"),
                  ("2024", "2024", "2024"), ("2025", "2025", "2025"),
                  ("2026", "2026 (this year)", "Cette année (2026)"),
              ])),
        # S6Q3
        field("vaccination_provider",
              "Who performed the vaccination?",
              "Cette vaccination a été effectuée par qui?",
              ftype="select", order=2,
              options=select_opts([
                  ("ministry_campaign",
                   "Ministry vaccination campaign",
                   "Campagne de vaccination du Ministère en charge de l'élevage"),
                  ("private_vet", "Private veterinarian", "Vétérinaire privé"),
                  ("ngo", "NGO", "ONG"),
                  ("other", "Other", "Autres"),
              ])),
        # S6Q4
        field("vaccination_effect",
              "What was the effect of vaccination on mortalities?",
              "Quel en était l'effet de cette vaccination sur les mortalités dans votre troupeau?",
              ftype="select", order=3,
              options=select_opts([
                  ("decreased", "Decreased significantly",
                   "Elles ont baissé considérablement"),
                  ("increased", "Increased after vaccination",
                   "Les mortalités ont augmenté après la vaccination"),
                  ("no_change", "No change", "Rien n'a changé"),
                  ("other", "Other", "Autres"),
              ])),
        # S6Q5
        field("main_problems",
              "3 main problems in small ruminant farming",
              "Citez trois principaux problèmes que vous rencontrez le plus souvent dans l'élevage des petits ruminants",
              ftype="textarea", order=4, columnSpan=2),
        # S6Q6 — UPDATED: added "aggravates"
        field("vaccination_importance",
              "What do you think of PPR vaccination importance?",
              "Que pensez-vous de l'importance de la vaccination contre la PPR?",
              ftype="select", order=5, columnSpan=2,
              options=select_opts([
                  ("protects", "Protects animals against high mortality",
                   "Elle protège mes animaux contre les fortes mortalités"),
                  ("aggravates", "Aggravates mortality",
                   "Aggrave les mortalités"),
                  ("no_interest", "No interest in my opinion",
                   "Sans intérêt selon moi"),
                  ("other", "Other", "Autres"),
              ])),
        # S6Q7
        field("willing_to_revaccinate", "Willing to do it again?",
              "Êtes-vous prêts à recommencer?",
              ftype="select", order=6, options=yes_no()),
        # S6Q8
        field("willing_to_pay", "If yes, willing to pay the cost?",
              "Si oui, êtes-vous prêt à payer le coût?",
              ftype="select", order=7, options=yes_no()),
        # S6Q9 — UPDATED: cultural/social instead of expensive/unavailable
        field("refusal_reasons",
              "If not, reasons for vaccination refusal (multiple choice)",
              "Sinon, quelles sont vos raisons de refus de vaccination? (choix multiple)",
              ftype="multi-select", order=8, columnSpan=2,
              options=select_opts([
                  ("no_trust_vet", "No trust in veterinary services",
                   "Non-confiance aux services vétérinaires"),
                  ("rumors", "Rumors / disinformation (specify)",
                   "Rumeurs / désinformation (préciser)"),
                  ("cultural_social", "Cultural / social reasons (specify)",
                   "Raisons culturelles / sociales (préciser)"),
                  ("other", "Other", "Autres"),
              ])),
        # S6Q10
        field("accept_ear_notch",
              "Would you accept ear notch marking during vaccination?",
              "Accepteriez-vous que l'on marque votre animal (encoche à l'oreille) pendant la vaccination?",
              ftype="select", order=9, options=yes_no()),
        # S6Q11
        field("ear_notch_refusal_reasons",
              "If not, reasons for refusal (multiple choice)",
              "Si non, quelles sont vos raisons? (choix multiple)",
              ftype="multi-select", order=10, columnSpan=2,
              options=select_opts([
                  ("loses_value", "Animal loses value",
                   "Mon animal perd sa valeur"),
                  ("religious", "Religious beliefs forbid it",
                   "C'est interdit par mes croyances religieuses"),
                  ("traditional", "Traditional beliefs forbid it",
                   "C'est interdit par mes croyances traditionnelles"),
                  ("other", "Other", "Autres"),
              ])),
    ],
))

# ── S7: TABLEAU DES PRELEVEMENTS ──
# UPDATED: EON → EV (Ecouvillon Vaginal)
sections.append(section(
    "Sampling Table (15 subjects per herd/village)",
    "Tableau des Prélèvements (15 sujets par troupeau/village)", 7,
    columns=1, color="#EA580C",
    desc_en="Non-vaccinated animals only (max 15). Sample types: SE=Serum (dry tube), ECN=Conjunctival-Nasal Swab (VTM blue), EV=Vaginal Swab (detection of other pathologies)",
    desc_fr="Uniquement animaux non vaccinés (max 15). Types: SE=Sérum (tube sec), ECN=Écouvillon Conjonctivo-Nasal (VTM bleu), EV=Écouvillon Vaginal (recherche d'autres pathologies)",
    fields_list=[
        field("samples", "Samples", "Prélèvements",
              ftype="repeater", order=0, columnSpan=1,
              repeatMin=1, repeatMax=15,
              fields=[
                  {"code": "sample_species", "label": ml("Species", "Espèce"),
                   "type": "select",
                   "options": select_opts([
                       ("goat", "Goat", "Chèvre"),
                       ("sheep", "Sheep", "Mouton"),
                   ])},
                  {"code": "sample_sex", "label": ml("Sex", "Sexe"),
                   "type": "select",
                   "options": select_opts([
                       ("male", "Male (M)", "Mâle (M)"),
                       ("female", "Female (F)", "Femelle (F)"),
                   ])},
                  {"code": "sample_age", "label": ml("Age", "Âge"),
                   "type": "select",
                   "options": select_opts([
                       ("4_12m", "4-12 months", "4 à 12 mois"),
                       ("over_12m", ">12 months", ">12 mois"),
                   ])},
                  {"code": "sample_code",
                   "label": ml("Sample Code (Animal# / District / SampleType)",
                               "Code Prélèvement (N° animal / Arrondissement / Type)"),
                   "type": "text"},
                  {"code": "se", "label": ml("Serum (SE)", "Sérum (SE)"),
                   "type": "checkbox"},
                  {"code": "ecn",
                   "label": ml("Conjunctival-Nasal Swab (ECN)",
                               "Écouvillon Conjonctivo-Nasal (ECN)"),
                   "type": "checkbox"},
                  {"code": "ev",
                   "label": ml("Vaginal Swab (EV)",
                               "Écouvillon Vaginal (EV)"),
                   "type": "checkbox"},
                  {"code": "lab_status",
                   "label": ml("Lab Status (LANAVET)", "Statut LANAVET"),
                   "type": "select",
                   "options": select_opts([
                       ("positive", "Positive", "Positif"),
                       ("negative", "Negative", "Négatif"),
                       ("doubtful", "Doubtful", "Douteux"),
                   ])},
              ]),
    ],
))

# ── S8: COORDONNEES GPS ──
sections.append(section(
    "GPS Coordinates (Required)", "Coordonnées GPS (Obligatoire)", 8,
    columns=1, color="#1E3A5F", collapsible=False,
    desc_en="GPS coordinates in decimal degrees (e.g. 6.8234 N / 13.4521 E)",
    desc_fr="Coordonnées GPS en degrés décimaux (ex : 6.8234 N / 13.4521 E)",
    fields_list=[
        field("geo_coordinates", "GPS Location", "Localisation GPS",
              ftype="geo-selector", order=0, required=True, columnSpan=1),
    ],
))

# S9 Signatures & Validation removed — paper-only section, not needed in digital form

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
    "name": "Enquête épidémiologique PPR — Draft 5 (28/05/2026)",
    "domain": "animal-health",
    "formType": "CAMPAIGN",
    "status": "PUBLISHED",
    "dataClassification": "RESTRICTED",
    "description": (
        "Cette enquête est conduite par le Ministère en charge de l'élevage. "
        "Le questionnaire a pour but de collecter des informations relatives à la "
        "peste des petits ruminants dans les élevages des différentes régions. "
        "Toutes les informations recueillies seront anonymes et confidentielles. "
        "Les résultats seront utilisés en vue de fournir des données épidémiologiques "
        "de référence nécessaires à la planification et à l'évaluation du Programme "
        "National de Contrôle et d'Eradication de la Peste des Petits Ruminants.\n\n"
        "Attention ! Remplir les questions validées dans vos pays respectifs tout en "
        "gardant strictement les codes harmonisés."
    ),
    "schema": schema,
    "uiSchema": {},
}

# ═══════════════════════════════════════════════
# DEPLOY
# ═══════════════════════════════════════════════


def main():
    target = "PROD" if "183" in VM_APP else "STG"
    print("=" * 60)
    print(f"  Creating PPR Survey Form v3 (Draft 5) on {target}")
    print("=" * 60)

    # Count fields
    total_fields = 0
    for s in sections:
        total_fields += len(s["fields"])
    print(f"  Sections: {len(sections)}")
    print(f"  Fields:   {total_fields}")

    if "--dry-run" in sys.argv:
        # Just dump the JSON
        with open("_ppr_schema_v3.json", "w", encoding="utf-8") as f:
            json.dump(template, f, ensure_ascii=False, indent=2)
        print(f"\n  Dry run: saved to _ppr_schema_v3.json ({len(json.dumps(template))} bytes)")
        return

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)

    # Login
    sftp = c.open_sftp()
    with sftp.file("/tmp/login.json", "w") as f:
        f.write(json.dumps({"email": "admin@au-aris.org", "password": "Aris2026@@4!0"}))
    sftp.close()

    chan = c.get_transport().open_session()
    chan.exec_command(
        'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login '
        '-H "Content-Type: application/json" -d @/tmp/login.json'
    )
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch:
                break
            out += ch
    except Exception:
        pass
    token = json.loads(out.decode())["data"]["accessToken"]
    print(f"  Login: OK")

    # Upload template JSON via stdin (avoids SFTP size issues)
    body = json.dumps(template, ensure_ascii=False)
    print(f"  Template JSON: {len(body)} bytes")

    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X POST http://localhost:3010/api/v1/form-builder/templates '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'--data-binary @-'
    )
    chan.settimeout(30)
    chan.sendall(body.encode("utf-8"))
    chan.shutdown_write()

    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch:
                break
            out += ch
    except Exception:
        pass

    try:
        resp = json.loads(out.decode(errors="replace"))
        if "data" in resp:
            tpl = resp["data"]
            print(f"\n  CREATED!")
            print(f"  ID:       {tpl.get('id')}")
            print(f"  Name:     {tpl.get('name')}")
            print(f"  Status:   {tpl.get('status')}")
            print(f"  Domain:   {tpl.get('domain')}")
            secs = tpl.get("schema", {}).get("sections", [])
            tf = sum(len(s.get("fields", [])) for s in secs)
            print(f"  Sections: {len(secs)}")
            print(f"  Fields:   {tf}")
        else:
            print(f"  FAILED: {resp.get('message', out.decode()[:300])}")
    except Exception as e:
        print(f"  ERROR: {e}")
        print(f"  Raw: {out.decode(errors='replace')[:300]}")

    c.close()
    print("\nDONE")


if __name__ == "__main__":
    main()
