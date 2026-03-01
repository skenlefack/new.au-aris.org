import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  ListDatasetsDto,
  UpdateDatasetDto,
  AggregateDto,
  TimeSeriesDto,
  CreateAnalysisDto,
} from '../services/historical-data.service';
import {
  listDatasetsSchema,
  getDatasetSchema,
  updateDatasetSchema,
  deleteDatasetSchema,
  queryDataSchema,
  aggregateSchema,
  timeSeriesSchema,
  createAnalysisSchema,
  listAnalysesSchema,
  deleteAnalysisSchema,
  statsSchema,
} from '../schemas/historical.schema';

const PREFIX = '/api/v1/historical';

export async function registerHistoricalRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------------------------------------------------------ */
  /*  Upload & Analysis                                                   */
  /* ------------------------------------------------------------------ */

  // POST /api/v1/historical/analyze — Upload a file and analyze (no persist)
  app.post(`${PREFIX}/analyze`, {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ statusCode: 400, message: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const result = await app.historicalDataService.analyzeFile(buffer, data.filename);
    return reply.code(200).send({ data: result });
  });

  // POST /api/v1/historical/import — Upload, analyze, create table, load data
  app.post(`${PREFIX}/import`, {
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parts = request.parts();
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    const fields: Record<string, string> = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        fileName = part.filename;
      } else {
        fields[part.fieldname] = (part as any).value;
      }
    }

    if (!fileBuffer || !fileName) {
      return reply.code(400).send({ statusCode: 400, message: 'No file uploaded' });
    }
    if (!fields['name'] || !fields['domain']) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Fields "name" and "domain" are required',
      });
    }

    const user = request.user as AuthenticatedUser;
    const result = await app.historicalDataService.importDataset(
      fileBuffer,
      fileName,
      {
        name: fields['name'],
        description: fields['description'],
        domain: fields['domain'],
        tags: fields['tags'] ? JSON.parse(fields['tags']) : undefined,
      },
      user.tenantId,
      user.userId,
    );

    return reply.code(201).send(result);
  });

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                                */
  /* ------------------------------------------------------------------ */

  // GET /api/v1/historical — List datasets
  app.get(PREFIX, {
    schema: listDatasetsSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.historicalDataService.list(
      user.tenantId,
      user.tenantLevel,
      request.query as ListDatasetsDto,
    );
    return reply.code(200).send(result);
  });

  // GET /api/v1/historical/stats — Dashboard stats
  app.get(`${PREFIX}/stats`, {
    schema: statsSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.historicalDataService.getStats(user.tenantId, user.tenantLevel);
    return reply.code(200).send(result);
  });

  // GET /api/v1/historical/:id — Get dataset details
  app.get(`${PREFIX}/:id`, {
    schema: getDatasetSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.getById(id, user.tenantId, user.tenantLevel);
    return reply.code(200).send(result);
  });

  // PATCH /api/v1/historical/:id — Update dataset metadata
  app.patch(`${PREFIX}/:id`, {
    schema: updateDatasetSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.update(
      id,
      request.body as UpdateDatasetDto,
      user.tenantId,
      user.tenantLevel,
      user.userId,
    );
    return reply.code(200).send(result);
  });

  // DELETE /api/v1/historical/:id — Delete dataset and its table
  app.delete(`${PREFIX}/:id`, {
    schema: deleteDatasetSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    await app.historicalDataService.remove(id, user.tenantId, user.tenantLevel, user.userId);
    return reply.code(204).send();
  });

  /* ------------------------------------------------------------------ */
  /*  Data Query & Analytics                                              */
  /* ------------------------------------------------------------------ */

  // GET /api/v1/historical/:id/data — Query dataset rows
  app.get(`${PREFIX}/:id/data`, {
    schema: queryDataSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.queryData(
      id,
      request.query as any,
      user.tenantId,
      user.tenantLevel,
    );
    return reply.code(200).send(result);
  });

  // POST /api/v1/historical/:id/aggregate — Aggregate data
  app.post(`${PREFIX}/:id/aggregate`, {
    schema: aggregateSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.aggregateData(
      id,
      request.body as AggregateDto,
      user.tenantId,
      user.tenantLevel,
    );
    return reply.code(200).send(result);
  });

  // POST /api/v1/historical/:id/time-series — Time series analysis
  app.post(`${PREFIX}/:id/time-series`, {
    schema: timeSeriesSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.timeSeriesData(
      id,
      request.body as TimeSeriesDto,
      user.tenantId,
      user.tenantLevel,
    );
    return reply.code(200).send(result);
  });

  /* ------------------------------------------------------------------ */
  /*  Analyses (saved queries)                                            */
  /* ------------------------------------------------------------------ */

  // POST /api/v1/historical/:id/analyses — Create analysis
  app.post(`${PREFIX}/:id/analyses`, {
    schema: createAnalysisSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.ANALYST,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.createAnalysis(
      id,
      request.body as CreateAnalysisDto,
      user.tenantId,
      user.tenantLevel,
      user.userId,
    );
    return reply.code(201).send(result);
  });

  // GET /api/v1/historical/:id/analyses — List analyses
  app.get(`${PREFIX}/:id/analyses`, {
    schema: listAnalysesSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.historicalDataService.listAnalyses(id, user.tenantId, user.tenantLevel);
    return reply.code(200).send(result);
  });

  // DELETE /api/v1/historical/:id/analyses/:analysisId — Delete analysis
  app.delete(`${PREFIX}/:id/analyses/:analysisId`, {
    schema: deleteAnalysisSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id, analysisId } = request.params as { id: string; analysisId: string };
    await app.historicalDataService.deleteAnalysis(id, analysisId, user.tenantId, user.tenantLevel);
    return reply.code(204).send();
  });
}
