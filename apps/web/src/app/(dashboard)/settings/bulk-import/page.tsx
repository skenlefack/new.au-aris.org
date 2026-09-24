'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';

// ── Auth helper for FormData uploads ──

const BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/api/v1';

function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.state?.accessToken ?? null;
  } catch { return null; }
}

// ── Types ──

interface BulkImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  headers: string[];
  preview: Record<string, string>[];
  errors: Array<{ row: number; field: string; message: string }>;
}

interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// ── Inline Hooks ──

function useTenants() {
  return useQuery<{ data: Array<{ id: string; name: string; code: string; level: string }> }>({
    queryKey: ['tenants'],
    queryFn: () => apiClient.get('/tenants?limit=200'),
  });
}

function useBulkImportPreview() {
  return useMutation<BulkImportPreview, Error, { service: string; entity: string; file: File }>({
    mutationFn: async ({ service, entity, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('service', service);
      formData.append('entity', entity);
      const token = getToken();
      const res = await fetch(
        `${BASE_URL}/admin/bulk-import/preview`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
      const json = await res.json();
      return json.data ?? json;
    },
  });
}

function useBulkImportExecute() {
  return useMutation<BulkImportResult, Error, { service: string; entity: string; file: File; tenantId: string }>({
    mutationFn: async ({ service, entity, file, tenantId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('service', service);
      formData.append('entity', entity);
      formData.append('tenantId', tenantId);
      const token = getToken();
      const res = await fetch(
        `${BASE_URL}/admin/bulk-import/execute`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      const json = await res.json();
      return json.data ?? json;
    },
  });
}

// ── Service / Entity mappings ──

const SERVICE_OPTIONS = [
  'animal-health',
  'livestock-prod',
  'fisheries',
  'wildlife',
  'apiculture',
  'trade-sps',
  'governance',
  'climate-env',
  'master-data',
] as const;

const ENTITY_MAP: Record<string, string[]> = {
  'animal-health': ['healthEvent', 'labResult', 'surveillanceActivity', 'vaccinationCampaign'],
  'livestock-prod': ['livestockCensus', 'productionRecord', 'slaughterRecord'],
  fisheries: ['fishCapture', 'fishingVessel', 'aquacultureFarm'],
  wildlife: ['wildlifeInventory', 'protectedArea', 'citesPermit', 'wildlifeCrime'],
  'trade-sps': ['tradeFlow', 'spsCertificate', 'marketPrice'],
  apiculture: ['apiary', 'honeyProduction', 'colonyHealth'],
  governance: ['legalFramework', 'institutionalCapacity', 'pVSEvaluation', 'stakeholderRegistry'],
  'climate-env': ['waterStressIndex', 'rangelandCondition', 'environmentalHotspot', 'climateDataPoint'],
  'master-data': ['species', 'disease', 'geoEntity', 'unit'],
};

const STEP_LABELS = ['Configure', 'Preview', 'Import'] as const;

// ── Main Page ──

export default function BulkImportPage() {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 1 state
  const [service, setService] = useState('');
  const [entity, setEntity] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: tenantsData } = useTenants();
  const tenants = tenantsData?.data ?? [];

  const previewMutation = useBulkImportPreview();
  const executeMutation = useBulkImportExecute();

  const entityOptions = service ? ENTITY_MAP[service] ?? [] : [];

  // Reset entity when service changes
  const handleServiceChange = useCallback((val: string) => {
    setService(val);
    setEntity('');
  }, []);

  // File handling
  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0] ?? null;
      handleFileSelect(droppedFile);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Step transitions
  const canProceedToPreview = service && entity && tenantId && file;

  const goToPreview = useCallback(() => {
    if (!service || !entity || !file) return;
    previewMutation.mutate({ service, entity, file });
    setStep(1);
  }, [service, entity, file, previewMutation]);

  const goToImport = useCallback(() => {
    if (!service || !entity || !file || !tenantId) return;
    executeMutation.mutate({ service, entity, file, tenantId });
    setStep(2);
  }, [service, entity, file, tenantId, executeMutation]);

  const resetWizard = useCallback(() => {
    setStep(0);
    setService('');
    setEntity('');
    setTenantId('');
    setFile(null);
    previewMutation.reset();
    executeMutation.reset();
  }, [previewMutation, executeMutation]);

  return (
    <div className="space-y-6">
      <SettingsBackButton />
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Import</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload CSV files to import data into any service entity
        </p>
      </div>

      {/* Step Indicator */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-center gap-0">
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                    idx === step
                      ? 'bg-aris-primary-600 text-white'
                      : idx < step
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                  )}
                >
                  {idx < step ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1',
                    idx === step
                      ? 'text-aris-primary-600 dark:text-aris-primary-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    'w-16 md:w-24 h-0.5 mx-2 mb-5',
                    idx < step ? 'bg-green-500' : 'bg-gray-100 dark:bg-gray-800',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {step === 0 && (
        <StepConfigure
          service={service}
          entity={entity}
          tenantId={tenantId}
          file={file}
          dragOver={dragOver}
          entityOptions={entityOptions}
          tenants={tenants}
          fileInputRef={fileInputRef}
          onServiceChange={handleServiceChange}
          onEntityChange={setEntity}
          onTenantChange={setTenantId}
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          canProceed={!!canProceedToPreview}
          onNext={goToPreview}
        />
      )}

      {step === 1 && (
        <StepPreview
          previewMutation={previewMutation}
          onBack={() => setStep(0)}
          onProceed={goToImport}
        />
      )}

      {step === 2 && (
        <StepImport
          executeMutation={executeMutation}
          onReset={resetWizard}
        />
      )}
    </div>
  );
}

// ── Step 1: Configure ──

function StepConfigure({
  service,
  entity,
  tenantId,
  file,
  dragOver,
  entityOptions,
  tenants,
  fileInputRef,
  onServiceChange,
  onEntityChange,
  onTenantChange,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  canProceed,
  onNext,
}: {
  service: string;
  entity: string;
  tenantId: string;
  file: File | null;
  dragOver: boolean;
  entityOptions: string[];
  tenants: Array<{ id: string; name: string; code: string; level: string }>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onServiceChange: (val: string) => void;
  onEntityChange: (val: string) => void;
  onTenantChange: (val: string) => void;
  onFileSelect: (file: File | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  canProceed: boolean;
  onNext: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Configure Import
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Service */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Service
          </label>
          <select
            value={service}
            onChange={(e) => onServiceChange(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
          >
            <option value="">Select service...</option>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Entity Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Entity Type
          </label>
          <select
            value={entity}
            onChange={(e) => onEntityChange(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
            disabled={!service}
          >
            <option value="">Select entity...</option>
            {entityOptions.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>

        {/* Tenant */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Tenant
          </label>
          <select
            value={tenantId}
            onChange={(e) => onTenantChange(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
          >
            <option value="">Select tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code}) - {t.level}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* File Upload Dropzone */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          CSV File
        </label>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-aris-primary-500 bg-aris-primary-50 dark:bg-aris-primary-900/10'
              : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-400',
          )}
        >
          <input
            ref={fileInputRef as React.RefObject<HTMLInputElement>}
            type="file"
            accept=".csv"
            onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{file.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs mt-1"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Drag and drop a CSV file here, or click to browse
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Only .csv files accepted</p>
            </div>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          Preview
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Preview ──

function StepPreview({
  previewMutation,
  onBack,
  onProceed,
}: {
  previewMutation: ReturnType<typeof useBulkImportPreview>;
  onBack: () => void;
  onProceed: () => void;
}) {
  const { data: preview, isPending, isError, error } = previewMutation;

  if (isPending) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-8 h-8 text-aris-primary-600 dark:text-aris-primary-400 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing CSV file...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">Preview failed: {error?.message}</p>
        </div>
        <div className="flex justify-start mt-6">
          <button onClick={onBack} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-4">
      {/* Validation KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <FileSpreadsheet className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Rows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{preview.totalRows}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Valid Rows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{preview.validRows}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Error Rows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{preview.errorRows}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Progress */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Validation Rate</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {preview.totalRows > 0
              ? Math.round((preview.validRows / preview.totalRows) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{
              width: `${
                preview.totalRows > 0
                  ? (preview.validRows / preview.totalRows) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Preview Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data Preview (First 10 Rows)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {preview.headers.map((header) => (
                  <th
                    key={header}
                    className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.preview.slice(0, 10).map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {preview.headers.map((header) => (
                    <td
                      key={header}
                      className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap max-w-[200px] truncate"
                    >
                      {row[header] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Errors Table */}
      {preview.errors.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Validation Errors ({preview.errors.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Row
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Field
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((err, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-xs font-mono text-gray-700 dark:text-gray-300">
                      {err.row}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
                        {err.field}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {err.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onProceed}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          Proceed to Import
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Import ──

function StepImport({
  executeMutation,
  onReset,
}: {
  executeMutation: ReturnType<typeof useBulkImportExecute>;
  onReset: () => void;
}) {
  const { data: result, isPending, isError, error } = executeMutation;

  if (isPending) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-aris-primary-600 dark:text-aris-primary-400 animate-spin" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Importing...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please wait while your data is being processed
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Import Failed</p>
          <p className="text-sm text-red-600 dark:text-red-400">{error?.message}</p>
        </div>
        <div className="flex justify-center mt-6">
          <button onClick={onReset} className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors">
            Import Another
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Result KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <FileSpreadsheet className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.totalProcessed}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.successCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Errors</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.errorCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Progress Bar */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Success Rate</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {result.totalProcessed > 0
              ? Math.round((result.successCount / result.totalProcessed) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{
              width: `${
                result.totalProcessed > 0
                  ? (result.successCount / result.totalProcessed) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Error Details */}
      {result.errors.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Import Errors ({result.errors.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Row
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Field
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((err, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-xs font-mono text-gray-700 dark:text-gray-300">
                      {err.row}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
                        {err.field}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {err.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onReset} className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import Another
        </button>
        <Link
          href="/settings/audit"
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          View Audit Log
        </Link>
      </div>
    </div>
  );
}
