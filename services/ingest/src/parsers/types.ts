export interface ParsedSheet {
  sheetIndex: number;
  sheetName: string;
  headerRow: number;
  headers: string[];
  dataRows: string[][];
  delimiter?: string;
}

export interface ColumnStats {
  rawName: string;
  normalizedName: string;
  inferredType: string;
  cardinality: number;
  nullRate: number;
  minLength: number | null;
  maxLength: number | null;
  sampleValues: string[];
  detectedPatterns: string[];
}
