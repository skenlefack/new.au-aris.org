import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { domainsHook, tenantHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics';

  // ── Dashboard KPIs (main analytics page) ──

  app.get(`${PREFIX}/dashboard/kpis`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    // Query real record counts from PostgreSQL (cached 2 min in Redis)
    const stats = await app.dbStatsService.getDashboardStats();

    return reply.code(200).send({
      data: {
        activeOutbreaks: 0,
        vaccinationCoverage: 0,
        pendingValidations: stats.pendingValidations,
        dataQualityScore: stats.qualityScore,
        labTurnaround: 0,
        tradeVolume: 0,
        livestockPopulation: 0,
        activeCampaigns: 0,
        countriesReporting: stats.activeCountries,
        outbreaksTrend: 0,
        vaccinationTrend: 0,
        validationsTrend: 0,
        qualityTrend: 0,
        labTurnaroundTrend: 0,
        tradeVolumeTrend: 0,
        livestockTrend: 0,
        campaignsTrend: 0,
        domainBreakdown: stats.domainBreakdown,
        qualityTrendLine: stats.qualityTrendLine,
      },
    });
  });

  // ── Health KPIs ──

  app.get(`${PREFIX}/health/kpis`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('animal-health')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string; disease?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country, disease } = request.query;
    const data = await app.healthKpiService.getHealthKpis(country, disease);
    return reply.code(200).send({ data });
  });

  // ── Health Trends ──

  app.get(`${PREFIX}/health/trends`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('animal-health')],
  }, async (
    request: FastifyRequest<{ Querystring: { period?: string } }>,
    reply: FastifyReply,
  ) => {
    const { period } = request.query;
    const months = period ? parseInt(period.replace('m', ''), 10) : 6;
    const data = await app.healthKpiService.getHealthTrends(
      isNaN(months) ? 6 : months,
    );
    return reply.code(200).send({ data });
  });

  // ── Quality Dashboard ──

  app.get(`${PREFIX}/quality/dashboard`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('animal-health')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.healthKpiService.getQualityDashboard();
    return reply.code(200).send({ data });
  });

  // ── Workflow Timeliness ──

  app.get(`${PREFIX}/workflow/timeliness`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('animal-health')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.healthKpiService.getWorkflowTimeliness();
    return reply.code(200).send({ data });
  });

  // ── Denominators ──

  app.get(`${PREFIX}/denominators`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('animal-health')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.healthKpiService.getDenominators(country);
    return reply.code(200).send({ data });
  });

  // ── CSV Export ──

  app.get(`${PREFIX}/export/csv`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest<{ Querystring: { domain?: string; country?: string } }>,
    reply: FastifyReply,
  ) => {
    const csvDomain = request.query.domain ?? 'health';
    const { country } = request.query;
    let rows: string[][] = [];
    let headers: string[] = [];

    if (csvDomain === 'health') {
      headers = ['countryCode', 'diseaseId', 'active', 'confirmed', 'cases', 'deaths'];
      const kpis = await app.healthKpiService.getHealthKpisByDisease(country);
      rows = kpis.map((k) => [
        k.countryCode,
        k.diseaseId,
        String(k.active),
        String(k.confirmed),
        String(k.cases),
        String(k.deaths),
      ]);
    } else if (csvDomain === 'vaccination') {
      headers = ['countryCode', 'diseaseId', 'dosesUsed', 'targetPopulation', 'coverage', 'campaigns'];
      const denoms = await app.healthKpiService.getDenominators(country);
      rows = denoms.map((d) => [
        d.countryCode,
        d.diseaseId,
        String(d.dosesUsed),
        String(d.targetPopulation),
        String(d.coverage),
        String(d.campaigns),
      ]);
    } else if (csvDomain === 'quality') {
      headers = ['passRate', 'failRate', 'totalRecords', 'passCount', 'failCount'];
      const q = await app.healthKpiService.getQualityDashboard();
      rows = [[
        String(q.passRate),
        String(q.failRate),
        String(q.totalRecords),
        String(q.passCount),
        String(q.failCount),
      ]];
    }

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="analytics-${csvDomain}.csv"`)
      .send(csv);
  });

  // ── Continental KPIs (all domains aggregated) — reads from PostgreSQL historical tables ──

  app.get(`${PREFIX}/continental/kpis`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    // Use DbStatsService for real data from historical tables
    if (app.dbStatsService) {
      const data = await app.dbStatsService.getContinentalKpis();
      return reply.code(200).send({ data });
    }
    // Fallback to Redis-based (empty when no Kafka events)
    const data = await app.crossDomainService.getContinentalKpis();
    return reply.code(200).send({ data });
  });

  // ── Dashboard Charts (disease/country distribution + monthly trend) ──

  app.get(`${PREFIX}/dashboard/charts`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (app.dbStatsService) {
      const data = await app.dbStatsService.getDashboardCharts();
      return reply.code(200).send({ data });
    }
    return reply.code(200).send({ data: { diseaseDistribution: [], countryDistribution: [], monthlyTrend: [] } });
  });

  // ── Generic Domain KPIs (mobile app uses /{domainKey}/kpis) ──

  app.get(`${PREFIX}/:domainKey/kpis`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest<{ Params: { domainKey: string } }>,
    reply: FastifyReply,
  ) => {
    const { domainKey } = request.params;
    const data = await app.crossDomainService.getDomainKpis(domainKey);
    return reply.code(200).send({ data });
  });

  // ── Cross-Domain Correlations ──

  app.get(`${PREFIX}/cross-domain/correlations`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getCorrelations(country);
    return reply.code(200).send({ data });
  });

  // ── Cross-Domain Risk Score ──

  app.get(`${PREFIX}/cross-domain/risk-score`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    if (!country) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'country query parameter is required',
      });
    }
    const data = await app.crossDomainService.getRiskScore(country);
    return reply.code(200).send({ data });
  });

  // ── Livestock Population ──

  app.get(`${PREFIX}/livestock/population`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('livestock-prod')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getLivestockPopulation(country);
    return reply.code(200).send({ data });
  });

  // ── Fisheries Catches ──

  app.get(`${PREFIX}/fisheries/catches`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('fisheries')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getFisheriesCatches(country);
    return reply.code(200).send({ data });
  });

  // ── Trade Balance ──

  app.get(`${PREFIX}/trade/balance`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('trade-sps')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getTradeBalance(country);
    return reply.code(200).send({ data });
  });

  // ── Wildlife Crime Trends ──

  app.get(`${PREFIX}/wildlife/crime-trends`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('wildlife')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getWildlifeCrimeTrends(country);
    return reply.code(200).send({ data });
  });

  // ── Climate Alerts ──

  app.get(`${PREFIX}/climate/alerts`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('climate-env')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getClimateAlerts(country);
    return reply.code(200).send({ data });
  });

  // ── Governance Vet Services Scores ──

  app.get(`${PREFIX}/governance/vet-scores`, {
    preHandler: [app.authHookFn, tenantHook(), domainsHook('governance')],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getVetScores(country);
    return reply.code(200).send({ data });
  });

  // ── Submissions by domain (mobile dashboard) ──

  app.get(`${PREFIX}/submissions/by-domain`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await app.dbStatsService.getDashboardStats();
    const breakdown = (stats.domainBreakdown || []).map((d) => ({
      domain: d.domain,
      count: d.records,
      quality: d.quality,
    }));
    return reply.code(200).send({
      data: breakdown,
      total: stats.totalRecords,
    });
  });

  // ── Submissions timeline (mobile dashboard) ──

  app.get(`${PREFIX}/submissions/timeline`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest<{ Querystring: { period?: string } }>,
    reply: FastifyReply,
  ) => {
    const stats = await app.dbStatsService.getDashboardStats();
    return reply.code(200).send({
      data: stats.qualityTrendLine || [],
    });
  });

  // ── Beneficiaries by country (mobile dashboard) ──

  app.get(`${PREFIX}/beneficiaries/by-country`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await app.dbStatsService.getDashboardStats();
    // Derive country breakdown from domain stats
    return reply.code(200).send({
      data: [],
      note: 'Beneficiary tracking not yet implemented — use /continental/kpis for country-level data',
    });
  });
}
