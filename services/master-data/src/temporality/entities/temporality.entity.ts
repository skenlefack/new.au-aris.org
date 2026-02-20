export interface TemporalityRecord {
  id: string;
  code: string;
  nameEn: string;
  nameFr: string;
  calendarType: string;
  periodStart: Date;
  periodEnd: Date;
  year: number;
  weekNumber: number | null;
  monthNumber: number | null;
  quarterNumber: number | null;
  countryCode: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
