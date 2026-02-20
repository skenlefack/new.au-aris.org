export interface DiseaseRecord {
  id: string;
  code: string;
  nameEn: string;
  nameFr: string;
  isWoahListed: boolean;
  affectedSpecies: string[];
  isNotifiable: boolean;
  wahisCategory: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
