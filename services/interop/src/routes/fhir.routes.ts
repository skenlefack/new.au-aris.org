import type { FastifyInstance } from 'fastify';
import {
  FhirSearchSchema,
  FhirIdParamSchema,
  type FhirSearchQuery,
  type FhirIdParam,
} from '../schemas/fhir.schemas.js';

export async function registerFhirRoutes(app: FastifyInstance): Promise<void> {
  // FHIR endpoints are typically public or use their own auth
  const auth = app.authHookFn;

  // GET /api/v1/interop-v2/fhir/Patient
  app.get<{ Querystring: FhirSearchQuery }>('/api/v1/interop-v2/fhir/Patient', {
    schema: { querystring: FhirSearchSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.searchPatients(request.query);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });

  // GET /api/v1/interop-v2/fhir/Patient/:id
  app.get<{ Params: FhirIdParam }>('/api/v1/interop-v2/fhir/Patient/:id', {
    schema: { params: FhirIdParamSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.getPatient(request.params.id);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });

  // GET /api/v1/interop-v2/fhir/Observation
  app.get<{ Querystring: FhirSearchQuery }>('/api/v1/interop-v2/fhir/Observation', {
    schema: { querystring: FhirSearchSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.searchObservations(request.query);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });

  // GET /api/v1/interop-v2/fhir/Observation/:id
  app.get<{ Params: FhirIdParam }>('/api/v1/interop-v2/fhir/Observation/:id', {
    schema: { params: FhirIdParamSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.getObservation(request.params.id);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });

  // GET /api/v1/interop-v2/fhir/DiagnosticReport
  app.get<{ Querystring: FhirSearchQuery }>('/api/v1/interop-v2/fhir/DiagnosticReport', {
    schema: { querystring: FhirSearchSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.searchDiagnosticReports(request.query);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });

  // GET /api/v1/interop-v2/fhir/DiagnosticReport/:id
  app.get<{ Params: FhirIdParam }>('/api/v1/interop-v2/fhir/DiagnosticReport/:id', {
    schema: { params: FhirIdParamSchema },
    preHandler: [auth],
  }, async (request, reply) => {
    const result = await app.fhirService.getDiagnosticReport(request.params.id);
    return reply.header('Content-Type', 'application/fhir+json').send(result);
  });
}
