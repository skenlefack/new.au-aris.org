import * as Handlebars from 'handlebars';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type NotificationEventType =
  // Alerts & Events (cross-domain)
  | 'ALERT_NEW'
  | 'ALERT_CONFIRMED'
  | 'ALERT_REGIONAL'
  // Workflow
  | 'WORKFLOW_APPROVED'
  | 'WORKFLOW_REJECTED'
  | 'CAMPAIGN_ASSIGNED'
  // Data Quality
  | 'QUALITY_FAILED'
  | 'CORRECTION_OVERDUE'
  // System
  | 'WELCOME'
  | 'PASSWORD_RESET'
  | 'DAILY_DIGEST'
  | 'NEW_DEVICE_LOGIN';

const TEMPLATE_FILES: Record<NotificationEventType, string> = {
  ALERT_NEW: 'domain-alert.hbs',
  ALERT_CONFIRMED: 'domain-alert.hbs',
  ALERT_REGIONAL: 'domain-alert.hbs',
  WORKFLOW_APPROVED: 'workflow-approved.hbs',
  WORKFLOW_REJECTED: 'workflow-rejected.hbs',
  CAMPAIGN_ASSIGNED: 'campaign-assigned.hbs',
  QUALITY_FAILED: 'quality-failed.hbs',
  CORRECTION_OVERDUE: 'correction-overdue.hbs',
  WELCOME: 'welcome.hbs',
  PASSWORD_RESET: 'password-reset.hbs',
  DAILY_DIGEST: 'daily-digest.hbs',
  NEW_DEVICE_LOGIN: 'new-device-login.hbs',
};

const EMAIL_SUBJECTS: Record<NotificationEventType, string> = {
  ALERT_NEW: '[ARIS] New Event Reported — {{domain}}: {{title}}',
  ALERT_CONFIRMED: '[ARIS] Event Confirmed — {{domain}}: {{title}}',
  ALERT_REGIONAL: '[ARIS] REGIONAL ALERT — {{domain}}: {{title}}',
  WORKFLOW_APPROVED: '[ARIS] {{entityType}} Approved — Level {{level}}',
  WORKFLOW_REJECTED: '[ARIS] {{entityType}} Rejected — Level {{level}}',
  CAMPAIGN_ASSIGNED: '[ARIS] Campaign Assigned — {{campaignName}}',
  QUALITY_FAILED: '[ARIS] Quality Check Failed — {{entityType}}',
  CORRECTION_OVERDUE: '[ARIS] ESCALATION — Overdue Correction ({{daysOverdue}} days)',
  WELCOME: '[ARIS] Welcome to ARIS',
  PASSWORD_RESET: '[ARIS] Password Reset Request',
  DAILY_DIGEST: '[ARIS] Daily Summary — {{date}}',
  NEW_DEVICE_LOGIN: '[ARIS] \u26a0\ufe0f New login on your account — {{deviceName}}',
};

export const SMS_TEMPLATES: Record<NotificationEventType, string> = {
  ALERT_NEW: 'ARIS: New {{domain}} event — {{title}} ({{countryName}}). Login to view details.',
  ALERT_CONFIRMED: 'ARIS: {{domain}} event confirmed — {{title}} ({{countryName}}). Severity: {{severity}}.',
  ALERT_REGIONAL: 'ARIS REGIONAL ALERT: {{domain}} — {{title}}. Countries: {{countries}}. Check ARIS immediately.',
  WORKFLOW_APPROVED: 'ARIS: Your {{entityType}} ({{entityId}}) approved at Level {{level}}. Login to view details.',
  WORKFLOW_REJECTED: 'ARIS: Your {{entityType}} ({{entityId}}) rejected at Level {{level}}. Reason: {{reason}}',
  CAMPAIGN_ASSIGNED: 'ARIS: You are assigned to campaign "{{campaignName}}". Period: {{startDate}} - {{endDate}}. Check ARIS.',
  QUALITY_FAILED: 'ARIS: Record {{entityType}} ({{recordId}}) failed {{violationCount}} quality gate(s). Please correct.',
  CORRECTION_OVERDUE: 'ARIS ESCALATION: Record {{entityType}} ({{recordId}}) correction {{daysOverdue}} days overdue. Act now.',
  WELCOME: 'Welcome to ARIS, {{userName}}! Your account is ready. Login at {{loginUrl}}',
  PASSWORD_RESET: 'ARIS: Your password reset link is ready. It expires in {{expiresIn}}. Ignore if not requested.',
  DAILY_DIGEST: 'ARIS Daily: {{pendingApprovals}} pending, {{overdueCorrections}} overdue, {{unreadCount}} unread. Login to review.',
  NEW_DEVICE_LOGIN: 'ARIS SECURITY: New login detected on {{deviceName}} from IP {{ipAddress}}. If this was not you, change your password immediately.',
};

export const COUNTRY_CODES: Record<string, string> = {
  KE: '+254', NG: '+234', ET: '+251', GH: '+233', TZ: '+255',
  UG: '+256', ZA: '+27', EG: '+20', SN: '+221', CM: '+237',
};

const SMS_MAX_LENGTH = 160;

export class TemplateEngine {
  private readonly templatesDir: string;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private layoutTemplate: Handlebars.TemplateDelegate | null = null;

  constructor() {
    this.templatesDir = process.env['TEMPLATES_DIR'] ?? join(__dirname, '..', 'templates');
    this.registerHelpers();
  }

  renderEmail(eventType: NotificationEventType, data: Record<string, unknown>): { subject: string; html: string } {
    const subject = this.renderSubject(eventType, data);
    const templateFile = TEMPLATE_FILES[eventType];
    const templatePath = join(this.templatesDir, 'email', templateFile);
    const bodyTemplate = this.getTemplate(templatePath);

    if (!bodyTemplate) {
      const fallbackHtml = this.wrapInLayout(`<p>Notification: ${eventType}</p><p>${JSON.stringify(data)}</p>`, data);
      return { subject, html: fallbackHtml };
    }

    const bodyHtml = bodyTemplate(data);
    const html = this.wrapInLayout(bodyHtml, data);
    return { subject, html };
  }

  renderSms(eventType: NotificationEventType, data: Record<string, unknown>): string {
    const smsTemplate = SMS_TEMPLATES[eventType];
    if (!smsTemplate) {
      return `ARIS Notification: ${eventType}`.substring(0, SMS_MAX_LENGTH);
    }
    const compiled = Handlebars.compile(smsTemplate);
    const rendered = compiled(data);
    return rendered.length > SMS_MAX_LENGTH ? rendered.substring(0, SMS_MAX_LENGTH - 3) + '...' : rendered;
  }

  renderSubject(eventType: NotificationEventType, data: Record<string, unknown>): string {
    const subjectTemplate = EMAIL_SUBJECTS[eventType];
    if (!subjectTemplate) return `[ARIS] Notification — ${eventType}`;
    return Handlebars.compile(subjectTemplate)(data);
  }

  formatPhoneNumber(phone: string, countryCode: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) return trimmed;
    const prefix = COUNTRY_CODES[countryCode.toUpperCase()];
    if (!prefix) return trimmed;
    const localNumber = trimmed.startsWith('0') ? trimmed.substring(1) : trimmed;
    return `${prefix}${localNumber}`;
  }

  private getTemplate(filePath: string): Handlebars.TemplateDelegate | null {
    const cached = this.templateCache.get(filePath);
    if (cached) return cached;
    if (!existsSync(filePath)) return null;
    try {
      const source = readFileSync(filePath, 'utf-8');
      const compiled = Handlebars.compile(source);
      this.templateCache.set(filePath, compiled);
      return compiled;
    } catch {
      return null;
    }
  }

  private loadLayout(): Handlebars.TemplateDelegate | null {
    if (this.layoutTemplate) return this.layoutTemplate;
    const layoutPath = join(this.templatesDir, 'layouts', 'base.hbs');
    const template = this.getTemplate(layoutPath);
    if (template) this.layoutTemplate = template;
    return template;
  }

  private wrapInLayout(content: string, data: Record<string, unknown>): string {
    const layout = this.loadLayout();
    if (!layout) return content;
    return layout({ ...data, content, year: new Date().getFullYear() });
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('eq', function (a: unknown, b: unknown): boolean { return a === b; });
    Handlebars.registerHelper('formatDate', function (isoDate: unknown): string {
      if (!isoDate || typeof isoDate !== 'string') return String(isoDate ?? '');
      try { return new Date(isoDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); }
      catch { return String(isoDate); }
    });
    Handlebars.registerHelper('truncate', function (str: unknown, length: unknown): string {
      const text = String(str ?? '');
      const maxLen = typeof length === 'number' ? length : 100;
      return text.length <= maxLen ? text : text.substring(0, maxLen - 3) + '...';
    });
    Handlebars.registerHelper('pluralize', function (count: unknown, singular: unknown, plural: unknown): string {
      const n = typeof count === 'number' ? count : parseInt(String(count), 10);
      return isNaN(n) || n === 1 ? String(singular) : String(plural ?? singular);
    });
    Handlebars.registerHelper('uppercase', function (str: unknown): string { return String(str ?? '').toUpperCase(); });
  }
}
