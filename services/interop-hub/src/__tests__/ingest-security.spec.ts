import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, computeWebhookSignature } from '../hub/webhook-signature';
import { parseIngestFile, FileParseError } from '../hub/file-parser';
import { toRecords } from '../hub/routes/ingest.routes';

const SECRET = 'whsec_test_123';
const BODY = '{"records":[{"cases":3}]}';

describe('verifyWebhookSignature', () => {
  const hex = createHmac('sha256', SECRET).update(BODY).digest('hex');

  it('accepts a valid hex signature', () => {
    expect(verifyWebhookSignature(BODY, SECRET, hex)).toBe(true);
  });

  it('accepts the sha256= prefix and base64 encoding', () => {
    expect(verifyWebhookSignature(BODY, SECRET, `sha256=${hex}`)).toBe(true);
    const b64 = createHmac('sha256', SECRET).update(BODY).digest('base64');
    expect(verifyWebhookSignature(BODY, SECRET, b64)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(BODY.replace('3', '4'), SECRET, hex)).toBe(false);
  });

  it('rejects a wrong secret, a missing header or a missing raw body', () => {
    expect(verifyWebhookSignature(BODY, 'other', hex)).toBe(false);
    expect(verifyWebhookSignature(BODY, SECRET, undefined)).toBe(false);
    expect(verifyWebhookSignature(undefined, SECRET, hex)).toBe(false);
    expect(verifyWebhookSignature(BODY, SECRET, 'not-a-signature')).toBe(false);
  });

  it('computeWebhookSignature matches what partners must send', () => {
    expect(computeWebhookSignature(BODY, SECRET)).toBe(hex);
  });
});

describe('parseIngestFile', () => {
  it('parses CSV with quoted fields, embedded commas and numbers', () => {
    const csv = 'disease,admin,cases\n"FA","Nakuru, Rongai",14\nPPR,Kajiado,3\n';
    expect(parseIngestFile(Buffer.from(csv), 'data.csv')).toEqual([
      { disease: 'FA', admin: 'Nakuru, Rongai', cases: 14 },
      { disease: 'PPR', admin: 'Kajiado', cases: 3 },
    ]);
  });

  it('detects semicolon-separated CSV and strips the BOM', () => {
    const csv = '﻿espece;effectif\nBOV;120\n';
    expect(parseIngestFile(Buffer.from(csv), 'export.csv')).toEqual([{ espece: 'BOV', effectif: 120 }]);
  });

  it('parses TSV and JSON shapes', () => {
    expect(parseIngestFile(Buffer.from('a\tb\n1\tx'), 'f.tsv')).toEqual([{ a: 1, b: 'x' }]);
    expect(parseIngestFile(Buffer.from('[{"a":1}]'), 'f.json')).toEqual([{ a: 1 }]);
    expect(parseIngestFile(Buffer.from('{"records":[{"a":2}]}'), 'f.json')).toEqual([{ a: 2 }]);
  });

  it('rejects unsupported or malformed files with a clear error', () => {
    expect(() => parseIngestFile(Buffer.from('x'), 'f.xlsx')).toThrow(FileParseError);
    expect(() => parseIngestFile(Buffer.from('{bad'), 'f.json')).toThrow(/Invalid JSON/);
    expect(() => parseIngestFile(Buffer.from('only,header\n'), 'f.csv')).toThrow(/at least one data row/);
  });
});

describe('toRecords', () => {
  it('accepts records[], an array payload or a single payload object', () => {
    expect(toRecords({ records: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(toRecords({ payload: [{ a: 2 }] })).toEqual([{ a: 2 }]);
    expect(toRecords({ payload: { a: 3 } })).toEqual([{ a: 3 }]);
    expect(toRecords({})).toEqual([]);
    expect(toRecords(null)).toEqual([]);
  });
});
