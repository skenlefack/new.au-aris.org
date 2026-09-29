'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  Columns, Target, Play, Upload as UploadIcon, AlertTriangle, Ban,
  RotateCw, ArrowRight, ArrowLeft, Check, Database, BarChart3,
  ChevronDown, ChevronUp, Eye, Pencil, FolderOpen, Plus, Search,
} from 'lucide-react';
import {
  useIngestFile, useIngestProfile, useIngestProposals, useIngestQualityReport,
  useIngestCampaigns,
  useConfirmMapping, useResolveCampaign, useStartDryRun, useCommitIngest, useCancelIngest,
} from '@/lib/api/ingest-hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';


// ── Types ──

interface ColumnProfileData {
  id: string;
  rawName: string;
  normalizedName: string;
  inferredType: string;
  cardinality: number;
  nullRate: number;
  sampleValues: string[];
  semanticConcept?: string;
  confidenceScore?: number;
}

interface FieldMappingData {
  id: string;
  sourceColumn: string;
  targetFieldCode: string;
  targetFieldLabel?: string;
  origin: string;
}

interface ProposalData {
  id: string;
  templateId: string;
  templateName: string;
  rank: number;
  scoreGlobal: number;
  scoreCoverage: number;
  scoreSemantic: number;
  scoreTypes: number;
  scoreReferentials: number;
  scoreHistory: number;
  status: string;
  fieldMappings: FieldMappingData[];
}

interface RowOutcomeData {
  id: string;
  rowIndex: number;
  status: string;
  reasons: string[] | null;
  idempotencyKey: string;
}

interface CampaignCandidate {
  id: string;
  code: string;
  name: string;
  domain: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

// ── Stepper Steps ──

const STEPS = [
  { key: 'profile', label: 'Profil', icon: Columns, description: 'Analyse des colonnes' },
  { key: 'mapping', label: 'Mapping', icon: Target, description: 'Correspondance des champs' },
  { key: 'campaign', label: 'Campagne', icon: FolderOpen, description: 'Destination des donnees' },
  { key: 'simulation', label: 'Simulation', icon: Play, description: 'Verification avant import' },
  { key: 'results', label: 'Resultats', icon: BarChart3, description: 'Rapport de qualite' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

// ── Status → Step mapping ──

function getActiveStep(status: string, hasReport: boolean): StepKey {
  switch (status) {
    case 'QUARANTINE':
    case 'PROFILING':
      return 'profile';
    case 'MATCHED':
      return 'mapping';
    case 'MAPPED':
      return 'campaign';
    case 'DRY_RUN':
      return hasReport ? 'results' : 'simulation';
    case 'COMMITTED':
      return 'results';
    default:
      return 'profile';
  }
}

function stepIndex(key: StepKey): number {
  return STEPS.findIndex((s) => s.key === key);
}

// ── Toast ──

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
      type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export default function IngestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;


  // ── Data fetching ──
  const { data: fileRes, refetch } = useIngestFile(fileId);
  const { data: profileRes } = useIngestProfile(fileId);
  const { data: proposalsRes } = useIngestProposals(fileId);
  const { data: reportRes } = useIngestQualityReport(fileId);
  const { data: campaignsRes } = useIngestCampaigns(fileId);

  // ── Mutations ──
  const confirmMut = useConfirmMapping();
  const resolveCampaignMut = useResolveCampaign();
  const dryRunMut = useStartDryRun();
  const commitMut = useCommitIngest();
  const cancelMut = useCancelIngest();

  // ── Extract data ──
  const file = (fileRes as any)?.data as Record<string, any> | undefined;
  const profile = (profileRes as any)?.data as Record<string, any> | undefined;
  const proposals = (((proposalsRes as any)?.data) ?? []) as ProposalData[];
  const report = (reportRes as any)?.data as Record<string, any> | undefined;
  const campaignsData = (campaignsRes as any)?.data as { campaigns: CampaignCandidate[]; derivedParams: any; resolution: any } | undefined;

  // ── Local state ──
  const [currentStep, setCurrentStep] = useState<StepKey>('profile');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({}); // sourceColumn → targetFieldCode
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createNewCampaign, setCreateNewCampaign] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [reportFilter, setReportFilter] = useState<string>('ALL');
  const [reportPage, setReportPage] = useState(0);
  const REPORT_PAGE_SIZE = 50;
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);

  // ── Auto-advance step when status changes ──
  const status = file?.status as string ?? 'QUARANTINE';
  const hasReport = !!report && report.status === 'COMPLETED';

  useEffect(() => {
    const target = getActiveStep(status, hasReport);
    setCurrentStep(target);
  }, [status, hasReport]);

  // ── Pre-select accepted proposal ──
  useEffect(() => {
    const accepted = proposals.find((p) => p.status === 'ACCEPTED');
    if (accepted && !selectedProposalId) {
      setSelectedProposalId(accepted.id);
    }
  }, [proposals, selectedProposalId]);

  // ── Pre-select existing campaign resolution ──
  useEffect(() => {
    if (campaignsData?.resolution?.campaignId && !selectedCampaignId) {
      setSelectedCampaignId(campaignsData.resolution.campaignId);
    }
  }, [campaignsData, selectedCampaignId]);

  if (!file) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  const canCancel = !['COMMITTED', 'CANCELLED'].includes(status);
  const sizeKb = Math.round(Number(file.fileSize) / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`;

  const columns = (profile?.columns as ColumnProfileData[]) ?? [];

  const selectedProposal = proposals.find((p) => p.id === selectedProposalId);
  const templateFields = selectedProposal?.fieldMappings ?? [];

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // ── Action handlers ──

  const handleAcceptMapping = async () => {
    if (!selectedProposalId) return;

    // Build corrections from edits
    const corrections = Object.entries(mappingEdits)
      .filter(([src, target]) => {
        const original = templateFields.find((m) => m.sourceColumn === src);
        return original && original.targetFieldCode !== target;
      })
      .map(([sourceColumn, targetFieldCode]) => ({ sourceColumn, targetFieldCode }));

    try {
      await confirmMut.mutateAsync({ fileId, proposalId: selectedProposalId, corrections });
      showToast('Mapping confirme avec succes', 'success');
      setCurrentStep('campaign');
    } catch (err: any) {
      showToast(err.message ?? 'Erreur lors de la confirmation du mapping', 'error');
    }
  };

  const handleResolveCampaign = async () => {
    try {
      await resolveCampaignMut.mutateAsync({
        fileId,
        campaignId: createNewCampaign ? undefined : (selectedCampaignId ?? undefined),
        isNewCampaign: createNewCampaign,
      });
      showToast('Campagne configuree', 'success');
      // Now trigger dry-run
      await dryRunMut.mutateAsync(fileId);
      showToast('Simulation lancee...', 'success');
      setCurrentStep('simulation');
    } catch (err: any) {
      showToast(err.message ?? 'Erreur', 'error');
    }
  };

  const handleCommit = async () => {
    try {
      await commitMut.mutateAsync(fileId);
      showToast('Chargement des donnees lance !', 'success');
    } catch (err: any) {
      showToast(err.message ?? 'Erreur lors du chargement', 'error');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync(fileId);
      setShowCancelDialog(false);
      router.push('/ingest');
    } catch (err: any) {
      showToast(err.message ?? 'Erreur', 'error');
    }
  };

  // ── Filter report rows ──
  const reportRows = (report?.rowOutcomes ?? []) as RowOutcomeData[];
  const filteredRows = reportFilter === 'ALL' ? reportRows : reportRows.filter((r) => r.status === reportFilter);
  const pagedRows = filteredRows.slice(reportPage * REPORT_PAGE_SIZE, (reportPage + 1) * REPORT_PAGE_SIZE);
  const reportTotalPages = Math.ceil(filteredRows.length / REPORT_PAGE_SIZE);

  // ── Navigation helpers ──
  const ci = stepIndex(currentStep);
  const canGoBack = ci > 0;
  const isTerminal = status === 'COMMITTED' || status === 'CANCELLED' || status === 'FAILED';

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3 dark:border-gray-700 dark:bg-gray-900/95 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/ingest" className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </Link>
            <FileSpreadsheet className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{file.filename}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-700">{file.domainCode}</span>
                <span>&middot;</span>
                <span>{sizeLabel}</span>
                <span>&middot;</span>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetch()} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" title="Rafraichir">
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            {canCancel && (
              <button onClick={() => setShowCancelDialog(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                <Ban className="h-3.5 w-3.5" /> Annuler
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30 sm:px-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = step.key === currentStep;
            const isDone = stepIndex(step.key) < stepIndex(getActiveStep(status, hasReport));
            const isClickable = stepIndex(step.key) <= stepIndex(getActiveStep(status, hasReport));
            return (
              <React.Fragment key={step.key}>
                {i > 0 && <div className={`hidden sm:block flex-1 h-px mx-2 ${isDone ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                <button
                  onClick={() => isClickable && setCurrentStep(step.key)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'text-gray-400 dark:text-gray-500'
                  } ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Error banner ── */}
      {file.errorMessage && (
        <div className="mx-4 mt-4 sm:mx-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{file.errorMessage}</p>
        </div>
      )}

      {/* ── Step Content ── */}
      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 space-y-5">

        {/* ═══ STEP 1: Profile ═══ */}
        {currentStep === 'profile' && (
          <>
            {(status === 'QUARANTINE' || status === 'PROFILING') && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Analyse du fichier en cours...</p>
                <p className="text-xs text-gray-400">Le profilage et le matching automatique sont en cours d&apos;execution.</p>
              </div>
            )}
            {profile && (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Columns className="h-4 w-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {profile.rowCount} lignes, {columns.length} colonnes detectees
                    </h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">#</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Colonne</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Type</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-500">Null %</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-500">Uniques</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Echantillon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {columns.map((col, i) => (
                        <tr key={col.id ?? i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{col.rawName}</td>
                          <td className="px-4 py-2">
                            <TypeBadge type={col.inferredType} />
                          </td>
                          <td className="px-4 py-2 text-center text-gray-500">{(col.nullRate * 100).toFixed(0)}%</td>
                          <td className="px-4 py-2 text-center text-gray-500">{col.cardinality}</td>
                          <td className="px-4 py-2 text-gray-500 max-w-[300px] truncate">{(col.sampleValues ?? []).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Next button */}
                {proposals.length > 0 && (
                  <div className="flex justify-end border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                    <button onClick={() => setCurrentStep('mapping')}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                      Suivant : Mapping <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 2: Mapping ═══ */}
        {currentStep === 'mapping' && (
          <>
            {/* Proposal selector */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-400" />
                  Formulaires candidats ({proposals.length})
                </h2>
                <p className="text-xs text-gray-500 mt-1">Selectionnez le formulaire cible, puis verifiez les correspondances de colonnes.</p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {proposals.map((p) => {
                  const score = p.scoreGlobal * 100;
                  const isSelected = p.id === selectedProposalId;
                  const isExpanded = expandedProposal === p.id;
                  return (
                    <div key={p.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <div className="flex items-center gap-3 px-5 py-3">
                        {/* Radio */}
                        <button onClick={() => { setSelectedProposalId(p.id); setMappingEdits({}); }}
                          className={`h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                          {isSelected && <div className="h-full w-full rounded-full border-2 border-white dark:border-gray-900" />}
                        </button>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.templateName}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>Couverture: {(p.scoreCoverage * 100).toFixed(0)}%</span>
                            <span>Types: {(p.scoreTypes * 100).toFixed(0)}%</span>
                            <span>Ref: {(p.scoreReferentials * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        {/* Score */}
                        <ScoreBadge score={score} />
                        {/* Expand */}
                        <button onClick={() => setExpandedProposal(isExpanded ? null : p.id)}
                          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>
                      </div>

                      {/* Expanded: show field mappings (read-only preview) */}
                      {isExpanded && (
                        <div className="px-5 pb-3">
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 max-h-64 overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left pb-1 font-semibold">Colonne source</th>
                                  <th className="text-center pb-1 font-semibold">→</th>
                                  <th className="text-left pb-1 font-semibold">Champ cible</th>
                                  <th className="text-left pb-1 font-semibold">Origine</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {p.fieldMappings.map((fm) => (
                                  <tr key={fm.id}>
                                    <td className="py-1.5 font-mono text-gray-900 dark:text-white">{fm.sourceColumn}</td>
                                    <td className="py-1.5 text-center text-gray-400">→</td>
                                    <td className="py-1.5 font-medium text-blue-700 dark:text-blue-400">{fm.targetFieldLabel ?? fm.targetFieldCode}</td>
                                    <td className="py-1.5">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${fm.origin === 'CORRECTED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{fm.origin}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mapping editor — editable table for selected proposal */}
            {selectedProposal && (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-gray-400" />
                    Editeur de mapping — {selectedProposal.templateName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Verifiez et corrigez les correspondances. Les champs modifies seront memorises pour les prochains imports.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500 w-[30%]">Colonne source</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500 w-[30%]">Type detecte</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-500 w-[5%]">→</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500 w-[30%]">Champ cible</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-500 w-[5%]">Etat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {columns.map((col) => {
                        const mapping = selectedProposal.fieldMappings.find((m) => m.sourceColumn === col.rawName);
                        const editedValue = mappingEdits[col.rawName];
                        const currentTarget = editedValue ?? mapping?.targetFieldCode ?? '';
                        const isEdited = editedValue !== undefined && editedValue !== (mapping?.targetFieldCode ?? '');
                        const isMatched = !!currentTarget;

                        return (
                          <tr key={col.rawName} className={`${isMatched ? '' : 'bg-amber-50/30 dark:bg-amber-900/5'}`}>
                            <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{col.rawName}</td>
                            <td className="px-4 py-2"><TypeBadge type={col.inferredType} /></td>
                            <td className="px-4 py-2 text-center text-gray-400">→</td>
                            <td className="px-4 py-2">
                              <select
                                value={currentTarget}
                                onChange={(e) => setMappingEdits((prev) => ({ ...prev, [col.rawName]: e.target.value }))}
                                className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                                  isEdited ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-600 dark:bg-gray-800'
                                }`}
                              >
                                <option value="">— Non mappe —</option>
                                {selectedProposal.fieldMappings.map((fm) => (
                                  <option key={fm.targetFieldCode} value={fm.targetFieldCode}>
                                    {fm.targetFieldLabel ?? fm.targetFieldCode}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isEdited ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">Modifie</span>
                              ) : isMatched ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                  <button onClick={() => setCurrentStep('profile')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                    <ArrowLeft className="h-3.5 w-3.5" /> Retour au profil
                  </button>
                  {status === 'MATCHED' ? (
                    <button onClick={handleAcceptMapping} disabled={confirmMut.isPending || !selectedProposalId}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      {confirmMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Confirmer le mapping
                    </button>
                  ) : (
                    <button onClick={() => setCurrentStep('campaign')}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                      Suivant : Campagne <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 3: Campaign ═══ */}
        {currentStep === 'campaign' && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-gray-400" />
                Destination des donnees
              </h2>
              <p className="text-xs text-gray-500 mt-1">Choisissez une campagne existante ou creez-en une nouvelle pour recevoir les donnees importees.</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Existing campaigns */}
              {(campaignsData?.campaigns ?? []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Campagnes compatibles</h3>
                  {(campaignsData?.campaigns ?? []).map((c: CampaignCandidate) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCampaignId(c.id); setCreateNewCampaign(false); }}
                      className={`flex items-center w-full gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedCampaignId === c.id && !createNewCampaign
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      <Database className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.code} &middot; {c.domain} &middot; {c.status}</p>
                      </div>
                      {selectedCampaignId === c.id && !createNewCampaign && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Create new */}
              <button
                onClick={() => { setCreateNewCampaign(true); setSelectedCampaignId(null); }}
                className={`flex items-center w-full gap-3 rounded-lg border p-3 text-left transition-colors ${
                  createNewCampaign
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 border-dashed hover:border-gray-300 dark:border-gray-700'
                }`}
              >
                <Plus className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Creer une nouvelle campagne</p>
                  {campaignsData?.derivedParams && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {campaignsData.derivedParams.name?.fr ?? campaignsData.derivedParams.name?.en} &middot; {campaignsData.derivedParams.startDate} → {campaignsData.derivedParams.endDate}
                    </p>
                  )}
                </div>
                {createNewCampaign && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <button onClick={() => setCurrentStep('mapping')}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                <ArrowLeft className="h-3.5 w-3.5" /> Retour au mapping
              </button>
              <button
                onClick={handleResolveCampaign}
                disabled={resolveCampaignMut.isPending || dryRunMut.isPending || (!selectedCampaignId && !createNewCampaign)}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {(resolveCampaignMut.isPending || dryRunMut.isPending) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Lancer la simulation
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Simulation (waiting) ═══ */}
        {currentStep === 'simulation' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
              <Play className="h-5 w-5 text-purple-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Simulation en cours...</h2>
            <p className="text-sm text-gray-500 max-w-md text-center">
              Chaque ligne est validee, transformee et verifiee contre les doublons. Les resultats apparaitront automatiquement.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Actualisation automatique toutes les 5 secondes
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Results ═══ */}
        {currentStep === 'results' && (
          <>
            {/* Summary cards */}
            {report && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ResultCard label="Acceptees" value={report.acceptedRows as number} color="emerald" />
                <ResultCard label="Rejetees" value={report.rejectedRows as number} color="red" />
                <ResultCard label="Avertissements" value={report.warningRows as number} color="amber" />
                <ResultCard label="Doublons" value={report.duplicateRows as number} color="gray" />
              </div>
            )}

            {/* Detailed row outcomes */}
            {reportRows.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Detail des lignes ({filteredRows.length})</h2>
                  <div className="flex items-center gap-1">
                    {['ALL', 'ACCEPTED', 'REJECTED', 'WARNING', 'DUPLICATE'].map((f) => (
                      <button key={f} onClick={() => { setReportFilter(f); setReportPage(0); }}
                        className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                          reportFilter === f
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}>
                        {f === 'ALL' ? 'Tout' : f === 'ACCEPTED' ? 'OK' : f === 'REJECTED' ? 'Rejet' : f === 'WARNING' ? 'Warn' : 'Dupl'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Ligne</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Statut</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Raison</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Cle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {pagedRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{row.rowIndex + 1}</td>
                          <td className="px-4 py-2"><RowStatusBadge status={row.status} /></td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 max-w-[400px]">
                            {row.reasons ? (Array.isArray(row.reasons) ? row.reasons.join('; ') : JSON.stringify(row.reasons)) : '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-400 font-mono text-[10px] max-w-[120px] truncate">{row.idempotencyKey}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {reportTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2 dark:border-gray-800">
                    <span className="text-xs text-gray-500">Page {reportPage + 1} / {reportTotalPages}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setReportPage((p) => Math.max(0, p - 1))} disabled={reportPage === 0}
                        className="rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800">&lt; Prec</button>
                      <button onClick={() => setReportPage((p) => Math.min(reportTotalPages - 1, p + 1))} disabled={reportPage >= reportTotalPages - 1}
                        className="rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800">Suiv &gt;</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Commit button */}
            {status === 'DRY_RUN' && hasReport && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Pret a charger</h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                    {report?.acceptedRows ?? 0} lignes seront importees dans la campagne.
                  </p>
                </div>
                <button onClick={handleCommit} disabled={commitMut.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
                  {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
                  Charger les donnees
                </button>
              </div>
            )}

            {/* Committed success */}
            {status === 'COMMITTED' && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import termine !</h3>
                <p className="text-sm text-gray-500">{report?.acceptedRows ?? 0} lignes chargees avec succes.</p>
                <Link href="/ingest" className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                  <ArrowLeft className="h-3.5 w-3.5" /> Retour aux imports
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Dialogs & Toast ── */}
      <ConfirmDialog open={showCancelDialog} title="Annuler l'import" message="Le fichier sera supprime et l'import annule." confirmLabel="Annuler l'import" variant="danger" loading={cancelMut.isPending} onConfirm={handleCancel} onCancel={() => setShowCancelDialog(false)} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    QUARANTINE: { label: 'En attente', color: 'bg-gray-100 text-gray-600' },
    PROFILING: { label: 'Profilage...', color: 'bg-blue-100 text-blue-700' },
    MATCHED: { label: 'Mapping requis', color: 'bg-indigo-100 text-indigo-700' },
    MAPPED: { label: 'Mappe', color: 'bg-amber-100 text-amber-700' },
    DRY_RUN: { label: 'Simulation', color: 'bg-purple-100 text-purple-700' },
    COMMITTED: { label: 'Charge', color: 'bg-emerald-100 text-emerald-700' },
    FAILED: { label: 'Echoue', color: 'bg-red-100 text-red-700' },
    CANCELLED: { label: 'Annule', color: 'bg-gray-100 text-gray-500' },
  };
  const c = config[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text: 'bg-gray-100 text-gray-600',
    integer: 'bg-blue-100 text-blue-700',
    decimal: 'bg-cyan-100 text-cyan-700',
    date: 'bg-purple-100 text-purple-700',
    boolean: 'bg-amber-100 text-amber-700',
    email: 'bg-pink-100 text-pink-700',
    phone: 'bg-indigo-100 text-indigo-700',
    coordinate: 'bg-emerald-100 text-emerald-700',
    uuid: 'bg-orange-100 text-orange-700',
    select: 'bg-teal-100 text-teal-700',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>{type}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${color}`}>{score.toFixed(0)}%</span>;
}

function ResultCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400',
    gray: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  const labelColorMap: Record<string, string> = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    gray: 'text-gray-500',
  };
  return (
    <div className={`rounded-lg p-4 text-center ${colorMap[color]}`}>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      <p className={`text-[11px] mt-1 ${labelColorMap[color]}`}>{label}</p>
    </div>
  );
}

function RowStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    ACCEPTED: { label: 'OK', color: 'bg-emerald-100 text-emerald-700' },
    REJECTED: { label: 'Rejete', color: 'bg-red-100 text-red-700' },
    WARNING: { label: 'Alerte', color: 'bg-amber-100 text-amber-700' },
    DUPLICATE: { label: 'Doublon', color: 'bg-gray-100 text-gray-600' },
  };
  const c = config[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}>{c.label}</span>;
}
