'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useImportData } from '@/lib/api/hooks';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const ENTITY_OPTIONS = [
  { value: 'captures', labelKey: 'captures' },
  { value: 'vessels', labelKey: 'vesselRegistry' },
  { value: 'aquaculture-farms', labelKey: 'aquaFarms' },
  { value: 'production', labelKey: 'aquaProduction' },
  { value: 'efforts', labelKey: 'efforts' },
];

export default function ImportPage() {
  const t = useTranslations('fisheries');
  const [entity, setEntity] = useState('captures');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportData(entity);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('aris-auth') ?? '{}')?.state?.accessToken
        : null;
      const res = await fetch(`${API_BASE}/fisheries/${entity}/import/template`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Template download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Handle error silently
    }
  };

  const handleImport = async () => {
    if (!file) return;
    try {
      const res = await importMutation.mutateAsync(file);
      setResult(res?.data ?? { imported: 0, skipped: 0, errors: [] });
    } catch {
      setResult({ imported: 0, skipped: 0, errors: [{ row: 0, field: '-', message: 'Import failed' }] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/fisheries"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('import')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('importDesc')}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Entity selector */}
        <div className="rounded-card border border-gray-200 bg-white p-5">
          <label className="block text-sm font-medium text-gray-700">{t('selectEntity')}</label>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setFile(null);
              setResult(null);
            }}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownloadTemplate}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            <Download className="h-4 w-4" />
            {t('downloadTemplate')}
          </button>
        </div>

        {/* File upload */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed bg-white p-10 transition-colors',
            dragging
              ? 'border-teal-400 bg-teal-50'
              : 'border-gray-300 hover:border-gray-400',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className={cn('h-10 w-10', dragging ? 'text-teal-500' : 'text-gray-300')} />
          <p className="mt-3 text-sm font-medium text-gray-700">
            {t('dragDrop')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {t('supportedFormats')}
          </p>
        </div>

        {/* Selected file */}
        {file && (
          <div className="flex items-center justify-between rounded-card border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-teal-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setResult(null);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload button */}
        {file && !result && (
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('importing')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {t('uploadFile')}
              </>
            )}
          </button>
        )}

        {/* Import results */}
        {result && (
          <div className="space-y-4">
            <div className="rounded-card border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900">{t('importResult')}</h3>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                  <p className="text-xs text-green-600">{t('imported')}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                  <p className="text-xs text-yellow-600">{t('skipped')}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600">{t('errors')}</p>
                </div>
              </div>
            </div>

            {/* Error details table */}
            {result.errors.length > 0 && (
              <div className="overflow-hidden rounded-card border border-red-200 bg-white">
                <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <h4 className="text-sm font-medium text-red-700">{t('errorDetails')}</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('row')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('field')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('message')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {result.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{err.row}</td>
                          <td className="px-4 py-2 text-gray-700">{err.field}</td>
                          <td className="px-4 py-2 text-red-600">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reset button */}
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('uploadFile')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
