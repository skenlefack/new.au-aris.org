'use client';

import React from 'react';
import Link from 'next/link';
import { User, Bell, Building2, FileText, ChevronRight } from 'lucide-react';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';

const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
];

interface SettingsLink {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const SETTINGS_LINKS: SettingsLink[] = [
  {
    href: '/settings/profile',
    label: 'Profile',
    description: 'Edit your name, email, and change password',
    icon: <User className="h-5 w-5" />,
  },
  {
    href: '/settings/notifications',
    label: 'Notification Preferences',
    description: 'Configure email, SMS, and push notification settings',
    icon: <Bell className="h-5 w-5" />,
  },
  {
    href: '/settings/tenant',
    label: 'Tenant Configuration',
    description: 'Manage tenant settings, domain, and configuration',
    icon: <Building2 className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/settings/data-contracts',
    label: 'Data Contracts',
    description: 'View data contract compliance and SLA status',
    icon: <FileText className="h-5 w-5" />,
  },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const userRole = (user?.role ?? 'ANALYST') as UserRole;
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const visibleLinks = SETTINGS_LINKS.filter(
    (link) => !link.adminOnly || isAdmin,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Profile, preferences, and data contracts
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-4 rounded-card border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aris-primary-50 text-aris-primary-600">
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {link.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {link.description}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
