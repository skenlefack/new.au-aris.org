'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Bell, Mail, Smartphone, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';

const EVENT_TYPES = [
  { key: 'outbreak_new', label: 'New outbreak reported' },
  { key: 'outbreak_confirmed', label: 'Outbreak confirmed' },
  { key: 'outbreak_alert', label: 'Regional outbreak alert' },
  { key: 'workflow_approved', label: 'Workflow approved' },
  { key: 'workflow_rejected', label: 'Workflow rejected' },
  { key: 'workflow_assigned', label: 'Workflow assigned to me' },
  { key: 'quality_failed', label: 'Quality gate failure' },
  { key: 'quality_correction', label: 'Correction required' },
  { key: 'sync_completed', label: 'Data sync completed' },
  { key: 'system_maintenance', label: 'System maintenance' },
] as const;

const CHANNELS = [
  { key: 'email' as const, label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { key: 'sms' as const, label: 'SMS', icon: <Smartphone className="h-4 w-4" /> },
  { key: 'push' as const, label: 'Push', icon: <MonitorSmartphone className="h-4 w-4" /> },
] as const;

export default function NotificationPreferencesPage() {
  const { data, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const [saved, setSaved] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email: {},
    sms: {},
    push: {},
  });

  useEffect(() => {
    // API returns an array of { eventType, email, sms, push } rows.
    // Transform into the channel-grouped structure the UI expects.
    const defaults: NotificationPreferences = { email: {}, sms: {}, push: {} };
    for (const event of EVENT_TYPES) {
      defaults.email[event.key] = true;
      defaults.sms[event.key] = event.key.includes('alert') || event.key.includes('outbreak');
      defaults.push[event.key] = true;
    }

    const apiData = data?.data;
    if (Array.isArray(apiData) && apiData.length > 0) {
      for (const row of apiData) {
        if (row.eventType) {
          defaults.email[row.eventType] = !!row.email;
          defaults.sms[row.eventType] = !!row.sms;
          defaults.push[row.eventType] = !!row.push;
        }
      }
    }
    setPrefs(defaults);
  }, [data]);

  function toggle(channel: 'email' | 'sms' | 'push', eventKey: string) {
    setPrefs((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [eventKey]: !prev[channel][eventKey],
      },
    }));
  }

  function handleSave() {
    updatePrefs.mutate(prefs, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  }

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Notification Preferences
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose how you want to be notified for each event type
        </p>
      </div>

      <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Event Type
              </th>
              {CHANNELS.map((ch) => (
                <th
                  key={ch.key}
                  className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500"
                >
                  <span className="inline-flex items-center gap-1">
                    {ch.icon}
                    {ch.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EVENT_TYPES.map((event) => (
              <tr key={event.key} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{event.label}</td>
                {CHANNELS.map((ch) => (
                  <td key={ch.key} className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(ch.key, event.key)}
                      className={cn(
                        'h-5 w-9 rounded-full transition-colors',
                        prefs[ch.key][event.key]
                          ? 'bg-aris-primary-600'
                          : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                          prefs[ch.key][event.key]
                            ? 'translate-x-4.5 ml-[18px]'
                            : 'translate-x-0.5 ml-[2px]',
                        )}
                      />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updatePrefs.isPending}
          className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && (
          <span className="text-xs text-green-600">Preferences saved!</span>
        )}
      </div>
    </div>
  );
}
