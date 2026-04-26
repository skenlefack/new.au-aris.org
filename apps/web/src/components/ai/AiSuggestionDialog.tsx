'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, X, Check, Pencil, AlertTriangle } from 'lucide-react';
import {
  useSuggestForm,
  useSuggestCampaign,
  useSuggestIndicator,
  useSuggestDashboard,
} from '@/lib/api/ai-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface AiSuggestionDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'form' | 'campaign' | 'indicator' | 'dashboard';
  onAccept: (draft: any) => void;
  context?: Record<string, any>;
}

// ─── Hook mapping ───────────────────────────────────────────────────────────

function useSuggestionMutation(type: AiSuggestionDialogProps['type']) {
  const suggestForm = useSuggestForm();
  const suggestCampaign = useSuggestCampaign();
  const suggestIndicator = useSuggestIndicator();
  const suggestDashboard = useSuggestDashboard();

  switch (type) {
    case 'form':
      return suggestForm;
    case 'campaign':
      return suggestCampaign;
    case 'indicator':
      return suggestIndicator;
    case 'dashboard':
      return suggestDashboard;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AiSuggestionDialog({
  open,
  onClose,
  type,
  onAccept,
  context,
}: AiSuggestionDialogProps) {
  const t = useTranslations('ai');
  const mutation = useSuggestionMutation(type);

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setResult(null);
    try {
      const response = await mutation.mutateAsync({
        prompt: prompt.trim(),
        context,
      });
      setResult(response.data ?? response);
    } catch {
      // Error is tracked by mutation.isError
    }
  }, [prompt, context, mutation]);

  const handleAccept = useCallback(() => {
    if (result) {
      onAccept(result);
      handleClose();
    }
  }, [result, onAccept]);

  const handleClose = useCallback(() => {
    setPrompt('');
    setResult(null);
    mutation.reset();
    onClose();
  }, [onClose, mutation]);

  if (!open) return null;

  const isLoading = mutation.isPending;
  const isError = mutation.isError;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-blue-50/30 p-6 shadow-2xl dark:border-gray-700 dark:from-gray-900 dark:via-gray-900 dark:to-[#1F4E79]/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F4E79]/10 to-[#C9A227]/10">
              <Sparkles className="h-5 w-5" style={{ color: '#C9A227' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('suggestWithAi')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(`suggestType_${type}`)}
              </p>
            </div>
          </div>

          {/* Prompt input */}
          <div className="mb-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('promptPlaceholder')}
              rows={3}
              disabled={isLoading}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
            />
            <p className="mt-1 text-[10px] text-gray-400">
              {t('promptHint')}
            </p>
          </div>

          {/* Generate button */}
          {!result && !isLoading && (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1F4E79] to-[#1F4E79]/90 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:from-[#163a5c] hover:to-[#163a5c]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="h-4 w-4" style={{ color: '#C9A227' }} />
              {t('generateWithAi')}
            </button>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-6 dark:border-blue-900/30 dark:bg-blue-900/10">
              <Loader2 className="h-6 w-6 animate-spin text-[#1F4E79]" />
              <p className="text-sm font-medium text-[#1F4E79]">
                {t('generating')}
              </p>
              {/* Progress bar */}
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
                <div className="h-full animate-ai-progress rounded-full bg-gradient-to-r from-[#1F4E79] to-[#C9A227]" />
              </div>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">{t('aiUnavailable')}</p>
                <p className="mt-0.5 text-xs opacity-80">{t('aiUnavailableHint')}</p>
              </div>
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('generatedPreview')}
              </label>
              <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Action buttons — shown after generation */}
          {result && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleClose}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                {t('reject')}
              </button>
              <button
                onClick={() => {
                  // Re-generate: reset result and allow editing prompt
                  setResult(null);
                  mutation.reset();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('modify')}
              </button>
              <button
                onClick={handleAccept}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#163a5c] transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                {t('accept')}
              </button>
            </div>
          )}

          {/* Error retry */}
          {isError && !result && (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/10 transition-colors"
            >
              {t('retry')}
            </button>
          )}
        </div>
      </div>

      {/* Animated progress bar keyframes — injected once */}
      <style jsx global>{`
        @keyframes ai-progress {
          0% { width: 0%; }
          50% { width: 70%; }
          90% { width: 90%; }
          100% { width: 95%; }
        }
        .animate-ai-progress {
          animation: ai-progress 8s ease-out forwards;
        }
      `}</style>
    </>
  );
}
