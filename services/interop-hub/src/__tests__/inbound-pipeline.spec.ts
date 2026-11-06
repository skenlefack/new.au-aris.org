import { describe, it, expect, vi } from 'vitest';
import {
  selectInboundPipeline, readIdempotencyKey, canonicalJson, payloadFingerprint, findReplay, isUniqueViolation,
} from '../hub/inbound-pipeline';
import { prismaToHttp } from '../hub/prisma-errors';

const CONNECTION = { id: 'c1', name: 'KLHIS' };

function prismaWith(pipelines: any[], transaction: any = null) {
  return {
    hubPipeline: {
      findMany: vi.fn(async ({ where }: any) =>
        pipelines.filter((p) => !where.domain || p.domain === where.domain)),
    },
    hubTransaction: { findFirst: vi.fn(async () => transaction) },
  };
}

describe('selectInboundPipeline', () => {
  const ah = { id: 'p1', domain: 'animal-health' };
  const lv = { id: 'p2', domain: 'livestock' };

  it('uses the only active pipeline when no domain is sent', async () => {
    expect(await selectInboundPipeline(prismaWith([ah]), CONNECTION)).toEqual({ pipeline: ah });
  });

  it('picks the pipeline of the requested domain', async () => {
    expect(await selectInboundPipeline(prismaWith([ah, lv]), CONNECTION, 'livestock')).toEqual({ pipeline: lv });
  });

  it('refuses to guess when several domains are possible', async () => {
    const r = await selectInboundPipeline(prismaWith([ah, lv]), CONNECTION);
    expect(r).toMatchObject({ statusCode: 422 });
    expect((r as any).message).toMatch(/animal-health, livestock.*send "domain"/);
  });

  it('reports a missing pipeline for the domain', async () => {
    const r = await selectInboundPipeline(prismaWith([ah]), CONNECTION, 'fisheries');
    expect(r).toMatchObject({ statusCode: 422 });
    expect((r as any).message).toMatch(/domain "fisheries"/);
  });
});

describe('readIdempotencyKey', () => {
  it('is optional', () => {
    expect(readIdempotencyKey({})).toEqual({});
  });
  it('trims the key and rejects empty or oversized keys', () => {
    expect(readIdempotencyKey({ 'idempotency-key': ' abc ' })).toEqual({ key: 'abc' });
    expect(readIdempotencyKey({ 'idempotency-key': '  ' }).error).toBeDefined();
    expect(readIdempotencyKey({ 'idempotency-key': 'x'.repeat(256) }).error).toMatch(/255/);
  });
});

describe('payload fingerprint', () => {
  it('ignores object key order (PostgreSQL jsonb reorders keys)', () => {
    expect(canonicalJson({ b: 1, a: [{ y: 2, x: 1 }] })).toBe('{"a":[{"x":1,"y":2}],"b":1}');
    expect(payloadFingerprint([{ a: 1, b: 2 }])).toBe(payloadFingerprint([{ b: 2, a: 1 }]));
  });
  it('changes when a value or the record order changes', () => {
    expect(payloadFingerprint([{ a: 1 }])).not.toBe(payloadFingerprint([{ a: 2 }]));
    expect(payloadFingerprint([{ a: 1 }, { a: 2 }])).not.toBe(payloadFingerprint([{ a: 2 }, { a: 1 }]));
  });
});

describe('findReplay', () => {
  const records = [{ event_id: 'E1', cases: 4 }];

  it('is new when the key was never used', async () => {
    expect(await findReplay(prismaWith([]), 'c1', 'k1', records)).toEqual({ kind: 'new' });
  });
  it('returns the original transaction for the same payload', async () => {
    const tx = { id: 't1', source_payload: [{ cases: 4, event_id: 'E1' }] };
    expect(await findReplay(prismaWith([], tx), 'c1', 'k1', records)).toEqual({ kind: 'replay', transaction: tx });
  });
  it('reports a conflict when the key is reused with another payload', async () => {
    const tx = { id: 't1', source_payload: [{ event_id: 'E1', cases: 5 }] };
    expect(await findReplay(prismaWith([], tx), 'c1', 'k1', records)).toEqual({ kind: 'conflict' });
  });
  it('recognises a unique violation', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});

describe('prismaToHttp', () => {
  it('maps an unknown field to 400 with its name', () => {
    const err = Object.assign(new Error('Invalid `prisma.hubConnection.update()` invocation:\n\nUnknown argument `colour`. Available options are marked with ?.'), {
      name: 'PrismaClientValidationError',
    });
    expect(prismaToHttp(err)).toEqual({ statusCode: 400, message: 'Unknown field "colour"' });
  });
  it('maps other validation errors to 400', () => {
    const err = Object.assign(new Error('something else'), { name: 'PrismaClientValidationError' });
    expect(prismaToHttp(err)).toEqual({ statusCode: 400, message: 'Invalid request body' });
  });
  it('maps known request errors', () => {
    const known = (code: string) => Object.assign(new Error(code), { name: 'PrismaClientKnownRequestError', code });
    expect(prismaToHttp(known('P2002'))?.statusCode).toBe(409);
    expect(prismaToHttp(known('P2025'))?.statusCode).toBe(404);
    expect(prismaToHttp(known('P2003'))?.statusCode).toBe(400);
    expect(prismaToHttp(known('P1001'))).toBeNull();
  });
  it('leaves other errors alone', () => {
    expect(prismaToHttp(new Error('boom'))).toBeNull();
    expect(prismaToHttp(null)).toBeNull();
  });
});
