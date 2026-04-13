/**
 * Resolve the tenant API base URL:
 * - NEXT_PUBLIC_TENANT_API_URL if explicitly set
 * - Server-side (Node.js): Docker internal network URL
 * - Client-side (browser): NEXT_PUBLIC_API_URL or same-origin (empty)
 */
const API_BASE = process.env['NEXT_PUBLIC_TENANT_API_URL']
  || (typeof window === 'undefined'
    ? (process.env['INTERNAL_TENANT_URL'] || 'http://aris-tenant:3001')
    : (process.env['NEXT_PUBLIC_API_URL'] || ''));

export async function getPublicRecs() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/recs`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // API unavailable, fall through to static data
  }
  // Fallback to static data
  const { getAllRecs } = await import('@/data/recs-config');
  const recs = getAllRecs();
  return {
    data: recs.map((r) => ({
      id: r.code,
      code: r.code,
      name: { en: r.name },
      fullName: { en: r.fullName },
      description: { en: r.description },
      region: { en: r.region },
      headquarters: r.headquarters,
      established: r.establishedYear,
      accentColor: r.color,
      isActive: true,
      _count: { countries: r.memberCount },
      _static: true,
    })),
  };
}

export async function getPublicRecByCode(code: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/recs/${code}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // fallback
  }
  const { getRec } = await import('@/data/recs-config');
  const { getCountriesByRec } = await import('@/data/countries-config');
  const rec = getRec(code);
  if (!rec) return { data: null };
  const countries = getCountriesByRec(code);
  return {
    data: {
      id: rec.code,
      code: rec.code,
      name: { en: rec.name },
      fullName: { en: rec.fullName },
      description: { en: rec.description },
      region: { en: rec.region },
      headquarters: rec.headquarters,
      established: rec.establishedYear,
      accentColor: rec.color,
      isActive: true,
      countries: countries.map((c) => ({
        country: {
          id: c.code,
          code: c.code,
          name: { en: c.name },
          capital: { en: c.capital },
          flag: c.flag,
          population: Math.round(c.population * 1_000_000),
          tenantId: c.tenantId ?? null,
          isActive: true,
        },
      })),
      activeCount: 0,
      interopCount: 0,
      _static: true,
    },
  };
}

export async function getPublicCountryByCode(code: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/countries/${code}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // fallback
  }
  const { getCountry } = await import('@/data/countries-config');
  const { getRecsForCountry } = await import('@/data/recs-config');
  const country = getCountry(code);
  if (!country) return { data: null };
  const recs = getRecsForCountry(code);
  return {
    data: {
      id: country.code,
      code: country.code,
      name: { en: country.name },
      capital: { en: country.capital },
      flag: country.flag,
      population: Math.round(country.population * 1_000_000),
      timezone: country.timezone,
      languages: country.languages,
      tenantId: country.tenantId ?? null,
      isActive: true,
      isOperational: !!country.tenantId,
      statistics: [],
      kpiScores: [],
      hasInterop: false,
      recs: recs.map((r) => ({
        rec: {
          code: r.code,
          name: { en: r.name },
          accentColor: r.color,
          region: { en: r.region },
        },
      })),
      _static: true,
    },
  };
}

export async function getPublicStats() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/stats`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // fallback
  }
  return {
    data: {
      totalCountries: 55,
      totalRecs: 8,
      operationalCountries: 5,
      totalPopulation: 1_400_000_000,
    },
  };
}

/** Fallback domains shown when the API is unreachable (e.g. during Docker build) */
const FALLBACK_DOMAINS = [
  { code: 'animal-health', name: { en: 'Animal Health', fr: 'Santé animale', pt: 'Saúde Animal' }, icon: 'HeartPulse', color: '#C62828', sortOrder: 1, description: { en: 'Disease surveillance, outbreak management, laboratory results, vaccination campaigns, and antimicrobial resistance monitoring.', fr: 'Surveillance des maladies, gestion des foyers, résultats de laboratoire, campagnes de vaccination et surveillance de la résistance aux antimicrobiens.', pt: 'Vigilância de doenças, gestão de surtos, resultados laboratoriais, campanhas de vacinação e monitorização da resistência antimicrobiana.' } },
  { code: 'livestock-prod', name: { en: 'Livestock & Production', fr: 'Élevage & Production', pt: 'Pecuária & Produção' }, icon: 'Wheat', color: '#E65100', sortOrder: 2, description: { en: 'Livestock census, production systems, slaughterhouse data, and transhumance corridor management.', fr: "Recensement du bétail, systèmes de production, données d'abattage et gestion des corridors de transhumance.", pt: 'Recenseamento pecuário, sistemas de produção, dados de abate e gestão de corredores de transumância.' } },
  { code: 'fisheries', name: { en: 'Fisheries & Aquaculture', fr: 'Pêches & Aquaculture', pt: 'Pescas & Aquicultura' }, icon: 'Fish', color: '#00838F', sortOrder: 3, description: { en: 'Capture fisheries, fishing fleet management, aquaculture farms, and aquatic animal health.', fr: 'Pêche de capture, gestion de la flotte de pêche, fermes aquacoles et santé des animaux aquatiques.', pt: 'Pesca de captura, gestão de frotas pesqueiras, fazendas de aquicultura e saúde de animais aquáticos.' } },
  { code: 'trade-sps', name: { en: 'Trade & SPS', fr: 'Commerce & SPS', pt: 'Comércio & SPS' }, icon: 'TrendingUp', color: '#1565C0', sortOrder: 4, description: { en: 'Trade flows, SPS certification, market price intelligence, and AfCFTA integration support.', fr: "Flux commerciaux, certification SPS, intelligence des prix de marché et soutien à l'intégration ZLECAf.", pt: 'Fluxos comerciais, certificação SPS, inteligência de preços de mercado e suporte à integração ZLECAf.' } },
  { code: 'governance', name: { en: 'Governance', fr: 'Gouvernance', pt: 'Governança' }, icon: 'Building2', color: '#6B21A8', sortOrder: 5, description: { en: 'Legal frameworks, veterinary services evaluation, PVS metrics, and institutional capacity building.', fr: 'Cadres juridiques, évaluation des services vétérinaires, indicateurs PVS et renforcement des capacités institutionnelles.', pt: 'Quadros legais, avaliação de serviços veterinários, métricas PVS e capacitação institucional.' } },
  { code: 'wildlife', name: { en: 'Wildlife', fr: 'Faune sauvage', pt: 'Vida Selvagem' }, icon: 'TreePine', color: '#2E7D32', sortOrder: 6, description: { en: 'Wildlife inventories, protected area management, CITES permits, and human-wildlife conflict resolution.', fr: 'Inventaires de la faune, gestion des aires protégées, permis CITES et résolution des conflits homme-faune.', pt: 'Inventários de vida selvagem, gestão de áreas protegidas, licenças CITES e resolução de conflitos homem-fauna.' } },
  { code: 'apiculture', name: { en: 'Apiculture', fr: 'Apiculture', pt: 'Apicultura' }, icon: 'Bug', color: '#F9A825', sortOrder: 7, description: { en: 'Apiary management, honey and hive product production, colony health monitoring, and beekeeper training.', fr: 'Gestion des ruchers, production de miel et produits de la ruche, suivi de la santé des colonies et formation des apiculteurs.', pt: 'Gestão de apiários, produção de mel e produtos da colmeia, monitorização da saúde das colónias e formação de apicultores.' } },
  { code: 'climate-env', name: { en: 'Climate & Environment', fr: 'Climat & Environnement', pt: 'Clima & Ambiente' }, icon: 'Cloud', color: '#00695C', sortOrder: 8, description: { en: 'Water stress monitoring, rangeland condition assessment, GHG tracking, and vulnerability hotspot mapping.', fr: "Suivi du stress hydrique, évaluation de l'état des parcours, suivi des GES et cartographie des zones vulnérables.", pt: 'Monitorização do estresse hídrico, avaliação da condição das pastagens, rastreamento de GEE e mapeamento de pontos de vulnerabilidade.' } },
  { code: 'knowledge-hub', name: { en: 'Knowledge', fr: 'Connaissances', pt: 'Conhecimento' }, icon: 'BookOpen', color: '#4527A0', sortOrder: 9, description: { en: 'Knowledge base, e-repository, e-learning platform, policy briefs, and monitoring/evaluation/learning.', fr: 'Base de connaissances, e-référentiel, plateforme e-learning, notes de politique et suivi/évaluation/apprentissage.', pt: 'Base de conhecimento, e-repositório, plataforma de e-learning, notas de política e monitorização/avaliação/aprendizagem.' } },
];

export async function getPublicDomains() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/domains`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // API unavailable (e.g. during Docker build)
  }
  return { data: FALLBACK_DOMAINS };
}
