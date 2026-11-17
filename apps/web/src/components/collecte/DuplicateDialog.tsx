'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, ShieldAlert, X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

export interface DuplicateCandidate {
  id: string;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string | null;
  status: string;
}

/** `duplicate` block of a 409 answer from POST /collecte/submissions. */
export interface DuplicateConflict {
  code: 'DUPLICATE_EXACT' | 'DUPLICATE_SUSPECTED' | 'DUPLICATE_BLOCKED';
  action: 'warn' | 'block' | null;
  candidates: DuplicateCandidate[];
}

/** Reads the duplicate details from an API error, or null for any other error. */
export function duplicateConflictOf(err: unknown): DuplicateConflict | null {
  const body = (err as { body?: { duplicate?: DuplicateConflict } } | null)?.body;
  const d = body?.duplicate;
  return d && Array.isArray(d.candidates) ? d : null;
}

/**
 * Shown when the server finds the fiche already exists (exact copy) or looks like existing fiches.
 * In "warn" mode the person can still send it, with a reason that reviewers will see.
 */
export function DuplicateDialog({ conflict, busy, onCancel, onConfirm }: {
  conflict: DuplicateConflict;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations('duplicates');
  const locale = useLocaleStore((s) => s.locale);
  const [reason, setReason] = useState('');
  const canOverride = conflict.code === 'DUPLICATE_SUSPECTED';
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
  };

  const title = conflict.code === 'DUPLICATE_EXACT' ? t('exactTitle')
    : conflict.code === 'DUPLICATE_BLOCKED' ? t('blockedTitle') : t('suspectedTitle');
  const body = conflict.code === 'DUPLICATE_EXACT' ? t('exactBody')
    : conflict.code === 'DUPLICATE_BLOCKED' ? t('blockedBody') : t('suspectedBody');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-start gap-3">
            {conflict.code === 'DUPLICATE_EXACT'
              ? <Copy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{body}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label={t('cancel')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('existingFiches', { count: conflict.candidates.length })}
            </p>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {conflict.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-gray-100">{fmt(c.submittedAt)}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {c.submittedByName ?? t('unknownAgent')} · {c.status}
                    </p>
                  </div>
                  <Link
                    href={`/collecte/submissions/${c.id}`}
                    target="_blank"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {t('open')} <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {canOverride && (
            <label className="block">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('reasonLabel')}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('reasonPlaceholder')}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900"
              />
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('reasonHint')}</span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {canOverride ? t('backToForm') : t('close')}
          </button>
          {canOverride && (
            <button
              type="button"
              disabled={busy || reason.trim().length < 5}
              onClick={() => onConfirm(reason.trim())}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('submitAnyway')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Random key identifying one filled form (letters and digits only). */
export function newClientKey(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '');
  } catch { /* insecure context */ }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
