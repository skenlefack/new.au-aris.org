import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'path';

// Set TEMPLATES_DIR before importing the engine so it resolves HBS files from src/
const TEMPLATES_DIR = join(__dirname, '..', '..');
process.env['TEMPLATES_DIR'] = join(TEMPLATES_DIR, 'templates');

import {
  TemplateEngine,
  SMS_TEMPLATES,
  COUNTRY_CODES,
} from '../template-engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  // ── renderEmail ──

  describe('renderEmail', () => {
    it('should render WORKFLOW_APPROVED email with subject and HTML body', () => {
      const result = engine.renderEmail('WORKFLOW_APPROVED', {
        entityType: 'Outbreak Report',
        entityId: 'REC-001',
        recordId: 'REC-001',
        level: 2,
        dashboardUrl: 'https://aris.africa/dashboard',
      });

      expect(result.subject).toContain('[ARIS]');
      expect(result.subject).toContain('Outbreak Report');
      expect(result.subject).toContain('Level 2');
      expect(result.html).toContain('AU-IBAR');
      expect(result.html).toContain('REC-001');
    });

    it('should render WORKFLOW_REJECTED email with reason', () => {
      const result = engine.renderEmail('WORKFLOW_REJECTED', {
        entityType: 'Census Data',
        entityId: 'CD-042',
        recordId: 'CD-042',
        level: 1,
        reason: 'Missing geospatial coordinates',
        correctionUrl: 'https://aris.africa/corrections/CD-042',
      });

      expect(result.subject).toContain('Rejected');
      expect(result.html).toContain('Missing geospatial coordinates');
    });

    it('should render QUALITY_FAILED email with violations list', () => {
      const result = engine.renderEmail('QUALITY_FAILED', {
        entityType: 'Vaccination Record',
        recordId: 'VAX-100',
        violations: ['Missing species code', 'Invalid admin code'],
        violationCount: 2,
        correctionUrl: 'https://aris.africa/corrections/VAX-100',
      });

      expect(result.subject).toContain('Quality');
      expect(result.html).toContain('Missing species code');
      expect(result.html).toContain('Invalid admin code');
    });

    it('should render CORRECTION_OVERDUE email with escalation details', () => {
      const result = engine.renderEmail('CORRECTION_OVERDUE', {
        entityType: 'Trade Flow',
        recordId: 'TF-999',
        daysOverdue: 14,
        deadline: '2026-01-15T00:00:00Z',
        correctionUrl: 'https://aris.africa/corrections/TF-999',
      });

      expect(result.subject).toContain('ESCALATION');
      expect(result.subject).toContain('14 days');
      expect(result.html).toContain('TF-999');
    });

    it('should render OUTBREAK_ALERT email with disease name', () => {
      const result = engine.renderEmail('OUTBREAK_ALERT', {
        diseaseName: 'Rift Valley Fever',
        countryName: 'Kenya',
        severity: 'HIGH',
        mapUrl: 'https://aris.africa/geo/alerts/KE-RVF',
      });

      expect(result.subject).toContain('Rift Valley Fever');
      expect(result.html).toContain('Kenya');
    });

    it('should render WELCOME email', () => {
      const result = engine.renderEmail('WELCOME', {
        userName: 'Dr. Amina Osei',
        loginUrl: 'https://aris.africa/login',
        role: 'DATA_STEWARD',
      });

      expect(result.subject).toContain('Welcome');
      expect(result.html).toContain('Dr. Amina Osei');
    });

    it('should render PASSWORD_RESET email', () => {
      const result = engine.renderEmail('PASSWORD_RESET', {
        userName: 'John',
        resetUrl: 'https://aris.africa/reset?token=abc123',
        expiresIn: '1 hour',
      });

      expect(result.subject).toContain('Password Reset');
      expect(result.html).toContain('abc123');
    });

    it('should render CAMPAIGN_ASSIGNED email', () => {
      const result = engine.renderEmail('CAMPAIGN_ASSIGNED', {
        campaignName: 'Q1 2026 Livestock Census',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        dashboardUrl: 'https://aris.africa/campaigns/q1',
      });

      expect(result.subject).toContain('Q1 2026 Livestock Census');
      expect(result.html).toContain('Q1 2026 Livestock Census');
    });

    it('should render DAILY_DIGEST email', () => {
      const result = engine.renderEmail('DAILY_DIGEST', {
        userName: 'Data Steward',
        pendingApprovals: 5,
        overdueCorrections: 2,
        unreadCount: 12,
        date: '21 February 2026',
        dashboardUrl: 'https://aris.africa/dashboard',
        items: [
          { entityType: 'Outbreak', entityId: 'OB-1', level: '2', domain: 'health', createdAt: '15/02/2026' },
          { entityType: 'Census', entityId: 'CN-2', level: '1', domain: 'livestock', createdAt: '18/02/2026' },
        ],
      });

      expect(result.subject).toContain('Daily Summary');
      expect(result.html).toContain('5');
      expect(result.html).toContain('2');
    });

    it('should use fallback when template file is missing', () => {
      // Temporarily point to non-existent dir
      const saved = process.env['TEMPLATES_DIR'];
      process.env['TEMPLATES_DIR'] = '/nonexistent/path';
      const freshEngine = new TemplateEngine();

      const result = freshEngine.renderEmail('WORKFLOW_APPROVED', {
        entityType: 'Test',
        level: 1,
      });

      expect(result.subject).toContain('[ARIS]');
      expect(result.html).toContain('WORKFLOW_APPROVED');

      process.env['TEMPLATES_DIR'] = saved;
    });
  });

  // ── renderSms ──

  describe('renderSms', () => {
    it('should render WORKFLOW_APPROVED SMS under 160 chars', () => {
      const result = engine.renderSms('WORKFLOW_APPROVED', {
        entityType: 'Outbreak',
        entityId: 'OB-001',
        level: 2,
      });

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result).toContain('ARIS');
      expect(result).toContain('Outbreak');
      expect(result).toContain('Level 2');
    });

    it('should render OUTBREAK_ALERT SMS under 160 chars', () => {
      const result = engine.renderSms('OUTBREAK_ALERT', {
        diseaseName: 'African Swine Fever',
        countryName: 'Nigeria',
        severity: 'CRITICAL',
      });

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result).toContain('African Swine Fever');
      expect(result).toContain('Nigeria');
    });

    it('should truncate SMS at 160 chars with ellipsis', () => {
      const result = engine.renderSms('QUALITY_FAILED', {
        entityType: 'Very Long Entity Type Name That Exceeds Normal Lengths',
        recordId: 'RECORD-WITH-EXTREMELY-LONG-ID-THAT-PUSHES-TOTAL-OVER',
        violationCount: 99,
      });

      expect(result.length).toBeLessThanOrEqual(160);
      if (result.length === 160) {
        expect(result).toMatch(/\.\.\.$/);
      }
    });

    it('should render DAILY_DIGEST SMS with counts', () => {
      const result = engine.renderSms('DAILY_DIGEST', {
        pendingApprovals: 3,
        overdueCorrections: 1,
        unreadCount: 8,
      });

      expect(result).toContain('3 pending');
      expect(result).toContain('1 overdue');
      expect(result).toContain('8 unread');
    });

    it('should have templates defined for all event types', () => {
      const expectedTypes = [
        'WORKFLOW_APPROVED',
        'WORKFLOW_REJECTED',
        'QUALITY_FAILED',
        'CORRECTION_OVERDUE',
        'OUTBREAK_ALERT',
        'WELCOME',
        'PASSWORD_RESET',
        'CAMPAIGN_ASSIGNED',
        'DAILY_DIGEST',
      ];

      for (const eventType of expectedTypes) {
        expect(SMS_TEMPLATES[eventType as keyof typeof SMS_TEMPLATES]).toBeDefined();
      }
    });
  });

  // ── renderSubject ──

  describe('renderSubject', () => {
    it('should interpolate variables into subject template', () => {
      const subject = engine.renderSubject('WORKFLOW_APPROVED', {
        entityType: 'Census',
        level: 3,
      });

      expect(subject).toBe('[ARIS] Census Approved — Level 3');
    });

    it('should return fallback subject for unknown event type', () => {
      const subject = engine.renderSubject(
        'UNKNOWN_TYPE' as Parameters<TemplateEngine['renderSubject']>[0],
        {},
      );

      expect(subject).toContain('[ARIS]');
      expect(subject).toContain('UNKNOWN_TYPE');
    });
  });

  // ── formatPhoneNumber ──

  describe('formatPhoneNumber', () => {
    it('should prepend Kenya country code (+254) and strip leading 0', () => {
      expect(engine.formatPhoneNumber('0712345678', 'KE')).toBe('+254712345678');
    });

    it('should prepend Nigeria country code (+234)', () => {
      expect(engine.formatPhoneNumber('8012345678', 'NG')).toBe('+2348012345678');
    });

    it('should handle lowercase country codes', () => {
      expect(engine.formatPhoneNumber('0712345678', 'ke')).toBe('+254712345678');
    });

    it('should return number as-is when already prefixed with +', () => {
      expect(engine.formatPhoneNumber('+254712345678', 'KE')).toBe('+254712345678');
    });

    it('should return number as-is for unknown country code', () => {
      expect(engine.formatPhoneNumber('12345', 'XX')).toBe('12345');
    });

    it('should trim whitespace', () => {
      expect(engine.formatPhoneNumber('  0712345678  ', 'KE')).toBe('+254712345678');
    });

    it('should have country codes for key AU member states', () => {
      const expectedCodes = ['KE', 'NG', 'ET', 'GH', 'TZ', 'UG', 'ZA', 'EG', 'SN', 'CM'];
      for (const code of expectedCodes) {
        expect(COUNTRY_CODES[code]).toBeDefined();
        expect(COUNTRY_CODES[code]).toMatch(/^\+\d+$/);
      }
    });
  });

  // ── Handlebars Helpers ──

  describe('Handlebars helpers', () => {
    it('should use formatDate helper in email templates', () => {
      const result = engine.renderEmail('WORKFLOW_APPROVED', {
        entityType: 'Report',
        entityId: 'R-1',
        recordId: 'R-1',
        level: 1,
        approvedAt: '2026-02-20T14:30:00Z',
      });

      // The template should render without errors (helpers registered)
      expect(result.html).toBeDefined();
      expect(result.html.length).toBeGreaterThan(0);
    });

    it('should use eq helper without errors', () => {
      const result = engine.renderEmail('DAILY_DIGEST', {
        pendingApprovals: 0,
        overdueCorrections: 0,
        unreadCount: 0,
        date: '21 February 2026',
        items: [],
      });

      expect(result.html).toBeDefined();
    });
  });
});
