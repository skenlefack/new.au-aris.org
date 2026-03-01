const API_BASE = process.env['NEXT_PUBLIC_TENANT_API_URL'] ?? 'http://localhost:3001';

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
      { code: 'governance', name: { en: 'Governance & Capacities' }, color: '#6B21A8', icon: 'Building2' },
      { code: 'animal-health', name: { en: 'Animal Health & One Health' }, color: '#C62828', icon: 'HeartPulse' },
      { code: 'livestock-prod', name: { en: 'Production & Pastoralism' }, color: '#E65100', icon: 'Wheat' },
      { code: 'trade-sps', name: { en: 'Trade, Markets & SPS' }, color: '#1565C0', icon: 'TrendingUp' },
      { code: 'fisheries', name: { en: 'Fisheries & Aquaculture' }, color: '#00838F', icon: 'Fish' },
      { code: 'wildlife', name: { en: 'Wildlife & Biodiversity' }, color: '#2E7D32', icon: 'TreePine' },
      { code: 'apiculture', name: { en: 'Apiculture & Pollination' }, color: '#F9A825', icon: 'Bug' },
      { code: 'climate-env', name: { en: 'Climate & Environment' }, color: '#00695C', icon: 'Cloud' },
      { code: 'knowledge-hub', name: { en: 'Knowledge Management' }, color: '#4527A0', icon: 'BookOpen' },
    ],
  };
}
