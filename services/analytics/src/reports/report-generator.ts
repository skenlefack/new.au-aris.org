/**
 * report-generator.ts — Orchestrates full report generation pipeline.
 *
 * For each section in the template:
 *   1. Resolve data (DataResolver)
 *   2. If AI_GENERATED: build prompt + call OllamaClient
 *   3. If INDICATORS_TABLE/MAP_AND_TABLE: format data as HTML
 *   4. Persist section content
 *
 * If Ollama is unavailable, AI sections are marked AI_UNAVAILABLE
 * and the report still proceeds to AWAITING_REVIEW with a flag.
 */

import { Pool } from 'pg';
import { OllamaClient } from './ollama.client';
import { PromptBuilder } from './prompt-builder';
import { DataResolver } from './data-resolver';
import { OutputValidator } from './output-validator';
import type { ReportContext, SectionConfig } from './data-resolver';
import type { FastifyKafka } from '@aris/kafka-client/fastify';
import {
  TOPIC_SYS_ANALYTICS_REPORT_GENERATED,
  TOPIC_SYS_ANALYTICS_REPORT_GENERATION_FAILED,
} from '@aris/shared-types';

const DEFAULT_MODEL = 'qwen2.5:32b';
const KAFKA_TIMEOUT_MS = 5_000;

interface TemplateSection {
  code: string;
  titleFr: string;
  titleEn: string;
  sectionType: string;
  promptTemplate?: string;
  indicatorCodes?: string[];
  displayOrder: number;
  required?: boolean;
}

export class ReportGenerator {
  private pool: Pool;
  private ollama: OllamaClient;
  private promptBuilder: PromptBuilder;
  private dataResolver: DataResolver;
  private outputValidator: OutputValidator;

  constructor(
    private readonly kafka: FastifyKafka | null,
    databaseUrl?: string,
  ) {
    const url =
      databaseUrl ||
      process.env['DATABASE_URL'] ||
      process.env['DIRECT_DATABASE_URL'] ||
      'postgresql://aris:aris@localhost:5432/aris';
    this.pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000 });
    this.ollama = new OllamaClient();
    this.promptBuilder = new PromptBuilder();
    this.dataResolver = new DataResolver(url);
    this.outputValidator = new OutputValidator();
  }

  /**
   * Generate all sections for a report. Called asynchronously after report creation.
   */
  async generate(reportId: string): Promise<void> {
    let report: Record<string, unknown> | null = null;

    try {
      // 1. Load report + template
      const { rows: reportRows } = await this.pool.query(
        `SELECT r.*, rt.sections AS template_sections, rt.type AS template_type
         FROM reports.reports r
         JOIN reports.report_templates rt ON rt.id = r.template_id
         WHERE r.id = $1`,
        [reportId],
      );
      if (!reportRows[0]) throw new Error(`Report ${reportId} not found`);
      report = reportRows[0] as Record<string, unknown>;

      // Update status to GENERATING
      await this.pool.query(
        `UPDATE reports.reports SET status = 'GENERATING', updated_at = NOW() WHERE id = $1`,
        [reportId],
      );

      const sections = (report['template_sections'] as TemplateSection[]) ?? [];
      const reportCtx: ReportContext = {
        id: reportId,
        domainId: report['domain_id'] as string | undefined,
        tenantId: report['tenant_id'] as string | undefined,
        scope: report['scope'] as string,
        periodStart: report['period_start'] as string,
        periodEnd: report['period_end'] as string,
        referenceYear: report['reference_year'] as number | undefined,
        language: report['language'] as string,
      };

      // Check Ollama availability once
      const ollamaAvailable = await this.ollama.healthCheck();
      let hasUnavailableAi = false;
      let requiresReview = false;

      // 2. Process each section
      for (const section of sections.sort((a, b) => a.displayOrder - b.displayOrder)) {
        const sectionConfig: SectionConfig = {
          sectionType: section.sectionType,
          indicatorCodes: section.indicatorCodes,
          promptTemplate: section.promptTemplate,
        };

        let contentHtml = '';
        let sectionStatus = 'GENERATED';

        try {
          // Resolve data
          const data = await this.dataResolver.resolveStatsForSection(sectionConfig, reportCtx);

          switch (section.sectionType) {
            case 'AI_GENERATED_FROM_DATA':
            case 'EXECUTIVE_SUMMARY':
            case 'RECOMMENDATIONS': {
              if (!ollamaAvailable) {
                sectionStatus = 'AI_UNAVAILABLE';
                hasUnavailableAi = true;
                contentHtml = this.buildUnavailableHtml(section, reportCtx.language);
                break;
              }

              const systemPrompt = this.promptBuilder.buildSystemPrompt(reportCtx.language);
              const variables = this.buildVariables(report, section, reportCtx);
              const basePromptTemplate = section.promptTemplate ?? this.defaultPrompt(section.sectionType, reportCtx.language);
              const prompt = this.promptBuilder.buildDataPrompt(
                basePromptTemplate,
                variables,
                data as Record<string, unknown>,
                reportCtx.language,
              );

              const result = await this.ollama.generate({
                model: DEFAULT_MODEL,
                prompt,
                system: systemPrompt,
                temperature: 0.3,
                maxTokens: 4096,
              });

              // Validate AI output
              let validation = this.outputValidator.validate(result.output, {
                expectedLanguage: reportCtx.language,
                resolvedData: data,
              });

              if (!validation.valid) {
                // Retry once with reinforced prompt
                console.warn(`[ReportGenerator] Section ${section.code} failed validation (${validation.errors.join('; ')}), retrying with reinforced prompt`);
                const reinforcedPrompt = prompt + '\n\nATTENTION: Ne mentionnez JAMAIS PVS (Performance of Veterinary Services). Do NOT mention PVS under any circumstances.';

                const retryResult = await this.ollama.generate({
                  model: DEFAULT_MODEL,
                  prompt: reinforcedPrompt,
                  system: systemPrompt,
                  temperature: 0.2,
                  maxTokens: 4096,
                });

                validation = this.outputValidator.validate(retryResult.output, {
                  expectedLanguage: reportCtx.language,
                  resolvedData: data,
                });

                if (!validation.valid) {
                  // Still invalid after retry — mark as FAILED
                  console.error(`[ReportGenerator] Section ${section.code} still invalid after retry: ${validation.errors.join('; ')}`);
                  sectionStatus = 'FAILED';
                  contentHtml = this.buildFailedValidationHtml(section, reportCtx.language, validation.errors);
                  break;
                }

                contentHtml = this.markdownToHtml(retryResult.output);
              } else {
                contentHtml = this.markdownToHtml(result.output);
              }

              // If warnings present, flag for review
              if (validation.warnings.length > 0) {
                requiresReview = true;
                console.warn(`[ReportGenerator] Section ${section.code} has warnings: ${validation.warnings.join('; ')}`);
              }
              break;
            }

            case 'INDICATORS_TABLE': {
              contentHtml = this.buildIndicatorsTableHtml(data.indicators ?? [], reportCtx.language);
              break;
            }

            case 'MAP_AND_TABLE': {
              contentHtml = this.buildCountryTableHtml(
                data.countryBreakdown ?? [],
                section.indicatorCodes ?? [],
                reportCtx.language,
              );
              break;
            }

            case 'COVER':
            case 'FREE_TEXT':
            case 'ANNEX':
            default: {
              // Static sections — content comes from user edits later
              sectionStatus = 'PENDING';
              break;
            }
          }
        } catch (err) {
          console.error(`[ReportGenerator] Section ${section.code} failed:`, err);
          if (section.sectionType.includes('AI') || section.sectionType === 'EXECUTIVE_SUMMARY' || section.sectionType === 'RECOMMENDATIONS') {
            sectionStatus = 'AI_UNAVAILABLE';
            hasUnavailableAi = true;
            contentHtml = this.buildUnavailableHtml(section, reportCtx.language);
          } else {
            sectionStatus = 'GENERATED';
            contentHtml = `<p>Error generating section: ${(err as Error).message}</p>`;
          }
        }

        // Persist section
        await this.pool.query(
          `INSERT INTO reports.report_sections
             (id, report_id, section_code, title_fr, title_en, section_type, display_order, content_html, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (report_id, section_code) DO UPDATE
             SET content_html = EXCLUDED.content_html,
                 status = EXCLUDED.status,
                 updated_at = NOW()`,
          [
            reportId,
            section.code,
            section.titleFr,
            section.titleEn,
            section.sectionType,
            section.displayOrder,
            contentHtml,
            sectionStatus,
          ],
        );
      }

      // 3. Update report status
      const templateType = report['template_type'] as string;
      const finalStatus = templateType === 'FLASH' ? 'PUBLISHED' : 'AWAITING_REVIEW';

      await this.pool.query(
        `UPDATE reports.reports
         SET status = $1,
             ai_unavailable = $2,
             requires_review = $3,
             generated_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [finalStatus, hasUnavailableAi, requiresReview, reportId],
      );

      // 4. Publish Kafka event
      await this.publishEvent(TOPIC_SYS_ANALYTICS_REPORT_GENERATED, {
        reportId,
        status: finalStatus,
        aiUnavailable: hasUnavailableAi,
        requiresReview,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[ReportGenerator] Report ${reportId} generation failed:`, err);

      // Mark as FAILED
      await this.pool.query(
        `UPDATE reports.reports
         SET status = 'FAILED', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [(err as Error).message, reportId],
      ).catch(() => {});

      await this.publishEvent(TOPIC_SYS_ANALYTICS_REPORT_GENERATION_FAILED, {
        reportId,
        error: (err as Error).message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  // ── HTML Builders ──

  private buildIndicatorsTableHtml(
    indicators: Array<{ code: string; name: string; value: number; unit: string; period: string }>,
    language: string,
  ): string {
    if (!indicators.length) {
      return language === 'fr'
        ? '<p>Aucune donnee disponible pour cette periode.</p>'
        : '<p>No data available for this period.</p>';
    }

    const headers = language === 'fr'
      ? ['Code', 'Indicateur', 'Valeur', 'Unite', 'Periode']
      : ['Code', 'Indicator', 'Value', 'Unit', 'Period'];

    let html = '<table class="report-table"><thead><tr>';
    for (const h of headers) html += `<th>${h}</th>`;
    html += '</tr></thead><tbody>';
    for (const row of indicators) {
      html += `<tr><td>${row.code}</td><td>${row.name}</td><td>${row.value}</td><td>${row.unit}</td><td>${row.period}</td></tr>`;
    }
    html += '</tbody></table>';
    return html;
  }

  private buildCountryTableHtml(
    countries: Array<{ tenantName: string; iso3: string; values: Record<string, number> }>,
    indicatorCodes: string[],
    language: string,
  ): string {
    if (!countries.length) {
      return language === 'fr'
        ? '<p>Aucune donnee pays disponible.</p>'
        : '<p>No country data available.</p>';
    }

    const countryHeader = language === 'fr' ? 'Pays' : 'Country';
    let html = '<table class="report-table"><thead><tr>';
    html += `<th>${countryHeader}</th>`;
    for (const code of indicatorCodes) html += `<th>${code}</th>`;
    html += '</tr></thead><tbody>';
    for (const c of countries) {
      html += `<tr><td>${c.tenantName} (${c.iso3})</td>`;
      for (const code of indicatorCodes) {
        html += `<td>${c.values[code] ?? '-'}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  private buildUnavailableHtml(section: TemplateSection, language: string): string {
    const title = language === 'fr' ? section.titleFr : section.titleEn;
    const msg = language === 'fr'
      ? 'Le service IA est temporairement indisponible. Cette section peut etre regeneree ulterieurement.'
      : 'The AI service is temporarily unavailable. This section can be regenerated later.';
    return `<div class="ai-unavailable"><h3>${title}</h3><p>${msg}</p></div>`;
  }

  private buildFailedValidationHtml(section: TemplateSection, language: string, errors: string[]): string {
    const title = language === 'fr' ? section.titleFr : section.titleEn;
    const msg = language === 'fr'
      ? 'La generation IA a echoue la validation de qualite. Cette section doit etre regeneree.'
      : 'AI generation failed quality validation. This section must be regenerated.';
    const errorList = errors.map(e => `<li>${e}</li>`).join('');
    return `<div class="ai-validation-failed"><h3>${title}</h3><p>${msg}</p><ul>${errorList}</ul></div>`;
  }

  private buildVariables(
    report: Record<string, unknown>,
    section: TemplateSection,
    ctx: ReportContext,
  ): Record<string, string> {
    return {
      reportTitle: (ctx.language === 'fr' ? report['title_fr'] : report['title_en']) as string ?? '',
      sectionTitle: ctx.language === 'fr' ? section.titleFr : section.titleEn,
      scope: ctx.scope,
      periodStart: ctx.periodStart,
      periodEnd: ctx.periodEnd,
      referenceYear: String(ctx.referenceYear ?? ''),
      language: ctx.language,
    };
  }

  /**
   * Minimal markdown-to-HTML conversion (headings, bold, lists).
   */
  private markdownToHtml(md: string): string {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hup]|<li|<ul|<table|<div)(.+)$/gm, '<p>$1</p>');
  }

  private defaultPrompt(sectionType: string, language: string): string {
    const prompts: Record<string, Record<string, string>> = {
      EXECUTIVE_SUMMARY: {
        fr: 'Redige un resume executif base sur les donnees fournies pour la periode {{periodStart}} a {{periodEnd}}. Scope: {{scope}}.',
        en: 'Write an executive summary based on the provided data for the period {{periodStart}} to {{periodEnd}}. Scope: {{scope}}.',
      },
      RECOMMENDATIONS: {
        fr: 'Propose des recommandations strategiques basees sur les donnees analysees pour la periode {{periodStart}} a {{periodEnd}}.',
        en: 'Propose strategic recommendations based on the analyzed data for the period {{periodStart}} to {{periodEnd}}.',
      },
      AI_GENERATED_FROM_DATA: {
        fr: 'Analyse les donnees fournies et redige une section narrative pour le rapport. Periode: {{periodStart}} a {{periodEnd}}. Scope: {{scope}}.',
        en: 'Analyze the provided data and write a narrative section for the report. Period: {{periodStart}} to {{periodEnd}}. Scope: {{scope}}.',
      },
    };
    return prompts[sectionType]?.[language] ?? prompts[sectionType]?.['en'] ?? '';
  }

  private async publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.kafka) return;
    try {
      await Promise.race([
        this.kafka.producer.send({
          topic,
          messages: [{ key: payload['reportId'] as string, value: JSON.stringify(payload) }],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), KAFKA_TIMEOUT_MS)),
      ]);
    } catch (err) {
      console.warn(`[ReportGenerator] Kafka publish to ${topic} failed:`, err);
    }
  }
}
