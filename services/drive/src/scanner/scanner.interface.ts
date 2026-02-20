export interface ScanResult {
  clean: boolean;
  threat?: string;
}

export interface ScannerAdapter {
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

export const SCANNER_ADAPTER = Symbol('SCANNER_ADAPTER');
