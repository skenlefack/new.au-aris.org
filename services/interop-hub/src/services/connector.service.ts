import type { PrismaClient } from '@prisma/client';
import type { ApiResponse } from '@aris/shared-types';
import type { ConnectorConfigEntity, ConnectorHealth } from '../entities/interop.entity';

export class ConnectorService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List all registered connectors with their status.
   */
  async listConnectors(): Promise<ApiResponse<ConnectorConfigEntity[]>> {
    const rows = await (this.prisma as any).connectorConfig.findMany({
      orderBy: { connector_type: 'asc' },
    });

    return {
      data: rows.map((r: any) => this.toEntity(r)),
    };
  }

  /**
   * Run health checks against all active connector endpoints.
   */
  async healthCheck(): Promise<ApiResponse<ConnectorHealth[]>> {
    const connectors = await (this.prisma as any).connectorConfig.findMany({
      where: { is_active: true },
    });

    const results: ConnectorHealth[] = [];

    for (const connector of connectors) {
      const status = await this.checkEndpoint(connector.base_url);

      // Update last health check
      await (this.prisma as any).connectorConfig.update({
        where: { id: connector.id },
        data: {
          last_health_check: new Date(),
          last_health_status: status,
        },
      });

      results.push({
        connectorType: connector.connector_type as ConnectorHealth['connectorType'],
        name: connector.name,
        isActive: connector.is_active,
        status,
        lastChecked: new Date(),
        baseUrl: connector.base_url,
      });
    }

    console.log(
      `[ConnectorService] Health check completed: ${results.length} connectors checked`,
    );
    return { data: results };
  }

  /**
   * Check if an endpoint is reachable.
   * Mock implementation — in production uses HTTP HEAD/GET.
   */
  async checkEndpoint(_baseUrl: string): Promise<string> {
    // Adapter pattern: replace with real HTTP check in production
    // Mock: assume all configured endpoints are UP
    return 'UP';
  }

  toEntity(row: {
    id: string;
    connector_type: string;
    name: string;
    description: string | null;
    base_url: string;
    auth_config: unknown;
    is_active: boolean;
    last_health_check: Date | null;
    last_health_status: string | null;
    config: unknown;
    created_at: Date;
    updated_at: Date;
  }): ConnectorConfigEntity {
    return {
      id: row.id,
      connectorType: row.connector_type as ConnectorConfigEntity['connectorType'],
      name: row.name,
      description: row.description,
      baseUrl: row.base_url,
      isActive: row.is_active,
      lastHealthCheck: row.last_health_check,
      lastHealthStatus: row.last_health_status,
      config: row.config,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
