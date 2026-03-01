'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Target,
  Users,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  BarChart3,
  Globe,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCollectionCampaign,
  useActivateCampaign,
  usePauseCampaign,
  useCompleteCampaign,
  useAddCampaignAssignment,
  useRemoveCampaignAssignment,
} from '@/lib/api/workflow-hooks';

function i18n(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj['en'] ?? obj['fr'] ?? Object.values(obj)[0] ?? '—';
  }
  return String(val);
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  PLANNED: { label: 'Planned', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  ACTIVE: { label: 'Active', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  PAUSED: { label: 'Paused', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Completed', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  CANCELLED: { label: 'Cancelled', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const ASSIGN_STATUS: Record<string, { label: string; class: string }> = {
  ASSIGNED: { label: 'Assigned', class: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'In Progress', class: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', class: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Overdue', class: 'bg-red-100 text-red-700' },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data: res, isLoading } = useCollectionCampaign(campaignId);
  const activateMut = useActivateCampaign();
  const pauseMut = usePauseCampaign();
  const completeMut = useCompleteCampaign();
  const addAssignment = useAddCampaignAssignment();
  const removeAssignment = useRemoveCampaignAssignment();

  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({
    userId: '',
    countryCode: '',
    targetSubmissions: 10,
    dueDate: '',
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  const campaign = res?.data;
  if (!campaign) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-gray-500">Campaign not found.</p>
        <Link href="/collecte/campaigns" className="mt-2 text-sm text-blue-600 hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG['PLANNED'];
  const assignments = campaign.assignments ?? [];
  const progress = campaign.progress ?? {};
  const target = campaign.targetSubmissions ?? 0;
  const submitted = progress.submitted ?? 0;
  const pct = target > 0 ? Math.round((submitted / target) * 100) : 0;

  const handleAddAgent = async () => {
    await addAssignment.mutateAsync({
      campaignId,
      userId: newAgent.userId,
      countryCode: newAgent.countryCode || undefined,
      targetSubmissions: newAgent.targetSubmissions,
      dueDate: newAgent.dueDate || undefined,
    });
    setShowAddAgent(false);
    setNewAgent({ userId: '', countryCode: '', targetSubmissions: 10, dueDate: '' });
  };

  const handleRemoveAgent = async (assignId: string) => {
    if (!confirm('Remove this assignment?')) return;
    await removeAssignment.mutateAsync({ campaignId, assignId });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/collecte/campaigns"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {i18n(campaign.name)}
          </h1>
          <p className="text-xs text-gray-500 font-mono">{campaign.code}</p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', statusCfg.class)}>
          {statusCfg.label}
        </span>

        {/* Status action buttons */}
        {campaign.status === 'PLANNED' && (
          <button
            onClick={() => activateMut.mutate(campaignId)}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            <Play className="h-3 w-3" /> Activate
          </button>
        )}
        {campaign.status === 'ACTIVE' && (
          <>
            <button
              onClick={() => pauseMut.mutate(campaignId)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
            >
              <Pause className="h-3 w-3" /> Pause
            </button>
            <button
              onClick={() => completeMut.mutate(campaignId)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <CheckCircle2 className="h-3 w-3" /> Complete
            </button>
          </>
        )}
        {campaign.status === 'PAUSED' && (
          <button
            onClick={() => activateMut.mutate(campaignId)}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            <Play className="h-3 w-3" /> Resume
          </button>
        )}
      </div>

      {/* Campaign details grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — Info + Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {i18n(campaign.description)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500">Domain</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{campaign.domain ?? '—'}</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500">Frequency</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{campaign.frequency ?? '—'}</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500">Scope</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{campaign.scope ?? '—'}</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500">Reminders</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {campaign.sendReminders ? `${campaign.reminderDaysBefore}d before` : 'Off'}
                </p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Progress</h3>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{submitted}</p>
                <p className="text-[10px] text-gray-500">Submitted</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{progress.validated ?? 0}</p>
                <p className="text-[10px] text-gray-500">Validated</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{progress.rejected ?? 0}</p>
                <p className="text-[10px] text-gray-500">Rejected</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{submitted} / {target}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Assignments */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Agent Assignments ({assignments.length})
              </h3>
              <button
                onClick={() => setShowAddAgent(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add Agent
              </button>
            </div>

            {showAddAgent && (
              <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">User ID</label>
                    <input
                      value={newAgent.userId}
                      onChange={(e) => setNewAgent((s) => ({ ...s, userId: e.target.value }))}
                      className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                      placeholder="UUID"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Country Code</label>
                    <input
                      value={newAgent.countryCode}
                      onChange={(e) => setNewAgent((s) => ({ ...s, countryCode: e.target.value.toUpperCase() }))}
                      maxLength={2}
                      className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm uppercase"
                      placeholder="KE"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Target</label>
                    <input
                      type="number"
                      value={newAgent.targetSubmissions}
                      onChange={(e) => setNewAgent((s) => ({ ...s, targetSubmissions: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Due Date</label>
                    <input
                      type="date"
                      value={newAgent.dueDate}
                      onChange={(e) => setNewAgent((s) => ({ ...s, dueDate: e.target.value }))}
                      className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddAgent(false)}
                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAgent}
                    disabled={!newAgent.userId || addAssignment.isPending}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addAssignment.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {assignments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No agents assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a: any) => {
                  const aPct = a.targetSubmissions > 0
                    ? Math.round((a.completedSubmissions / a.targetSubmissions) * 100)
                    : 0;
                  const aStatus = ASSIGN_STATUS[a.status] ?? ASSIGN_STATUS['ASSIGNED'];

                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                        <Users className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {a.user?.displayName ?? a.user?.email ?? a.userId?.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {a.countryCode && (
                            <span className="flex items-center gap-0.5">
                              <Globe className="h-3 w-3" /> {a.countryCode}
                            </span>
                          )}
                          <span>{a.completedSubmissions} / {a.targetSubmissions}</span>
                          {a.dueDate && (
                            <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-24">
                        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${aPct}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-right text-gray-500">{aPct}%</p>
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', aStatus.class)}>
                        {aStatus.label}
                      </span>
                      <button
                        onClick={() => handleRemoveAgent(a.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Campaign Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusCfg.class)}>{statusCfg.label}</span></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Start Date</dt>
                <dd className="text-xs">{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">End Date</dt>
                <dd className="text-xs">{campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Target</dt>
                <dd className="text-xs font-medium">{target} submissions</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Per Agent</dt>
                <dd className="text-xs">{campaign.targetPerAgent ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Countries</dt>
                <dd className="text-xs">{(campaign.targetCountries ?? []).join(', ') || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Form Template</dt>
                <dd className="text-xs truncate max-w-[120px]">
                  {campaign.formTemplate?.title ?? campaign.formTemplateId?.slice(0, 8) ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Notifications</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  Reminders: {campaign.sendReminders ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {campaign.sendReminders && campaign.reminderDaysBefore && (
                <p className="text-xs text-gray-500 pl-6">
                  {campaign.reminderDaysBefore} days before deadline
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
