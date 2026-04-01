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

export async function getPublicDomains() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/domains`, {
      next: { revalidate: 300 },
    });
    if (res.ok) return res.json();
  } catch {
    // fallback
  }
  return {
    data: [
      { code: 'governance', name: { en: 'Governance', fr: 'Gouvernance', pt: 'Governan\u00e7a' }, description: { en: 'Legal frameworks, veterinary services evaluation, PVS metrics, and institutional capacity building.', fr: 'Cadres juridiques, \u00e9valuation des services v\u00e9t\u00e9rinaires, indicateurs PVS et renforcement des capacit\u00e9s institutionnelles.', pt: 'Quadros legais, avalia\u00e7\u00e3o de servi\u00e7os veterin\u00e1rios, m\u00e9tricas PVS e capacita\u00e7\u00e3o institucional.' }, color: '#6B21A8', icon: 'Building2' },
      { code: 'animal-health', name: { en: 'Animal Health', fr: 'Sant\u00e9 animale', pt: 'Sa\u00fade Animal' }, description: { en: 'Disease surveillance, outbreak management, laboratory results, vaccination campaigns, and antimicrobial resistance monitoring.', fr: 'Surveillance des maladies, gestion des foyers, r\u00e9sultats de laboratoire, campagnes de vaccination et surveillance de la r\u00e9sistance aux antimicrobiens.', pt: 'Vigil\u00e2ncia de doen\u00e7as, gest\u00e3o de surtos, resultados laboratoriais, campanhas de vacina\u00e7\u00e3o e monitoriza\u00e7\u00e3o da resist\u00eancia antimicrobiana.' }, color: '#C62828', icon: 'HeartPulse' },
      { code: 'livestock-prod', name: { en: 'Livestock', fr: '\u00c9levage', pt: 'Pecu\u00e1ria' }, description: { en: 'Livestock census, production systems, slaughterhouse data, and transhumance corridor management.', fr: "Recensement du b\u00e9tail, syst\u00e8mes de production, donn\u00e9es d'abattage et gestion des corridors de transhumance.", pt: 'Recenseamento pecu\u00e1rio, sistemas de produ\u00e7\u00e3o, dados de abate e gest\u00e3o de corredores de transumancia.' }, color: '#E65100', icon: 'Wheat' },
      { code: 'trade-sps', name: { en: 'Trade & SPS', fr: 'Commerce & SPS', pt: 'Com\u00e9rcio & SPS' }, description: { en: 'Trade flows, SPS certification, market price intelligence, and AfCFTA integration support.', fr: "Flux commerciaux, certification SPS, intelligence des prix de march\u00e9 et soutien \u00e0 l'int\u00e9gration ZLECAf.", pt: 'Fluxos comerciais, certifica\u00e7\u00e3o SPS, intelig\u00eancia de pre\u00e7os de mercado e suporte \u00e0 integra\u00e7\u00e3o ZLECAf.' }, color: '#1565C0', icon: 'TrendingUp' },
      { code: 'fisheries', name: { en: 'Fisheries', fr: 'P\u00eaches', pt: 'Pescas' }, description: { en: 'Capture fisheries, fishing fleet management, aquaculture farms, and aquatic animal health.', fr: "P\u00eache de capture, gestion de la flotte de p\u00eache, fermes aquacoles et sant\u00e9 des animaux aquatiques.", pt: 'Pesca de captura, gest\u00e3o de frotas pesqueiras, fazendas de aquicultura e sa\u00fade de animais aqu\u00e1ticos.' }, color: '#00838F', icon: 'Fish' },
      { code: 'wildlife', name: { en: 'Wildlife', fr: 'Faune sauvage', pt: 'Vida Selvagem' }, description: { en: 'Wildlife inventories, protected area management, CITES permits, and human-wildlife conflict resolution.', fr: "Inventaires de la faune, gestion des aires prot\u00e9g\u00e9es, permis CITES et r\u00e9solution des conflits homme-faune.", pt: 'Invent\u00e1rios de vida selvagem, gest\u00e3o de \u00e1reas protegidas, licen\u00e7as CITES e resolu\u00e7\u00e3o de conflitos homem-fauna.' }, color: '#2E7D32', icon: 'TreePine' },
      { code: 'apiculture', name: { en: 'Apiculture', fr: 'Apiculture', pt: 'Apicultura' }, description: { en: 'Apiary management, honey and hive product production, colony health monitoring, and beekeeper training.', fr: "Gestion des ruchers, production de miel et produits de la ruche, suivi de la sant\u00e9 des colonies et formation des apiculteurs.", pt: 'Gest\u00e3o de api\u00e1rios, produ\u00e7\u00e3o de mel e produtos da colmeia, monitoriza\u00e7\u00e3o da sa\u00fade das col\u00f3nias e forma\u00e7\u00e3o de apicultores.' }, color: '#F9A825', icon: 'Bug' },
      { code: 'climate-env', name: { en: 'Climate & Env', fr: 'Climat & Env', pt: 'Clima & Amb' }, description: { en: 'Water stress monitoring, rangeland condition assessment, GHG tracking, and vulnerability hotspot mapping.', fr: "Suivi du stress hydrique, \u00e9valuation de l'\u00e9tat des parcours, suivi des GES et cartographie des zones vuln\u00e9rables.", pt: 'Monitoriza\u00e7\u00e3o do estresse h\u00eddrico, avalia\u00e7\u00e3o da condi\u00e7\u00e3o das pastagens, rastreamento de GEE e mapeamento de pontos de vulnerabilidade.' }, color: '#00695C', icon: 'Cloud' },
      { code: 'knowledge-hub', name: { en: 'Knowledge', fr: 'Connaissances', pt: 'Conhecimento' }, description: { en: 'Knowledge base, e-repository, e-learning platform, policy briefs, and monitoring/evaluation/learning.', fr: "Base de connaissances, e-r\u00e9f\u00e9rentiel, plateforme e-learning, notes de politique et suivi/\u00e9valuation/apprentissage.", pt: 'Base de conhecimento, e-reposit\u00f3rio, plataforma de e-learning, notas de pol\u00edtica e monitoriza\u00e7\u00e3o/avalia\u00e7\u00e3o/aprendizagem.' }, color: '#4527A0', icon: 'BookOpen' },
    ],
  };
}
