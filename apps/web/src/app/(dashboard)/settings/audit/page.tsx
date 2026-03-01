'use client';

import React from 'react';
import { Clock, User, Settings, Globe, Flag } from 'lucide-react';

export default function AuditLogPage() {
  // Audit log will be populated once the backend audit trail is connected
  // For now, show a placeholder with the expected structure

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track all configuration changes and administrative actions
        </p>
      </div>

      {/* Placeholder entries */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {PLACEHOLDER_ENTRIES.map((entry, idx) => (
            <div key={idx} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                {entry.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-medium">{entry.actor}</span>{' '}
                  <span className="text-gray-500 dark:text-gray-400">{entry.action}</span>{' '}
                  <span className="font-medium">{entry.target}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <Clock className="h-3 w-3" />
                  {entry.time}
                </p>
              </div>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {entry.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Audit entries are generated automatically when settings are modified.
      </p>
    </div>
  );
}

const PLACEHOLDER_ENTRIES = [
  {
    actor: 'admin@au-aris.org',
    action: 'updated security config',
    target: 'security.mfa.required',
    time: 'Just now',
    type: 'CONFIG',
    icon: <Settings className="h-4 w-4 text-gray-400" />,
  },
  {
    actor: 'admin@au-aris.org',
    action: 'updated REC stats for',
    target: 'ECOWAS',
    time: '2 hours ago',
    type: 'REC',
    icon: <Globe className="h-4 w-4 text-gray-400" />,
  },
  {
    actor: 'admin@ke.au-aris.org',
    action: 'updated country sectors for',
    target: 'Kenya',
    time: '1 day ago',
    type: 'COUNTRY',
    icon: <Flag className="h-4 w-4 text-gray-400" />,
  },
  {
    actor: 'admin@au-aris.org',
    action: 'changed platform name to',
    target: 'ARIS 3.0',
    time: '3 days ago',
    type: 'CONFIG',
    icon: <Settings className="h-4 w-4 text-gray-400" />,
  },
];
