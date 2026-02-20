'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Building2, Globe, Settings, Shield } from 'lucide-react';
import { useTenantConfig, useUpdateTenantConfig } from '@/lib/api/hooks';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { DetailSkeleton } from '@/components/ui/Skeleton';

const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
];

export default function TenantSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const userRole = (user?.role ?? 'ANALYST') as UserRole;
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const { data, isLoading } = useTenantConfig();
  const updateConfig = useUpdateTenantConfig();
  const tenant = data?.data;

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setDomain(tenant.domain);
    }
  }, [tenant]);

  function handleSave() {
    updateConfig.mutate(
      { name, domain },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="rounded-card border border-red-200 bg-red-50 p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm font-medium text-red-700">
            Access Denied
          </p>
          <p className="mt-1 text-xs text-red-500">
            Only administrators can manage tenant configuration.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Tenant Configuration
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization&apos;s settings
        </p>
      </div>

      <div className="rounded-card border border-gray-200 bg-white p-6 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Building2 className="h-4 w-4" />
          Organization Details
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {tenant && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Code
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600">
                {tenant.code}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Level
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 capitalize">
                {tenant.level.replace(/_/g, ' ')}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {tenant.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tenant ID
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-500 truncate">
                {tenant.id}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
          {saved && (
            <span className="text-xs text-green-600">
              Configuration saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
