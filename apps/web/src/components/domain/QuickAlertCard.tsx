'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { collecteClient } from '@/lib/api/client';

export interface AlertField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface QuickAlertCardProps {
  domain: string;
  alertFields: AlertField[];
  title?: string;
}

export function QuickAlertCard({
  domain,
  alertFields,
  title = 'Quick Alert',
}: QuickAlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (result) setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      await collecteClient.post('/collecte/submissions', {
        domain,
        type: 'alert',
        data: values,
      });
      setResult('success');
      setValues({});
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 p-4 dark:border-gray-700">
          {result === 'success' && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Alert submitted successfully
            </div>
          )}
          {result === 'error' && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              Failed to submit alert. Please try again.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alertFields.map((field) => (
              <div
                key={field.name}
                className={cn(field.type === 'textarea' && 'sm:col-span-2')}
              >
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  >
                    <option value="">{field.placeholder ?? 'Select...'}</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Submitting...' : 'Submit Alert'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
