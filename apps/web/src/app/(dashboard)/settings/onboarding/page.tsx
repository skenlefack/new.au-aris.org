'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useOnboardingSubmissions,
  useOnboardingDetail,
  useUpdateOnboardingStatus,
  useProvisionOnboardingUsers,
  useDeleteOnboarding,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import {
  Globe, Users, ChevronLeft, Eye, Trash2, UserPlus, CheckCircle2,
  XCircle, Clock, AlertCircle, FileText, MapPin, Building2, Download,
  Shield, Search, Filter,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  SUBMITTED: { color: 'text-blue-700', bg: 'bg-blue-100', icon: <Clock className="h-3.5 w-3.5" /> },
  UNDER_REVIEW: { color: 'text-amber-700', bg: 'bg-amber-100', icon: <Eye className="h-3.5 w-3.5" /> },
  APPROVED: { color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  REJECTED: { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle className="h-3.5 w-3.5" /> },
  PROCESSING: { color: 'text-purple-700', bg: 'bg-purple-100', icon: <Clock className="h-3.5 w-3.5" /> },
  COMPLETED: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  DRAFT: { color: 'text-gray-700', bg: 'bg-gray-100', icon: <FileText className="h-3.5 w-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}
      {status}
    </span>
  );
}

export default function OnboardingSettingsPage() {
  const t = useTranslations('settings');
  const { isSuperAdmin, isContinentalAdmin } = useSettingsAccess();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: listData, isLoading } = useOnboardingSubmissions({ page, search: search || undefined, status: statusFilter || undefined });
  const { data: detailData } = useOnboardingDetail(selectedId);
  const updateStatus = useUpdateOnboardingStatus();
  const provisionUsers = useProvisionOnboardingUsers();
  const deleteOnboarding = useDeleteOnboarding();

  const submissions = listData?.data ?? [];
  const meta = listData?.meta ?? { total: 0, page: 1, limit: 20 };
  const detail = detailData?.data;

  const handleStatusChange = (id: string, status: string) => {
    const notes = status === 'REJECTED' ? prompt(t('onboardingRejectReason') || 'Reason for rejection:') : undefined;
    if (status === 'REJECTED' && notes === null) return;
    updateStatus.mutate({ id, status, notes: notes ?? undefined });
  };

  const handleProvision = (id: string) => {
    if (!confirm(t('onboardingProvisionConfirm') || 'This will create user accounts from the onboarding data. Temporary passwords will be generated. Continue?')) return;
    provisionUsers.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDelete') || 'Are you sure?')) return;
    deleteOnboarding.mutate(id, { onSuccess: () => setSelectedId(null) });
  };

  const exportUsersCsv = (users: any[]) => {
    if (!users?.length) return;
    const headers = ['FirstName', 'LastName', 'Email', 'Phone', 'Role', 'Title', 'Institution', 'Level', 'Location', 'Domains', 'MFA', 'Supervisor', 'SupervisorEmail'];
    const rows = users.map((u: any) => [
      u.firstName, u.lastName, u.email, u.phone, u.role, u.title, u.institution,
      u.level, u.location, u.domains, u.mfa ? 'Yes' : 'No', u.supervisorName, u.supervisorEmail,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c: string) => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'onboarding-users.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Detail view
  if (selectedId && detail) {
    const users = (detail.users as any[]) || [];
    const adminLevels = (detail.adminLevels as any[]) || [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{detail.countryName}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {detail.countryCode && <span className="font-mono">{detail.countryCode}</span>}
                <StatusBadge status={detail.status} />
                <span>{new Date(detail.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {(isSuperAdmin || isContinentalAdmin) && (
            <div className="flex items-center gap-2">
              {detail.status === 'SUBMITTED' && (
                <button onClick={() => handleStatusChange(detail.id, 'UNDER_REVIEW')}
                  className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200">
                  <Eye className="mr-1.5 inline h-4 w-4" />{t('onboardingReview') || 'Review'}
                </button>
              )}
              {['SUBMITTED', 'UNDER_REVIEW'].includes(detail.status) && (
                <>
                  <button onClick={() => handleStatusChange(detail.id, 'APPROVED')}
                    className="rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200">
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4" />{t('approve') || 'Approve'}
                  </button>
                  <button onClick={() => handleStatusChange(detail.id, 'REJECTED')}
                    className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200">
                    <XCircle className="mr-1.5 inline h-4 w-4" />{t('reject') || 'Reject'}
                  </button>
                </>
              )}
              {detail.status === 'APPROVED' && (
                <button onClick={() => handleProvision(detail.id)}
                  disabled={provisionUsers.isPending}
                  className="rounded-lg bg-[#006B3F] px-4 py-2 text-sm font-medium text-white hover:bg-[#005530] disabled:opacity-60">
                  <UserPlus className="mr-1.5 inline h-4 w-4" />
                  {provisionUsers.isPending ? (t('onboardingProvisioning') || 'Creating accounts...') : (t('onboardingProvision') || 'Create User Accounts')}
                </button>
              )}
              <button onClick={() => handleDelete(detail.id)}
                className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Provision result */}
        {provisionUsers.isSuccess && provisionUsers.data?.data && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="mb-2 font-semibold text-green-800">
              {t('onboardingProvisionResult') || 'User Provisioning Results'}
            </h3>
            <p className="text-sm text-green-700">
              {provisionUsers.data.data.created} {t('onboardingUsersCreated') || 'accounts created'}
              {provisionUsers.data.data.errors > 0 && `, ${provisionUsers.data.data.errors} errors`}
            </p>
            {provisionUsers.data.data.users?.length > 0 && (
              <div className="mt-3 max-h-40 overflow-auto rounded border border-green-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-green-50"><tr>
                    <th className="px-2 py-1 text-left">{t('emailField') || 'Email'}</th>
                    <th className="px-2 py-1 text-left">{t('onboardingTempPassword') || 'Temp Password'}</th>
                    <th className="px-2 py-1 text-left">{t('roleAris') || 'Role'}</th>
                  </tr></thead>
                  <tbody>
                    {provisionUsers.data.data.users.map((u: any) => (
                      <tr key={u.id} className="border-t border-green-100">
                        <td className="px-2 py-1">{u.email}</td>
                        <td className="px-2 py-1 font-mono">{u.temporaryPassword}</td>
                        <td className="px-2 py-1">{u.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Country info card */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="h-4 w-4 text-[#006B3F]" />{t('onboardingCountryInfo') || 'Country Info'}
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">{t('preferredLanguage') || 'Language'}</dt><dd className="font-medium">{detail.preferredLanguage}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">{t('officialLanguages') || 'Official'}</dt><dd className="font-medium">{(detail.officialLanguages || []).join(', ')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">{t('domains') || 'Domains'}</dt><dd className="font-medium">{(detail.activeDomains || []).length}</dd></div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Building2 className="h-4 w-4 text-[#006B3F]" />{t('onboardingContact') || 'Contact'}
            </h3>
            <dl className="space-y-1 text-sm">
              <div><dt className="text-gray-500">{detail.contactFullName}</dt></div>
              <div className="text-gray-500">{detail.contactTitle} - {detail.contactInstitution}</div>
              <div><a href={`mailto:${detail.contactEmail}`} className="text-blue-600 hover:underline">{detail.contactEmail}</a></div>
              <div className="text-gray-500">{detail.contactPhone}</div>
            </dl>
          </div>

          {detail.cvoName && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Shield className="h-4 w-4" />{t('cvoApproval') || 'CVO Approval'}
              </h3>
              <dl className="space-y-1 text-sm">
                <div className="font-medium text-amber-900">{detail.cvoName}</div>
                <div className="text-amber-700">{detail.cvoTitle}</div>
                {detail.cvoEmail && <div><a href={`mailto:${detail.cvoEmail}`} className="text-amber-600 hover:underline">{detail.cvoEmail}</a></div>}
              </dl>
            </div>
          )}
        </div>

        {/* Active domains */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Shield className="h-4 w-4 text-[#006B3F]" />{t('onboardingActiveDomains') || 'Active Domains'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(detail.activeDomains || []).map((d: string) => (
              <span key={d} className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800">{d}</span>
            ))}
          </div>
        </div>

        {/* Admin levels */}
        {adminLevels.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <MapPin className="h-4 w-4 text-[#006B3F]" />{t('onboardingAdminLevels') || 'Administrative Levels'}
            </h3>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('level') || 'Level'}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('denomination') || 'Name'}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('unitCount') || 'Units'}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('example') || 'Example'}</th>
                </tr>
              </thead>
              <tbody>
                {adminLevels.map((lvl: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2"><span className="rounded-full bg-[#006B3F] px-2 py-0.5 text-xs text-white">{lvl.level}</span></td>
                    <td className="px-3 py-2 font-medium">{lvl.denomination}</td>
                    <td className="px-3 py-2 text-gray-500">{lvl.unitCount}</td>
                    <td className="px-3 py-2 text-gray-500">{lvl.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Users table */}
        {users.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Users className="h-4 w-4 text-[#006B3F]" />{t('onboardingUsers') || 'User Accounts'} ({users.length})
              </h3>
              <button onClick={() => exportUsersCsv(users)}
                className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">#</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('name') || 'Name'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('emailField') || 'Email'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('roleAris') || 'Role'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('level') || 'Level'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('domains') || 'Domains'}</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">{t('supervisorName') || 'Supervisor'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium">{u.firstName} {u.lastName}</td>
                      <td className="px-2 py-1.5 text-blue-600">{u.email}</td>
                      <td className="px-2 py-1.5"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{u.role}</span></td>
                      <td className="px-2 py-1.5 text-gray-500">{u.level}{u.location ? ` - ${u.location}` : ''}</td>
                      <td className="px-2 py-1.5 text-gray-500">{u.domains}</td>
                      <td className="px-2 py-1.5 text-gray-500">{u.supervisorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Historical data */}
        {detail.hasHistoricalData && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText className="h-4 w-4 text-[#006B3F]" />{t('onboardingHistorical') || 'Historical Data'}
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-gray-500">{t('periodCovered') || 'Period'}</dt><dd className="font-medium">{detail.historicalPeriod}</dd></div>
              <div><dt className="text-gray-500">{t('dataFormat') || 'Format'}</dt><dd className="font-medium">{(detail.historicalFormat || []).join(', ')}</dd></div>
              <div><dt className="text-gray-500">{t('estimatedVolume') || 'Volume'}</dt><dd className="font-medium">{detail.historicalVolume}</dd></div>
            </dl>
          </div>
        )}

        {/* Notes */}
        {detail.notes && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">{t('notes') || 'Notes'}</h3>
            <p className="text-sm text-gray-600">{detail.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('onboardingTitle') || 'Country Onboarding'}</h1>
        <p className="text-sm text-gray-500">{t('onboardingSubtitle') || 'Review and process country activation requests'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchPlaceholder') || 'Search by country, contact...'}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-[#006B3F] focus:outline-none focus:ring-1 focus:ring-[#006B3F]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#006B3F] focus:outline-none"
          >
            <option value="">{t('allStatuses') || 'All statuses'}</option>
            {['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">{t('loading') || 'Loading...'}</div>
      ) : submissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">{t('onboardingEmpty') || 'No onboarding submissions yet'}</p>
          <p className="mt-1 text-xs text-gray-400">{t('onboardingEmptyDesc') || 'Country activation requests will appear here'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('country') || 'Country'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('status') || 'Status'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('onboardingContact') || 'Contact'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users') || 'Users'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('submittedAt') || 'Submitted'}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub: any) => (
                  <tr key={sub.id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onClick={() => setSelectedId(sub.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sub.countryName}</div>
                      {sub.countryCode && <div className="text-xs text-gray-400">{sub.countryCode}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{sub.contactFullName}</div>
                      <div className="text-xs text-gray-400">{sub.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {Array.isArray(sub.users) ? sub.users.length : 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.total > meta.limit && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{t('showingOf', { from: String((meta.page - 1) * meta.limit + 1), to: String(Math.min(meta.page * meta.limit, meta.total)), total: String(meta.total) }) || `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40">{t('previous') || 'Previous'}</button>
                <button disabled={page * meta.limit >= meta.total} onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40">{t('next') || 'Next'}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
