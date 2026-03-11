import type { LucideIcon } from 'lucide-react';
import {
  Layers,
  Bug,
  Calendar,
  AlertTriangle,
  Stethoscope,
  Shield,
  XCircle,
  TestTube,
  Droplets,
  Factory,
  Store,
  MapPin,
  Wheat,
  Database,
  HeartPulse,
  Tractor,
  Fish,
  TreePine,
  Ship,
  Hexagon,
  Scale,
  Syringe,
  Microscope,
  Building2,
  Package,
  BarChart3,
  Anchor,
  Sailboat,
  Waves,
  MapPinned,
  ShieldCheck,
  Trees,
  Skull,
  Tag,
  Flower2,
  FileText,
  Users,
  PawPrint,
  Crosshair,
  Activity,
  Biohazard,
  CircleDot,
  Target,
  Bell,
  Zap,
  Truck,
  Heart,
  Home,
  Dna,
  Radio,
} from 'lucide-react';
import type { RefDataType } from '@/lib/api/ref-data-hooks';

// ─── Domain grouping ────────────────────────────────────────────────────────

export type RefDataDomain =
  | 'general'
  | 'animal-health'
  | 'livestock'
  | 'fisheries'
  | 'wildlife'
  | 'trade'
  | 'apiculture'
  | 'governance'
  | 'infrastructure';

export interface DomainConfig {
  slug: RefDataDomain;
  label: string;
  labelFr: string;
  description: string;
  descriptionFr: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const DOMAIN_CONFIG: DomainConfig[] = [
  {
    slug: 'general',
    label: 'General',
    labelFr: 'Général',
    description: 'Cross-cutting reference data: species, breeds, age groups, production systems',
    descriptionFr: 'Données de référence transversales : espèces, races, groupes d\'âge, systèmes de production',
    icon: Database,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    slug: 'animal-health',
    label: 'Animal Health',
    labelFr: 'Santé Animale',
    description: 'Diseases, clinical signs, vaccines, diagnostic tests, laboratories',
    descriptionFr: 'Maladies, signes cliniques, vaccins, tests diagnostiques, laboratoires',
    icon: HeartPulse,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    slug: 'livestock',
    label: 'Production & Livestock',
    labelFr: 'Production & Élevage',
    description: 'Livestock products, census methodologies',
    descriptionFr: 'Produits d\'élevage, méthodes de recensement',
    icon: Tractor,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    slug: 'fisheries',
    label: 'Fisheries & Aquaculture',
    labelFr: 'Pêche & Aquaculture',
    description: 'Gear types, vessel types, aquaculture farms, landing sites',
    descriptionFr: 'Engins de pêche, types de navires, fermes aquacoles, sites de débarquement',
    icon: Fish,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    slug: 'wildlife',
    label: 'Wildlife & Biodiversity',
    labelFr: 'Faune & Biodiversité',
    description: 'Conservation statuses, habitat types, wildlife crime types',
    descriptionFr: 'Statuts de conservation, types d\'habitat, types de crime faunique',
    icon: TreePine,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    slug: 'trade',
    label: 'Trade & SPS',
    labelFr: 'Commerce & SPS',
    description: 'Seizure reasons, checkpoints, abattoirs, markets, commodities',
    descriptionFr: 'Motifs de saisie, points de contrôle, abattoirs, marchés, produits de base',
    icon: Ship,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
  },
  {
    slug: 'apiculture',
    label: 'Apiculture',
    labelFr: 'Apiculture',
    description: 'Hive types, bee diseases, floral sources',
    descriptionFr: 'Types de ruches, maladies des abeilles, sources florales',
    icon: Hexagon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    slug: 'governance',
    label: 'Governance',
    labelFr: 'Gouvernance',
    description: 'Legal framework types, stakeholder types',
    descriptionFr: 'Types de cadres juridiques, types de parties prenantes',
    icon: Scale,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    slug: 'infrastructure',
    label: 'Infrastructures & Institutions',
    labelFr: 'Infrastructures & Institutions',
    description: 'Labs, markets, checkpoints, stations, offices and all infrastructure types',
    descriptionFr: 'Laboratoires, marchés, postes de contrôle, stations, bureaux et tous types d\'infrastructures',
    icon: Building2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
];

// ─── Ref data type config ───────────────────────────────────────────────────

export interface RefDataTypeConfig {
  slug: RefDataType;
  label: string;
  labelFr: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  domain: RefDataDomain;
  parentField?: string;
  parentType?: RefDataType;
  parentLabel?: string;
  extraColumns?: Array<{ key: string; label: string }>;
}

export const REF_DATA_TYPES: RefDataTypeConfig[] = [
  // ── General ──
  {
    slug: 'species-groups',
    label: 'Species Groups',
    labelFr: 'Groupes d\'espèces',
    icon: Layers,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    domain: 'general',
  },
  {
    slug: 'species',
    label: 'Species',
    labelFr: 'Espèces',
    icon: Bug,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    domain: 'general',
    parentField: 'groupId',
    parentType: 'species-groups',
    parentLabel: 'Group',
    extraColumns: [{ key: 'scientificName', label: 'Scientific Name' }],
  },
  {
    slug: 'breeds',
    label: 'Breeds',
    labelFr: 'Races',
    icon: PawPrint,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    domain: 'general',
    parentField: 'speciesId',
    parentType: 'species',
    parentLabel: 'Species',
    extraColumns: [
      { key: 'origin', label: 'Origin' },
      { key: 'purpose', label: 'Purpose' },
    ],
  },
  {
    slug: 'age-groups',
    label: 'Age Groups',
    labelFr: 'Groupes d\'âge',
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    domain: 'general',
    parentField: 'speciesId',
    parentType: 'species',
    parentLabel: 'Species',
    extraColumns: [
      { key: 'minMonths', label: 'Min Months' },
      { key: 'maxMonths', label: 'Max Months' },
    ],
  },
  {
    slug: 'production-systems',
    label: 'Production Systems',
    labelFr: 'Systèmes de production',
    icon: Wheat,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    domain: 'general',
    extraColumns: [{ key: 'category', label: 'Category' }],
  },
  {
    slug: 'sample-types',
    label: 'Sample Types',
    labelFr: 'Types de prélèvement',
    icon: TestTube,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    domain: 'general',
    extraColumns: [
      { key: 'category', label: 'Category' },
      { key: 'storageTemp', label: 'Storage Temp' },
    ],
  },

  // ── Animal Health ──
  {
    slug: 'diseases',
    label: 'Diseases',
    labelFr: 'Maladies',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    domain: 'animal-health',
    extraColumns: [
      { key: 'category', label: 'Category' },
      { key: 'oieCode', label: 'OIE Code' },
    ],
  },
  {
    slug: 'clinical-signs',
    label: 'Clinical Signs',
    labelFr: 'Signes cliniques',
    icon: Stethoscope,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    domain: 'animal-health',
    parentField: 'diseaseId',
    parentType: 'diseases',
    parentLabel: 'Disease',
    extraColumns: [{ key: 'severity', label: 'Severity' }],
  },
  {
    slug: 'control-measures',
    label: 'Control Measures',
    labelFr: 'Mesures de contrôle',
    icon: Shield,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    domain: 'animal-health',
    extraColumns: [{ key: 'type', label: 'Type' }],
  },
  {
    slug: 'contamination-sources',
    label: 'Contamination Sources',
    labelFr: 'Sources de contamination',
    icon: Droplets,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    domain: 'animal-health',
    extraColumns: [{ key: 'category', label: 'Category' }],
  },
  {
    slug: 'vaccine-types',
    label: 'Vaccine Types',
    labelFr: 'Types de vaccin',
    icon: Syringe,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    domain: 'animal-health',
    parentField: 'diseaseId',
    parentType: 'diseases',
    parentLabel: 'Disease',
    extraColumns: [
      { key: 'vaccineClass', label: 'Class' },
      { key: 'manufacturer', label: 'Manufacturer' },
    ],
  },
  {
    slug: 'test-types',
    label: 'Test Types',
    labelFr: 'Types de test',
    icon: Microscope,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    domain: 'animal-health',
    extraColumns: [
      { key: 'testCategory', label: 'Category' },
      { key: 'turnaroundDays', label: 'TAT (days)' },
    ],
  },
  {
    slug: 'labs',
    label: 'Laboratories',
    labelFr: 'Laboratoires',
    icon: Building2,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    domain: 'animal-health',
    extraColumns: [
      { key: 'labLevel', label: 'Level' },
      { key: 'bslLevel', label: 'BSL' },
    ],
  },

  // ── Production & Livestock ──
  {
    slug: 'livestock-products',
    label: 'Livestock Products',
    labelFr: 'Produits d\'élevage',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    domain: 'livestock',
    extraColumns: [{ key: 'productCategory', label: 'Category' }],
  },
  {
    slug: 'census-methodologies',
    label: 'Census Methodologies',
    labelFr: 'Méthodes de recensement',
    icon: BarChart3,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    domain: 'livestock',
    extraColumns: [{ key: 'methodType', label: 'Method' }],
  },

  // ── Fisheries & Aquaculture ──
  {
    slug: 'gear-types',
    label: 'Gear Types',
    labelFr: 'Engins de pêche',
    icon: Anchor,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    domain: 'fisheries',
    extraColumns: [{ key: 'gearCategory', label: 'Category' }],
  },
  {
    slug: 'vessel-types',
    label: 'Vessel Types',
    labelFr: 'Types de navire',
    icon: Sailboat,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    domain: 'fisheries',
    extraColumns: [
      { key: 'lengthCategory', label: 'Size' },
      { key: 'propulsionType', label: 'Propulsion' },
    ],
  },
  {
    slug: 'aquaculture-farm-types',
    label: 'Aquaculture Farm Types',
    labelFr: 'Types d\'exploitation aquacole',
    icon: Waves,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    domain: 'fisheries',
    extraColumns: [
      { key: 'waterType', label: 'Water' },
      { key: 'cultureSystem', label: 'System' },
    ],
  },
  {
    slug: 'landing-sites',
    label: 'Landing Sites',
    labelFr: 'Sites de débarquement',
    icon: MapPinned,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    domain: 'fisheries',
    extraColumns: [
      { key: 'adminLevel1', label: 'Region' },
      { key: 'capacity', label: 'Capacity' },
    ],
  },

  // ── Wildlife & Biodiversity ──
  {
    slug: 'conservation-statuses',
    label: 'Conservation Statuses',
    labelFr: 'Statuts de conservation',
    icon: ShieldCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    domain: 'wildlife',
    extraColumns: [{ key: 'iucnCode', label: 'IUCN Code' }],
  },
  {
    slug: 'habitat-types',
    label: 'Habitat Types',
    labelFr: 'Types d\'habitat',
    icon: Trees,
    color: 'text-lime-600',
    bgColor: 'bg-lime-50',
    domain: 'wildlife',
    extraColumns: [{ key: 'biome', label: 'Biome' }],
  },
  {
    slug: 'crime-types',
    label: 'Wildlife Crime Types',
    labelFr: 'Types de crime faunique',
    icon: Skull,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    domain: 'wildlife',
    extraColumns: [{ key: 'crimeCategory', label: 'Category' }],
  },

  // ── Trade & SPS ──
  {
    slug: 'seizure-reasons',
    label: 'Seizure Reasons',
    labelFr: 'Motifs de saisie',
    icon: XCircle,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    domain: 'trade',
    extraColumns: [{ key: 'category', label: 'Category' }],
  },
  {
    slug: 'checkpoints',
    label: 'Checkpoints',
    labelFr: 'Points de contrôle',
    icon: MapPin,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    domain: 'trade',
    extraColumns: [
      { key: 'type', label: 'Type' },
      { key: 'borderWith', label: 'Border With' },
    ],
  },
  {
    slug: 'abattoirs',
    label: 'Abattoirs',
    labelFr: 'Abattoirs',
    icon: Factory,
    color: 'text-stone-600',
    bgColor: 'bg-stone-50',
    domain: 'trade',
    extraColumns: [
      { key: 'type', label: 'Type' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'adminLevel1', label: 'Region' },
    ],
  },
  {
    slug: 'markets',
    label: 'Markets',
    labelFr: 'Marchés',
    icon: Store,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    domain: 'trade',
    extraColumns: [
      { key: 'type', label: 'Type' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'adminLevel1', label: 'Region' },
    ],
  },
  {
    slug: 'commodities',
    label: 'Commodities',
    labelFr: 'Produits de base',
    icon: Tag,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    domain: 'trade',
    extraColumns: [
      { key: 'hsCode', label: 'HS Code' },
      { key: 'commodityGroup', label: 'Group' },
    ],
  },

  // ── Apiculture ──
  {
    slug: 'hive-types',
    label: 'Hive Types',
    labelFr: 'Types de ruche',
    icon: Hexagon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    domain: 'apiculture',
    extraColumns: [{ key: 'hiveCategory', label: 'Category' }],
  },
  {
    slug: 'bee-diseases',
    label: 'Bee Diseases',
    labelFr: 'Maladies des abeilles',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    domain: 'apiculture',
    extraColumns: [
      { key: 'pathogenType', label: 'Pathogen' },
      { key: 'affectedCaste', label: 'Caste' },
    ],
  },
  {
    slug: 'floral-sources',
    label: 'Floral Sources',
    labelFr: 'Sources florales',
    icon: Flower2,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    domain: 'apiculture',
    extraColumns: [
      { key: 'floweringSeason', label: 'Season' },
      { key: 'nectarType', label: 'Nectar' },
    ],
  },

  // ── Governance ──
  {
    slug: 'legal-framework-types',
    label: 'Legal Framework Types',
    labelFr: 'Types de cadre juridique',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    domain: 'governance',
    extraColumns: [{ key: 'frameworkCategory', label: 'Category' }],
  },
  {
    slug: 'stakeholder-types',
    label: 'Stakeholder Types',
    labelFr: 'Types de parties prenantes',
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    domain: 'governance',
    extraColumns: [{ key: 'sector', label: 'Sector' }],
  },

  // ── Infrastructures & Institutions ──
  {
    slug: 'infrastructures',
    label: 'Infrastructures',
    labelFr: 'Infrastructures & Institutions',
    icon: Building2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    domain: 'infrastructure',
    extraColumns: [
      { key: 'category', label: 'Category' },
      { key: 'subType', label: 'Type' },
      { key: 'status', label: 'Status' },
    ],
  },

  // ── Phase 4 — WOAH/References-data enrichment ──

  // General
  {
    slug: 'animal-sexes',
    label: 'Animal Sexes',
    labelFr: 'Sexes',
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    domain: 'general',
  },
  {
    slug: 'animal-husbandries',
    label: 'Husbandry Types',
    labelFr: 'Types d\'élevage',
    icon: Home,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    domain: 'general',
  },
  {
    slug: 'genetic-diversities',
    label: 'Genetic Diversity',
    labelFr: 'Diversité génétique',
    icon: Dna,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    domain: 'general',
  },
  {
    slug: 'data-sources',
    label: 'Data Sources',
    labelFr: 'Sources de données',
    icon: Radio,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    domain: 'general',
    extraColumns: [{ key: 'abbreviation', label: 'Abbr.' }],
  },

  // Animal Health
  {
    slug: 'diagnosis-bases',
    label: 'Diagnosis Bases',
    labelFr: 'Bases de diagnostic',
    icon: Crosshair,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    domain: 'animal-health',
    extraColumns: [{ key: 'abbreviation', label: 'Abbr.' }],
  },
  {
    slug: 'body-parts',
    label: 'Body Parts',
    labelFr: 'Parties du corps',
    icon: Activity,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    domain: 'animal-health',
  },
  {
    slug: 'causal-agent-types',
    label: 'Causal Agent Types',
    labelFr: 'Types d\'agent causal',
    icon: Biohazard,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    domain: 'animal-health',
  },
  {
    slug: 'outbreak-statuses',
    label: 'Outbreak Statuses',
    labelFr: 'Statuts d\'épisode',
    icon: CircleDot,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    domain: 'animal-health',
  },
  {
    slug: 'epidemiological-unit-types',
    label: 'Epidemiological Unit Types',
    labelFr: 'Types d\'unité épidémiologique',
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    domain: 'animal-health',
  },
  {
    slug: 'notification-reasons',
    label: 'Notification Reasons',
    labelFr: 'Motifs de notification',
    icon: Bell,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    domain: 'animal-health',
  },
  {
    slug: 'source-of-infections',
    label: 'Sources of Infection',
    labelFr: 'Sources d\'infection',
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    domain: 'animal-health',
  },

  // Trade
  {
    slug: 'transport-modes',
    label: 'Transport Modes',
    labelFr: 'Modes de transport',
    icon: Truck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    domain: 'trade',
  },

  // Fisheries
  {
    slug: 'fish-families',
    label: 'Fish Families',
    labelFr: 'Familles de poissons',
    icon: Fish,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    domain: 'fisheries',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getTypeConfig(slug: string): RefDataTypeConfig | undefined {
  return REF_DATA_TYPES.find((t) => t.slug === slug);
}

export function getTypesByDomain(domain: RefDataDomain): RefDataTypeConfig[] {
  return REF_DATA_TYPES.filter((t) => t.domain === domain);
}

export function getDomainConfig(slug: RefDataDomain): DomainConfig | undefined {
  return DOMAIN_CONFIG.find((d) => d.slug === slug);
}
