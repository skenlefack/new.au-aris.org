'use client';

import { useTranslations } from '@/lib/i18n/translations';
import { RecCard } from './RecCard';
import { LoginPanel } from './LoginPanel';
import type { RecConfig } from '@/data/recs-config';

interface ContinentalContentProps {
  recs: RecConfig[];
}

export function ContinentalContent({ recs }: ContinentalContentProps) {
  const t = useTranslations('landing');

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Left: RECs */}
        <div className="flex-1">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('recsTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('recsSelectDesc')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {recs.map((rec) => (
              <RecCard key={rec.code} rec={rec} />
            ))}
          </div>
        </div>

        {/* Right: Login Panel (sticky sidebar) */}
        <div className="lg:w-[380px] lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <div id="login-panel" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <LoginPanel
                context={{
                  level: 'continental',
                  name: 'ARIS Continental',
                }}
              />
            </div>

            {/* Quick links under login */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('quickAccess')}
              </h4>
              <div className="space-y-2 text-sm">
                <QuickLink label={t('outbreakMap')} desc={t('outbreakMapDesc')} color="#C62828" />
                <QuickLink label={t('dataQualityLink')} desc={t('dataQualityLinkDesc')} color="#F57F17" />
                <QuickLink href="/knowledge" label={t('knowledgePortal')} desc={t('knowledgePortalDesc')} color="#1B5E20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickLink({ label, desc, color, href }: { label: string; desc: string; color: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white dark:hover:bg-gray-700">
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }
  return inner;
}
