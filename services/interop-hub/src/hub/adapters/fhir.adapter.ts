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
      const resource = this.buildResource(record, resourceType, index);
      const entry: FhirBundleEntry = {
        fullUrl: `urn:uuid:${record.id ?? `aris-${index}`}`,
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
      total: entries.length,
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
      id: String(record.id ?? `aris-patient-${index}`),
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
      id: String(record.id ?? `aris-obs-${index}`),
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
      effectiveDateTime: this.formatDateTime(
        record.sample_date ?? record.date_collected ?? record.event_date ?? new Date(),
      ),
      issued: this.formatDateTime(record.result_date ?? record.date_result ?? new Date()),
      valueString: record.value !== undefined ? String(record.value) : undefined,
      valueQuantity:
        record.numeric_value !== undefined
          ? {
              value: Number(record.numeric_value),
              unit: String(record.unit ?? ''),
              system: 'http://unitsofmeasure.org',
            }
          : undefined,
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
      id: String(record.id ?? `aris-report-${index}`),
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
      effectiveDateTime: this.formatDateTime(
        record.report_date ?? record.date_report ?? new Date(),
      ),
      issued: this.formatDateTime(record.issued_at ?? new Date()),
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
