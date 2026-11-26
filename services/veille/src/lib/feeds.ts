// Feed fetching and parsing without extra dependencies: RSS 2.0, Atom and the GDELT DOC 2.0 API.

export interface FeedItem {
  url: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  language?: string;
  countryHint?: string;
}

const USER_AGENT = 'ARIS-Veille/1.0 (+https://au-aris.org; AU-IBAR information watch)';
const MAX_BYTES = 5_000_000;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Inner text of an XML element, CDATA unwrapped, HTML tags stripped. */
export function cleanText(raw: string | undefined): string {
  if (!raw) return '';
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeEntities(decodeEntities(unwrapped).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1];
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(cleanText(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse an RSS 2.0 or Atom document into items. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const rss = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of rss) {
    const url = cleanText(tag(block, 'link')) || cleanText(tag(block, 'guid'));
    const title = cleanText(tag(block, 'title'));
    if (!url || !title) continue;
    items.push({
      url,
      title,
      excerpt: cleanText(tag(block, 'description') ?? tag(block, 'content:encoded')).slice(0, 2000),
      publishedAt: parseDate(tag(block, 'pubDate') ?? tag(block, 'dc:date')),
    });
  }
  if (items.length > 0) return items;

  const atom = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atom) {
    const link = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ?? block.match(/<link[^>]*href=["']([^"']+)["']/i);
    const url = link ? decodeEntities(link[1]) : '';
    const title = cleanText(tag(block, 'title'));
    if (!url || !title) continue;
    items.push({
      url,
      title,
      excerpt: cleanText(tag(block, 'summary') ?? tag(block, 'content')).slice(0, 2000),
      publishedAt: parseDate(tag(block, 'published') ?? tag(block, 'updated')),
    });
  }
  return items;
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Network error with its low-level cause ("fetch failed" alone says nothing). */
function describe(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e.name === 'TimeoutError') return 'timeout';
  return [e.message, e.cause?.code ?? e.cause?.message].filter(Boolean).join(': ');
}

/**
 * GET with up to `attempts` tries: network errors and 429/5xx are retried with a growing delay
 * (Retry-After when the server sends one). The AU egress IP is shared, so GDELT often answers 429.
 */
export async function fetchText(url: string, timeoutMs = 30_000, attempts = 3, baseDelayMs = 10_000): Promise<string> {
  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.5' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
    } catch (err) {
      last = describe(err);
      if (attempt < attempts) await sleep(baseDelayMs * attempt);
      continue;
    }
    if (res.ok) {
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error(`response larger than ${MAX_BYTES} bytes`);
      return text;
    }
    last = `HTTP ${res.status} ${res.statusText}`.trim();
    if (!RETRYABLE_STATUS.has(res.status) || attempt === attempts) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : baseDelayMs * attempt);
  }
  throw new Error(last || 'request failed');
}

export async function fetchFeed(url: string, timeoutMs = 30_000): Promise<FeedItem[]> {
  return parseFeed(await fetchText(url, timeoutMs));
}

/* ── GDELT DOC 2.0 ── */

const GDELT_LANG: Record<string, string> = { English: 'en', French: 'fr', Portuguese: 'pt', Arabic: 'ar', Spanish: 'es', Swahili: 'sw' };

/** GDELT query for one watchlist: (any OR terms) plus the mandatory terms, quoted when they contain spaces. */
export function gdeltQuery(anyTerms: string[], allTerms: string[]): string {
  const q = (t: string) => (/\s/.test(t.trim()) ? `"${t.trim()}"` : t.trim());
  const any = anyTerms.filter((t) => t.trim().length >= 3).slice(0, 20).map(q);
  const parts = [...allTerms.filter((t) => t.trim()).map(q)];
  if (any.length === 1) parts.push(any[0]);
  if (any.length > 1) parts.push(`(${any.join(' OR ')})`);
  return parts.join(' ');
}

export function gdeltUrl(base: string, query: string, timespan = '1d', maxRecords = 75): string {
  const u = new URL(base || 'https://api.gdeltproject.org/api/v2/doc/doc');
  u.searchParams.set('query', query);
  u.searchParams.set('mode', 'artlist');
  u.searchParams.set('format', 'json');
  u.searchParams.set('maxrecords', String(maxRecords));
  u.searchParams.set('timespan', timespan);
  u.searchParams.set('sort', 'datedesc');
  return u.toString();
}

function gdeltDate(raw: string | undefined): Date | null {
  const m = raw?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

export function parseGdelt(json: string): FeedItem[] {
  let data: { articles?: Array<Record<string, string>> };
  try {
    data = JSON.parse(json);
  } catch {
    // GDELT answers plain text for invalid queries
    throw new Error(`GDELT: ${json.slice(0, 200)}`);
  }
  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      url: a.url,
      title: cleanText(a.title),
      excerpt: '',
      publishedAt: gdeltDate(a.seendate),
      language: GDELT_LANG[a.language] ?? undefined,
      countryHint: a.sourcecountry,
    }));
}

export async function fetchGdelt(base: string, query: string, timespan?: string, timeoutMs = 30_000): Promise<FeedItem[]> {
  return parseGdelt(await fetchText(gdeltUrl(base, query, timespan), timeoutMs));
}
