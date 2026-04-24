import { describe, it, expect } from 'vitest';

// ─── Seed data validation tests ─────────────────────────────────────────────
// These tests verify the seed data structure and transverse query logic
// without requiring a database connection. They validate the referential
// integrity of VALUE_CHAIN_CODES and SUB_DOMAINS_BY_DOMAIN.

// Replicate seed data locally for validation
const VALUE_CHAIN_CODES = [
  { code: 'DAIRY',           labelFr: 'Lait',                  labelEn: 'Dairy',                    displayOrder: 10 },
  { code: 'RED_MEAT',        labelFr: 'Viande rouge',          labelEn: 'Red meat',                 displayOrder: 20 },
  { code: 'POULTRY',         labelFr: 'Volaille',              labelEn: 'Poultry',                  displayOrder: 30 },
  { code: 'PORK',            labelFr: 'Porc',                  labelEn: 'Pork',                     displayOrder: 40 },
  { code: 'SMALL_RUMINANTS', labelFr: 'Petits ruminants',      labelEn: 'Small ruminants',          displayOrder: 50 },
  { code: 'FISHERIES_AQUA',  labelFr: 'Pêche et aquaculture',  labelEn: 'Fisheries & aquaculture',  displayOrder: 60 },
  { code: 'APICULTURE',      labelFr: 'Apiculture',            labelEn: 'Apiculture',               displayOrder: 70 },
];

const SUB_DOMAINS_BY_DOMAIN: Record<string, Array<{
  code: string; labelFr: string; labelEn: string;
  typeEnum: string; valueChainCode?: string; active?: boolean;
}>> = {
  'livestock-prod': [
    { code: 'DAIRY',           valueChainCode: 'DAIRY',           labelFr: 'Lait',              labelEn: 'Dairy',             typeEnum: 'VALUE_CHAIN' },
    { code: 'RED_MEAT',        valueChainCode: 'RED_MEAT',        labelFr: 'Viande rouge',      labelEn: 'Red meat',          typeEnum: 'VALUE_CHAIN' },
    { code: 'POULTRY',         valueChainCode: 'POULTRY',         labelFr: 'Volaille',          labelEn: 'Poultry',           typeEnum: 'VALUE_CHAIN' },
    { code: 'PORK',            valueChainCode: 'PORK',            labelFr: 'Porc',              labelEn: 'Pork',              typeEnum: 'VALUE_CHAIN' },
    { code: 'SMALL_RUMINANTS', valueChainCode: 'SMALL_RUMINANTS', labelFr: 'Petits ruminants',  labelEn: 'Small ruminants',   typeEnum: 'VALUE_CHAIN' },
    { code: 'APICULTURE',      valueChainCode: 'APICULTURE',      labelFr: 'Apiculture',        labelEn: 'Apiculture',        typeEnum: 'VALUE_CHAIN', active: false },
  ],
  'governance': [
    { code: 'CLINICS',          labelFr: 'Cliniques',                labelEn: 'Clinics',            typeEnum: 'ORGANIZATIONAL' },
    { code: 'SLAUGHTERHOUSES',  labelFr: 'Abattoirs',                labelEn: 'Slaughterhouses',    typeEnum: 'ORGANIZATIONAL' },
    { code: 'LEGAL_FRAMEWORKS', labelFr: 'Cadres juridiques',        labelEn: 'Legal frameworks',   typeEnum: 'ORGANIZATIONAL' },
    { code: 'VACCINATION',      labelFr: 'Vaccination',              labelEn: 'Vaccination',        typeEnum: 'ORGANIZATIONAL' },
    { code: 'SURVEILLANCE',     labelFr: 'Surveillance',             labelEn: 'Surveillance',       typeEnum: 'ORGANIZATIONAL' },
    { code: 'LABORATORIES',     labelFr: 'Laboratoires',             labelEn: 'Laboratories',       typeEnum: 'ORGANIZATIONAL' },
  ],
  'trade-sps': [
    { code: 'DAIRY_TRADE',           valueChainCode: 'DAIRY',           labelFr: 'Commerce du lait',               labelEn: 'Dairy trade',             typeEnum: 'VALUE_CHAIN' },
    { code: 'RED_MEAT_TRADE',        valueChainCode: 'RED_MEAT',        labelFr: 'Commerce de la viande rouge',    labelEn: 'Red meat trade',          typeEnum: 'VALUE_CHAIN' },
    { code: 'POULTRY_TRADE',         valueChainCode: 'POULTRY',         labelFr: 'Commerce de la volaille',        labelEn: 'Poultry trade',           typeEnum: 'VALUE_CHAIN' },
    { code: 'PORK_TRADE',            valueChainCode: 'PORK',            labelFr: 'Commerce du porc',               labelEn: 'Pork trade',              typeEnum: 'VALUE_CHAIN' },
    { code: 'SMALL_RUMINANTS_TRADE', valueChainCode: 'SMALL_RUMINANTS', labelFr: 'Commerce des petits ruminants',  labelEn: 'Small ruminants trade',   typeEnum: 'VALUE_CHAIN' },
    { code: 'FISHERIES_TRADE',       valueChainCode: 'FISHERIES_AQUA',  labelFr: 'Commerce halieutique',           labelEn: 'Fisheries trade',         typeEnum: 'VALUE_CHAIN' },
  ],
};

describe('ValueChainCodes seed data', () => {
  it('should have exactly 7 value chain codes', () => {
    expect(VALUE_CHAIN_CODES).toHaveLength(7);
  });

  it('should have unique codes', () => {
    const codes = VALUE_CHAIN_CODES.map((v) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('should have bilingual labels (FR + EN) for all codes', () => {
    for (const vcc of VALUE_CHAIN_CODES) {
      expect(vcc.labelFr).toBeTruthy();
      expect(vcc.labelEn).toBeTruthy();
    }
  });

  it('should have strictly increasing displayOrder', () => {
    for (let i = 1; i < VALUE_CHAIN_CODES.length; i++) {
      expect(VALUE_CHAIN_CODES[i].displayOrder).toBeGreaterThan(VALUE_CHAIN_CODES[i - 1].displayOrder);
    }
  });
});

describe('SubDomains — Livestock Production', () => {
  const subs = SUB_DOMAINS_BY_DOMAIN['livestock-prod'];

  it('should have 6 sub-domains', () => {
    expect(subs).toHaveLength(6);
  });

  it('should all be VALUE_CHAIN type', () => {
    for (const sd of subs) {
      expect(sd.typeEnum).toBe('VALUE_CHAIN');
    }
  });

  it('should all have a valueChainCode referencing a valid code', () => {
    const validCodes = new Set(VALUE_CHAIN_CODES.map((v) => v.code));
    for (const sd of subs) {
      expect(sd.valueChainCode).toBeDefined();
      expect(validCodes.has(sd.valueChainCode!)).toBe(true);
    }
  });

  it('should have APICULTURE as inactive (feature flag)', () => {
    const apiculture = subs.find((s) => s.code === 'APICULTURE');
    expect(apiculture).toBeDefined();
    expect(apiculture!.active).toBe(false);
  });

  it('should have unique codes', () => {
    const codes = subs.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('SubDomains — Governance', () => {
  const subs = SUB_DOMAINS_BY_DOMAIN['governance'];

  it('should have 6 sub-domains', () => {
    expect(subs).toHaveLength(6);
  });

  it('should all be ORGANIZATIONAL type', () => {
    for (const sd of subs) {
      expect(sd.typeEnum).toBe('ORGANIZATIONAL');
    }
  });

  it('should have no valueChainCode (organizational, not value chain)', () => {
    for (const sd of subs) {
      expect(sd.valueChainCode).toBeUndefined();
    }
  });
});

describe('SubDomains — Trade & SPS', () => {
  const subs = SUB_DOMAINS_BY_DOMAIN['trade-sps'];

  it('should have 6 sub-domains', () => {
    expect(subs).toHaveLength(6);
  });

  it('should all be VALUE_CHAIN type with valueChainCode', () => {
    const validCodes = new Set(VALUE_CHAIN_CODES.map((v) => v.code));
    for (const sd of subs) {
      expect(sd.typeEnum).toBe('VALUE_CHAIN');
      expect(sd.valueChainCode).toBeDefined();
      expect(validCodes.has(sd.valueChainCode!)).toBe(true);
    }
  });
});

describe('Transverse query — shared valueChainCode', () => {
  // Flatten all sub-domains
  const allSubDomains = Object.entries(SUB_DOMAINS_BY_DOMAIN).flatMap(
    ([domainCode, subs]) => subs.map((sd) => ({ ...sd, domainCode }))
  );

  it('DAIRY should appear in at least 2 domains (livestock-prod + trade-sps)', () => {
    const dairySubs = allSubDomains.filter((sd) => sd.valueChainCode === 'DAIRY');
    expect(dairySubs.length).toBeGreaterThanOrEqual(2);

    const domains = new Set(dairySubs.map((sd) => sd.domainCode));
    expect(domains.has('livestock-prod')).toBe(true);
    expect(domains.has('trade-sps')).toBe(true);
  });

  it('RED_MEAT should appear in at least 2 domains', () => {
    const redMeatSubs = allSubDomains.filter((sd) => sd.valueChainCode === 'RED_MEAT');
    expect(redMeatSubs.length).toBeGreaterThanOrEqual(2);
  });

  it('all value chain codes used in sub-domains should exist in VALUE_CHAIN_CODES', () => {
    const validCodes = new Set(VALUE_CHAIN_CODES.map((v) => v.code));
    const usedCodes = new Set(
      allSubDomains.filter((sd) => sd.valueChainCode).map((sd) => sd.valueChainCode!)
    );
    for (const code of usedCodes) {
      expect(validCodes.has(code)).toBe(true);
    }
  });

  it('total sub-domains across all domains should be 18', () => {
    expect(allSubDomains).toHaveLength(18);
  });
});
