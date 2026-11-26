import { describe, it, expect, vi } from 'vitest';
import { cleanText, fetchText, gdeltQuery, parseFeed, parseGdelt } from '../lib/feeds';

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
    expect(gdeltQuery(['peste des petits ruminants', 'PPR'], [])).toBe('("peste des petits ruminants" OR PPR)');
    expect(gdeltQuery(['anthrax'], ['cattle'])).toBe('cattle anthrax');
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
  const ok = (body: string) => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: async () => body });
  const status = (code: number) => ({ ok: false, status: code, statusText: '', headers: new Headers(), text: async () => '' });

  it('retries a rate-limited request, then succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok('<rss/>'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchText('https://x.org/feed', 1000, 3, 1)).resolves.toBe('<rss/>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('reports the network cause after the last attempt', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    await expect(fetchText('https://x.org/feed', 1000, 2, 1)).rejects.toThrow('fetch failed: UND_ERR_CONNECT_TIMEOUT');
    vi.unstubAllGlobals();
  });

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(404));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchText('https://x.org/feed', 1000, 3, 1)).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
