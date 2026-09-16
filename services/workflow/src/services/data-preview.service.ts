import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export class DataPreviewService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get data schema preview for a workflow definition.
   * Finds campaigns using this workflow's tenant, gets their form template,
   * and extracts field definitions from the template schema.
   */
  async getSchemaPreview(definitionId: string, user: AuthenticatedUser) {
    try {
      const def = await this.prisma.$queryRawUnsafe(`
        SELECT country_code, tenant_id FROM workflow.workflow_definitions WHERE id = $1::uuid
      `, definitionId) as any[];

      if (!def.length) return { data: { fields: [], templateCount: 0 } };

      // Find form templates used in campaigns for this tenant
      const templates = await this.prisma.$queryRawUnsafe(`
        SELECT DISTINCT ft.id, ft.name, ft.schema
        FROM form_builder.form_templates ft
        JOIN public.collection_campaigns cc ON cc.form_template_id = ft.id
        WHERE cc.tenant_id = $1::uuid
        LIMIT 5
      `, def[0].tenant_id) as any[];

      // Extract field definitions from template schemas
      const allFields: Array<{ key: string; label: string; type: string; templateName: string }> = [];
      for (const tmpl of templates) {
        const schema = tmpl.schema;
        if (schema?.sections) {
          for (const section of schema.sections) {
            for (const field of section.fields ?? []) {
              allFields.push({
                key: field.key ?? field.name,
                label: field.label ?? field.name ?? field.key,
                type: field.type ?? 'text',
                templateName: tmpl.name,
              });
            }
          }
        }
      }

      return { data: { fields: allFields, templateCount: templates.length } };
    } catch (err: any) {
      // Graceful fallback if tables don't exist
      return { data: { fields: [], templateCount: 0 } };
    }
  }

  /**
   * Get actual data flow for a workflow instance — what data passed through each step.
   * Returns data grouped by step with timestamps.
   */
  async getInstanceDataFlow(instanceId: string, user: AuthenticatedUser) {
    try {
      const rows = await this.prisma.$queryRawUnsafe(`
        SELECT
          ci.id as instance_id,
          ci.status as instance_status,
          s.data as submission_data,
          s.submitted_at,
          ch.id as history_id,
          ch.action,
          ch.from_step,
          ch.to_step,
          ch.performed_by_name,
          ch.performed_at,
          ch.data_snapshot,
          ch.comment
        FROM public.collecte_instances ci
        JOIN public.submissions s ON s.id = ci.submission_id
        LEFT JOIN public.collecte_history ch ON ch.instance_id = ci.id
        WHERE ci.id = $1::uuid
        ORDER BY ch.performed_at ASC NULLS LAST
      `, instanceId) as any[];

      if (!rows.length) {
        return { data: { instanceId, steps: [], submissionData: null } };
      }

      const submissionData = rows[0]?.submission_data;
      const steps = rows
        .filter((r: any) => r.history_id)
        .map((r: any) => ({
          action: r.action,
          fromStep: r.from_step,
          toStep: r.to_step,
          performedBy: r.performed_by_name,
          performedAt: r.performed_at,
          dataSnapshot: r.data_snapshot,
          comment: r.comment,
        }));

      return { data: { instanceId, submissionData, steps } };
    } catch (err: any) {
      // Graceful fallback if tables don't exist
      return { data: { instanceId, steps: [], submissionData: null } };
    }
  }

  /**
   * Get recent submissions that went through a specific workflow definition.
   * Useful for seeing "what kind of data flows through this workflow".
   */
  async getRecentSubmissions(definitionId: string, user: AuthenticatedUser, limit = 5) {
    try {
      const rows = await this.prisma.$queryRawUnsafe(`
        SELECT
          s.id, s.data, s.submitted_at, s.status,
          ci.current_step_order, ci.status as workflow_status
        FROM workflow.workflow_definitions wd
        JOIN public.collecte_instances ci ON ci.workflow_id = wd.id
        JOIN public.submissions s ON s.id = ci.submission_id
        WHERE wd.id = $1::uuid
        ORDER BY s.submitted_at DESC
        LIMIT $2
      `, definitionId, limit) as any[];

      return { data: rows };
    } catch (err: any) {
      // Graceful fallback if tables don't exist
      return { data: [] };
    }
  }
}
