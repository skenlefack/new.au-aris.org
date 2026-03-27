import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════
// ARIS 4.0 — FormBuilder Seed — 21 Official Data Collection Templates
// Source: ARIS_Dictionnaire_Champs_FormBuilder.xlsx (372 fields)
// ═══════════════════════════════════════════════════════════════════════

// ── Helpers ─────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

let fieldOrder = 0;

interface I18n { en: string; fr?: string; pt?: string; ar?: string }
interface FieldDef {
  id: string; type: string; code: string;
  label: I18n; helpText?: I18n; placeholder?: I18n;
  column: number; columnSpan: number; order: number;
  required: boolean; readOnly: boolean; hidden: boolean;
  validation: Record<string, unknown>;
  conditions: unknown[];
  properties: Record<string, unknown>;
}

function f(
  type: string, code: string, label: I18n,
  opts: {
    required?: boolean; helpText?: I18n;
    columnSpan?: number; column?: number;
    validation?: Record<string, unknown>;
    properties?: Record<string, unknown>;
  } = {},
): FieldDef {
  const order = fieldOrder++;
  return {
    id: uuid(), type, code,
    label,
    ...(opts.helpText ? { helpText: opts.helpText } : {}),
    column: opts.column ?? 1,
    columnSpan: opts.columnSpan ?? 1,
    order,
    required: opts.required ?? false,
    readOnly: false, hidden: false,
    validation: opts.validation ?? {},
    conditions: [],
    properties: opts.properties ?? {},
  };
}

function textField(code: string, label: I18n, opts: { required?: boolean; maxLength?: number; helpText?: I18n; columnSpan?: number } = {}) {
  return f('text', code, label, { required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan, validation: { maxLength: opts.maxLength ?? 255 } });
}

function numberField(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n; columnSpan?: number } = {}) {
  return f('number', code, label, { required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan, validation: { min: 0 }, properties: { step: 1 } });
}

function decimalField(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n; columnSpan?: number } = {}) {
  return f('number', code, label, { required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan, validation: { min: 0 }, properties: { step: 0.01, decimals: 2 } });
}

function dateField(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n; columnSpan?: number } = {}) {
  return f('date', code, label, { required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan, validation: { disableFuture: true } });
}

function selectField(code: string, label: I18n, options: Array<string | I18n>, opts: { required?: boolean; helpText?: I18n; columnSpan?: number } = {}) {
  return f('select', code, label, {
    required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan,
    properties: {
      options: options.map(o => {
        const lbl = typeof o === 'string' ? { en: o } : o;
        const val = (typeof o === 'string' ? o : o.en).toLowerCase().replace(/[\s,]+/g, '_');
        return { label: lbl, value: val };
      }),
    },
  });
}

function yesNoField(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n; columnSpan?: number } = {}) {
  return selectField(code, label, [
    { en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' },
    { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' },
  ], opts);
}

function speciesSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'species', searchable: true } });
}

function diseaseSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'diseases', searchable: true } });
}

function breedSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'breeds', searchable: true } });
}

function ageGroupSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'age-groups', searchable: true } });
}

function sexSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'animal-sexes', searchable: true } });
}

function controlMeasureSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'control-measures', searchable: true } });
}

function bodyPartSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'body-parts', searchable: true } });
}

function testTypeSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'test-types', searchable: true } });
}

function notificationReasonSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'notification-reasons', searchable: true } });
}

function transportModeSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'transport-modes', searchable: true } });
}

function livestockProductSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'livestock-products', searchable: true } });
}

function epiUnitTypeSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'epidemiological-unit-types', searchable: true } });
}

function animalHusbandrySelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'animal-husbandries', searchable: true } });
}

function sourceOfInfectionSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'source-of-infections', searchable: true } });
}

function outbreakStatusSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'outbreak-statuses', searchable: true } });
}

function diagnosisBasisSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'diagnosis-bases', searchable: true } });
}

function labSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'labs', searchable: true } });
}

function sampleTypeSelect(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n } = {}) {
  return f('master-data-select', code, label, { required: opts.required, helpText: opts.helpText, properties: { masterDataType: 'sample-types', searchable: true } });
}

function dataSourceSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return f('master-data-select', code, label, { required: opts.required, properties: { masterDataType: 'data-sources', searchable: true } });
}

function textareaField(code: string, label: I18n, opts: { required?: boolean; helpText?: I18n; columnSpan?: number; maxLength?: number } = {}) {
  return f('textarea', code, label, {
    required: opts.required, helpText: opts.helpText, columnSpan: opts.columnSpan,
    validation: { maxLength: opts.maxLength ?? 500 },
    properties: { rows: 4 },
  });
}

function makeLocalisationSection(order = 0) {
  fieldOrder = 0;
  return {
    id: uuid(),
    name: { en: 'Location', fr: 'Localisation', pt: 'Localização', ar: 'الموقع' },
    description: { en: 'Administrative location', fr: 'Localisation administrative', pt: 'Localização administrativa', ar: 'الموقع الإداري' },
    columns: 2, order, icon: 'MapPin', color: '#10B981',
    isCollapsible: false, isCollapsed: false, isRepeatable: false,
    conditions: [],
    fields: [
      f('admin-location', 'admin_location', { en: 'Administrative Location', fr: 'Localisation Administrative', pt: 'Localização Administrativa', ar: 'الموقع الإداري' }, {
        required: true, columnSpan: 2,
        properties: {
          levels: [0, 1, 2],
          requiredLevels: [0],
          autoSelectUserCountry: true,
          filterByUserTenant: true,
        },
      }),
    ],
  };
}

function makeGPSSection(order: number) {
  fieldOrder = 0;
  return {
    id: uuid(),
    name: { en: 'GPS Coordinates', fr: 'Coordonnées GPS', pt: 'Coordenadas GPS', ar: 'إحداثيات GPS' },
    description: { en: 'Geographic coordinates', fr: 'Coordonnées géographiques', pt: 'Coordenadas geográficas', ar: 'الإحداثيات الجغرافية' },
    columns: 1, order, icon: 'Navigation', color: '#06B6D4',
    isCollapsible: true, isCollapsed: false, isRepeatable: false,
    conditions: [],
    fields: [
      f('geo-selector', 'geo_coordinates', { en: 'Geographic Coordinates', fr: 'Coordonnées Géographiques', pt: 'Coordenadas Geográficas', ar: 'الإحداثيات الجغرافية' }, {
        helpText: { en: 'Choose coordinate type: Point, Line, or Polygon', fr: 'Choisissez le type de coordonnées : Point, Ligne ou Polygone', pt: 'Escolha o tipo de coordenada: Ponto, Linha ou Polígono', ar: 'اختر نوع الإحداثيات: نقطة أو خط أو مضلع' },
        properties: {
          modes: ['point', 'line', 'polygon'],
          defaultMode: 'point',
          autoDetect: true,
          showMap: true,
          allowManualEntry: true,
        },
      }),
    ],
  };
}

function makeRepeater(
  code: string, label: I18n,
  subFields: Array<{ type: string; code: string; label: I18n; properties?: Record<string, unknown>; required?: boolean }>,
  opts: { required?: boolean; addLabel?: I18n; minRows?: number; maxRows?: number } = {},
) {
  const order = fieldOrder++;
  return {
    id: uuid(), type: 'repeater', code,
    label,
    column: 1, columnSpan: 2, order,
    required: opts.required ?? true,
    readOnly: false, hidden: false,
    validation: {},
    conditions: [],
    properties: {
      minRows: opts.minRows ?? 1,
      maxRows: opts.maxRows ?? 20,
      addLabel: opts.addLabel ?? { en: 'Add row', fr: 'Ajouter une ligne', pt: 'Adicionar linha', ar: 'إضافة صف' },
      fields: subFields.map(sf => ({
        type: sf.type, code: sf.code, label: sf.label,
        required: sf.required ?? false,
        properties: sf.properties ?? {},
      })),
    },
  };
}

function makeSection(
  name: I18n, order: number,
  fields: unknown[],
  opts: { icon?: string; color?: string; columns?: number } = {},
) {
  return {
    id: uuid(), name,
    columns: opts.columns ?? 2, order,
    icon: opts.icon ?? 'FileText', color: opts.color ?? '#3B82F6',
    isCollapsible: true, isCollapsed: false, isRepeatable: false,
    conditions: [],
    fields,
  };
}

function makeSettings(opts: { requireGeoLocation?: boolean } = {}) {
  return {
    allowDraft: true,
    allowAttachments: true,
    maxAttachments: 5,
    allowOffline: true,
    requireGeoLocation: opts.requireGeoLocation ?? false,
    autoSaveInterval: 30,
    submissionWorkflow: 'review_then_validate',
    notifyOnSubmit: ['supervisor'],
    duplicateDetection: { enabled: false, fields: [] as string[] },
  };
}

// ── ANIMAL HEALTH FORMS ─────────────────────────────────────────────

// 1. AU-IBAR Monthly Animal Health Report (36 fields)
function buildMonthlyHealthReport() {
  // Section A: Disease Outbreak Details (fields 1-19, minus Country/Admin = ~16 fields)
  fieldOrder = 0;
  const sectionA = makeSection(
    { en: 'Disease Outbreak Details', fr: 'Détails des Foyers de Maladie', pt: 'Detalhes do Surto de Doença', ar: 'تفاصيل تفشي المرض' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      textField('reporting_officer', { en: 'Name of the Reporting Officer', fr: 'Nom de l\'Agent Rapporteur', pt: 'Nome do Agente Relator', ar: 'اسم الموظف المبلغ' }, { required: true }),
      numberField('reporting_period', { en: 'Reporting Period (Month - Year)', fr: 'Période de Déclaration (Mois - Année)', pt: 'Período de Relatório (Mês - Ano)', ar: 'فترة الإبلاغ (الشهر - السنة)' }, { required: true, helpText: { en: 'This refers to the period for which the disease report is being filed.', fr: 'Ceci fait référence à la période pour laquelle le rapport de maladie est déposé.', pt: 'Refere-se ao período para o qual o relatório de doença está sendo apresentado.', ar: 'يشير هذا إلى الفترة التي يتم تقديم تقرير المرض عنها.' } }),
      selectField('outbreak_in_month', { en: 'Outbreak Disease within the Reporting Month', fr: 'Foyer de Maladie dans le Mois', pt: 'Surto de Doença no Mês de Relatório', ar: 'تفشي المرض خلال شهر الإبلاغ' }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }], { required: true }),
      selectField('vaccination_in_period', { en: 'Vaccination within the Reporting Period', fr: 'Vaccination durant la Période', pt: 'Vacinação durante o Período de Relatório', ar: 'التطعيم خلال فترة الإبلاغ' }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }, { en: 'Unknown', fr: 'Inconnu', pt: 'Desconhecido', ar: 'غير معروف' }], { required: true }),
      diseaseSelect('disease', { en: 'Disease', fr: 'Maladie', pt: 'Doença', ar: 'المرض' }, { required: true }),
      textField('serotype', { en: 'Serotype', fr: 'Sérotype', pt: 'Serotipo', ar: 'النمط المصلي' }, { helpText: { en: 'Indicate the serotype of the disease if known.', fr: 'Indiquez le sérotype de la maladie si connu.', pt: 'Indique o serotipo da doença, se conhecido.', ar: 'حدد النمط المصلي للمرض إن كان معروفاً.' } }),
      selectField('new_or_followup', { en: 'New or Follow Up Outbreak', fr: 'Nouveau ou Suivi de Foyer', pt: 'Surto Novo ou Acompanhamento', ar: 'بؤرة جديدة أو متابعة' }, [{ en: 'New', fr: 'Nouveau', pt: 'Novo', ar: 'جديد' }, { en: 'Follow Up', fr: 'Suivi', pt: 'Acompanhamento', ar: 'متابعة' }], { helpText: { en: 'Select whether this is a new outbreak or a follow up outbreak within an epidemiological unit during the reporting period.', fr: 'Sélectionnez s\'il s\'agit d\'un nouveau foyer ou d\'un suivi de foyer au sein d\'une unité épidémiologique pendant la période de déclaration.', pt: 'Selecione se é um novo surto ou acompanhamento de surto dentro de uma unidade epidemiológica durante o período de relatório.', ar: 'اختر ما إذا كانت هذه بؤرة جديدة أو متابعة لبؤرة ضمن وحدة وبائية خلال فترة الإبلاغ.' } }),
      numberField('num_new_outbreaks', { en: 'Number of New Outbreaks', fr: 'Nombre de Nouveaux Foyers', pt: 'Número de Novos Surtos', ar: 'عدد البؤر الجديدة' }, { required: true, helpText: { en: 'This is the number of new outbreaks of the indicated disease reported from an epidemiological unit.', fr: 'Il s\'agit du nombre de nouveaux foyers de la maladie indiquée signalés par une unité épidémiologique.', pt: 'Este é o número de novos surtos da doença indicada reportados de uma unidade epidemiológica.', ar: 'هذا هو عدد البؤر الجديدة للمرض المُشار إليه المبلغ عنها من وحدة وبائية.' } }),
      numberField('num_total_outbreaks', { en: 'Total Number of Outbreaks', fr: 'Nombre Total de Foyers', pt: 'Número Total de Surtos', ar: 'العدد الإجمالي للبؤر' }, { helpText: { en: 'This is the total number of outbreaks of a particular disease reported from a specific epidemiological unit within the reporting period.', fr: 'Il s\'agit du nombre total de foyers d\'une maladie particulière signalés par une unité épidémiologique spécifique au cours de la période de déclaration.', pt: 'Este é o número total de surtos de uma doença específica reportados de uma unidade epidemiológica específica dentro do período de relatório.', ar: 'هذا هو العدد الإجمالي لبؤر مرض معين المبلغ عنها من وحدة وبائية محددة خلال فترة الإبلاغ.' } }),
      dateField('date_start_outbreak', { en: 'Date of Start of Outbreak', fr: 'Date de Début du Foyer', pt: 'Data de Início do Surto', ar: 'تاريخ بدء البؤرة' }, { helpText: { en: 'Provide the date of start of the outbreak.', fr: 'Indiquez la date de début du foyer.', pt: 'Forneça a data de início do surto.', ar: 'قدم تاريخ بدء البؤرة.' } }),
      dateField('date_reported_vet', { en: 'Date Reported to Veterinarian', fr: 'Date de Signalement au Vétérinaire', pt: 'Data de Comunicação ao Veterinário', ar: 'تاريخ الإبلاغ للطبيب البيطري' }, { helpText: { en: 'This is the date that the outbreak was reported to the veterinarian or animal health worker.', fr: 'Il s\'agit de la date à laquelle le foyer a été signalé au vétérinaire ou au technicien de santé animale.', pt: 'Esta é a data em que o surto foi comunicado ao veterinário ou profissional de saúde animal.', ar: 'هذا هو التاريخ الذي تم فيه الإبلاغ عن البؤرة للطبيب البيطري أو عامل الصحة الحيوانية.' } }),
      dateField('date_investigated', { en: 'Date Investigated', fr: 'Date d\'Investigation', pt: 'Data da Investigação', ar: 'تاريخ التحقيق' }, { required: true, helpText: { en: 'This is the date that the veterinarian or animal health worker visited and investigated the reported outbreak.', fr: 'Il s\'agit de la date à laquelle le vétérinaire ou le technicien de santé animale a visité et enquêté sur le foyer signalé.', pt: 'Esta é a data em que o veterinário ou profissional de saúde animal visitou e investigou o surto reportado.', ar: 'هذا هو التاريخ الذي زار فيه الطبيب البيطري أو عامل الصحة الحيوانية وحقق في البؤرة المبلغ عنها.' } }),
      dateField('date_final_diagnosis', { en: 'Date of Final Diagnosis', fr: 'Date du Diagnostic Final', pt: 'Data do Diagnóstico Final', ar: 'تاريخ التشخيص النهائي' }, { required: true, helpText: { en: 'This is the date that the Veterinarian or the laboratory confirms the outbreak.', fr: 'Il s\'agit de la date à laquelle le vétérinaire ou le laboratoire confirme le foyer.', pt: 'Esta é a data em que o veterinário ou o laboratório confirma o surto.', ar: 'هذا هو التاريخ الذي يؤكد فيه الطبيب البيطري أو المختبر البؤرة.' } }),
      sourceOfInfectionSelect('source_infection', { en: 'Source of Infection', fr: 'Source d\'Infection', pt: 'Fonte de Infecção', ar: 'مصدر العدوى' }),
      outbreakStatusSelect('outbreak_status', { en: 'Outbreak Status', fr: 'Statut du Foyer', pt: 'Estado do Surto', ar: 'حالة البؤرة' }, { helpText: { en: 'Indicate whether the outbreak is controlled or is still continuing as at the time of writing this report.', fr: 'Indiquez si le foyer est maîtrisé ou s\'il se poursuit au moment de la rédaction de ce rapport.', pt: 'Indique se o surto está controlado ou ainda continua no momento da redação deste relatório.', ar: 'حدد ما إذا كانت البؤرة مسيطراً عليها أو لا تزال مستمرة وقت كتابة هذا التقرير.' } }),
    ],
    { icon: 'AlertTriangle', color: '#EF4444' },
  );

  // Section B: Animals Affected (repeater par espèce)
  fieldOrder = 0;
  const sectionB = makeSection(
    { en: 'Animals Affected', fr: 'Animaux Affectés', pt: 'Animais Afetados', ar: 'الحيوانات المتأثرة' }, 2,
    [
      makeRepeater('animals_affected', { en: 'Animals by Species', fr: 'Animaux par Espèce', pt: 'Animais por Espécie', ar: 'الحيوانات حسب النوع' }, [
        { type: 'master-data-select', code: 'species', label: { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, required: true, properties: { masterDataType: 'species', searchable: true } },
        { type: 'master-data-select', code: 'age_group', label: { en: 'Age Group', fr: 'Groupe d\'Âge', pt: 'Grupo Etário', ar: 'الفئة العمرية' }, properties: { masterDataType: 'age-groups', searchable: true } },
        { type: 'master-data-select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { masterDataType: 'animal-sexes', searchable: true } },
        { type: 'number', code: 'num_susceptible', label: { en: 'Number Susceptible', fr: 'Nombre Susceptible', pt: 'Número Suscetível', ar: 'العدد المعرض' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_at_risk', label: { en: 'Number at Risk', fr: 'Nombre à Risque', pt: 'Número em Risco', ar: 'العدد المعرض للخطر' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_cases', label: { en: 'Number of Cases', fr: 'Nombre de Cas', pt: 'Número de Casos', ar: 'عدد الحالات' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_deaths', label: { en: 'Number of Deaths', fr: 'Nombre de Décès', pt: 'Número de Mortes', ar: 'عدد الوفيات' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_slaughtered', label: { en: 'Number Slaughtered', fr: 'Nombre Abattus', pt: 'Número Abatido', ar: 'العدد المذبوح' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_destroyed', label: { en: 'Number Destroyed', fr: 'Nombre Détruits', pt: 'Número Destruído', ar: 'العدد المدمر' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_vaccinated', label: { en: 'Number Vaccinated around Outbreak', fr: 'Nombre Vaccinés autour du Foyer', pt: 'Número Vacinado ao redor do Surto', ar: 'العدد الملقح حول البؤرة' }, required: true, properties: { min: 0 } },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une espèce', pt: 'Adicionar espécie', ar: 'إضافة نوع' } }),
    ],
    { icon: 'Bug', color: '#F97316', columns: 1 },
  );

  // Section C: Bases of Diagnosis
  fieldOrder = 0;
  const sectionC = makeSection(
    { en: 'Bases of Diagnosis', fr: 'Bases du Diagnostic', pt: 'Bases do Diagnóstico', ar: 'أسس التشخيص' }, 3,
    [diagnosisBasisSelect('basis_diagnosis', { en: 'Bases of Diagnosis', fr: 'Bases du Diagnostic', pt: 'Bases do Diagnóstico', ar: 'أسس التشخيص' }, { required: true })],
    { icon: 'Stethoscope', color: '#8B5CF6', columns: 1 },
  );

  // Section D: Disease Control Measures (repeater par mesure)
  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Disease Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle de Doenças', ar: 'إجراءات مكافحة الأمراض' }, 4,
    [
      makeRepeater('control_measures', { en: 'Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle', ar: 'إجراءات المكافحة' }, [
        { type: 'master-data-select', code: 'measure', label: { en: 'Disease Control Measure', fr: 'Mesure de Contrôle', pt: 'Medida de Controle de Doença', ar: 'إجراء مكافحة المرض' }, required: true, properties: { masterDataType: 'control-measures', searchable: true } },
        { type: 'text', code: 'flag', label: { en: 'Flag', fr: 'Indicateur', pt: 'Indicador', ar: 'المؤشر' }, required: true },
      ], { addLabel: { en: 'Add measure', fr: 'Ajouter une mesure', pt: 'Adicionar medida', ar: 'إضافة إجراء' } }),
    ],
    { icon: 'Shield', color: '#059669', columns: 1 },
  );

  // Section E: Outbreak Locations (repeater par localité)
  fieldOrder = 0;
  const sectionE = makeSection(
    { en: 'Outbreak Locations', fr: 'Localisations des Foyers', pt: 'Localizações dos Surtos', ar: 'مواقع البؤر' }, 5,
    [
      makeRepeater('outbreak_locations', { en: 'Locations', fr: 'Localisations', pt: 'Localizações', ar: 'المواقع' }, [
        { type: 'text', code: 'locality_name', label: { en: 'Name of Locality', fr: 'Nom de la Localité', pt: 'Nome da Localidade', ar: 'اسم المنطقة' }, required: true },
        { type: 'master-data-select', code: 'epi_unit_type', label: { en: 'Epidemiological Unit Type', fr: 'Type d\'Unité Épidémiologique', pt: 'Tipo de Unidade Epidemiológica', ar: 'نوع الوحدة الوبائية' }, properties: { masterDataType: 'epidemiological-unit-types', searchable: true } },
        { type: 'master-data-select', code: 'production_system', label: { en: 'Production System', fr: 'Système de Production', pt: 'Sistema de Produção', ar: 'نظام الإنتاج' }, properties: { masterDataType: 'production-systems', searchable: true } },
      ], { addLabel: { en: 'Add location', fr: 'Ajouter un lieu', pt: 'Adicionar local', ar: 'إضافة موقع' } }),
    ],
    { icon: 'Map', color: '#0EA5E9', columns: 1 },
  );

  return {
    sections: [makeLocalisationSection(0), sectionA, sectionB, sectionC, sectionD, sectionE, makeGPSSection(6)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 2. Emergency Disease Reporting (29 fields)
function buildEmergencyDiseaseReport() {
  fieldOrder = 0;
  const sectionA = makeSection(
    { en: 'Emergency Details', fr: 'Détails de l\'Urgence', pt: 'Detalhes da Emergência', ar: 'تفاصيل الطوارئ' }, 1,
    [
      dateField('date_report_prepared', { en: 'Date Report Prepared', fr: 'Date de Préparation du Rapport', pt: 'Data de Preparação do Relatório', ar: 'تاريخ إعداد التقرير' }, { required: true }),
      numberField('notification_ref', { en: 'Notification Reference Number', fr: 'Numéro de Référence de Notification', pt: 'Número de Referência da Notificação', ar: 'رقم مرجع الإخطار' }),
      notificationReasonSelect('reason_notification', { en: 'Reason for Notification', fr: 'Raison de la Notification', pt: 'Razão da Notificação', ar: 'سبب الإخطار' },
        { required: true, helpText: { en: 'Select the reason for making this notification.', fr: 'Sélectionnez la raison de cette notification.', pt: 'Selecione a razão desta notificação.', ar: 'اختر سبب هذا الإخطار.' } }),
      selectField('animal_type', { en: 'Animal Type', fr: 'Type d\'Animal', pt: 'Tipo de Animal', ar: 'نوع الحيوان' },
        [{ en: 'Domestic', fr: 'Domestique', pt: 'Doméstico', ar: 'محلي' }, { en: 'Wild', fr: 'Sauvage', pt: 'Selvagem', ar: 'بري' }, { en: 'Feral', fr: 'Féral', pt: 'Feral', ar: 'وحشي' }, { en: 'Captive Wildlife', fr: 'Faune Captive', pt: 'Fauna Cativa', ar: 'حياة برية أسيرة' }],
        { required: true, helpText: { en: 'List of animal types depending on their habitat.', fr: 'Liste des types d\'animaux selon leur habitat.', pt: 'Lista de tipos de animais conforme seu habitat.', ar: 'قائمة أنواع الحيوانات حسب موطنها.' } }),
      animalHusbandrySelect('animal_husbandry', { en: 'Animal Husbandry', fr: 'Élevage Animal', pt: 'Pecuária', ar: 'تربية الحيوانات' }, { required: true }),
      dateField('date_start_event', { en: 'Date of Start of Event', fr: 'Date de Début de l\'Événement', pt: 'Data de Início do Evento', ar: 'تاريخ بدء الحدث' }, { required: true }),
      dateField('date_first_confirmation', { en: 'Date of First Confirmation', fr: 'Date de Première Confirmation', pt: 'Data da Primeira Confirmação', ar: 'تاريخ التأكيد الأول' }, { helpText: { en: 'Date that confirmation is received from the laboratory.', fr: 'Date de réception de la confirmation du laboratoire.', pt: 'Data em que a confirmação é recebida do laboratório.', ar: 'تاريخ استلام التأكيد من المختبر.' } }),
      dateField('date_end_event', { en: 'End Date of Event', fr: 'Date de Fin de l\'Événement', pt: 'Data de Término do Evento', ar: 'تاريخ انتهاء الحدث' }, { required: true }),
      diseaseSelect('disease', { en: 'Disease', fr: 'Maladie', pt: 'Doença', ar: 'المرض' }, { required: true, helpText: { en: 'Emergency or notifiable disease being reported as an outbreak.', fr: 'Maladie d\'urgence ou à déclaration obligatoire signalée comme foyer.', pt: 'Doença de emergência ou notificável sendo reportada como surto.', ar: 'مرض طارئ أو واجب الإبلاغ يتم الإبلاغ عنه كبؤرة.' } }),
      selectField('report_applies_to', { en: 'Report Applies to', fr: 'Le Rapport s\'Applique à', pt: 'O Relatório Aplica-se a', ar: 'ينطبق التقرير على' },
        [{ en: 'Domestics', fr: 'Animaux Domestiques', pt: 'Animais Domésticos', ar: 'حيوانات محلية' }, { en: 'Livestock', fr: 'Bétail', pt: 'Gado', ar: 'ماشية' }, { en: 'National Park', fr: 'Parc National', pt: 'Parque Nacional', ar: 'حديقة وطنية' }, { en: 'Zone or Compartment', fr: 'Zone ou Compartiment', pt: 'Zona ou Compartimento', ar: 'منطقة أو قسم' }, { en: 'Whole country', fr: 'Pays entier', pt: 'País inteiro', ar: 'البلد بالكامل' }],
        { required: true }),
      selectField('new_outbreak', { en: 'New Outbreak', fr: 'Nouveau Foyer', pt: 'Novo Surto', ar: 'بؤرة جديدة' }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }]),
      textareaField('comment', { en: 'Comment', fr: 'Commentaire', pt: 'Comentário', ar: 'تعليق' }),
    ],
    { icon: 'AlertTriangle', color: '#DC2626' },
  );

  fieldOrder = 0;
  const sectionB = makeSection(
    { en: 'Animals Affected', fr: 'Animaux Affectés', pt: 'Animais Afetados', ar: 'الحيوانات المتأثرة' }, 2,
    [
      makeRepeater('animals_affected', { en: 'Animals by Species', fr: 'Animaux par Espèce', pt: 'Animais por Espécie', ar: 'الحيوانات حسب النوع' }, [
        { type: 'master-data-select', code: 'species', label: { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, properties: { masterDataType: 'species', searchable: true } },
        { type: 'master-data-select', code: 'age_group', label: { en: 'Age Group', fr: 'Groupe d\'Âge', pt: 'Grupo Etário', ar: 'الفئة العمرية' }, properties: { masterDataType: 'age-groups', searchable: true } },
        { type: 'master-data-select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { masterDataType: 'animal-sexes', searchable: true } },
        { type: 'number', code: 'num_susceptible', label: { en: 'Number Susceptible', fr: 'Nombre Susceptible', pt: 'Número Suscetível', ar: 'العدد المعرض' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_cases', label: { en: 'Number of Cases', fr: 'Nombre de Cas', pt: 'Número de Casos', ar: 'عدد الحالات' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_deaths', label: { en: 'Number of Deaths', fr: 'Nombre de Décès', pt: 'Número de Mortes', ar: 'عدد الوفيات' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_slaughtered', label: { en: 'Number Slaughtered', fr: 'Nombre Abattus', pt: 'Número Abatido', ar: 'العدد المذبوح' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_destroyed', label: { en: 'Number Destroyed', fr: 'Nombre Détruits', pt: 'Número Destruído', ar: 'العدد المدمر' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_vaccinated', label: { en: 'Number Vaccinated around Outbreak', fr: 'Nombre Vaccinés autour du Foyer', pt: 'Número Vacinado ao redor do Surto', ar: 'العدد الملقح حول البؤرة' }, required: true, properties: { min: 0 } },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une espèce', pt: 'Adicionar espécie', ar: 'إضافة نوع' } }),
    ],
    { icon: 'Bug', color: '#F97316', columns: 1 },
  );

  fieldOrder = 0;
  const sectionC = makeSection(
    { en: 'Basis of Diagnosis', fr: 'Base du Diagnostic', pt: 'Base do Diagnóstico', ar: 'أساس التشخيص' }, 3,
    [diagnosisBasisSelect('basis_diagnosis', { en: 'Basis of Diagnosis', fr: 'Base du Diagnostic', pt: 'Base do Diagnóstico', ar: 'أساس التشخيص' })],
    { icon: 'Stethoscope', color: '#8B5CF6', columns: 1 },
  );

  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Disease Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle de Doenças', ar: 'إجراءات مكافحة الأمراض' }, 4,
    [
      makeRepeater('control_measures', { en: 'Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle', ar: 'إجراءات المكافحة' }, [
        { type: 'master-data-select', code: 'measure', label: { en: 'Disease Control Measure', fr: 'Mesure de Contrôle', pt: 'Medida de Controle de Doença', ar: 'إجراء مكافحة المرض' }, required: true, properties: { masterDataType: 'control-measures', searchable: true } },
        { type: 'select', code: 'flag', label: { en: 'Flag', fr: 'Indicateur', pt: 'Indicador', ar: 'المؤشر' }, required: true, properties: { options: [
          { label: { en: 'Applied', fr: 'Appliqué', pt: 'Aplicado', ar: 'مطبق' }, value: 'applied' },
          { label: { en: 'Planned', fr: 'Planifié', pt: 'Planejado', ar: 'مخطط' }, value: 'planned' },
          { label: { en: 'Not Applied', fr: 'Non Appliqué', pt: 'Não Aplicado', ar: 'غير مطبق' }, value: 'not_applied' },
        ] } },
      ], { addLabel: { en: 'Add measure', fr: 'Ajouter une mesure', pt: 'Adicionar medida', ar: 'إضافة إجراء' } }),
    ],
    { icon: 'Shield', color: '#059669', columns: 1 },
  );

  fieldOrder = 0;
  const sectionE = makeSection(
    { en: 'Locations', fr: 'Localisations', pt: 'Localizações', ar: 'المواقع' }, 5,
    [
      makeRepeater('locations', { en: 'Locations', fr: 'Localisations', pt: 'Localizações', ar: 'المواقع' }, [
        { type: 'text', code: 'locality_name', label: { en: 'Name of Locality', fr: 'Nom de la Localité', pt: 'Nome da Localidade', ar: 'اسم المنطقة' }, required: true },
        { type: 'master-data-select', code: 'epi_unit_type', label: { en: 'Epidemiological Unit Type', fr: 'Type d\'Unité Épidémiologique', pt: 'Tipo de Unidade Epidemiológica', ar: 'نوع الوحدة الوبائية' }, properties: { masterDataType: 'epidemiological-unit-types', searchable: true } },
        { type: 'master-data-select', code: 'production_system', label: { en: 'Production System', fr: 'Système de Production', pt: 'Sistema de Produção', ar: 'نظام الإنتاج' }, properties: { masterDataType: 'production-systems', searchable: true } },
      ], { addLabel: { en: 'Add location', fr: 'Ajouter un lieu', pt: 'Adicionar local', ar: 'إضافة موقع' } }),
    ],
    { icon: 'Map', color: '#0EA5E9', columns: 1 },
  );

  return {
    sections: [makeLocalisationSection(0), sectionA, sectionB, sectionC, sectionD, sectionE, makeGPSSection(6)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 3. Mass Vaccination (10 fields)
function buildMassVaccination() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Vaccination Campaign', fr: 'Campagne de Vaccination', pt: 'Campanha de Vacinação', ar: 'حملة التطعيم' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      diseaseSelect('target_disease', { en: 'Target Disease', fr: 'Maladie Cible', pt: 'Doença Alvo', ar: 'المرض المستهدف' }, { required: true }),
      textField('vaccination_reason', { en: 'Vaccination Reason', fr: 'Raison de la Vaccination', pt: 'Razão da Vacinação', ar: 'سبب التطعيم' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }),
      numberField('num_vaccinated', { en: 'Number Vaccinated', fr: 'Nombre Vaccinés', pt: 'Número Vacinado', ar: 'العدد الملقح' }, { helpText: { en: 'Number of animals vaccinated for the selected species.', fr: 'Nombre d\'animaux vaccinés pour l\'espèce sélectionnée.', pt: 'Número de animais vacinados para a espécie selecionada.', ar: 'عدد الحيوانات الملقحة للنوع المحدد.' } }),
      dateField('start_date', { en: 'Start Date', fr: 'Date de Début', pt: 'Data de Início', ar: 'تاريخ البدء' }),
      dateField('end_date', { en: 'End Date', fr: 'Date de Fin', pt: 'Data de Término', ar: 'تاريخ الانتهاء' }),
    ],
    { icon: 'Syringe', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section, makeGPSSection(2)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 4. Meat Inspection (41 fields)
function buildMeatInspection() {
  fieldOrder = 0;
  const sectionA = makeSection(
    { en: 'Meat Inspection Details', fr: 'Détails de l\'Inspection', pt: 'Detalhes da Inspeção de Carne', ar: 'تفاصيل فحص اللحوم' }, 1,
    [
      dateField('date_inspection', { en: 'Date of Inspection', fr: 'Date de l\'Inspection', pt: 'Data da Inspeção', ar: 'تاريخ الفحص' }, { required: true }),
      textField('inspector_name', { en: 'Meat Inspector\'s Name', fr: 'Nom de l\'Inspecteur', pt: 'Nome do Inspetor de Carne', ar: 'اسم مفتش اللحوم' }, { required: true }),
      textField('abattoir_name', { en: 'Abattoir Name', fr: 'Nom de l\'Abattoir', pt: 'Nome do Matadouro', ar: 'اسم المسلخ' }, { required: true }),
      textField('abattoir_id', { en: 'Abattoir ID', fr: 'ID de l\'Abattoir', pt: 'ID do Matadouro', ar: 'معرف المسلخ' }),
      textField('abattoir_abbreviation', { en: 'Abattoir Abbreviation', fr: 'Abréviation de l\'Abattoir', pt: 'Abreviação do Matadouro', ar: 'اختصار المسلخ' }),
      textField('source_animal_market', { en: 'Source of Animal or Market', fr: 'Source de l\'Animal ou Marché', pt: 'Fonte do Animal ou Mercado', ar: 'مصدر الحيوان أو السوق' }, { helpText: { en: 'Name the most likely source of the animal and/or market from where the animal presented for slaughter came.', fr: 'Nommez la source la plus probable de l\'animal et/ou du marché d\'où provient l\'animal présenté à l\'abattage.', pt: 'Nomeie a fonte mais provável do animal e/ou mercado de onde veio o animal apresentado para abate.', ar: 'اذكر المصدر الأكثر احتمالاً للحيوان و/أو السوق الذي جاء منه الحيوان المقدم للذبح.' } }),
      numberField('movement_permit_number', { en: 'Movement Permit Number', fr: 'Numéro du Permis de Mouvement', pt: 'Número da Licença de Movimento', ar: 'رقم تصريح النقل' }),
      transportModeSelect('means_transportation', { en: 'Means of Transportation', fr: 'Moyen de Transport', pt: 'Meio de Transporte', ar: 'وسيلة النقل' }, { helpText: { en: 'Means of transporting the animal(s) to the abattoir.', fr: 'Moyen de transport des animaux vers l\'abattoir.', pt: 'Meio de transporte dos animais ao matadouro.', ar: 'وسيلة نقل الحيوان(ات) إلى المسلخ.' } }),
      numberField('no_objection_form_number', { en: 'No Objection Form Number', fr: 'Numéro du Formulaire de Non-Objection', pt: 'Número do Formulário de Não Objeção', ar: 'رقم نموذج عدم الممانعة' }),
    ],
    { icon: 'ClipboardCheck', color: '#D97706' },
  );

  // Section B: Ante Mortem Inspection (repeater par espèce)
  fieldOrder = 0;
  const sectionB = makeSection(
    { en: 'Ante Mortem Inspection', fr: 'Inspection Ante Mortem', pt: 'Inspeção Ante Mortem', ar: 'الفحص قبل الذبح' }, 2,
    [
      makeRepeater('ante_mortem', { en: 'Ante Mortem by Species', fr: 'Ante Mortem par Espèce', pt: 'Ante Mortem por Espécie', ar: 'الفحص قبل الذبح حسب النوع' }, [
        { type: 'master-data-select', code: 'animal_species', label: { en: 'Animal Species', fr: 'Espèce Animale', pt: 'Espécie Animal', ar: 'النوع الحيواني' }, required: true, properties: { masterDataType: 'species', searchable: true } },
        { type: 'master-data-select', code: 'age', label: { en: 'Age', fr: 'Âge', pt: 'Idade', ar: 'العمر' }, properties: { masterDataType: 'age-groups', searchable: true } },
        { type: 'master-data-select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { masterDataType: 'animal-sexes', searchable: true } },
        { type: 'number', code: 'num_consignment', label: { en: 'Number in Consignment', fr: 'Nombre dans la Consignation', pt: 'Número na Remessa', ar: 'العدد في الشحنة' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_clinically_sick', label: { en: 'Number Clinically Sick', fr: 'Nombre Cliniquement Malades', pt: 'Número Clinicamente Doente', ar: 'العدد المريض سريرياً' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_passed', label: { en: 'Number Passed for Slaughter', fr: 'Nombre Approuvé pour l\'Abattage', pt: 'Número Aprovado para Abate', ar: 'العدد الموافق عليه للذبح' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_rejected', label: { en: 'Number Rejected', fr: 'Nombre Rejeté', pt: 'Número Rejeitado', ar: 'العدد المرفوض' }, required: true, properties: { min: 0 } },
        { type: 'master-data-select', code: 'disease_suspected', label: { en: 'Disease Suspected', fr: 'Maladie Suspectée', pt: 'Doença Suspeita', ar: 'المرض المشتبه به' }, properties: { masterDataType: 'diseases', searchable: true } },
        { type: 'master-data-select', code: 'major_symptoms', label: { en: 'Major Disease Symptoms', fr: 'Principaux Symptômes', pt: 'Principais Sintomas da Doença', ar: 'أعراض المرض الرئيسية' }, properties: { masterDataType: 'diseases', searchable: true } },
        { type: 'textarea', code: 'observations', label: { en: 'Observation / Comments', fr: 'Observations / Commentaires', pt: 'Observação / Comentários', ar: 'ملاحظات / تعليقات' }, properties: { rows: 3 } },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une espèce', pt: 'Adicionar espécie', ar: 'إضافة نوع' } }),
    ],
    { icon: 'Eye', color: '#7C3AED', columns: 1 },
  );

  // Section C: Laboratory Form
  fieldOrder = 0;
  const sectionC = makeSection(
    { en: 'Laboratory Form', fr: 'Formulaire de Laboratoire', pt: 'Formulário de Laboratório', ar: 'نموذج المختبر' }, 3,
    [
      textField('postmortem_lesions', { en: 'Post-mortem Lesions', fr: 'Lésions Post-mortem', pt: 'Lesões Post-mortem', ar: 'الآفات بعد الذبح' }),
      textField('tentative_diagnosis', { en: 'Tentative Diagnosis', fr: 'Diagnostic Provisoire', pt: 'Diagnóstico Provisório', ar: 'التشخيص المبدئي' }, { required: true, helpText: { en: 'This is the primary disease that is suspected.', fr: 'Il s\'agit de la maladie principale suspectée.', pt: 'Esta é a doença primária suspeita.', ar: 'هذا هو المرض الأساسي المشتبه به.' } }),
      textField('differential_diagnosis', { en: 'Differential Diagnosis', fr: 'Diagnostic Différentiel', pt: 'Diagnóstico Diferencial', ar: 'التشخيص التفريقي' }, { helpText: { en: 'This is the secondary disease that is suspected.', fr: 'Il s\'agit de la maladie secondaire suspectée.', pt: 'Esta é a doença secundária suspeita.', ar: 'هذا هو المرض الثانوي المشتبه به.' } }),
      sampleTypeSelect('specimen_type', { en: 'Type of Laboratory Specimen', fr: 'Type de Spécimen de Laboratoire', pt: 'Tipo de Espécime de Laboratório', ar: 'نوع عينة المختبر' }, { helpText: { en: 'This is the type of laboratory specimen or sample which has been sent to the Lab.', fr: 'Il s\'agit du type de spécimen ou d\'échantillon de laboratoire envoyé au laboratoire.', pt: 'Este é o tipo de espécime ou amostra de laboratório enviada ao laboratório.', ar: 'هذا هو نوع عينة المختبر التي تم إرسالها إلى المختبر.' } }),
      numberField('num_specimens', { en: 'Number of Laboratory Specimens', fr: 'Nombre de Spécimens', pt: 'Número de Espécimes', ar: 'عدد العينات' }),
      dateField('date_samples_collected', { en: 'Date Samples Collected', fr: 'Date de Collecte', pt: 'Data da Coleta de Amostras', ar: 'تاريخ جمع العينات' }),
      dateField('date_samples_sent', { en: 'Date Samples Sent to Laboratory', fr: 'Date d\'Envoi au Laboratoire', pt: 'Data de Envio ao Laboratório', ar: 'تاريخ إرسال العينات للمختبر' }, { helpText: { en: 'This is the date when the samples were sent to the Primary or Reference Laboratory.', fr: 'Il s\'agit de la date d\'envoi des échantillons au laboratoire primaire ou de référence.', pt: 'Esta é a data em que as amostras foram enviadas ao laboratório primário ou de referência.', ar: 'هذا هو التاريخ الذي أُرسلت فيه العينات إلى المختبر الأساسي أو المرجعي.' } }),
      labSelect('lab_name', { en: 'Name of Laboratory', fr: 'Nom du Laboratoire', pt: 'Nome do Laboratório', ar: 'اسم المختبر' }, { required: true }),
      labSelect('ref_lab_name', { en: 'Name of Reference Laboratory', fr: 'Nom du Laboratoire de Référence', pt: 'Nome do Laboratório de Referência', ar: 'اسم المختبر المرجعي' }),
      testTypeSelect('lab_test', { en: 'Laboratory Test', fr: 'Test de Laboratoire', pt: 'Teste de Laboratório', ar: 'اختبار المختبر' }),
      textField('lab_results', { en: 'Laboratory Results', fr: 'Résultats de Laboratoire', pt: 'Resultados do Laboratório', ar: 'نتائج المختبر' }, { helpText: { en: 'Laboratory Specimen Results', fr: 'Résultats des spécimens de laboratoire', pt: 'Resultados dos espécimes de laboratório', ar: 'نتائج عينات المختبر' } }),
      dateField('date_lab_results', { en: 'Date Laboratory Results Received', fr: 'Date de Réception des Résultats', pt: 'Data de Recebimento dos Resultados', ar: 'تاريخ استلام النتائج' }, { helpText: { en: 'This is the date on which the Laboratory results were received.', fr: 'Il s\'agit de la date à laquelle les résultats de laboratoire ont été reçus.', pt: 'Esta é a data em que os resultados do laboratório foram recebidos.', ar: 'هذا هو التاريخ الذي تم فيه استلام نتائج المختبر.' } }),
    ],
    { icon: 'FlaskConical', color: '#0891B2' },
  );

  // Section D: Post Mortem Inspection (repeater par organe)
  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Post Mortem Inspection', fr: 'Inspection Post Mortem', pt: 'Inspeção Post Mortem', ar: 'الفحص بعد الذبح' }, 4,
    [
      makeRepeater('post_mortem', { en: 'Post Mortem by Body Part', fr: 'Post Mortem par Organe', pt: 'Post Mortem por Parte do Corpo', ar: 'الفحص بعد الذبح حسب العضو' }, [
        { type: 'master-data-select', code: 'body_part', label: { en: 'Body Part', fr: 'Organe', pt: 'Parte do Corpo', ar: 'العضو' }, properties: { masterDataType: 'body-parts', searchable: true } },
        { type: 'number', code: 'num_inspected', label: { en: 'Number Inspected', fr: 'Nombre Inspecté', pt: 'Número Inspecionado', ar: 'العدد المفحوص' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_affected', label: { en: 'Number Affected', fr: 'Nombre Affecté', pt: 'Número Afetado', ar: 'العدد المتأثر' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_condemned', label: { en: 'Number Condemned', fr: 'Nombre Condamné', pt: 'Número Condenado', ar: 'العدد المُدان' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'estimated_value', label: { en: 'Estimated Value of Condemned Part (USD)', fr: 'Valeur Estimée de la Partie Condamnée (USD)', pt: 'Valor Estimado da Parte Condenada (USD)', ar: 'القيمة المقدرة للجزء المُدان (دولار)' }, properties: { min: 0, step: 0.01, decimals: 2 } },
        { type: 'text', code: 'main_lesions', label: { en: 'Main Lesions', fr: 'Lésions Principales', pt: 'Lesões Principais', ar: 'الآفات الرئيسية' } },
        { type: 'select', code: 'samples_taken', label: { en: 'Samples Taken to Laboratory', fr: 'Échantillons Envoyés au Laboratoire', pt: 'Amostras Enviadas ao Laboratório', ar: 'العينات المرسلة للمختبر' }, properties: { options: [{ label: { en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, value: 'yes' }, { label: { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }, value: 'no' }] } },
        { type: 'number', code: 'lab_form_serial', label: { en: 'Laboratory Form Serial Number', fr: 'Numéro de Série du Formulaire', pt: 'Número de Série do Formulário de Laboratório', ar: 'الرقم التسلسلي لنموذج المختبر' }, properties: { min: 0 } },
      ], { addLabel: { en: 'Add body part', fr: 'Ajouter un organe', pt: 'Adicionar órgão', ar: 'إضافة عضو' } }),
    ],
    { icon: 'Microscope', color: '#BE185D', columns: 1 },
  );

  return {
    sections: [makeLocalisationSection(0), sectionA, sectionB, sectionC, sectionD, makeGPSSection(5)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 5. Monthly Abattoir Report (27 fields)
function buildMonthlyAbattoirReport() {
  fieldOrder = 0;
  const sectionA = makeSection(
    { en: 'Abattoir Details', fr: 'Détails de l\'Abattoir', pt: 'Detalhes do Matadouro', ar: 'تفاصيل المسلخ' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      textField('reporting_officer', { en: 'Name of Reporting Officer', fr: 'Nom de l\'Agent Rapporteur', pt: 'Nome do Agente Relator', ar: 'اسم الموظف المبلغ' }, { required: true }),
      f('phone', 'phone_reporting_officer', { en: 'Phone Number of Reporting Officer', fr: 'Téléphone de l\'Agent', pt: 'Telefone do Agente Relator', ar: 'رقم هاتف الموظف المبلغ' }),
      textField('location_name', { en: 'Name of Location', fr: 'Nom du Lieu', pt: 'Nome do Local', ar: 'اسم الموقع' }, { required: true }),
      textField('location_code', { en: 'Location Code', fr: 'Code du Lieu', pt: 'Código do Local', ar: 'رمز الموقع' }),
      textField('facility_type', { en: 'Type of Facility', fr: 'Type d\'Établissement', pt: 'Tipo de Instalação', ar: 'نوع المنشأة' }, { required: true }),
      textField('holding_capacity', { en: 'Holding Capacity', fr: 'Capacité d\'Accueil', pt: 'Capacidade de Alojamento', ar: 'السعة الاستيعابية' }, { required: true }),
    ],
    { icon: 'Building2', color: '#D97706' },
  );

  // Section B: Ante Mortem Inspection (repeater par espèce)
  fieldOrder = 0;
  const sectionB = makeSection(
    { en: 'Ante Mortem Inspection', fr: 'Inspection Ante Mortem', pt: 'Inspeção Ante Mortem', ar: 'الفحص قبل الذبح' }, 2,
    [
      makeRepeater('ante_mortem', { en: 'Ante Mortem by Species', fr: 'Ante Mortem par Espèce', pt: 'Ante Mortem por Espécie', ar: 'الفحص قبل الذبح حسب النوع' }, [
        { type: 'master-data-select', code: 'species', label: { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, required: true, properties: { masterDataType: 'species', searchable: true } },
        { type: 'text', code: 'source_animals', label: { en: 'Source of Animals', fr: 'Source des Animaux', pt: 'Fonte dos Animais', ar: 'مصدر الحيوانات' }, required: true },
        { type: 'number', code: 'num_inspected', label: { en: 'Number Inspected', fr: 'Nombre Inspecté', pt: 'Número Inspecionado', ar: 'العدد المفحوص' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_rejected', label: { en: 'Number Rejected', fr: 'Nombre Rejeté', pt: 'Número Rejeitado', ar: 'العدد المرفوض' }, required: true, properties: { min: 0 } },
        { type: 'text', code: 'reason_rejection', label: { en: 'Reason for Rejection', fr: 'Motif de Rejet', pt: 'Motivo da Rejeição', ar: 'سبب الرفض' }, required: true },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une espèce', pt: 'Adicionar espécie', ar: 'إضافة نوع' } }),
    ],
    { icon: 'Eye', color: '#7C3AED', columns: 1 },
  );

  // Section C: Post Mortem Inspection 1 (repeater par organe)
  fieldOrder = 0;
  const sectionC = makeSection(
    { en: 'Post Mortem Inspection (1)', fr: 'Inspection Post Mortem (1)', pt: 'Inspeção Post Mortem (1)', ar: 'الفحص بعد الذبح (1)' }, 3,
    [
      makeRepeater('post_mortem_organ', { en: 'Post Mortem by Organ', fr: 'Post Mortem par Organe', pt: 'Post Mortem por Órgão', ar: 'الفحص بعد الذبح حسب العضو' }, [
        { type: 'text', code: 'organ_name', label: { en: 'Name of Organ', fr: 'Nom de l\'Organe', pt: 'Nome do Órgão', ar: 'اسم العضو' } },
        { type: 'number', code: 'num_inspected', label: { en: 'Number Inspected', fr: 'Nombre Inspecté', pt: 'Número Inspecionado', ar: 'العدد المفحوص' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_partially_condemned', label: { en: 'Number Partially Condemned', fr: 'Nombre Partiellement Condamné', pt: 'Número Parcialmente Condenado', ar: 'العدد المُدان جزئياً' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_totally_condemned', label: { en: 'Number Totally Condemned', fr: 'Nombre Totalement Condamné', pt: 'Número Totalmente Condenado', ar: 'العدد المُدان كلياً' }, required: true, properties: { min: 0 } },
      ], { addLabel: { en: 'Add organ', fr: 'Ajouter un organe', pt: 'Adicionar órgão', ar: 'إضافة عضو' } }),
    ],
    { icon: 'Microscope', color: '#BE185D', columns: 1 },
  );

  // Section D: Post Mortem Inspection 2 (repeater par espèce)
  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Post Mortem Inspection (2)', fr: 'Inspection Post Mortem (2)', pt: 'Inspeção Post Mortem (2)', ar: 'الفحص بعد الذبح (2)' }, 4,
    [
      makeRepeater('post_mortem_species', { en: 'Post Mortem by Species', fr: 'Post Mortem par Espèce', pt: 'Post Mortem por Espécie', ar: 'الفحص بعد الذبح حسب النوع' }, [
        { type: 'master-data-select', code: 'species', label: { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, required: true, properties: { masterDataType: 'species', searchable: true } },
        { type: 'master-data-select', code: 'disease_suspected', label: { en: 'Disease Suspected', fr: 'Maladie Suspectée', pt: 'Doença Suspeita', ar: 'المرض المشتبه به' }, required: true, properties: { masterDataType: 'diseases', searchable: true } },
        { type: 'number', code: 'num_slaughtered', label: { en: 'Number Slaughtered', fr: 'Nombre Abattus', pt: 'Número Abatido', ar: 'العدد المذبوح' }, required: true, properties: { min: 0 } },
        { type: 'text', code: 'sample_type', label: { en: 'Type of Samples Collected', fr: 'Type d\'Échantillons Collectés', pt: 'Tipo de Amostras Coletadas', ar: 'نوع العينات المجمعة' }, required: true },
        { type: 'number', code: 'num_samples', label: { en: 'Number of Samples Submitted', fr: 'Nombre d\'Échantillons Soumis', pt: 'Número de Amostras Submetidas', ar: 'عدد العينات المقدمة' }, required: true, properties: { min: 0 } },
        { type: 'date', code: 'date_samples', label: { en: 'Date of Samples Submitted', fr: 'Date de Soumission des Échantillons', pt: 'Data de Submissão das Amostras', ar: 'تاريخ تقديم العينات' }, required: true },
        { type: 'date', code: 'date_report_received', label: { en: 'Date Report Received', fr: 'Date de Réception du Rapport', pt: 'Data de Recebimento do Relatório', ar: 'تاريخ استلام التقرير' }, required: true },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une espèce', pt: 'Adicionar espécie', ar: 'إضافة نوع' } }),
    ],
    { icon: 'Beaker', color: '#0891B2', columns: 1 },
  );

  return {
    sections: [makeLocalisationSection(0), sectionA, sectionB, sectionC, sectionD, makeGPSSection(5)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 6. Monthly Vaccination Report (13 fields) — NO GPS
function buildMonthlyVaccinationReport() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Vaccination Summary', fr: 'Résumé de Vaccination', pt: 'Resumo da Vacinação', ar: 'ملخص التطعيم' }, 1,
    [
      numberField('year_of_report', { en: 'Year of Report', fr: 'Année du Rapport', pt: 'Ano do Relatório', ar: 'سنة التقرير' }, { required: true }),
      textField('month', { en: 'Month', fr: 'Mois', pt: 'Mês', ar: 'الشهر' }, { required: true, helpText: { en: 'Month during which the vaccination was carried out.', fr: 'Mois au cours duquel la vaccination a été effectuée.', pt: 'Mês durante o qual a vacinação foi realizada.', ar: 'الشهر الذي تم فيه التطعيم.' } }),
      textField('reason_vaccination', { en: 'Reason for the Vaccination', fr: 'Raison de la Vaccination', pt: 'Razão da Vacinação', ar: 'سبب التطعيم' }, { required: true, helpText: { en: 'Indicate whether it is a control or preventive vaccination.', fr: 'Indiquez s\'il s\'agit d\'une vaccination de contrôle ou préventive.', pt: 'Indique se é uma vacinação de controle ou preventiva.', ar: 'حدد ما إذا كان التطعيم للمكافحة أو للوقاية.' } }),
      diseaseSelect('disease', { en: 'Disease', fr: 'Maladie', pt: 'Doença', ar: 'المرض' }, { required: true, helpText: { en: 'Select the animal disease being vaccinated against.', fr: 'Sélectionnez la maladie animale contre laquelle la vaccination est effectuée.', pt: 'Selecione a doença animal contra a qual a vacinação é realizada.', ar: 'اختر المرض الحيواني الذي يتم التطعيم ضده.' } }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      numberField('num_animals_vaccinated', { en: 'Number of Animals Vaccinated', fr: 'Nombre d\'Animaux Vaccinés', pt: 'Número de Animais Vacinados', ar: 'عدد الحيوانات الملقحة' }, { required: true, helpText: { en: 'Indicate the number of animals vaccinated for each species of animal for each disease.', fr: 'Indiquez le nombre d\'animaux vaccinés pour chaque espèce et chaque maladie.', pt: 'Indique o número de animais vacinados para cada espécie de animal para cada doença.', ar: 'حدد عدد الحيوانات الملقحة لكل نوع حيواني لكل مرض.' } }),
      textField('vaccine_name', { en: 'Name/Trademark of Vaccine', fr: 'Nom/Marque du Vaccin', pt: 'Nome/Marca da Vacina', ar: 'اسم/علامة اللقاح' }),
      textField('vaccine_type', { en: 'Type of Vaccine', fr: 'Type de Vaccin', pt: 'Tipo de Vacina', ar: 'نوع اللقاح' }),
      textField('vaccine_source', { en: 'Source of Vaccine', fr: 'Source du Vaccin', pt: 'Fonte da Vacina', ar: 'مصدر اللقاح' }),
      textField('vaccine_tested_panvac', { en: 'Vaccine Tested at AU-PANVAC', fr: 'Vaccin Testé à AU-PANVAC', pt: 'Vacina Testada no AU-PANVAC', ar: 'اللقاح المختبر في AU-PANVAC' }),
      numberField('batch_number', { en: 'Batch Number', fr: 'Numéro de Lot', pt: 'Número do Lote', ar: 'رقم الدفعة' }, { helpText: { en: 'Provide the batch number of the vaccine.', fr: 'Fournissez le numéro de lot du vaccin.', pt: 'Forneça o número do lote da vacina.', ar: 'قدم رقم دفعة اللقاح.' } }),
    ],
    { icon: 'Syringe', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// ── LIVESTOCK PRODUCTION FORMS ──────────────────────────────────────

// 7. Animal Breeding and Genomics (11 fields)
function buildAnimalBreeding() {
  fieldOrder = 0;
  const sectionA = makeSection(
    { en: 'Breeding Details', fr: 'Détails d\'Élevage', pt: 'Detalhes de Criação', ar: 'تفاصيل التربية' }, 1,
    [
      dateField('date_collection', { en: 'Date of Data Collection', fr: 'Date de Collecte', pt: 'Data da Coleta de Dados', ar: 'تاريخ جمع البيانات' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }, { required: true }),
      textField('breeding_program_type', { en: 'Type of Breeding/Genetic Improvement Program', fr: 'Type de Programme d\'Amélioration Génétique', pt: 'Tipo de Programa de Melhoramento Genético', ar: 'نوع برنامج التحسين الوراثي' }, { required: true }),
    ],
    { icon: 'Dna', color: '#7C3AED' },
  );

  fieldOrder = 0;
  const sectionB = makeSection(
    { en: 'Program Details', fr: 'Détails du Programme', pt: 'Detalhes do Programa', ar: 'تفاصيل البرنامج' }, 2,
    [
      textField('program_name', { en: 'Name of Breeding/Genetic Improvement Program', fr: 'Nom du Programme', pt: 'Nome do Programa de Melhoramento Genético', ar: 'اسم برنامج التحسين الوراثي' }, { required: true }),
      textField('program_objective', { en: 'Breeding/Genetic Improvement Objective', fr: 'Objectif du Programme', pt: 'Objetivo do Melhoramento Genético', ar: 'هدف التحسين الوراثي' }, { required: true }),
      numberField('herd_size', { en: 'Herd Size', fr: 'Taille du Troupeau', pt: 'Tamanho do Rebanho', ar: 'حجم القطيع' }),
      textField('program_location', { en: 'Location of the Program', fr: 'Localisation du Programme', pt: 'Localização do Programa', ar: 'موقع البرنامج' }, { required: true }),
      textField('assisted_repro_tech', { en: 'Assisted Reproductive Technology', fr: 'Technologie de Reproduction Assistée', pt: 'Tecnologia de Reprodução Assistida', ar: 'تقنية التكاثر المساعد' }, { required: true }),
      selectField('genomic_selection', { en: 'Genomic Selection', fr: 'Sélection Génomique', pt: 'Seleção Genômica', ar: 'الانتقاء الجينومي' }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }], { required: true }),
    ],
    { icon: 'FlaskConical', color: '#0891B2' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionA, sectionB],
    settings: makeSettings(),
  };
}

// 8. Animal Population (Genetic Diversity) (11 fields)
function buildAnimalPopulationGenetic() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Genetic Diversity', fr: 'Diversité Génétique', pt: 'Diversidade Genética', ar: 'التنوع الجيني' }, 1,
    [
      numberField('year_collection', { en: 'Year of Collection', fr: 'Année de Collecte', pt: 'Ano da Coleta', ar: 'سنة الجمع' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }, { required: true }),
      textField('genetic_diversity', { en: 'Genetic Diversity', fr: 'Diversité Génétique', pt: 'Diversidade Genética', ar: 'التنوع الجيني' }, { required: true }),
      textField('breed_characteristics', { en: 'Breed Characteristics', fr: 'Caractéristiques de la Race', pt: 'Características da Raça', ar: 'خصائص السلالة' }, { required: true }),
      textField('trait', { en: 'Trait', fr: 'Trait', pt: 'Característica', ar: 'السمة' }, { required: true }),
      numberField('population_number', { en: 'Population Number', fr: 'Nombre de Population', pt: 'Número da População', ar: 'عدد السكان' }, { required: true }),
      textField('data_collection_method', { en: 'Data Collection', fr: 'Méthode de Collecte', pt: 'Coleta de Dados', ar: 'جمع البيانات' }, { required: true }),
      textField('status', { en: 'Status', fr: 'Statut', pt: 'Estado', ar: 'الحالة' }, { required: true }),
    ],
    { icon: 'BarChart3', color: '#7C3AED' },
  );

  return {
    sections: [makeLocalisationSection(0), section, makeGPSSection(2)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 9. Animal Population and Composition (13 fields)
function buildAnimalPopulationComposition() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Population Census', fr: 'Recensement de la Population', pt: 'Censo Populacional', ar: 'التعداد السكاني' }, 1,
    [
      numberField('year_of_report', { en: 'Year of Report', fr: 'Année du Rapport', pt: 'Ano do Relatório', ar: 'سنة التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      numberField('num_animals', { en: 'Number of Animals', fr: 'Nombre d\'Animaux', pt: 'Número de Animais', ar: 'عدد الحيوانات' }, { required: true }),
      numberField('offtake_number', { en: 'Offtake Number', fr: 'Nombre de Prélèvements', pt: 'Número de Abate', ar: 'عدد المسحوبات' }, { helpText: { en: 'This is the number of animals that have been sold or disposed off, or slaughtered for human consumption.' } }),
      numberField('mortality_number', { en: 'Mortality Number', fr: 'Nombre de Mortalité', pt: 'Número de Mortalidade', ar: 'عدد الوفيات' }, { helpText: { en: 'This is the number of animals that have died as a result of diseases.' } }),
      ageGroupSelect('age_group', { en: 'Age Group', fr: 'Groupe d\'Âge', pt: 'Grupo Etário', ar: 'الفئة العمرية' }),
      sexSelect('sex', { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }),
      numberField('sex_ratio', { en: 'Sex Ratio (M:F)', fr: 'Ratio des Sexes (M:F)', pt: 'Proporção Sexual (M:F)', ar: 'نسبة الجنس (ذ:أ)' }, { helpText: { en: 'This is the ratio of males-to-females for the number of animals in a given species.' } }),
      { id: uuid(), type: 'master-data-select', code: 'production_system', label: { en: 'Production System', fr: 'Système de Production', pt: 'Sistema de Produção', ar: 'نظام الإنتاج' }, column: 1, columnSpan: 1, order: fieldOrder++, required: false, readOnly: false, hidden: false, validation: {}, conditions: [], properties: { masterDataType: 'production-systems', searchable: true } },
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }),
      textField('methodology', { en: 'Methodology', fr: 'Méthodologie', pt: 'Metodologia', ar: 'المنهجية' }, { helpText: { en: 'Types of Research Methods used in reporting.' } }),
      textareaField('specify', { en: 'Specify', fr: 'Préciser', pt: 'Especificar', ar: 'تحديد' }),
    ],
    { icon: 'Users', color: '#0EA5E9' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 10. Breeder Association (16 fields)
function buildBreederAssociation() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Association Details', fr: 'Détails de l\'Association', pt: 'Detalhes da Associação', ar: 'تفاصيل الجمعية' }, 1,
    [
      dateField('date_collection', { en: 'Date of Data Collection', fr: 'Date de Collecte', pt: 'Data da Coleta de Dados', ar: 'تاريخ جمع البيانات' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }, { required: true }),
      textField('association_name', { en: 'Name of Registered Breeders Association', fr: 'Nom de l\'Association', pt: 'Nome da Associação de Criadores Registrada', ar: 'اسم جمعية المربين المسجلة' }, { required: true }),
      numberField('registration_number', { en: 'Registration Number', fr: 'Numéro d\'Enregistrement', pt: 'Número de Registro', ar: 'رقم التسجيل' }),
      textField('location', { en: 'Location', fr: 'Localisation', pt: 'Localização', ar: 'الموقع' }),
      numberField('num_members', { en: 'Number of Registered Members', fr: 'Nombre de Membres', pt: 'Número de Membros Registrados', ar: 'عدد الأعضاء المسجلين' }),
      textField('avg_production', { en: 'Average Production per Trait of Interest', fr: 'Production Moyenne par Trait', pt: 'Produção Média por Característica de Interesse', ar: 'متوسط الإنتاج لكل سمة مهمة' }, { required: true }),
      textField('male_animals_sold', { en: 'Male Live Animals Sold', fr: 'Animaux Mâles Vendus', pt: 'Animais Machos Vivos Vendidos', ar: 'الحيوانات الذكور الحية المباعة' }, { required: true }),
      textField('female_animals_sold', { en: 'Female Live Animals Sold', fr: 'Animaux Femelles Vendus', pt: 'Animais Fêmeas Vivos Vendidos', ar: 'الحيوانات الإناث الحية المباعة' }, { required: true }),
      textField('total_breeding_stock', { en: 'Total Breeding Stock Sold', fr: 'Total Reproducteurs Vendus', pt: 'Total de Reprodutores Vendidos', ar: 'إجمالي المواشي التناسلية المباعة' }),
      selectField('market_type', { en: 'Market (Local, International)', fr: 'Marché', pt: 'Mercado (Local, Internacional)', ar: 'السوق (محلي، دولي)' }, [{ en: 'Local', fr: 'Local', pt: 'Local', ar: 'محلي' }, { en: 'International', fr: 'International', pt: 'Internacional', ar: 'دولي' }], { required: true }),
      textField('genetic_material_type', { en: 'Type of Genetic Material Sold', fr: 'Type de Matériel Génétique Vendu', pt: 'Tipo de Material Genético Vendido', ar: 'نوع المادة الوراثية المباعة' }, { required: true }),
      textField('total_genetic_sold', { en: 'Total Genetic Material Sold', fr: 'Total Matériel Génétique Vendu', pt: 'Total de Material Genético Vendido', ar: 'إجمالي المادة الوراثية المباعة' }, { required: true }),
      selectField('market_type_genetic', { en: 'Market (Local, International)', fr: 'Marché Génétique', pt: 'Mercado (Local, Internacional)', ar: 'السوق (محلي، دولي)' }, [{ en: 'Local', fr: 'Local', pt: 'Local', ar: 'محلي' }, { en: 'International', fr: 'International', pt: 'Internacional', ar: 'دولي' }], { required: true }),
    ],
    { icon: 'Users', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 11. Disaster and Risk Management (13 fields)
function buildDisasterRiskManagement() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Disaster Report', fr: 'Rapport de Catastrophe', pt: 'Relatório de Desastre', ar: 'تقرير الكارثة' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      textField('disaster_type', { en: 'Type of Natural Disaster', fr: 'Type de Catastrophe Naturelle', pt: 'Tipo de Desastre Natural', ar: 'نوع الكارثة الطبيعية' }, { required: true }),
      yesNoField('early_warning_system', { en: 'Existence of National Early Warning System', fr: 'Existence d\'un Système d\'Alerte Précoce', pt: 'Existência de Sistema Nacional de Alerta Precoce', ar: 'وجود نظام إنذار مبكر وطني' }, { required: true }),
      yesNoField('response_agencies', { en: 'Existence of National Preparedness Response Agencies', fr: 'Existence d\'Agences de Réponse', pt: 'Existência de Agências Nacionais de Resposta', ar: 'وجود وكالات استجابة وطنية' }, { required: true }),
      yesNoField('response_laws', { en: 'Existence of National Preparedness Response Law/Policies', fr: 'Existence de Lois/Politiques de Réponse', pt: 'Existência de Leis/Políticas de Resposta Nacional', ar: 'وجود قوانين/سياسات استجابة وطنية' }, { required: true }),
      yesNoField('awareness_strategies', { en: 'Existence of Awareness Creation Strategies', fr: 'Existence de Stratégies de Sensibilisation', pt: 'Existência de Estratégias de Sensibilização', ar: 'وجود استراتيجيات التوعية' }, { required: true }),
      textField('mitigating_measure', { en: 'Mitigating Measure', fr: 'Mesure d\'Atténuation', pt: 'Medida de Mitigação', ar: 'إجراء التخفيف' }, { required: true }),
      textField('other_mitigating', { en: 'Other Mitigating Measure', fr: 'Autre Mesure d\'Atténuation', pt: 'Outra Medida de Mitigação', ar: 'إجراء تخفيف آخر' }),
      numberField('year_experienced', { en: 'Year Experienced', fr: 'Année d\'Expérience', pt: 'Ano de Experiência', ar: 'سنة التجربة' }, { required: true }),
      numberField('num_animal_losses', { en: 'Number of Animal Losses', fr: 'Nombre de Pertes Animales', pt: 'Número de Perdas Animais', ar: 'عدد الخسائر الحيوانية' }, { required: true }),
      numberField('num_human_losses', { en: 'Number of Human Losses', fr: 'Nombre de Pertes Humaines', pt: 'Número de Perdas Humanas', ar: 'عدد الخسائر البشرية' }, { required: true }),
      textField('government_agency', { en: 'National Government Agency', fr: 'Agence Gouvernementale Nationale', pt: 'Agência Governamental Nacional', ar: 'الوكالة الحكومية الوطنية' }, { required: true }),
    ],
    { icon: 'AlertOctagon', color: '#DC2626' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 12. Legislation (10 fields)
function buildLegislation() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Legislation Details', fr: 'Détails de la Législation', pt: 'Detalhes da Legislação', ar: 'تفاصيل التشريع' }, 1,
    [
      dateField('date_collection', { en: 'Date of Data Collection', fr: 'Date de Collecte', pt: 'Data da Coleta de Dados', ar: 'تاريخ جمع البيانات' }, { required: true }),
      selectField('existing_legislation', { en: 'Existing Legislation on Animal Production', fr: 'Législation Existante', pt: 'Legislação Existente sobre Produção Animal', ar: 'التشريعات القائمة بشأن الإنتاج الحيواني' },
        [{ en: 'Act', fr: 'Acte', pt: 'Ato', ar: 'قانون' }, { en: 'Bill', fr: 'Projet de Loi', pt: 'Projeto de Lei', ar: 'مشروع قانون' }, { en: 'Decree', fr: 'Décret', pt: 'Decreto', ar: 'مرسوم' }, { en: 'Law', fr: 'Loi', pt: 'Lei', ar: 'قانون' }, { en: 'Policy', fr: 'Politique', pt: 'Política', ar: 'سياسة' }, { en: 'Regulation', fr: 'Règlement', pt: 'Regulamento', ar: 'لائحة' }, { en: 'Strategy', fr: 'Stratégie', pt: 'Estratégia', ar: 'استراتيجية' }], { required: true }),
      textField('legislation_name', { en: 'Name of Legislation', fr: 'Nom de la Législation', pt: 'Nome da Legislação', ar: 'اسم التشريع' }, { required: true }),
      selectField('status', { en: 'Status', fr: 'Statut', pt: 'Estado', ar: 'الحالة' }, [{ en: 'Updated', fr: 'À jour', pt: 'Atualizado', ar: 'محدث' }, { en: 'Outdated', fr: 'Obsolète', pt: 'Desatualizado', ar: 'قديم' }]),
      textField('implementation_level', { en: 'Level of Implementation', fr: 'Niveau de Mise en Œuvre', pt: 'Nível de Implementação', ar: 'مستوى التنفيذ' }, { required: true }),
      yesNoField('enforcement_mechanisms', { en: 'Existing Mechanisms for Enforcement', fr: 'Mécanismes d\'Application Existants', pt: 'Mecanismos de Aplicação Existentes', ar: 'آليات التطبيق القائمة' }, { required: true }),
      textField('impact_governance', { en: 'Impact of Legislation on Animal Production Governance', fr: 'Impact sur la Gouvernance', pt: 'Impacto da Legislação na Governança da Produção Animal', ar: 'تأثير التشريع على حوكمة الإنتاج الحيواني' }, { required: true }),
      textField('area_improvements', { en: 'Area of Legislation on Animal Production Improvements', fr: 'Domaines d\'Amélioration', pt: 'Áreas de Melhoria da Legislação sobre Produção Animal', ar: 'مجالات تحسين تشريعات الإنتاج الحيواني' }, { required: true }),
      textField('area_focus', { en: 'Area of Focus', fr: 'Domaine de Concentration', pt: 'Área de Foco', ar: 'مجال التركيز' }, { required: true }),
    ],
    { icon: 'Scale', color: '#6366F1' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 13. National Animal Genetic Resources Centre (9 fields)
function buildGeneticResourcesCentre() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Centre Details', fr: 'Détails du Centre', pt: 'Detalhes do Centro', ar: 'تفاصيل المركز' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      numberField('num_centres', { en: 'Number of National Animal Genetic Resource Centres', fr: 'Nombre de Centres', pt: 'Número de Centros Nacionais de Recursos Genéticos Animais', ar: 'عدد المراكز الوطنية للموارد الوراثية الحيوانية' }, { required: true }),
      textField('genetic_material_type', { en: 'Type of Genetic Material Stored', fr: 'Type de Matériel Génétique Stocké', pt: 'Tipo de Material Genético Armazenado', ar: 'نوع المادة الوراثية المخزنة' }, { required: true }),
      numberField('num_imported', { en: 'Number of Breeding and Genetic Material Imported', fr: 'Nombre de Matériel Importé', pt: 'Número de Material Genético Importado', ar: 'عدد المواد الوراثية المستوردة' }, { required: true }),
      numberField('num_exported', { en: 'Number of Breeding and Genetic Material Exported', fr: 'Nombre de Matériel Exporté', pt: 'Número de Material Genético Exportado', ar: 'عدد المواد الوراثية المصدرة' }, { required: true }),
      yesNoField('transfer_agreements', { en: 'Existence of Genetic Material Transfer Agreements', fr: 'Existence d\'Accords de Transfert', pt: 'Existência de Acordos de Transferência de Material Genético', ar: 'وجود اتفاقيات نقل المواد الوراثية' }, { required: true }),
      yesNoField('sops', { en: 'Existence of Standard Operating Procedures', fr: 'Existence de Procédures Opérationnelles Standard', pt: 'Existência de Procedimentos Operacionais Padrão', ar: 'وجود إجراءات التشغيل القياسية' }, { required: true }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }),
    ],
    { icon: 'Database', color: '#7C3AED' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// ── TRADE AND MARKETING FORMS ───────────────────────────────────────

// 14. Cost of Production (10 fields)
function buildCostOfProduction() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Production Costs', fr: 'Coûts de Production', pt: 'Custos de Produção', ar: 'تكاليف الإنتاج' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }),
      numberField('num_animals', { en: 'Number of Animals', fr: 'Nombre d\'Animaux', pt: 'Número de Animais', ar: 'عدد الحيوانات' }, { required: true, helpText: { en: 'Give the number of animals per head' } }),
      decimalField('input_price', { en: 'Input Price (Local Currency)', fr: 'Prix des Intrants (Monnaie Locale)', pt: 'Preço dos Insumos (Moeda Local)', ar: 'سعر المدخلات (العملة المحلية)' }, { required: true, helpText: { en: 'Give the Input price per unit in local currency' } }),
      textField('taxes', { en: 'Taxes (Local Currency)', fr: 'Taxes (Monnaie Locale)', pt: 'Impostos (Moeda Local)', ar: 'الضرائب (العملة المحلية)' }, { required: true, helpText: { en: 'Give the amount of taxes paid in local currency' } }),
      textField('levies', { en: 'Levies (Local Currency)', fr: 'Prélèvements (Monnaie Locale)', pt: 'Taxas (Moeda Local)', ar: 'الرسوم (العملة المحلية)' }, { required: true, helpText: { en: 'Give the amount of levies paid in local currency' } }),
      decimalField('total_cost', { en: 'Total Cost (Local Currency)', fr: 'Coût Total (Monnaie Locale)', pt: 'Custo Total (Moeda Local)', ar: 'التكلفة الإجمالية (العملة المحلية)' }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }),
    ],
    { icon: 'Calculator', color: '#D97706' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 15. Import and Export (16 fields)
function buildImportExport() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Trade Details', fr: 'Détails du Commerce', pt: 'Detalhes do Comércio', ar: 'تفاصيل التجارة' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      textField('port_type', { en: 'Type of Port', fr: 'Type de Port', pt: 'Tipo de Porto', ar: 'نوع الميناء' }, { required: true }),
      textField('activity', { en: 'Activity', fr: 'Activité', pt: 'Atividade', ar: 'النشاط' }, { required: true, helpText: { en: 'Export/import', fr: 'Exportation/importation', pt: 'Exportação/importação', ar: 'تصدير/استيراد' } }),
      dateField('date_importation', { en: 'Date of Importation', fr: 'Date d\'Importation', pt: 'Data de Importação', ar: 'تاريخ الاستيراد' }, { helpText: { en: 'Provide the date that the animals or animal products were actually imported into the country.', fr: 'Fournissez la date à laquelle les animaux ou produits animaux ont été effectivement importés dans le pays.', pt: 'Forneça a data em que os animais ou produtos animais foram efetivamente importados no país.', ar: 'قدم التاريخ الذي تم فيه فعلياً استيراد الحيوانات أو المنتجات الحيوانية إلى البلد.' } }),
      dateField('date_exportation', { en: 'Date of Exportation', fr: 'Date d\'Exportation', pt: 'Data de Exportação', ar: 'تاريخ التصدير' }, { helpText: { en: 'Provide the date that the animals or animal products were actually exported from the country.', fr: 'Fournissez la date à laquelle les animaux ou produits animaux ont été effectivement exportés du pays.', pt: 'Forneça a data em que os animais ou produtos animais foram efetivamente exportados do país.', ar: 'قدم التاريخ الذي تم فيه فعلياً تصدير الحيوانات أو المنتجات الحيوانية من البلد.' } }),
      transportModeSelect('means_transport', { en: 'Means of Transport', fr: 'Moyen de Transport', pt: 'Meio de Transporte', ar: 'وسيلة النقل' }, { helpText: { en: 'Select type of transport used.', fr: 'Sélectionnez le type de transport utilisé.', pt: 'Selecione o tipo de transporte utilizado.', ar: 'اختر نوع النقل المستخدم.' } }),
      textField('animal_product_type', { en: 'Type of Animal or Product', fr: 'Type d\'Animal ou Produit', pt: 'Tipo de Animal ou Produto', ar: 'نوع الحيوان أو المنتج' }, { required: true }),
      speciesSelect('animal_species', { en: 'Animal Species', fr: 'Espèce Animale', pt: 'Espécie Animal', ar: 'النوع الحيواني' }),
      livestockProductSelect('product_name', { en: 'Name of Animal Product', fr: 'Nom du Produit Animal', pt: 'Nome do Produto Animal', ar: 'اسم المنتج الحيواني' },
        { helpText: { en: 'Select the name of animal product being imported or exported if applicable.', fr: 'Sélectionnez le nom du produit animal importé ou exporté si applicable.', pt: 'Selecione o nome do produto animal sendo importado ou exportado, se aplicável.', ar: 'اختر اسم المنتج الحيواني المستورد أو المصدر إن وجد.' } }),
      numberField('quantity', { en: 'Quantity', fr: 'Quantité', pt: 'Quantidade', ar: 'الكمية' }, { required: true }),
      numberField('unit_measurement', { en: 'Unit of Measurement', fr: 'Unité de Mesure', pt: 'Unidade de Medida', ar: 'وحدة القياس' }, { required: true, helpText: { en: 'Indicate the unit of measurement for the quantity provided.', fr: 'Indiquez l\'unité de mesure pour la quantité fournie.', pt: 'Indique a unidade de medida para a quantidade fornecida.', ar: 'حدد وحدة القياس للكمية المقدمة.' } }),
      decimalField('estimated_value', { en: 'Estimated Value', fr: 'Valeur Estimée', pt: 'Valor Estimado', ar: 'القيمة المقدرة' }, { helpText: { en: 'Provide the estimated value of the animals or animal products.', fr: 'Fournissez la valeur estimée des animaux ou produits animaux.', pt: 'Forneça o valor estimado dos animais ou produtos animais.', ar: 'قدم القيمة المقدرة للحيوانات أو المنتجات الحيوانية.' } }),
      textField('currency', { en: 'Currency', fr: 'Devise', pt: 'Moeda', ar: 'العملة' }, { required: true, helpText: { en: 'Give the currency for the estimated value.', fr: 'Indiquez la devise pour la valeur estimée.', pt: 'Informe a moeda para o valor estimado.', ar: 'حدد العملة للقيمة المقدرة.' } }),
      textField('source', { en: 'Source', fr: 'Source', pt: 'Fonte', ar: 'المصدر' }, { helpText: { en: 'Provide the source of the animals or animal product (in case of export).', fr: 'Fournissez la source des animaux ou produits animaux (en cas d\'exportation).', pt: 'Forneça a fonte dos animais ou produtos animais (em caso de exportação).', ar: 'قدم مصدر الحيوانات أو المنتجات الحيوانية (في حالة التصدير).' } }),
      textField('destination', { en: 'Destination', fr: 'Destination', pt: 'Destino', ar: 'الوجهة' }, { helpText: { en: 'Provide the destination of the animals or animal product (in case of export).', fr: 'Fournissez la destination des animaux ou produits animaux (en cas d\'exportation).', pt: 'Forneça o destino dos animais ou produtos animais (em caso de exportação).', ar: 'قدم وجهة الحيوانات أو المنتجات الحيوانية (في حالة التصدير).' } }),
    ],
    { icon: 'Ship', color: '#0EA5E9' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 16. Market Demand (11 fields)
function buildMarketDemand() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Demand Data', fr: 'Données de Demande', pt: 'Dados de Demanda', ar: 'بيانات الطلب' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }),
      livestockProductSelect('product_type', { en: 'Type of Product', fr: 'Type de Produit', pt: 'Tipo de Produto', ar: 'نوع المنتج' }, { required: true }),
      textField('product_grade', { en: 'Product Grade', fr: 'Grade du Produit', pt: 'Grau do Produto', ar: 'درجة المنتج' }, { helpText: { en: 'Give the product grade.', fr: 'Indiquez le grade du produit.', pt: 'Informe o grau do produto.', ar: 'حدد درجة المنتج.' } }),
      numberField('quantity', { en: 'Quantity (m3)', fr: 'Quantité (m3)', pt: 'Quantidade (m3)', ar: 'الكمية (م3)' }, { required: true, helpText: { en: 'Give the quantity of the product produced in metric tonnes.', fr: 'Indiquez la quantité du produit produit en tonnes métriques.', pt: 'Informe a quantidade do produto produzido em toneladas métricas.', ar: 'حدد كمية المنتج المنتجة بالأطنان المترية.' } }),
      decimalField('price_product', { en: 'Price Product (Local Currency)', fr: 'Prix du Produit (Monnaie Locale)', pt: 'Preço do Produto (Moeda Local)', ar: 'سعر المنتج (العملة المحلية)' }, { required: true }),
      textField('monthly_demand', { en: 'Monthly Demand Product (Kg)', fr: 'Demande Mensuelle du Produit (Kg)', pt: 'Demanda Mensal do Produto (Kg)', ar: 'الطلب الشهري على المنتج (كغ)' }, { required: true }),
      textField('demand_type', { en: 'Type of Demand', fr: 'Type de Demande', pt: 'Tipo de Demanda', ar: 'نوع الطلب' }),
      dataSourceSelect('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }, { required: true }),
    ],
    { icon: 'TrendingUp', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 17. Market Price (10 fields)
function buildMarketPrice() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Price Data', fr: 'Données de Prix', pt: 'Dados de Preço', ar: 'بيانات الأسعار' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      breedSelect('breed', { en: 'Breed', fr: 'Race', pt: 'Raça', ar: 'السلالة' }),
      ageGroupSelect('age', { en: 'Age', fr: 'Âge', pt: 'Idade', ar: 'العمر' }),
      sexSelect('sex', { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }),
      decimalField('live_weight', { en: 'Live Weight (Kg)', fr: 'Poids Vif (Kg)', pt: 'Peso Vivo (Kg)', ar: 'الوزن الحي (كغ)' }, { required: true }),
      decimalField('animal_price', { en: 'Animal Price (Local Currency)', fr: 'Prix de l\'Animal (Monnaie Locale)', pt: 'Preço do Animal (Moeda Local)', ar: 'سعر الحيوان (العملة المحلية)' }, { required: true }),
      decimalField('live_animal_price', { en: 'Live Animal Price (Local Currency)', fr: 'Prix Animal Vivant (Monnaie Locale)', pt: 'Preço do Animal Vivo (Moeda Local)', ar: 'سعر الحيوان الحي (العملة المحلية)' }, { required: true }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }, { required: true }),
    ],
    { icon: 'DollarSign', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 18. Market Requirement and Location (11 fields)
function buildMarketRequirementLocation() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Market Details', fr: 'Détails du Marché', pt: 'Detalhes do Mercado', ar: 'تفاصيل السوق' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      textField('product', { en: 'Product', fr: 'Produit', pt: 'Produto', ar: 'المنتج' }, { required: true }),
      textField('product_specification', { en: 'Product Specification', fr: 'Spécification du Produit', pt: 'Especificação do Produto', ar: 'مواصفات المنتج' }),
      textField('market_type', { en: 'Type of Market', fr: 'Type de Marché', pt: 'Tipo de Mercado', ar: 'نوع السوق' }, { required: true }),
      textField('market_locations', { en: 'Market Location(s)', fr: 'Localisation(s) du Marché', pt: 'Localização(ões) do Mercado', ar: 'موقع(مواقع) السوق' }),
      textField('buyer_type', { en: 'Type of Buyers', fr: 'Type d\'Acheteurs', pt: 'Tipo de Compradores', ar: 'نوع المشترين' }, { required: true }),
      numberField('num_buyers', { en: 'Number of Buyers', fr: 'Nombre d\'Acheteurs', pt: 'Número de Compradores', ar: 'عدد المشترين' }, { required: true }),
      numberField('num_traders', { en: 'Number of Traders', fr: 'Nombre de Commerçants', pt: 'Número de Comerciantes', ar: 'عدد التجار' }, { required: true }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }, { required: true }),
    ],
    { icon: 'Store', color: '#D97706' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// Helper for Yes/No toggle pairs in Quality Standards forms
function yesNoPair(code: string, label: string, existLabel: string, implLabel: string, helpExist: string, helpImpl: string) {
  return [
    selectField(`${code}_exists`, { en: existLabel }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }], { required: true, helpText: { en: helpExist } }),
    selectField(`${code}_applied`, { en: implLabel }, [{ en: 'Yes', fr: 'Oui', pt: 'Sim', ar: 'نعم' }, { en: 'No', fr: 'Non', pt: 'Não', ar: 'لا' }], { required: true, helpText: { en: helpImpl } }),
  ];
}

// 19. Quality Standards (Inputs & Services) (35 fields)
function buildQualityStandardsInputs() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Regulatory Framework', fr: 'Cadre Réglementaire', pt: 'Quadro Regulamentar', ar: 'الإطار التنظيمي' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      ...yesNoPair('policies', 'Policies', 'Policies', 'Policies Implemented', 'Indicate the existence of Policies', 'Indicate the implementation of Policies'),
      yesNoField('acts', { en: 'Acts', fr: 'Actes', pt: 'Atos', ar: 'قوانين' }, { required: true, helpText: { en: 'Indicate the existence of Parliament Acts' } }),
      ...yesNoPair('movement_reg', 'Animal Movement', 'Animal and Product Movement Regulation', 'Animal and Product Movement Regulation Implemented', 'Indicate the existence of Animal and product movement regulation', 'Indicate the implementation of Animal and product movement regulation'),
      numberField('num_certifications', { en: 'Number of Certifications', fr: 'Nombre de Certifications', pt: 'Número de Certificações', ar: 'عدد الشهادات' }, { required: true, helpText: { en: 'Give the number of certifications' } }),
      ...yesNoPair('sop', 'SOPs', 'Standard Operation Procedures', 'Standard Operation Procedures Applied', 'Indicate the existence of Standard Operation Procedures', 'Indicate the application of SOPs'),
      ...yesNoPair('product_specs', 'Product Specs', 'Product Specifications', 'Product Specifications Applied', 'Indicate the existence of Product Standards', 'Indicate the application of the Product Standards'),
      ...yesNoPair('protocols', 'Protocols', 'Protocols', 'Protocols Applied', 'Indicate the existence of Protocols', 'Indicate the application of the Protocols'),
      ...yesNoPair('guidelines', 'Guidelines', 'Guidelines', 'Guidelines Applied', 'Indicate the existence of Guidelines', 'Indicate the application of the Guidelines'),
      ...yesNoPair('directives', 'Directives', 'Directives', 'Directives Applied', 'Indicate the existence of Directives', 'Indicate the application of the Directives'),
      ...yesNoPair('tariffs', 'Tariffs', 'Tariffs', 'Tariffs Applied', 'Indicate the existence of Tariffs', 'Indicate the application of the Tariffs'),
      ...yesNoPair('quotas', 'Quotas', 'Quotas', 'Quotas Applied', 'Indicate the existence of Quotas', 'Indicate the application of the Quotas'),
      ...yesNoPair('taxes', 'Taxes', 'Taxes', 'Taxes Applied', 'Indicate the existence of Taxes', 'Indicate the application of the Taxes'),
      ...yesNoPair('levies', 'Levies', 'Levies', 'Levies Applied', 'Indicate the existence of Levies', 'Indicate the implementation of the Levies'),
      ...yesNoPair('subsidies', 'Subsidies', 'Subsidies', 'Subsidies Applied', 'Indicate the existence of Subsidies', 'Indicate the application of the Subsidies'),
      ...yesNoPair('legal_status', 'Legal Status', 'Legal Status', 'Legal Status Implemented', 'Indicate the existence of Legal status', 'Indicate the implementation of the Legal status'),
      ...yesNoPair('quality_inputs', 'Quality Inputs', 'Quality Inputs', 'Quality Inputs Applied', 'Indicate the existence of Quality inputs', 'Indicate the application of the Quality inputs'),
      ...yesNoPair('customs_duty', 'Customs Duty', 'Customs Duty Rates', 'Customs Duty Rates Applied', 'Indicate the existence of Customs duty rates', 'Indicate the application of the Customs duty rates'),
      ...yesNoPair('biosecurity', 'Biosecurity', 'Biosecurity Measures', 'Biosecurity Measures Applied', 'Indicate the existence of Biosecurity measures', 'Indicate the application of the Biosecurity measures'),
    ],
    { icon: 'BadgeCheck', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 20. Quality Standards (Poultry/Hatchery) (26 fields)
function buildQualityStandardsPoultry() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Poultry Regulatory Framework', fr: 'Cadre Réglementaire Avicole', pt: 'Quadro Regulamentar Avícola', ar: 'الإطار التنظيمي للدواجن' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      ...yesNoPair('policies', 'Policies', 'Policies', 'Implementation Policies', 'Indicate the existence of policies', 'Indicate the implementation of policies'),
      yesNoField('acts', { en: 'Acts', fr: 'Actes', pt: 'Atos', ar: 'قوانين' }, { required: true, helpText: { en: 'Indicate the existence of parliament acts' } }),
      ...yesNoPair('biosecurity', 'Biosecurity', 'Biosecurity', 'Application Biosecurity', 'Indicate the existence of biosecurity measures', 'Indicate the application of the biosecurity measures'),
      ...yesNoPair('regulations', 'Regulations', 'Regulations', 'Implementation Regulations', 'Indicate the existence of regulations', 'Indicate the implementation of the regulations'),
      yesNoField('sop_hatchery', { en: 'Standard Operation Procedures for Hatchery Operators', fr: 'Procédures Opérationnelles Standard pour les Opérateurs de Couvoir', pt: 'Procedimentos Operacionais Padrão para Operadores de Incubadoras', ar: 'إجراءات التشغيل القياسية لمشغلي المفرخات' }, { required: true, helpText: { en: 'Indicate the existence of standard operation procedures for hatchery operators' } }),
      yesNoField('registration', { en: 'Registration', fr: 'Enregistrement', pt: 'Registro', ar: 'التسجيل' }, { required: true, helpText: { en: 'Indicate the existence of poultry breeder registration' } }),
      ...yesNoPair('handling_movement', 'Handling/Movement', 'Handling and Movement', 'Implementation Handling and Movement', 'Indicate the existence of animal and product movement regulation', 'Indicate the implementation of animal and product movement regulation'),
      yesNoField('permit_requirements', { en: 'Permit Requirements', fr: 'Exigences de Permis', pt: 'Requisitos de Licença', ar: 'متطلبات التصريح' }, { required: true, helpText: { en: 'Indicate the existence of permit' } }),
      ...yesNoPair('awareness_policy', 'Awareness', 'Awareness of Policy', 'Implementation Awareness Policies', 'Indicate the existence of awareness of policies', 'Indicate the implementation of awareness of policies'),
      ...yesNoPair('health_certificate', 'Health Cert', 'Health Certificate', 'Application Health Certificate', 'Indicate the existence of health certificate', 'Indicate the application of the health certificate'),
      ...yesNoPair('product_standards', 'Product Stds', 'Product Standards', 'Application Product Standards', 'Indicate the existence of product standards', 'Indicate the application of the product standards'),
      ...yesNoPair('guidelines_marketing', 'Marketing', 'Guidelines Transformation and Marketing Procedure', 'Application Guidelines Transformation and Marketing Procedure', 'Indicate the existence of guidelines on transformation and marketing procedure', 'Indicate the application of the guidelines on transformation and marketing procedure'),
      ...yesNoPair('certification', 'Certification', 'Procedure for Certification', 'Application Procedure for Certification', 'Indicate the existence of the procedure for certification', 'Indicate the application of the procedure for certification'),
      ...yesNoPair('tech_specs', 'Tech Specs', 'Technical Specifications', 'Application of the Technical Specifications', 'Indicate the existence of technical specifications', 'Indicate the application of the technical specifications'),
    ],
    { icon: 'BadgeCheck', color: '#7C3AED' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// 21. Volume and Availability of Transport (14 fields)
function buildTransport() {
  fieldOrder = 0;
  const section = makeSection(
    { en: 'Transport Data', fr: 'Données de Transport', pt: 'Dados de Transporte', ar: 'بيانات النقل' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relatório', ar: 'تاريخ التقرير' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      numberField('num_animals', { en: 'Number of Animals (head)', fr: 'Nombre d\'Animaux (tête)', pt: 'Número de Animais (cabeça)', ar: 'عدد الحيوانات (رأس)' }, { required: true }),
      textField('product_type', { en: 'Type of Product', fr: 'Type de Produit', pt: 'Tipo de Produto', ar: 'نوع المنتج' }, { required: true }),
      yesNoField('transport', { en: 'Transport', fr: 'Transport', pt: 'Transporte', ar: 'النقل' }, { required: true, helpText: { en: 'Indicate if the products are transported to the markets.', fr: 'Indiquez si les produits sont transportés vers les marchés.', pt: 'Indique se os produtos são transportados para os mercados.', ar: 'حدد ما إذا كانت المنتجات تُنقل إلى الأسواق.' } }),
      textField('transport_type', { en: 'Type of Transport', fr: 'Type de Transport', pt: 'Tipo de Transporte', ar: 'نوع النقل' }),
      numberField('num_transporters', { en: 'Number of Transporters', fr: 'Nombre de Transporteurs', pt: 'Número de Transportadores', ar: 'عدد الناقلين' }, { required: true }),
      textField('transport_capacity', { en: 'Capacity of Transport (m3)', fr: 'Capacité de Transport (m3)', pt: 'Capacidade de Transporte (m3)', ar: 'سعة النقل (م3)' }, { required: true }),
      textField('transporter_location', { en: 'Location of Transporters', fr: 'Localisation des Transporteurs', pt: 'Localização dos Transportadores', ar: 'موقع الناقلين' }),
      textField('distance_to_market', { en: 'Distance to Market (km)', fr: 'Distance au Marché (km)', pt: 'Distância ao Mercado (km)', ar: 'المسافة إلى السوق (كم)' }, { helpText: { en: 'Indicate the approximative distance (km) between the production site and the market.', fr: 'Indiquez la distance approximative (km) entre le site de production et le marché.', pt: 'Indique a distância aproximada (km) entre o local de produção e o mercado.', ar: 'حدد المسافة التقريبية (كم) بين موقع الإنتاج والسوق.' } }),
      yesNoField('insurance', { en: 'Insurance', fr: 'Assurance', pt: 'Seguro', ar: 'التأمين' }, { required: true, helpText: { en: 'Indicate if Insurance services and products are available.', fr: 'Indiquez si des services et produits d\'assurance sont disponibles.', pt: 'Indique se serviços e produtos de seguro estão disponíveis.', ar: 'حدد ما إذا كانت خدمات ومنتجات التأمين متاحة.' } }),
      textField('insurance_services', { en: 'Insurance Services and Products', fr: 'Services et Produits d\'Assurance', pt: 'Serviços e Produtos de Seguro', ar: 'خدمات ومنتجات التأمين' }, { helpText: { en: 'Indicate the type of available insurance services and products.', fr: 'Indiquez le type de services et produits d\'assurance disponibles.', pt: 'Indique o tipo de serviços e produtos de seguro disponíveis.', ar: 'حدد نوع خدمات ومنتجات التأمين المتاحة.' } }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }, { required: true }),
    ],
    { icon: 'Truck', color: '#0EA5E9' },
  );

  return {
    sections: [makeLocalisationSection(0), section],
    settings: makeSettings(),
  };
}

// ── AQUATIC ANIMAL HEALTH FORM ──────────────────────────────────────

// 22. Aquatic Animal Health Event Report (9 sections)
function buildAquaticAnimalHealthReport() {
  // Section 1: General Information
  fieldOrder = 0;
  const sectionGeneral = makeSection(
    { en: 'General Information', fr: 'Informations G\u00e9n\u00e9rales', pt: 'Informa\u00e7\u00f5es Gerais', ar: '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0627\u0645\u0629' }, 1,
    [
      dateField('date_of_report', { en: 'Date of Report', fr: 'Date du Rapport', pt: 'Data do Relat\u00f3rio', ar: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u0631\u064a\u0631' }, { required: true }),
      textField('reporting_officer', { en: 'Reporting Officer', fr: 'Agent D\u00e9clarant', pt: 'Oficial Relator', ar: '\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0628\u0644\u063a' }, { required: true }),
      textField('reference_number', { en: 'Reference Number', fr: 'Num\u00e9ro de R\u00e9f\u00e9rence', pt: 'N\u00famero de Refer\u00eancia', ar: '\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639' }),
      selectField('reporting_period', { en: 'Reporting Period', fr: 'P\u00e9riode de D\u00e9claration', pt: 'Per\u00edodo de Relat\u00f3rio', ar: '\u0641\u062a\u0631\u0629 \u0627\u0644\u0625\u0628\u0644\u0627\u063a' }, ['Q1', 'Q2', 'Q3', 'Q4', 'Annual']),
      selectField('water_body_type', { en: 'Type of Water Body', fr: 'Type de Plan d\'Eau', pt: 'Tipo de Corpo d\'\u00c1gua', ar: '\u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u0637\u062d \u0627\u0644\u0645\u0627\u0626\u064a' },
        [{ en: 'Lake', fr: 'Lac' }, { en: 'River', fr: 'Rivi\u00e8re' }, { en: 'Pond', fr: '\u00c9tang' }, { en: 'Reservoir', fr: 'R\u00e9servoir' }, { en: 'Dam', fr: 'Barrage' }, { en: 'Estuary', fr: 'Estuaire' }, { en: 'Ocean', fr: 'Oc\u00e9an' }, { en: 'Lagoon', fr: 'Lagune' }]),
      textField('water_body_name', { en: 'Name of Water Body', fr: 'Nom du Plan d\'Eau', pt: 'Nome do Corpo d\'\u00c1gua', ar: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0637\u062d \u0627\u0644\u0645\u0627\u0626\u064a' }),
      textField('farm_name', { en: 'Farm/Site Name', fr: 'Nom de la Ferme/Site', pt: 'Nome da Fazenda/Local', ar: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0632\u0631\u0639\u0629/\u0627\u0644\u0645\u0648\u0642\u0639' }),
      textField('owner_name', { en: 'Farm Owner/Operator', fr: 'Propri\u00e9taire/Exploitant', pt: 'Propriet\u00e1rio/Operador', ar: '\u0645\u0627\u0644\u0643/\u0645\u0634\u063a\u0644 \u0627\u0644\u0645\u0632\u0631\u0639\u0629' }),
      textField('contact_phone', { en: 'Contact Phone', fr: 'T\u00e9l\u00e9phone', pt: 'Telefone de Contato', ar: '\u0647\u0627\u062a\u0641 \u0627\u0644\u0627\u062a\u0635\u0627\u0644' }),
    ],
    { icon: 'FileText', color: '#0EA5E9' },
  );

  // Section 2: Production System & Environment
  fieldOrder = 0;
  const sectionProduction = makeSection(
    { en: 'Production System & Environment', fr: 'Syst\u00e8me de Production & Environnement', pt: 'Sistema de Produ\u00e7\u00e3o & Ambiente', ar: '\u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u0646\u062a\u0627\u062c \u0648\u0627\u0644\u0628\u064a\u0626\u0629' }, 2,
    [
      selectField('production_system_type', { en: 'Production System Type', fr: 'Type de Syst\u00e8me de Production', pt: 'Tipo de Sistema de Produ\u00e7\u00e3o', ar: '\u0646\u0648\u0639 \u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u0646\u062a\u0627\u062c' },
        [{ en: 'Capture Fisheries', fr: 'P\u00eache de Capture' }, { en: 'Aquaculture - Pond', fr: 'Aquaculture - \u00c9tang' }, { en: 'Aquaculture - Cage', fr: 'Aquaculture - Cage' }, { en: 'Aquaculture - Raceway', fr: 'Aquaculture - Canal' }, { en: 'Aquaculture - Tank/RAS', fr: 'Aquaculture - Bassin/RAS' }, { en: 'Wild/Natural', fr: 'Sauvage/Naturel' }]),
      selectField('water_source', { en: 'Water Source', fr: 'Source d\'Eau', pt: 'Fonte de \u00c1gua', ar: '\u0645\u0635\u062f\u0631 \u0627\u0644\u0645\u064a\u0627\u0647' },
        [{ en: 'Freshwater', fr: 'Eau douce' }, { en: 'Marine', fr: 'Marin' }, { en: 'Brackish', fr: 'Saum\u00e2tre' }]),
      selectField('culture_intensity', { en: 'Culture Intensity', fr: 'Intensit\u00e9 de Culture', pt: 'Intensidade de Cultura', ar: '\u0643\u062b\u0627\u0641\u0629 \u0627\u0644\u0627\u0633\u062a\u0632\u0631\u0627\u0639' },
        [{ en: 'Extensive', fr: 'Extensif' }, { en: 'Semi-intensive', fr: 'Semi-intensif' }, { en: 'Intensive', fr: 'Intensif' }, { en: 'Super-intensive', fr: 'Super-intensif' }]),
      numberField('stocking_density', { en: 'Stocking Density (fish/m\u00b3 or /ha)', fr: 'Densit\u00e9 de Peuplement', pt: 'Densidade de Estocagem', ar: '\u0643\u062b\u0627\u0641\u0629 \u0627\u0644\u062a\u062e\u0632\u064a\u0646' }),
      selectField('feed_type', { en: 'Feed Type', fr: 'Type d\'Aliment', pt: 'Tipo de Alimento', ar: '\u0646\u0648\u0639 \u0627\u0644\u0639\u0644\u0641' },
        [{ en: 'Natural', fr: 'Naturel' }, { en: 'Supplementary', fr: 'Suppl\u00e9mentaire' }, { en: 'Complete', fr: 'Complet' }, { en: 'None', fr: 'Aucun' }]),
      decimalField('total_area_ha', { en: 'Total Production Area (ha)', fr: 'Surface Totale de Production (ha)', pt: '\u00c1rea Total de Produ\u00e7\u00e3o (ha)', ar: '\u0625\u062c\u0645\u0627\u0644\u064a \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0625\u0646\u062a\u0627\u062c (\u0647\u0643\u062a\u0627\u0631)' }),
      numberField('year_established', { en: 'Year Established', fr: 'Ann\u00e9e d\'\u00c9tablissement', pt: 'Ano de Estabelecimento', ar: '\u0633\u0646\u0629 \u0627\u0644\u062a\u0623\u0633\u064a\u0633' }),
    ],
    { icon: 'Factory', color: '#059669' },
  );

  // Section 3: Water Quality Parameters
  fieldOrder = 0;
  const sectionWaterQuality = makeSection(
    { en: 'Water Quality Parameters', fr: 'Param\u00e8tres de Qualit\u00e9 de l\'Eau', pt: 'Par\u00e2metros de Qualidade da \u00c1gua', ar: '\u0645\u0639\u0627\u064a\u064a\u0631 \u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u064a\u0627\u0647' }, 3,
    [
      decimalField('water_temperature', { en: 'Water Temperature (\u00b0C)', fr: 'Temp\u00e9rature de l\'Eau (\u00b0C)', pt: 'Temperatura da \u00c1gua (\u00b0C)', ar: '\u062f\u0631\u062c\u0629 \u062d\u0631\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0621' }),
      decimalField('dissolved_oxygen', { en: 'Dissolved Oxygen (mg/L)', fr: 'Oxyg\u00e8ne Dissous (mg/L)', pt: 'Oxig\u00eanio Dissolvido (mg/L)', ar: '\u0627\u0644\u0623\u0643\u0633\u062c\u064a\u0646 \u0627\u0644\u0645\u0630\u0627\u0628' }),
      decimalField('ph_level', { en: 'pH Level', fr: 'Niveau de pH', pt: 'N\u00edvel de pH', ar: '\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062d\u0645\u0648\u0636\u0629' }),
      decimalField('ammonia_level', { en: 'Ammonia (mg/L)', fr: 'Ammoniac (mg/L)', pt: 'Am\u00f4nia (mg/L)', ar: '\u0627\u0644\u0623\u0645\u0648\u0646\u064a\u0627' }),
      decimalField('nitrite_level', { en: 'Nitrite (mg/L)', fr: 'Nitrite (mg/L)', pt: 'Nitrito (mg/L)', ar: '\u0627\u0644\u0646\u062a\u0631\u064a\u062a' }),
      textField('turbidity', { en: 'Turbidity', fr: 'Turbidit\u00e9', pt: 'Turbidez', ar: '\u0627\u0644\u0639\u0643\u0627\u0631\u0629' }),
      decimalField('salinity', { en: 'Salinity (ppt)', fr: 'Salinit\u00e9 (ppt)', pt: 'Salinidade (ppt)', ar: '\u0627\u0644\u0645\u0644\u0648\u062d\u0629' }),
      textareaField('water_quality_notes', { en: 'Additional Observations', fr: 'Observations Suppl\u00e9mentaires', pt: 'Observa\u00e7\u00f5es Adicionais', ar: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629' }, { columnSpan: 2 }),
    ],
    { icon: 'Droplets', color: '#06B6D4' },
  );

  // Section 4: Affected Animals (repeater)
  fieldOrder = 0;
  const sectionAffected = makeSection(
    { en: 'Affected Animals', fr: 'Animaux Affect\u00e9s', pt: 'Animais Afetados', ar: '\u0627\u0644\u062d\u064a\u0648\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062a\u0623\u062b\u0631\u0629' }, 4,
    [
      makeRepeater('affected_animals', { en: 'Affected Species', fr: 'Esp\u00e8ces Affect\u00e9es', pt: 'Esp\u00e9cies Afetadas', ar: '\u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u062a\u0623\u062b\u0631\u0629' }, [
        { type: 'master-data-select', code: 'species', label: { en: 'Species', fr: 'Esp\u00e8ce', pt: 'Esp\u00e9cie', ar: '\u0627\u0644\u0646\u0648\u0639' }, required: true, properties: { masterDataType: 'species', searchable: true, filterGroup: 'AQUATIC' } },
        { type: 'select', code: 'age_class', label: { en: 'Age Class', fr: 'Classe d\'\u00c2ge', pt: 'Classe Et\u00e1ria', ar: '\u0627\u0644\u0641\u0626\u0629 \u0627\u0644\u0639\u0645\u0631\u064a\u0629' }, properties: { options: [{ label: { en: 'Fry' }, value: 'fry' }, { label: { en: 'Fingerling' }, value: 'fingerling' }, { label: { en: 'Juvenile' }, value: 'juvenile' }, { label: { en: 'Sub-adult' }, value: 'sub_adult' }, { label: { en: 'Adult' }, value: 'adult' }, { label: { en: 'Broodstock' }, value: 'broodstock' }] } },
        { type: 'number', code: 'total_population', label: { en: 'Total Stock', fr: 'Stock Total', pt: 'Estoque Total', ar: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062e\u0632\u0648\u0646' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_affected', label: { en: 'Number Affected', fr: 'Nombre Affect\u00e9s', pt: 'N\u00famero Afetados', ar: '\u0639\u062f\u062f \u0627\u0644\u0645\u062a\u0623\u062b\u0631\u064a\u0646' }, required: true, properties: { min: 0 } },
        { type: 'number', code: 'num_deaths', label: { en: 'Mortalities', fr: 'Mortalit\u00e9s', pt: 'Mortalidades', ar: '\u0627\u0644\u0648\u0641\u064a\u0627\u062a' }, properties: { min: 0 } },
        { type: 'number', code: 'mortality_rate', label: { en: 'Mortality Rate (%)', fr: 'Taux de Mortalit\u00e9 (%)', pt: 'Taxa de Mortalidade (%)', ar: '\u0645\u0639\u062f\u0644 \u0627\u0644\u0648\u0641\u064a\u0627\u062a (%)' }, properties: { min: 0, max: 100, step: 0.01 } },
        { type: 'date', code: 'date_first_signs', label: { en: 'Date First Signs', fr: 'Date Premiers Signes', pt: 'Data Primeiros Sinais', ar: '\u062a\u0627\u0631\u064a\u062e \u0623\u0648\u0644 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a' } },
        { type: 'select', code: 'daily_mortality_pattern', label: { en: 'Daily Mortality Pattern', fr: 'Tendance de Mortalit\u00e9', pt: 'Padr\u00e3o de Mortalidade', ar: '\u0646\u0645\u0637 \u0627\u0644\u0648\u0641\u064a\u0627\u062a' }, properties: { options: [{ label: { en: 'Increasing' }, value: 'increasing' }, { label: { en: 'Stable' }, value: 'stable' }, { label: { en: 'Decreasing' }, value: 'decreasing' }, { label: { en: 'Sporadic' }, value: 'sporadic' }] } },
      ], { addLabel: { en: 'Add species', fr: 'Ajouter une esp\u00e8ce', pt: 'Adicionar esp\u00e9cie', ar: '\u0625\u0636\u0627\u0641\u0629 \u0646\u0648\u0639' } }),
    ],
    { icon: 'Fish', color: '#F97316', columns: 1 },
  );

  // Section 5: Disease Description
  fieldOrder = 0;
  const sectionDisease = makeSection(
    { en: 'Disease Description', fr: 'Description de la Maladie', pt: 'Descri\u00e7\u00e3o da Doen\u00e7a', ar: '\u0648\u0635\u0641 \u0627\u0644\u0645\u0631\u0636' }, 5,
    [
      diseaseSelect('disease', { en: 'Disease / Suspected Disease', fr: 'Maladie / Maladie Suspect\u00e9e', pt: 'Doen\u00e7a / Doen\u00e7a Suspeita', ar: '\u0627\u0644\u0645\u0631\u0636 / \u0627\u0644\u0645\u0631\u0636 \u0627\u0644\u0645\u0634\u062a\u0628\u0647' }, { required: true }),
      textareaField('clinical_signs_observed', { en: 'Clinical Signs Observed', fr: 'Signes Cliniques Observ\u00e9s', pt: 'Sinais Cl\u00ednicos Observados', ar: '\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629' }, { required: true, columnSpan: 2 }),
      makeRepeater('external_lesions', { en: 'External Lesions', fr: 'L\u00e9sions Externes', pt: 'Les\u00f5es Externas', ar: '\u0627\u0644\u0622\u0641\u0627\u062a \u0627\u0644\u062e\u0627\u0631\u062c\u064a\u0629' }, [
        { type: 'select', code: 'lesion_type', label: { en: 'Lesion Type', fr: 'Type de L\u00e9sion' }, required: true, properties: { options: [
          { label: { en: 'Skin ulcers', fr: 'Ulc\u00e8res cutan\u00e9s' }, value: 'skin_ulcers' },
          { label: { en: 'Fin rot', fr: 'Pourriture des nageoires' }, value: 'fin_rot' },
          { label: { en: 'Hemorrhages', fr: 'H\u00e9morragies' }, value: 'hemorrhages' },
          { label: { en: 'Exophthalmia', fr: 'Exophtalmie' }, value: 'exophthalmia' },
          { label: { en: 'Scale loss', fr: 'Perte d\'\u00e9cailles' }, value: 'scale_loss' },
          { label: { en: 'Discoloration', fr: 'D\u00e9coloration' }, value: 'discoloration' },
          { label: { en: 'Gill necrosis', fr: 'N\u00e9crose branchiale' }, value: 'gill_necrosis' },
          { label: { en: 'Abdominal distension', fr: 'Distension abdominale' }, value: 'abdominal_distension' },
        ] } },
      ], { required: false, minRows: 0, maxRows: 8, addLabel: { en: 'Add lesion', fr: 'Ajouter une l\u00e9sion' } }),
      makeRepeater('behavioral_signs', { en: 'Behavioral Signs', fr: 'Signes Comportementaux', pt: 'Sinais Comportamentais', ar: '\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0633\u0644\u0648\u0643\u064a\u0629' }, [
        { type: 'select', code: 'sign_type', label: { en: 'Sign Type', fr: 'Type de Signe' }, required: true, properties: { options: [
          { label: { en: 'Lethargy', fr: 'L\u00e9thargie' }, value: 'lethargy' },
          { label: { en: 'Erratic swimming', fr: 'Nage erratique' }, value: 'erratic_swimming' },
          { label: { en: 'Loss of appetite', fr: 'Perte d\'app\u00e9tit' }, value: 'loss_of_appetite' },
          { label: { en: 'Surface gasping', fr: 'Respiration en surface' }, value: 'surface_gasping' },
          { label: { en: 'Flashing/rubbing', fr: '\u00c9clairs/frottements' }, value: 'flashing_rubbing' },
          { label: { en: 'Spiral swimming', fr: 'Nage en spirale' }, value: 'spiral_swimming' },
        ] } },
      ], { required: false, minRows: 0, maxRows: 6, addLabel: { en: 'Add sign', fr: 'Ajouter un signe' } }),
      decimalField('morbidity_rate', { en: 'Morbidity Rate (%)', fr: 'Taux de Morbidit\u00e9 (%)', pt: 'Taxa de Morbidade (%)', ar: '\u0645\u0639\u062f\u0644 \u0627\u0644\u0627\u0639\u062a\u0644\u0627\u0644' }),
      numberField('duration_of_illness_days', { en: 'Duration of Illness (days)', fr: 'Dur\u00e9e de la Maladie (jours)', pt: 'Dura\u00e7\u00e3o da Doen\u00e7a (dias)', ar: '\u0645\u062f\u0629 \u0627\u0644\u0645\u0631\u0636 (\u0623\u064a\u0627\u0645)' }),
      selectField('seasonal_pattern', { en: 'Seasonal Pattern', fr: 'Tendance Saisonni\u00e8re', pt: 'Padr\u00e3o Sazonal', ar: '\u0627\u0644\u0646\u0645\u0637 \u0627\u0644\u0645\u0648\u0633\u0645\u064a' },
        [{ en: 'Dry season', fr: 'Saison s\u00e8che' }, { en: 'Wet season', fr: 'Saison des pluies' }, { en: 'Cold season', fr: 'Saison froide' }, { en: 'Year-round', fr: 'Toute l\'ann\u00e9e' }, { en: 'First occurrence', fr: 'Premi\u00e8re occurrence' }]),
    ],
    { icon: 'Bug', color: '#EF4444', columns: 1 },
  );

  // Section 6: Diagnostic Procedure
  fieldOrder = 0;
  const sectionDiagnostic = makeSection(
    { en: 'Diagnostic Procedure', fr: 'Proc\u00e9dure de Diagnostic', pt: 'Procedimento Diagn\u00f3stico', ar: '\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u062a\u0634\u062e\u064a\u0635' }, 6,
    [
      yesNoField('samples_collected', { en: 'Were Samples Collected?', fr: 'Des \u00c9chantillons ont-ils \u00e9t\u00e9 Pr\u00e9lev\u00e9s?', pt: 'Amostras foram Coletadas?', ar: '\u0647\u0644 \u062a\u0645 \u062c\u0645\u0639 \u0639\u064a\u0646\u0627\u062a\u061f' }),
      sampleTypeSelect('sample_type', { en: 'Sample Type', fr: 'Type d\'\u00c9chantillon', pt: 'Tipo de Amostra', ar: '\u0646\u0648\u0639 \u0627\u0644\u0639\u064a\u0646\u0629' }),
      labSelect('lab', { en: 'Laboratory', fr: 'Laboratoire', pt: 'Laborat\u00f3rio', ar: '\u0627\u0644\u0645\u062e\u062a\u0628\u0631' }),
      testTypeSelect('test_type', { en: 'Test Type', fr: 'Type de Test', pt: 'Tipo de Teste', ar: '\u0646\u0648\u0639 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631' }),
      selectField('test_result', { en: 'Test Result', fr: 'R\u00e9sultat du Test', pt: 'Resultado do Teste', ar: '\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631' },
        [{ en: 'Positive', fr: 'Positif' }, { en: 'Negative', fr: 'N\u00e9gatif' }, { en: 'Inconclusive', fr: 'Non Concluant' }, { en: 'Pending', fr: 'En Attente' }]),
      dateField('date_sample_collected', { en: 'Date Sample Collected', fr: 'Date de Pr\u00e9l\u00e8vement', pt: 'Data de Coleta da Amostra', ar: '\u062a\u0627\u0631\u064a\u062e \u062c\u0645\u0639 \u0627\u0644\u0639\u064a\u0646\u0629' }),
      dateField('date_result_received', { en: 'Date Result Received', fr: 'Date de R\u00e9ception du R\u00e9sultat', pt: 'Data de Recebimento do Resultado', ar: '\u062a\u0627\u0631\u064a\u062e \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0646\u062a\u064a\u062c\u0629' }),
      diagnosisBasisSelect('diagnosis_basis', { en: 'Basis of Diagnosis', fr: 'Base du Diagnostic', pt: 'Base do Diagn\u00f3stico', ar: '\u0623\u0633\u0627\u0633 \u0627\u0644\u062a\u0634\u062e\u064a\u0635' }),
      textField('confirmed_pathogen', { en: 'Confirmed Pathogen', fr: 'Pathog\u00e8ne Confirm\u00e9', pt: 'Pat\u00f3geno Confirmado', ar: '\u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u0645\u0645\u0631\u0636 \u0627\u0644\u0645\u0624\u0643\u062f' }),
    ],
    { icon: 'Microscope', color: '#8B5CF6' },
  );

  // Section 7: Epidemiology & Control
  fieldOrder = 0;
  const sectionEpiControl = makeSection(
    { en: 'Epidemiology & Control', fr: '\u00c9pid\u00e9miologie & Contr\u00f4le', pt: 'Epidemiologia & Controle', ar: '\u0639\u0644\u0645 \u0627\u0644\u0623\u0648\u0628\u0626\u0629 \u0648\u0627\u0644\u0645\u0643\u0627\u0641\u062d\u0629' }, 7,
    [
      sourceOfInfectionSelect('source_of_infection', { en: 'Source of Infection', fr: 'Source d\'Infection', pt: 'Fonte de Infec\u00e7\u00e3o', ar: '\u0645\u0635\u062f\u0631 \u0627\u0644\u0639\u062f\u0648\u0649' }),
      selectField('suspected_spread_mechanism', { en: 'Suspected Spread Mechanism', fr: 'M\u00e9canisme de Propagation Suspect\u00e9', pt: 'Mecanismo de Propaga\u00e7\u00e3o Suspeito', ar: '\u0622\u0644\u064a\u0629 \u0627\u0644\u0627\u0646\u062a\u0634\u0627\u0631 \u0627\u0644\u0645\u0634\u062a\u0628\u0647\u0629' },
        [{ en: 'Water-borne', fr: 'Hydrique' }, { en: 'Fish-to-fish', fr: 'Poisson \u00e0 poisson' }, { en: 'Fomites', fr: 'Fomites' }, { en: 'Wild fish introduction', fr: 'Introduction de poissons sauvages' }, { en: 'Imported stock', fr: 'Stock import\u00e9' }, { en: 'Unknown', fr: 'Inconnu' }]),
      yesNoField('other_farms_affected', { en: 'Other Farms in Area Affected?', fr: 'Autres Fermes Affect\u00e9es?', pt: 'Outras Fazendas Afetadas?', ar: '\u0647\u0644 \u062a\u0623\u062b\u0631\u062a \u0645\u0632\u0627\u0631\u0639 \u0623\u062e\u0631\u0649\u061f' }),
      numberField('num_farms_affected', { en: 'Number of Other Farms Affected', fr: 'Nombre d\'Autres Fermes Affect\u00e9es', pt: 'N\u00famero de Outras Fazendas Afetadas', ar: '\u0639\u062f\u062f \u0627\u0644\u0645\u0632\u0627\u0631\u0639 \u0627\u0644\u0623\u062e\u0631\u0649 \u0627\u0644\u0645\u062a\u0623\u062b\u0631\u0629' }),
      makeRepeater('control_measures', { en: 'Control Measures', fr: 'Mesures de Contr\u00f4le', pt: 'Medidas de Controle', ar: '\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0643\u0627\u0641\u062d\u0629' }, [
        { type: 'master-data-select', code: 'measure', label: { en: 'Control Measure', fr: 'Mesure de Contr\u00f4le' }, required: true, properties: { masterDataType: 'control-measures', searchable: true } },
        { type: 'text', code: 'flag', label: { en: 'Status/Flag', fr: 'Statut/Indicateur' } },
      ], { addLabel: { en: 'Add measure', fr: 'Ajouter une mesure' } }),
      yesNoField('movement_restrictions', { en: 'Movement Restrictions Applied?', fr: 'Restrictions de Mouvement Appliqu\u00e9es?', pt: 'Restri\u00e7\u00f5es de Movimento Aplicadas?', ar: '\u0647\u0644 \u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0642\u064a\u0648\u062f \u0627\u0644\u062d\u0631\u0643\u0629\u061f' }),
      textareaField('treatment_applied', { en: 'Treatments/Chemicals Used', fr: 'Traitements/Produits Chimiques Utilis\u00e9s', pt: 'Tratamentos/Qu\u00edmicos Usados', ar: '\u0627\u0644\u0639\u0644\u0627\u062c\u0627\u062a/\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0643\u064a\u0645\u064a\u0627\u0626\u064a\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0629' }, { columnSpan: 2 }),
      outbreakStatusSelect('outbreak_status', { en: 'Outbreak Status', fr: 'Statut du Foyer', pt: 'Estado do Surto', ar: '\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0641\u0634\u064a' }),
      textareaField('economic_impact_estimate', { en: 'Estimated Economic Losses', fr: 'Pertes \u00c9conomiques Estim\u00e9es', pt: 'Perdas Econ\u00f4micas Estimadas', ar: '\u0627\u0644\u062e\u0633\u0627\u0626\u0631 \u0627\u0644\u0627\u0642\u062a\u0635\u0627\u062f\u064a\u0629 \u0627\u0644\u0645\u0642\u062f\u0631\u0629' }, { columnSpan: 2 }),
    ],
    { icon: 'Shield', color: '#059669', columns: 1 },
  );

  // Section 8: Remarks
  fieldOrder = 0;
  const sectionRemarks = makeSection(
    { en: 'Remarks & Recommendations', fr: 'Remarques & Recommandations', pt: 'Observa\u00e7\u00f5es & Recomenda\u00e7\u00f5es', ar: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0648\u062a\u0648\u0635\u064a\u0627\u062a' }, 9,
    [
      textareaField('additional_observations', { en: 'Additional Observations', fr: 'Observations Suppl\u00e9mentaires', pt: 'Observa\u00e7\u00f5es Adicionais', ar: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629' }, { columnSpan: 2 }),
      textareaField('recommendations', { en: 'Recommendations', fr: 'Recommandations', pt: 'Recomenda\u00e7\u00f5es', ar: '\u062a\u0648\u0635\u064a\u0627\u062a' }, { columnSpan: 2 }),
      textareaField('follow_up_actions', { en: 'Follow-up Actions Planned', fr: 'Actions de Suivi Pr\u00e9vues', pt: 'A\u00e7\u00f5es de Acompanhamento Planejadas', ar: '\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u062e\u0637\u0637\u0629' }, { columnSpan: 2 }),
    ],
    { icon: 'MessageSquare', color: '#6366F1' },
  );

  return {
    sections: [
      makeLocalisationSection(0),
      sectionGeneral,
      sectionProduction,
      sectionWaterQuality,
      sectionAffected,
      sectionDisease,
      sectionDiagnostic,
      sectionEpiControl,
      makeGPSSection(8),
      sectionRemarks,
    ],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// ── FISHERIES & AQUACULTURE FORMS ──────────────────────────────────────

// 22. Capture Fisheries Report
function buildCaptureReport() {
  fieldOrder = 0;
  const sectionCapture = makeSection(
    { en: 'Capture Details', fr: 'Détails de Capture', pt: 'Detalhes da Captura', ar: 'تفاصيل الصيد' }, 1,
    [
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      selectField('fao_area_code', { en: 'FAO Fishing Area', fr: 'Zone de Pêche FAO', pt: 'Área de Pesca FAO', ar: 'منطقة الصيد FAO' }, [
        '18 - Arctic Sea', '21 - Atlantic NW', '27 - Atlantic NE', '31 - Atlantic WC',
        '34 - Atlantic EC', '37 - Mediterranean', '41 - Atlantic SW', '47 - Atlantic SE',
        '48 - Antarctic Atlantic', '51 - Indian Ocean W', '57 - Indian Ocean E',
        '58 - Antarctic Indian', '61 - Pacific NW', '67 - Pacific NE', '71 - Pacific WC',
        '77 - Pacific EC', '81 - Pacific SW', '87 - Pacific SE', '88 - Antarctic Pacific',
      ], { required: true }),
      selectField('gear_type', { en: 'Gear Type', fr: 'Type d\'Engin', pt: 'Tipo de Arte', ar: 'نوع المعدات' }, [
        { en: 'Trawl', fr: 'Chalut', pt: 'Arrasto', ar: 'شبكة الجر' },
        { en: 'Gillnet', fr: 'Filet maillant', pt: 'Rede de emalhar', ar: 'شبكة خيشومية' },
        { en: 'Longline', fr: 'Palangre', pt: 'Palangre', ar: 'الخيط الطويل' },
        { en: 'Purse Seine', fr: 'Senne coulissante', pt: 'Cerco', ar: 'شبكة الإحاطة' },
        { en: 'Hook and Line', fr: 'Hameçon et ligne', pt: 'Anzol e linha', ar: 'خطاف وخيط' },
        { en: 'Cast Net', fr: 'Épervier', pt: 'Tarrafa', ar: 'شبكة الرمي' },
        { en: 'Trap', fr: 'Nasse/Piège', pt: 'Armadilha', ar: 'مصيدة' },
        { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' },
      ], { required: true }),
      decimalField('quantity_kg', { en: 'Quantity (kg)', fr: 'Quantité (kg)', pt: 'Quantidade (kg)', ar: 'الكمية (كجم)' }, { required: true }),
      dateField('capture_date', { en: 'Capture Date', fr: 'Date de Capture', pt: 'Data da Captura', ar: 'تاريخ الصيد' }, { required: true }),
      textField('landing_site', { en: 'Landing Site', fr: 'Site de Débarquement', pt: 'Local de Desembarque', ar: 'موقع الإنزال' }, { required: true }),
      selectField('fishing_environment', { en: 'Fishing Environment', fr: 'Environnement de Pêche', pt: 'Ambiente de Pesca', ar: 'بيئة الصيد' }, [
        { en: 'Marine', fr: 'Marin', pt: 'Marinho', ar: 'بحري' },
        { en: 'Freshwater', fr: 'Eau douce', pt: 'Água doce', ar: 'مياه عذبة' },
        { en: 'Brackish', fr: 'Saumâtre', pt: 'Salobra', ar: 'مياه معتدلة الملوحة' },
      ]),
      selectField('production_type', { en: 'Production Type', fr: 'Type de Production', pt: 'Tipo de Produção', ar: 'نوع الإنتاج' }, [
        { en: 'Industrial', fr: 'Industriel', pt: 'Industrial', ar: 'صناعي' },
        { en: 'Semi-industrial', fr: 'Semi-industriel', pt: 'Semi-industrial', ar: 'شبه صناعي' },
        { en: 'Artisanal', fr: 'Artisanal', pt: 'Artesanal', ar: 'حرفي' },
        { en: 'Subsistence', fr: 'Subsistance', pt: 'Subsistência', ar: 'معيشي' },
      ]),
      textField('vessel_name', { en: 'Vessel Name (if applicable)', fr: 'Nom du Navire (si applicable)', pt: 'Nome da Embarcação (se aplicável)', ar: 'اسم السفينة (إن وُجد)' }),
      textareaField('remarks', { en: 'Remarks', fr: 'Remarques', pt: 'Observações', ar: 'ملاحظات' }, { columnSpan: 2 }),
    ],
    { icon: 'Fish', color: '#0EA5E9' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionCapture, makeGPSSection(2)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 23. Fishing Vessel Registration
function buildVesselRegistration() {
  fieldOrder = 0;
  const sectionVessel = makeSection(
    { en: 'Vessel Information', fr: 'Informations du Navire', pt: 'Informações da Embarcação', ar: 'معلومات السفينة' }, 1,
    [
      textField('vessel_name', { en: 'Vessel Name', fr: 'Nom du Navire', pt: 'Nome da Embarcação', ar: 'اسم السفينة' }, { required: true }),
      textField('registration_number', { en: 'Registration Number', fr: 'Numéro d\'Immatriculation', pt: 'Número de Registro', ar: 'رقم التسجيل' }, { required: true }),
      textField('flag_state', { en: 'Flag State', fr: 'État du Pavillon', pt: 'Estado de Bandeira', ar: 'دولة العلم' }, { required: true }),
      selectField('vessel_type', { en: 'Vessel Type', fr: 'Type de Navire', pt: 'Tipo de Embarcação', ar: 'نوع السفينة' }, [
        { en: 'Trawler', fr: 'Chalutier', pt: 'Arrasto', ar: 'سفينة جر' },
        { en: 'Seiner', fr: 'Senneur', pt: 'Cerqueiro', ar: 'سفينة شبكية' },
        { en: 'Longliner', fr: 'Palangrier', pt: 'Palangreiro', ar: 'سفينة الخيط الطويل' },
        { en: 'Artisanal', fr: 'Artisanal', pt: 'Artesanal', ar: 'حرفي' },
        { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' },
      ], { required: true }),
      decimalField('length_meters', { en: 'Length (meters)', fr: 'Longueur (mètres)', pt: 'Comprimento (metros)', ar: 'الطول (أمتار)' }),
      decimalField('tonnage_gt', { en: 'Gross Tonnage (GT)', fr: 'Tonnage Brut (GT)', pt: 'Tonelagem Bruta (GT)', ar: 'الحمولة الإجمالية' }),
      textField('home_port', { en: 'Home Port', fr: 'Port d\'Attache', pt: 'Porto de Origem', ar: 'ميناء الأصل' }),
      decimalField('engine_power_kw', { en: 'Engine Power (kW)', fr: 'Puissance Moteur (kW)', pt: 'Potência do Motor (kW)', ar: 'قوة المحرك (كيلوواط)' }),
      numberField('crew_capacity', { en: 'Crew Capacity', fr: 'Capacité Équipage', pt: 'Capacidade de Tripulação', ar: 'سعة الطاقم' }),
      textField('owner_name', { en: 'Owner Name', fr: 'Nom du Propriétaire', pt: 'Nome do Proprietário', ar: 'اسم المالك' }),
      textField('license_number', { en: 'Fishing License Number', fr: 'Numéro de Licence de Pêche', pt: 'Número da Licença de Pesca', ar: 'رقم رخصة الصيد' }),
      dateField('license_expiry', { en: 'License Expiry Date', fr: 'Date d\'Expiration de la Licence', pt: 'Data de Validade da Licença', ar: 'تاريخ انتهاء الرخصة' }),
      yesNoField('is_active', { en: 'Currently Active?', fr: 'Actuellement Actif ?', pt: 'Atualmente Ativo?', ar: 'نشط حاليا؟' }),
    ],
    { icon: 'Ship', color: '#0284C7' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionVessel],
    settings: makeSettings(),
  };
}

// 24. Fishing Effort Report
function buildFishingEffortReport() {
  fieldOrder = 0;
  const sectionEffort = makeSection(
    { en: 'Fishing Effort Details', fr: 'Détails de l\'Effort de Pêche', pt: 'Detalhes do Esforço de Pesca', ar: 'تفاصيل جهد الصيد' }, 1,
    [
      selectField('effort_type', { en: 'Effort Type', fr: 'Type d\'Effort', pt: 'Tipo de Esforço', ar: 'نوع الجهد' }, [
        { en: 'Days at Sea', fr: 'Jours en mer', pt: 'Dias no mar', ar: 'أيام في البحر' },
        { en: 'Fishing Hours', fr: 'Heures de pêche', pt: 'Horas de pesca', ar: 'ساعات الصيد' },
        { en: 'Number of Trips', fr: 'Nombre de sorties', pt: 'Número de viagens', ar: 'عدد الرحلات' },
        { en: 'Number of Hauls', fr: 'Nombre de traits', pt: 'Número de lances', ar: 'عدد السحبات' },
        { en: 'Number of Hooks', fr: 'Nombre d\'hameçons', pt: 'Número de anzóis', ar: 'عدد الخطافات' },
        { en: 'Net Length (m)', fr: 'Longueur filet (m)', pt: 'Comprimento da rede (m)', ar: 'طول الشبكة (م)' },
      ], { required: true }),
      decimalField('effort_value', { en: 'Effort Value', fr: 'Valeur de l\'Effort', pt: 'Valor do Esforço', ar: 'قيمة الجهد' }, { required: true }),
      textField('effort_unit', { en: 'Unit of Measure', fr: 'Unité de Mesure', pt: 'Unidade de Medida', ar: 'وحدة القياس' }, { required: true }),
      selectField('gear_type', { en: 'Gear Type', fr: 'Type d\'Engin', pt: 'Tipo de Arte', ar: 'نوع المعدات' }, [
        { en: 'Trawl', fr: 'Chalut', pt: 'Arrasto', ar: 'شبكة الجر' },
        { en: 'Gillnet', fr: 'Filet maillant', pt: 'Rede de emalhar', ar: 'شبكة خيشومية' },
        { en: 'Longline', fr: 'Palangre', pt: 'Palangre', ar: 'الخيط الطويل' },
        { en: 'Purse Seine', fr: 'Senne coulissante', pt: 'Cerco', ar: 'شبكة الإحاطة' },
        { en: 'Hook and Line', fr: 'Hameçon et ligne', pt: 'Anzol e linha', ar: 'خطاف وخيط' },
        { en: 'Cast Net', fr: 'Épervier', pt: 'Tarrafa', ar: 'شبكة الرمي' },
        { en: 'Trap', fr: 'Nasse/Piège', pt: 'Armadilha', ar: 'مصيدة' },
      ], { required: true }),
      numberField('crew_size', { en: 'Crew Size', fr: 'Taille de l\'Équipage', pt: 'Tamanho da Tripulação', ar: 'حجم الطاقم' }),
      textField('vessel_name', { en: 'Vessel Name', fr: 'Nom du Navire', pt: 'Nome da Embarcação', ar: 'اسم السفينة' }),
      textField('fao_area_code', { en: 'FAO Area Code', fr: 'Code Zone FAO', pt: 'Código Área FAO', ar: 'رمز منطقة FAO' }),
      dateField('start_date', { en: 'Start Date', fr: 'Date de Début', pt: 'Data de Início', ar: 'تاريخ البدء' }, { required: true }),
      dateField('end_date', { en: 'End Date', fr: 'Date de Fin', pt: 'Data de Fim', ar: 'تاريخ الانتهاء' }),
      textareaField('remarks', { en: 'Remarks', fr: 'Remarques', pt: 'Observações', ar: 'ملاحظات' }, { columnSpan: 2 }),
    ],
    { icon: 'Activity', color: '#7C3AED' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionEffort, makeGPSSection(2)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 25. Aquaculture Farm Registration
function buildAquacultureFarmRegistration() {
  fieldOrder = 0;
  const sectionFarm = makeSection(
    { en: 'Farm Information', fr: 'Informations de la Ferme', pt: 'Informações da Fazenda', ar: 'معلومات المزرعة' }, 1,
    [
      textField('farm_name', { en: 'Farm Name', fr: 'Nom de la Ferme', pt: 'Nome da Fazenda', ar: 'اسم المزرعة' }, { required: true }),
      selectField('farm_type', { en: 'Farm Type', fr: 'Type de Ferme', pt: 'Tipo de Fazenda', ar: 'نوع المزرعة' }, [
        { en: 'Pond', fr: 'Étang', pt: 'Tanque', ar: 'بركة' },
        { en: 'Cage', fr: 'Cage', pt: 'Gaiola', ar: 'قفص' },
        { en: 'Raceway', fr: 'Canal de course', pt: 'Canal', ar: 'مجرى' },
        { en: 'Tank/RAS', fr: 'Bassin/RAS', pt: 'Tanque/RAS', ar: 'خزان/نظام إعادة التدوير' },
        { en: 'Pen', fr: 'Enclos', pt: 'Cercado', ar: 'حظيرة' },
        { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' },
      ], { required: true }),
      selectField('water_source', { en: 'Water Source', fr: 'Source d\'Eau', pt: 'Fonte de Água', ar: 'مصدر المياه' }, [
        { en: 'Freshwater', fr: 'Eau douce', pt: 'Água doce', ar: 'مياه عذبة' },
        { en: 'Marine', fr: 'Marin', pt: 'Marinho', ar: 'بحري' },
        { en: 'Brackish', fr: 'Saumâtre', pt: 'Salobra', ar: 'مياه معتدلة الملوحة' },
      ], { required: true }),
      decimalField('area_hectares', { en: 'Area (hectares)', fr: 'Superficie (hectares)', pt: 'Área (hectares)', ar: 'المساحة (هكتارات)' }),
      decimalField('production_capacity_tonnes', { en: 'Production Capacity (tonnes/year)', fr: 'Capacité de Production (tonnes/an)', pt: 'Capacidade de Produção (toneladas/ano)', ar: 'القدرة الإنتاجية (طن/سنة)' }),
      speciesSelect('main_species', { en: 'Main Species Cultured', fr: 'Espèces Principales', pt: 'Espécies Principais', ar: 'الأنواع الرئيسية المستزرعة' }, { required: true }),
      textField('owner_name', { en: 'Owner / Operator', fr: 'Propriétaire / Exploitant', pt: 'Proprietário / Operador', ar: 'المالك / المشغل' }),
      textField('registration_number', { en: 'Registration Number', fr: 'Numéro d\'Enregistrement', pt: 'Número de Registro', ar: 'رقم التسجيل' }),
      numberField('total_workers', { en: 'Total Workers', fr: 'Total Travailleurs', pt: 'Total de Trabalhadores', ar: 'إجمالي العمال' }),
      numberField('male_workers', { en: 'Male Workers', fr: 'Hommes', pt: 'Trabalhadores Homens', ar: 'عمال ذكور' }),
      numberField('female_workers', { en: 'Female Workers', fr: 'Femmes', pt: 'Trabalhadoras Mulheres', ar: 'عمال إناث' }),
      numberField('pond_count', { en: 'Number of Ponds/Cages', fr: 'Nombre d\'Étangs/Cages', pt: 'Número de Tanques/Gaiolas', ar: 'عدد البرك/الأقفاص' }),
      yesNoField('is_active', { en: 'Currently Active?', fr: 'Actuellement Actif ?', pt: 'Atualmente Ativo?', ar: 'نشط حاليا؟' }),
      textareaField('remarks', { en: 'Remarks', fr: 'Remarques', pt: 'Observações', ar: 'ملاحظات' }, { columnSpan: 2 }),
    ],
    { icon: 'Waves', color: '#059669' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionFarm, makeGPSSection(2)],
    settings: makeSettings({ requireGeoLocation: true }),
  };
}

// 26. Aquaculture Production Report
function buildAquacultureProductionReport() {
  fieldOrder = 0;
  const sectionProd = makeSection(
    { en: 'Production Details', fr: 'Détails de Production', pt: 'Detalhes de Produção', ar: 'تفاصيل الإنتاج' }, 1,
    [
      textField('farm_name', { en: 'Farm Name / ID', fr: 'Nom / ID de la Ferme', pt: 'Nome / ID da Fazenda', ar: 'اسم / رقم المزرعة' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }, { required: true }),
      decimalField('quantity_kg', { en: 'Quantity Harvested (kg)', fr: 'Quantité Récoltée (kg)', pt: 'Quantidade Colhida (kg)', ar: 'الكمية المحصودة (كجم)' }, { required: true }),
      dateField('harvest_date', { en: 'Harvest Date', fr: 'Date de Récolte', pt: 'Data da Colheita', ar: 'تاريخ الحصاد' }, { required: true }),
      selectField('method_of_culture', { en: 'Method of Culture', fr: 'Méthode de Culture', pt: 'Método de Cultura', ar: 'طريقة الاستزراع' }, [
        { en: 'Extensive', fr: 'Extensif', pt: 'Extensivo', ar: 'مفتوح' },
        { en: 'Semi-intensive', fr: 'Semi-intensif', pt: 'Semi-intensivo', ar: 'شبه مكثف' },
        { en: 'Intensive', fr: 'Intensif', pt: 'Intensivo', ar: 'مكثف' },
        { en: 'Super-intensive', fr: 'Super-intensif', pt: 'Super-intensivo', ar: 'مكثف جداً' },
      ]),
      decimalField('feed_used_kg', { en: 'Feed Used (kg)', fr: 'Aliment Utilisé (kg)', pt: 'Ração Utilizada (kg)', ar: 'العلف المستخدم (كجم)' }),
      decimalField('fcr', { en: 'Feed Conversion Ratio (FCR)', fr: 'Ratio de Conversion Alimentaire', pt: 'Taxa de Conversão Alimentar', ar: 'معدل التحويل الغذائي' }, {
        helpText: { en: 'Feed (kg) / Weight gain (kg)', fr: 'Aliment (kg) / Gain de poids (kg)', pt: 'Ração (kg) / Ganho de peso (kg)', ar: 'العلف (كجم) / زيادة الوزن (كجم)' },
      }),
      textField('batch_id', { en: 'Batch / Cycle ID', fr: 'ID du Lot / Cycle', pt: 'ID do Lote / Ciclo', ar: 'رقم الدُفعة / الدورة' }),
      dateField('stocking_date', { en: 'Stocking Date', fr: 'Date d\'Ensemencement', pt: 'Data de Estocagem', ar: 'تاريخ التخزين' }),
      decimalField('survival_rate', { en: 'Survival Rate (%)', fr: 'Taux de Survie (%)', pt: 'Taxa de Sobrevivência (%)', ar: 'معدل البقاء (%)' }),
      decimalField('avg_harvest_weight_g', { en: 'Avg. Harvest Weight (g)', fr: 'Poids Moyen de Récolte (g)', pt: 'Peso Médio de Colheita (g)', ar: 'متوسط وزن الحصاد (جم)' }),
      textareaField('remarks', { en: 'Remarks', fr: 'Remarques', pt: 'Observações', ar: 'ملاحظات' }, { columnSpan: 2 }),
    ],
    { icon: 'BarChart3', color: '#10B981' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionProd],
    settings: makeSettings(),
  };
}

// 27. Fish Trade Report
function buildFishTradeReport() {
  fieldOrder = 0;
  const sectionTrade = makeSection(
    { en: 'Trade Flow Details', fr: 'Détails du Flux Commercial', pt: 'Detalhes do Fluxo Comercial', ar: 'تفاصيل التدفق التجاري' }, 1,
    [
      selectField('flow_direction', { en: 'Flow Direction', fr: 'Direction du Flux', pt: 'Direção do Fluxo', ar: 'اتجاه التدفق' }, [
        { en: 'Export', fr: 'Export', pt: 'Exportação', ar: 'تصدير' },
        { en: 'Import', fr: 'Import', pt: 'Importação', ar: 'استيراد' },
        { en: 'Re-export', fr: 'Réexportation', pt: 'Reexportação', ar: 'إعادة تصدير' },
      ], { required: true }),
      textField('export_country', { en: 'Exporting Country', fr: 'Pays Exportateur', pt: 'País Exportador', ar: 'بلد التصدير' }, { required: true }),
      textField('import_country', { en: 'Importing Country', fr: 'Pays Importateur', pt: 'País Importador', ar: 'بلد الاستيراد' }, { required: true }),
      speciesSelect('species', { en: 'Species', fr: 'Espèce', pt: 'Espécie', ar: 'النوع' }),
      textField('commodity', { en: 'Commodity Description', fr: 'Description du Produit', pt: 'Descrição do Produto', ar: 'وصف السلعة' }, { required: true }),
      selectField('commodity_group', { en: 'Commodity Group', fr: 'Groupe de Produit', pt: 'Grupo de Produto', ar: 'مجموعة السلع' }, [
        { en: 'Fish (fresh/chilled)', fr: 'Poisson (frais/réfrigéré)', pt: 'Peixe (fresco/refrigerado)', ar: 'سمك (طازج/مبرد)' },
        { en: 'Fish (frozen)', fr: 'Poisson (congelé)', pt: 'Peixe (congelado)', ar: 'سمك (مجمد)' },
        { en: 'Fish (dried/salted/smoked)', fr: 'Poisson (séché/salé/fumé)', pt: 'Peixe (seco/salgado/fumado)', ar: 'سمك (مجفف/مملح/مدخن)' },
        { en: 'Crustaceans', fr: 'Crustacés', pt: 'Crustáceos', ar: 'قشريات' },
        { en: 'Molluscs', fr: 'Mollusques', pt: 'Moluscos', ar: 'رخويات' },
        { en: 'Fish Meal / Oil', fr: 'Farine / Huile de poisson', pt: 'Farinha / Óleo de peixe', ar: 'وجبة / زيت السمك' },
        { en: 'Live Fish', fr: 'Poisson vivant', pt: 'Peixe vivo', ar: 'سمك حي' },
      ]),
      selectField('product_state', { en: 'Product State', fr: 'État du Produit', pt: 'Estado do Produto', ar: 'حالة المنتج' }, [
        { en: 'Fresh', fr: 'Frais', pt: 'Fresco', ar: 'طازج' },
        { en: 'Frozen', fr: 'Congelé', pt: 'Congelado', ar: 'مجمد' },
        { en: 'Dried', fr: 'Séché', pt: 'Seco', ar: 'مجفف' },
        { en: 'Salted', fr: 'Salé', pt: 'Salgado', ar: 'مملح' },
        { en: 'Smoked', fr: 'Fumé', pt: 'Fumado', ar: 'مدخن' },
        { en: 'Canned', fr: 'En conserve', pt: 'Enlatado', ar: 'معلب' },
        { en: 'Live', fr: 'Vivant', pt: 'Vivo', ar: 'حي' },
      ]),
      decimalField('quantity', { en: 'Quantity (tonnes)', fr: 'Quantité (tonnes)', pt: 'Quantidade (toneladas)', ar: 'الكمية (أطنان)' }, { required: true }),
      textField('unit', { en: 'Unit', fr: 'Unité', pt: 'Unidade', ar: 'الوحدة' }),
      decimalField('value_fob_usd', { en: 'Value FOB (USD)', fr: 'Valeur FOB (USD)', pt: 'Valor FOB (USD)', ar: 'القيمة FOB (دولار)' }),
      textField('hs_code', { en: 'HS Code', fr: 'Code SH', pt: 'Código SH', ar: 'رمز النظام المنسق' }, {
        helpText: { en: 'Harmonized System code (6-10 digits)', fr: 'Code du Système Harmonisé (6-10 chiffres)', pt: 'Código do Sistema Harmonizado (6-10 dígitos)', ar: 'رمز النظام المنسق (6-10 أرقام)' },
      }),
      dateField('period_start', { en: 'Period Start', fr: 'Début de Période', pt: 'Início do Período', ar: 'بداية الفترة' }, { required: true }),
      dateField('period_end', { en: 'Period End', fr: 'Fin de Période', pt: 'Fim do Período', ar: 'نهاية الفترة' }),
      textareaField('remarks', { en: 'Remarks', fr: 'Remarques', pt: 'Observações', ar: 'ملاحظات' }, { columnSpan: 2 }),
    ],
    { icon: 'TrendingUp', color: '#F59E0B' },
  );

  return {
    sections: [makeLocalisationSection(0), sectionTrade],
    settings: makeSettings(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Seed Function
// ═══════════════════════════════════════════════════════════════════════

async function seed(): Promise<void> {
  console.log('Seeding form-builder with 28 official ARIS templates...\n');

  const auTenant = await prisma.tenant.findFirst({ where: { code: 'AU' } });
  if (!auTenant) {
    console.warn('AU-IBAR tenant not found. Run tenant seed first. Using placeholder UUID.');
  }
  const tenantId = auTenant?.id ?? '00000000-0000-0000-0000-000000000001';

  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const createdBy = adminUser?.id ?? '00000000-0000-0000-0000-000000000001';

  // ── Purge ALL existing templates so only the 22 official ones remain ──
  try {
    const allTemplates = await (prisma as any).formTemplate.findMany({ select: { id: true } });
    if (allTemplates.length > 0) {
      const ids = allTemplates.map((t: { id: string }) => t.id);
      await (prisma as any).formSubmission.deleteMany({ where: { template_id: { in: ids } } });
      await (prisma as any).formOverlay.deleteMany({ where: { template_id: { in: ids } } });
      await (prisma as any).formVersionHistory.deleteMany({ where: { template_id: { in: ids } } });
      await (prisma as any).formTemplate.deleteMany({});
      console.log(`  Purged ${allTemplates.length} old template(s).\n`);
    }
  } catch {
    // Tables may not exist yet
  }

  const templates: Array<{
    name: string;
    domain: string;
    schema: { sections: unknown[]; settings: Record<string, unknown> };
    classification: string;
    kafkaTopic: string;
  }> = [
    // ── Animal Health (6 forms) ──
    { name: 'AU-IBAR Monthly Animal Health Report', domain: 'animal_health', schema: buildMonthlyHealthReport(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.monthly.v1' },
    { name: 'Emergency Disease Reporting', domain: 'animal_health', schema: buildEmergencyDiseaseReport(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.emergency.v1' },
    { name: 'Mass Vaccination', domain: 'animal_health', schema: buildMassVaccination(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.vaccination_mass.v1' },
    { name: 'Meat Inspection', domain: 'animal_health', schema: buildMeatInspection(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.meat_inspection.v1' },
    { name: 'Monthly Abattoir Report', domain: 'animal_health', schema: buildMonthlyAbattoirReport(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.abattoir_monthly.v1' },
    { name: 'Monthly Vaccination Report', domain: 'animal_health', schema: buildMonthlyVaccinationReport(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.vaccination_monthly.v1' },
    { name: 'Aquatic Animal Health Event Report', domain: 'animal_health', schema: buildAquaticAnimalHealthReport(), classification: 'RESTRICTED', kafkaTopic: 'collecte.health.aquatic.v1' },

    // ── Livestock Production (7 forms) ──
    { name: 'Animal Breeding and Genomics', domain: 'livestock', schema: buildAnimalBreeding(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.breeding.v1' },
    { name: 'Animal Population (Genetic Diversity)', domain: 'livestock', schema: buildAnimalPopulationGenetic(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.population_genetic.v1' },
    { name: 'Animal Population and Composition', domain: 'livestock', schema: buildAnimalPopulationComposition(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.population.v1' },
    { name: 'Breeder Association', domain: 'livestock', schema: buildBreederAssociation(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.breeder.v1' },
    { name: 'Disaster and Risk Management', domain: 'livestock', schema: buildDisasterRiskManagement(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.disaster.v1' },
    { name: 'Legislation', domain: 'livestock', schema: buildLegislation(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.legislation.v1' },
    { name: 'National Animal Genetic Resources Centre', domain: 'livestock', schema: buildGeneticResourcesCentre(), classification: 'RESTRICTED', kafkaTopic: 'collecte.livestock.genetic_centre.v1' },

    // ── Trade and Marketing (8 forms) ──
    { name: 'Cost of Production', domain: 'trade_sps', schema: buildCostOfProduction(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.cost_production.v1' },
    { name: 'Import and Export', domain: 'trade_sps', schema: buildImportExport(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.import_export.v1' },
    { name: 'Market Demand', domain: 'trade_sps', schema: buildMarketDemand(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.market_demand.v1' },
    { name: 'Market Price', domain: 'trade_sps', schema: buildMarketPrice(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.market_price.v1' },
    { name: 'Market Requirement and Location', domain: 'trade_sps', schema: buildMarketRequirementLocation(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.market_location.v1' },
    { name: 'Quality Standards (Inputs & Services)', domain: 'trade_sps', schema: buildQualityStandardsInputs(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.quality_inputs.v1' },
    { name: 'Quality Standards (Poultry/Hatchery)', domain: 'trade_sps', schema: buildQualityStandardsPoultry(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.quality_poultry.v1' },
    { name: 'Volume and Availability of Transport', domain: 'trade_sps', schema: buildTransport(), classification: 'PARTNER', kafkaTopic: 'collecte.trade.transport.v1' },

    // ── Fisheries & Aquaculture (6 forms) ──
    { name: 'Capture Fisheries Report', domain: 'fisheries', schema: buildCaptureReport(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.capture.v1' },
    { name: 'Fishing Vessel Registration', domain: 'fisheries', schema: buildVesselRegistration(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.vessel.v1' },
    { name: 'Fishing Effort Report', domain: 'fisheries', schema: buildFishingEffortReport(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.effort.v1' },
    { name: 'Aquaculture Farm Registration', domain: 'fisheries', schema: buildAquacultureFarmRegistration(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.farm.v1' },
    { name: 'Aquaculture Production Report', domain: 'fisheries', schema: buildAquacultureProductionReport(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.production.v1' },
    { name: 'Fish Trade Report', domain: 'fisheries', schema: buildFishTradeReport(), classification: 'PARTNER', kafkaTopic: 'collecte.fisheries.trade.v1' },
  ];

  let success = 0;
  let failed = 0;

  for (const t of templates) {
    try {
      await (prisma as any).formTemplate.upsert({
        where: {
          tenant_id_name_version: {
            tenant_id: tenantId,
            name: t.name,
            version: 1,
          },
        },
        update: {
          schema: t.schema as any,
          domain: t.domain,
          data_classification: t.classification,
        },
        create: {
          tenant_id: tenantId,
          name: t.name,
          domain: t.domain,
          version: 1,
          schema: t.schema as any,
          ui_schema: { kafkaTopic: t.kafkaTopic },
          status: 'PUBLISHED',
          data_classification: t.classification,
          created_by: createdBy,
          published_at: new Date(),
        },
      });
      console.log(`  ✓ ${t.name} (${t.domain})`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${t.name}:`, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  console.log(`\nForm-builder seed completed: ${success} succeeded, ${failed} failed.`);
}

seed()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Form-builder seed failed:', error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
