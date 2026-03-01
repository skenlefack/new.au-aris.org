'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAnalyzeFile,
  useImportDataset,
  type AnalysisResult,
} from '@/lib/api/historical-hooks';

const DOMAIN_OPTIONS = [
  { value: 'animal_health', label: 'Animal Health' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'fisheries', label: 'Fisheries' },
  { value: 'trade', label: 'Trade & SPS' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'apiculture', label: 'Apiculture' },
  { value: 'governance', label: 'Governance' },
  { value: 'climate', label: 'Climate & Env' },
  { value: 'general', label: 'General' },
];

const ACCEPTED_TYPES = '.xlsx,.xls,.csv,.tsv,.json';

type Step = 'upload' | 'preview' | 'configure' | 'importing';

export default function ImportDatasetPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('general');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const analyzeFile = useAnalyzeFile();
  const importDataset = useImportDataset();

  /* ---- Drop zone handlers ---- */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError('');

    // Auto-fill name from filename
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));

    // Analyze
    try {
      const result = await analyzeFile.mutateAsync(selectedFile);
      setAnalysis(result.data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    }
  };

  const handleImport = async () => {
    if (!file || !name || !domain) return;

    setStep('importing');
    setError('');

    try {
      const result = await importDataset.mutateAsync({
        file,
        name,
        domain,
        description: description || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      router.push(`/historical/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('configure');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Import Dataset</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload a file to analyze its structure and import it into the data lake
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'configure'] as const).map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-600">→</span>}
            <span className={`rounded-full px-3 py-1 ${
              step === s || (step === 'importing' && s === 'configure')
                ? 'bg-[var(--color-accent)] text-white'
                : step > s || (step === 'importing' && i < 2)
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 transition-colors hover:border-[var(--color-accent)] dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-[var(--color-accent)]"
        >
          <svg className="mb-3 h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Drop a file here or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Excel (.xlsx, .xls), CSV (.csv), TSV (.tsv), or JSON (.json) — max 50 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
          {analyzeFile.isPending && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-accent)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Analyzing file...
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && analysis && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">File Analysis</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">File</p>
                <p className="font-medium text-slate-900 dark:text-white">{file?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="font-medium uppercase text-slate-900 dark:text-white">{analysis.fileType}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Rows</p>
                <p className="font-medium text-slate-900 dark:text-white">{analysis.rowCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Columns</p>
                <p className="font-medium text-slate-900 dark:text-white">{analysis.columns.length}</p>
              </div>
            </div>
          </div>

          {/* Detected columns */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-white">Detected Columns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-500">#</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Column</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Nullable</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Samples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {analysis.columns.map((col, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-900 dark:text-white">{col.name}</td>
                      <td className="px-4 py-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-700">{col.dataType}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{col.nullable ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2 text-xs text-slate-400 truncate max-w-[200px]">
                        {col.sampleValues.slice(0, 3).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data preview */}
          {analysis.preview.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h3 className="font-medium text-slate-900 dark:text-white">Data Preview (first {Math.min(analysis.preview.length, 10)} rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {analysis.columns.slice(0, 8).map((col, i) => (
                        <th key={i} className="px-3 py-2 font-medium text-slate-500 whitespace-nowrap">{col.name}</th>
                      ))}
                      {analysis.columns.length > 8 && <th className="px-3 py-2 text-slate-400">...</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {analysis.preview.slice(0, 10).map((row, ri) => (
                      <tr key={ri}>
                        {analysis.columns.slice(0, 8).map((col, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[150px] truncate">
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                        {analysis.columns.length > 8 && <td className="px-3 py-1.5 text-slate-400">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setFile(null); setAnalysis(null); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Back
            </button>
            <button
              onClick={() => setStep('configure')}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Continue to Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure */}
      {(step === 'configure' || step === 'importing') && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dataset Information</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  placeholder="e.g. Kenya Cattle Census 2024"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  placeholder="Optional description of the dataset..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Domain *</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {DOMAIN_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  placeholder="e.g. cattle, census, 2024"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          {analysis && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/30">
              <p className="font-medium text-slate-700 dark:text-slate-300">Import Summary</p>
              <p className="mt-1 text-slate-500">
                {file?.name} — {analysis.rowCount.toLocaleString()} rows, {analysis.columns.length} columns ({analysis.fileType.toUpperCase()})
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('preview')}
              disabled={step === 'importing'}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={!name || !domain || step === 'importing'}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {step === 'importing' ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Importing...
                </>
              ) : (
                'Import Dataset'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
