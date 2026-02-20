'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  FlaskConical,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthEvent, type HealthEventDetail, type LabResult, type TimelineEntry } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  suspected: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const LAB_RESULT_BADGE: Record<string, string> = {
  positive: 'bg-red-100 text-red-700',
  negative: 'bg-green-100 text-green-700',
  inconclusive: 'bg-amber-100 text-amber-700',
  pending: 'bg-gray-100 text-gray-600',
};

// Placeholder detail data
const PLACEHOLDER_DETAIL: HealthEventDetail = {
  id: 'ev-1',
  disease: 'Foot-and-Mouth Disease',
  diseaseCode: 'FMD',
  country: 'Kenya',
  countryCode: 'KE',
  region: 'Rift Valley',
  lat: -1.286,
  lng: 36.817,
  status: 'confirmed',
  severity: 'high',
  cases: 234,
  deaths: 12,
  speciesAffected: ['Cattle', 'Goat'],
  reportedAt: '2026-02-15T10:30:00Z',
  confirmedAt: '2026-02-16T14:00:00Z',
  reportedBy: 'Dr. Ochieng',
  validationLevel: 2,
  workflowStatus: 'pending_l2',
  dataQualityScore: 92,
  createdAt: '2026-02-15T10:30:00Z',
  updatedAt: '2026-02-18T09:00:00Z',
  description:
    'Outbreak of FMD affecting dairy and beef cattle herds in the Rift Valley region. Initial cases detected at Nakuru County livestock market. Rapid spread to neighbouring farms observed. Clinical signs include vesicular lesions on the mouth and feet, salivation, and lameness.',
  measures: [
    'Movement restrictions imposed in affected sub-counties',
    'Ring vaccination initiated (10 km radius)',
    'Enhanced surveillance in neighbouring counties',
    'Quarantine of affected farms',
    'Disinfection of livestock markets',
  ],
  labResults: [
    {
      id: 'lr-1',
      sampleId: 'KE-FMD-2026-001',
      testType: 'RT-PCR',
      result: 'positive',
      pathogen: 'FMDV serotype O',
      laboratory: 'KARI Muguga',
      collectedAt: '2026-02-15T12:00:00Z',
      resultAt: '2026-02-16T10:00:00Z',
    },
    {
      id: 'lr-2',
      sampleId: 'KE-FMD-2026-002',
      testType: 'ELISA',
      result: 'positive',
      pathogen: 'FMDV antibodies',
      laboratory: 'KARI Muguga',
      collectedAt: '2026-02-15T12:30:00Z',
      resultAt: '2026-02-16T14:00:00Z',
    },
    {
      id: 'lr-3',
      sampleId: 'KE-FMD-2026-003',
      testType: 'Virus isolation',
      result: 'pending',
      pathogen: 'FMDV',
      laboratory: 'AU-PANVAC',
      collectedAt: '2026-02-16T08:00:00Z',
    },
  ],
  timeline: [
    {
      id: 'tl-1',
      action: 'Event reported',
      actor: 'Dr. Ochieng',
      actorRole: 'Field Agent',
      detail: 'Initial report submitted from Nakuru County',
      timestamp: '2026-02-15T10:30:00Z',
    },
    {
      id: 'tl-2',
      action: 'Samples collected',
      actor: 'Dr. Ochieng',
      actorRole: 'Field Agent',
      detail: '3 samples collected from affected animals',
      timestamp: '2026-02-15T12:00:00Z',
    },
    {
      id: 'tl-3',
      action: 'Level 1 approved',
      actor: 'Dr. Kamau',
      actorRole: 'Data Steward',
      detail: 'Technical validation passed — quality score 92%',
      timestamp: '2026-02-16T09:00:00Z',
    },
    {
      id: 'tl-4',
      action: 'Lab results confirmed',
      actor: 'KARI Muguga',
      actorRole: 'Laboratory',
      detail: 'RT-PCR positive for FMDV serotype O',
      timestamp: '2026-02-16T10:00:00Z',
    },
    {
      id: 'tl-5',
      action: 'Status updated to Confirmed',
      actor: 'System',
      actorRole: 'System',
      detail: 'Auto-updated based on lab confirmation',
      timestamp: '2026-02-16T14:00:00Z',
    },
    {
      id: 'tl-6',
      action: 'Pending Level 2 approval',
      actor: 'System',
      actorRole: 'System',
      detail: 'Awaiting CVO office approval for official notification',
      timestamp: '2026-02-16T14:01:00Z',
    },
  ],
  vaccinationResponse: {
    campaignId: 'vc-1',
    dosesAdministered: 4520,
    targetPopulation: 12000,
    coverage: 37.7,
  },
};

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;

  const { data, isLoading, isError, error, refetch } = useHealthEvent(eventId);
  const event = data?.data ?? PLACEHOLDER_DETAIL;

  if (isLoading) return <DetailSkeleton />;
  if (isError) {
    return (
      <QueryError
        message={error instanceof Error ? error.message : 'Failed to load event'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/animal-health"
          className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {event.disease}
            </h1>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                STATUS_BADGE[event.status],
              )}
            >
              {event.status}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                SEVERITY_BADGE[event.severity],
              )}
            >
              {event.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {event.diseaseCode} — {event.country}, {event.region}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Cases
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {event.cases.toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Deaths
          </p>
          <p className="mt-1 text-2xl font-bold text-red-700">
            {event.deaths.toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Quality Score
          </p>
          <p className="mt-1 text-2xl font-bold text-aris-primary-700">
            {event.dataQualityScore}%
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Validation Level
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            L{event.validationLevel}
          </p>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4].map((l) => (
              <div
                key={l}
                className={cn(
                  'h-1.5 w-6 rounded-full',
                  l <= event.validationLevel
                    ? 'bg-aris-primary-500'
                    : 'bg-gray-200',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <section className="rounded-card border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900">
              Description
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {event.description}
            </p>

            {event.measures.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-gray-900">
                  Control Measures
                </h3>
                <ul className="mt-2 space-y-1">
                  {event.measures.map((m, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-aris-primary-500" />
                      {m}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Lab Results */}
          <section className="rounded-card border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-aris-secondary-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Laboratory Results
              </h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Sample ID
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Test
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Result
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Pathogen
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Lab
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {event.labResults.map((lr: LabResult) => (
                    <tr key={lr.id}>
                      <td className="py-2 font-mono text-xs text-gray-700">
                        {lr.sampleId}
                      </td>
                      <td className="py-2 text-gray-700">{lr.testType}</td>
                      <td className="py-2">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            LAB_RESULT_BADGE[lr.result],
                          )}
                        >
                          {lr.result}
                        </span>
                      </td>
                      <td className="py-2 text-gray-700">{lr.pathogen}</td>
                      <td className="py-2 text-gray-500">{lr.laboratory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Vaccination Response */}
          {event.vaccinationResponse && (
            <section className="rounded-card border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Vaccination Response
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Doses Administered</p>
                  <p className="text-lg font-bold text-gray-900">
                    {event.vaccinationResponse.dosesAdministered.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Target Population</p>
                  <p className="text-lg font-bold text-gray-900">
                    {event.vaccinationResponse.targetPopulation.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Coverage</p>
                  <p className="text-lg font-bold text-aris-primary-700">
                    {event.vaccinationResponse.coverage}%
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-aris-primary-500 transition-all"
                    style={{
                      width: `${Math.min(100, event.vaccinationResponse.coverage)}%`,
                    }}
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — Timeline + metadata */}
        <div className="space-y-6">
          {/* Metadata */}
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Event Info
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <dt className="text-gray-500">Location:</dt>
                <dd className="font-medium text-gray-900">
                  {event.lat.toFixed(3)}, {event.lng.toFixed(3)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <dt className="text-gray-500">Reported:</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(event.reportedAt).toLocaleDateString()}
                </dd>
              </div>
              {event.confirmedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <dt className="text-gray-500">Confirmed:</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(event.confirmedAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <dt className="text-gray-500">Reporter:</dt>
                <dd className="font-medium text-gray-900">
                  {event.reportedBy}
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">Species Affected</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {event.speciesAffected.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Timeline
            </h3>
            <div className="mt-3 space-y-0">
              {event.timeline.map((entry: TimelineEntry, i: number) => (
                <div key={entry.id} className="relative flex gap-3 pb-4">
                  {i < event.timeline.length - 1 && (
                    <div className="absolute left-[7px] top-5 h-full w-px bg-gray-200" />
                  )}
                  <div className="relative z-10 mt-0.5 flex-shrink-0">
                    <TimelineIcon action={entry.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {entry.action}
                    </p>
                    <p className="text-xs text-gray-500">{entry.detail}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <span>{entry.actor}</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TimelineIcon({ action }: { action: string }) {
  const lower = action.toLowerCase();
  if (lower.includes('approved') || lower.includes('confirmed')) {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      </div>
    );
  }
  if (lower.includes('rejected') || lower.includes('failed')) {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-3 w-3 text-red-600" />
      </div>
    );
  }
  if (lower.includes('pending') || lower.includes('awaiting')) {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100">
      <Clock className="h-3 w-3 text-gray-500" />
    </div>
  );
}
