import { describe, it, expect } from 'vitest';
import { FhirAdapter, pruneFhir } from '../hub/adapters/fhir.adapter';
import { Dhis2Adapter } from '../hub/adapters/dhis2.adapter';
import { standardEndpoint } from '../hub/pipeline-engine.service';

const UUID = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function hasEmptyString(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0 || v.some(hasEmptyString);
  if (v && typeof v === 'object') return Object.keys(v).length === 0 || Object.values(v).some(hasEmptyString);
  return false;
}

describe('FHIR R4 bundle', () => {
  const lab = {
    id: '6a9d1f3e-2b4c-4d8e-a1f2-3b4c5d6e7f80', disease_code: 'FMD', disease_name: 'Foot and mouth disease',
    value: 'positive', numeric_value: 3, unit: 'head', sample_date: '2026-10-20', status: 'final',
  };

  it('builds a valid collection bundle', async () => {
    const out = await new FhirAdapter().formatBuild([lab, { id: 'KE/lab 12' }], { resource_type: 'Observation' } as any);
    const bundle = JSON.parse(out.data as string);
    expect(out.contentType).toBe('application/fhir+json');
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.total).toBeUndefined(); // bdl-1: total only in search/history bundles
    for (const e of bundle.entry) expect(e.fullUrl).toMatch(UUID);
    expect(bundle.entry[0].fullUrl).toBe(`urn:uuid:${lab.id}`);
    expect(hasEmptyString(bundle)).toBe(false); // ele-1: no empty values
  });

  it('uses one value[x], keeps source dates only and fills the required code', async () => {
    const out = await new FhirAdapter().formatBuild([lab, { id: 'r2', value: 'negative' }], {} as any);
    const [a, b] = JSON.parse(out.data as string).entry.map((e: any) => e.resource);
    expect(a.valueQuantity).toEqual({ value: 3, unit: 'head' });
    expect(a.valueString).toBeUndefined();
    expect(a.effectiveDateTime).toBe('2026-10-20T00:00:00.000Z');
    expect(b.valueString).toBe('negative');
    expect(b.effectiveDateTime).toBeUndefined();
    expect(b.code).toEqual({ text: 'Not specified in source record' });
    expect(b.id).toMatch(/^[A-Za-z0-9.-]{1,64}$/);
  });

  it('adds UCUM system and code only when given', async () => {
    const out = await new FhirAdapter().formatBuild([{ ...lab, unit: 'kg', unit_ucum: 'kg' }], {} as any);
    expect(JSON.parse(out.data as string).entry[0].resource.valueQuantity)
      .toEqual({ value: 3, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' });
  });

  it('adds request entries to transaction bundles', async () => {
    const out = await new FhirAdapter().formatBuild([lab], { bundle_type: 'transaction' } as any);
    expect(JSON.parse(out.data as string).entry[0].request).toEqual({ method: 'POST', url: 'Observation' });
  });

  it('drops an animal extension without species', async () => {
    const out = await new FhirAdapter().formatBuild([{ id: 'a1', sex: 'f' }], { resource_type: 'Patient' } as any);
    const patient = JSON.parse(out.data as string).entry[0].resource;
    expect(patient.gender).toBe('female');
    expect(hasEmptyString(patient)).toBe(false);
    expect(JSON.stringify(patient)).not.toMatch(/"url":"species"}/);
  });

  it('pruneFhir removes codings without code', () => {
    expect(pruneFhir({ coding: [{ system: 'urn:x', code: '', display: '' }], text: '' })).toBeUndefined();
  });
});

describe('DHIS2 data values', () => {
  it('builds the /api/dataValueSets import format', async () => {
    const out = await new Dhis2Adapter().formatBuild([
      { cases: 14, deaths: 2, org_unit: 'OU1', period: '202610' },
      { cases: 5, org_unit: 'OU2', period: '202610' },
    ], { data_set: 'DS1', data_element_map: { cases: 'DE_CASES', deaths: 'DE_DEATHS' } } as any);
    expect(JSON.parse(out.data as string)).toEqual({
      dataSet: 'DS1',
      dataValues: [
        { dataElement: 'DE_CASES', value: '14', period: '202610', orgUnit: 'OU1' },
        { dataElement: 'DE_DEATHS', value: '2', period: '202610', orgUnit: 'OU1' },
        { dataElement: 'DE_CASES', value: '5', period: '202610', orgUnit: 'OU2' },
      ],
    });
  });
});

describe('standardEndpoint', () => {
  it('targets the standard API paths', () => {
    const c = { base_url: 'https://dhis2.example.org/' };
    expect(standardEndpoint(c, { format: 'DHIS2_JSON' })).toBe('https://dhis2.example.org/api/dataValueSets');
    expect(standardEndpoint({ base_url: 'https://x/api/dataValueSets' }, { format: 'DHIS2_JSON' })).toBe('https://x/api/dataValueSets');
    expect(standardEndpoint({ base_url: 'https://fhir/r4' }, { format: 'FHIR_JSON', metadata: { bundleType: 'transaction' } })).toBe('https://fhir/r4');
    expect(standardEndpoint({ base_url: 'https://fhir/r4' }, { format: 'FHIR_JSON', metadata: { bundleType: 'collection' } })).toBe('https://fhir/r4/Bundle');
    expect(standardEndpoint({ base_url: 'https://partner/in' }, { format: 'JSON_GENERIC' })).toBe('https://partner/in');
    expect(standardEndpoint({}, { format: 'DHIS2_JSON' })).toBeUndefined();
  });
});
