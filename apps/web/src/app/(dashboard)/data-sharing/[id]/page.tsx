'use client';

// Data Sharing — agreement detail with workflow actions and access logs.

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Check,
  X,
  Ban,
  AlertTriangle,
  Activity,
  FileText,
} from 'lucide-react';
import {
  useDataShareAgreement,
  useDataShareAgreementLogs,
  useSubmitDataShareAgreement,
  useAcceptDataShareAgreement,
  useRejectDataShareAgreement,
  useRevokeDataShareAgreement,
  statusBadgeClasses,
} from '@/lib/api/data-sharing';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';

export default function DataShareDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const t = useTranslations('dataSharing');
  const tCommon = useTranslations('common');
  const formatDate = useFormattedDate();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError } = useDataShareAgreement(id);
  const agreement = data?.data;

  const submit = useSubmitDataShareAgreement();
  const accept = useAcceptDataShareAgreement();
  const reject = useRejectDataShareAgreement();
  const revoke = useRevokeDataShareAgreement();

  const [tab, setTab] = useState<'details' | 'logs'>('details');
  const [showReject, setShowReject] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [reason, setReason] = useState('');

  const isOwner = !!user && !!agreement && user.tenantId === agreement.ownerTenantId;
  const isRecipient = !!user && !!agreement && user.tenantId === agreement.recipientTenantId;
  const canSeeLogs = isOwner || isRecipient;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{tCommon('loading')}</div>;
  }
  if (isError || !agreement) {
    return <div className="p-6 text-sm text-destructive">{tCommon('retry')}</div>;
  }

  const canSubmit = isOwner && agreement.status === 'DRAFT';
  const canAcceptReject = isRecipient && agreement.status === 'SUBMITTED';
  const canRevoke =
    isOwner && ['SUBMITTED', 'ACCEPTED', 'ACTIVE'].includes(agreement.status);

  async function doSubmit() {
    if (!id) return;
    await submit.mutateAsync(id);
  }
  async function doAccept() {
    if (!id) return;
    await accept.mutateAsync(id);
  }
  async function doReject() {
    if (!id || !reason.trim()) return;
    await reject.mutateAsync({ id, rejectionReason: reason.trim() });
    setShowReject(false);
    setReason('');
  }
  async function doRevoke() {
    if (!id || !reason.trim()) return;
    await revoke.mutateAsync({ id, revocationReason: reason.trim() });
    setShowRevoke(false);
    setReason('');
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/data-sharing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{agreement.reference}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{agreement.title}</h1>
          <div className="mt-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(agreement.status)}`}
            >
              {t(`status.${agreement.status.toLowerCase()}`)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              type="button"
              onClick={doSubmit}
              disabled={submit.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {t('detail.submit')}
            </button>
          )}
          {canAcceptReject && (
            <>
              <button
                type="button"
                onClick={doAccept}
                disabled={accept.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {t('detail.accept')}
              </button>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
              >
                <X className="h-4 w-4" /> {t('detail.reject')}
              </button>
            </>
          )}
          {canRevoke && (
            <button
              type="button"
              onClick={() => setShowRevoke(true)}
              className="inline-flex items-center gap-2 rounded-md border border-orange-500/40 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-500/5"
            >
              <Ban className="h-4 w-4" /> {t('detail.revoke')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <TabBtn active={tab === 'details'} onClick={() => setTab('details')} icon={<FileText className="h-4 w-4" />}>
          {t('detail.parties')}
        </TabBtn>
        {canSeeLogs && (
          <TabBtn active={tab === 'logs'} onClick={() => setTab('logs')} icon={<Activity className="h-4 w-4" />}>
            {t('detail.viewLogs')}
          </TabBtn>
        )}
      </div>

      {tab === 'details' ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Parties */}
          <Card title={t('detail.parties')}>
            <KV label={t('detail.owner')} value={agreement.ownerTenantId} mono />
            <KV label={t('detail.recipient')} value={agreement.recipientTenantId} mono />
          </Card>

          {/* Validity */}
          <Card title={t('detail.validity')}>
            <KV label={t('wizard.validFromLabel')} value={formatDate(agreement.validFrom)} />
            <KV
              label={t('wizard.validUntilLabel')}
              value={agreement.validUntil ? formatDate(agreement.validUntil) : '—'}
            />
          </Card>

          {/* Data scope */}
          <Card title={t('detail.dataScope')}>
            <KV label={t('wizard.domainLabel')} value={agreement.dataDomain} />
            <KV label={t('wizard.classificationLabel')} value={agreement.dataClassification} />
            {(agreement.dataScope as any)?.campaignName && (
              <KV
                label={t('wizard.campaignLabel')}
                value={(agreement.dataScope as any).campaignName}
              />
            )}
            <KV
              label={t('wizard.entitiesLabel')}
              value={
                (() => {
                  const ids: string[] =
                    (agreement.dataScope as any)?.formIds ??
                    agreement.dataScope?.entities ??
                    [];
                  return ids.length ? `${ids.length} fiche(s)` : '—';
                })()
              }
            />
            {agreement.dataScope?.geoFilter?.countries && (
              <KV label="Countries" value={agreement.dataScope.geoFilter.countries.join(', ')} />
            )}
            {agreement.dataScope?.timeRange && (
              <KV
                label="Time range"
                value={`${agreement.dataScope.timeRange.from ?? '—'} → ${agreement.dataScope.timeRange.to ?? '—'}`}
              />
            )}
          </Card>

          {/* Permissions & limits */}
          <Card title={t('detail.permissions')}>
            <div className="flex flex-wrap gap-1.5">
              {agreement.canConsult && <Badge>{t('wizard.canConsult')}</Badge>}
              {agreement.canExport && <Badge>{t('wizard.canExport')}</Badge>}
              {agreement.canModify && <Badge>{t('wizard.canModify')}</Badge>}
              {agreement.canRedistribute && <Badge>{t('wizard.canRedistribute')}</Badge>}
            </div>
            <div className="mt-3 space-y-1">
              <KV label={t('wizard.maxRecordsLabel')} value={String(agreement.maxRecordsPerQuery ?? '—')} />
              <KV label={t('wizard.maxExportsLabel')} value={String(agreement.maxExportsPerMonth ?? '—')} />
              <KV label={t('wizard.requireMfaLabel')} value={agreement.requireMfa ? '✓' : '—'} />
              <KV label={t('wizard.ipRangesLabel')} value={(agreement.allowedIpRanges ?? []).join(', ') || '—'} />
            </div>
          </Card>

          {/* Purpose */}
          <Card title={t('wizard.purposeLabel')} full>
            <p className="text-sm">{agreement.purpose}</p>
            {agreement.legalBasis && (
              <>
                <h4 className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
                  {t('wizard.legalBasisLabel')}
                </h4>
                <p className="text-sm">{agreement.legalBasis}</p>
              </>
            )}
          </Card>

          {/* History */}
          <Card title={t('detail.history')} full>
            <KV label={t('detail.createdAt')} value={formatDate(agreement.createdAt)} />
            {agreement.submittedAt && (
              <KV label={t('detail.submittedAt')} value={formatDate(agreement.submittedAt)} />
            )}
            {agreement.reviewedAt && (
              <KV label={t('detail.reviewedAt')} value={formatDate(agreement.reviewedAt)} />
            )}
            {agreement.rejectionReason && (
              <KV label={t('detail.rejectedReason')} value={agreement.rejectionReason} />
            )}
            {agreement.revocationReason && (
              <KV label={t('detail.revokedReason')} value={agreement.revocationReason} />
            )}
          </Card>
        </div>
      ) : (
        <LogsTab id={id!} />
      )}

      {/* Reject modal */}
      {showReject && (
        <Modal title={t('detail.rejectModalTitle')} onClose={() => setShowReject(false)}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder={t('detail.rejectReasonPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={doReject}
              disabled={!reason.trim() || reject.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" /> {t('detail.confirmReject')}
            </button>
          </div>
        </Modal>
      )}

      {/* Revoke modal */}
      {showRevoke && (
        <Modal title={t('detail.revokeModalTitle')} onClose={() => setShowRevoke(false)}>
          <div className="mb-3 flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>This action cannot be undone.</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder={t('detail.revokeReasonPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRevoke(false)}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={doRevoke}
              disabled={!reason.trim() || revoke.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Ban className="h-4 w-4" /> {t('detail.confirmRevoke')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${full ? 'md:col-span-2' : ''}`}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1 md:grid-cols-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LogsTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const limit = 20;
  const t = useTranslations('dataSharing');
  const tCommon = useTranslations('common');
  const formatDate = useFormattedDate();
  const { data, isLoading } = useDataShareAgreementLogs(id, page, limit);
  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;
  if (logs.length === 0)
    return <p className="text-sm text-muted-foreground">{tCommon('noData')}</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Records</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-xs">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-2">{l.action}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.userId.slice(0, 8)}</td>
                <td className="px-4 py-2">{l.recordCount ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.ipAddress ?? '—'}</td>
                <td className="px-4 py-2">
                  {l.success ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-destructive">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              {tCommon('previous')}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              {tCommon('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
