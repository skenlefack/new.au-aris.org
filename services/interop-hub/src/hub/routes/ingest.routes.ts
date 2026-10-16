import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles } from '../auth';
import { getUser, badRequest, notFound } from '../helpers';

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
    const records = Array.isArray(body.records) ? body.records : [];
    const transaction = await app.prisma.hubTransaction.create({
      data: {
        pipeline_id: pipeline.id,
        connection_id: connection.id,
        tenant_id: connection.tenant_id,
        direction: 'INBOUND',
        status: pipeline.mode === 'AUTOMATIC' ? 'QUEUED' : 'AWAITING_REVIEW',
        mode: pipeline.mode,
        domain: body.domain ?? pipeline.domain,
        entity_type: body.entity_type ?? pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        records_total: records.length,
        source_payload: body.payload ?? body.records ?? null,
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

    // TODO: Enqueue pipeline processing via Kafka

    app.log.info(`Ingest push received: connection=${connection.name} transaction=${transaction.id} records=${records.length}`);

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        records_received: records.length,
        message: pipeline.mode === 'AUTOMATIC' ? 'Data queued for processing' : 'Data received, awaiting manual review',
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
        status: pipeline.mode === 'AUTOMATIC' ? 'QUEUED' : 'AWAITING_REVIEW',
        mode: pipeline.mode,
        domain: domain ?? pipeline.domain,
        entity_type: entityType ?? pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        source_file_url: objectKey,
        source_file_name: fileName,
        source_file_size: fileSize,
        max_retries: pipeline.max_retries,
        initiated_by: user.userId,
        started_at: new Date(),
      },
    });

    await app.hubAudit.log(user, 'transaction', transaction.id, 'UPLOAD', {
      connectionId,
      fileName,
      fileSize,
    });

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        file_name: fileName,
        file_size: fileSize,
        message: pipeline.mode === 'AUTOMATIC' ? 'File queued for processing' : 'File received, awaiting manual review',
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

    // Verify webhook signature if configured
    const creds = connection.credentials as Record<string, unknown> | null;
    if (creds?.webhookSecret) {
      const signature = request.headers['x-webhook-signature'] as string | undefined;
      if (!signature) {
        return reply.code(401).send({
          statusCode: 401,
          message: 'Missing webhook signature header (x-webhook-signature)',
        });
      }
      // TODO: Implement HMAC verification against creds.webhookSecret
    }

    const body = request.body as Record<string, unknown>;

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
        status: pipeline.mode === 'AUTOMATIC' ? 'QUEUED' : 'AWAITING_REVIEW',
        mode: pipeline.mode,
        domain: pipeline.domain,
        entity_type: pipeline.entity_type,
        country_code: connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        records_total: Array.isArray(body.records) ? (body.records as unknown[]).length : 1,
        source_payload: body,
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

    // TODO: Enqueue pipeline processing via Kafka

    return reply.code(202).send({
      data: {
        transaction_id: transaction.id,
        status: transaction.status,
        message: 'Webhook payload received',
      },
    });
  });
}
