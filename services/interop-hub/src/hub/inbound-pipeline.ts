/**
 * Choosing the inbound pipeline for a connection, and idempotent submissions.
 */
import { createHash } from 'node:crypto';

export type PipelineChoice =
  | { pipeline: any }
  | { statusCode: 422; message: string };

/**
 * A connection has at most one inbound pipeline per domain. Without a domain the
 * choice is only allowed when exactly one inbound pipeline is active; otherwise the
 * caller must say which domain it is sending.
 */
export async function selectInboundPipeline(
  prisma: any,
  connection: { id: string; name: string },
  domain?: string,
): Promise<PipelineChoice> {
  const pipelines: any[] = await prisma.hubPipeline.findMany({
    where: {
      connection_id: connection.id,
      status: 'ACTIVE',
      direction: 'INBOUND',
      ...(domain ? { domain } : {}),
    },
    orderBy: { created_at: 'asc' },
  });
  if (pipelines.length === 0) {
    return {
      statusCode: 422,
      message: `No active inbound pipeline found for connection "${connection.name}"${domain ? ` and domain "${domain}"` : ''}`,
    };
  }
  if (pipelines.length > 1) {
    const domains = pipelines.map((p) => p.domain).join(', ');
    return {
      statusCode: 422,
      message: `Connection "${connection.name}" receives several domains (${domains}): send "domain" to choose one`,
    };
  }
  return { pipeline: pipelines[0] };
}

const MAX_KEY_LENGTH = 255;

/** Reads the Idempotency-Key header. Returns undefined when absent, or an error message. */
export function readIdempotencyKey(headers: Record<string, unknown>): { key?: string; error?: string } {
  const raw = headers['idempotency-key'];
  if (raw === undefined) return {};
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (typeof key !== 'string' || key.trim() === '') return { error: 'Idempotency-Key must not be empty' };
  if (key.length > MAX_KEY_LENGTH) return { error: `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters` };
  return { key: key.trim() };
}

/** JSON with sorted object keys, so payloads compare equal whatever the key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function payloadFingerprint(records: unknown): string {
  return createHash('sha256').update(canonicalJson(records)).digest('hex');
}

export type ReplayCheck =
  | { kind: 'new' }
  | { kind: 'replay'; transaction: any }
  | { kind: 'conflict' };

/** Looks for an earlier transaction with the same key on this connection. */
export async function findReplay(
  prisma: any,
  connectionId: string,
  key: string,
  records: unknown,
): Promise<ReplayCheck> {
  const existing = await prisma.hubTransaction.findFirst({
    where: { connection_id: connectionId, idempotency_key: key },
  });
  if (!existing) return { kind: 'new' };
  return payloadFingerprint(existing.source_payload) === payloadFingerprint(records)
    ? { kind: 'replay', transaction: existing }
    : { kind: 'conflict' };
}

/** True when a Prisma error is a unique-constraint violation (concurrent same-key request). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}
