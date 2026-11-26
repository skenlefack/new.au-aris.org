import { describe, it, expect, vi } from 'vitest';
import { cleanText, fetchText, gdeltQueries, parseFeed, parseGdelt } from '../lib/feeds';

describe('parseFeed', () => {
  it('reads RSS 2.0 items with CDATA and entities', () => {
    const xml = `<rss><channel><item><title><![CDATA[Fièvre aphteuse &amp; bétail]]></title>
      <link>https://ex.org/a</link><description>&lt;p&gt;Foyer &eacute; signalé&lt;/p&gt;</description>
      <pubDate>Wed, 25 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const [item] = parseFeed(xml);
    expect(item.title).toBe('Fièvre aphteuse & bétail');
    expect(item.url).toBe('https://ex.org/a');
    expect(item.excerpt).toContain('Foyer');
    expect(item.publishedAt?.toISOString()).toBe('2026-11-25T10:00:00.000Z');
  });
  it('reads Atom entries', () => {
    const xml = `<feed><entry><title>Rift Valley fever</title><link rel="alternate" href="https://ex.org/b"/>
      <summary>Cases in Kenya</summary><updated>2026-11-20T08:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml)).toMatchObject([{ title: 'Rift Valley fever', url: 'https://ex.org/b', excerpt: 'Cases in Kenya' }]);
  });
});

describe('GDELT', () => {
  it('builds a query with quoted phrases', () => {
    expect(gdeltQueries(['peste des petits ruminants', 'PPR'], [])).toEqual(['("peste des petits ruminants" OR PPR)']);
    expect(gdeltQueries(['anthrax'], ['cattle'])).toEqual(['cattle anthrax']);
  });
  it('splits long watchlists into short queries and cleans terms', () => {
    const terms = Array.from({ length: 30 }, (_, i) => `livestock disease number ${i}`);
    const qs = gdeltQueries([...terms, "saisie d'ivoire", 'H5'], []);
    expect(qs.length).toBeGreaterThan(1);
    expect(qs.every((q) => q.length <= 180)).toBe(true);
    expect(qs.join(' ')).toContain('"saisie d ivoire"');
    expect(qs.join(' ')).not.toContain('H5)');
  });
  it('parses the artlist response', () => {
    const json = JSON.stringify({ articles: [{ url: 'https://n.ke/x', title: 'Anthrax in Kenya', seendate: '20261125T101500Z', language: 'English', sourcecountry: 'Kenya' }] });
    expect(parseGdelt(json)[0]).toMatchObject({ url: 'https://n.ke/x', language: 'en', countryHint: 'Kenya' });
    expect(parseGdelt(json)[0].publishedAt?.toISOString()).toBe('2026-11-25T10:15:00.000Z');
  });
  it('reports a GDELT text error', () => {
    expect(() => parseGdelt('Your search contained a phrase that was too short')).toThrow(/GDELT/);
  });
});

describe('cleanText', () => {
  it('strips tags and collapses spaces', () => {
    expect(cleanText('<b>Hello</b>\n  <i>world</i>')).toBe('Hello world');
  });
});

describe('fetchText', () => {
  const ok = (body: string) => ({ status: 200, headers: {}, body });
  const status = (code: number) => ({ status: code, headers: {}, body: '' });

  it('retries a rate-limited request, then succeeds', async () => {
    const get = vi.fn().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok('<rss/>'));
    await expect(fetchText('https://x.org/feed', 1000, 3, 1, get)).resolves.toBe('<rss/>');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reports the network error after the last attempt', async () => {
    const get = vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT (ETIMEDOUT)'));
    await expect(fetchText('https://x.org/feed', 1000, 2, 1, get)).rejects.toThrow('ETIMEDOUT');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const get = vi.fn().mockResolvedValue(status(404));
    await expect(fetchText('https://x.org/feed', 1000, 3, 1, get)).rejects.toThrow('HTTP 404');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
