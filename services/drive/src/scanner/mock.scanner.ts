import { Injectable, Logger } from '@nestjs/common';
import type { ScannerAdapter, ScanResult } from './scanner.interface';

/**
 * Mock virus scanner for development.
 * In production, replace with ClamAV or similar integration.
 */
@Injectable()
export class MockScanner implements ScannerAdapter {
  private readonly logger = new Logger(MockScanner.name);

  async scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    this.logger.debug(
      `[MOCK SCAN] Scanning ${filename} (${buffer.length} bytes) — clean`,
    );
    return { clean: true };
  }
}
