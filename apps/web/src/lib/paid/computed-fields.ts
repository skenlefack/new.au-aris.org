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
function normalizePaidData(raw: Record<string, unknown>): PaidSubmissionData {
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

  // Activity: from __meta_paid_activity label or logframe
  const metaActivity = d.__meta_paid_activity;
  const metaLogframe = d.__meta_logframe_activity;
  const activityLabel = metaActivity?.label || metaLogframe?.label || d.activity_type || d.activity || '';

  // Sector: from __meta_project_symbol or prod_sector
  const sector = d.prod_sector || metaProject?.sector || '';

  // Quarter
  const quarter = d.reporting_period || d.reporting_quarter || '';

  // Admin regions
  const metaAdmin1 = d.__meta_admin1;
  const admin1 = metaAdmin1?.name?.en || metaAdmin1?.name?.fr || metaAdmin1?.code || d.adm1_name || '';

  return {
    reporting_quarter: quarter,
    adm0_name: resolvedCountry,
    prj_symbol: prjSymbol,
    prj_title: prjTitle,
    adm1_name: admin1,
    activity_type: activityLabel,
    prod_sector: sector,
    executive_partner: d.executive_partner != null ? String(d.executive_partner) : d.__meta_executive_partner?.name,
    quantity_implemented: Number(d.quantity_implemented) || 0,
    quantity_targeted_annual: Number(d.total_quantity_targeted ?? d.quantity_targeted_annual) || 0,
    unit_of_measure: d.unit_of_measure,
    n_hh_benefitting: Number(d.n_hh_benefitting ?? d.n_hh_benefiting) || 0,
    n_interv_per_hh: Number(d.n_interv_per_hh) || 0,
    n_female_trained: Number(d.n_female_trained) || 0,
    n_male_trained: Number(d.n_male_trained) || 0,
    comments: d.comments_text || d.comments,
  };
}

/* ------------------------------------------------------------------ */
/*  Aggregate PAID submissions for dashboard KPIs                      */
/* ------------------------------------------------------------------ */

export interface PaidAggregates {
  totalProjects: number;
  totalRegions: number;
  totalBeneficiaries: number;
  totalHouseholds: number;
  totalTrained: number;
  totalFemale: number;
  totalMale: number;
  totalDisabled: number;
  totalQuantityImplemented: number;
  totalQuantityTargeted: number;
  completionRate: number;
  // Breakdown maps
  byCountry: Map<string, PaidCountryAgg>;
  bySector: Map<string, PaidSectorAgg>;
  byProject: Map<string, PaidProjectAgg>;
  byQuarter: Map<string, PaidQuarterAgg>;
  byActivity: Map<string, number>; // activity_type → beneficiaries
}

export interface PaidCountryAgg {
  country: string;
  code: string;
  beneficiaries: number;
  households: number;
  trained: number;
  disabled: number;
  projects: Set<string>;
  submissions: number;
}

export interface PaidSectorAgg {
  sector: string;
  beneficiaries: number;
  trained: number;
  quantity: number;
  projects: Set<string>;
  submissions: number;
}

export interface PaidProjectAgg {
  symbol: string;
  title: string;
  beneficiaries: number;
  trained: number;
  countries: Set<string>;
  submissions: number;
}

export interface PaidQuarterAgg {
  quarter: string;
  beneficiaries: number;
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
  const byActivity = new Map<string, number>();
  const allProjects = new Set<string>();
  const allRegions = new Set<string>();

  let totalBeneficiaries = 0;
  let totalHouseholds = 0;
  let totalTrained = 0;
  let totalFemale = 0;
  let totalMale = 0;
  let totalDisabled = 0;
  let totalQtyImpl = 0;
  let totalQtyTarget = 0;

  for (const sub of submissions) {
    // Normalize real form data to expected field codes
    const normalized = normalizePaidData(sub.data as Record<string, unknown>);
    const d = computePaidFields(normalized);
    const country = d.adm0_name || 'Unknown';
    const countryMeta = d.adm0_name ? getCountryMeta(d.adm0_name) : undefined;
    const countryCode = countryMeta?.code ?? '';
    const sector = d.prod_sector || 'Unknown';
    const project = d.prj_symbol || 'Unknown';
    const quarter = d.reporting_quarter || 'Unknown';
    const activity = d.activity_type || 'Unknown';

    const benef = d.n_benef_per_prj || 0;
    const hh = d.n_hh_benefitting || 0;
    const trained = d.n_individual_trained || 0;
    const female = d.n_female_trained || 0;
    const male = d.n_male_trained || 0;
    const disabled = d.n_disabled_benef || 0;
    const qtyImpl = d.quantity_implemented || 0;
    const qtyTarget = d.quantity_targeted_annual || 0;

    totalBeneficiaries += benef;
    totalHouseholds += hh;
    totalTrained += trained;
    totalFemale += female;
    totalMale += male;
    totalDisabled += disabled;
    totalQtyImpl += qtyImpl;
    totalQtyTarget += qtyTarget;

    if (project !== 'Unknown') allProjects.add(project);
    if (d.adm1_name) allRegions.add(`${country}:${d.adm1_name}`);

    // By Country
    const ca = byCountry.get(country) ?? { country, code: countryCode, beneficiaries: 0, households: 0, trained: 0, disabled: 0, projects: new Set(), submissions: 0 };
    ca.beneficiaries += benef;
    ca.households += hh;
    ca.trained += trained;
    ca.disabled += disabled;
    if (project !== 'Unknown') ca.projects.add(project);
    ca.submissions += 1;
    byCountry.set(country, ca);

    // By Sector
    const sa = bySector.get(sector) ?? { sector, beneficiaries: 0, trained: 0, quantity: 0, projects: new Set(), submissions: 0 };
    sa.beneficiaries += benef;
    sa.trained += trained;
    sa.quantity += qtyImpl;
    if (project !== 'Unknown') sa.projects.add(project);
    sa.submissions += 1;
    bySector.set(sector, sa);

    // By Project
    const pa = byProject.get(project) ?? { symbol: project, title: d.prj_title || project, beneficiaries: 0, trained: 0, countries: new Set(), submissions: 0 };
    pa.beneficiaries += benef;
    pa.trained += trained;
    if (country !== 'Unknown') pa.countries.add(country);
    pa.submissions += 1;
    byProject.set(project, pa);

    // By Quarter
    const qa = byQuarter.get(quarter) ?? { quarter, beneficiaries: 0, submissions: 0 };
    qa.beneficiaries += benef;
    qa.submissions += 1;
    byQuarter.set(quarter, qa);

    // By Activity
    byActivity.set(activity, (byActivity.get(activity) ?? 0) + benef);
  }

  return {
    totalProjects: allProjects.size,
    totalRegions: allRegions.size,
    totalBeneficiaries,
    totalHouseholds,
    totalTrained,
    totalFemale,
    totalMale,
    totalDisabled,
    totalQuantityImplemented: totalQtyImpl,
    totalQuantityTargeted: totalQtyTarget,
    completionRate: totalQtyTarget > 0 ? Math.round((totalQtyImpl / totalQtyTarget) * 100) : 0,
    byCountry,
    bySector,
    byProject,
    byQuarter,
    byActivity,
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
