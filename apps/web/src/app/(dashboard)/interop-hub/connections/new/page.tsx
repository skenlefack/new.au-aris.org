'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Globe, Server, Database, Mail, FileText, Plug, Shield, Wifi } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import { useCreateHubConnection } from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const SYSTEM_TYPES = [
  { value: 'WAHIS', label: 'WAHIS (WOAH)', icon: Globe, color: 'from-blue-500 to-blue-600' },
  { value: 'DHIS2', label: 'DHIS2', icon: Database, color: 'from-cyan-500 to-blue-500' },
  { value: 'FHIR', label: 'FHIR / HL7', icon: Shield, color: 'from-red-500 to-pink-500' },
  { value: 'EMPRES', label: 'EMPRES-i', icon: Globe, color: 'from-orange-500 to-red-500' },
  { value: 'FAOSTAT', label: 'FAOSTAT', icon: Database, color: 'from-green-500 to-emerald-500' },
  { value: 'FISHSTATJ', label: 'FishStatJ', icon: Database, color: 'from-sky-500 to-blue-500' },
  { value: 'CITES', label: 'CITES', icon: Shield, color: 'from-purple-500 to-violet-500' },
  { value: 'CUSTOM_API', label: 'Custom API', icon: Plug, color: 'from-indigo-500 to-purple-500' },
  { value: 'FILE_EXCHANGE', label: 'File Exchange', icon: FileText, color: 'from-amber-500 to-orange-500' },
  { value: 'EMAIL', label: 'Email', icon: Mail, color: 'from-pink-500 to-rose-500' },
  { value: 'OTHER', label: 'Other', icon: Server, color: 'from-gray-500 to-gray-600' },
];

const DIRECTIONS = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'];
const TRANSPORT_TYPES = ['REST', 'SOAP', 'SFTP', 'KAFKA', 'EMAIL', 'FILE', 'CUSTOM'];
const AUTH_TYPES = ['NONE', 'BASIC', 'BEARER', 'API_KEY', 'OAUTH2', 'CERTIFICATE'];
const ARIS_DOMAINS = [
  { value: 'animal-health', color: 'from-red-500 to-rose-500' },
  { value: 'livestock-prod', color: 'from-amber-500 to-orange-500' },
  { value: 'fisheries', color: 'from-blue-500 to-cyan-500' },
  { value: 'wildlife', color: 'from-emerald-500 to-green-500' },
  { value: 'apiculture', color: 'from-yellow-500 to-amber-500' },
  { value: 'trade-sps', color: 'from-purple-500 to-violet-500' },
  { value: 'governance', color: 'from-indigo-500 to-blue-500' },
  { value: 'climate-env', color: 'from-teal-500 to-cyan-500' },
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
  name: '', description: '', direction: 'INBOUND', externalSystem: 'CUSTOM_API',
  transportType: 'REST', baseUrl: '', authType: 'NONE', credentials: {}, domains: [], config: {},
};

const STEPS = ['basic', 'endpoint', 'domains', 'review'] as const;

/* ── Page ─────────────────────────────────────────────────────── */

export default function NewConnectionPage() {
  const t = useTranslations('interopHub');
  const router = useRouter();
  const createMut = useCreateHubConnection();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');

  const update = useCallback((patch: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  function toggleDomain(d: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter((x) => x !== d)
        : [...prev.domains, d],
    }));
  }

  function goNext() {
    setSlideDir('right');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setSlideDir('left');
    if (step > 0) setStep((s) => s - 1);
    else router.push('/interop-hub/connections');
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
    } catch { /* error handled by mutation */ }
  }

  const canNext =
    step === 0 ? form.name.length > 0 :
    step === 1 ? true :
    step === 2 ? form.domains.length > 0 :
    true;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push('/interop-hub/connections')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('actions.back')}
      </button>

      {/* Title */}
      <h1 className="text-2xl font-bold tracking-tight">{t('connections.new')}</h1>

      {/* Horizontal step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                  i < step
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : i === step
                      ? 'border-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/50'
                      : 'border-2 border-border/50 text-muted-foreground bg-card/50'
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'hidden text-sm sm:block transition-colors',
                i === step ? 'font-semibold text-foreground' : 'text-muted-foreground'
              )}>
                {t(`wizard.${s}`)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-0.5 flex-1 rounded-full bg-border/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                  style={{ width: i < step ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step content in glass card */}
      <div className="overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div key={step} className={cn(
          'animate-in duration-300',
          slideDir === 'right' ? 'slide-in-from-right-4 fade-in' : 'slide-in-from-left-4 fade-in'
        )}>
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('wizard.basic')}</h2>

              {/* System type as icon grid */}
              <div>
                <label className="mb-2 block text-sm font-medium">{t('field.systemType')} <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {SYSTEM_TYPES.map((sys) => {
                    const SysIcon = sys.icon;
                    const active = form.externalSystem === sys.value;
                    return (
                      <button
                        key={sys.value}
                        type="button"
                        onClick={() => update({ externalSystem: sys.value })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all duration-200',
                          active
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-sm'
                            : 'border-border/50 hover:border-border hover:bg-accent/50'
                        )}
                      >
                        <div className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                          sys.color,
                          !active && 'opacity-60'
                        )}>
                          <SysIcon className="h-4 w-4" />
                        </div>
                        <span className={cn('text-xs', active ? 'font-semibold' : 'text-muted-foreground')}>
                          {sys.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <FloatingInput
                label={t('field.name')}
                required
                value={form.name}
                onChange={(v) => update({ name: v })}
                placeholder={t('placeholder.connectionName')}
              />

              <FloatingTextarea
                label={t('field.description')}
                value={form.description}
                onChange={(v) => update({ description: v })}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FloatingSelect
                  label={t('field.direction')}
                  required
                  value={form.direction}
                  onChange={(v) => update({ direction: v })}
                  options={DIRECTIONS.map((d) => ({ value: d, label: t(`direction.${d}`) }))}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('wizard.endpoint') || 'Endpoint'}</h2>

              <FloatingSelect
                label={t('field.transportType')}
                value={form.transportType}
                onChange={(v) => update({ transportType: v })}
                options={TRANSPORT_TYPES.map((tp) => ({ value: tp, label: tp }))}
              />

              <FloatingInput
                label={t('field.baseUrl')}
                value={form.baseUrl}
                onChange={(v) => update({ baseUrl: v })}
                placeholder="https://api.example.org/v1"
              />

              <FloatingSelect
                label={t('field.authType')}
                value={form.authType}
                onChange={(v) => update({ authType: v, credentials: {} })}
                options={AUTH_TYPES.map((a) => ({ value: a, label: a }))}
              />

              {form.authType === 'BASIC' && (
                <div className="grid grid-cols-2 gap-4">
                  <FloatingInput label={t('field.username')} value={form.credentials.username ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, username: v } })} />
                  <FloatingInput label={t('field.password')} type="password" value={form.credentials.password ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, password: v } })} />
                </div>
              )}
              {form.authType === 'API_KEY' && (
                <div className="grid grid-cols-2 gap-4">
                  <FloatingInput label={t('field.headerName')} value={form.credentials.headerName ?? 'X-API-Key'} onChange={(v) => update({ credentials: { ...form.credentials, headerName: v } })} />
                  <FloatingInput label={t('field.apiKey')} type="password" value={form.credentials.apiKey ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, apiKey: v } })} />
                </div>
              )}
              {form.authType === 'BEARER' && (
                <FloatingInput label={t('field.token')} type="password" value={form.credentials.token ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, token: v } })} />
              )}
              {form.authType === 'OAUTH2' && (
                <div className="grid grid-cols-2 gap-4">
                  <FloatingInput label={t('field.clientId')} value={form.credentials.clientId ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, clientId: v } })} />
                  <FloatingInput label={t('field.clientSecret')} type="password" value={form.credentials.clientSecret ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, clientSecret: v } })} />
                  <div className="col-span-2">
                    <FloatingInput label={t('field.tokenUrl')} value={form.credentials.tokenUrl ?? ''} onChange={(v) => update({ credentials: { ...form.credentials, tokenUrl: v } })} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('wizard.domains') || 'Domains'}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.domainsHint')}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ARIS_DOMAINS.map((d) => {
                  const active = form.domains.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDomain(d.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200',
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-sm'
                          : 'border-border/50 hover:border-border hover:bg-accent/50'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white text-sm font-bold',
                        d.color,
                        !active && 'opacity-50'
                      )}>
                        {d.value.charAt(0).toUpperCase()}
                      </div>
                      <span className={cn('text-xs text-center', active ? 'font-semibold' : 'text-muted-foreground')}>
                        {d.value}
                      </span>
                      {active && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('wizard.reviewTitle')}</h2>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <ReviewField label={t('field.name')} value={form.name} />
                  <ReviewField label={t('field.direction')} value={t(`direction.${form.direction}`)} />
                  <ReviewField label={t('field.systemType')} value={form.externalSystem} />
                  <ReviewField label={t('field.transportType')} value={form.transportType} />
                  <ReviewField label={t('field.baseUrl')} value={form.baseUrl || '-'} />
                  <ReviewField label={t('field.authType')} value={form.authType} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('field.domains')}</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {form.domains.map((d) => (
                      <span key={d} className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                {form.description && (
                  <div>
                    <span className="text-xs text-muted-foreground">{t('field.description')}</span>
                    <p className="mt-0.5 text-sm">{form.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-5 py-2.5 text-sm font-medium transition-all hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {step > 0 ? t('actions.previous') : t('actions.cancel')}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={goNext}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {t('actions.next')} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={createMut.isPending}
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-40"
          >
            {createMut.isPending ? t('actions.creating') : t('actions.create')}
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Form sub-components ──────────────────────────────────────── */

function FloatingInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FloatingTextarea({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <textarea
        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FloatingSelect({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <select
        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
