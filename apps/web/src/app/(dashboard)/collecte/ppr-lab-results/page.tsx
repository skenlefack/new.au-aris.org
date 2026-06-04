'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Save,
  Loader2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFormBuilderTemplates,
  useFormSubmissions,
  useUpdateSubmission,
  type FormSubmissionListItem,
} from '@/lib/api/form-builder-hooks';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface Sample {
  sample_species?: string;
  sample_sex?: string;
  sample_age?: string;
  sample_code?: string;
  se?: boolean;
  ecn?: boolean;
  ev?: boolean;
  eon?: boolean;  // legacy
  lab_status?: string;
}

type LabStatus = 'positive' | 'negative' | 'doubtful' | '';

/* ────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────── */

const LAB_STATUS_OPTIONS: { value: LabStatus; label: string; labelFr: string; color: string; icon: React.ElementType }[] = [
  { value: 'positive', label: 'Positive', labelFr: 'Positif', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  { value: 'negative', label: 'Negative', labelFr: 'Négatif', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 },
  { value: 'doubtful', label: 'Doubtful', labelFr: 'Douteux', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: HelpCircle },
];

const SPECIES_LABELS: Record<string, string> = {
  goat: 'Chèvre', sheep: 'Mouton', Goat: 'Chèvre', Sheep: 'Mouton',
};

const SEX_LABELS: Record<string, string> = {
  male: 'M', female: 'F', Male: 'M', Female: 'F',
};

const AGE_LABELS: Record<string, string> = {
  '4_12m': '4-12 mois', 'over_12m': '>12 mois',
};

/* ────────────────────────────────────────────────────────────────
   Helper: extract samples from submission data
   ──────────────────────────────────────────────────────────────── */

function extractSamples(data: Record<string, unknown>): Sample[] {
  // The samples field is a repeater array
  const raw = data?.samples;
  if (Array.isArray(raw)) return raw as Sample[];
  return [];
}

function getSampleTypes(s: Sample): string {
  const types: string[] = [];
  if (s.se) types.push('SE');
  if (s.ecn) types.push('ECN');
  if (s.ev || s.eon) types.push(s.ev ? 'EV' : 'EON');
  return types.join(', ') || '—';
}

function getFormCode(data: Record<string, unknown>): string {
  return (data?.form_code as string) || (data?.survey_code as string) || '—';
}

function getLocation(data: Record<string, unknown>): string {
  const loc = data?.admin_location as Record<string, unknown> | undefined;
  if (!loc) return '—';
  const parts: string[] = [];
  for (const lvl of ['level_1_name', 'level_2_name', 'level_3_name', 'level_4_name']) {
    const val = loc[lvl];
    if (typeof val === 'string' && val) parts.push(val);
  }
  if (parts.length === 0) {
    // Try raw level values
    for (const lvl of ['level_1', 'level_2', 'level_3']) {
      const val = loc[lvl];
      if (typeof val === 'string' && val) parts.push(val);
    }
  }
  return parts.join(' / ') || '—';
}

/* ────────────────────────────────────────────────────────────────
   Page Component
   ──────────────────────────────────────────────────────────────── */

export default function PPRLabResultsPage() {
  // ── 1. Find PPR survey template(s) ──
  const { data: templateData } = useFormBuilderTemplates({
    limit: 50,
    domain: 'animal-health',
    status: 'PUBLISHED',
  });

  const pprTemplates = useMemo(() => {
    if (!templateData?.data) return [];
    return templateData.data.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes('ppr') &&
        (tpl.name.toLowerCase().includes('enquête') ||
         tpl.name.toLowerCase().includes('enquete') ||
         tpl.name.toLowerCase().includes('epidemio') ||
         tpl.name.toLowerCase().includes('survey')),
    );
  }, [templateData]);

  // ── State ──
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissionListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [labResults, setLabResults] = useState<Record<number, LabStatus>>({});
  const [saved, setSaved] = useState(false);

  // Auto-select first PPR template
  React.useEffect(() => {
    if (pprTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(pprTemplates[0].id);
    }
  }, [pprTemplates, selectedTemplateId]);

  // ── 2. Fetch submissions for selected template ──
  const { data: subData, isLoading: subsLoading } = useFormSubmissions(
    selectedTemplateId || undefined,
    { limit: 200, status: 'SUBMITTED' },
  );

  const submissions = useMemo(() => {
    if (!subData?.data) return [];
    let items = subData.data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((s) => {
        const code = getFormCode(s.data).toLowerCase();
        const loc = getLocation(s.data).toLowerCase();
        const surveyor = ((s.data?.surveyor_name as string) || '').toLowerCase();
        return code.includes(q) || loc.includes(q) || surveyor.includes(q) || s.id.includes(q);
      });
    }
    return items;
  }, [subData, searchQuery]);

  // ── 3. Samples from selected submission ──
  const samples = useMemo(() => {
    if (!selectedSubmission) return [];
    return extractSamples(selectedSubmission.data);
  }, [selectedSubmission]);

  // Init lab results from existing data when selecting a submission
  React.useEffect(() => {
    if (!selectedSubmission) return;
    const s = extractSamples(selectedSubmission.data);
    const init: Record<number, LabStatus> = {};
    s.forEach((sample, idx) => {
      if (sample.lab_status) {
        init[idx] = sample.lab_status as LabStatus;
      }
    });
    setLabResults(init);
    setSaved(false);
  }, [selectedSubmission]);

  // ── 4. Update handler ──
  const { mutateAsync: updateSubmission, isPending: isSaving } = useUpdateSubmission();

  const handleSave = useCallback(async () => {
    if (!selectedSubmission) return;

    // Merge lab results into samples array
    const updatedSamples = samples.map((sample, idx) => ({
      ...sample,
      lab_status: labResults[idx] || sample.lab_status || '',
    }));

    const updatedData = {
      ...selectedSubmission.data,
      samples: updatedSamples,
    };

    await updateSubmission({
      id: selectedSubmission.id,
      data: updatedData,
    });

    // Update local state
    setSelectedSubmission({
      ...selectedSubmission,
      data: updatedData,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [selectedSubmission, samples, labResults, updateSubmission]);

  const setResult = (idx: number, value: LabStatus) => {
    setLabResults((prev) => ({ ...prev, [idx]: value }));
    setSaved(false);
  };

  // Count stats
  const totalSamples = samples.length;
  const filledCount = Object.values(labResults).filter((v) => v).length;
  const positiveCount = Object.values(labResults).filter((v) => v === 'positive').length;
  const negativeCount = Object.values(labResults).filter((v) => v === 'negative').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/collecte"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Collecte
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-orange-600" />
            Résultats des Prélèvements PPR
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sélectionnez une fiche d&apos;enquête PPR pour saisir les résultats de laboratoire
          </p>
        </div>
      </div>

      {/* Template selector if multiple */}
      {pprTemplates.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Formulaire :</label>
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              setSelectedSubmission(null);
            }}
          >
            {pprTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Submission list ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher (code, lieu, enquêteur)..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {submissions.length} fiche{submissions.length !== 1 ? 's' : ''} soumise{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-50">
              {subsLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Aucune fiche PPR soumise trouvée
                </div>
              ) : (
                submissions.map((sub) => {
                  const code = getFormCode(sub.data);
                  const loc = getLocation(sub.data);
                  const surveyor = (sub.data?.surveyor_name as string) || '—';
                  const sampleCount = extractSamples(sub.data).length;
                  const hasResults = extractSamples(sub.data).some((s) => s.lab_status);
                  const isSelected = selectedSubmission?.id === sub.id;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                        isSelected && 'bg-orange-50 border-l-3 border-l-orange-500',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="font-medium text-sm text-gray-900 truncate">
                              {code}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{loc}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {surveyor} &middot; {sampleCount} prélèv.
                          </p>
                        </div>
                        <div className="shrink-0 ml-2">
                          {hasResults ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Résultats
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              En attente
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Lab results entry ── */}
        <div className="lg:col-span-2">
          {!selectedSubmission ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
              <FlaskConical className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                Sélectionnez une fiche d&apos;enquête PPR dans la liste pour saisir les résultats de laboratoire
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Submission info header */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Fiche : {getFormCode(selectedSubmission.data)}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {getLocation(selectedSubmission.data)} &middot;{' '}
                      Enquêteur : {(selectedSubmission.data?.surveyor_name as string) || '—'} &middot;{' '}
                      Date : {(selectedSubmission.data?.survey_date as string) || '—'}
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || filledCount === 0}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      saved
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400',
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saved ? 'Enregistré' : 'Enregistrer les résultats'}
                  </button>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {totalSamples} prélèvement{totalSamples !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs text-gray-600">
                    {filledCount}/{totalSamples} renseignés
                  </span>
                  {positiveCount > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      {positiveCount} positif{positiveCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {negativeCount > 0 && (
                    <span className="text-xs text-green-600 font-medium">
                      {negativeCount} négatif{negativeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Samples table */}
              {samples.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-400">
                  Aucun prélèvement enregistré dans cette fiche
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            N°
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Espèce
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Sexe
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Âge
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Échantillons
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-700 uppercase tracking-wider bg-orange-50">
                            Résultat Labo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {samples.map((sample, idx) => {
                          const currentResult = labResults[idx] || '';
                          return (
                            <tr
                              key={idx}
                              className={cn(
                                'hover:bg-gray-50 transition-colors',
                                currentResult === 'positive' && 'bg-red-50/30',
                                currentResult === 'negative' && 'bg-green-50/30',
                              )}
                            >
                              <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-gray-900">
                                {sample.sample_code || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">
                                {SPECIES_LABELS[sample.sample_species || ''] || sample.sample_species || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">
                                {SEX_LABELS[sample.sample_sex || ''] || sample.sample_sex || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">
                                {AGE_LABELS[sample.sample_age || ''] || sample.sample_age || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 text-xs">
                                {getSampleTypes(sample)}
                              </td>
                              <td className="px-3 py-2 bg-orange-50/30">
                                <div className="flex items-center justify-center gap-1">
                                  {LAB_STATUS_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    const isActive = currentResult === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        onClick={() =>
                                          setResult(idx, isActive ? '' : opt.value)
                                        }
                                        title={opt.labelFr}
                                        className={cn(
                                          'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all',
                                          isActive
                                            ? opt.color
                                            : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 bg-white',
                                        )}
                                      >
                                        <Icon className="h-3.5 w-3.5" />
                                        {opt.labelFr}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom save bar */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {filledCount}/{totalSamples} résultats renseignés
                    </p>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || filledCount === 0}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        saved
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400',
                      )}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : saved ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saved ? 'Enregistré !' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
