'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import {
  useCreateTicket,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/api/support-hooks';
import { useTranslations } from '@/lib/i18n/translations';

interface FormState {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

interface FieldErrors {
  title?: string;
  description?: string;
  category?: string;
}

export default function NewTicketPage() {
  const t = useTranslations('support');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const create = useCreateTicket();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.title.trim()) errors.title = t('errors.titleRequired');
    else if (form.title.trim().length < 3) errors.title = t('errors.titleTooShort');
    if (!form.description.trim()) errors.description = t('errors.descriptionRequired');
    else if (form.description.trim().length < 10) errors.description = t('errors.descriptionTooShort');
    return errors;
  }

  async function handleSubmit() {
    setGlobalError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setGlobalError(Object.values(errors)[0]!);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ }
      return;
    }

    try {
      await create.mutateAsync(form);
      router.push('/support');
    } catch (err: any) {
      setGlobalError(err?.message ?? t('errors.createFailed'));
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">{t('newTicket')}</h1>

      {/* Global error */}
      {globalError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-5">
        {/* Title */}
        <Field label={t('form.titleLabel')} required error={fieldErrors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder={t('form.titlePlaceholder')}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
              fieldErrors.title ? 'border-destructive' : 'border-input'
            }`}
          />
        </Field>

        {/* Category + Priority (side by side) */}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('form.categoryLabel')} required error={fieldErrors.category}>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value as TicketCategory)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c.toLowerCase()}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('form.priorityLabel')}>
            <select
              value={form.priority}
              onChange={(e) => update('priority', e.target.value as TicketPriority)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`priority.${p.toLowerCase()}`)}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Description */}
        <Field label={t('form.descriptionLabel')} required error={fieldErrors.description}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={6}
            placeholder={t('form.descriptionPlaceholder')}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
              fieldErrors.description ? 'border-destructive' : 'border-input'
            }`}
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
        >
          {tCommon('cancel')}
        </Link>
        <button
          onClick={handleSubmit}
          disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tCommon('loading')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {tCommon('submit')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
