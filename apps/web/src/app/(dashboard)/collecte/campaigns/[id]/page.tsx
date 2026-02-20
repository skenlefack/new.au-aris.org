'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  ClipboardList,
  CheckCircle2,
  XCircle,
  MapPin,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaign, type CollecteSubmission } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';

const SUBMISSION_STATUS_STYLES: Record<CollecteSubmission['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  corrected: 'bg-amber-100 text-amber-700',
};

const QUALITY_RESULT_STYLES: Record<string, string> = {
  pass: 'text-green-600',
  fail: 'text-red-600',
  warning: 'text-amber-600',
  pending: 'text-gray-400',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading } = useCampaign(id);
  const [tab, setTab] = useState<'submissions' | 'agents'>('submissions');

  if (isLoading) return <DetailSkeleton />;

  const campaign = data?.data;
  if (!campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <div className="rounded-card border border-gray-200 bg-white p-8 text-center text-gray-400">
          Campaign not found
        </div>
      </div>
    );
  }

  const progress =
    campaign.targetSubmissions > 0
      ? Math.round(
          (campaign.totalSubmissions / campaign.targetSubmissions) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              campaign.status === 'active'
                ? 'bg-green-100 text-green-700'
                : campaign.status === 'completed'
                  ? 'bg-blue-100 text-blue-700'
                  : campaign.status === 'paused'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700',
            )}
          >
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">{campaign.description}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <BarChart3 className="h-3.5 w-3.5" />
            Progress
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{progress}%</p>
          <p className="text-xs text-gray-500">
            {campaign.totalSubmissions} / {campaign.targetSubmissions}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validated
          </div>
          <p className="mt-1 text-xl font-bold text-green-600">
            {campaign.validatedSubmissions}
          </p>
          <p className="text-xs text-gray-500">submissions</p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </div>
          <p className="mt-1 text-xl font-bold text-red-600">
            {campaign.rejectedSubmissions}
          </p>
          <p className="text-xs text-gray-500">submissions</p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users className="h-3.5 w-3.5" />
            Agents
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {campaign.assignedAgents}
          </p>
          <p className="text-xs text-gray-500">active</p>
        </div>
      </div>

      {/* Campaign meta */}
      <div className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            Template: {campaign.templateName}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            {new Date(campaign.startDate).toLocaleDateString()} —{' '}
            {new Date(campaign.endDate).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            {campaign.zones.join(', ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('submissions')}
            className={cn(
              'border-b-2 pb-2 text-sm font-medium',
              tab === 'submissions'
                ? 'border-aris-primary-600 text-aris-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            Submissions ({campaign.submissions?.length ?? 0})
          </button>
          <button
            onClick={() => setTab('agents')}
            className={cn(
              'border-b-2 pb-2 text-sm font-medium',
              tab === 'agents'
                ? 'border-aris-primary-600 text-aris-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            Agents ({campaign.agents?.length ?? 0})
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'submissions' && (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(campaign.submissions ?? []).map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/collecte/submissions/${sub.id}`}
                      className="font-medium text-aris-primary-600 hover:underline"
                    >
                      {sub.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {sub.submittedByName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{sub.zone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        SUBMISSION_STATUS_STYLES[sub.status],
                      )}
                    >
                      {sub.status.charAt(0).toUpperCase() +
                        sub.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        QUALITY_RESULT_STYLES[sub.qualityResult],
                      )}
                    >
                      {sub.qualityScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(sub.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(campaign.submissions ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No submissions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'agents' && (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Submissions</th>
                <th className="px-4 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(campaign.agents ?? []).map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {agent.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{agent.email}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.zone}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {agent.submissions}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(agent.lastActive).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(campaign.agents ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No agents assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
