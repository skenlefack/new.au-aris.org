import { createHash } from 'crypto';

/** Lower case, accents removed, punctuation collapsed to single spaces. */
export function normalize(text: string): string {
  return ` ${text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Canonical URL hash: no fragment, no tracking parameters, no trailing slash. */
export function urlHash(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ocid|cmpid)/i.test(k)) u.searchParams.delete(k);
    }
    return sha256(`${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase());
  } catch {
    return sha256(url.trim().toLowerCase());
  }
}

/** Hash of the normalised title: the same story syndicated on several sites shares this key. */
export function titleKey(title: string): string {
  return sha256(normalize(title).trim());
}

/** A term matches on word boundaries, accent and case insensitive. */
export function containsTerm(normText: string, term: string): boolean {
  const t = normalize(term).trim();
  return t.length > 0 && normText.includes(` ${t} `);
}

export interface WatchListRule {
  id: string;
  domain: string;
  anyTerms: string[];
  allTerms: string[];
  excludeTerms: string[];
  countries: string[];
}

export interface RuleMatch {
  watchListId: string;
  domain: string;
  matchedTerms: string[];
}

/** Apply one watchlist to a text; null when it does not match. */
export function matchWatchList(rule: WatchListRule, normText: string, countries: string[]): RuleMatch | null {
  if (rule.excludeTerms.some((t) => containsTerm(normText, t))) return null;
  if (!rule.allTerms.every((t) => containsTerm(normText, t))) return null;
  const any = rule.anyTerms.filter((t) => containsTerm(normText, t));
  if (rule.anyTerms.length > 0 && any.length === 0) return null;
  if (rule.anyTerms.length === 0 && rule.allTerms.length === 0) return null;
  if (rule.countries.length > 0 && !countries.some((c) => rule.countries.includes(c))) return null;
  return { watchListId: rule.id, domain: rule.domain, matchedTerms: [...new Set([...rule.allTerms, ...any])] };
}

/* ── Countries: the 55 AU Member States, EN / FR / PT names and demonyms ── */

const COUNTRY_NAMES: Record<string, string[]> = {
  DZ: ['algeria', 'algerie', 'algerian', 'algerien'], AO: ['angola', 'angolan'], BJ: ['benin', 'beninese', 'beninois'],
  BW: ['botswana'], BF: ['burkina faso', 'burkinabe'], BI: ['burundi', 'burundian', 'burundais'],
  CV: ['cabo verde', 'cape verde', 'cap vert'], CM: ['cameroon', 'cameroun', 'cameroonian', 'camerounais'],
  CF: ['central african republic', 'centrafrique', 'centrafricaine'], TD: ['chad', 'tchad', 'chadian', 'tchadien'],
  KM: ['comoros', 'comores'], CG: ['republic of the congo', 'congo brazzaville', 'republique du congo'],
  CD: ['democratic republic of the congo', 'dr congo', 'drc', 'rdc', 'republique democratique du congo'],
  CI: ['cote d ivoire', 'ivory coast', 'ivoirien', 'ivorian'], DJ: ['djibouti'], EG: ['egypt', 'egypte', 'egyptian', 'egyptien'],
  GQ: ['equatorial guinea', 'guinee equatoriale'], ER: ['eritrea', 'erythree', 'eritrean'], SZ: ['eswatini', 'swaziland'],
  ET: ['ethiopia', 'ethiopie', 'ethiopian', 'ethiopien'], GA: ['gabon', 'gabonese', 'gabonais'], GM: ['gambia', 'gambie', 'gambian'],
  GH: ['ghana', 'ghanaian', 'ghaneen'], GN: ['guinea', 'guinee', 'guinean', 'guineen'], GW: ['guinea bissau', 'guinee bissau'],
  KE: ['kenya', 'kenyan'], LS: ['lesotho'], LR: ['liberia', 'liberian'], LY: ['libya', 'libye', 'libyan'],
  MG: ['madagascar', 'malagasy', 'malgache'], MW: ['malawi', 'malawian'], ML: ['mali', 'malian', 'malien'],
  MR: ['mauritania', 'mauritanie', 'mauritanian'], MU: ['mauritius', 'maurice'], MA: ['morocco', 'maroc', 'moroccan', 'marocain'],
  MZ: ['mozambique', 'mozambican', 'mocambique'], NA: ['namibia', 'namibie', 'namibian'], NE: ['niger', 'nigerien'],
  NG: ['nigeria', 'nigerian'], RW: ['rwanda', 'rwandan', 'rwandais'], EH: ['western sahara', 'sahara occidental', 'sahrawi'],
  ST: ['sao tome'], SN: ['senegal', 'senegalese', 'senegalais'], SC: ['seychelles'], SL: ['sierra leone', 'sierra leonean'],
  SO: ['somalia', 'somalie', 'somali'], ZA: ['south africa', 'afrique du sud', 'south african', 'sud africain'],
  SS: ['south sudan', 'soudan du sud'], SD: ['sudan', 'soudan', 'sudanese'], TZ: ['tanzania', 'tanzanie', 'tanzanian'],
  TG: ['togo', 'togolese', 'togolais'], TN: ['tunisia', 'tunisie', 'tunisian', 'tunisien'], UG: ['uganda', 'ouganda', 'ugandan'],
  ZM: ['zambia', 'zambie', 'zambian'], ZW: ['zimbabwe', 'zimbabwean'],
};

/** Longer names that contain another country's name ("guinea" in "guinea bissau"). */
const MASKED_BY: Record<string, string[]> = {
  GN: ['guinea bissau', 'guinee bissau', 'equatorial guinea', 'guinee equatoriale', 'papua new guinea'],
  SD: ['south sudan', 'soudan du sud'],
};

/** ISO2 codes of the AU Member States named in a normalised text. */
export function detectCountries(normText: string): string[] {
  const found: string[] = [];
  for (const [code, names] of Object.entries(COUNTRY_NAMES)) {
    let text = normText;
    for (const longer of MASKED_BY[code] ?? []) text = text.split(` ${longer} `).join('  ');
    if (names.some((n) => text.includes(` ${n} `))) found.push(code);
  }
  return found;
}

const AFRICA_TERMS = ['africa', 'afrique', 'african', 'africain', 'africaine', 'africa cdc', 'african union', 'union africaine', 'au ibar', 'ua bira',
  'igad', 'ecowas', 'cedeao', 'sadc', 'eac', 'comesa', 'eccas', 'ceeac', 'uma', 'sahel', 'horn of africa', 'corne de l afrique', 'afcfta', 'zlecaf'];

/** True when an item names an AU Member State or Africa, a region or an African institution. */
export function concernsAfrica(normText: string, countries: string[]): boolean {
  return countries.length > 0 || AFRICA_TERMS.some((t) => normText.includes(` ${t} `));
}

/* ── Category and severity ── */

const CATEGORY_TERMS: Array<[string, string[]]> = [
  ['outbreak', ['outbreak', 'foyer', 'epidemic', 'epidemie', 'epizootic', 'epizootie', 'cases', 'cas confirmes', 'mortality', 'mortalite', 'die off', 'surto', 'quarantine', 'quarantaine', 'culling', 'abattage sanitaire']],
  ['trade', ['export', 'import', 'ban', 'embargo', 'interdiction', 'sps', 'certificate', 'certificat', 'tariff', 'border', 'frontiere', 'afcfta', 'zlecaf']],
  ['market', ['price', 'prix', 'market', 'marche', 'cost', 'cout', 'inflation']],
  ['policy', ['law', 'loi', 'regulation', 'reglementation', 'policy', 'politique', 'decree', 'decret', 'strategy', 'strategie', 'ministry', 'ministere']],
  ['climate', ['drought', 'secheresse', 'flood', 'inondation', 'rainfall', 'pluviometrie', 'heatwave', 'canicule', 'locust', 'criquet', 'el nino']],
  ['wildlife', ['poaching', 'braconnage', 'trafficking', 'trafic', 'ivory', 'ivoire', 'cites', 'protected area', 'aire protegee']],
  ['production', ['vaccination', 'vaccine', 'vaccin', 'census', 'recensement', 'production', 'yield', 'rendement', 'herd', 'cheptel']],
];

const ALERT_TERMS = ['outbreak', 'foyer', 'epidemic', 'epidemie', 'deaths', 'dead', 'morts', 'mortality', 'mortalite', 'emergency', 'urgence', 'confirmed', 'confirme', 'spread', 'propagation', 'ban', 'embargo'];
const WATCH_TERMS = ['suspected', 'suspect', 'suspicion', 'risk', 'risque', 'alert', 'alerte', 'warning', 'surveillance'];

export function classifyCategory(normText: string): string {
  let best = 'other';
  let bestHits = 0;
  for (const [category, terms] of CATEGORY_TERMS) {
    const hits = terms.filter((t) => containsTerm(normText, t)).length;
    if (hits > bestHits) {
      best = category;
      bestHits = hits;
    }
  }
  return best;
}

export function classifySeverity(normText: string): number {
  if (ALERT_TERMS.some((t) => containsTerm(normText, t))) return 3;
  if (WATCH_TERMS.some((t) => containsTerm(normText, t))) return 2;
  return 1;
}

const RELIABILITY_WEIGHT: Record<string, number> = { A: 1, B: 0.9, C: 0.75, D: 0.6, E: 0.45, F: 0.5 };

/** Relevance 0–100 from the matched terms, with a bonus when they appear in the title. */
export function relevanceScore(matchedTerms: string[], normTitle: string, watchListCount: number): number {
  const inTitle = matchedTerms.filter((t) => containsTerm(normTitle, t)).length;
  return Math.min(100, 35 + matchedTerms.length * 12 + inTitle * 15 + (watchListCount - 1) * 8);
}

/** Triage priority 0–100: relevance × severity × source reliability × freshness. */
export function priorityScore(relevance: number, severity: number, reliability: string, publishedAt: Date | null, now = new Date()): number {
  const ageDays = publishedAt ? Math.max(0, (now.getTime() - publishedAt.getTime()) / 86_400_000) : 1;
  const freshness = ageDays <= 1 ? 1 : ageDays <= 7 ? 0.85 : ageDays <= 30 ? 0.6 : 0.4;
  const severityWeight = [0, 0.6, 0.8, 1][severity] ?? 0.6;
  return Math.round(relevance * severityWeight * (RELIABILITY_WEIGHT[reliability] ?? 0.6) * freshness);
}
