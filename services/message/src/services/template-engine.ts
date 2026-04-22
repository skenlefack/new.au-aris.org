import * as Handlebars from 'handlebars';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { translate, textDirection, EMAIL_SUBJECTS_I18N, DEFAULT_LOCALE } from './translations';
import type { Locale } from './translations';

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
    const locale = (data['locale'] as Locale) || DEFAULT_LOCALE;
    const subject = this.renderSubject(eventType, data);
    const templateFile = TEMPLATE_FILES[eventType];
    const templatePath = join(this.templatesDir, 'email', templateFile);
    const bodyTemplate = this.getTemplate(templatePath);

    // Inject locale + direction into data for templates
    const enrichedData = { ...data, locale, dir: textDirection(locale) };

    if (!bodyTemplate) {
      console.error(`[TemplateEngine] Template not found: ${templatePath} — rendering fallback`);
      const fallbackHtml = this.renderFallback(eventType, enrichedData);
      return { subject, html: this.wrapInLayout(fallbackHtml, enrichedData) };
    }

    const bodyHtml = bodyTemplate(enrichedData);
    const html = this.wrapInLayout(bodyHtml, enrichedData);
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
    const locale = (data['locale'] as Locale) || DEFAULT_LOCALE;
    const localeSubjects = EMAIL_SUBJECTS_I18N[eventType];
    if (!localeSubjects) return `[ARIS] Notification — ${eventType}`;
    const template = localeSubjects[locale] ?? localeSubjects['en'] ?? `[ARIS] Notification — ${eventType}`;
    return Handlebars.compile(template)(data);
  }

  formatPhoneNumber(phone: string, countryCode: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) return trimmed;
    const prefix = COUNTRY_CODES[countryCode.toUpperCase()];
    if (!prefix) return trimmed;
    const localNumber = trimmed.startsWith('0') ? trimmed.substring(1) : trimmed;
    return `${prefix}${localNumber}`;
  }

  /**
   * Structured fallback when the .hbs file is missing.
   * Renders a clean key/value table instead of raw JSON.
   */
  private renderFallback(eventType: string, data: Record<string, unknown>): string {
    const locale = (data['locale'] as string) || 'en';
    const LABEL_MAP: Record<string, Record<string, string>> = {
      userName:          { en: 'Name', fr: 'Nom', pt: 'Nome', ar: 'الاسم' },
      firstName:         { en: 'First Name', fr: 'Prénom', pt: 'Nome', ar: 'الاسم الأول' },
      lastName:          { en: 'Last Name', fr: 'Nom de famille', pt: 'Apelido', ar: 'اسم العائلة' },
      email:             { en: 'Email', fr: 'E-mail', pt: 'E-mail', ar: 'البريد الإلكتروني' },
      roleName:          { en: 'Role', fr: 'Rôle', pt: 'Função', ar: 'الدور' },
      tenantName:        { en: 'Organization', fr: 'Organisation', pt: 'Organização', ar: 'المنظمة' },
      temporaryPassword: { en: 'Temporary Password', fr: 'Mot de passe temporaire', pt: 'Palavra-passe temporária', ar: 'كلمة المرور المؤقتة' },
      loginUrl:          { en: 'Login URL', fr: 'URL de connexion', pt: 'URL de acesso', ar: 'رابط تسجيل الدخول' },
      resetUrl:          { en: 'Reset Link', fr: 'Lien de réinitialisation', pt: 'Link de redefinição', ar: 'رابط إعادة التعيين' },
      entityType:        { en: 'Entity Type', fr: 'Type d\'entité', pt: 'Tipo de entidade', ar: 'نوع الكيان' },
      recordId:          { en: 'Record ID', fr: 'ID de l\'enregistrement', pt: 'ID do registo', ar: 'معرّف السجل' },
      deviceName:        { en: 'Device', fr: 'Appareil', pt: 'Dispositivo', ar: 'الجهاز' },
      ipAddress:         { en: 'IP Address', fr: 'Adresse IP', pt: 'Endereço IP', ar: 'عنوان IP' },
    };

    // Skip internal / non-display keys
    const SKIP_KEYS = new Set(['locale', 'dir', 'year', 'content']);
    const rows: string[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (SKIP_KEYS.has(key) || val === undefined || val === null || val === '') continue;
      if (typeof val === 'object') continue;
      const label = LABEL_MAP[key]?.[locale] ?? LABEL_MAP[key]?.['en'] ?? key;
      const isPassword = key === 'temporaryPassword';
      const cellStyle = isPassword
        ? 'font-family:monospace;font-weight:700;background:#fff;border:1px solid #cbd5e1;border-radius:4px;padding:4px 8px;'
        : '';
      rows.push(`
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f0f0f0;width:140px;vertical-align:top;">${label}</td>
          <td style="padding:8px 12px;font-size:14px;color:#0f172a;border-bottom:1px solid #f0f0f0;"><span style="${cellStyle}">${Handlebars.Utils.escapeExpression(String(val))}</span></td>
        </tr>`);
    }

    return `
      <h2 style="margin:0 0 16px;font-size:20px;color:#003366;">${eventType}</h2>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="border:1px solid #dce3ec;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        ${rows.join('')}
      </table>`;
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

    // {{t "key"}} — resolves the label for the current locale in the template context
    Handlebars.registerHelper('t', function (this: Record<string, unknown>, key: string): string {
      const locale = (this?.['locale'] as string) || 'en';
      return translate(key, locale);
    });

    Handlebars.registerHelper('formatDate', function (isoDate: unknown, options?: Handlebars.HelperOptions): string {
      if (!isoDate || typeof isoDate !== 'string') return String(isoDate ?? '');
      const locale = (options?.data?.root?.locale as string) || 'en';
      const dateLocaleMap: Record<string, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT', ar: 'ar-EG' };
      try { return new Date(isoDate).toLocaleDateString(dateLocaleMap[locale] ?? 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); }
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
