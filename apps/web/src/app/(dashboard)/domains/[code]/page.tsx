'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useDomainStore, type Domain } from '@/lib/stores/domain-store';
import { useDomainSummary } from '@/lib/api/domain-summary-hooks';
import { DomainKpiBar } from '@/components/domain/DomainKpiBar';
import { DomainSynthesis } from '@/components/domain/DomainSynthesis';
import { DomainActivityFeed } from '@/components/domain/DomainActivityFeed';
import { PlanningsSection } from '@/components/domain/PlanningsSection';
import { SubDomainsGrid } from '@/components/domain/SubDomainsGrid';
import { usePageReady } from '@/components/ui/PageLoader';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* -- Domain metadata for colors / descriptions -- */

const DOMAIN_META: Record<string, { color: string; description: Record<string, string> }> = {
  'animal-health': {
    color: '#C62828',
    description: { en: 'Surveillance, outbreaks, laboratory, vaccination, AMR', fr: 'Surveillance, foyers, laboratoire, vaccination, RAM', pt: 'Vigilância, surtos, laboratório, vacinação, RAM', ar: 'المراقبة، البؤر، المختبر، التطعيم، مقاومة مضادات الميكروبات' },
  },
  'livestock-prod': {
    color: '#E65100',
    description: { en: 'Census, production systems, transhumance corridors', fr: 'Recensement, systèmes de production, couloirs de transhumance', pt: 'Censo, sistemas de produção, corredores de transumância', ar: 'التعداد، أنظمة الإنتاج، ممرات الترحال' },
  },
  fisheries: {
    color: '#0277BD',
    description: { en: 'Captures, fleet, licenses, aquaculture, aquatic health', fr: 'Captures, flotte, licences, aquaculture, santé aquatique', pt: 'Capturas, frota, licenças, aquicultura, saúde aquática', ar: 'المصيد، الأسطول، التراخيص، الاستزراع المائي، الصحة المائية' },
  },
  'trade-sps': {
    color: '#2E7D32',
    description: { en: 'Trade flows, SPS certification, market intelligence', fr: 'Flux commerciaux, certification SPS, veille commerciale', pt: 'Fluxos comerciais, certificação SPS, inteligência de mercado', ar: 'التدفقات التجارية، شهادات SPS، معلومات السوق' },
  },
  governance: {
    color: '#4527A0',
    description: { en: 'Legal frameworks, veterinary capacities, PVS metrics', fr: 'Cadres juridiques, capacités vétérinaires, indicateurs PVS', pt: 'Quadros jurídicos, capacidades veterinárias, indicadores PVS', ar: 'الأطر القانونية، القدرات البيطرية، مؤشرات PVS' },
  },
  wildlife: {
    color: '#795548',
    description: { en: 'Inventories, protected areas, CITES, human-wildlife conflict', fr: 'Inventaires, aires protégées, CITES, conflits homme-faune', pt: 'Inventários, áreas protegidas, CITES, conflitos homem-fauna', ar: 'الجرد، المناطق المحمية، اتفاقية CITES، صراعات الإنسان والحياة البرية' },
  },
  apiculture: {
    color: '#F9A825',
    description: { en: 'Apiaries, honey production, colony health', fr: 'Ruchers, production de miel, santé des colonies', pt: 'Apiários, produção de mel, saúde das colónias', ar: 'المناحل، إنتاج العسل، صحة المستعمرات' },
  },
  'climate-env': {
    color: '#00695C',
    description: { en: 'Water stress, rangelands, GHG, vulnerability hotspots', fr: 'Stress hydrique, pâturages, GES, zones de vulnérabilité', pt: 'Stress hídrico, pastagens, GEE, zonas de vulnerabilidade', ar: 'الإجهاد المائي، المراعي، غازات الاحتباس الحراري، مناطق الضعف' },
  },
  'knowledge-hub': {
    color: '#1565C0',
    description: { en: 'Portal, e-repository, briefs, monitoring & evaluation', fr: 'Portail, dépôt numérique, notes, suivi et évaluation', pt: 'Portal, repositório digital, resumos, monitorização e avaliação', ar: 'البوابة، المستودع الرقمي، الموجزات، المتابعة والتقييم' },
  },
};

export default function DomainPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const allDomains = useDomainStore((s) => s.allDomains);
  const userDomains = useDomainStore((s) => s.userDomains);

  const domain: Domain | undefined =
    allDomains.find((d) => d.code === code) ??
    userDomains.find((d) => d.code === code);

  const locale = useLocaleStore((s) => s.locale);
  const meta = DOMAIN_META[code] ?? { color: '#1F4E79', description: {} };
  const domainName =
    domain?.name?.[locale] ?? domain?.name?.en ?? domain?.name?.fr ?? code.replace(/-/g, ' ');
  const domainDescription = meta.description[locale] ?? meta.description.en ?? '';

  const { data: summaryRes, isLoading } = useDomainSummary(code);
  const summary = summaryRes?.data ?? null;

  // Signal to the route-change loader that the page is ready
  usePageReady(!isLoading);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header — renders instantly, no API dependency */}
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: `${meta.color}30`,
          background: `linear-gradient(135deg, ${meta.color}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
              style={{ backgroundColor: meta.color }}
            >
              {domainName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {domainName}
              </h1>
              {domainDescription && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {domainDescription}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/my-dashboards?domain=${code}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboards avances
          </Link>
        </div>
      </div>

      {/* KPI Bar — has built-in loading skeleton */}
      <DomainKpiBar kpis={summary?.kpis ?? null} loading={isLoading} />

      {/* Visual Synthesis — has built-in loading skeleton */}
      <DomainSynthesis synthesis={summary?.synthesis ?? null} loading={isLoading} domainColor={meta.color} />

      {/* Sub-domains Grid — fetches its own data independently */}
      <SubDomainsGrid domainCode={code} />

      {/* Plannings — fetches its own data independently */}
      <PlanningsSection target={{ domainCode: code }} />

      {/* Recent Activity — has built-in loading skeleton */}
      <DomainActivityFeed activities={summary?.recentActivity ?? null} loading={isLoading} domainColor={meta.color} />
    </div>
  );
}
