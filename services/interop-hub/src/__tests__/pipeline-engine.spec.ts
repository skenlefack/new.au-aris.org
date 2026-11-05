import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PipelineEngineService } from '../hub/pipeline-engine.service';
import { setServiceTokenKeyForTests } from '../hub/service-token';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const OWNER = '00000000-0000-0000-0000-0000000000bb';

function step(order: number, step_type: string, config: Record<string, unknown> = {}) {
  return { id: `s${order}`, step_order: order, step_type, name: step_type, config, on_error: 'STOP', timeout_ms: 5000, is_enabled: true };
}

function makePipeline(over: Record<string, unknown> = {}) {
  return {
    id: 'pl-1', tenant_id: TENANT, connection_id: 'cn-1', direction: 'INBOUND', mode: 'AUTOMATIC',
    status: 'ACTIVE', domain: 'animal-health', entity_type: 'outbreak', target_campaign_id: 'camp-1',
    target_form_id: 'form-1', export_format: null, max_retries: 3, dlq_enabled: false, created_by: OWNER,
    connection: { id: 'cn-1', country_code: 'KE', base_url: null, auth_type: 'NONE', credentials: {}, system_type: 'REST_API' },
    steps: [step(1, 'RECEIVE'), step(2, 'ROUTE')],
    ...over,
  };
}

function makePrisma(pipeline: any) {
  const tx: any = { id: 'tx-1', tenant_id: TENANT, direction: pipeline.direction, started_at: new Date() };
  return {
    tx,
    hubPipeline: { findUnique: vi.fn().mockResolvedValue(pipeline), update: vi.fn().mockResolvedValue({}) },
    hubConnection: { update: vi.fn().mockResolvedValue({}) },
    hubTransaction: {
      create: vi.fn().mockImplementation(async ({ data }: any) => Object.assign(tx, data)),
      update: vi.fn().mockImplementation(async ({ data }: any) => Object.assign(tx, data)),
      findUnique: vi.fn().mockImplementation(async () => tx),
      findFirst: vi.fn().mockImplementation(async () => tx),
    },
    hubTransactionRecord: { create: vi.fn().mockResolvedValue({}) },
    hubTransactionStepLog: { create: vi.fn().mockResolvedValue({}) },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: OWNER, email: 'steward@ke.gov', role: 'DATA_STEWARD', tenantId: TENANT, tenant: { level: 'MEMBER_STATE' } }),
    },
  };
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const kafka = { publish: vi.fn().mockResolvedValue(undefined), send: vi.fn().mockResolvedValue(undefined) };

function engine(prisma: any) {
  return new PipelineEngineService(prisma, kafka as any, {} as any, { createNotification: vi.fn() } as any, logger as any);
}

describe('PipelineEngineService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setServiceTokenKeyForTests(privateKey);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env['COLLECTE_URL'] = 'http://collecte:3011';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setServiceTokenKeyForTests(null);
  });

  it('reuses the transaction created by the ingest route instead of creating a new one', async () => {
    const prisma = makePrisma(makePipeline());
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }));

    await engine(prisma).executePipeline('pl-1', { records: [{ cases: 1 }] }, OWNER, { transactionId: 'tx-1' });

    expect(prisma.hubTransaction.create).not.toHaveBeenCalled();
    expect(prisma.hubTransaction.update.mock.calls[0][0]).toMatchObject({ where: { id: 'tx-1' }, data: { status: 'RECEIVED', records_total: 1 } });
    expect(prisma.tx.status).toBe('COMPLETED');
  });

  it('loads each record into collecte with a service token issued for the pipeline owner', async () => {
    const prisma = makePrisma(makePipeline());
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }));

    await engine(prisma).executePipeline('pl-1', { records: [{ cases: 1 }, { cases: 2 }] }, OWNER, { transactionId: 'tx-1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://collecte:3011/api/v1/collecte/submissions');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ campaignId: 'camp-1', data: { cases: 1 }, deviceId: 'interop-hub:tx-1:0' });
    const token = (init.headers.Authorization as string).replace('Bearer ', '');
    const claims = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
    expect(claims).toMatchObject({ sub: OWNER, role: 'DATA_STEWARD', tenantId: TENANT, tenantLevel: 'MEMBER_STATE', svc: 'interop-hub' });
  });

  it('marks the transaction PARTIAL and rejects only the records collecte refused', async () => {
    const prisma = makePrisma(makePipeline());
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Campaign is not active' }), { status: 400 }));

    await engine(prisma).executePipeline('pl-1', { records: [{ a: 1 }, { a: 2 }] }, OWNER, { transactionId: 'tx-1' });

    expect(prisma.tx.status).toBe('PARTIAL');
    expect(prisma.tx.records_accepted).toBe(1);
    expect(prisma.tx.records_rejected).toBe(1);
    const statuses = prisma.hubTransactionRecord.create.mock.calls.map((c: any) => c[0].data.status);
    expect(statuses).toEqual(['ACCEPTED', 'REJECTED']);
    expect(prisma.hubTransactionRecord.create.mock.calls[1][0].data.error_message).toMatch(/Campaign is not active/);
  });

  it('fails the transaction when every record is refused', async () => {
    const prisma = makePrisma(makePipeline());
    fetchMock.mockResolvedValue(new Response('{"message":"nope"}', { status: 403 }));

    await engine(prisma).executePipeline('pl-1', { records: [{ a: 1 }] }, OWNER, { transactionId: 'tx-1' });

    expect(prisma.tx.status).toBe('FAILED');
  });

  it('stops at NOTIFY in manual mode and resumes loading after approval (status APPROVED)', async () => {
    const pipeline = makePipeline({ mode: 'MANUAL', steps: [step(1, 'RECEIVE'), step(2, 'NOTIFY'), step(3, 'ROUTE')] });
    const prisma = makePrisma(pipeline);
    const eng = engine(prisma);

    await eng.executePipeline('pl-1', { records: [{ a: 1 }] }, OWNER, { transactionId: 'tx-1' });
    expect(prisma.tx.status).toBe('AWAITING_REVIEW');
    expect(fetchMock).not.toHaveBeenCalled();

    prisma.tx.status = 'APPROVED';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'sub-9' } }), { status: 201 }));
    await eng.resumeTransaction('tx-1', TENANT);

    expect(prisma.hubTransaction.findFirst.mock.calls[0][0].where.status).toEqual({ in: ['AWAITING_REVIEW', 'APPROVED'] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.tx.status).toBe('COMPLETED');
  });

  it('builds a real WOAH XML package and keeps it for download when no delivery URL is set', async () => {
    const pipeline = makePipeline({
      direction: 'OUTBOUND', export_format: 'WOAH_XML',
      connection: { id: 'cn-1', country_code: 'KE', base_url: null, auth_type: 'NONE', credentials: {}, system_type: 'WAHIS' },
      steps: [step(1, 'FORMAT_BUILD'), step(2, 'DELIVER')],
    });
    const prisma = makePrisma(pipeline);

    await engine(prisma).executePipeline('pl-1', {
      records: [{ country_code: 'KE', disease_code: 'FMD', species_code: 'BOV', cases: 14, deaths: 2 }],
    }, OWNER);

    expect(prisma.tx.status).toBe('COMPLETED');
    expect(prisma.tx.target_payload.format).toBe('WOAH_XML');
    expect(prisma.tx.target_payload.data).toMatch(/^<\?xml/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivers the built package (not raw JSON) when the partner has an API', async () => {
    const pipeline = makePipeline({
      direction: 'OUTBOUND', export_format: 'FAOSTAT_CSV',
      connection: { id: 'cn-1', country_code: 'KE', base_url: 'https://partner.example/api', auth_type: 'NONE', credentials: {}, system_type: 'FAOSTAT' },
      steps: [step(1, 'FORMAT_BUILD'), step(2, 'DELIVER', { max_retries: 0 })],
    });
    const prisma = makePrisma(pipeline);
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    await engine(prisma).executePipeline('pl-1', { records: [{ country_code: 'KE', item: 'Cattle', year: 2025, value: 100 }] }, OWNER);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://partner.example/api');
    expect(init.headers['Content-Type']).toMatch(/csv/);
    expect(String(init.body)).toMatch(/^AreaCode,Area,ItemCode/);
    expect(prisma.tx.status).toBe('COMPLETED');
  });
});
