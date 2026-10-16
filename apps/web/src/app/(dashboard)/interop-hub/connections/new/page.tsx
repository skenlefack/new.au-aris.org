'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useCreateHubConnection } from '@/lib/api/hub-hooks';

const SYSTEM_TYPES = ['WAHIS', 'DHIS2', 'FHIR', 'EMPRES', 'FAOSTAT', 'FISHSTATJ', 'CITES', 'CUSTOM_API', 'FILE_EXCHANGE', 'EMAIL', 'OTHER'];
const DIRECTIONS = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const TRANSPORT_TYPES = ['REST', 'SOAP', 'SFTP', 'KAFKA', 'EMAIL', 'FILE', 'CUSTOM'];
const AUTH_TYPES = ['NONE', 'BASIC', 'BEARER', 'API_KEY', 'OAUTH2', 'CERTIFICATE'];
const ARIS_DOMAINS = [
  'animal-health', 'livestock-prod', 'fisheries', 'wildlife',
  'apiculture', 'trade-sps', 'governance', 'climate-env',
];

interface FormData {
  name: string;
  description: string;
  direction: string;
  externalSystem: string;
  transportType: string;
  baseUrl: string;
  authType: string;
  credentials: Record<string, string>;
  domains: string[];
  config: Record<string, unknown>;
}

const INITIAL: FormData = {
  name: '',
  description: '',
  direction: 'INBOUND',
  externalSystem: 'CUSTOM_API',
  transportType: 'REST',
  baseUrl: '',
  authType: 'NONE',
  credentials: {},
  domains: [],
  config: {},
};

const STEPS = ['basic', 'endpoint', 'domains', 'review'] as const;

export default function NewConnectionPage() {
  const t = useTranslations('interopHub');
  const router = useRouter();
  const createMut = useCreateHubConnection();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);

  function update(patch: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleDomain(d: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter((x) => x !== d)
        : [...prev.domains, d],
    }));
  }

  async function handleCreate() {
    try {
      await createMut.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        direction: form.direction as any,
        externalSystem: form.externalSystem,
        transportType: form.transportType as any,
        baseUrl: form.baseUrl || undefined,
        authType: form.authType as any,
        credentials: Object.keys(form.credentials).length > 0 ? form.credentials : undefined,
        config: { domains: form.domains },
      });
      router.push('/interop-hub/connections');
    } catch {
      // error handled by mutation
    }
  }

  const canNext =
    step === 0 ? form.name.length > 0 :
    step === 1 ? true :
    step === 2 ? form.domains.length > 0 :
    true;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/interop-hub/connections')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('actions.back')}
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{t('connections.new')}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'border-2 border-primary text-primary' :
                'border border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {t(`wizard.${s}`)}
            </span>
            {i < STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-lg border bg-card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <FieldGroup label={t('field.name')} required>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={t('placeholder.connectionName')}
              />
            </FieldGroup>
            <FieldGroup label={t('field.description')}>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t('field.direction')} required>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.direction}
                  onChange={(e) => update({ direction: e.target.value })}
                >
                  {DIRECTIONS.map((d) => (
                    <option key={d} value={d}>{t(`direction.${d}`)}</option>
                  ))}
                </select>
              </FieldGroup>
              <FieldGroup label={t('field.systemType')} required>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.externalSystem}
                  onChange={(e) => update({ externalSystem: e.target.value })}
                >
                  {SYSTEM_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FieldGroup>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <FieldGroup label={t('field.transportType')}>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.transportType}
                onChange={(e) => update({ transportType: e.target.value })}
              >
                {TRANSPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup label={t('field.baseUrl')}>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder="https://api.example.org/v1"
              />
            </FieldGroup>
            <FieldGroup label={t('field.authType')}>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.authType}
                onChange={(e) => update({ authType: e.target.value, credentials: {} })}
              >
                {AUTH_TYPES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </FieldGroup>

            {form.authType === 'BASIC' && (
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label={t('field.username')}>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.username ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, username: e.target.value } })}
                  />
                </FieldGroup>
                <FieldGroup label={t('field.password')}>
                  <input
                    type="password"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.password ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, password: e.target.value } })}
                  />
                </FieldGroup>
              </div>
            )}
            {form.authType === 'API_KEY' && (
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label={t('field.headerName')}>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.headerName ?? 'X-API-Key'}
                    onChange={(e) => update({ credentials: { ...form.credentials, headerName: e.target.value } })}
                  />
                </FieldGroup>
                <FieldGroup label={t('field.apiKey')}>
                  <input
                    type="password"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.apiKey ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, apiKey: e.target.value } })}
                  />
                </FieldGroup>
              </div>
            )}
            {form.authType === 'BEARER' && (
              <FieldGroup label={t('field.token')}>
                <input
                  type="password"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.credentials.token ?? ''}
                  onChange={(e) => update({ credentials: { ...form.credentials, token: e.target.value } })}
                />
              </FieldGroup>
            )}
            {form.authType === 'OAUTH2' && (
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label={t('field.clientId')}>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.clientId ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, clientId: e.target.value } })}
                  />
                </FieldGroup>
                <FieldGroup label={t('field.clientSecret')}>
                  <input
                    type="password"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.clientSecret ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, clientSecret: e.target.value } })}
                  />
                </FieldGroup>
                <FieldGroup label={t('field.tokenUrl')}>
                  <input
                    className="col-span-2 w-full rounded-md border px-3 py-2 text-sm"
                    value={form.credentials.tokenUrl ?? ''}
                    onChange={(e) => update({ credentials: { ...form.credentials, tokenUrl: e.target.value } })}
                  />
                </FieldGroup>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('wizard.domainsHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              {ARIS_DOMAINS.map((d) => (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    form.domains.includes(d) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.domains.includes(d)}
                    onChange={() => toggleDomain(d)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">{d}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">{t('wizard.reviewTitle')}</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <ReviewField label={t('field.name')} value={form.name} />
              <ReviewField label={t('field.direction')} value={t(`direction.${form.direction}`)} />
              <ReviewField label={t('field.systemType')} value={form.externalSystem} />
              <ReviewField label={t('field.transportType')} value={form.transportType} />
              <ReviewField label={t('field.baseUrl')} value={form.baseUrl || '-'} />
              <ReviewField label={t('field.authType')} value={form.authType} />
              <div className="col-span-2">
                <ReviewField label={t('field.domains')} value={form.domains.join(', ')} />
              </div>
              {form.description && (
                <div className="col-span-2">
                  <ReviewField label={t('field.description')} value={form.description} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(step - 1) : router.push('/interop-hub/connections')}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {step > 0 ? t('actions.previous') : t('actions.cancel')}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('actions.next')} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={createMut.isPending}
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMut.isPending ? t('actions.creating') : t('actions.create')}
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
