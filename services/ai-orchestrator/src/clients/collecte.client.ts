/**
 * CollecteClient — HTTP wrapper for the ARIS Collecte service.
 * Fetches form submissions for AI anomaly analysis.
 */

const COLLECTE_URL = process.env['COLLECTE_SERVICE_URL'] || 'http://localhost:3011';

export interface CollecteSubmission {
  id: string;
  campaignId: string;
  templateId: string;
  data: Record<string, unknown>;
  status: string;
  submittedAt: string;
}

export interface FetchSubmissionsParams {
  since?: string;
  limit?: number;
  domain?: string;
  campaignId?: string;
}

export class CollecteClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || COLLECTE_URL;
  }

  async fetchSubmissions(
    token: string,
    params: FetchSubmissionsParams = {},
  ): Promise<CollecteSubmission[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.since) query.set('since', params.since);
    if (params.domain) query.set('domain', params.domain);
    if (params.campaignId) query.set('campaignId', params.campaignId);

    const url = `${this.baseUrl}/api/v1/collecte/submissions?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Collecte API error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as { data: CollecteSubmission[] | { items: CollecteSubmission[] } };
    const data = body.data;
    if (Array.isArray(data)) return data;
    if (data && 'items' in data) return data.items;
    return [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}
