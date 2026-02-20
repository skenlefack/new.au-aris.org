export type SpeciesCategory = 'DOMESTIC' | 'WILDLIFE' | 'AQUATIC' | 'APICULTURE';

export interface SpeciesRecord {
  id: string;
  code: string;
  scientificName: string;
  commonNameEn: string;
  commonNameFr: string;
  category: SpeciesCategory;
  productionCategories: string[];
  isWoahListed: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
