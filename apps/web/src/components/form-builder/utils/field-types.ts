// FormBuilder — Field type registry with metadata
import {
  Type,
  Hash,
  Mail,
  Phone,
  Link2,
  AlignLeft,
  FileText,
  ListOrdered,
  CheckSquare,
  ToggleLeft,
  Star,
  Calendar,
  Clock,
  CalendarRange,
  CalendarDays,
  MapPin,
  Navigation,
  Pencil,
  Upload,
  Image,
  Calculator,
  Fingerprint,
  Search,
  Heading,
  Minus,
  Info,
  Space,
  Repeat,
  Grid3X3,
  Eye,
  Database,
  FileSpreadsheet,
  Layers,
  Map,
  Route,
  Pentagon,
  MapPinned,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FieldTypeDefinition {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: FieldCategory;
  defaultProperties?: Record<string, unknown>;
}

export type FieldCategory =
  | 'text'
  | 'choice'
  | 'data-source'
  | 'date-time'
  | 'location'
  | 'media'
  | 'calculation'
  | 'layout'
  | 'advanced';

export const FIELD_CATEGORIES: { key: FieldCategory; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'choice', label: 'Choice' },
  { key: 'data-source', label: 'Data Source' },
  { key: 'date-time', label: 'Date & Time' },
  { key: 'location', label: 'Location' },
  { key: 'media', label: 'Media' },
  { key: 'calculation', label: 'Calculation' },
  { key: 'layout', label: 'Layout' },
  { key: 'advanced', label: 'Advanced' },
];

export const FIELD_TYPES: FieldTypeDefinition[] = [
  // Text
  { type: 'text', label: 'Text', description: 'Single line text input', icon: Type, category: 'text' },
  { type: 'textarea', label: 'Text Area', description: 'Multi-line text input', icon: AlignLeft, category: 'text' },
  { type: 'number', label: 'Number', description: 'Numeric input with validation', icon: Hash, category: 'text' },
  { type: 'email', label: 'Email', description: 'Email with validation', icon: Mail, category: 'text' },
  { type: 'phone', label: 'Phone', description: 'Phone number with country code', icon: Phone, category: 'text' },
  { type: 'url', label: 'URL', description: 'Web address input', icon: Link2, category: 'text' },

  // Choice
  { type: 'select', label: 'Select', description: 'Dropdown list', icon: ListOrdered, category: 'choice' },
  { type: 'multi-select', label: 'Multi Select', description: 'Multiple selection list', icon: CheckSquare, category: 'choice' },
  { type: 'radio', label: 'Radio', description: 'Single choice radio buttons', icon: CheckSquare, category: 'choice' },
  { type: 'checkbox', label: 'Checkbox', description: 'Multiple choice checkboxes', icon: CheckSquare, category: 'choice' },
  { type: 'toggle', label: 'Toggle', description: 'On/Off switch', icon: ToggleLeft, category: 'choice' },
  { type: 'rating', label: 'Rating', description: 'Star or scale rating', icon: Star, category: 'choice' },

  // Data Source
  { type: 'master-data-select', label: 'Master Data', description: 'Select from master data', icon: Database, category: 'data-source' },
  { type: 'form-data-select', label: 'Form Data', description: 'Select from another form', icon: FileSpreadsheet, category: 'data-source' },
  { type: 'cascade-select', label: 'Cascade Select', description: 'Chained select chain', icon: Layers, category: 'data-source' },

  // Date & Time
  { type: 'date', label: 'Date', description: 'Date picker', icon: Calendar, category: 'date-time' },
  { type: 'time', label: 'Time', description: 'Time picker', icon: Clock, category: 'date-time' },
  { type: 'datetime', label: 'Date & Time', description: 'Combined date and time', icon: CalendarDays, category: 'date-time' },
  { type: 'date-range', label: 'Date Range', description: 'Start and end date', icon: CalendarRange, category: 'date-time' },

  // Location
  { type: 'admin-location', label: 'Admin Location', description: 'Administrative hierarchy', icon: MapPin, category: 'location' },
  { type: 'geo-point', label: 'GPS Point', description: 'Latitude & longitude', icon: Navigation, category: 'location' },
  { type: 'geo-polygon', label: 'Area/Polygon', description: 'Draw area on map', icon: Pentagon, category: 'location' },
  { type: 'geo-selector', label: 'Geo Selector', description: 'Point, line, or polygon', icon: MapPinned, category: 'location' },

  // Media
  { type: 'file-upload', label: 'File Upload', description: 'Upload documents', icon: Upload, category: 'media' },
  { type: 'image', label: 'Image', description: 'Upload images', icon: Image, category: 'media' },
  { type: 'signature', label: 'Signature', description: 'Handwritten signature', icon: Pencil, category: 'media' },

  // Calculation
  { type: 'calculated', label: 'Calculated', description: 'Auto-calculated value', icon: Calculator, category: 'calculation' },
  { type: 'auto-id', label: 'Auto ID', description: 'Auto-generated identifier', icon: Fingerprint, category: 'calculation' },
  { type: 'lookup', label: 'Lookup', description: 'Value from another source', icon: Search, category: 'calculation' },

  // Layout
  { type: 'heading', label: 'Heading', description: 'Section title/subtitle', icon: Heading, category: 'layout' },
  { type: 'divider', label: 'Divider', description: 'Horizontal line separator', icon: Minus, category: 'layout' },
  { type: 'info-box', label: 'Info Box', description: 'Information callout', icon: Info, category: 'layout' },
  { type: 'spacer', label: 'Spacer', description: 'Vertical space', icon: Space, category: 'layout' },

  // Advanced
  { type: 'repeater', label: 'Repeater', description: 'Repeatable field group', icon: Repeat, category: 'advanced' },
  { type: 'matrix', label: 'Matrix', description: 'Grid/table data entry', icon: Grid3X3, category: 'advanced' },
  { type: 'conditional-group', label: 'Conditional', description: 'Fields shown on condition', icon: Eye, category: 'advanced' },
];

const _fieldTypeMap: Record<string, FieldTypeDefinition> = {};
for (const ft of FIELD_TYPES) _fieldTypeMap[ft.type] = ft;

export function getFieldTypeDefinition(type: string): FieldTypeDefinition | undefined {
  return _fieldTypeMap[type];
}

export const DOMAIN_OPTIONS = [
  { value: 'animal-health', label: 'Animal Health' },
  { value: 'livestock-prod', label: 'Livestock & Production' },
  { value: 'fisheries', label: 'Fisheries & Aquaculture' },
  { value: 'trade-sps', label: 'Trade & SPS' },
  { value: 'wildlife', label: 'Wildlife & Biodiversity' },
  { value: 'apiculture', label: 'Apiculture' },
  { value: 'climate-env', label: 'Climate & Environment' },
  { value: 'governance', label: 'Governance & Capacities' },
];

export const MASTER_DATA_TYPES = [
  // Geography & Administrative
  { value: 'countries', label: 'Countries' },
  { value: 'geo-entities', label: 'Geographic Entities (Admin divisions)' },
  // Units
  { value: 'units', label: 'Units (SI + sectoral)' },
  // Animal Health — Core
  { value: 'species-groups', label: 'Species Groups' },
  { value: 'species', label: 'Species' },
  { value: 'breeds', label: 'Breeds' },
  { value: 'age-groups', label: 'Age Groups' },
  { value: 'diseases', label: 'Diseases' },
  { value: 'clinical-signs', label: 'Clinical Signs' },
  { value: 'control-measures', label: 'Control Measures' },
  { value: 'vaccine-types', label: 'Vaccine Types' },
  { value: 'test-types', label: 'Test Types' },
  { value: 'labs', label: 'Laboratories' },
  { value: 'sample-types', label: 'Sample Types' },
  // Animal Health — WOAH enrichment
  { value: 'diagnosis-bases', label: 'Diagnosis Bases' },
  { value: 'body-parts', label: 'Body Parts' },
  { value: 'causal-agent-types', label: 'Causal Agent Types' },
  { value: 'outbreak-statuses', label: 'Outbreak Statuses' },
  { value: 'epidemiological-unit-types', label: 'Epidemiological Unit Types' },
  { value: 'notification-reasons', label: 'Notification Reasons' },
  { value: 'source-of-infections', label: 'Source of Infections' },
  { value: 'animal-sexes', label: 'Animal Sexes' },
  { value: 'animal-husbandries', label: 'Animal Husbandries' },
  { value: 'genetic-diversities', label: 'Genetic Diversities' },
  { value: 'data-sources', label: 'Data Sources' },
  // Livestock & Production
  { value: 'production-systems', label: 'Production Systems' },
  { value: 'livestock-products', label: 'Livestock Products' },
  { value: 'census-methodologies', label: 'Census Methodologies' },
  { value: 'abattoirs', label: 'Abattoirs' },
  { value: 'markets', label: 'Markets' },
  { value: 'checkpoints', label: 'Checkpoints' },
  // Fisheries
  { value: 'fish-families', label: 'Fish Families' },
  { value: 'gear-types', label: 'Gear Types' },
  { value: 'vessel-types', label: 'Vessel Types' },
  { value: 'aquaculture-farm-types', label: 'Aquaculture Farm Types' },
  { value: 'landing-sites', label: 'Landing Sites' },
  // Trade & SPS
  { value: 'commodities', label: 'Commodities' },
  { value: 'contamination-sources', label: 'Contamination Sources' },
  { value: 'seizure-reasons', label: 'Seizure Reasons' },
  { value: 'transport-modes', label: 'Transport Modes' },
  // Wildlife
  { value: 'conservation-statuses', label: 'Conservation Statuses' },
  { value: 'habitat-types', label: 'Habitat Types' },
  { value: 'crime-types', label: 'Crime Types' },
  // Apiculture
  { value: 'hive-types', label: 'Hive Types' },
  { value: 'bee-diseases', label: 'Bee Diseases' },
  { value: 'floral-sources', label: 'Floral Sources' },
  // Governance
  { value: 'legal-framework-types', label: 'Legal Framework Types' },
  { value: 'stakeholder-types', label: 'Stakeholder Types' },
  { value: 'infrastructures', label: 'Infrastructures' },
];
