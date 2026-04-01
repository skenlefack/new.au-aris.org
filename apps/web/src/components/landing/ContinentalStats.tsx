'use client';

import { resolveIcon } from '@/lib/lucide-icon-map';
import { Layers } from 'lucide-react';
import { useLocaleStore } from '@/lib/stores/locale-store';

export interface PublicDomain {
  code: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  icon: string;
  color: string;
}

/** Fallback domains when the API is unavailable — must match governance.domains DB */
const FALLBACK_DOMAINS: PublicDomain[] = [
  { code: 'governance', name: { en: 'Governance & Capacities', fr: 'Gouvernance et capacités', pt: 'Governança e Capacidades' }, icon: 'Building2', color: '#6B21A8', description: { en: 'Legal frameworks, veterinary services evaluation, PVS metrics, and institutional capacity building.', fr: 'Cadres juridiques, évaluation des services vétérinaires, indicateurs PVS et renforcement des capacités institutionnelles.', pt: 'Quadros legais, avaliação de serviços veterinários, métricas PVS e capacitação institucional.' } },
  { code: 'animal-health', name: { en: 'Animal Health & One Health', fr: 'Santé animale et One Health', pt: 'Saúde Animal e One Health' }, icon: 'HeartPulse', color: '#C62828', description: { en: 'Disease surveillance, outbreak management, laboratory results, vaccination campaigns, and antimicrobial resistance monitoring.', fr: 'Surveillance des maladies, gestion des foyers, résultats de laboratoire, campagnes de vaccination et surveillance de la résistance aux antimicrobiens.', pt: 'Vigilância de doenças, gestão de surtos, resultados laboratoriais, campanhas de vacinação e monitorização da resistência antimicrobiana.' } },
  { code: 'livestock-prod', name: { en: 'Production & Pastoralism', fr: 'Production et pastoralisme', pt: 'Produção e Pastoralismo' }, icon: 'Wheat', color: '#E65100', description: { en: 'Livestock census, production systems, slaughterhouse data, and transhumance corridor management.', fr: "Recensement du bétail, systèmes de production, données d\u2019abattage et gestion des corridors de transhumance.", pt: 'Recenseamento pecuário, sistemas de produção, dados de abate e gestão de corredores de transumância.' } },
  { code: 'trade-sps', name: { en: 'Trade, Markets & SPS', fr: 'Commerce, marchés et SPS', pt: 'Comércio, Mercados e SPS' }, icon: 'TrendingUp', color: '#1565C0', description: { en: 'Trade flows, SPS certification, market price intelligence, and AfCFTA integration support.', fr: "Flux commerciaux, certification SPS, intelligence des prix de marché et soutien à l\u2019intégration ZLECAf.", pt: 'Fluxos comerciais, certificação SPS, inteligência de preços de mercado e suporte à integração ZLECAf.' } },
  { code: 'fisheries', name: { en: 'Fisheries & Aquaculture', fr: 'Pêches et aquaculture', pt: 'Pescas e Aquicultura' }, icon: 'Fish', color: '#00838F', description: { en: 'Capture fisheries, fishing fleet management, aquaculture farms, and aquatic animal health.', fr: 'Pêche de capture, gestion de la flotte de pêche, fermes aquacoles et santé des animaux aquatiques.', pt: 'Pesca de captura, gestão de frotas pesqueiras, fazendas de aquicultura e saúde de animais aquáticos.' } },
  { code: 'wildlife', name: { en: 'Wildlife & Biodiversity', fr: 'Faune sauvage et biodiversité', pt: 'Vida Selvagem e Biodiversidade' }, icon: 'TreePine', color: '#2E7D32', description: { en: 'Wildlife inventories, protected area management, CITES permits, and human-wildlife conflict resolution.', fr: 'Inventaires de la faune, gestion des aires protégées, permis CITES et résolution des conflits homme-faune.', pt: 'Inventários de vida selvagem, gestão de áreas protegidas, licenças CITES e resolução de conflitos homem-fauna.' } },
  { code: 'apiculture', name: { en: 'Apiculture & Pollination', fr: 'Apiculture et pollinisation', pt: 'Apicultura e Polinização' }, icon: 'Bug', color: '#F9A825', description: { en: 'Apiary management, honey and hive product production, colony health monitoring, and beekeeper training.', fr: 'Gestion des ruchers, production de miel et produits de la ruche, suivi de la santé des colonies et formation des apiculteurs.', pt: 'Gestão de apiários, produção de mel e produtos da colmeia, monitorização da saúde das colónias e formação de apicultores.' } },
  { code: 'climate-env', name: { en: 'Climate & Environment', fr: 'Climat et environnement', pt: 'Clima e Ambiente' }, icon: 'Cloud', color: '#00695C', description: { en: 'Water stress monitoring, rangeland condition assessment, GHG tracking, and vulnerability hotspot mapping.', fr: "Suivi du stress hydrique, évaluation de l\u2019état des parcours, suivi des GES et cartographie des zones vulnérables.", pt: 'Monitorização do estresse hídrico, avaliação da condição das pastagens, rastreamento de GEE e mapeamento de pontos de vulnerabilidade.' } },
  { code: 'knowledge-hub', name: { en: 'Knowledge Management', fr: 'Gestion des connaissances', pt: 'Gestão do Conhecimento' }, icon: 'BookOpen', color: '#4527A0', description: { en: 'Knowledge base, e-repository, e-learning platform, policy briefs, and monitoring/evaluation/learning.', fr: "Base de connaissances, e-référentiel, plateforme e-learning, notes de politique et suivi/évaluation/apprentissage.", pt: 'Base de conhecimento, e-repositório, plataforma de e-learning, notas de política e monitorização/avaliação/aprendizagem.' } },
];

interface ContinentalStatsProps {
  domains?: PublicDomain[];
}

export function ContinentalStats({ domains }: ContinentalStatsProps) {
  const locale = useLocaleStore((s) => s.locale);
  const list = domains && domains.length > 0 ? domains : FALLBACK_DOMAINS;

  // Responsive: max 9 cols on large screens, adapt to actual count
  const colClass =
    list.length <= 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : list.length <= 6
        ? 'grid-cols-3 sm:grid-cols-6'
        : list.length <= 9
          ? 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9'
          : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9';

  return (
    <section className="border-t border-gray-100 bg-gray-50 py-6 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className={`grid gap-3 ${colClass}`}>
          {list.map((d) => {
            const Icon = resolveIcon(d.icon);
            const label = d.name?.[locale] ?? d.name?.en ?? d.code;
            const desc = d.description?.[locale] ?? d.description?.en ?? '';
            return (
              <div
                key={d.code}
                className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-gray-200/80 bg-white px-3 py-4 text-center shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ backgroundColor: d.color }}
                />
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-110 group-hover:shadow-md"
                  style={{ backgroundColor: `${d.color}12`, color: d.color }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <p className="mt-2.5 text-xs font-bold text-gray-800 dark:text-white">
                  {label}
                </p>
                {desc && (
                  <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                    {desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
