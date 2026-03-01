export interface ScanResult {
  clean: boolean;
  threat?: string;
}

export interface ScannerAdapter {
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

/**
 * Mock virus scanner for development.
 * In production, replace with ClamAV or similar integration.
 */
export class MockScanner implements ScannerAdapter {
  async scan(_buffer: Buffer, _filename: string): Promise<ScanResult> {
    return { clean: true };
  }
}
