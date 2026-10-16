'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Check, X, Ban } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubAgreement,
  useHubTransactions,
  useProposeHubAgreement,
  useAcceptHubAgreement,
  useRejectHubAgreement,
  useRevokeHubAgreement,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PROPOSED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  REVOKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

const TX_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-700',
};

export default function AgreementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('interopHub');

  const { data: agData, isLoading } = useHubAgreement(id);
  const ag = agData?.data;

  // Fetch related transactions (by partner or connection)
  const { data: txData } = useHubTransactions({ limit: 20 });
  const transactions = txData?.data ?? [];

  const proposeMut = useProposeHubAgreement();
  const acceptMut = useAcceptHubAgreement();
  const rejectMut = useRejectHubAgreement();
  const revokeMut = useRevokeHubAgreement();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!ag) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('agreements.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/interop-hub/agreements')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('agreements.title')}
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ag.name}</h1>
            <p className="text-sm text-muted-foreground">{ag.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[ag.status] ?? 'bg-gray-100'}`}>
              {ag.status}
            </span>
            {ag.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => proposeMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-3.5 w-3.5" /> {t('actions.propose')}
              </button>
            )}
            {ag.status === 'PROPOSED' && (
              <>
                <button
                  type="button"
                  onClick={() => acceptMut.mutate(id)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                >
                  <Check className="h-3.5 w-3.5" /> {t('actions.accept')}
                </button>
                <button
                  type="button"
                  onClick={() => rejectMut.mutate({ id })}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                >
                  <X className="h-3.5 w-3.5" /> {t('actions.reject')}
                </button>
              </>
            )}
            {['ACTIVE', 'ACCEPTED'].includes(ag.status) && (
              <button
                type="button"
                onClick={() => {
                  const reason = prompt(t('agreements.revokeReason'));
                  if (reason) revokeMut.mutate({ id, reason });
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Ban className="h-3.5 w-3.5" /> {t('actions.revoke')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Agreement info */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('detail.info')}</h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label={t('col.direction')} value={t(`direction.${ag.direction}`)} />
            <InfoRow label={t('col.partner')} value={ag.partnerTenantId ?? '-'} />
            <InfoRow label={t('col.dataClassification')} value={ag.dataClassification ?? '-'} />
            <InfoRow label={t('col.validFrom')} value={ag.validFrom ? new Date(ag.validFrom).toLocaleDateString() : '-'} />
            <InfoRow label={t('col.validUntil')} value={ag.validTo ? new Date(ag.validTo).toLocaleDateString() : '-'} />
            <InfoRow label={t('col.proposedAt')} value={ag.proposedAt ? new Date(ag.proposedAt).toLocaleDateString() : '-'} />
            {ag.acceptedAt && <InfoRow label={t('col.acceptedAt')} value={new Date(ag.acceptedAt).toLocaleDateString()} />}
          </dl>
        </div>

        {/* Domains & SLA */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('col.domains')}</h3>
            <div className="flex flex-wrap gap-2">
              {ag.domains.map((d) => (
                <span key={d} className="inline-flex rounded-md border px-3 py-1 text-xs font-medium">
                  {d}
                </span>
              ))}
            </div>
          </div>
          {ag.terms && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('agreement.slaTerms')}</h3>
              <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(ag.terms, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Related transactions */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">{t('agreement.relatedTx')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t('col.id')}</th>
                <th className="px-4 py-2 font-medium">{t('col.direction')}</th>
                <th className="px-4 py-2 font-medium">{t('col.domain')}</th>
                <th className="px-4 py-2 font-medium">{t('col.status')}</th>
                <th className="px-4 py-2 font-medium">{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t('transactions.empty')}</td></tr>
              ) : transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline">
                      {tx.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{tx.direction}</td>
                  <td className="px-4 py-2 text-xs">{tx.domain}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_STATUS_CLS[tx.status] ?? 'bg-gray-100'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
