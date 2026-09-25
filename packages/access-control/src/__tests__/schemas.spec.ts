import { describe, it, expect } from 'vitest';
import {
  nodeCodeSchema,
  levelCodeSchema,
  labelsSchema,
  createAccessLevelSchema,
  replaceScopesSchema,
  copyAccessLevelsSchema,
} from '../schemas';

describe('nodeCodeSchema', () => {
  it('accepts domain code', () => {
    expect(nodeCodeSchema.safeParse('animal-health').success).toBe(true);
  });

  it('accepts domain.subdomain code', () => {
    expect(nodeCodeSchema.safeParse('animal-health.PPR').success).toBe(true);
  });

  it('accepts domain.subdomain with underscore', () => {
    expect(nodeCodeSchema.safeParse('livestock-prod.RED_MEAT').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(nodeCodeSchema.safeParse('').success).toBe(false);
  });

  it('rejects uppercase domain', () => {
    expect(nodeCodeSchema.safeParse('ANIMAL_HEALTH').success).toBe(false);
  });

  it('rejects double dots', () => {
    expect(nodeCodeSchema.safeParse('animal-health..PPR').success).toBe(false);
  });
});

describe('levelCodeSchema', () => {
  it('accepts UPPER_SNAKE_CASE', () => {
    expect(levelCodeSchema.safeParse('FIELD_LEVEL').success).toBe(true);
  });

  it('accepts single word', () => {
    expect(levelCodeSchema.safeParse('ADMIN').success).toBe(true);
  });

  it('rejects lowercase', () => {
    expect(levelCodeSchema.safeParse('field_level').success).toBe(false);
  });

  it('rejects empty', () => {
    expect(levelCodeSchema.safeParse('').success).toBe(false);
  });
});

describe('labelsSchema', () => {
  it('accepts all 4 languages', () => {
    const result = labelsSchema.safeParse({ en: 'Field', fr: 'Terrain', ar: 'ميداني', pt: 'Campo' });
    expect(result.success).toBe(true);
  });

  it('rejects missing language', () => {
    const result = labelsSchema.safeParse({ en: 'Field', fr: 'Terrain', ar: 'ميداني' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string in any language', () => {
    const result = labelsSchema.safeParse({ en: '', fr: 'Terrain', ar: 'ميداني', pt: 'Campo' });
    expect(result.success).toBe(false);
  });
});

describe('createAccessLevelSchema', () => {
  const valid = {
    nodeCode: 'animal-health',
    code: 'FIELD_LEVEL',
    labels: { en: 'Field Level', fr: 'Niveau terrain', ar: 'المستوى الميداني', pt: 'Nivel de campo' },
  };

  it('accepts valid input', () => {
    expect(createAccessLevelSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with optional fields', () => {
    const withOptional = { ...valid, sortOrder: 5, description: { en: 'desc' } };
    expect(createAccessLevelSchema.safeParse(withOptional).success).toBe(true);
  });

  it('rejects invalid nodeCode', () => {
    expect(createAccessLevelSchema.safeParse({ ...valid, nodeCode: 'BAD' }).success).toBe(false);
  });

  it('rejects invalid code', () => {
    expect(createAccessLevelSchema.safeParse({ ...valid, code: 'lower_case' }).success).toBe(false);
  });
});

describe('replaceScopesSchema', () => {
  it('accepts valid scopes', () => {
    const result = replaceScopesSchema.safeParse({
      scopes: [
        { nodeCode: 'animal-health', levelCodes: ['LEVEL_A', 'LEVEL_B'] },
        { nodeCode: 'animal-health.PPR', levelCodes: [] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty scopes array', () => {
    expect(replaceScopesSchema.safeParse({ scopes: [] }).success).toBe(true);
  });

  it('rejects invalid levelCode', () => {
    const result = replaceScopesSchema.safeParse({
      scopes: [{ nodeCode: 'animal-health', levelCodes: ['bad_level'] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('copyAccessLevelsSchema', () => {
  it('accepts valid copy input', () => {
    const result = copyAccessLevelsSchema.safeParse({
      fromNodeCode: 'animal-health',
      toNodeCode: 'livestock-prod',
    });
    expect(result.success).toBe(true);
  });
});
