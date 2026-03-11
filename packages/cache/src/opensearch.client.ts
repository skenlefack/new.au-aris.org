import { Client } from '@opensearch-project/opensearch';

export interface OpenSearchConfig {
  node: string;
  username?: string;
  password?: string;
  rejectUnauthorized?: boolean;
}

/**
 * Create a configured OpenSearch client for ARIS services.
 *
 * Usage:
 *   const client = createOpenSearchClient();
 *   const result = await client.search({ index: 'aris-*', body: { query: { match_all: {} } } });
 */
export function createOpenSearchClient(config?: Partial<OpenSearchConfig>): Client {
  const node = config?.node ?? process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200';
  const username = config?.username ?? process.env['OPENSEARCH_USER'];
  const password = config?.password ?? process.env['OPENSEARCH_PASSWORD'];
  const rejectUnauthorized = config?.rejectUnauthorized
    ?? (process.env['NODE_ENV'] === 'production');

  const clientOptions: Record<string, unknown> = { node };

  if (username && password) {
    clientOptions['auth'] = { username, password };
  }

  clientOptions['ssl'] = { rejectUnauthorized };

  return new Client(clientOptions as any);
}
