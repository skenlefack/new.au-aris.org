import { describe, it, expect } from 'vitest';
import { buildWahisXml } from '../services/wahis-xml.builder';
import type { WahisReportData } from '../services/wahis-xml.builder';

describe('buildWahisXml', () => {
  const sampleData: WahisReportData = {
    countryIso3: 'KEN',
    year: 2024,
    quarter: 1,
    diseases: [
      {
        diseaseName: 'Foot-and-Mouth Disease',
        oieCode: 'A010',
        outbreaks: [
          {
            dateReported: '2024-01-15',
            onsetDate: '2024-01-10',
            latitude: -1.2921,
            longitude: 36.8219,
            adminLevel1: 'Nairobi',
            species: [
              { name: 'Cattle', affected: 150, deaths: 5 },
              { name: 'Sheep', affected: 30, deaths: 2 },
            ],
            controlMeasures: ['Vaccination', 'Quarantine'],
          },
          {
            dateReported: '2024-02-20',
            latitude: -0.3031,
            longitude: 36.0800,
            adminLevel1: 'Nakuru',
            species: [{ name: 'Cattle', affected: 80, deaths: 3 }],
            controlMeasures: ['Movement control'],
          },
        ],
      },
    ],
  };

  it('should produce valid XML with WAHIS_Report root element', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('<?xml');
    expect(xml).toContain('WAHIS_Report');
    expect(xml).toContain('xmlns="urn:oie:wahis:v3"');
  });

  it('should include Country element with iso3 attribute', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('iso3="KEN"');
  });

  it('should include Period with year and quarter', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('year="2024"');
    expect(xml).toContain('quarter="Q1"');
  });

  it('should include Disease element with name and oieCode', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('name="Foot-and-Mouth Disease"');
    expect(xml).toContain('oieCode="A010"');
  });

  it('should include outbreak dates', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('<DateReported>2024-01-15</DateReported>');
    expect(xml).toContain('<OnsetDate>2024-01-10</OnsetDate>');
    expect(xml).toContain('<DateReported>2024-02-20</DateReported>');
  });

  it('should include Location with coordinates', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('lat="-1.2921"');
    expect(xml).toContain('lng="36.8219"');
    expect(xml).toContain('adminLevel1="Nairobi"');
  });

  it('should include Species with affected and deaths counts', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('name="Cattle"');
    expect(xml).toContain('affected="150"');
    expect(xml).toContain('deaths="5"');
    expect(xml).toContain('name="Sheep"');
    expect(xml).toContain('affected="30"');
    expect(xml).toContain('deaths="2"');
  });

  it('should include ControlMeasures', () => {
    const xml = buildWahisXml(sampleData);

    expect(xml).toContain('Vaccination');
    expect(xml).toContain('Quarantine');
    expect(xml).toContain('Movement control');
  });

  it('should handle empty diseases array', () => {
    const emptyData: WahisReportData = {
      countryIso3: 'ETH',
      year: 2025,
      quarter: 2,
      diseases: [],
    };

    const xml = buildWahisXml(emptyData);

    expect(xml).toContain('WAHIS_Report');
    expect(xml).toContain('iso3="ETH"');
    expect(xml).toContain('year="2025"');
    expect(xml).toContain('quarter="Q2"');
  });

  it('should handle disease with no outbreaks', () => {
    const noOutbreaks: WahisReportData = {
      countryIso3: 'NGA',
      year: 2024,
      quarter: 3,
      diseases: [
        {
          diseaseName: 'Rift Valley Fever',
          oieCode: 'A050',
          outbreaks: [],
        },
      ],
    };

    const xml = buildWahisXml(noOutbreaks);

    expect(xml).toContain('name="Rift Valley Fever"');
    expect(xml).toContain('oieCode="A050"');
  });

  it('should handle outbreak without coordinates', () => {
    const noCoords: WahisReportData = {
      countryIso3: 'KEN',
      year: 2024,
      quarter: 4,
      diseases: [
        {
          diseaseName: 'PPR',
          oieCode: 'B115',
          outbreaks: [
            {
              dateReported: '2024-10-01',
              species: [{ name: 'Goat', affected: 200, deaths: 10 }],
              controlMeasures: [],
            },
          ],
        },
      ],
    };

    const xml = buildWahisXml(noCoords);

    expect(xml).toContain('oieCode="B115"');
    expect(xml).toContain('<DateReported>2024-10-01</DateReported>');
    expect(xml).not.toContain('Location');
  });

  it('should group multiple diseases correctly', () => {
    const multiDisease: WahisReportData = {
      countryIso3: 'SEN',
      year: 2024,
      quarter: 1,
      diseases: [
        {
          diseaseName: 'FMD',
          oieCode: 'A010',
          outbreaks: [
            {
              dateReported: '2024-01-01',
              species: [{ name: 'Cattle', affected: 10, deaths: 0 }],
              controlMeasures: [],
            },
          ],
        },
        {
          diseaseName: 'CBPP',
          oieCode: 'B005',
          outbreaks: [
            {
              dateReported: '2024-02-01',
              species: [{ name: 'Cattle', affected: 50, deaths: 5 }],
              controlMeasures: ['Vaccination'],
            },
          ],
        },
      ],
    };

    const xml = buildWahisXml(multiDisease);

    expect(xml).toContain('oieCode="A010"');
    expect(xml).toContain('oieCode="B005"');
    expect(xml).toContain('name="CBPP"');
  });

  it('should return a string starting with XML declaration', () => {
    const xml = buildWahisXml(sampleData);

    expect(typeof xml).toBe('string');
    expect(xml.trim().startsWith('<?xml')).toBe(true);
  });
});
