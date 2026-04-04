'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Mail, Smartphone, MonitorSmartphone, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useSendTestEmail,
  type NotificationPreferences,
} from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';

// WhatsApp SVG icon (brand icon)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Telegram SVG icon (brand icon)
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const EVENT_CATEGORIES = [
  {
    key: 'alerts',
    labelKey: 'categoryAlerts',
    events: [
      { key: 'alert_new', tKey: 'alertNew' },
      { key: 'alert_confirmed', tKey: 'alertConfirmed' },
      { key: 'alert_regional', tKey: 'alertRegional' },
    ],
  },
  {
    key: 'workflow',
    labelKey: 'categoryWorkflow',
    events: [
      { key: 'workflow_approved', tKey: 'workflowApproved' },
      { key: 'workflow_rejected', tKey: 'workflowRejected' },
      { key: 'workflow_assigned', tKey: 'workflowAssigned' },
    ],
  },
  {
    key: 'quality',
    labelKey: 'categoryQuality',
    events: [
      { key: 'quality_failed', tKey: 'qualityFailed' },
      { key: 'quality_correction', tKey: 'qualityCorrectionRequired' },
    ],
  },
  {
    key: 'system',
    labelKey: 'categorySystem',
    events: [
      { key: 'sync_completed', tKey: 'syncCompleted' },
      { key: 'system_maintenance', tKey: 'systemMaintenance' },
    ],
  },
] as const;

const ALL_EVENT_KEYS = EVENT_CATEGORIES.flatMap(
  (cat) => cat.events as ReadonlyArray<{ readonly key: string; readonly tKey: string }>,
);

type ChannelKey = 'email' | 'sms' | 'push' | 'whatsapp' | 'telegram';

const CHANNELS: { key: ChannelKey; labelKey: string; icon: React.ReactNode; color: string }[] = [
  { key: 'email', labelKey: 'channelEmail', icon: <Mail className="h-4 w-4" />, color: 'text-blue-600' },
  { key: 'sms', labelKey: 'channelSms', icon: <Smartphone className="h-4 w-4" />, color: 'text-gray-600' },
  { key: 'push', labelKey: 'channelPush', icon: <MonitorSmartphone className="h-4 w-4" />, color: 'text-purple-600' },
  { key: 'whatsapp', labelKey: 'channelWhatsapp', icon: <WhatsAppIcon className="h-4 w-4" />, color: 'text-green-600' },
  { key: 'telegram', labelKey: 'channelTelegram', icon: <TelegramIcon className="h-4 w-4" />, color: 'text-sky-500' },
];

export default function NotificationPreferencesPage() {
  const t = useTranslations('settings');
  const userEmail = useAuthStore((s) => s.user?.email ?? '');
  const { data, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const testEmail = useSendTestEmail();
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email: {},
    sms: {},
    push: {},
    whatsapp: {},
    telegram: {},
  });

  useEffect(() => {
    const defaults: NotificationPreferences = {
      email: {},
      sms: {},
      push: {},
      whatsapp: {},
      telegram: {},
    };
    for (const event of ALL_EVENT_KEYS) {
      defaults.email[event.key] = true;
      defaults.sms[event.key] = event.key.includes('alert') || event.key.includes('regional');
      defaults.push[event.key] = true;
      defaults.whatsapp[event.key] = false;
      defaults.telegram[event.key] = false;
    }

    const apiData = data?.data;
    if (Array.isArray(apiData) && apiData.length > 0) {
      for (const row of apiData) {
        if (row.eventType) {
          defaults.email[row.eventType] = !!row.email;
          defaults.sms[row.eventType] = !!row.sms;
          defaults.push[row.eventType] = !!row.push;
          defaults.whatsapp[row.eventType] = !!row.whatsapp;
          defaults.telegram[row.eventType] = !!row.telegram;
        }
      }
    }
    setPrefs(defaults);
  }, [data]);

  function toggle(channel: ChannelKey, eventKey: string) {
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

  function handleTestEmail() {
    const to = userEmail || '';
    if (!to) return;
    setTestResult(null);
    testEmail.mutate(to, {
      onSuccess: (res) => {
        const ok = res?.data?.success ?? false;
        setTestResult({
          ok,
          msg: ok
            ? `Email envoyé à ${to} (ID: ${res?.data?.messageId ?? '—'})`
            : `Échec: ${res?.data?.error ?? 'Erreur inconnue'}`,
        });
      },
      onError: (err: unknown) => {
        setTestResult({
          ok: false,
          msg: err instanceof Error ? err.message : 'Erreur réseau',
        });
      },
    });
  }

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSettings')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {t('notificationPreferences')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('notificationPreferencesDesc')}
        </p>
      </div>

      {/* Preferences table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto dark:border-gray-700 dark:bg-gray-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('eventType')}
              </th>
              {CHANNELS.map((ch) => (
                <th
                  key={ch.key}
                  className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  <span className={cn('inline-flex items-center gap-1', ch.color)}>
                    {ch.icon}
                    <span className="hidden sm:inline">{t(ch.labelKey as any)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {EVENT_CATEGORIES.map((cat) => (
              <>
                <tr key={`cat-${cat.key}`} className="bg-gray-50/80 dark:bg-gray-800/40">
                  <td
                    colSpan={CHANNELS.length + 1}
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {t(cat.labelKey as any)}
                  </td>
                </tr>
                {cat.events.map((event) => (
                  <tr key={event.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 pl-6 text-gray-900 dark:text-gray-100">{t(event.tKey as any)}</td>
                    {CHANNELS.map((ch) => (
                      <td key={ch.key} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(ch.key, event.key)}
                          aria-label={`Toggle ${ch.key} for ${event.key}`}
                          className={cn(
                            'h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
                            prefs[ch.key][event.key]
                              ? 'bg-aris-primary-600 focus:ring-aris-primary-500'
                              : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-400',
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
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save preferences */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={updatePrefs.isPending}
          className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {updatePrefs.isPending ? t('saving') : t('savePreferences')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('preferencesSaved')}
          </span>
        )}
      </div>

      {/* Postmark / email test */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t('testEmailDelivery')}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('testEmailDeliveryDesc')}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testEmail.isPending || !userEmail}
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
              >
                {testEmail.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                {testEmail.isPending ? t('sending') : t('sendTestEmail')} {userEmail && `→ ${userEmail}`}
              </button>
            </div>
            {testResult && (
              <div className={cn(
                'mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs',
                testResult.ok
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
              )}>
                {testResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
