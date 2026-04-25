import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── System prompt AU-IBAR (shared by all templates) ────────────────────────

const SYSTEM_PROMPT_AUIBAR = `Tu es un expert en ressources animales au service de l'Union Africaine (AU-IBAR).
Tu rediges des rapports professionnels, structures, factuels et bases sur les donnees fournies.

Regles imperatives :
- Ne jamais mentionner PVS ou Performance of Veterinary Services.
- Ne jamais inventer de donnees. Si une donnee manque, indiquer "Donnee non disponible".
- Utiliser le systeme metrique et les unites standard AU-IBAR.
- Respecter la neutralite diplomatique entre Etats membres.
- Citer les sources (WAHIS, FAOSTAT, ARIS, recensement national) quand applicable.
- Langue de redaction : {{language}} (EN=anglais, FR=francais, PT=portugais, AR=arabe).
- Toujours inclure la mention "Source : ARIS 4.0 — AU-IBAR" en pied de page.
- Les donnees classifiees RESTRICTED ou CONFIDENTIAL ne doivent pas apparaitre dans les rapports publics.`;

// ─── Deterministic UUIDs for templates ──────────────────────────────────────

const TPL_IDS = {
  FLASH_INDICATOR_BREACH:    '10000000-0000-4000-b000-000000000001',
  FLASH_EPIDEMIC_OUTBREAK:   '10000000-0000-4000-b000-000000000002',
  FLASH_CAPACITY_ALERT:      '10000000-0000-4000-b000-000000000003',
  ANNUAL_DOMAIN_REPORT:      '10000000-0000-4000-b000-000000000004',
  ANNUAL_SUB_DOMAIN_REPORT:  '10000000-0000-4000-b000-000000000005',
  ANNUAL_CONTINENTAL:        '10000000-0000-4000-b000-000000000006',
  QUARTERLY_REC_REPORT:      '10000000-0000-4000-b000-000000000007',
  MONTHLY_BRIEF:             '10000000-0000-4000-b000-000000000008',
} as const;

// ─── Template definitions ───────────────────────────────────────────────────

interface TemplateSeed {
  id: string;
  code: string;
  type: 'FLASH' | 'ANNUAL_PROFESSIONAL' | 'PERIODIC_BRIEF' | 'AD_HOC';
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  scope: 'CONTINENTAL' | 'REGIONAL' | 'NATIONAL' | 'DOMAIN_FOCUSED' | 'SUBDOMAIN_FOCUSED' | 'CROSS_CUTTING';
  frequency: 'ON_DEMAND' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'EVENT_TRIGGERED';
  formats: ('PDF' | 'DOCX' | 'HTML' | 'MARKDOWN')[];
  sectionsConfig: object[];
  aiPrompts: object;
  triggerRules?: object;
  defaultRecipients: object[];
}

const TEMPLATES: TemplateSeed[] = [
  // ── 1. Flash Indicator Breach ─────────────────────────────────────
  {
    id: TPL_IDS.FLASH_INDICATOR_BREACH,
    code: 'FLASH_INDICATOR_BREACH',
    type: 'FLASH',
    titleFr: 'Flash — Depassement de seuil indicateur',
    titleEn: 'Flash — Indicator Threshold Breach',
    descriptionFr: 'Alerte flash generee automatiquement lorsqu\'un indicateur cle depasse un seuil critique defini.',
    descriptionEn: 'Flash alert auto-generated when a key indicator breaches a defined critical threshold.',
    scope: 'NATIONAL',
    frequency: 'EVENT_TRIGGERED',
    formats: ['PDF', 'HTML'],
    sectionsConfig: [
      {
        code: 'alert_header',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'En-tete de l\'alerte',
        titleEn: 'Alert Header',
      },
      {
        code: 'indicator_analysis',
        order: 2,
        sectionType: 'NARRATIVE',
        titleFr: 'Analyse de l\'indicateur',
        titleEn: 'Indicator Analysis',
      },
      {
        code: 'trend_chart',
        order: 3,
        sectionType: 'CHART',
        titleFr: 'Evolution temporelle',
        titleEn: 'Trend Over Time',
        config: { chartType: 'line', showThreshold: true },
      },
      {
        code: 'recommendations',
        order: 4,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations',
        titleEn: 'Recommendations',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        indicator_analysis: `Redige en {{language}} une analyse concise (200-300 mots) du depassement de seuil de l'indicateur "{{indicatorName}}".

Donnees fournies :
- Indicateur : {{indicatorName}} ({{indicatorCode}})
- Valeur actuelle : {{currentValue}} {{unit}}
- Seuil critique : {{thresholdValue}} {{unit}}
- Pays/Region : {{geographicScope}}
- Domaine : {{domainName}}
- Periode : {{periodStart}} a {{periodEnd}}
- Tendance recente : {{trendData}}

Structure attendue :
1. Constat factuel du depassement
2. Contexte historique (evolution recente)
3. Facteurs potentiels explicatifs
4. Comparaison regionale si disponible`,
        recommendations: `En tant qu'expert AU-IBAR, propose en {{language}} 3 a 5 recommandations operationnelles suite au depassement de seuil de "{{indicatorName}}" ({{currentValue}} vs seuil {{thresholdValue}}).

Contexte : {{domainName}} — {{geographicScope}}
Statistiques cles : {{keyStatistics}}

Les recommandations doivent etre :
- Actionnables a court terme (1-3 mois)
- Alignees sur les priorites AU-IBAR
- Realistes pour le contexte africain`,
      },
    },
    triggerRules: {
      type: 'INDICATOR_BREACH',
      conditions: [
        { field: 'value', operator: 'EXCEEDS_THRESHOLD', referenceField: 'thresholdValue' },
      ],
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
      { role: 'NATIONAL_ADMIN', channel: 'email' },
      { role: 'DATA_STEWARD', channel: 'in_app' },
    ],
  },

  // ── 2. Flash Epidemic Outbreak ────────────────────────────────────
  {
    id: TPL_IDS.FLASH_EPIDEMIC_OUTBREAK,
    code: 'FLASH_EPIDEMIC_OUTBREAK',
    type: 'FLASH',
    titleFr: 'Flash — Alerte epidemique',
    titleEn: 'Flash — Epidemic Outbreak Alert',
    descriptionFr: 'Alerte flash declenchee lors de la notification d\'un foyer epidemique confirme ou suspect de maladie a declaration obligatoire.',
    descriptionEn: 'Flash alert triggered upon notification of a confirmed or suspected outbreak of a notifiable disease.',
    scope: 'NATIONAL',
    frequency: 'EVENT_TRIGGERED',
    formats: ['PDF', 'HTML'],
    sectionsConfig: [
      {
        code: 'alert_header',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'En-tete de l\'alerte epidemique',
        titleEn: 'Epidemic Alert Header',
      },
      {
        code: 'situation_summary',
        order: 2,
        sectionType: 'EXECUTIVE_SUMMARY',
        titleFr: 'Resume de la situation',
        titleEn: 'Situation Summary',
      },
      {
        code: 'epidemiological_data',
        order: 3,
        sectionType: 'DATA_TABLE',
        titleFr: 'Donnees epidemiologiques',
        titleEn: 'Epidemiological Data',
        config: { columns: ['date', 'location', 'species', 'cases', 'deaths', 'status'] },
      },
      {
        code: 'outbreak_map',
        order: 4,
        sectionType: 'MAP',
        titleFr: 'Carte des foyers',
        titleEn: 'Outbreak Map',
        config: { mapType: 'point', showAdminBoundaries: true },
      },
      {
        code: 'risk_assessment',
        order: 5,
        sectionType: 'NARRATIVE',
        titleFr: 'Evaluation du risque',
        titleEn: 'Risk Assessment',
      },
      {
        code: 'response_recommendations',
        order: 6,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations de reponse',
        titleEn: 'Response Recommendations',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        situation_summary: `Redige en {{language}} un resume executif (150-250 mots) de l'alerte epidemique.

Donnees :
- Maladie : {{diseaseName}} (code WAHIS : {{wahisCode}})
- Pays : {{countryName}} ({{countryCode}})
- Date de detection : {{detectionDate}}
- Especes affectees : {{affectedSpecies}}
- Nombre de foyers : {{outbreakCount}}
- Cas confirmes : {{confirmedCases}}, Deces : {{deaths}}
- Zone affectee : {{affectedArea}}
- Statut WAHIS : {{wahisStatus}}

Le resume doit couvrir :
1. Nature et gravite de l'evenement
2. Extension geographique
3. Impact sur les populations animales
4. Implications pour la sante publique (si zoonose)`,
        risk_assessment: `Evalue en {{language}} le risque lie a ce foyer epidemique (300-400 mots).

Maladie : {{diseaseName}}
Pays : {{countryName}}
Donnees epidemiologiques : {{epidemiologicalData}}
Historique dans la region : {{historicalData}}
Capacites veterinaires nationales : {{veterinaryCapacity}}
Proximite frontaliere : {{borderProximity}}

Structure :
1. Probabilite de propagation nationale
2. Risque de propagation transfrontaliere
3. Impact economique potentiel
4. Risque pour la sante publique
5. Niveau de risque global (FAIBLE / MOYEN / ELEVE / CRITIQUE)`,
        response_recommendations: `Propose en {{language}} des recommandations de reponse (5-8 points) pour le foyer de {{diseaseName}} au {{countryName}}.

Statistiques cles : {{keyStatistics}}
Capacites disponibles : {{veterinaryCapacity}}

Categories de recommandations :
- Mesures de controle immediates
- Surveillance renforcee
- Communication avec les pays voisins
- Notification internationale (WAHIS)
- Soutien AU-IBAR / CER disponible`,
      },
    },
    triggerRules: {
      type: 'OUTBREAK_NOTIFICATION',
      conditions: [
        { field: 'status', operator: 'IN', values: ['CONFIRMED', 'SUSPECTED'] },
        { field: 'disease.isNotifiable', operator: 'EQUALS', value: true },
      ],
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
      { role: 'NATIONAL_ADMIN', channel: 'email' },
      { role: 'WAHIS_FOCAL_POINT', channel: 'email' },
      { role: 'DATA_STEWARD', channel: 'in_app' },
    ],
  },

  // ── 3. Flash Capacity Alert ───────────────────────────────────────
  {
    id: TPL_IDS.FLASH_CAPACITY_ALERT,
    code: 'FLASH_CAPACITY_ALERT',
    type: 'FLASH',
    titleFr: 'Flash — Alerte capacite',
    titleEn: 'Flash — Capacity Alert',
    descriptionFr: 'Alerte flash declenchee quand un indicateur de capacite veterinaire ou institutionnelle chute sous un seuil minimum.',
    descriptionEn: 'Flash alert triggered when a veterinary or institutional capacity indicator drops below minimum threshold.',
    scope: 'NATIONAL',
    frequency: 'EVENT_TRIGGERED',
    formats: ['PDF', 'HTML'],
    sectionsConfig: [
      {
        code: 'alert_header',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'En-tete alerte capacite',
        titleEn: 'Capacity Alert Header',
      },
      {
        code: 'capacity_analysis',
        order: 2,
        sectionType: 'NARRATIVE',
        titleFr: 'Analyse de la capacite',
        titleEn: 'Capacity Analysis',
      },
      {
        code: 'benchmark_table',
        order: 3,
        sectionType: 'DATA_TABLE',
        titleFr: 'Tableau comparatif regional',
        titleEn: 'Regional Benchmark Table',
        config: { columns: ['country', 'indicator', 'value', 'threshold', 'status'] },
      },
      {
        code: 'recommendations',
        order: 4,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations',
        titleEn: 'Recommendations',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        capacity_analysis: `Redige en {{language}} une analyse (200-300 mots) de la baisse de capacite detectee.

Donnees :
- Indicateur de capacite : {{capacityIndicator}}
- Pays : {{countryName}}
- Valeur actuelle : {{currentValue}}
- Seuil minimum : {{minimumThreshold}}
- Tendance : {{trendData}}
- Moyenne regionale (CER) : {{recAverage}}

Points a couvrir :
1. Nature de la degradation
2. Comparaison avec les standards regionaux
3. Consequences potentielles sur la surveillance et le controle des maladies
4. Facteurs structurels possibles`,
        recommendations: `Propose en {{language}} 3 a 5 recommandations pour renforcer la capacite "{{capacityIndicator}}" au {{countryName}}.

Contexte : valeur {{currentValue}} vs seuil {{minimumThreshold}}
Moyenne CER : {{recAverage}}
Budget disponible : {{budgetInfo}}

Recommandations attendues :
- Actions a court terme (3 mois)
- Investissements structurels (12 mois)
- Soutien AU-IBAR / partenaires mobilisables`,
      },
    },
    triggerRules: {
      type: 'CAPACITY_DROP',
      conditions: [
        { field: 'value', operator: 'BELOW_THRESHOLD', referenceField: 'minimumThreshold' },
      ],
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
      { role: 'NATIONAL_ADMIN', channel: 'email' },
    ],
  },

  // ── 4. Annual Domain Report ───────────────────────────────────────
  {
    id: TPL_IDS.ANNUAL_DOMAIN_REPORT,
    code: 'ANNUAL_DOMAIN_REPORT',
    type: 'ANNUAL_PROFESSIONAL',
    titleFr: 'Rapport annuel de domaine',
    titleEn: 'Annual Domain Report',
    descriptionFr: 'Rapport annuel professionnel couvrant un domaine metier complet (sante animale, elevage, peche, etc.) avec indicateurs, tendances et recommandations.',
    descriptionEn: 'Professional annual report covering a full business domain (animal health, livestock, fisheries, etc.) with indicators, trends and recommendations.',
    scope: 'DOMAIN_FOCUSED',
    frequency: 'ANNUAL',
    formats: ['PDF', 'DOCX'],
    sectionsConfig: [
      {
        code: 'cover',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'Page de couverture',
        titleEn: 'Cover Page',
      },
      {
        code: 'toc',
        order: 2,
        sectionType: 'TABLE_OF_CONTENTS',
        titleFr: 'Table des matieres',
        titleEn: 'Table of Contents',
      },
      {
        code: 'executive_summary',
        order: 3,
        sectionType: 'EXECUTIVE_SUMMARY',
        titleFr: 'Resume executif',
        titleEn: 'Executive Summary',
      },
      {
        code: 'methodology',
        order: 4,
        sectionType: 'METHODOLOGY',
        titleFr: 'Methodologie et sources',
        titleEn: 'Methodology and Sources',
      },
      {
        code: 'situation_overview',
        order: 5,
        sectionType: 'NARRATIVE',
        titleFr: 'Vue d\'ensemble de la situation',
        titleEn: 'Situation Overview',
      },
      {
        code: 'key_indicators',
        order: 6,
        sectionType: 'DATA_TABLE',
        titleFr: 'Indicateurs cles',
        titleEn: 'Key Indicators',
      },
      {
        code: 'trends_charts',
        order: 7,
        sectionType: 'CHART',
        titleFr: 'Tendances et graphiques',
        titleEn: 'Trends and Charts',
        config: { chartTypes: ['line', 'bar', 'pie'] },
      },
      {
        code: 'geographic_analysis',
        order: 8,
        sectionType: 'MAP',
        titleFr: 'Analyse geographique',
        titleEn: 'Geographic Analysis',
      },
      {
        code: 'country_profiles',
        order: 9,
        sectionType: 'DATA_TABLE',
        titleFr: 'Profils par pays',
        titleEn: 'Country Profiles',
      },
      {
        code: 'recommendations',
        order: 10,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations strategiques',
        titleEn: 'Strategic Recommendations',
      },
      {
        code: 'annexes',
        order: 11,
        sectionType: 'ANNEX',
        titleFr: 'Annexes',
        titleEn: 'Annexes',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        executive_summary: `Redige en {{language}} un resume executif professionnel (400-600 mots) pour le rapport annuel du domaine "{{domainName}}" — annee {{referenceYear}}.

Donnees cles fournies :
{{keyStatistics}}

Nombre de pays ayant rapporte : {{reportingCountries}}
Couverture geographique : {{geographicCoverage}}

Structure :
1. Faits saillants de l'annee
2. Progres par rapport a l'annee precedente
3. Defis majeurs identifies
4. Perspectives et priorites pour l'annee suivante

Ton : professionnel, diplomatique, factuel. Style rapport annuel d'organisation internationale.`,
        situation_overview: `Redige en {{language}} une analyse detaillee (800-1200 mots) de la situation du domaine "{{domainName}}" pour l'annee {{referenceYear}}.

Donnees par CER :
{{recBreakdown}}

Indicateurs cles :
{{keyStatistics}}

Evenements majeurs :
{{majorEvents}}

Structure :
1. Contexte continental
2. Situation par region (8 CER)
3. Performances notables (pays leaders)
4. Zones de preoccupation
5. Facteurs transversaux (climat, conflits, financement)`,
        recommendations: `Propose en {{language}} 8 a 12 recommandations strategiques pour le domaine "{{domainName}}" basees sur l'analyse de l'annee {{referenceYear}}.

Statistiques cles : {{keyStatistics}}
Defis identifies : {{challenges}}
Engagements internationaux : Agenda 2063, LiDeSA, PFRS

Categories :
- Renforcement des capacites (2-3 recommandations)
- Systemes d'information et donnees (2-3)
- Cooperation regionale et continentale (2-3)
- Mobilisation des ressources (1-2)
- Innovation et recherche (1-2)`,
      },
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
    ],
  },

  // ── 5. Annual Sub-Domain Report ───────────────────────────────────
  {
    id: TPL_IDS.ANNUAL_SUB_DOMAIN_REPORT,
    code: 'ANNUAL_SUB_DOMAIN_REPORT',
    type: 'ANNUAL_PROFESSIONAL',
    titleFr: 'Rapport annuel de sous-domaine',
    titleEn: 'Annual Sub-Domain Report',
    descriptionFr: 'Rapport annuel focalise sur un sous-domaine specifique (ex: surveillance, vaccination, aquaculture) avec analyse approfondie.',
    descriptionEn: 'Annual report focused on a specific sub-domain (e.g. surveillance, vaccination, aquaculture) with in-depth analysis.',
    scope: 'SUBDOMAIN_FOCUSED',
    frequency: 'ANNUAL',
    formats: ['PDF', 'DOCX'],
    sectionsConfig: [
      {
        code: 'cover',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'Page de couverture',
        titleEn: 'Cover Page',
      },
      {
        code: 'toc',
        order: 2,
        sectionType: 'TABLE_OF_CONTENTS',
        titleFr: 'Table des matieres',
        titleEn: 'Table of Contents',
      },
      {
        code: 'executive_summary',
        order: 3,
        sectionType: 'EXECUTIVE_SUMMARY',
        titleFr: 'Resume executif',
        titleEn: 'Executive Summary',
      },
      {
        code: 'methodology',
        order: 4,
        sectionType: 'METHODOLOGY',
        titleFr: 'Methodologie',
        titleEn: 'Methodology',
      },
      {
        code: 'subdomain_analysis',
        order: 5,
        sectionType: 'NARRATIVE',
        titleFr: 'Analyse detaillee du sous-domaine',
        titleEn: 'Detailed Sub-Domain Analysis',
      },
      {
        code: 'indicators_table',
        order: 6,
        sectionType: 'DATA_TABLE',
        titleFr: 'Indicateurs specialises',
        titleEn: 'Specialized Indicators',
      },
      {
        code: 'trends',
        order: 7,
        sectionType: 'CHART',
        titleFr: 'Tendances',
        titleEn: 'Trends',
      },
      {
        code: 'best_practices',
        order: 8,
        sectionType: 'NARRATIVE',
        titleFr: 'Bonnes pratiques identifiees',
        titleEn: 'Identified Best Practices',
      },
      {
        code: 'recommendations',
        order: 9,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations',
        titleEn: 'Recommendations',
      },
      {
        code: 'annexes',
        order: 10,
        sectionType: 'ANNEX',
        titleFr: 'Annexes',
        titleEn: 'Annexes',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        executive_summary: `Redige en {{language}} un resume executif (300-500 mots) pour le rapport annuel du sous-domaine "{{subDomainName}}" (domaine parent : {{domainName}}) — annee {{referenceYear}}.

Statistiques cles : {{keyStatistics}}
Pays couverts : {{reportingCountries}}

Structure :
1. Etat des lieux du sous-domaine au niveau continental
2. Faits marquants de l'annee
3. Progres et lacunes
4. Priorites pour l'annee suivante`,
        subdomain_analysis: `Analyse en {{language}} le sous-domaine "{{subDomainName}}" (800-1000 mots) pour l'annee {{referenceYear}}.

Donnees : {{keyStatistics}}
Repartition par CER : {{recBreakdown}}
Chaine de valeur : {{valueChainData}}

Couvrir :
1. Performance globale du sous-domaine
2. Disparites regionales
3. Tendances pluriannuelles
4. Liens avec les autres sous-domaines
5. Impact des politiques en vigueur`,
        recommendations: `Propose en {{language}} 5 a 8 recommandations specifiques au sous-domaine "{{subDomainName}}" pour {{referenceYear}}.

Base sur : {{keyStatistics}}
Defis : {{challenges}}
Bonnes pratiques : {{bestPractices}}`,
      },
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
    ],
  },

  // ── 6. Annual Continental Overview ────────────────────────────────
  {
    id: TPL_IDS.ANNUAL_CONTINENTAL,
    code: 'ANNUAL_CONTINENTAL_OVERVIEW',
    type: 'ANNUAL_PROFESSIONAL',
    titleFr: 'Vue d\'ensemble continentale annuelle',
    titleEn: 'Annual Continental Overview',
    descriptionFr: 'Rapport annuel continental couvrant l\'ensemble des 9 domaines, 55 Etats membres et 8 CER. Document phare AU-IBAR.',
    descriptionEn: 'Annual continental report covering all 9 domains, 55 Member States and 8 RECs. AU-IBAR flagship document.',
    scope: 'CONTINENTAL',
    frequency: 'ANNUAL',
    formats: ['PDF', 'DOCX'],
    sectionsConfig: [
      {
        code: 'cover',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'Page de couverture',
        titleEn: 'Cover Page',
      },
      {
        code: 'toc',
        order: 2,
        sectionType: 'TABLE_OF_CONTENTS',
        titleFr: 'Table des matieres',
        titleEn: 'Table of Contents',
      },
      {
        code: 'foreword',
        order: 3,
        sectionType: 'NARRATIVE',
        titleFr: 'Avant-propos du Directeur',
        titleEn: 'Director\'s Foreword',
      },
      {
        code: 'executive_summary',
        order: 4,
        sectionType: 'EXECUTIVE_SUMMARY',
        titleFr: 'Resume executif',
        titleEn: 'Executive Summary',
      },
      {
        code: 'methodology',
        order: 5,
        sectionType: 'METHODOLOGY',
        titleFr: 'Methodologie et couverture des donnees',
        titleEn: 'Methodology and Data Coverage',
      },
      {
        code: 'continental_dashboard',
        order: 6,
        sectionType: 'DATA_TABLE',
        titleFr: 'Tableau de bord continental',
        titleEn: 'Continental Dashboard',
      },
      {
        code: 'domain_health',
        order: 7,
        sectionType: 'NARRATIVE',
        titleFr: 'Sante animale et One Health',
        titleEn: 'Animal Health and One Health',
      },
      {
        code: 'domain_production',
        order: 8,
        sectionType: 'NARRATIVE',
        titleFr: 'Production et pastoralisme',
        titleEn: 'Production and Pastoralism',
      },
      {
        code: 'domain_fisheries',
        order: 9,
        sectionType: 'NARRATIVE',
        titleFr: 'Peche et aquaculture',
        titleEn: 'Fisheries and Aquaculture',
      },
      {
        code: 'domain_trade',
        order: 10,
        sectionType: 'NARRATIVE',
        titleFr: 'Commerce, marches et SPS',
        titleEn: 'Trade, Markets and SPS',
      },
      {
        code: 'domain_wildlife',
        order: 11,
        sectionType: 'NARRATIVE',
        titleFr: 'Faune et biodiversite',
        titleEn: 'Wildlife and Biodiversity',
      },
      {
        code: 'domain_apiculture',
        order: 12,
        sectionType: 'NARRATIVE',
        titleFr: 'Apiculture et pollinisation',
        titleEn: 'Apiculture and Pollination',
      },
      {
        code: 'domain_governance',
        order: 13,
        sectionType: 'NARRATIVE',
        titleFr: 'Gouvernance et capacites',
        titleEn: 'Governance and Capacities',
      },
      {
        code: 'domain_climate',
        order: 14,
        sectionType: 'NARRATIVE',
        titleFr: 'Climat et environnement',
        titleEn: 'Climate and Environment',
      },
      {
        code: 'domain_knowledge',
        order: 15,
        sectionType: 'NARRATIVE',
        titleFr: 'Gestion des connaissances',
        titleEn: 'Knowledge Management',
      },
      {
        code: 'rec_profiles',
        order: 16,
        sectionType: 'DATA_TABLE',
        titleFr: 'Profils des CER',
        titleEn: 'REC Profiles',
      },
      {
        code: 'continental_map',
        order: 17,
        sectionType: 'MAP',
        titleFr: 'Carte continentale synthetique',
        titleEn: 'Continental Synthesis Map',
      },
      {
        code: 'recommendations',
        order: 18,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations strategiques',
        titleEn: 'Strategic Recommendations',
      },
      {
        code: 'annexes',
        order: 19,
        sectionType: 'ANNEX',
        titleFr: 'Annexes statistiques',
        titleEn: 'Statistical Annexes',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        executive_summary: `Redige en {{language}} le resume executif (600-800 mots) de la vue d'ensemble continentale annuelle AU-IBAR — annee {{referenceYear}}.

Donnees :
- 9 domaines couverts
- {{reportingCountries}} pays ayant rapporte sur {{totalCountries}}
- Statistiques cles : {{keyStatistics}}
- Faits marquants : {{majorEvents}}

Ce document est le rapport phare d'AU-IBAR. Le ton doit etre :
- Strategique et synthetique
- Base sur les donnees ARIS 4.0
- Aligne sur l'Agenda 2063 et le Plan Strategique AU-IBAR 2024-2028
- Diplomatiquement neutre entre Etats membres`,
        foreword: `Redige en {{language}} un avant-propos du Directeur d'AU-IBAR (300-400 mots) pour la vue d'ensemble continentale {{referenceYear}}.

Themes a aborder :
- Progres realises dans la digitalisation (ARIS 4.0)
- Vision continentale pour les ressources animales
- Remerciements aux Etats membres, CER et partenaires
- Perspectives pour l'annee a venir

Ton : visionnaire, inclusif, reconnaissant.`,
        recommendations: `Propose en {{language}} 10 a 15 recommandations strategiques continentales pour AU-IBAR, basees sur l'analyse de l'annee {{referenceYear}}.

Statistiques : {{keyStatistics}}
Defis transversaux : {{challenges}}

Categories obligatoires :
1. Gouvernance et cadre institutionnel (2-3)
2. Sante animale et One Health (2-3)
3. Production et commerce (2-3)
4. Donnees et systemes d'information (2-3)
5. Cooperation internationale et mobilisation de ressources (2-3)`,
      },
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'email' },
      { role: 'NATIONAL_ADMIN', channel: 'email' },
    ],
  },

  // ── 7. Quarterly REC Report ───────────────────────────────────────
  {
    id: TPL_IDS.QUARTERLY_REC_REPORT,
    code: 'QUARTERLY_REC_REPORT',
    type: 'PERIODIC_BRIEF',
    titleFr: 'Rapport trimestriel CER',
    titleEn: 'Quarterly REC Report',
    descriptionFr: 'Rapport trimestriel synthetisant les indicateurs cles d\'une Communaute Economique Regionale (CER) sur tous les domaines.',
    descriptionEn: 'Quarterly report synthesizing key indicators of a Regional Economic Community (REC) across all domains.',
    scope: 'REGIONAL',
    frequency: 'QUARTERLY',
    formats: ['PDF'],
    sectionsConfig: [
      {
        code: 'cover',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'Page de couverture',
        titleEn: 'Cover Page',
      },
      {
        code: 'executive_summary',
        order: 2,
        sectionType: 'EXECUTIVE_SUMMARY',
        titleFr: 'Resume executif',
        titleEn: 'Executive Summary',
      },
      {
        code: 'kpi_dashboard',
        order: 3,
        sectionType: 'DATA_TABLE',
        titleFr: 'Tableau de bord des indicateurs',
        titleEn: 'Indicator Dashboard',
      },
      {
        code: 'trends',
        order: 4,
        sectionType: 'CHART',
        titleFr: 'Tendances trimestrielles',
        titleEn: 'Quarterly Trends',
        config: { chartTypes: ['line', 'bar'], compareWithPreviousQuarter: true },
      },
      {
        code: 'regional_map',
        order: 5,
        sectionType: 'MAP',
        titleFr: 'Carte regionale',
        titleEn: 'Regional Map',
      },
      {
        code: 'country_comparison',
        order: 6,
        sectionType: 'DATA_TABLE',
        titleFr: 'Comparaison entre pays membres',
        titleEn: 'Member Country Comparison',
      },
      {
        code: 'highlights_challenges',
        order: 7,
        sectionType: 'NARRATIVE',
        titleFr: 'Faits saillants et defis',
        titleEn: 'Highlights and Challenges',
      },
      {
        code: 'recommendations',
        order: 8,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Recommandations',
        titleEn: 'Recommendations',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        executive_summary: `Redige en {{language}} un resume executif (250-400 mots) du rapport trimestriel de la CER {{recName}} ({{recCode}}) — {{quarter}} {{referenceYear}}.

Pays membres : {{memberCountries}}
Indicateurs cles du trimestre : {{keyStatistics}}
Alertes du trimestre : {{quarterAlerts}}

Structure :
1. Performance globale de la CER ce trimestre
2. Faits marquants (positifs et negatifs)
3. Comparaison avec le trimestre precedent
4. Points d'attention pour le trimestre suivant`,
        highlights_challenges: `Presente en {{language}} les faits saillants et defis (400-600 mots) de la CER {{recName}} pour {{quarter}} {{referenceYear}}.

Donnees : {{keyStatistics}}
Alertes : {{quarterAlerts}}
Evenements : {{majorEvents}}

Structure :
- 3-5 faits saillants positifs
- 3-5 defis identifies
- Dynamiques regionales notables`,
        recommendations: `Propose en {{language}} 4 a 6 recommandations operationnelles pour la CER {{recName}} — {{quarter}} {{referenceYear}}.

Base sur : {{keyStatistics}}
Defis : {{challenges}}

Recommandations a court terme (trimestre suivant) et moyen terme (6-12 mois).`,
      },
    },
    defaultRecipients: [
      { role: 'REC_ADMIN', channel: 'email' },
      { role: 'NATIONAL_ADMIN', channel: 'email' },
    ],
  },

  // ── 8. Monthly Brief ──────────────────────────────────────────────
  {
    id: TPL_IDS.MONTHLY_BRIEF,
    code: 'MONTHLY_BRIEF',
    type: 'PERIODIC_BRIEF',
    titleFr: 'Note mensuelle',
    titleEn: 'Monthly Brief',
    descriptionFr: 'Note de synthese mensuelle couvrant les indicateurs cles, alertes et evenements du mois ecroule. Format court et actionnable.',
    descriptionEn: 'Monthly synthesis brief covering key indicators, alerts and events of the past month. Short and actionable format.',
    scope: 'CONTINENTAL',
    frequency: 'MONTHLY',
    formats: ['PDF', 'HTML'],
    sectionsConfig: [
      {
        code: 'header',
        order: 1,
        sectionType: 'COVER_PAGE',
        titleFr: 'En-tete',
        titleEn: 'Header',
      },
      {
        code: 'key_figures',
        order: 2,
        sectionType: 'DATA_TABLE',
        titleFr: 'Chiffres cles du mois',
        titleEn: 'Key Figures of the Month',
        config: { layout: 'kpi_cards', maxItems: 8 },
      },
      {
        code: 'alerts_summary',
        order: 3,
        sectionType: 'DATA_TABLE',
        titleFr: 'Resume des alertes',
        titleEn: 'Alerts Summary',
        config: { columns: ['date', 'type', 'country', 'severity', 'status'] },
      },
      {
        code: 'monthly_analysis',
        order: 4,
        sectionType: 'NARRATIVE',
        titleFr: 'Analyse du mois',
        titleEn: 'Monthly Analysis',
      },
      {
        code: 'trends_mini',
        order: 5,
        sectionType: 'CHART',
        titleFr: 'Mini tendances',
        titleEn: 'Mini Trends',
        config: { chartType: 'sparkline', maxCharts: 6 },
      },
      {
        code: 'action_items',
        order: 6,
        sectionType: 'RECOMMENDATIONS',
        titleFr: 'Points d\'action',
        titleEn: 'Action Items',
      },
    ],
    aiPrompts: {
      systemPrompt: SYSTEM_PROMPT_AUIBAR,
      sectionPrompts: {
        monthly_analysis: `Redige en {{language}} une analyse synthetique (300-500 mots) du mois de {{monthName}} {{referenceYear}} pour les ressources animales du continent africain.

Chiffres cles : {{keyStatistics}}
Alertes du mois : {{monthAlerts}}
Nouveaux rapports : {{newReports}}
Pays actifs : {{activeCountries}} / {{totalCountries}}

Format note de synthese : concis, factuel, oriente decision. Maximum 500 mots.`,
        action_items: `Liste en {{language}} 3 a 5 points d'action prioritaires pour le mois a venir, bases sur l'analyse de {{monthName}} {{referenceYear}}.

Statistiques : {{keyStatistics}}
Alertes en cours : {{activeAlerts}}

Chaque point doit indiquer :
- Action concrete
- Responsable (role AU-IBAR)
- Echeance suggeree`,
      },
    },
    defaultRecipients: [
      { role: 'CONTINENTAL_ADMIN', channel: 'email' },
      { role: 'REC_ADMIN', channel: 'in_app' },
    ],
  },
];

// ─── Main seed function ─────────────────────────────────────────────────────

async function seedReportTemplates() {
  console.log('Seeding report templates...');

  for (const tpl of TEMPLATES) {
    await prisma.reportTemplate.upsert({
      where: { code: tpl.code },
      update: {
        type: tpl.type,
        titleFr: tpl.titleFr,
        titleEn: tpl.titleEn,
        descriptionFr: tpl.descriptionFr,
        descriptionEn: tpl.descriptionEn,
        scope: tpl.scope,
        frequency: tpl.frequency,
        formats: tpl.formats,
        sectionsConfig: tpl.sectionsConfig,
        aiPrompts: tpl.aiPrompts,
        triggerRules: tpl.triggerRules ?? undefined,
        defaultRecipients: tpl.defaultRecipients,
        active: true,
        updatedAt: new Date(),
      },
      create: {
        id: tpl.id,
        code: tpl.code,
        type: tpl.type,
        titleFr: tpl.titleFr,
        titleEn: tpl.titleEn,
        descriptionFr: tpl.descriptionFr,
        descriptionEn: tpl.descriptionEn,
        scope: tpl.scope,
        frequency: tpl.frequency,
        formats: tpl.formats,
        sectionsConfig: tpl.sectionsConfig,
        aiPrompts: tpl.aiPrompts,
        triggerRules: tpl.triggerRules ?? undefined,
        defaultRecipients: tpl.defaultRecipients,
        active: true,
      },
    });

    console.log(`  [OK] ${tpl.code}`);
  }

  console.log(`\nSeeded ${TEMPLATES.length} report templates.`);
}

// ─── Run ────────────────────────────────────────────────────────────────────

seedReportTemplates()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
