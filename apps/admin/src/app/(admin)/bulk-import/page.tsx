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
import {
  useBulkImportPreview,
  useBulkImportExecute,
  useTenants,
} from '@/lib/api/hooks';
import Link from 'next/link';

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
  const { data: tenantsData } = useTenants({ limit: 200 });
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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">Bulk Import</h1>
        <p className="text-sm text-admin-muted mt-1">
          Upload CSV files to import data into any service entity
        </p>
      </div>

      {/* Step Indicator */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-center gap-0">
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    idx === step
                      ? 'bg-primary-600 text-white'
                      : idx < step
                        ? 'bg-status-healthy text-white'
                        : 'bg-admin-surface text-admin-muted'
                  }`}
                >
                  {idx < step ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    idx === step
                      ? 'text-primary-400 font-medium'
                      : 'text-admin-muted'
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={`w-16 md:w-24 h-0.5 mx-2 mb-5 ${
                    idx < step ? 'bg-status-healthy' : 'bg-admin-surface'
                  }`}
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
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold text-admin-heading mb-4">
        Configure Import
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Service */}
        <div>
          <label className="block text-xs font-medium text-admin-muted mb-1">
            Service
          </label>
          <select
            value={service}
            onChange={(e) => onServiceChange(e.target.value)}
            className="admin-input w-full"
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
          <label className="block text-xs font-medium text-admin-muted mb-1">
            Entity Type
          </label>
          <select
            value={entity}
            onChange={(e) => onEntityChange(e.target.value)}
            className="admin-input w-full"
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
          <label className="block text-xs font-medium text-admin-muted mb-1">
            Tenant
          </label>
          <select
            value={tenantId}
            onChange={(e) => onTenantChange(e.target.value)}
            className="admin-input w-full"
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
        <label className="block text-xs font-medium text-admin-muted mb-1">
          CSV File
        </label>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary-500 bg-primary-900/10'
              : file
                ? 'border-status-healthy/50 bg-status-healthy/5'
                : 'border-admin-border hover:border-admin-muted'
          }`}
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
              <FileSpreadsheet className="w-8 h-8 text-status-healthy" />
              <p className="text-sm text-admin-text font-medium">{file.name}</p>
              <p className="text-xs text-admin-muted">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect(null);
                }}
                className="admin-btn-secondary text-xs mt-1"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-admin-muted" />
              <p className="text-sm text-admin-text">
                Drag and drop a CSV file here, or click to browse
              </p>
              <p className="text-xs text-admin-muted">Only .csv files accepted</p>
            </div>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="admin-btn-primary flex items-center gap-2 disabled:opacity-50"
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
      <div className="admin-card p-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-sm text-admin-muted">Analyzing CSV file...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-card p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <XCircle className="w-8 h-8 text-status-down" />
          <p className="text-sm text-status-down">Preview failed: {error?.message}</p>
        </div>
        <div className="flex justify-start mt-6">
          <button onClick={onBack} className="admin-btn-secondary flex items-center gap-2">
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
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <FileSpreadsheet className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Total Rows</p>
              <p className="text-kpi-sm text-admin-heading">{preview.totalRows}</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <CheckCircle className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Valid Rows</p>
              <p className="text-kpi-sm text-admin-heading">{preview.validRows}</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <AlertTriangle className="w-5 h-5 text-status-down" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Error Rows</p>
              <p className="text-kpi-sm text-admin-heading">{preview.errorRows}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Progress */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-admin-muted">Validation Rate</span>
          <span className="text-xs font-medium text-admin-text">
            {preview.totalRows > 0
              ? Math.round((preview.validRows / preview.totalRows) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="w-full bg-admin-surface rounded-full h-2">
          <div
            className="bg-status-healthy h-2 rounded-full"
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
      <div className="admin-card overflow-hidden">
        <div className="px-4 py-3 border-b border-admin-border">
          <h3 className="text-lg font-semibold text-admin-heading">
            Data Preview (First 10 Rows)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-admin-border">
                {preview.headers.map((header) => (
                  <th
                    key={header}
                    className="text-left text-xs font-medium text-admin-muted px-4 py-3"
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
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
                  {preview.headers.map((header) => (
                    <td
                      key={header}
                      className="px-4 py-2 text-xs text-admin-text font-mono whitespace-nowrap max-w-[200px] truncate"
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
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-admin-border">
            <h3 className="text-lg font-semibold text-admin-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-down" />
              Validation Errors ({preview.errors.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-admin-border">
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Row
                  </th>
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Field
                  </th>
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((err, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                  >
                    <td className="px-4 py-2 text-xs font-mono text-admin-text">
                      {err.row}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-down/10 text-status-down">
                        {err.field}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-admin-muted">
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
        <button onClick={onBack} className="admin-btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onProceed}
          className="admin-btn-primary flex items-center gap-2"
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
      <div className="admin-card p-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
          <p className="text-lg font-semibold text-admin-heading">Importing...</p>
          <p className="text-sm text-admin-muted">
            Please wait while your data is being processed
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-card p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <XCircle className="w-10 h-10 text-status-down" />
          <p className="text-lg font-semibold text-admin-heading">Import Failed</p>
          <p className="text-sm text-status-down">{error?.message}</p>
        </div>
        <div className="flex justify-center mt-6">
          <button onClick={onReset} className="admin-btn-primary">
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
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <FileSpreadsheet className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Total Processed</p>
              <p className="text-kpi-sm text-admin-heading">{result.totalProcessed}</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <CheckCircle className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Successful</p>
              <p className="text-kpi-sm text-admin-heading">{result.successCount}</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-900/30">
              <XCircle className="w-5 h-5 text-status-down" />
            </div>
            <div>
              <p className="text-xs text-admin-muted">Errors</p>
              <p className="text-kpi-sm text-admin-heading">{result.errorCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Progress Bar */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-admin-muted">Success Rate</span>
          <span className="text-xs font-medium text-admin-text">
            {result.totalProcessed > 0
              ? Math.round((result.successCount / result.totalProcessed) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="w-full bg-admin-surface rounded-full h-2">
          <div
            className="bg-status-healthy h-2 rounded-full"
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
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-admin-border">
            <h3 className="text-lg font-semibold text-admin-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-down" />
              Import Errors ({result.errors.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-admin-border">
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Row
                  </th>
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Field
                  </th>
                  <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((err, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                  >
                    <td className="px-4 py-2 text-xs font-mono text-admin-text">
                      {err.row}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-down/10 text-status-down">
                        {err.field}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-admin-muted">
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
        <button onClick={onReset} className="admin-btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import Another
        </button>
        <Link
          href="/audit"
          className="admin-btn-secondary flex items-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          View Audit Log
        </Link>
      </div>
    </div>
  );
}
