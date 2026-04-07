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
  DATA_DOMAINS,
  DATA_CLASSIFICATIONS,
  type CreateDataShareAgreementDto,
  type DataShareScope,
} from '@/lib/api/data-sharing';
import { useTenantTree, useCampaigns, useFormTemplates } from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

interface FormState {
  // Step 1
  recipientTenantId: string;
  title: string;
  description: string;
  // Step 2
  dataDomain: string;
  campaignId: string;
  selectedFormIds: string[]; // form templates checked for sharing
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
  recipientTenantId?: string;
  title?: string;
  campaignId?: string;
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
  const { data: tenantTree } = useTenantTree();
  const tenants = useMemo(() => flattenTenants((tenantTree as any)?.data ?? []), [tenantTree]);

  const create = useCreateDataShareAgreement();
  const submit = useSubmitDataShareAgreement();

  const [step, setStep] = useState(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<FormState>({
    recipientTenantId: '',
    title: '',
    description: '',
    dataDomain: 'animal-health',
    campaignId: '',
    selectedFormIds: [],
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

  // ── Step 2 data: campaigns + form templates ─────────────────────────────────
  const { data: campaignsRes, isLoading: campaignsLoading } = useCampaigns({
    domain: form.dataDomain,
    limit: 100,
  });
  const allCampaigns = (campaignsRes as any)?.data ?? [];
  // "campagnes en cours ou archivées" → ACTIVE + COMPLETED
  const campaigns = useMemo(
    () => allCampaigns.filter((c: any) => c.status === 'ACTIVE' || c.status === 'COMPLETED'),
    [allCampaigns],
  );

  const { data: templatesRes } = useFormTemplates();
  const allTemplates: any[] = (templatesRes as any)?.data ?? [];
  const templatesById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const tpl of allTemplates) m[tpl.id] = tpl;
    return m;
  }, [allTemplates]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c: any) => c.id === form.campaignId),
    [campaigns, form.campaignId],
  );

  const campaignTemplateIds: string[] = useMemo(() => {
    if (!selectedCampaign) return [];
    if (Array.isArray(selectedCampaign.templateIds) && selectedCampaign.templateIds.length > 0) {
      return selectedCampaign.templateIds;
    }
    if (selectedCampaign.templateId) return [selectedCampaign.templateId];
    return [];
  }, [selectedCampaign]);

  // When campaign changes, default-check all forms
  useEffect(() => {
    if (campaignTemplateIds.length > 0) {
      setForm((s) => ({ ...s, selectedFormIds: [...campaignTemplateIds] }));
    } else {
      setForm((s) => ({ ...s, selectedFormIds: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.campaignId]);

  // When domain changes, reset campaign + forms
  function changeDomain(d: string) {
    setForm((s) => ({ ...s, dataDomain: d, campaignId: '', selectedFormIds: [] }));
    setFieldErrors((e) => ({ ...e, campaignId: undefined, selectedFormIds: undefined }));
  }

  function toggleForm(id: string) {
    setForm((s) => ({
      ...s,
      selectedFormIds: s.selectedFormIds.includes(id)
        ? s.selectedFormIds.filter((x) => x !== id)
        : [...s.selectedFormIds, id],
    }));
    setFieldErrors((e) => ({ ...e, selectedFormIds: undefined }));
  }

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: undefined } as FieldErrors));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateStep(s: number): { errors: FieldErrors; firstMessage?: string } {
    const errors: FieldErrors = {};
    if (s === 1) {
      if (!form.recipientTenantId) errors.recipientTenantId = t('errors.recipientRequired');
      else if (form.recipientTenantId === user?.tenantId)
        errors.recipientTenantId = t('errors.recipientSameAsOwner');
      if (!form.title.trim()) errors.title = t('errors.titleRequired');
      else if (form.title.trim().length < 3) errors.title = t('errors.titleTooShort');
    }
    if (s === 2) {
      if (!form.campaignId) errors.campaignId = t('errors.campaignRequired');
      else if (form.selectedFormIds.length === 0)
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
    const scope: DataShareScope = {
      // We send formIds as the primary entity selector. Backend stores
      // dataScope as opaque JSON; the future preview/export proxy will use
      // these fields to filter the source domain service queries.
      entities: form.selectedFormIds,
      campaignId: form.campaignId,
      campaignName: selectedCampaign?.name,
      formIds: form.selectedFormIds,
    } as any;
    return {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
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
              label={t('wizard.recipientLabel')}
              required
              error={fieldErrors.recipientTenantId}
            >
              <select
                value={form.recipientTenantId}
                onChange={(e) => update('recipientTenantId', e.target.value)}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                  fieldErrors.recipientTenantId ? 'border-destructive' : 'border-input'
                }`}
              >
                <option value="">— {t('wizard.recipientPlaceholder')} —</option>
                {tenants
                  .filter((tn) => tn.id !== user?.tenantId)
                  .map((tn) => (
                    <option key={tn.id} value={tn.id}>
                      {tn.name} ({tn.level})
                    </option>
                  ))}
              </select>
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
            <Field label={t('wizard.domainLabel')} required>
              <select
                value={form.dataDomain}
                onChange={(e) => changeDomain(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DATA_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t('wizard.campaignLabel')}
              required
              error={fieldErrors.campaignId}
              hint={t('wizard.campaignHint')}
            >
              {campaignsLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {t('wizard.noCampaigns')}
                </div>
              ) : (
                <select
                  value={form.campaignId}
                  onChange={(e) => update('campaignId', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    fieldErrors.campaignId ? 'border-destructive' : 'border-input'
                  }`}
                >
                  <option value="">— {t('wizard.campaignPlaceholder')} —</option>
                  {campaigns.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.status === 'ACTIVE' ? t('campaign.active') : t('campaign.completed')}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {form.campaignId && (
              <Field
                label={t('wizard.formsLabel')}
                hint={t('wizard.formsHint')}
                error={fieldErrors.selectedFormIds}
              >
                <div
                  className={`divide-y rounded-md border ${
                    fieldErrors.selectedFormIds ? 'border-destructive' : 'border-input'
                  }`}
                >
                  {campaignTemplateIds.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      {t('wizard.noFormsInCampaign')}
                    </div>
                  ) : (
                    campaignTemplateIds.map((tplId) => {
                      const tpl = templatesById[tplId];
                      const checked = form.selectedFormIds.includes(tplId);
                      const tplName = tpl?.name ?? tplId;
                      return (
                        <label
                          key={tplId}
                          className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-accent/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleForm(tplId)}
                            className="mt-0.5 h-4 w-4 cursor-pointer"
                          />
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{tplName}</p>
                              {tpl && (
                                <p className="truncate text-xs text-muted-foreground">
                                  v{tpl.version} · {tpl.status}
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {campaignTemplateIds.length > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {form.selectedFormIds.length} / {campaignTemplateIds.length} {t('wizard.formsSelected')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => update('selectedFormIds', [...campaignTemplateIds])}
                        className="hover:text-foreground"
                      >
                        {t('wizard.selectAll')}
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => update('selectedFormIds', [])}
                        className="hover:text-foreground"
                      >
                        {t('wizard.deselectAll')}
                      </button>
                    </div>
                  </div>
                )}
              </Field>
            )}

            <Field label={t('wizard.classificationLabel')} required>
              <select
                value={form.dataClassification}
                onChange={(e) => update('dataClassification', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DATA_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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
              label={t('wizard.recipientLabel')}
              value={tenants.find((x) => x.id === form.recipientTenantId)?.name ?? form.recipientTenantId}
            />
            <SummaryRow label={t('wizard.titleLabel')} value={form.title} />
            {form.description && <SummaryRow label={t('wizard.descriptionLabel')} value={form.description} />}
            <SummaryRow label={t('wizard.domainLabel')} value={form.dataDomain} />
            <SummaryRow label={t('wizard.campaignLabel')} value={selectedCampaign?.name ?? '—'} />
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
