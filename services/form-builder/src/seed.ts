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
  return selectField(code, label, [
    { en: 'Young', fr: 'Jeune', pt: 'Jovem', ar: 'صغير' },
    { en: 'Sub-adult', fr: 'Sub-adulte', pt: 'Subadulto', ar: 'شبه بالغ' },
    { en: 'Adult', fr: 'Adulte', pt: 'Adulto', ar: 'بالغ' },
  ], opts);
}

function sexSelect(code: string, label: I18n, opts: { required?: boolean } = {}) {
  return selectField(code, label, [
    { en: 'Male', fr: 'Mâle', pt: 'Macho', ar: 'ذكر' },
    { en: 'Female', fr: 'Femelle', pt: 'Fêmea', ar: 'أنثى' },
  ], opts);
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
      textField('source_infection', { en: 'Source of Infection', fr: 'Source d\'Infection', pt: 'Fonte de Infecção', ar: 'مصدر العدوى' }),
      textField('outbreak_status', { en: 'Outbreak Status', fr: 'Statut du Foyer', pt: 'Estado do Surto', ar: 'حالة البؤرة' }, { helpText: { en: 'Indicate whether the outbreak is controlled or is still continuing as at the time of writing this report.', fr: 'Indiquez si le foyer est maîtrisé ou s\'il se poursuit au moment de la rédaction de ce rapport.', pt: 'Indique se o surto está controlado ou ainda continua no momento da redação deste relatório.', ar: 'حدد ما إذا كانت البؤرة مسيطراً عليها أو لا تزال مستمرة وقت كتابة هذا التقرير.' } }),
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
        { type: 'select', code: 'age_group', label: { en: 'Age Group', fr: 'Groupe d\'Âge', pt: 'Grupo Etário', ar: 'الفئة العمرية' }, properties: { options: [{ label: { en: 'Young', fr: 'Jeune', pt: 'Jovem', ar: 'صغير' }, value: 'young' }, { label: { en: 'Sub-adult', fr: 'Sub-adulte', pt: 'Subadulto', ar: 'شبه بالغ' }, value: 'sub_adult' }, { label: { en: 'Adult', fr: 'Adulte', pt: 'Adulto', ar: 'بالغ' }, value: 'adult' }] } },
        { type: 'select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { options: [{ label: { en: 'Male', fr: 'Mâle', pt: 'Macho', ar: 'ذكر' }, value: 'male' }, { label: { en: 'Female', fr: 'Femelle', pt: 'Fêmea', ar: 'أنثى' }, value: 'female' }] } },
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
    [textField('basis_diagnosis', { en: 'Bases of Diagnosis', fr: 'Bases du Diagnostic', pt: 'Bases do Diagnóstico', ar: 'أسس التشخيص' }, { required: true })],
    { icon: 'Stethoscope', color: '#8B5CF6', columns: 1 },
  );

  // Section D: Disease Control Measures (repeater par mesure)
  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Disease Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle de Doenças', ar: 'إجراءات مكافحة الأمراض' }, 4,
    [
      makeRepeater('control_measures', { en: 'Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle', ar: 'إجراءات المكافحة' }, [
        { type: 'select', code: 'measure', label: { en: 'Disease Control Measure', fr: 'Mesure de Contrôle', pt: 'Medida de Controle de Doença', ar: 'إجراء مكافحة المرض' }, required: true, properties: { options: [
          { label: { en: 'Quarantine', fr: 'Quarantaine', pt: 'Quarentena', ar: 'الحجر الصحي' }, value: 'quarantine' },
          { label: { en: 'Movement Restriction', fr: 'Restriction de Mouvement', pt: 'Restrição de Movimento', ar: 'تقييد الحركة' }, value: 'movement_restriction' },
          { label: { en: 'Ring Vaccination', fr: 'Vaccination en Anneau', pt: 'Vacinação em Anel', ar: 'التطعيم الحلقي' }, value: 'ring_vaccination' },
          { label: { en: 'Stamping Out', fr: 'Abattage Sanitaire', pt: 'Abate Sanitário', ar: 'الإعدام الصحي' }, value: 'stamping_out' },
          { label: { en: 'Disinfection', fr: 'Désinfection', pt: 'Desinfecção', ar: 'التطهير' }, value: 'disinfection' },
          { label: { en: 'Treatment', fr: 'Traitement', pt: 'Tratamento', ar: 'العلاج' }, value: 'treatment' },
          { label: { en: 'Surveillance Zone', fr: 'Zone de Surveillance', pt: 'Zona de Vigilância', ar: 'منطقة المراقبة' }, value: 'surveillance_zone' },
          { label: { en: 'Vector Control', fr: 'Lutte Anti-vectorielle', pt: 'Controle de Vetores', ar: 'مكافحة النواقل' }, value: 'vector_control' },
        ] } },
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
        { type: 'text', code: 'epi_unit_type', label: { en: 'Epidemiological Unit Type', fr: 'Type d\'Unité Épidémiologique', pt: 'Tipo de Unidade Epidemiológica', ar: 'نوع الوحدة الوبائية' } },
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
      selectField('reason_notification', { en: 'Reason for Notification', fr: 'Raison de la Notification', pt: 'Razão da Notificação', ar: 'سبب الإخطار' },
        [{ en: 'First occurrence', fr: 'Première occurrence', pt: 'Primeira ocorrência', ar: 'أول ظهور' }, { en: 'Re-occurrence', fr: 'Réapparition', pt: 'Reocorrência', ar: 'ظهور مجدد' }, { en: 'Spread to new area', fr: 'Propagation à une nouvelle zone', pt: 'Propagação para nova área', ar: 'انتشار لمنطقة جديدة' }, { en: 'Increased virulence', fr: 'Virulence accrue', pt: 'Virulência aumentada', ar: 'زيادة الفوعة' }, { en: 'Change in epidemiology', fr: 'Changement épidémiologique', pt: 'Mudança na epidemiologia', ar: 'تغير في الوبائيات' }],
        { required: true, helpText: { en: 'Select the reason for making this notification.', fr: 'Sélectionnez la raison de cette notification.', pt: 'Selecione a razão desta notificação.', ar: 'اختر سبب هذا الإخطار.' } }),
      selectField('animal_type', { en: 'Animal Type', fr: 'Type d\'Animal', pt: 'Tipo de Animal', ar: 'نوع الحيوان' },
        [{ en: 'Domestic', fr: 'Domestique', pt: 'Doméstico', ar: 'محلي' }, { en: 'Wild', fr: 'Sauvage', pt: 'Selvagem', ar: 'بري' }, { en: 'Feral', fr: 'Féral', pt: 'Feral', ar: 'وحشي' }, { en: 'Captive Wildlife', fr: 'Faune Captive', pt: 'Fauna Cativa', ar: 'حياة برية أسيرة' }],
        { required: true, helpText: { en: 'List of animal types depending on their habitat.', fr: 'Liste des types d\'animaux selon leur habitat.', pt: 'Lista de tipos de animais conforme seu habitat.', ar: 'قائمة أنواع الحيوانات حسب موطنها.' } }),
      textField('animal_husbandry', { en: 'Animal Husbandry', fr: 'Élevage Animal', pt: 'Pecuária', ar: 'تربية الحيوانات' }, { required: true }),
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
        { type: 'select', code: 'age_group', label: { en: 'Age Group', fr: 'Groupe d\'Âge', pt: 'Grupo Etário', ar: 'الفئة العمرية' }, properties: { options: [{ label: { en: 'Young', fr: 'Jeune', pt: 'Jovem', ar: 'صغير' }, value: 'young' }, { label: { en: 'Sub-adult', fr: 'Sub-adulte', pt: 'Subadulto', ar: 'شبه بالغ' }, value: 'sub_adult' }, { label: { en: 'Adult', fr: 'Adulte', pt: 'Adulto', ar: 'بالغ' }, value: 'adult' }] } },
        { type: 'select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { options: [{ label: { en: 'Male', fr: 'Mâle', pt: 'Macho', ar: 'ذكر' }, value: 'male' }, { label: { en: 'Female', fr: 'Femelle', pt: 'Fêmea', ar: 'أنثى' }, value: 'female' }] } },
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
    [textField('basis_diagnosis', { en: 'Basis of Diagnosis', fr: 'Base du Diagnostic', pt: 'Base do Diagnóstico', ar: 'أساس التشخيص' })],
    { icon: 'Stethoscope', color: '#8B5CF6', columns: 1 },
  );

  fieldOrder = 0;
  const sectionD = makeSection(
    { en: 'Disease Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle de Doenças', ar: 'إجراءات مكافحة الأمراض' }, 4,
    [
      makeRepeater('control_measures', { en: 'Control Measures', fr: 'Mesures de Contrôle', pt: 'Medidas de Controle', ar: 'إجراءات المكافحة' }, [
        { type: 'select', code: 'measure', label: { en: 'Disease Control Measure', fr: 'Mesure de Contrôle', pt: 'Medida de Controle de Doença', ar: 'إجراء مكافحة المرض' }, required: true, properties: { options: [
          { label: { en: 'Quarantine', fr: 'Quarantaine', pt: 'Quarentena', ar: 'الحجر الصحي' }, value: 'quarantine' },
          { label: { en: 'Movement Restriction', fr: 'Restriction de Mouvement', pt: 'Restrição de Movimento', ar: 'تقييد الحركة' }, value: 'movement_restriction' },
          { label: { en: 'Ring Vaccination', fr: 'Vaccination en Anneau', pt: 'Vacinação em Anel', ar: 'التطعيم الحلقي' }, value: 'ring_vaccination' },
          { label: { en: 'Stamping Out', fr: 'Abattage Sanitaire', pt: 'Abate Sanitário', ar: 'الإعدام الصحي' }, value: 'stamping_out' },
          { label: { en: 'Disinfection', fr: 'Désinfection', pt: 'Desinfecção', ar: 'التطهير' }, value: 'disinfection' },
          { label: { en: 'Treatment', fr: 'Traitement', pt: 'Tratamento', ar: 'العلاج' }, value: 'treatment' },
        ] } },
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
        { type: 'text', code: 'epi_unit_type', label: { en: 'Epidemiological Unit Type', fr: 'Type d\'Unité Épidémiologique', pt: 'Tipo de Unidade Epidemiológica', ar: 'نوع الوحدة الوبائية' } },
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
      textField('means_transportation', { en: 'Means of Transportation', fr: 'Moyen de Transport', pt: 'Meio de Transporte', ar: 'وسيلة النقل' }, { helpText: { en: 'Means of transporting the animal(s) to the abattoir.', fr: 'Moyen de transport des animaux vers l\'abattoir.', pt: 'Meio de transporte dos animais ao matadouro.', ar: 'وسيلة نقل الحيوان(ات) إلى المسلخ.' } }),
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
        { type: 'text', code: 'animal_species', label: { en: 'Animal Species', fr: 'Espèce Animale', pt: 'Espécie Animal', ar: 'النوع الحيواني' }, required: true },
        { type: 'select', code: 'age', label: { en: 'Age', fr: 'Âge', pt: 'Idade', ar: 'العمر' }, properties: { options: [{ label: { en: 'Young', fr: 'Jeune', pt: 'Jovem', ar: 'صغير' }, value: 'young' }, { label: { en: 'Sub-adult', fr: 'Sub-adulte', pt: 'Subadulto', ar: 'شبه بالغ' }, value: 'sub_adult' }, { label: { en: 'Adult', fr: 'Adulte', pt: 'Adulto', ar: 'بالغ' }, value: 'adult' }] } },
        { type: 'select', code: 'sex', label: { en: 'Sex', fr: 'Sexe', pt: 'Sexo', ar: 'الجنس' }, properties: { options: [{ label: { en: 'Male', fr: 'Mâle', pt: 'Macho', ar: 'ذكر' }, value: 'male' }, { label: { en: 'Female', fr: 'Femelle', pt: 'Fêmea', ar: 'أنثى' }, value: 'female' }] } },
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
      textField('specimen_type', { en: 'Type of Laboratory Specimen', fr: 'Type de Spécimen de Laboratoire', pt: 'Tipo de Espécime de Laboratório', ar: 'نوع عينة المختبر' }, { helpText: { en: 'This is the type of laboratory specimen or sample which has been sent to the Lab.', fr: 'Il s\'agit du type de spécimen ou d\'échantillon de laboratoire envoyé au laboratoire.', pt: 'Este é o tipo de espécime ou amostra de laboratório enviada ao laboratório.', ar: 'هذا هو نوع عينة المختبر التي تم إرسالها إلى المختبر.' } }),
      numberField('num_specimens', { en: 'Number of Laboratory Specimens', fr: 'Nombre de Spécimens', pt: 'Número de Espécimes', ar: 'عدد العينات' }),
      dateField('date_samples_collected', { en: 'Date Samples Collected', fr: 'Date de Collecte', pt: 'Data da Coleta de Amostras', ar: 'تاريخ جمع العينات' }),
      dateField('date_samples_sent', { en: 'Date Samples Sent to Laboratory', fr: 'Date d\'Envoi au Laboratoire', pt: 'Data de Envio ao Laboratório', ar: 'تاريخ إرسال العينات للمختبر' }, { helpText: { en: 'This is the date when the samples were sent to the Primary or Reference Laboratory.', fr: 'Il s\'agit de la date d\'envoi des échantillons au laboratoire primaire ou de référence.', pt: 'Esta é a data em que as amostras foram enviadas ao laboratório primário ou de referência.', ar: 'هذا هو التاريخ الذي أُرسلت فيه العينات إلى المختبر الأساسي أو المرجعي.' } }),
      textField('lab_name', { en: 'Name of Laboratory', fr: 'Nom du Laboratoire', pt: 'Nome do Laboratório', ar: 'اسم المختبر' }, { required: true }),
      textField('ref_lab_name', { en: 'Name of Reference Laboratory', fr: 'Nom du Laboratoire de Référence', pt: 'Nome do Laboratório de Referência', ar: 'اسم المختبر المرجعي' }),
      selectField('lab_test', { en: 'Laboratory Test', fr: 'Test de Laboratoire', pt: 'Teste de Laboratório', ar: 'اختبار المختبر' },
        [{ en: 'PCR', fr: 'PCR', pt: 'PCR', ar: 'PCR' }, { en: 'ELISA', fr: 'ELISA', pt: 'ELISA', ar: 'ELISA' }, { en: 'Culture', fr: 'Culture', pt: 'Cultura', ar: 'زراعة' }, { en: 'Serology', fr: 'Sérologie', pt: 'Sorologia', ar: 'علم المصل' }, { en: 'Histopathology', fr: 'Histopathologie', pt: 'Histopatologia', ar: 'علم الأنسجة المرضية' }, { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' }]),
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
        { type: 'select', code: 'body_part', label: { en: 'Body Part', fr: 'Organe', pt: 'Parte do Corpo', ar: 'العضو' }, properties: { options: [
          { label: { en: 'Head', fr: 'Tête', pt: 'Cabeça', ar: 'الرأس' }, value: 'head' },
          { label: { en: 'Liver', fr: 'Foie', pt: 'Fígado', ar: 'الكبد' }, value: 'liver' },
          { label: { en: 'Lungs', fr: 'Poumons', pt: 'Pulmões', ar: 'الرئتان' }, value: 'lungs' },
          { label: { en: 'Heart', fr: 'Cœur', pt: 'Coração', ar: 'القلب' }, value: 'heart' },
          { label: { en: 'Kidneys', fr: 'Reins', pt: 'Rins', ar: 'الكلى' }, value: 'kidneys' },
          { label: { en: 'Spleen', fr: 'Rate', pt: 'Baço', ar: 'الطحال' }, value: 'spleen' },
          { label: { en: 'Intestines', fr: 'Intestins', pt: 'Intestinos', ar: 'الأمعاء' }, value: 'intestines' },
          { label: { en: 'Carcass', fr: 'Carcasse', pt: 'Carcaça', ar: 'الذبيحة' }, value: 'carcass' },
          { label: { en: 'Skin', fr: 'Peau', pt: 'Pele', ar: 'الجلد' }, value: 'skin' },
          { label: { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' }, value: 'other' },
        ] } },
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
      selectField('means_transport', { en: 'Means of Transport', fr: 'Moyen de Transport', pt: 'Meio de Transporte', ar: 'وسيلة النقل' },
        [{ en: 'Road', fr: 'Route', pt: 'Rodoviário', ar: 'بري' }, { en: 'Rail', fr: 'Rail', pt: 'Ferroviário', ar: 'سكة حديد' }, { en: 'Sea', fr: 'Maritime', pt: 'Marítimo', ar: 'بحري' }, { en: 'Air', fr: 'Aérien', pt: 'Aéreo', ar: 'جوي' }], { helpText: { en: 'Select type of transport used.', fr: 'Sélectionnez le type de transport utilisé.', pt: 'Selecione o tipo de transporte utilizado.', ar: 'اختر نوع النقل المستخدم.' } }),
      textField('animal_product_type', { en: 'Type of Animal or Product', fr: 'Type d\'Animal ou Produit', pt: 'Tipo de Animal ou Produto', ar: 'نوع الحيوان أو المنتج' }, { required: true }),
      textField('animal_species', { en: 'Animal Species', fr: 'Espèce Animale', pt: 'Espécie Animal', ar: 'النوع الحيواني' }),
      selectField('product_name', { en: 'Name of Animal Product', fr: 'Nom du Produit Animal', pt: 'Nome do Produto Animal', ar: 'اسم المنتج الحيواني' },
        [{ en: 'Meat', fr: 'Viande', pt: 'Carne', ar: 'لحم' }, { en: 'Dairy', fr: 'Produits Laitiers', pt: 'Laticínios', ar: 'ألبان' }, { en: 'Eggs', fr: 'Œufs', pt: 'Ovos', ar: 'بيض' }, { en: 'Hides/Skins', fr: 'Cuirs/Peaux', pt: 'Couros/Peles', ar: 'جلود' }, { en: 'Wool', fr: 'Laine', pt: 'Lã', ar: 'صوف' }, { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' }],
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
      selectField('product_type', { en: 'Type of Product', fr: 'Type de Produit', pt: 'Tipo de Produto', ar: 'نوع المنتج' },
        [{ en: 'Beef', fr: 'Bœuf', pt: 'Carne Bovina', ar: 'لحم بقري' }, { en: 'Mutton', fr: 'Mouton', pt: 'Carne de Carneiro', ar: 'لحم ضأن' }, { en: 'Goat meat', fr: 'Viande de Chèvre', pt: 'Carne de Cabra', ar: 'لحم ماعز' }, { en: 'Pork', fr: 'Porc', pt: 'Carne de Porco', ar: 'لحم خنزير' }, { en: 'Poultry', fr: 'Volaille', pt: 'Aves', ar: 'دواجن' }, { en: 'Eggs', fr: 'Œufs', pt: 'Ovos', ar: 'بيض' }, { en: 'Milk', fr: 'Lait', pt: 'Leite', ar: 'حليب' }, { en: 'Hides', fr: 'Cuirs', pt: 'Couros', ar: 'جلود' }, { en: 'Other', fr: 'Autre', pt: 'Outro', ar: 'أخرى' }], { required: true }),
      textField('product_grade', { en: 'Product Grade', fr: 'Grade du Produit', pt: 'Grau do Produto', ar: 'درجة المنتج' }, { helpText: { en: 'Give the product grade.', fr: 'Indiquez le grade du produit.', pt: 'Informe o grau do produto.', ar: 'حدد درجة المنتج.' } }),
      numberField('quantity', { en: 'Quantity (m3)', fr: 'Quantité (m3)', pt: 'Quantidade (m3)', ar: 'الكمية (م3)' }, { required: true, helpText: { en: 'Give the quantity of the product produced in metric tonnes.', fr: 'Indiquez la quantité du produit produit en tonnes métriques.', pt: 'Informe a quantidade do produto produzido em toneladas métricas.', ar: 'حدد كمية المنتج المنتجة بالأطنان المترية.' } }),
      decimalField('price_product', { en: 'Price Product (Local Currency)', fr: 'Prix du Produit (Monnaie Locale)', pt: 'Preço do Produto (Moeda Local)', ar: 'سعر المنتج (العملة المحلية)' }, { required: true }),
      textField('monthly_demand', { en: 'Monthly Demand Product (Kg)', fr: 'Demande Mensuelle du Produit (Kg)', pt: 'Demanda Mensal do Produto (Kg)', ar: 'الطلب الشهري على المنتج (كغ)' }, { required: true }),
      textField('demand_type', { en: 'Type of Demand', fr: 'Type de Demande', pt: 'Tipo de Demanda', ar: 'نوع الطلب' }),
      textField('data_source', { en: 'Data Source', fr: 'Source des Données', pt: 'Fonte dos Dados', ar: 'مصدر البيانات' }, { required: true }),
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

// ═══════════════════════════════════════════════════════════════════════
// Seed Function
// ═══════════════════════════════════════════════════════════════════════

async function seed(): Promise<void> {
  console.log('Seeding form-builder with 21 official ARIS templates...\n');

  const auTenant = await prisma.tenant.findFirst({ where: { code: 'AU' } });
  if (!auTenant) {
    console.warn('AU-IBAR tenant not found. Run tenant seed first. Using placeholder UUID.');
  }
  const tenantId = auTenant?.id ?? '00000000-0000-0000-0000-000000000001';

  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const createdBy = adminUser?.id ?? '00000000-0000-0000-0000-000000000001';

  // ── Purge ALL existing templates so only the 21 official ones remain ──
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
