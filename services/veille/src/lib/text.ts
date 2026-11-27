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

/** Title without trailing outlet names ("Story - Xinhua", "Story - Republikein - Jou Land"). */
export function stripOutlet(title: string): string {
  let t = title;
  for (let i = 0; i < 2; i++) {
    const m = t.match(/^(.{20,}?)\s+[-|–—]\s+[^-|–—]{2,60}$/);
    if (!m) break;
    t = m[1];
  }
  return t;
}

/** Hash of the normalised title: the same story syndicated on several sites shares this key. */
export function titleKey(title: string): string {
  return sha256(normalize(stripOutlet(title)).trim());
}

const TITLE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'over', 'its', 'are', 'was', 'has', 'have', 'how', 'why', 'what', 'new', 'says', 'amid',
  'les', 'des', 'une', 'pour', 'dans', 'sur', 'par', 'avec', 'aux', 'est', 'son', 'ses', 'qui', 'que', 'plus',
  'para', 'com', 'uma', 'dos', 'das', 'nos', 'nas', 'pelo', 'pela',
]);

/** Words that carry a title's meaning, cut to 5 letters so "investors" and "investment" meet. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    normalize(stripOutlet(title)).trim().split(' ')
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !TITLE_STOPWORDS.has(w))
      .map((w) => w.slice(0, 5)),
  );
}

/**
 * Same story reworded by another outlet ("Oyetola seeks Polish investment…" / "Oyetola woos Polish investors…").
 * Jaccard ≥ 0.6, or one title almost contained in the other when both are long enough to be specific.
 */
export function isNearDuplicate(a: Set<string>, b: Set<string>): boolean {
  if (a.size < 4 || b.size < 4) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const jaccard = shared / (a.size + b.size - shared);
  const overlap = shared / Math.min(a.size, b.size);
  return jaccard >= 0.6 || (overlap >= 0.8 && Math.min(a.size, b.size) >= 6);
}

/** A recent signal a new article can join: its own id, the lead of its group and its title fingerprints. */
export interface ClusterEntry {
  id: string;
  leadId: string;
  titleKey: string;
  tokens: Set<string>;
}

/** Lead of the group an article belongs to (same title key or reworded title), or null for a new story. */
export function findClusterLead(pool: ClusterEntry[], key: string, tokens: Set<string>): string | null {
  const hit = pool.find((e) => e.titleKey === key) ?? pool.find((e) => isNearDuplicate(e.tokens, tokens));
  return hit ? hit.leadId : null;
}

/** Priority bonus of a story told by several outlets: +5 per extra article, at most +20. */
export const corroborationBonus = (clusterSize: number): number => Math.min(20, 5 * Math.max(0, clusterSize - 1));

/** Item text for country detection: no leading "[Ghanaian Times]" byline (AllAfrica) and no trailing outlet name. */
export function countryText(title: string, excerpt: string): string {
  return normalize(`${stripOutlet(title)} ${excerpt.replace(/^\s*\[[^\]]{2,80}\]\s*/, '')}`);
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
  CD: ['democratic republic of the congo', 'dr congo', 'drc', 'rdc', 'republique democratique du congo', 'congo kinshasa'],
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

/** Longer names that contain another country's name ("guinea" in "guinea bissau") or a place that is not the country. */
const MASKED_BY: Record<string, string[]> = {
  CG: ['democratic republic of the congo', 'republique democratique du congo'],
  GN: ['guinea bissau', 'guinee bissau', 'equatorial guinea', 'guinee equatoriale', 'papua new guinea', 'gulf of guinea', 'golfe de guinee'],
  NE: ['niger delta', 'delta du niger', 'niger river', 'fleuve niger', 'niger state'],
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
