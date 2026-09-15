-- Migration: Add workflow templates table
-- Provides a template library for the Workflow Designer

CREATE TABLE IF NOT EXISTS workflow.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  category VARCHAR(50) NOT NULL DEFAULT 'custom',
  name JSONB NOT NULL DEFAULT '{}',
  description JSONB,
  graph_snapshot JSONB NOT NULL,
  is_system BOOLEAN DEFAULT false,
  tags JSONB,
  usage_count INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wt_tenant ON workflow.workflow_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wt_category ON workflow.workflow_templates(category);
