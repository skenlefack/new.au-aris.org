import { describe, it, expect } from 'vitest';
import { classifyCategory, concernsAfrica, classifySeverity, detectCountries, matchWatchList, normalize, priorityScore, titleKey, urlHash } from '../lib/text';

const rule = { id: 'w1', domain: 'animal-health', anyTerms: ['peste des petits ruminants', 'PPR'], allTerms: [], excludeTerms: ['football'], countries: [] };

describe('normalize and hashes', () => {
  it('removes accents, case and punctuation', () => {
    expect(normalize("Épizootie: l'Éthiopie!")).toBe(' epizootie l ethiopie ');
  });
  it('ignores tracking parameters and www in URL hashes', () => {
    expect(urlHash('https://www.site.org/a/?utm_source=x#top')).toBe(urlHash('https://site.org/a'));
  });
  it('ignores a trailing outlet name in title keys', () => {
    expect(titleKey('Can aquaculture unlock sustainable economic growth - Republikein - Jou Land')).toBe(titleKey('Can aquaculture unlock sustainable economic growth'));
    expect(titleKey('Anthrax outbreak in Kenya | The Star')).toBe(titleKey('Anthrax outbreak in Kenya'));
    expect(titleKey('Short - title')).not.toBe(titleKey('Short'));
  });
  it('gives the same title key to the same story', () => {
    expect(titleKey('PPR outbreak in Kenya')).toBe(titleKey('ppr  OUTBREAK in kenya!'));
  });
});

describe('matchWatchList', () => {
  it('matches a multi-word term without accents', () => {
    const m = matchWatchList(rule, normalize('Foyer de Peste des Petits Ruminants au Tchad'), []);
    expect(m?.matchedTerms).toEqual(['peste des petits ruminants']);
  });
  it('matches on word boundaries only', () => {
    expect(matchWatchList(rule, normalize('The PPRS index'), [])).toBeNull();
  });
  it('applies exclusions', () => {
    expect(matchWatchList(rule, normalize('PPR football club'), [])).toBeNull();
  });
  it('requires every mandatory term', () => {
    const r = { ...rule, allTerms: ['kenya'] };
    expect(matchWatchList(r, normalize('PPR in Uganda'), [])).toBeNull();
    expect(matchWatchList(r, normalize('PPR in Kenya'), [])?.matchedTerms).toEqual(['kenya', 'PPR']);
  });
  it('applies the country filter', () => {
    const r = { ...rule, countries: ['KE'] };
    expect(matchWatchList(r, normalize('PPR'), ['UG'])).toBeNull();
    expect(matchWatchList(r, normalize('PPR'), ['KE'])).not.toBeNull();
  });
});

describe('detectCountries', () => {
  it('finds countries in English and French', () => {
    expect(detectCountries(normalize('Outbreak in Côte d’Ivoire and Sénégal'))).toEqual(['CI', 'SN']);
  });
  it('does not read Guinea in Guinea-Bissau or Sudan in South Sudan', () => {
    expect(detectCountries(normalize('Guinea-Bissau and South Sudan'))).toEqual(['GW', 'SS']);
  });
  it('keeps Niger and Nigeria apart', () => {
    expect(detectCountries(normalize('Nigeria reports'))).toEqual(['NG']);
  });
});

describe('concernsAfrica', () => {
  it('keeps items about a Member State, a REC or Africa', () => {
    expect(concernsAfrica(normalize('Bird flu in poultry'), ['NG'])).toBe(true);
    expect(concernsAfrica(normalize('IGAD ministers meet on livestock'), [])).toBe(true);
    expect(concernsAfrica(normalize("Grippe aviaire en Afrique de l'Ouest"), [])).toBe(true);
  });
  it('drops items with no African link', () => {
    expect(concernsAfrica(normalize('Bird flu found in Iowa dairy herds'), [])).toBe(false);
  });
});

describe('classification', () => {
  it('detects an outbreak alert', () => {
    const t = normalize('Anthrax outbreak: 40 cattle dead, quarantine declared');
    expect(classifyCategory(t)).toBe('outbreak');
    expect(classifySeverity(t)).toBe(3);
  });
  it('detects market information', () => {
    expect(classifyCategory(normalize('Le prix du bétail grimpe sur le marché de Maradi'))).toBe('market');
  });
  it('ranks fresh reliable alerts above old unreliable news', () => {
    const now = new Date('2026-11-26T12:00:00Z');
    expect(priorityScore(80, 3, 'A', new Date('2026-11-26T08:00:00Z'), now)).toBeGreaterThan(priorityScore(80, 1, 'E', new Date('2026-09-01'), now));
  });
});
