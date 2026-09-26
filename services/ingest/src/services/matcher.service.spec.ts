import { describe, it, expect } from 'vitest';
import { computeMatches, type FormCandidate } from './matcher.service';
import type { ColumnStats } from '../parsers/types';

function makeCol(name: string, type: string): ColumnStats {
  return {
    rawName: name,
    normalizedName: name.toLowerCase().replace(/\s+/g, '_'),
    inferredType: type,
    cardinality: 10,
    nullRate: 0,
    minLength: 1,
    maxLength: 50,
    sampleValues: [],
    detectedPatterns: [],
  };
}

function makeCandidate(id: string, fields: Array<{ code: string; label: string; type: string; required: boolean }>): FormCandidate {
  return {
    templateId: id,
    templateName: `Template ${id}`,
    fields: fields.map((f) => ({ ...f, masterDataType: undefined })),
    acceptanceCount: 0,
  };
}

describe('computeMatches', () => {
  it('ranks candidates by score', () => {
    const columns = [
      makeCol('species', 'text'),
      makeCol('count', 'integer'),
      makeCol('date', 'date'),
    ];

    const candidates = [
      makeCandidate('A', [
        { code: 'species', label: 'Species', type: 'text', required: true },
        { code: 'count', label: 'Count', type: 'number', required: true },
        { code: 'date', label: 'Date', type: 'date', required: true },
      ]),
      makeCandidate('B', [
        { code: 'name', label: 'Name', type: 'text', required: true },
        { code: 'value', label: 'Value', type: 'number', required: true },
      ]),
    ];

    const results = computeMatches(columns, candidates);
    expect(results).toHaveLength(2);
    expect(results[0].templateId).toBe('A'); // Better match
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
    expect(results[0].scoreGlobal).toBeGreaterThan(results[1].scoreGlobal);
  });

  it('returns field mappings', () => {
    const columns = [makeCol('species', 'text')];
    const candidates = [
      makeCandidate('A', [
        { code: 'species', label: 'Species', type: 'text', required: true },
      ]),
    ];

    const results = computeMatches(columns, candidates);
    expect(results[0].fieldMappings).toHaveLength(1);
    expect(results[0].fieldMappings[0].sourceColumn).toBe('species');
    expect(results[0].fieldMappings[0].targetFieldCode).toBe('species');
    expect(results[0].fieldMappings[0].confidence).toBeGreaterThan(0.8);
  });

  it('handles empty candidates', () => {
    const columns = [makeCol('a', 'text')];
    const results = computeMatches(columns, []);
    expect(results).toHaveLength(0);
  });

  it('handles empty columns', () => {
    const candidates = [
      makeCandidate('A', [{ code: 'x', label: 'X', type: 'text', required: true }]),
    ];
    const results = computeMatches([], candidates);
    expect(results).toHaveLength(1);
    expect(results[0].scoreCoverage).toBe(0);
  });

  it('gives higher coverage score when required fields are matched', () => {
    const columns = [makeCol('name', 'text'), makeCol('age', 'integer')];
    const withRequired = makeCandidate('A', [
      { code: 'name', label: 'Name', type: 'text', required: true },
      { code: 'age', label: 'Age', type: 'number', required: true },
    ]);
    const withOptional = makeCandidate('B', [
      { code: 'name', label: 'Name', type: 'text', required: false },
      { code: 'extra', label: 'Extra', type: 'text', required: true },
    ]);

    const results = computeMatches(columns, [withRequired, withOptional]);
    expect(results[0].templateId).toBe('A');
    expect(results[0].scoreCoverage).toBeGreaterThan(results[1].scoreCoverage);
  });

  it('assigns recommendation based on thresholds', () => {
    const columns = [makeCol('species', 'text'), makeCol('count', 'integer'), makeCol('date', 'date')];
    const perfect = makeCandidate('A', [
      { code: 'species', label: 'Species', type: 'text', required: true },
      { code: 'count', label: 'Count', type: 'number', required: true },
      { code: 'date', label: 'Date', type: 'date', required: true },
    ]);

    const results = computeMatches(columns, [perfect]);
    expect(['firm', 'review']).toContain(results[0].recommendation);
  });

  it('boosts score with acceptance history', () => {
    const columns = [makeCol('name', 'text')];
    const popular = { ...makeCandidate('A', [{ code: 'name', label: 'Name', type: 'text', required: true }]), acceptanceCount: 100 };
    const unpopular = { ...makeCandidate('B', [{ code: 'name', label: 'Name', type: 'text', required: true }]), acceptanceCount: 0 };

    const results = computeMatches(columns, [popular, unpopular]);
    expect(results[0].scoreHistory).toBeGreaterThan(results[1].scoreHistory);
  });
});
