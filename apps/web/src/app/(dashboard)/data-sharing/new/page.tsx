'use client';

// Data Sharing — 4-step wizard to create a new bilateral agreement.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Save,
  Send,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  useCreateDataShareAgreement,
  useSubmitDataShareAgreement,
  DATA_CLASSIFICATIONS,
  type CreateDataShareAgreementDto,
  type DataShareScope,
} from '@/lib/api/data-sharing';
import { useTenantTree, useCampaigns } from '@/lib/api/hooks';
import { useFormBuilderTemplates, useFormBuilderTemplate, type FormTemplateListItem } from '@/lib/api/form-builder-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';
import { SearchCombobox } from '@/components/ui/SearchCombobox';
import { ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';

// Domain options matching DB values (underscore format)
const DOMAIN_OPTIONS = [
  { value: 'animal_health', label: 'Animal Health' },
  { value: 'livestock', label: 'Livestock & Production' },
  { value: 'fisheries', label: 'Fisheries & Aquaculture' },
  { value: 'trade_sps', label: 'Trade & SPS' },
  { value: 'governance', label: 'Governance & Capacities' },
  { value: 'wildlife', label: 'Wildlife & Biodiversity' },
  { value: 'apiculture', label: 'Apiculture & Pollination' },
  { value: 'climate_env', label: 'Climate & Environment' },
  { value: 'paid', label: 'PAID' },
] as const;

interface FormField {
  id: string;
  code: string;
  label: string;
  type: string;
}

interface FormState {
  // Step 1
  sourceTenantId: string;
  recipientTenantId: string;
  title: string;
  description: string;
  // Step 2
  dataDomain: string;
  campaignId: string;
  selectedFormIds: string[]; // form templates checked for sharing
  selectedFields: Record<string, string[]>; // formId → field ids
  dataClassification: string;
  // Step 3
  canConsult: boolean;
  canExport: boolean;
  canModify: boolean;
  canRedistribute: boolean;
  validFrom: string;
  validUntil: string;
  maxRecordsPerQuery: string;
  maxExportsPerMonth: string;
  requireMfa: boolean;
  allowedIpRanges: string[];
  purpose: string;
  legalBasis: string;
}

interface FieldErrors {
  sourceTenantId?: string;
  recipientTenantId?: string;
  title?: string;
  selectedFormIds?: string;
  validFrom?: string;
  purpose?: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

interface FlatTenant {
  id: string;
  name: string;
  level: string;
}

function flattenTenants(nodes: any[] | undefined, out: FlatTenant[] = []): FlatTenant[] {
  if (!nodes) return out;
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, level: n.level });
    if (n.children?.length) flattenTenants(n.children, out);
  }
  return out;
}

export default function NewDataSharingPage() {
  const t = useTranslations('dataSharing');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isContinental = user?.tenantLevel === 'CONTINENTAL';
  const { data: tenantTree } = useTenantTree();
  const allTenants = useMemo(
    () => flattenTenants((tenantTree as any)?.data ?? []),
    [tenantTree],
  );
  // Only RECs and Member States can be parties to a sharing agreement
  // (continental cannot be a party — it's the supervisor)
  const partyTenants = useMemo(
    () => allTenants.filter((t) => t.level === 'REC' || t.level === 'MEMBER_STATE'),
    [allTenants],
  );

  const create = useCreateDataShareAgreement();
  const submit = useSubmitDataShareAgreement();

  const [step, setStep] = useState(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<FormState>({
    // For non-continental users, source is locked to their tenant.
    // Continental users start with a blank source they must pick.
    sourceTenantId: isContinental ? '' : (user?.tenantId ?? ''),
    recipientTenantId: '',
    title: '',
    description: '',
    dataDomain: 'animal_health',
    campaignId: '',
    selectedFormIds: [],
    selectedFields: {},
    dataClassification: 'PARTNER',
    canConsult: true,
    canExport: false,
    canModify: false,
    canRedistribute: false,
    validFrom: todayIso(),
    validUntil: '',
    maxRecordsPerQuery: '',
    maxExportsPerMonth: '',
    requireMfa: false,
    allowedIpRanges: [],
    purpose: '',
    legalBasis: '',
  });

  // ── Step 2 data: campaigns + form templates by domain ────────────────────────
  const { data: campaignsRes, isLoading: campaignsLoading } = useCampaigns({
    domain: form.dataDomain,
    limit: 100,
  });
  const allCampaigns = (campaignsRes as any)?.data ?? [];
  const campaigns = useMemo(
    () => allCampaigns.filter((c: any) => c.status === 'ACTIVE' || c.status === 'COMPLETED' || c.status === 'PLANNED'),
    [allCampaigns],
  );

  // Form templates filtered by domain
  const { data: templatesRes, isLoading: templatesLoading } = useFormBuilderTemplates({
    domain: form.dataDomain,
    status: 'PUBLISHED',
    limit: 100,
  });
  const domainTemplates: FormTemplateListItem[] = (templatesRes as any)?.data ?? [];

  const templatesById = useMemo(() => {
    const m: Record<string, FormTemplateListItem> = {};
    for (const tpl of domainTemplates) m[tpl.id] = tpl;
    return m;
  }, [domainTemplates]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c: any) => c.id === form.campaignId),
    [campaigns, form.campaignId],
  );

  // Expanded form templates (to show fields)
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());

  // Extract fields from a template schema
  function extractFields(schema: any): FormField[] {
    if (!schema?.sections) return [];
    const fields: FormField[] = [];
    for (const section of schema.sections) {
      if (!section?.fields) continue;
      for (const f of section.fields) {
        const label = typeof f.label === 'object'
          ? (f.label?.en ?? f.label?.fr ?? f.code ?? f.id)
          : (f.label ?? f.code ?? f.id);
        fields.push({ id: f.id, code: f.code ?? f.id, label, type: f.type ?? 'text' });
      }
    }
    return fields;
  }

  // When domain changes, reset all selections
  function changeDomain(d: string) {
    setForm((s) => ({ ...s, dataDomain: d, campaignId: '', selectedFormIds: [], selectedFields: {} }));
    setExpandedForms(new Set());
    setFieldErrors((e) => ({ ...e, campaignId: undefined, selectedFormIds: undefined }));
  }

  // When campaign changes, auto-select its template
  useEffect(() => {
    if (!form.campaignId) return;
    const camp = campaigns.find((c: any) => c.id === form.campaignId);
    if (camp?.templateId && !form.selectedFormIds.includes(camp.templateId)) {
      setForm((s) => ({
        ...s,
        selectedFormIds: [...new Set([...s.selectedFormIds, camp.templateId])],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.campaignId]);

  function toggleForm(id: string) {
    setForm((s) => {
      const isSelected = s.selectedFormIds.includes(id);
      const newIds = isSelected
        ? s.selectedFormIds.filter((x) => x !== id)
        : [...s.selectedFormIds, id];
      const newFields = { ...s.selectedFields };
      if (isSelected) delete newFields[id];
      return { ...s, selectedFormIds: newIds, selectedFields: newFields };
    });
    setFieldErrors((e) => ({ ...e, selectedFormIds: undefined }));
  }

  function toggleAllForms(select: boolean) {
    if (select) {
      setForm((s) => ({ ...s, selectedFormIds: domainTemplates.map((t) => t.id) }));
    } else {
      setForm((s) => ({ ...s, selectedFormIds: [], selectedFields: {} }));
    }
  }

  function toggleField(formId: string, fieldId: string) {
    setForm((s) => {
      const current = s.selectedFields[formId] ?? [];
      const newFields = current.includes(fieldId)
        ? current.filter((x) => x !== fieldId)
        : [...current, fieldId];
      return { ...s, selectedFields: { ...s.selectedFields, [formId]: newFields } };
    });
  }

  function toggleAllFields(formId: string, allFieldIds: string[], select: boolean) {
    setForm((s) => ({
      ...s,
      selectedFields: { ...s.selectedFields, [formId]: select ? [...allFieldIds] : [] },
    }));
  }

  function toggleExpanded(formId: string) {
    setExpandedForms((s) => {
      const next = new Set(s);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  }

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: undefined } as FieldErrors));
  };

  // Keep source/recipient in sync — they cannot be the same.
  // Tenants available as recipients = parties minus the chosen source.
  const recipientCandidates = useMemo(
    () => partyTenants.filter((tn) => tn.id !== form.sourceTenantId),
    [partyTenants, form.sourceTenantId],
  );
  // Source candidates: continental sees all parties; everyone else only sees
  // their own tenant (the field is locked anyway, but this keeps the combobox
  // option present so the label renders).
  const sourceCandidates = useMemo(() => {
    if (isContinental) return partyTenants;
    return partyTenants.filter((tn) => tn.id === user?.tenantId);
  }, [partyTenants, isContinental, user?.tenantId]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateStep(s: number): { errors: FieldErrors; firstMessage?: string } {
    const errors: FieldErrors = {};
    if (s === 1) {
      if (!form.sourceTenantId) errors.sourceTenantId = t('errors.sourceRequired');
      if (!form.recipientTenantId) errors.recipientTenantId = t('errors.recipientRequired');
      else if (form.recipientTenantId === form.sourceTenantId)
        errors.recipientTenantId = t('errors.recipientSameAsOwner');
      if (!form.title.trim()) errors.title = t('errors.titleRequired');
      else if (form.title.trim().length < 3) errors.title = t('errors.titleTooShort');
    }
    if (s === 2) {
      if (form.selectedFormIds.length === 0)
        errors.selectedFormIds = t('errors.formsRequired');
    }
    if (s === 3) {
      if (!form.validFrom) errors.validFrom = t('errors.validFromRequired');
      if (form.validUntil && form.validFrom && form.validUntil < form.validFrom) {
        errors.validFrom = t('errors.validUntilBeforeFrom');
      }
      if (!form.purpose.trim()) errors.purpose = t('errors.purposeRequired');
    }
    const firstKey = Object.keys(errors)[0] as keyof FieldErrors | undefined;
    return { errors, firstMessage: firstKey ? errors[firstKey] : undefined };
  }

  function next() {
    const { errors, firstMessage } = validateStep(step);
    setFieldErrors(errors);
    if (firstMessage) {
      setGlobalError(firstMessage);
      // Scroll to top so the alert is visible
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ }
      return;
    }
    setGlobalError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function prev() {
    setGlobalError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function buildPayload(): CreateDataShareAgreementDto {
    const campName = selectedCampaign
      ? (typeof selectedCampaign.name === 'object' ? (selectedCampaign.name as any)?.en : selectedCampaign.name)
      : undefined;
    const scope: DataShareScope = {
      entities: form.selectedFormIds,
      campaignId: form.campaignId || undefined,
      campaignName: campName,
      formIds: form.selectedFormIds,
      fields: form.selectedFields,
    } as any;
    return {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      // Always send ownerTenantId so the backend knows which tenant the
      // continental user is acting on behalf of. For non-continental users
      // it equals user.tenantId — the backend rejects mismatches.
      ownerTenantId: form.sourceTenantId,
      recipientTenantId: form.recipientTenantId,
      dataDomain: form.dataDomain,
      dataScope: scope,
      dataClassification: form.dataClassification,
      purpose: form.purpose.trim(),
      legalBasis: form.legalBasis.trim() || undefined,
      validFrom: form.validFrom,
      validUntil: form.validUntil || undefined,
      canConsult: form.canConsult,
      canExport: form.canExport,
      canModify: form.canModify,
      canRedistribute: form.canRedistribute,
      maxRecordsPerQuery: form.maxRecordsPerQuery ? Number(form.maxRecordsPerQuery) : undefined,
      maxExportsPerMonth: form.maxExportsPerMonth ? Number(form.maxExportsPerMonth) : undefined,
      requireMfa: form.requireMfa,
      allowedIpRanges: form.allowedIpRanges,
    };
  }

  function validateAll(): boolean {
    let allErrors: FieldErrors = {};
    let firstStepWithErr: number | null = null;
    let firstMsg: string | undefined;
    for (const s of [1, 2, 3]) {
      const { errors, firstMessage } = validateStep(s);
      if (Object.keys(errors).length > 0) {
        allErrors = { ...allErrors, ...errors };
        if (firstStepWithErr === null) {
          firstStepWithErr = s;
          firstMsg = firstMessage;
        }
      }
    }
    if (firstStepWithErr !== null) {
      setFieldErrors(allErrors);
      setGlobalError(firstMsg ?? null);
      setStep(firstStepWithErr);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ }
      return false;
    }
    setFieldErrors({});
    setGlobalError(null);
    return true;
  }

  async function saveDraft() {
    if (!validateAll()) return;
    try {
      await create.mutateAsync(buildPayload());
      router.push('/data-sharing');
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Error');
    }
  }

  async function saveAndSubmit() {
    if (!validateAll()) return;
    try {
      const created = await create.mutateAsync(buildPayload());
      await submit.mutateAsync(created.data.id);
      router.push(`/data-sharing/${created.data.id}`);
    } catch (err: any) {
      setGlobalError(err?.message ?? 'Error');
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/data-sharing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('newAgreement')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              step === s
                ? 'border-primary bg-primary/5 font-semibold text-primary'
                : step > s
                  ? 'border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400'
                  : 'border-border text-muted-foreground'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step > s
                  ? 'bg-green-500 text-white'
                  : step === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
              }`}
            >
              {step > s ? <Check className="h-3.5 w-3.5" /> : s}
            </span>
            <span className="truncate">{t(`wizard.step${s}`)}</span>
          </div>
        ))}
      </div>

      {globalError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        {step === 1 && (
          <div className="space-y-4">
            <Field
              label={t('wizard.sourceLabel')}
              required
              error={fieldErrors.sourceTenantId}
              hint={
                isContinental
                  ? t('wizard.sourceHintContinental')
                  : t('wizard.sourceHintLocked')
              }
            >
              {isContinental ? (
                <SearchCombobox
                  value={
                    sourceCandidates.find((tn) => tn.id === form.sourceTenantId) ?? null
                  }
                  onChange={(item) => update('sourceTenantId', item?.id ?? '')}
                  items={sourceCandidates}
                  labelKey={(tn) => `${tn.name} (${tn.level})`}
                  filterKey={(tn) => `${tn.name} ${tn.level}`}
                  placeholder={t('wizard.sourcePlaceholder')}
                  className={
                    fieldErrors.sourceTenantId ? 'rounded-lg ring-1 ring-destructive' : ''
                  }
                />
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">
                    {sourceCandidates[0]?.name ?? user?.tenantId}
                  </span>
                  {sourceCandidates[0]?.level && (
                    <span className="text-xs text-muted-foreground">
                      ({sourceCandidates[0].level})
                    </span>
                  )}
                </div>
              )}
            </Field>
            <Field
              label={t('wizard.recipientLabel')}
              required
              error={fieldErrors.recipientTenantId}
              hint={t('wizard.recipientHint')}
            >
              <SearchCombobox
                value={
                  recipientCandidates.find((tn) => tn.id === form.recipientTenantId) ??
                  null
                }
                onChange={(item) => update('recipientTenantId', item?.id ?? '')}
                items={recipientCandidates}
                labelKey={(tn) => `${tn.name} (${tn.level})`}
                filterKey={(tn) => `${tn.name} ${tn.level}`}
                placeholder={t('wizard.recipientPlaceholder')}
                disabled={!form.sourceTenantId}
                className={
                  fieldErrors.recipientTenantId ? 'rounded-lg ring-1 ring-destructive' : ''
                }
              />
            </Field>
            <Field label={t('wizard.titleLabel')} required error={fieldErrors.title}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder={t('wizard.titlePlaceholder')}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                  fieldErrors.title ? 'border-destructive' : 'border-input'
                }`}
              />
            </Field>
            <Field label={t('wizard.descriptionLabel')}>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                placeholder={t('wizard.descriptionPlaceholder')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {/* Domain */}
            <Field label={t('wizard.domainLabel')} required>
              <select
                value={form.dataDomain}
                onChange={(e) => changeDomain(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </Field>

            {/* Campaign (optional) */}
            <Field
              label={t('wizard.campaignLabel')}
              hint={campaignsLoading ? '' : campaigns.length > 0 ? t('wizard.campaignHint') : t('wizard.noCampaigns')}
            >
              {campaignsLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}
                </div>
              ) : (
                <select
                  value={form.campaignId}
                  onChange={(e) => update('campaignId', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— {t('wizard.campaignPlaceholder')} —</option>
                  {campaigns.map((c: any) => {
                    const cName = typeof c.name === 'object' ? (c.name?.en ?? c.name?.fr ?? c.id) : c.name;
                    return (
                      <option key={c.id} value={c.id}>
                        {cName} ({c.status})
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>

            {/* Form Templates */}
            <Field
              label={t('wizard.formsLabel')}
              hint={t('wizard.formsHint')}
              error={fieldErrors.selectedFormIds}
            >
              {templatesLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}
                </div>
              ) : domainTemplates.length === 0 ? (
                <div className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  No published form templates found for this domain.
                </div>
              ) : (
                <>
                  {/* Select All / Deselect All forms */}
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{form.selectedFormIds.length} / {domainTemplates.length} forms selected</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleAllForms(true)} className="hover:text-foreground font-medium">
                        Select all
                      </button>
                      <span>·</span>
                      <button type="button" onClick={() => toggleAllForms(false)} className="hover:text-foreground font-medium">
                        Deselect all
                      </button>
                    </div>
                  </div>
                  <div className={`divide-y rounded-md border ${fieldErrors.selectedFormIds ? 'border-destructive' : 'border-input'}`}>
                    {domainTemplates.map((tpl) => {
                      const checked = form.selectedFormIds.includes(tpl.id);
                      const isExpanded = expandedForms.has(tpl.id);
                      const fields = extractFields(tpl.schema);
                      const selectedFieldIds = form.selectedFields[tpl.id] ?? [];
                      return (
                        <div key={tpl.id}>
                          <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/30">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleForm(tpl.id)}
                              className="h-4 w-4 cursor-pointer shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => toggleExpanded(tpl.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{tpl.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  v{tpl.version} · {fields.length} fields
                                  {selectedFieldIds.length > 0 && ` · ${selectedFieldIds.length} selected`}
                                </p>
                              </div>
                            </button>
                          </div>
                          {/* Expanded: show fields */}
                          {isExpanded && fields.length > 0 && (
                            <div className="border-t bg-muted/20 px-3 py-2">
                              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                                <span>{selectedFieldIds.length} / {fields.length} fields</span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleAllFields(tpl.id, fields.map((f) => f.id), true)}
                                    className="hover:text-foreground font-medium"
                                  >
                                    Select all
                                  </button>
                                  <span>·</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleAllFields(tpl.id, fields.map((f) => f.id), false)}
                                    className="hover:text-foreground font-medium"
                                  >
                                    Deselect all
                                  </button>
                                </div>
                              </div>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {fields.map((f) => (
                                  <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent/30 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedFieldIds.includes(f.id)}
                                      onChange={() => toggleField(tpl.id, f.id)}
                                      className="h-3.5 w-3.5"
                                    />
                                    <span className="truncate">{f.label}</span>
                                    <span className="ml-auto shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{f.type}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {isExpanded && fields.length === 0 && (
                            <div className="border-t bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                              No fields defined in this template schema.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Field>

            {/* Data Classification */}
            <Field label={t('wizard.classificationLabel')} required>
              <select
                value={form.dataClassification}
                onChange={(e) => update('dataClassification', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DATA_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">{t('wizard.permissionsLabel')}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Toggle label={t('wizard.canConsult')} checked={form.canConsult} onChange={(v) => update('canConsult', v)} />
                <Toggle label={t('wizard.canExport')} checked={form.canExport} onChange={(v) => update('canExport', v)} />
                <Toggle label={t('wizard.canModify')} checked={form.canModify} onChange={(v) => update('canModify', v)} />
                <Toggle label={t('wizard.canRedistribute')} checked={form.canRedistribute} onChange={(v) => update('canRedistribute', v)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('wizard.validFromLabel')} required error={fieldErrors.validFrom}>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => update('validFrom', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    fieldErrors.validFrom ? 'border-destructive' : 'border-input'
                  }`}
                />
              </Field>
              <Field label={t('wizard.validUntilLabel')}>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => update('validUntil', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('wizard.maxRecordsLabel')}>
                <input
                  type="number"
                  min={0}
                  value={form.maxRecordsPerQuery}
                  onChange={(e) => update('maxRecordsPerQuery', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('wizard.maxExportsLabel')}>
                <input
                  type="number"
                  min={0}
                  value={form.maxExportsPerMonth}
                  onChange={(e) => update('maxExportsPerMonth', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Toggle label={t('wizard.requireMfaLabel')} checked={form.requireMfa} onChange={(v) => update('requireMfa', v)} />
            <Field label={t('wizard.ipRangesLabel')}>
              <ChipsInput
                values={form.allowedIpRanges}
                onChange={(v) => update('allowedIpRanges', v)}
                placeholder="10.0.0.0/8"
              />
            </Field>
            <Field label={t('wizard.purposeLabel')} required error={fieldErrors.purpose}>
              <textarea
                value={form.purpose}
                onChange={(e) => update('purpose', e.target.value)}
                rows={3}
                placeholder={t('wizard.purposePlaceholder')}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                  fieldErrors.purpose ? 'border-destructive' : 'border-input'
                }`}
              />
            </Field>
            <Field label={t('wizard.legalBasisLabel')}>
              <textarea
                value={form.legalBasis}
                onChange={(e) => update('legalBasis', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('wizard.reviewTitle')}</h3>
            <SummaryRow
              label={t('wizard.sourceLabel')}
              value={
                allTenants.find((x) => x.id === form.sourceTenantId)?.name ??
                form.sourceTenantId
              }
            />
            <SummaryRow
              label={t('wizard.recipientLabel')}
              value={
                allTenants.find((x) => x.id === form.recipientTenantId)?.name ??
                form.recipientTenantId
              }
            />
            <SummaryRow label={t('wizard.titleLabel')} value={form.title} />
            {form.description && <SummaryRow label={t('wizard.descriptionLabel')} value={form.description} />}
            <SummaryRow label={t('wizard.domainLabel')} value={DOMAIN_OPTIONS.find((d) => d.value === form.dataDomain)?.label ?? form.dataDomain} />
            <SummaryRow label={t('wizard.campaignLabel')} value={
              selectedCampaign
                ? (typeof selectedCampaign.name === 'object' ? (selectedCampaign.name as any)?.en : selectedCampaign.name) ?? '—'
                : '—'
            } />
            <SummaryRow
              label={t('wizard.formsLabel')}
              value={
                form.selectedFormIds.length > 0
                  ? form.selectedFormIds
                      .map((id) => templatesById[id]?.name ?? id)
                      .join(' · ')
                  : '—'
              }
            />
            <SummaryRow label={t('wizard.classificationLabel')} value={form.dataClassification} />
            <SummaryRow
              label={t('wizard.permissionsLabel')}
              value={
                [
                  form.canConsult && t('wizard.canConsult'),
                  form.canExport && t('wizard.canExport'),
                  form.canModify && t('wizard.canModify'),
                  form.canRedistribute && t('wizard.canRedistribute'),
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }
            />
            <SummaryRow
              label={`${t('wizard.validFromLabel')} → ${t('wizard.validUntilLabel')}`}
              value={`${form.validFrom}${form.validUntil ? ' → ' + form.validUntil : ''}`}
            />
            <SummaryRow label={t('wizard.purposeLabel')} value={form.purpose} />
            {form.legalBasis && <SummaryRow label={t('wizard.legalBasisLabel')} value={form.legalBasis} />}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={step === 1}
          className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> {t('wizard.previous')}
        </button>
        <div className="flex gap-2">
          <Link
            href="/data-sharing"
            className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm"
          >
            <X className="h-4 w-4" /> {t('wizard.cancel')}
          </Link>
          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('wizard.next')} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={saveDraft}
                disabled={create.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {t('wizard.saveDraft')}
              </button>
              <button
                type="button"
                onClick={saveAndSubmit}
                disabled={create.isPending || submit.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {t('wizard.saveAndSubmit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function ChipsInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  function commit() {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-1 py-1 text-sm outline-none"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b py-2 md:grid-cols-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="md:col-span-2 text-sm">{value || '—'}</span>
    </div>
  );
}
