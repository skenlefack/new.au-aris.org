import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 3: GEOGRAPHIC_CONSISTENCY
 * - Validates admin code fields exist in valid geo codes
 * - Validates coordinates fall within bounding box (Africa default: -35 to 37 lat, -25 to 55 lng)
 */
const AFRICA_BOUNDS: [number, number, number, number] = [-35, 37, -25, 55];

export class GeographicConsistencyGate implements QualityGateHandler {
  readonly gate = QualityGate.GEOGRAPHIC_CONSISTENCY;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    // 1. Validate geo code fields against valid codes
    const geoFields = config.geoFields ?? [];
    const validCodes = config.validCodes?.['geo'];

    for (const field of geoFields) {
      const value = record[field];
      if (value == null) continue;
      if (typeof value !== 'string') {
        violations.push({
          gate: this.gate,
          field,
          message: `"${field}" must be a string geo code`,
          severity: 'FAIL',
        });
        continue;
      }
      if (validCodes && !validCodes.has(value)) {
        violations.push({
          gate: this.gate,
          field,
          message: `"${field}" value "${value}" is not a valid geo code`,
          severity: 'FAIL',
        });
      }
    }

    // 2. Validate coordinates within bounding box
    const coordFields = config.coordinateFields;
    if (coordFields) {
      const [latField, lngField] = coordFields;
      const lat = record[latField];
      const lng = record[lngField];

      if (lat != null && lng != null) {
        const latNum = typeof lat === 'number' ? lat : parseFloat(String(lat));
        const lngNum = typeof lng === 'number' ? lng : parseFloat(String(lng));
        const [minLat, maxLat, minLng, maxLng] = config.coordinateBounds ?? AFRICA_BOUNDS;

        if (isNaN(latNum)) {
          violations.push({
            gate: this.gate,
            field: latField,
            message: `"${latField}" is not a valid number`,
            severity: 'FAIL',
          });
        } else if (latNum < minLat || latNum > maxLat) {
          violations.push({
            gate: this.gate,
            field: latField,
            message: `Latitude ${latNum} is outside bounds [${minLat}, ${maxLat}]`,
            severity: 'FAIL',
          });
        }

        if (isNaN(lngNum)) {
          violations.push({
            gate: this.gate,
            field: lngField,
            message: `"${lngField}" is not a valid number`,
            severity: 'FAIL',
          });
        } else if (lngNum < minLng || lngNum > maxLng) {
          violations.push({
            gate: this.gate,
            field: lngField,
            message: `Longitude ${lngNum} is outside bounds [${minLng}, ${maxLng}]`,
            severity: 'FAIL',
          });
        }
      }
    }

    const hasGeoChecks = geoFields.length > 0 || coordFields;
    if (!hasGeoChecks) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    return {
      gate: this.gate,
      result: violations.length > 0 ? QualityGateResult.FAIL : QualityGateResult.PASS,
      violations,
      durationMs: Date.now() - start,
    };
  }
}
