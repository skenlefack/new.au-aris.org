import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles } from '../auth';
import { getUser, badRequest, notFound } from '../helpers';
import { parseIngestFile, FileParseError } from '../file-parser';
import { verifyWebhookSignature } from '../webhook-signature';

/** Turns a request body into records: `records[]`, an array `payload`, or a single object. */
export function toRecords(body: { records?: unknown; payload?: unknown } | null | undefined): Record<string, unknown>[] {
  if (!body) return [];
  if (Array.isArray(body.records)) return body.records as Record<string, unknown>[];
  if (Array.isArray(body.payload)) return body.payload as Record<string, unknown>[];
  if (body.payload && typeof body.payload === 'object') return [body.payload as Record<string, unknown>];
  return [];
}

/**
 * Runs the pipeline on an already-created transaction without blocking the HTTP reply.
 * Manual pipelines stop at their NOTIFY step (AWAITING_REVIEW) inside the engine.
 */
function processInBackground(
  app: FastifyInstance,
  pipelineId: string,
  transactionId: string,
  records: Record<string, unknown>[],
  initiatedBy: string,
  file?: { url: string; name: string; size: number },
): void {
  setImmediate(() => {
    app.hubPipelineEngine
      .executePipeline(pipelineId, {
        records,
        source_file_url: file?.url,
        source_file_name: file?.name,
        source_file_size: file?.size,
      }, initiatedBy, { transactionId })
      .then((tx) => app.log.info(`Inbound transaction ${transactionId} finished: ${tx.status}`))
      .catch(async (err: Error) => {
        app.log.error(`Inbound transaction ${transactionId} failed: ${err.message}`);
        await app.prisma.hubTransaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED', error_message: err.message.slice(0, 1000), completed_at: new Date() },
        }).catch(() => undefined);
      });
  });
}

export async function registerIngestRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/ingest';

  // ── POST /ingest/push — Receive data push from external system ──
  // Identifies the connection by API key header or Bearer token
  app.post(`${prefix}/push`, async (request: FastifyRequest, reply: FastifyReply) => {
    // Try to identify the connection by API key or authorization header
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const authHeader = request.headers['authorization'] as string | undefined;

    let connection: any = null;

    if (apiKey) {
      // Look up connection by API key stored in credentials.apiKey
      const connections = await app.prisma.hubConnection.findMany({
        where: { status: 'ACTIVE', direction: 'INBOUND' },
      });
      connection = connections.find((c) => {
        const creds = c.credentials as Record<string, unknown> | null;
        return creds && (creds.apiKey === apiKey || creds.api_key === apiKey);
      });
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Look up connection by bearer token stored in credentials.token
      const connections = await app.prisma.hubConnection.findMany({
        where: { status: 'ACTIVE', direction: 'INBOUND' },
      });
      connection = connections.find((c) => {
        const creds = c.credentials as Record<string, unknown> | null;
        return creds && (creds.token === token || creds.bearerToken === token);
      });
    }

    if (!connection) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Invalid or missing API key / bearer token. Could not identify connection.',
      });
    }

    const body = request.body as {
      domain?: string;
      entity_type?: string;
      records?: unknown[];
      payload?: unknown;
    };

    if (!body.records && !body.payload) {
      throw badRequest('records[] or payload is required');
    }
    const records = toRecords(body);
    if (records.length === 0) {
      throw badRequest('records[] must contain at least one record');
    }
    if (records.length > 10_000) {
      throw badRequest('Maximum 10,000 records per push. Use file upload for larger batches.');
    }

    // Find the matching pipeline for this connection + domain
    const pipeline = await app.prisma.hubPipeline.findFirst({
      where: {
        connection_id: connection.id,
        status: 'ACTIVE',
        direction: 'INBOUND',
        ...(body.domain ? { domain: body.domain } : {}),
      },
    });

    if (!pipeline) {
      return reply.code(422).send({
        statusCode: 422,
        message: `No active inbound pipeline found for connection "${connection.name}"${body.domain ? ` and domain "${body.domain}"` : ''}`,
      });
    }

    // Create transaction
    const transaction = await app.prisma.hubTransaction.create({
      data: {
        pipeline_id: pipeline.id,
        connection_id: connection.id,
        tenant_id: connection.tenant_id,
        direction: 'INBOUND',
        status: 'QUEUED',
        mode: pipeline.mode,
        domain: body.domain ?? pipeline.domain,
        entity_type: body.entity_type ?? pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        records_total: records.length,
        source_payload: records as any,
        max_retries: pipeline.max_retries,
        initiated_by: connection.created_by, // System-initiated
        started_at: new Date(),
      },
    });

    // Update connection stats
    await app.prisma.hubConnection.update({
      where: { id: connection.id },
      data: {
        total_transactions: { increment: 1 },
        total_records: { increment: records.length },
        last_transaction_at: new Date(),
      },
    });

    processInBackground(app, pipeline.id, transaction.id, records, connection.created_by);

    app.log.info(`Ingest push received: connection=${connection.name} transaction=${transaction.id} records=${records.length}`);

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        records_received: records.length,
        message: pipeline.mode === 'AUTOMATIC' ? 'Data queued for processing' : 'Data queued; it will await manual review before loading',
      },
    });
  });

  // ── POST /ingest/upload — File upload (multipart) ──
  app.post(`${prefix}/upload`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);

    const data = await (request as any).file();
    if (!data) {
      throw badRequest('File upload is required (multipart/form-data)');
    }

    const fileBuffer = await data.toBuffer();
    const fileName = data.filename as string;
    const fileSize = fileBuffer.length;

    const fields = data.fields as Record<string, { value: string }>;
    const connectionId = fields.connection_id?.value;
    const domain = fields.domain?.value;
    const entityType = fields.entity_type?.value;

    if (!connectionId) {
      throw badRequest('connection_id field is required');
    }

    // Verify connection
    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: connectionId, tenant_id: user.tenantId },
    });
    if (!connection) throw notFound('Connection');

    // Find pipeline
    const pipeline = await app.prisma.hubPipeline.findFirst({
      where: {
        connection_id: connectionId,
        status: 'ACTIVE',
        direction: 'INBOUND',
        ...(domain ? { domain } : {}),
      },
    });

    if (!pipeline) {
      throw badRequest(`No active inbound pipeline found for this connection${domain ? ` and domain "${domain}"` : ''}`);
    }

    // Parse the file first so a bad file is rejected immediately
    let fileRecords: Record<string, unknown>[];
    try {
      fileRecords = parseIngestFile(fileBuffer, fileName);
    } catch (err) {
      if (err instanceof FileParseError) throw badRequest(err.message);
      throw err;
    }
    if (fileRecords.length === 0) {
      throw badRequest('The file contains no records');
    }

    // Upload file to MinIO
    const objectKey = `ingest/${connectionId}/${Date.now()}_${fileName}`;
    try {
      await app.minio.putObject({
        bucket: 'interop-exports',
        key: objectKey,
        body: fileBuffer,
        contentType: data.mimetype ?? 'application/octet-stream',
        metadata: { connectionId, domain: domain ?? '', entityType: entityType ?? '' },
      });
    } catch (err: any) {
      app.log.error(err, 'Failed to upload file to MinIO');
      throw badRequest('Failed to store uploaded file');
    }

    // Create transaction
    const transaction = await app.prisma.hubTransaction.create({
      data: {
        pipeline_id: pipeline.id,
        connection_id: connectionId,
        tenant_id: user.tenantId,
        direction: 'INBOUND',
        status: 'QUEUED',
        mode: pipeline.mode,
        domain: domain ?? pipeline.domain,
        entity_type: entityType ?? pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        source_file_url: objectKey,
        source_file_name: fileName,
        source_file_size: fileSize,
        records_total: fileRecords.length,
        source_payload: fileRecords as any,
        max_retries: pipeline.max_retries,
        initiated_by: user.userId,
        started_at: new Date(),
      },
    });

    await app.hubAudit.log(user, 'transaction', transaction.id, 'UPLOAD', {
      connectionId,
      fileName,
      fileSize,
      records: fileRecords.length,
    });

    processInBackground(app, pipeline.id, transaction.id, fileRecords, user.userId,
      { url: objectKey, name: fileName, size: fileSize });

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        file_name: fileName,
        file_size: fileSize,
        records_received: fileRecords.length,
        message: pipeline.mode === 'AUTOMATIC' ? 'File queued for processing' : 'File queued; it will await manual review before loading',
      },
    });
  });

  // ── POST /ingest/webhook/:connectionId — Webhook receiver ──
  app.post(`${prefix}/webhook/:connectionId`, async (request: FastifyRequest, reply: FastifyReply) => {
    const { connectionId } = request.params as { connectionId: string };

    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: connectionId, status: 'ACTIVE', direction: 'INBOUND' },
    });

    if (!connection) {
      return reply.code(404).send({
        statusCode: 404,
        message: 'Connection not found or inactive',
      });
    }

    // Signature is mandatory: HMAC-SHA256 of the raw body with the connection secret
    const creds = connection.credentials as Record<string, unknown> | null;
    const secret = (creds?.webhookSecret ?? creds?.webhook_secret) as string | undefined;
    if (!secret) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Webhook secret not configured for this connection',
      });
    }
    const signature = request.headers['x-webhook-signature'] as string | undefined;
    if (!signature) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Missing webhook signature header (x-webhook-signature)',
      });
    }
    if (!verifyWebhookSignature((request as any).rawBody as string | undefined, secret, signature)) {
      return reply.code(401).send({
        statusCode: 401,
        message: 'Invalid webhook signature',
      });
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const records = Array.isArray(body.records) ? (body.records as Record<string, unknown>[]) : [body];

    // Find pipeline
    const pipeline = await app.prisma.hubPipeline.findFirst({
      where: {
        connection_id: connectionId,
        status: 'ACTIVE',
        direction: 'INBOUND',
      },
    });

    if (!pipeline) {
      return reply.code(422).send({
        statusCode: 422,
        message: `No active inbound pipeline for connection "${connection.name}"`,
      });
    }

    // Create transaction from webhook payload
    const transaction = await app.prisma.hubTransaction.create({
      data: {
        pipeline_id: pipeline.id,
        connection_id: connectionId,
        tenant_id: connection.tenant_id,
        direction: 'INBOUND',
        status: 'QUEUED',
        mode: pipeline.mode,
        domain: pipeline.domain,
        entity_type: pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        records_total: records.length,
        source_payload: records as any,
        max_retries: pipeline.max_retries,
        initiated_by: connection.created_by,
        started_at: new Date(),
      },
    });

    // Update connection stats
    await app.prisma.hubConnection.update({
      where: { id: connectionId },
      data: {
        total_transactions: { increment: 1 },
        last_transaction_at: new Date(),
      },
    });

    app.log.info(`Webhook received: connection=${connection.name} transaction=${transaction.id}`);

    processInBackground(app, pipeline.id, transaction.id, records, connection.created_by);

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        message: 'Webhook payload received',
      },
    });
  });
}
