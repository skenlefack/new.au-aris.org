import {
  BaseAdapter,
  type AdapterConfig,
  type ConnectionTestResult,
  type SyncResult,
  type PullResult,
  type PullParams,
  type ValidationResult,
} from './base.adapter.js';

/**
 * FHIR R4 — Fast Healthcare Interoperability Resources adapter.
 * Supports Patient, Observation, DiagnosticReport resources.
 */
export class FhirAdapter extends BaseAdapter {
  readonly system = 'FHIR';
  readonly displayName = 'FHIR R4 (HL7)';

  async connect(_config: AdapterConfig): Promise<void> {}
  async disconnect(): Promise<void> {}

  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const headers = this.buildAuthHeaders(config);
      headers['Accept'] = 'application/fhir+json';
      const { status } = await this.httpRequest(
        `${config.baseUrl}/metadata`,
        'GET',
        headers,
      );
      return {
        success: status >= 200 && status < 300,
        message: status >= 200 && status < 300 ? 'FHIR R4 server reachable' : `HTTP ${status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  async push(records: unknown[], config: AdapterConfig): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const errors: { message: string; record?: unknown }[] = [];
    const headers = this.buildAuthHeaders(config);
    headers['Content-Type'] = 'application/fhir+json';

    // Build a FHIR Transaction Bundle
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: records.map((r) => {
        const resource = this.mapToExternal(r, 'Observation') as Record<string, unknown>;
        return {
          resource,
          request: {
            method: 'POST',
            url: resource['resourceType'] as string,
          },
        };
      }),
    };

    try {
      const { status, data } = await this.httpRequest(
        config.baseUrl,
        'POST',
        headers,
        bundle,
      );

      if (status >= 200 && status < 300) {
        return {
          recordsPushed: records.length,
          recordsPulled: 0,
          errors,
          startedAt,
          completedAt: new Date().toISOString(),
          status: 'COMPLETED',
        };
      }
      const opOutcome = data as Record<string, unknown>;
      errors.push({ message: `HTTP ${status}: ${JSON.stringify(opOutcome['issue'] ?? '')}` });
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    return {
      recordsPushed: 0,
      recordsPulled: 0,
      errors,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'FAILED',
    };
  }

  async pull(params: PullParams, config: AdapterConfig): Promise<PullResult> {
    const headers = this.buildAuthHeaders(config);
    headers['Accept'] = 'application/fhir+json';

    const resourceType = params.entityType || 'Observation';
    const queryParts: string[] = [];
    if (params.since) queryParts.push(`_lastUpdated=ge${params.since.toISOString()}`);
    if (params.filters?.['subject']) queryParts.push(`subject=${params.filters['subject']}`);
    if (params.filters?.['code']) queryParts.push(`code=${params.filters['code']}`);
    const qs = queryParts.length ? `?${queryParts.join('&')}` : '';

    try {
      const { status, data } = await this.httpRequest(
        `${config.baseUrl}/${resourceType}${qs}`,
        'GET',
        headers,
      );
      if (status >= 200 && status < 300) {
        const bundle = data as Record<string, unknown>;
        const entries = (bundle['entry'] as Array<Record<string, unknown>>) ?? [];
        const resources = entries.map((e) => this.mapToInternal(e['resource'], resourceType));
        return { records: resources, total: (bundle['total'] as number) ?? resources.length };
      }
      return { records: [], total: 0 };
    } catch {
      return { records: [], total: 0 };
    }
  }

  validate(record: unknown): ValidationResult {
    const errors: string[] = [];
    const r = record as Record<string, unknown>;
    if (!r['resourceType']) errors.push('resourceType is required');
    if (!r['id'] && !r['identifier']) errors.push('id or identifier is required');
    return { valid: errors.length === 0, errors };
  }

  mapToInternal(externalRecord: unknown, entityType: string): unknown {
    const ext = externalRecord as Record<string, unknown>;

    switch (entityType) {
      case 'Patient':
        return {
          id: ext['id'],
          identifier: this.extractIdentifier(ext),
          species: this.extractSpecies(ext),
          owner: this.extractOwner(ext),
          source: 'FHIR',
        };
      case 'Observation':
        return {
          id: ext['id'],
          code: this.extractCoding(ext['code']),
          value: this.extractValue(ext),
          subject: (ext['subject'] as Record<string, unknown>)?.['reference'],
          effectiveDate: ext['effectiveDateTime'],
          status: ext['status'],
          source: 'FHIR',
        };
      case 'DiagnosticReport':
        return {
          id: ext['id'],
          code: this.extractCoding(ext['code']),
          status: ext['status'],
          subject: (ext['subject'] as Record<string, unknown>)?.['reference'],
          issued: ext['issued'],
          conclusion: ext['conclusion'],
          source: 'FHIR',
        };
      default:
        return { ...ext, source: 'FHIR' };
    }
  }

  mapToExternal(internalRecord: unknown, entityType: string): unknown {
    const int = internalRecord as Record<string, unknown>;

    switch (entityType) {
      case 'Patient':
        return {
          resourceType: 'Patient',
          id: int['id'],
          identifier: [{ system: 'urn:aris:animal', value: int['identifier'] ?? int['id'] }],
          active: true,
          extension: [
            {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-animal',
              extension: [{ url: 'species', valueCodeableConcept: { text: int['species'] } }],
            },
          ],
        };
      case 'Observation':
        return {
          resourceType: 'Observation',
          id: int['id'],
          status: int['status'] ?? 'final',
          code: { coding: [{ system: 'urn:aris:observation', code: int['code'] }] },
          subject: int['subjectId'] ? { reference: `Patient/${int['subjectId']}` } : undefined,
          effectiveDateTime: int['effectiveDate'] ?? int['reportDate'],
          valueQuantity: int['value'] != null ? { value: Number(int['value']) } : undefined,
        };
      case 'DiagnosticReport':
        return {
          resourceType: 'DiagnosticReport',
          id: int['id'],
          status: int['status'] ?? 'final',
          code: { coding: [{ system: 'urn:aris:diagnostic', code: int['code'] }] },
          subject: int['subjectId'] ? { reference: `Patient/${int['subjectId']}` } : undefined,
          issued: int['issued'] ?? new Date().toISOString(),
          conclusion: int['conclusion'],
        };
      default:
        return { resourceType: entityType, ...int };
    }
  }

  // -- helpers --

  private extractIdentifier(resource: Record<string, unknown>): string | undefined {
    const ids = resource['identifier'] as Array<Record<string, unknown>> | undefined;
    return ids?.[0]?.['value'] as string | undefined;
  }

  private extractSpecies(resource: Record<string, unknown>): string | undefined {
    const exts = resource['extension'] as Array<Record<string, unknown>> | undefined;
    const animalExt = exts?.find(
      (e) => e['url'] === 'http://hl7.org/fhir/StructureDefinition/patient-animal',
    );
    if (!animalExt) return undefined;
    const innerExts = animalExt['extension'] as Array<Record<string, unknown>> | undefined;
    const speciesExt = innerExts?.find((e) => e['url'] === 'species');
    return (speciesExt?.['valueCodeableConcept'] as Record<string, unknown>)?.['text'] as string;
  }

  private extractOwner(resource: Record<string, unknown>): string | undefined {
    const contacts = resource['contact'] as Array<Record<string, unknown>> | undefined;
    const name = contacts?.[0]?.['name'] as Record<string, unknown> | undefined;
    return name?.['text'] as string | undefined;
  }

  private extractCoding(codeField: unknown): string | undefined {
    const cc = codeField as Record<string, unknown> | undefined;
    const codings = cc?.['coding'] as Array<Record<string, unknown>> | undefined;
    return codings?.[0]?.['code'] as string | undefined;
  }

  private extractValue(resource: Record<string, unknown>): unknown {
    if (resource['valueQuantity']) {
      return (resource['valueQuantity'] as Record<string, unknown>)['value'];
    }
    if (resource['valueString']) return resource['valueString'];
    if (resource['valueBoolean'] !== undefined) return resource['valueBoolean'];
    return undefined;
  }
}
