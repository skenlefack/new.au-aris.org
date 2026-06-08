import type { authHook } from '@aris/auth-middleware';
import type { HealthKpiService } from '../services/health-kpi.service';
import type { CrossDomainService } from '../services/cross-domain.service';
import type { AggregationService } from '../services/aggregation.service';
import type { DomainAggregationService } from '../services/domain-aggregation.service';
import type { DbStatsService } from '../services/db-stats.service';
import type { IndicatorService } from '../indicators/indicator.service';
import type { FormulaEvaluator } from '../indicators/formula-evaluator';
import type { DashboardService } from '../dashboards/dashboard.service';
import type { WidgetResolver } from '../dashboards/widget-resolver';
import type { ReportService } from '../reports/report.service';
import type { DomainSummaryService } from '../domain-summary/domain-summary.service';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    healthKpiService: HealthKpiService;
    crossDomainService: CrossDomainService;
    aggregationService: AggregationService;
    domainAggregationService: DomainAggregationService;
    dbStatsService: DbStatsService;
    indicatorService: IndicatorService;
    formulaEvaluator: FormulaEvaluator;
    dashboardService: DashboardService;
    widgetResolver: WidgetResolver;
    reportService: ReportService;
    domainSummaryService: DomainSummaryService;
  }
}
