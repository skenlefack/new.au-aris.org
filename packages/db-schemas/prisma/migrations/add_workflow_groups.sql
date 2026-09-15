-- Migration: Add collapsible workflow groups
-- Groups allow visual organization of workflow steps in the designer

CREATE TABLE IF NOT EXISTS workflow.workflow_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow.workflow_definitions(id) ON DELETE CASCADE,
  group_key VARCHAR(120) NOT NULL,
  name JSONB DEFAULT '{}',
  description JSONB,
  color VARCHAR(20) DEFAULT '#6366f1',
  is_collapsed BOOLEAN DEFAULT false,
  position_x FLOAT,
  position_y FLOAT,
  width FLOAT,
  height FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow.workflow_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES workflow.workflow_groups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow.workflow_steps(id) ON DELETE CASCADE,
  UNIQUE(group_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_groups_definition ON workflow.workflow_groups(definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_group_members_group ON workflow.workflow_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_workflow_group_members_step ON workflow.workflow_group_members(step_id);
