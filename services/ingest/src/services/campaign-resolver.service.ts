import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export interface CampaignCandidate {
  id: string;
  code: string;
  name: string;
  domain: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  templateId: string;
  targetSubmissions: number | null;
}

export interface DerivedCampaignParams {
  name: Record<string, string>;
  domain: string;
  templateId: string;
  startDate: string;
  endDate: string;
  targetSubmissions: number;
  scope: string;
}

/**
 * Find open campaigns compatible with the matched template and domain.
 */
export async function findCompatibleCampaigns(
  prisma: PrismaClient,
  tenantId: string,
  domainCode: string,
  templateId: string,
): Promise<CampaignCandidate[]> {
  // Search CollectionCampaign (new model)
  const campaigns = await (prisma as any).collectionCampaign.findMany({
    where: {
      status: 'ACTIVE',
      domain: domainCode,
      OR: [
        { formTemplateId: templateId },
        { formTemplateIds: { has: templateId } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Also check legacy Campaign table
  const legacyCampaigns = await (prisma as any).campaign.findMany({
    where: {
      status: 'ACTIVE',
      domain: domainCode,
      templateId,
      tenantId,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const results: CampaignCandidate[] = [];
  const seen = new Set<string>();

  for (const c of [...campaigns, ...legacyCampaigns]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);

    const name = typeof c.name === 'object' ? (c.name as Record<string, string>).en ?? JSON.stringify(c.name) : String(c.name);
    results.push({
      id: c.id,
      code: c.code ?? c.id.substring(0, 8),
      name,
      domain: c.domain,
      status: c.status,
      startDate: c.startDate ?? null,
      endDate: c.endDate ?? null,
      templateId: c.formTemplateId ?? c.templateId ?? templateId,
      targetSubmissions: c.targetSubmissions ?? null,
    });
  }

  return results;
}

/**
 * Derive campaign parameters from the file profile for creating a new campaign.
 */
export function deriveCampaignParams(
  domainCode: string,
  templateId: string,
  templateName: string,
  rowCount: number,
  user: AuthenticatedUser,
): DerivedCampaignParams {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 3); // 3-month default period

  const code = `INGEST-${domainCode.toUpperCase()}-${now.toISOString().slice(0, 10).replace(/-/g, '')}`;

  return {
    name: {
      en: `Import: ${templateName} (${now.toISOString().slice(0, 10)})`,
      fr: `Import : ${templateName} (${now.toISOString().slice(0, 10)})`,
    },
    domain: domainCode,
    templateId,
    startDate: now.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    targetSubmissions: rowCount,
    scope: user.tenantLevel === 'CONTINENTAL' ? 'continental' : user.tenantLevel === 'REC' ? 'rec' : 'country',
  };
}
