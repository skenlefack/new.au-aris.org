'use client';

// Data Sharing — 4-step wizard to create a new bilateral agreement.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X, Save, Send } from 'lucide-react';
import {
  useCreateDataShareAgreement,
  useSubmitDataShareAgreement,
  DATA_DOMAINS,
  DATA_CLASSIFICATIONS,
  type CreateDataShareAgreementDto,
  type DataShareScope,
} from '@/lib/api/data-sharing';
import { useTenantTree } from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

interface FormState {
  recipientTenantId: string;
  title: string;
  description: string;
  dataDomain: string;
  entities: string[];
  countries: string[];
  timeFrom: string;
  timeTo: string;
  dataClassification: string;
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
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    recipientTenantId: '',
    title: '',
    description: '',
    dataDomain: 'animal-health',
    entities: [],
    countries: [],
    timeFrom: '',
    timeTo: '',
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

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!form.recipientTenantId) return t('errors.recipientSameAsOwner');
      if (form.recipientTenantId === user?.tenantId)
        return t('errors.recipientSameAsOwner');
      if (!form.title.trim()) return t('errors.titleRequired');
    }
    if (s === 3) {
      if (!form.validFrom) return t('errors.validFromRequired');
      if (!form.purpose.trim()) return t('errors.purposeRequired');
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function buildPayload(): CreateDataShareAgreementDto {
    const scope: DataShareScope = {
      entities: form.entities,
      ...(form.countries.length || form.timeFrom || form.timeTo
        ? {
            geoFilter: form.countries.length ? { countries: form.countries } : undefined,
            timeRange:
              form.timeFrom || form.timeTo
                ? { from: form.timeFrom || undefined, to: form.timeTo || undefined }
                : undefined,
          }
        : {}),
    };
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

  async function saveDraft() {
    for (const s of [1, 2, 3]) {
      const e = validateStep(s);
      if (e) {
        setError(e);
        setStep(s);
        return;
      }
    }
    try {
      await create.mutateAsync(buildPayload());
      router.push('/data-sharing');
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    }
  }

  async function saveAndSubmit() {
    for (const s of [1, 2, 3]) {
      const e = validateStep(s);
      if (e) {
        setError(e);
        setStep(s);
        return;
      }
    }
    try {
      const created = await create.mutateAsync(buildPayload());
      await submit.mutateAsync(created.data.id);
      router.push(`/data-sharing/${created.data.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Error');
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

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        {step === 1 && (
          <div className="space-y-4">
            <Field label={t('wizard.recipientLabel')}>
              <select
                value={form.recipientTenantId}
                onChange={(e) => update('recipientTenantId', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {tenants
                  .filter((tn) => tn.id !== user?.tenantId)
                  .map((tn) => (
                    <option key={tn.id} value={tn.id}>
                      {tn.name} ({tn.level})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t('wizard.titleLabel')}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('wizard.descriptionLabel')}>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label={t('wizard.domainLabel')}>
              <select
                value={form.dataDomain}
                onChange={(e) => update('dataDomain', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DATA_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('wizard.entitiesLabel')}>
              <ChipsInput
                values={form.entities}
                onChange={(v) => update('entities', v)}
                placeholder="outbreaks, lab_results..."
              />
            </Field>
            <Field label={t('wizard.classificationLabel')}>
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
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('wizard.validFromLabel')}>
                <input
                  type="date"
                  value={form.timeFrom}
                  onChange={(e) => update('timeFrom', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('wizard.validUntilLabel')}>
                <input
                  type="date"
                  value={form.timeTo}
                  onChange={(e) => update('timeTo', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
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
              <Field label={t('wizard.validFromLabel')}>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => update('validFrom', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <Field label={t('wizard.purposeLabel')}>
              <textarea
                value={form.purpose}
                onChange={(e) => update('purpose', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <SummaryRow label={t('wizard.recipientLabel')} value={tenants.find((x) => x.id === form.recipientTenantId)?.name ?? form.recipientTenantId} />
            <SummaryRow label={t('wizard.titleLabel')} value={form.title} />
            {form.description && <SummaryRow label={t('wizard.descriptionLabel')} value={form.description} />}
            <SummaryRow label={t('wizard.domainLabel')} value={form.dataDomain} />
            <SummaryRow label={t('wizard.entitiesLabel')} value={form.entities.join(', ') || '—'} />
            <SummaryRow label={t('wizard.classificationLabel')} value={form.dataClassification} />
            <SummaryRow
              label={t('wizard.permissionsLabel')}
              value={[
                form.canConsult && t('wizard.canConsult'),
                form.canExport && t('wizard.canExport'),
                form.canModify && t('wizard.canModify'),
                form.canRedistribute && t('wizard.canRedistribute'),
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
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
