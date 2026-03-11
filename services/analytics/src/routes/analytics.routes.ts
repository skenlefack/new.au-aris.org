import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics';

  // ── Health KPIs ──

  app.get(`${PREFIX}/health/kpis`, {
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.healthKpiService.getQualityDashboard();
    return reply.code(200).send({ data });
  });

  // ── Workflow Timeliness ──

  app.get(`${PREFIX}/workflow/timeliness`, {
    preHandler: [app.authHookFn],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await app.healthKpiService.getWorkflowTimeliness();
    return reply.code(200).send({ data });
  });

  // ── Denominators ──

  app.get(`${PREFIX}/denominators`, {
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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

  // ── Cross-Domain Correlations ──

  app.get(`${PREFIX}/cross-domain/correlations`, {
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
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
    preHandler: [app.authHookFn],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getClimateAlerts(country);
    return reply.code(200).send({ data });
  });

  // ── Governance PVS Scores ──

  app.get(`${PREFIX}/governance/pvs-scores`, {
    preHandler: [app.authHookFn],
  }, async (
    request: FastifyRequest<{ Querystring: { country?: string } }>,
    reply: FastifyReply,
  ) => {
    const { country } = request.query;
    const data = await app.crossDomainService.getPvsScores(country);
    return reply.code(200).send({ data });
  });
}
