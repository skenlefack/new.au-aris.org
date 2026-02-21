import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Event Types ──

export type NotificationEventType =
  | 'WORKFLOW_APPROVED'
  | 'WORKFLOW_REJECTED'
  | 'QUALITY_FAILED'
  | 'CORRECTION_OVERDUE'
  | 'OUTBREAK_ALERT'
  | 'WELCOME'
  | 'PASSWORD_RESET'
  | 'CAMPAIGN_ASSIGNED'
  | 'DAILY_DIGEST';

// ── Template Filename Mapping ──

const TEMPLATE_FILES: Record<NotificationEventType, string> = {
  WORKFLOW_APPROVED: 'workflow-approved.hbs',
  WORKFLOW_REJECTED: 'workflow-rejected.hbs',
  QUALITY_FAILED: 'quality-failed.hbs',
  CORRECTION_OVERDUE: 'correction-overdue.hbs',
  OUTBREAK_ALERT: 'outbreak-alert.hbs',
  WELCOME: 'welcome.hbs',
  PASSWORD_RESET: 'password-reset.hbs',
  CAMPAIGN_ASSIGNED: 'campaign-assigned.hbs',
  DAILY_DIGEST: 'daily-digest.hbs',
};

// ── Email Subject Templates ──

const EMAIL_SUBJECTS: Record<NotificationEventType, string> = {
  WORKFLOW_APPROVED: '[ARIS] {{entityType}} Approved — Level {{level}}',
  WORKFLOW_REJECTED: '[ARIS] {{entityType}} Rejected — Level {{level}}',
  QUALITY_FAILED: '[ARIS] Quality Check Failed — {{entityType}}',
  CORRECTION_OVERDUE: '[ARIS] ESCALATION — Overdue Correction ({{daysOverdue}} days)',
  OUTBREAK_ALERT: '[ARIS] ALERT — {{diseaseName}} Outbreak',
  WELCOME: '[ARIS] Welcome to ARIS',
  PASSWORD_RESET: '[ARIS] Password Reset Request',
  CAMPAIGN_ASSIGNED: '[ARIS] Campaign Assigned — {{campaignName}}',
  DAILY_DIGEST: '[ARIS] Daily Summary — {{date}}',
};

// ── SMS Templates (< 160 chars) ──

export const SMS_TEMPLATES: Record<NotificationEventType, string> = {
  WORKFLOW_APPROVED:
    'ARIS: Your {{entityType}} ({{entityId}}) approved at Level {{level}}. Login to view details.',
  WORKFLOW_REJECTED:
    'ARIS: Your {{entityType}} ({{entityId}}) rejected at Level {{level}}. Reason: {{reason}}',
  QUALITY_FAILED:
    'ARIS: Record {{entityType}} ({{recordId}}) failed {{violationCount}} quality gate(s). Please correct.',
  CORRECTION_OVERDUE:
    'ARIS ESCALATION: Record {{entityType}} ({{recordId}}) correction {{daysOverdue}} days overdue. Act now.',
  OUTBREAK_ALERT:
    'ARIS ALERT: {{diseaseName}} outbreak in {{countryName}}. Severity: {{severity}}. Check ARIS immediately.',
  WELCOME:
    'Welcome to ARIS, {{userName}}! Your account is ready. Login at {{loginUrl}}',
  PASSWORD_RESET:
    'ARIS: Your password reset link is ready. It expires in {{expiresIn}}. Ignore if not requested.',
  CAMPAIGN_ASSIGNED:
    'ARIS: You are assigned to campaign "{{campaignName}}". Period: {{startDate}} - {{endDate}}. Check ARIS.',
  DAILY_DIGEST:
    'ARIS Daily: {{pendingApprovals}} pending, {{overdueCorrections}} overdue, {{unreadCount}} unread. Login to review.',
};

// ── Country Codes for Phone Formatting ──

export const COUNTRY_CODES: Record<string, string> = {
  KE: '+254',
  NG: '+234',
  ET: '+251',
  GH: '+233',
  TZ: '+255',
  UG: '+256',
  ZA: '+27',
  EG: '+20',
  SN: '+221',
  CM: '+237',
};

const SMS_MAX_LENGTH = 160;

@Injectable()
export class TemplateEngine {
  private readonly logger = new Logger(TemplateEngine.name);
  private readonly templatesDir: string;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private layoutTemplate: Handlebars.TemplateDelegate | null = null;

  constructor() {
    this.templatesDir =
      process.env['TEMPLATES_DIR'] ?? join(__dirname, '..', 'templates');
    this.registerHelpers();
  }

  // ── Public Methods ──

  /**
   * Renders a full email: subject line + HTML body wrapped in the base layout.
   */
  renderEmail(
    eventType: NotificationEventType,
    data: Record<string, unknown>,
  ): { subject: string; html: string } {
    const subject = this.renderSubject(eventType, data);

    const templateFile = TEMPLATE_FILES[eventType];
    const templatePath = join(this.templatesDir, 'email', templateFile);
    const bodyTemplate = this.getTemplate(templatePath);

    if (!bodyTemplate) {
      this.logger.warn(
        `Email template not found for ${eventType} at ${templatePath}. Using fallback.`,
      );
      const fallbackHtml = this.wrapInLayout(
        `<p>Notification: ${eventType}</p><p>${JSON.stringify(data)}</p>`,
        data,
      );
      return { subject, html: fallbackHtml };
    }

    const bodyHtml = bodyTemplate(data);
    const html = this.wrapInLayout(bodyHtml, data);

    return { subject, html };
  }

  /**
   * Renders an SMS message, truncated to 160 characters.
   */
  renderSms(
    eventType: NotificationEventType,
    data: Record<string, unknown>,
  ): string {
    const smsTemplate = SMS_TEMPLATES[eventType];
    if (!smsTemplate) {
      this.logger.warn(`No SMS template defined for ${eventType}. Using fallback.`);
      return `ARIS Notification: ${eventType}`.substring(0, SMS_MAX_LENGTH);
    }

    const compiled = Handlebars.compile(smsTemplate);
    const rendered = compiled(data);

    return rendered.length > SMS_MAX_LENGTH
      ? rendered.substring(0, SMS_MAX_LENGTH - 3) + '...'
      : rendered;
  }

  /**
   * Renders only the email subject line.
   */
  renderSubject(
    eventType: NotificationEventType,
    data: Record<string, unknown>,
  ): string {
    const subjectTemplate = EMAIL_SUBJECTS[eventType];
    if (!subjectTemplate) {
      return `[ARIS] Notification — ${eventType}`;
    }

    const compiled = Handlebars.compile(subjectTemplate);
    return compiled(data);
  }

  /**
   * Formats a phone number by prepending the country code prefix if missing.
   */
  formatPhoneNumber(phone: string, countryCode: string): string {
    const trimmed = phone.trim();

    // Already has a '+' prefix — assume it is fully qualified
    if (trimmed.startsWith('+')) {
      return trimmed;
    }

    const prefix = COUNTRY_CODES[countryCode.toUpperCase()];
    if (!prefix) {
      this.logger.warn(
        `Unknown country code "${countryCode}". Returning phone as-is.`,
      );
      return trimmed;
    }

    // Strip leading '0' common in local formats (e.g., 0712... → 712...)
    const localNumber = trimmed.startsWith('0') ? trimmed.substring(1) : trimmed;
    return `${prefix}${localNumber}`;
  }

  // ── Private Methods ──

  /**
   * Retrieves a compiled Handlebars template from cache or disk.
   * Returns null if the file does not exist.
   */
  private getTemplate(filePath: string): Handlebars.TemplateDelegate | null {
    const cached = this.templateCache.get(filePath);
    if (cached) {
      return cached;
    }

    if (!existsSync(filePath)) {
      this.logger.warn(`Template file not found: ${filePath}`);
      return null;
    }

    try {
      const source = readFileSync(filePath, 'utf-8');
      const compiled = Handlebars.compile(source);
      this.templateCache.set(filePath, compiled);
      return compiled;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to compile template ${filePath}: ${message}`);
      return null;
    }
  }

  /**
   * Loads and caches the base HTML layout.
   */
  private loadLayout(): Handlebars.TemplateDelegate | null {
    if (this.layoutTemplate) {
      return this.layoutTemplate;
    }

    const layoutPath = join(this.templatesDir, 'layouts', 'base.hbs');
    const template = this.getTemplate(layoutPath);

    if (template) {
      this.layoutTemplate = template;
    }

    return template;
  }

  /**
   * Wraps body HTML content inside the base layout.
   */
  private wrapInLayout(
    content: string,
    data: Record<string, unknown>,
  ): string {
    const layout = this.loadLayout();

    if (!layout) {
      this.logger.warn('Base layout not found. Returning raw content.');
      return content;
    }

    return layout({
      ...data,
      content,
      year: new Date().getFullYear(),
    });
  }

  /**
   * Registers custom Handlebars helpers used across all templates.
   */
  private registerHelpers(): void {
    // Equality check: {{#if (eq status "confirmed")}}
    Handlebars.registerHelper(
      'eq',
      function (a: unknown, b: unknown): boolean {
        return a === b;
      },
    );

    // Format ISO date to locale string: {{formatDate isoDate}}
    Handlebars.registerHelper(
      'formatDate',
      function (isoDate: unknown): string {
        if (!isoDate || typeof isoDate !== 'string') {
          return String(isoDate ?? '');
        }
        try {
          const date = new Date(isoDate);
          return date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch {
          return String(isoDate);
        }
      },
    );

    // Truncate string: {{truncate description 100}}
    Handlebars.registerHelper(
      'truncate',
      function (str: unknown, length: unknown): string {
        const text = String(str ?? '');
        const maxLen = typeof length === 'number' ? length : 100;
        if (text.length <= maxLen) {
          return text;
        }
        return text.substring(0, maxLen - 3) + '...';
      },
    );

    // Pluralize: {{pluralize count "item" "items"}}
    Handlebars.registerHelper(
      'pluralize',
      function (
        count: unknown,
        singular: unknown,
        plural: unknown,
      ): string {
        const n = typeof count === 'number' ? count : parseInt(String(count), 10);
        if (isNaN(n) || n === 1) {
          return String(singular);
        }
        return String(plural ?? singular);
      },
    );

    // Uppercase: {{uppercase status}}
    Handlebars.registerHelper(
      'uppercase',
      function (str: unknown): string {
        return String(str ?? '').toUpperCase();
      },
    );
  }
}
