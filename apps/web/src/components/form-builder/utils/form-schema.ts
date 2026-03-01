// FormBuilder — Types and schema definitions

export interface MultilingualText {
  en?: string;
  fr?: string;
  pt?: string;
  ar?: string;
  [key: string]: string | undefined;
}

export interface FieldConditionRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan'
    | 'greaterOrEqual' | 'lessOrEqual' | 'between' | 'isEmpty' | 'isNotEmpty'
    | 'in' | 'notIn' | 'isTrue' | 'isFalse' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface FieldCondition {
  id: string;
  type: 'visibility' | 'required' | 'readOnly' | 'value';
  action: 'show' | 'hide' | 'enable' | 'disable' | 'setRequired' | 'setValue';
  logic: 'all' | 'any';
  rules: FieldConditionRule[];
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
  disableFuture?: boolean;
  disablePast?: boolean;
  maxSize?: number;
  maxFiles?: number;
  accept?: string;
  customMessage?: MultilingualText;
}

export interface SelectOption {
  label: MultilingualText;
  value: string;
}

export interface FormField {
  id: string;
  type: string;
  code: string;
  label: MultilingualText;
  placeholder?: MultilingualText;
  helpText?: MultilingualText;
  column: number;
  columnSpan: number;
  order: number;
  required: boolean;
  readOnly: boolean;
  hidden: boolean;
  defaultValue?: unknown;
  validation: FieldValidation;
  conditions: FieldCondition[];
  properties: Record<string, unknown>;
}

export interface FormSection {
  id: string;
  name: MultilingualText;
  description?: MultilingualText;
  columns: number;
  order: number;
  isCollapsible: boolean;
  isCollapsed: boolean;
  isRepeatable: boolean;
  repeatMin?: number;
  repeatMax?: number;
  icon?: string;
  color?: string;
  conditions: FieldCondition[];
  fields: FormField[];
}

export interface FormSettings {
  allowDraft: boolean;
  allowAttachments: boolean;
  maxAttachments: number;
  allowOffline: boolean;
  requireGeoLocation: boolean;
  autoSaveInterval: number;
  submissionWorkflow: string;
  notifyOnSubmit: string[];
  duplicateDetection: {
    enabled: boolean;
    fields: string[];
  };
}

export interface FormSchema {
  sections: FormSection[];
  settings: FormSettings;
}

export interface FormTemplateData {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  version: number;
  parentTemplateId: string | null;
  schema: FormSchema;
  uiSchema: Record<string, unknown>;
  dataContractId: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  dataClassification: string;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createDefaultField(type: string, sectionId: string): FormField {
  const id = crypto.randomUUID();
  return {
    id,
    type,
    code: '',
    label: { en: '' },
    placeholder: { en: '' },
    helpText: { en: '' },
    column: 1,
    columnSpan: 1,
    order: 0,
    required: false,
    readOnly: false,
    hidden: false,
    defaultValue: null,
    validation: {},
    conditions: [],
    properties: getDefaultPropertiesForType(type),
  };
}

export function createDefaultSection(): FormSection {
  return {
    id: crypto.randomUUID(),
    name: { en: 'New Section' },
    description: { en: '' },
    columns: 2,
    order: 0,
    isCollapsible: true,
    isCollapsed: false,
    isRepeatable: false,
    conditions: [],
    fields: [],
  };
}

export function createDefaultFormSchema(): FormSchema {
  return {
    sections: [createDefaultSection()],
    settings: {
      allowDraft: true,
      allowAttachments: true,
      maxAttachments: 10,
      allowOffline: true,
      requireGeoLocation: false,
      autoSaveInterval: 30,
      submissionWorkflow: 'review_then_validate',
      notifyOnSubmit: [],
      duplicateDetection: { enabled: false, fields: [] },
    },
  };
}

function getDefaultPropertiesForType(type: string): Record<string, unknown> {
  switch (type) {
    case 'select':
    case 'radio':
      return { options: [], layout: 'vertical' };
    case 'multi-select':
    case 'checkbox':
      return { options: [], maxSelections: undefined };
    case 'toggle':
      return { labelOn: { en: 'Yes' }, labelOff: { en: 'No' } };
    case 'rating':
      return { max: 5, icon: 'star' };
    case 'master-data-select':
      return { masterDataType: '', displayField: 'name', valueField: 'id', multiple: false, searchable: true };
    case 'form-data-select':
      return { sourceFormId: '', sourceFieldCode: '', valueFieldCode: '', multiple: false, searchable: true };
    case 'date':
      return { disableFuture: false, disablePast: false };
    case 'date-range':
      return {};
    case 'admin-location':
      return { levels: [1, 2, 3], requiredLevels: [1] };
    case 'geo-point':
      return { autoDetect: true, allowManualEntry: true, showMap: true };
    case 'geo-polygon':
      return { showMap: true, maxPoints: 50 };
    case 'geo-selector':
      return { allowedTypes: ['point', 'polygon'], defaultType: 'point' };
    case 'file-upload':
      return { accept: '*/*', maxSize: 10485760, maxFiles: 5 };
    case 'image':
      return { accept: 'image/*', maxSize: 5242880, maxFiles: 5, allowCamera: true };
    case 'signature':
      return { width: 400, height: 200, penColor: '#000000' };
    case 'calculated':
      return { formula: '' };
    case 'auto-id':
      return { prefix: '', format: '{SEQ}' };
    case 'heading':
      return { level: 'h3', text: { en: '' } };
    case 'info-box':
      return { text: { en: '' }, type: 'info' };
    case 'spacer':
      return { height: 24 };
    case 'repeater':
      return { fields: [], minRows: 1, maxRows: 10, addLabel: { en: 'Add row' } };
    case 'matrix':
      return { rows: [], columns: [], cellType: 'number' };
    case 'number':
      return { min: undefined, max: undefined, step: 1, decimals: 0, unit: '' };
    case 'textarea':
      return { rows: 4, autoResize: true };
    default:
      return {};
  }
}

export function generateCodeFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'field';
}
