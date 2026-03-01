import type { FastifyInstance } from 'fastify';
import {
  RecCodeParamSchema,
  CountryCodeParamSchema,
  type RecCodeParamInput,
  type CountryCodeParamInput,
} from '../schemas/settings.schemas.js';

export async function registerPublicRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/public/recs — list active RECs (no auth)
  app.get('/api/v1/public/recs', async () => {
    return app.settingsService.getPublicRecs();
  });

  // GET /api/v1/public/recs/:code — get public REC by code (no auth)
  app.get<{ Params: RecCodeParamInput }>('/api/v1/public/recs/:code', {
    schema: { params: RecCodeParamSchema },
  }, async (request) => {
    return app.settingsService.getPublicRecByCode(request.params.code);
  });

  // GET /api/v1/public/countries/:code — get public country by code (no auth)
  app.get<{ Params: CountryCodeParamInput }>('/api/v1/public/countries/:code', {
    schema: { params: CountryCodeParamSchema },
  }, async (request) => {
    return app.settingsService.getPublicCountryByCode(request.params.code);
  });

  // GET /api/v1/public/stats — get public statistics (no auth)
  app.get('/api/v1/public/stats', async () => {
    return app.settingsService.getPublicStats();
  });

  // GET /api/v1/public/domains — list active domains (no auth)
  app.get('/api/v1/public/domains', async () => {
    return app.settingsService.getPublicDomains();
  });
}
