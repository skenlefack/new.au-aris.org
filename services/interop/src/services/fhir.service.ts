import type { PrismaClient } from '@prisma/client';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface FhirSearchParams {
  _count?: number;
  _offset?: number;
  subject?: string;
  code?: string;
  status?: string;
  date?: string;
  identifier?: string;
  species?: string;
}

/**
 * Serves FHIR R4 resources by mapping ARIS internal data to FHIR format.
 */
export class FhirService {
  constructor(private readonly prisma: PrismaClient) {}

  async searchPatients(params: FhirSearchParams) {
    const count = params._count ?? 20;
    const offset = params._offset ?? 0;

    // Query interop transactions for FHIR Patient data
    const where: Record<string, unknown> = { entity_type: 'Patient' };
    if (params.identifier) {
      where['source_payload'] = { path: ['identifier'], equals: params.identifier };
    }

    const transactions = await (this.prisma as any).interopTransaction.findMany({
      where: {
        entity_type: 'Patient',
        status: 'COMPLETED',
      },
      take: count,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });

    const entries = transactions.map((tx: any) => ({
      resource: this.buildPatientResource(tx),
      search: { mode: 'match' },
    }));

    return this.buildBundle('searchset', entries, transactions.length);
  }

  async getPatient(id: string) {
    const tx = await (this.prisma as any).interopTransaction.findFirst({
      where: { entity_type: 'Patient', id },
    });
    if (!tx) throw new HttpError(404, 'Patient not found');
    return this.buildPatientResource(tx);
  }

  async searchObservations(params: FhirSearchParams) {
    const count = params._count ?? 20;
    const offset = params._offset ?? 0;

    const transactions = await (this.prisma as any).interopTransaction.findMany({
      where: {
        entity_type: 'Observation',
        status: 'COMPLETED',
      },
      take: count,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });

    const entries = transactions.map((tx: any) => ({
      resource: this.buildObservationResource(tx),
      search: { mode: 'match' },
    }));

    return this.buildBundle('searchset', entries, transactions.length);
  }

  async getObservation(id: string) {
    const tx = await (this.prisma as any).interopTransaction.findFirst({
      where: { entity_type: 'Observation', id },
    });
    if (!tx) throw new HttpError(404, 'Observation not found');
    return this.buildObservationResource(tx);
  }

  async searchDiagnosticReports(params: FhirSearchParams) {
    const count = params._count ?? 20;
    const offset = params._offset ?? 0;

    const transactions = await (this.prisma as any).interopTransaction.findMany({
      where: {
        entity_type: 'DiagnosticReport',
        status: 'COMPLETED',
      },
      take: count,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });

    const entries = transactions.map((tx: any) => ({
      resource: this.buildDiagnosticReportResource(tx),
      search: { mode: 'match' },
    }));

    return this.buildBundle('searchset', entries, transactions.length);
  }

  async getDiagnosticReport(id: string) {
    const tx = await (this.prisma as any).interopTransaction.findFirst({
      where: { entity_type: 'DiagnosticReport', id },
    });
    if (!tx) throw new HttpError(404, 'DiagnosticReport not found');
    return this.buildDiagnosticReportResource(tx);
  }

  // -- helpers --

  private buildPatientResource(tx: any): Record<string, unknown> {
    const payload = tx.target_payload ?? tx.source_payload;
    return {
      resourceType: 'Patient',
      id: tx.id,
      meta: { lastUpdated: tx.created_at },
      identifier: [{ system: 'urn:aris:animal', value: payload?.identifier ?? tx.id }],
      active: true,
      extension: payload?.species
        ? [{
            url: 'http://hl7.org/fhir/StructureDefinition/patient-animal',
            extension: [{
              url: 'species',
              valueCodeableConcept: { text: payload.species },
            }],
          }]
        : undefined,
    };
  }

  private buildObservationResource(tx: any): Record<string, unknown> {
    const payload = tx.target_payload ?? tx.source_payload;
    return {
      resourceType: 'Observation',
      id: tx.id,
      meta: { lastUpdated: tx.created_at },
      status: payload?.status ?? 'final',
      code: {
        coding: [{
          system: 'urn:aris:observation',
          code: payload?.code ?? 'unknown',
        }],
      },
      subject: payload?.subjectId ? { reference: `Patient/${payload.subjectId}` } : undefined,
      effectiveDateTime: payload?.effectiveDate ?? tx.created_at,
      valueQuantity: payload?.value != null ? { value: Number(payload.value) } : undefined,
    };
  }

  private buildDiagnosticReportResource(tx: any): Record<string, unknown> {
    const payload = tx.target_payload ?? tx.source_payload;
    return {
      resourceType: 'DiagnosticReport',
      id: tx.id,
      meta: { lastUpdated: tx.created_at },
      status: payload?.status ?? 'final',
      code: {
        coding: [{
          system: 'urn:aris:diagnostic',
          code: payload?.code ?? 'unknown',
        }],
      },
      subject: payload?.subjectId ? { reference: `Patient/${payload.subjectId}` } : undefined,
      issued: payload?.issued ?? tx.created_at,
      conclusion: payload?.conclusion,
    };
  }

  private buildBundle(type: string, entries: unknown[], total: number) {
    return {
      resourceType: 'Bundle',
      type,
      total,
      entry: entries,
    };
  }
}
