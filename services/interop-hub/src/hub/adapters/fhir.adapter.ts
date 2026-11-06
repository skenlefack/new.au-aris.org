// ═══════════════════════════════════════════════════════════════════
//  FHIR R4 Adapter — Fast Healthcare Interoperability Resources
//  Converts ARIS records to FHIR R4 Bundles (Patient, Observation,
//  DiagnosticReport) for health information exchange.
// ═══════════════════════════════════════════════════════════════════

import {
  BaseAdapter,
  type AdapterConfig,
  type FormatBuildResult,
  type DeliveryResult,
  type PullResult,
  type HealthCheckResult,
} from './base.adapter';
import { randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** FHIR ids: [A-Za-z0-9-.]{1,64}. */
function fhirId(value: string): string {
  return value.replace(/[^A-Za-z0-9.-]/g, '-').slice(0, 64) || 'aris';
}

/**
 * Removes what FHIR forbids: empty strings, empty arrays and objects, codings
 * without a code, and extensions left without a value.
 */
export function pruneFhir(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(pruneFhir).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pruned = pruneFhir(v);
      if (pruned !== undefined) out[k] = pruned;
    }
    if ('system' in out && !('code' in out) && Object.keys(out).every((k) => k === 'system' || k === 'display')) {
      return undefined; // a Coding needs a code
    }
    if ('url' in out && Object.keys(out).length === 1) return undefined; // extension without value
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof value === 'string') return value.trim() === '' ? undefined : value;
  return value;
}

type BundleType = 'collection' | 'transaction' | 'batch';

interface FhirResource {
  resourceType: string;
  [key: string]: unknown;
}

interface FhirBundleEntry {
  fullUrl?: string;
  resource: FhirResource;
  request?: { method: string; url: string };
}

interface FhirBundle {
  resourceType: 'Bundle';
  type: BundleType;
  timestamp: string;
  entry: FhirBundleEntry[];
  total?: number;
}

export class FhirAdapter extends BaseAdapter {
  readonly systemType = 'FHIR';
  readonly displayName = 'FHIR R4';

  // ─── FORMAT BUILD ────────────────────────────────────────────────

  async formatBuild(
    records: Record<string, unknown>[],
    config: AdapterConfig & Record<string, unknown>,
  ): Promise<FormatBuildResult> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const bundleType = (config.bundle_type as BundleType) ?? 'collection';
    const resourceType = (config.resource_type as string) ?? 'Observation';

    const entries: FhirBundleEntry[] = records.map((record, index) => {
      const resource = this.withRequired(
        pruneFhir(this.buildResource(record, resourceType, index)) as FhirResource,
      );
      const id = String(record.id ?? '');
      const entry: FhirBundleEntry = {
        fullUrl: `urn:uuid:${UUID_RE.test(id) ? id.toLowerCase() : randomUUID()}`,
        resource,
      };

      // For transaction bundles, add request
      if (bundleType === 'transaction' || bundleType === 'batch') {
        entry.request = {
          method: 'POST',
          url: resource.resourceType,
        };
      }

      return entry;
    });

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      type: bundleType,
      timestamp: now.toISOString(),
      entry: entries,
    };

    const data = JSON.stringify(bundle, null, 2);
    return {
      format: 'FHIR_JSON',
      data,
      contentType: 'application/fhir+json',
      filename: `fhir-bundle-${timestamp}.json`,
      recordCount: records.length,
      metadata: { bundleType, resourceType, entryCount: entries.length },
    };
  }

  /** Restores elements FHIR requires (1..1) when the source record had nothing for them. */
  private withRequired(resource: FhirResource): FhirResource {
    if ((resource.resourceType === 'Observation' || resource.resourceType === 'DiagnosticReport') && !resource.code) {
      return { ...resource, code: { text: 'Not specified in source record' } };
    }
    return resource;
  }

  private buildResource(
    record: Record<string, unknown>,
    resourceType: string,
    index: number,
  ): FhirResource {
    switch (resourceType) {
      case 'Patient':
        return this.buildPatient(record, index);
      case 'DiagnosticReport':
        return this.buildDiagnosticReport(record, index);
      case 'Observation':
      default:
        return this.buildObservation(record, index);
    }
  }

  /**
   * Build a FHIR Patient resource (representing an animal record in vet context).
   */
  private buildPatient(record: Record<string, unknown>, index: number): FhirResource {
    return {
      resourceType: 'Patient',
      id: fhirId(String(record.id ?? `aris-patient-${index}`)),
      meta: {
        source: 'ARIS-InteropHub',
        lastUpdated: this.formatDateTime(record.updated_at ?? new Date()),
      },
      identifier: [
        {
          system: 'urn:aris:animal-id',
          value: String(record.animal_id ?? record.id ?? index),
        },
      ],
      active: true,
      name: [
        {
          text: String(record.name ?? record.animal_name ?? record.identifier ?? ''),
        },
      ],
      gender: this.mapGender(record.sex ?? record.gender),
      // Animal extension (FHIR R4 Patient can represent animals)
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/patient-animal',
          extension: [
            {
              url: 'species',
              valueCodeableConcept: {
                coding: [
                  {
                    system: 'urn:aris:species',
                    code: String(record.species_code ?? ''),
                    display: String(record.species_name ?? ''),
                  },
                ],
              },
            },
            ...(record.breed_code
              ? [
                  {
                    url: 'breed',
                    valueCodeableConcept: {
                      coding: [
                        {
                          system: 'urn:aris:breed',
                          code: String(record.breed_code),
                          display: String(record.breed_name ?? ''),
                        },
                      ],
                    },
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }

  /**
   * Build a FHIR Observation resource (lab results, surveillance data).
   */
  private buildObservation(record: Record<string, unknown>, index: number): FhirResource {
    return {
      resourceType: 'Observation',
      id: fhirId(String(record.id ?? `aris-obs-${index}`)),
      meta: {
        source: 'ARIS-InteropHub',
        lastUpdated: this.formatDateTime(record.updated_at ?? new Date()),
      },
      status: this.mapObservationStatus(record.status),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'urn:aris:test-type',
            code: String(record.test_code ?? record.disease_code ?? ''),
            display: String(record.test_name ?? record.disease_name ?? ''),
          },
        ],
        text: String(record.test_name ?? record.disease_name ?? record.indicator ?? ''),
      },
      subject: record.animal_id
        ? { reference: `Patient/${record.animal_id}` }
        : undefined,
      effectiveDateTime: this.optionalDateTime(
        record.sample_date ?? record.date_collected ?? record.event_date,
      ),
      issued: this.optionalDateTime(record.result_date ?? record.date_result),
      // value[x] is a choice: a quantity when the result is numeric, otherwise a string
      ...(record.numeric_value !== undefined && record.numeric_value !== null && !Number.isNaN(Number(record.numeric_value))
        ? {
            valueQuantity: {
              value: Number(record.numeric_value),
              unit: record.unit !== undefined ? String(record.unit) : undefined,
              // UCUM system/code only when the record gives a UCUM code
              ...(record.unit_ucum ? { system: 'http://unitsofmeasure.org', code: String(record.unit_ucum) } : {}),
            },
          }
        : { valueString: record.value !== undefined && record.value !== null ? String(record.value) : undefined }),
      interpretation: record.interpretation
        ? [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                  code: String(record.interpretation),
                },
              ],
            },
          ]
        : undefined,
      note: record.notes ? [{ text: String(record.notes) }] : undefined,
    };
  }

  /**
   * Build a FHIR DiagnosticReport resource.
   */
  private buildDiagnosticReport(record: Record<string, unknown>, index: number): FhirResource {
    return {
      resourceType: 'DiagnosticReport',
      id: fhirId(String(record.id ?? `aris-report-${index}`)),
      meta: {
        source: 'ARIS-InteropHub',
        lastUpdated: this.formatDateTime(record.updated_at ?? new Date()),
      },
      status: this.mapDiagnosticReportStatus(record.status),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'urn:aris:report-type',
            code: String(record.report_type ?? record.test_code ?? ''),
            display: String(record.report_name ?? record.test_name ?? ''),
          },
        ],
      },
      subject: record.animal_id
        ? { reference: `Patient/${record.animal_id}` }
        : undefined,
      effectiveDateTime: this.optionalDateTime(record.report_date ?? record.date_report),
      issued: this.optionalDateTime(record.issued_at),
      conclusion: record.conclusion ? String(record.conclusion) : undefined,
      conclusionCode: record.disease_code
        ? [
            {
              coding: [
                {
                  system: 'urn:aris:disease',
                  code: String(record.disease_code),
                  display: String(record.disease_name ?? ''),
                },
              ],
            },
          ]
        : undefined,
    };
  }

  /** Date-time only when the source has one: FHIR data must not invent clinical dates. */
  private optionalDateTime(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  private mapGender(value: unknown): string {
    const raw = String(value ?? '').toLowerCase();
    if (raw === 'male' || raw === 'm') return 'male';
    if (raw === 'female' || raw === 'f') return 'female';
    return 'unknown';
  }

  private mapObservationStatus(value: unknown): string {
    const statusMap: Record<string, string> = {
      pending: 'preliminary',
      preliminary: 'preliminary',
      final: 'final',
      confirmed: 'final',
      amended: 'amended',
      corrected: 'corrected',
      cancelled: 'cancelled',
      entered_in_error: 'entered-in-error',
    };
    return statusMap[String(value ?? 'final').toLowerCase()] ?? 'final';
  }

  private mapDiagnosticReportStatus(value: unknown): string {
    const statusMap: Record<string, string> = {
      pending: 'partial',
      preliminary: 'preliminary',
      final: 'final',
      confirmed: 'final',
      amended: 'amended',
      corrected: 'corrected',
      cancelled: 'cancelled',
      entered_in_error: 'entered-in-error',
    };
    return statusMap[String(value ?? 'final').toLowerCase()] ?? 'final';
  }

  // ─── DELIVER ─────────────────────────────────────────────────────

  async deliver(
    formatted: FormatBuildResult,
    config: AdapterConfig,
  ): Promise<DeliveryResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: 'No FHIR server base URL configured',
      };
    }

    try {
      // For transaction bundles, POST to base URL; for others, POST to /Bundle
      const url = baseUrl.replace(/\/+$/, '');
      const headers = this.buildAuthHeaders(config);
      headers['Content-Type'] = 'application/fhir+json';
      headers['Accept'] = 'application/fhir+json';
      headers['User-Agent'] = 'ARIS-InteropHub/1.0';

      const response = await this.httpRequest(url, {
        method: 'POST',
        headers,
        body: typeof formatted.data === 'string' ? formatted.data : formatted.data.toString('utf-8'),
        timeout: 60_000,
      });

      const responseBody = await response.text();
      return {
        success: response.ok || response.status === 201,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: new Date(),
        error:
          response.ok || response.status === 201
            ? undefined
            : `FHIR server returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredAt: new Date(),
        error: `FHIR delivery failed: ${err.message}`,
      };
    }
  }

  // ─── PULL ────────────────────────────────────────────────────────

  async pull(
    config: AdapterConfig,
    params: Record<string, unknown>,
  ): Promise<PullResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return { records: [], metadata: { error: 'No FHIR server base URL configured' } };
    }

    try {
      const resourceType = (params.resource_type as string) ?? 'Observation';
      const queryParts: string[] = [];

      // Map common search parameters
      if (params.patient) queryParts.push(`patient=${encodeURIComponent(String(params.patient))}`);
      if (params.code) queryParts.push(`code=${encodeURIComponent(String(params.code))}`);
      if (params.date) queryParts.push(`date=${encodeURIComponent(String(params.date))}`);
      if (params.status) queryParts.push(`status=${encodeURIComponent(String(params.status))}`);
      if (params._count) queryParts.push(`_count=${encodeURIComponent(String(params._count))}`);
      if (params._offset) queryParts.push(`_offset=${encodeURIComponent(String(params._offset))}`);

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `${baseUrl.replace(/\/+$/, '')}/${resourceType}${queryString}`;

      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/fhir+json';

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: 30_000,
      });

      if (!response.ok) {
        return { records: [], metadata: { error: `FHIR returned HTTP ${response.status}` } };
      }

      const bundle = (await response.json()) as Record<string, unknown>;
      const entries = (bundle.entry ?? []) as Array<{ resource?: Record<string, unknown> }>;
      const records = entries
        .filter(e => e.resource)
        .map(e => e.resource as Record<string, unknown>);

      // Check for pagination
      const links = (bundle.link ?? []) as Array<{ relation: string; url: string }>;
      const nextLink = links.find(l => l.relation === 'next');

      return {
        records,
        hasMore: Boolean(nextLink),
        cursor: nextLink?.url,
        metadata: { total: bundle.total, source: 'FHIR' },
      };
    } catch (err: any) {
      return {
        records: [],
        metadata: { error: `FHIR pull failed: ${err.message}` },
      };
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────────────

  async healthCheck(config: AdapterConfig): Promise<HealthCheckResult> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      return { status: 'DOWN', responseTimeMs: 0, message: 'No FHIR server base URL configured' };
    }

    const start = Date.now();
    try {
      // FHIR CapabilityStatement endpoint
      const url = `${baseUrl.replace(/\/+$/, '')}/metadata`;
      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/fhir+json';

      const response = await this.httpRequest(url, {
        method: 'GET',
        headers,
        timeout: 10_000,
      });

      const elapsed = Date.now() - start;

      if (response.ok) {
        const capability = (await response.json()) as Record<string, unknown>;
        return {
          status: 'UP',
          responseTimeMs: elapsed,
          statusCode: response.status,
          message: `FHIR R4 — ${capability.software ? (capability.software as Record<string, unknown>).name : 'Server OK'}`,
        };
      }

      return {
        status: 'DEGRADED',
        responseTimeMs: elapsed,
        statusCode: response.status,
        message: `FHIR server returned HTTP ${response.status}`,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      return {
        status: elapsed >= 10_000 ? 'TIMEOUT' : 'DOWN',
        responseTimeMs: elapsed,
        message: `FHIR health check failed: ${err.message}`,
      };
    }
  }
}
