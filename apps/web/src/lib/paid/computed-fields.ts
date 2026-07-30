/**
 * PAID Computed Fields Engine
 *
 * Reproduces the Excel formulas from PAID_2024 sheet:
 *   Y  = W × X          → n_individuals_benefiting = hh_size × n_hh
 *   AA = Y/Z + AB + AC   → n_benef_per_project
 *   AD = AB + AC          → n_individual_trained = female + male
 *   AF = AA × AE          → n_disabled_benef = benef × disability_pct
 */

import { getCountryMeta } from './referentials';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Raw PAID submission data (field codes from the form template) */
export interface PaidSubmissionData {
  reporting_quarter?: string;
  multicountry?: string;
  adm0_name?: string;
  prj_symbol?: string;
  prj_title?: string;
  adm1_name?: string;
  adm2_name?: string;
  executive_partner?: string;
  implem_partner_intl?: string;
  implem_partner_local?: string;
  prod_sector?: string;
  activity_type?: string;
  cva_delivery?: string;
  cash_amount?: number;
  cash_plus?: string;
  species_variety?: string;
  prod_system?: string;
  disease_pest?: string;
  unit_of_measure?: string;
  quantity_implemented?: number;
  quantity_targeted_annual?: number;
  n_hh_benefitting?: number;
  n_interv_per_hh?: number;
  n_female_trained?: number;
  n_male_trained?: number;
  comments?: string;

  // Computed fields (filled by computePaidFields)
  cntr_ave_hh_size?: number;
  n_individuals_benefiting?: number;
  n_benef_per_prj?: number;
  n_individual_trained?: number;
  perc_cntr_disabled_pop?: number;
  n_disabled_benef?: number;
  budget_proportion?: number;
}

/** PAID submission with computed fields populated */
export interface PaidComputedSubmission extends PaidSubmissionData {
  id: string;
  status: string;
  submittedAt?: string;
  tenantId?: string;
}

/* ------------------------------------------------------------------ */
/*  Compute all derived fields for a single PAID row                   */
/* ------------------------------------------------------------------ */

export function computePaidFields(data: PaidSubmissionData): PaidSubmissionData {
  const result = { ...data };

  // Lookup country metadata
  const countryMeta = data.adm0_name ? getCountryMeta(data.adm0_name) : undefined;

  // W — Average HH size (auto from country)
  result.cntr_ave_hh_size = countryMeta?.hhSize ?? 0;

  // Y = W × X — Individuals benefiting from intervention
  const hhSize = result.cntr_ave_hh_size || 0;
  const nHh = data.n_hh_benefitting || 0;
  result.n_individuals_benefiting = hhSize * nHh;

  // AD = AB + AC — Total individuals trained
  const female = data.n_female_trained || 0;
  const male = data.n_male_trained || 0;
  result.n_individual_trained = female + male;

  // AA = Y/Z + AB + AC — Beneficiaries per project (anti-double-counting)
  const interv = data.n_interv_per_hh || 1; // default 1 to avoid division by zero
  const fromHH = interv > 0 ? result.n_individuals_benefiting / interv : 0;
  result.n_benef_per_prj = fromHH + female + male;

  // AE — % disabled population (auto from country)
  result.perc_cntr_disabled_pop = countryMeta?.disabilityPct ?? 0;

  // AF = AA × AE — Beneficiaries with disability
  result.n_disabled_benef = result.n_benef_per_prj * result.perc_cntr_disabled_pop;

  return result;
}

/* ------------------------------------------------------------------ */
/*  Normalize actual form data → expected field codes                   */
/* ------------------------------------------------------------------ */

/**
 * The PAID form uses field codes like `country_of_implementation` (UUID),
 * `project_symbol` (code), `reporting_period`, etc.
 * The aggregation engine expects `adm0_name`, `prj_symbol`, `reporting_quarter`.
 * This function maps real form data to the expected structure.
 */
/** Normalized PAID data shape — matches actual form fields */
export interface NormalizedPaidData {
  reporting_quarter: string;
  reporting_year: string;
  adm0_name: string;
  adm0_code: string;
  adm1_name: string;
  prj_symbol: string;
  prj_title: string;
  activity_type: string;
  logframe_label: string;
  sub_activity_label: string;
  prod_sector: string;
  executive_partner: string;
  quantity_implemented: number;
  quantity_targeted_annual: number;
  unit_of_measure: string;
  expenditure_amount: number;
  section_of_project: string;
  recs: string[];
  countries_benefiting: string[];
  n_hh_benefitting: number;
  n_female_trained: number;
  n_male_trained: number;
}

function normalizePaidData(raw: Record<string, unknown>): NormalizedPaidData {
  const d = raw as Record<string, any>;

  // Country: resolve from __meta or code lookup
  const metaCountry = d.__meta_country_of_implementation;
  const countryName = metaCountry?.name?.en || metaCountry?.name?.fr || '';
  const countryCode = metaCountry?.code || '';
  const resolvedCountry = countryName || (countryCode ? getCountryMeta(countryCode)?.name : '') || d.adm0_name || '';

  // Project symbol + title
  const metaProject = d.__meta_project_symbol;
  const prjSymbol = d.project_symbol || metaProject?.code || d.prj_symbol || '';
  const prjTitle = d.project_title || metaProject?.title || d.prj_title || '';

  // Activity labels from __meta cascade
  const metaActivity = d.__meta_paid_activity;
  const metaLogframe = d.__meta_logframe_activity;
  const metaSubActivity = d.__meta_sub_activity;
  const activityLabel = metaActivity?.label || d.activity_type || '';
  const logframeLabel = metaLogframe?.label || '';
  const subActivityLabel = metaSubActivity?.label || '';

  // Sector: from __meta_project_symbol or prod_sector
  const sector = d.prod_sector || metaProject?.sector || '';

  // Quarter + Year
  const quarter = d.reporting_period || d.reporting_quarter || '';
  const year = d.reporting_year ? String(d.reporting_year) : '';

  // Admin regions
  const metaAdmin1 = d.__meta_admin1;
  const admin1 = metaAdmin1?.name?.en || metaAdmin1?.name?.fr || metaAdmin1?.code || d.adm1_name || '';

  // RECs & countries benefiting
  const recsCountries = d.recs_countries || {};
  const recs: string[] = Array.isArray(recsCountries.recs) ? recsCountries.recs : [];
  const countriesBenefiting: string[] = Array.isArray(recsCountries.countries) ? recsCountries.countries : [];

  // Executive partner
  const metaExec = d.__meta_executive_partner;
  const execPartner = metaExec?.name || (d.executive_partner != null ? String(d.executive_partner) : '');

  return {
    reporting_quarter: quarter,
    reporting_year: year,
    adm0_name: resolvedCountry,
    adm0_code: countryCode,
    adm1_name: admin1,
    prj_symbol: prjSymbol,
    prj_title: prjTitle,
    activity_type: activityLabel,
    logframe_label: logframeLabel,
    sub_activity_label: subActivityLabel,
    prod_sector: sector,
    executive_partner: execPartner,
    quantity_implemented: Number(d.quantity_implemented) || 0,
    quantity_targeted_annual: Number(d.total_quantity_targeted ?? d.quantity_targeted_annual) || 0,
    unit_of_measure: d.unit_of_measure || '',
    expenditure_amount: Number(d.expenditure_amount) || 0,
    section_of_project: d.section_of_project || '',
    recs,
    countries_benefiting: countriesBenefiting,
    n_hh_benefitting: Number(d.n_hh_benefitting ?? d.n_hh_benefiting) || 0,
    n_female_trained: Number(d.breakdown?.n_female_trained ?? d.n_female_trained) || 0,
    n_male_trained: Number(d.breakdown?.n_male_trained ?? d.n_male_trained) || 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Aggregate PAID submissions for dashboard KPIs                      */
/* ------------------------------------------------------------------ */

export interface PaidAggregates {
  totalProjects: number;
  totalCountries: number;
  totalCountriesBenefiting: number;
  totalRegions: number;
  totalRecs: number;
  totalSubmissions: number;
  totalQuantityImplemented: number;
  totalQuantityTargeted: number;
  totalExpenditure: number;
  totalAnimalsVaccinated: number;
  completionRate: number;
  // Legacy (from HH/trained fields, may be 0 if form doesn't have them)
  totalBeneficiaries: number;
  totalHouseholds: number;
  totalTrained: number;
  totalFemale: number;
  totalMale: number;
  totalDisabled: number;
  // Breakdown maps
  byCountry: Map<string, PaidCountryAgg>;
  bySector: Map<string, PaidSectorAgg>;
  byProject: Map<string, PaidProjectAgg>;
  byQuarter: Map<string, PaidQuarterAgg>;
  byActivity: Map<string, PaidActivityAgg>;
  byPartner: Map<string, PaidPartnerAgg>;
}

export interface PaidCountryAgg {
  country: string;
  code: string;
  quantityImplemented: number;
  quantityTargeted: number;
  expenditure: number;
  beneficiaries: number;
  households: number;
  trained: number;
  disabled: number;
  projects: Set<string>;
  submissions: number;
}

export interface PaidSectorAgg {
  sector: string;
  quantityImplemented: number;
  beneficiaries: number;
  trained: number;
  quantity: number;
  projects: Set<string>;
  submissions: number;
}

export interface PaidProjectAgg {
  symbol: string;
  title: string;
  quantityImplemented: number;
  quantityTargeted: number;
  expenditure: number;
  beneficiaries: number;
  trained: number;
  countries: Set<string>;
  submissions: number;
}

export interface PaidQuarterAgg {
  quarter: string;
  quantityImplemented: number;
  expenditure: number;
  beneficiaries: number;
  submissions: number;
}

export interface PaidActivityAgg {
  label: string;
  quantityImplemented: number;
  quantityTargeted: number;
  submissions: number;
}

export interface PaidPartnerAgg {
  name: string;
  quantityImplemented: number;
  submissions: number;
}

/**
 * Aggregate an array of PAID submissions into dashboard KPIs.
 * All computed fields are recalculated to ensure consistency.
 */
export function aggregatePaidSubmissions(
  submissions: Array<{ data: PaidSubmissionData | Record<string, unknown>; status?: string; id?: string }>,
): PaidAggregates {
  const byCountry = new Map<string, PaidCountryAgg>();
  const bySector = new Map<string, PaidSectorAgg>();
  const byProject = new Map<string, PaidProjectAgg>();
  const byQuarter = new Map<string, PaidQuarterAgg>();
  const byActivity = new Map<string, PaidActivityAgg>();
  const byPartner = new Map<string, PaidPartnerAgg>();
  const allProjects = new Set<string>();
  const allCountries = new Set<string>();
  const allCountriesBenefiting = new Set<string>();
  const allRegions = new Set<string>();
  const allRecs = new Set<string>();

  let totalBeneficiaries = 0;
  let totalHouseholds = 0;
  let totalTrained = 0;
  let totalFemale = 0;
  let totalMale = 0;
  let totalDisabled = 0;
  let totalQtyImpl = 0;
  let totalQtyTarget = 0;
  let totalExpenditure = 0;
  let totalAnimalsVaccinated = 0;

  for (const sub of submissions) {
    const n = normalizePaidData(sub.data as Record<string, unknown>);
    const country = n.adm0_name || 'Unknown';
    const countryCode = n.adm0_code || getCountryMeta(country)?.code || '';
    const sector = n.prod_sector || 'Unknown';
    const project = n.prj_symbol || 'Unknown';
    const quarter = n.reporting_quarter || 'Unknown';
    const activity = n.activity_type || 'Unknown';

    const qtyImpl = n.quantity_implemented;
    const qtyTarget = n.quantity_targeted_annual;
    const expenditure = n.expenditure_amount;

    // Compute legacy beneficiary fields (from HH data if available)
    const computedBenef = computePaidFields({
      adm0_name: country,
      n_hh_benefitting: n.n_hh_benefitting,
      n_female_trained: n.n_female_trained,
      n_male_trained: n.n_male_trained,
    });
    const benef = computedBenef.n_benef_per_prj || 0;
    const trained = computedBenef.n_individual_trained || 0;
    const disabled = computedBenef.n_disabled_benef || 0;

    totalQtyImpl += qtyImpl;
    totalQtyTarget += qtyTarget;
    totalExpenditure += expenditure;

    // Detect vaccination activities by keyword in activity/logframe/sub-activity labels
    const actLower = (activity + ' ' + n.logframe_label + ' ' + n.sub_activity_label).toLowerCase();
    if (actLower.includes('vaccin') || actLower.includes('immuniz') || actLower.includes('immunis')) {
      totalAnimalsVaccinated += qtyImpl;
    }
    totalBeneficiaries += benef;
    totalHouseholds += n.n_hh_benefitting;
    totalTrained += trained;
    totalFemale += n.n_female_trained;
    totalMale += n.n_male_trained;
    totalDisabled += disabled;

    if (project !== 'Unknown') allProjects.add(project);
    if (country !== 'Unknown') allCountries.add(country);
    if (n.adm1_name) allRegions.add(`${country}:${n.adm1_name}`);
    for (const rec of n.recs) allRecs.add(rec.toUpperCase());
    // Countries benefiting (from recs_countries field + implementation country)
    for (const bc of n.countries_benefiting) allCountriesBenefiting.add(bc);
    if (countryCode) allCountriesBenefiting.add(countryCode);

    // By Country
    const ca = byCountry.get(country) ?? {
      country, code: countryCode, quantityImplemented: 0, quantityTargeted: 0,
      expenditure: 0, beneficiaries: 0, households: 0, trained: 0, disabled: 0,
      projects: new Set(), submissions: 0,
    };
    ca.quantityImplemented += qtyImpl;
    ca.quantityTargeted += qtyTarget;
    ca.expenditure += expenditure;
    ca.beneficiaries += benef;
    ca.households += n.n_hh_benefitting;
    ca.trained += trained;
    ca.disabled += disabled;
    if (project !== 'Unknown') ca.projects.add(project);
    ca.submissions += 1;
    byCountry.set(country, ca);

    // By Sector
    const sa = bySector.get(sector) ?? {
      sector, quantityImplemented: 0, beneficiaries: 0, trained: 0,
      quantity: 0, projects: new Set(), submissions: 0,
    };
    sa.quantityImplemented += qtyImpl;
    sa.beneficiaries += benef;
    sa.trained += trained;
    sa.quantity += qtyImpl;
    if (project !== 'Unknown') sa.projects.add(project);
    sa.submissions += 1;
    bySector.set(sector, sa);

    // By Project
    const pa = byProject.get(project) ?? {
      symbol: project, title: n.prj_title || project,
      quantityImplemented: 0, quantityTargeted: 0, expenditure: 0,
      beneficiaries: 0, trained: 0, countries: new Set(), submissions: 0,
    };
    pa.quantityImplemented += qtyImpl;
    pa.quantityTargeted += qtyTarget;
    pa.expenditure += expenditure;
    pa.beneficiaries += benef;
    pa.trained += trained;
    if (country !== 'Unknown') pa.countries.add(country);
    pa.submissions += 1;
    byProject.set(project, pa);

    // By Quarter
    const qa = byQuarter.get(quarter) ?? {
      quarter, quantityImplemented: 0, expenditure: 0, beneficiaries: 0, submissions: 0,
    };
    qa.quantityImplemented += qtyImpl;
    qa.expenditure += expenditure;
    qa.beneficiaries += benef;
    qa.submissions += 1;
    byQuarter.set(quarter, qa);

    // By Activity
    const aa = byActivity.get(activity) ?? {
      label: activity, quantityImplemented: 0, quantityTargeted: 0, submissions: 0,
    };
    aa.quantityImplemented += qtyImpl;
    aa.quantityTargeted += qtyTarget;
    aa.submissions += 1;
    byActivity.set(activity, aa);

    // By Executive Partner
    const partner = n.executive_partner || 'Unknown';
    if (partner !== 'Unknown') {
      const ep = byPartner.get(partner) ?? { name: partner, quantityImplemented: 0, submissions: 0 };
      ep.quantityImplemented += qtyImpl;
      ep.submissions += 1;
      byPartner.set(partner, ep);
    }
  }

  return {
    totalProjects: allProjects.size,
    totalCountries: allCountries.size,
    totalCountriesBenefiting: allCountriesBenefiting.size,
    totalRegions: allRegions.size,
    totalRecs: allRecs.size,
    totalSubmissions: submissions.length,
    totalQuantityImplemented: totalQtyImpl,
    totalQuantityTargeted: totalQtyTarget,
    totalExpenditure: totalExpenditure,
    totalAnimalsVaccinated,
    completionRate: totalQtyTarget > 0 ? Math.round((totalQtyImpl / totalQtyTarget) * 100) : 0,
    totalBeneficiaries,
    totalHouseholds,
    totalTrained,
    totalFemale,
    totalMale,
    totalDisabled,
    byCountry,
    bySector,
    byProject,
    byQuarter,
    byActivity,
    byPartner,
  };
}

/* ------------------------------------------------------------------ */
/*  Filter submissions by tenant hierarchy (Country→REC→Continental)   */
/* ------------------------------------------------------------------ */

export interface PaidFilters {
  year?: string;
  quarter?: string;
  country?: string;
  sector?: string;
  project?: string;
  activity?: string;
}

export function filterPaidSubmissions(
  submissions: Array<{ data: PaidSubmissionData | Record<string, unknown> }>,
  filters: PaidFilters,
): Array<{ data: PaidSubmissionData | Record<string, unknown> }> {
  if (!filters.quarter && !filters.country && !filters.sector && !filters.project && !filters.activity) {
    return submissions;
  }
  return submissions.filter((sub) => {
    const d = normalizePaidData(sub.data as Record<string, unknown>);
    if (filters.quarter && d.reporting_quarter !== filters.quarter) return false;
    if (filters.country && d.adm0_name !== filters.country) return false;
    if (filters.sector && d.prod_sector !== filters.sector) return false;
    if (filters.project && d.prj_symbol !== filters.project) return false;
    if (filters.activity && d.activity_type !== filters.activity) return false;
    return true;
  });
}

/** Extract normalized field values from raw submissions (for filter dropdowns) */
export function extractPaidFilterOptions(submissions: Array<{ data: Record<string, unknown> }>) {
  const countries = new Set<string>();
  const projects = new Set<string>();
  const quarters = new Set<string>();
  const activities = new Set<string>();

  for (const sub of submissions) {
    const n = normalizePaidData(sub.data);
    if (n.adm0_name) countries.add(n.adm0_name);
    if (n.prj_symbol) projects.add(n.prj_symbol);
    if (n.reporting_quarter) quarters.add(n.reporting_quarter);
    if (n.activity_type) activities.add(n.activity_type);
  }

  return {
    countries: [...countries].sort(),
    projects: [...projects].sort(),
    quarters: [...quarters].sort(),
    activities: [...activities].sort(),
  };
}
