import { XMLBuilder } from 'fast-xml-parser';

export interface WahisSpeciesAffected {
  name: string;
  affected: number;
  deaths: number;
}

export interface WahisOutbreak {
  dateReported: string;
  onsetDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adminLevel1?: string | null;
  species: WahisSpeciesAffected[];
  controlMeasures: string[];
}

export interface WahisDiseaseOccurrence {
  diseaseName: string;
  oieCode: string;
  outbreaks: WahisOutbreak[];
}

export interface WahisReportData {
  countryIso3: string;
  year: number;
  quarter: number;
  diseases: WahisDiseaseOccurrence[];
}

/**
 * Build a WAHIS-compatible XML report from structured data.
 * Returns a UTF-8 XML string conforming to the WOAH WAHIS v3 schema.
 */
export function buildWahisXml(data: WahisReportData): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
  });

  const report: Record<string, unknown> = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    WAHIS_Report: {
      '@_xmlns': 'urn:oie:wahis:v3',
      Country: {
        '@_iso3': data.countryIso3,
      },
      Period: {
        '@_year': String(data.year),
        '@_quarter': `Q${data.quarter}`,
      },
      DiseaseOccurrences: {
        Disease: data.diseases.map((disease) => ({
          '@_name': disease.diseaseName,
          '@_oieCode': disease.oieCode,
          Outbreaks: {
            Outbreak: disease.outbreaks.map((outbreak) => {
              const outbreakObj: Record<string, unknown> = {
                DateReported: outbreak.dateReported,
              };

              if (outbreak.onsetDate) {
                outbreakObj.OnsetDate = outbreak.onsetDate;
              }

              if (outbreak.latitude != null && outbreak.longitude != null) {
                outbreakObj.Location = {
                  '@_lat': String(outbreak.latitude),
                  '@_lng': String(outbreak.longitude),
                };
                if (outbreak.adminLevel1) {
                  (outbreakObj.Location as Record<string, unknown>)['@_adminLevel1'] =
                    outbreak.adminLevel1;
                }
              }

              if (outbreak.species.length > 0) {
                outbreakObj.Species = outbreak.species.map((sp) => ({
                  '@_name': sp.name,
                  '@_affected': String(sp.affected),
                  '@_deaths': String(sp.deaths),
                }));
              }

              if (outbreak.controlMeasures.length > 0) {
                outbreakObj.ControlMeasures = {
                  Measure: outbreak.controlMeasures,
                };
              }

              return outbreakObj;
            }),
          },
        })),
      },
    },
  };

  return builder.build(report) as string;
}
