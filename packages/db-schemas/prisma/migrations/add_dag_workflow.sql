-- DAG Workflow migration: branching, choice routing, parallel execution
-- Applied via: docker exec -w /app/packages/db-schemas <container> npx prisma db push --schema=prisma --accept-data-loss

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE workflow."WfEdgeType" AS ENUM ('SEQUENTIAL', 'PARALLEL', 'CHOICE_SINGLE', 'CHOICE_MULTI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE workflow."WfMergeStrategy" AS ENUM ('ALL', 'ANY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend workflow_definitions
ALTER TABLE workflow.workflow_definitions
  ADD COLUMN IF NOT EXISTS is_dag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graph_version INTEGER NOT NULL DEFAULT 1;

-- 3. Extend workflow_steps
ALTER TABLE workflow.workflow_steps
  ADD COLUMN IF NOT EXISTS step_key VARCHAR(80),
  ADD COLUMN IF NOT EXISTS node_type VARCHAR(20) NOT NULL DEFAULT 'step',
  ADD COLUMN IF NOT EXISTS merge_strategy workflow."WfMergeStrategy" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS allowed_roles JSONB,
  ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION;

-- 4. Extend workflow_instances
ALTER TABLE workflow.workflow_instances
  ADD COLUMN IF NOT EXISTS current_step_id UUID,
  ADD COLUMN IF NOT EXISTS definition_id UUID;

-- 5. Extend workflow_transitions
ALTER TABLE workflow.workflow_transitions
  ADD COLUMN IF NOT EXISTS step_id UUID,
  ADD COLUMN IF NOT EXISTS branch_token_id UUID;

-- 6. Create workflow_edges table
CREATE TABLE IF NOT EXISTS workflow.workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow.workflow_definitions(id) ON DELETE CASCADE,
  source_step_id UUID NOT NULL REFERENCES workflow.workflow_steps(id) ON DELETE CASCADE,
  target_step_id UUID NOT NULL REFERENCES workflow.workflow_steps(id) ON DELETE CASCADE,
  edge_type workflow."WfEdgeType" NOT NULL DEFAULT 'SEQUENTIAL',
  condition JSONB,
  label JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_edges_definition ON workflow.workflow_edges(definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow.workflow_edges(source_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow.workflow_edges(target_step_id);

-- 7. Create workflow_branch_tokens table
CREATE TABLE IF NOT EXISTS workflow.workflow_branch_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow.workflow_instances(id),
  step_id UUID NOT NULL,
  branch_group VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_branch_tokens_instance ON workflow.workflow_branch_tokens(instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_branch_tokens_group ON workflow.workflow_branch_tokens(instance_id, branch_group);

-- 8. Backfill: generate SEQUENTIAL edges for existing definitions
-- For each definition, create edges step[i] → step[i+1] based on step_order
INSERT INTO workflow.workflow_edges (definition_id, source_step_id, target_step_id, edge_type, sort_order)
SELECT
  s1.definition_id,
  s1.id AS source_step_id,
  s2.id AS target_step_id,
  'SEQUENTIAL'::workflow."WfEdgeType",
  s1.step_order
FROM workflow.workflow_steps s1
JOIN workflow.workflow_steps s2
  ON s1.definition_id = s2.definition_id
  AND s2.step_order = s1.step_order + 1
ON CONFLICT DO NOTHING;

-- 9. Backfill step_key from level_type for existing steps
UPDATE workflow.workflow_steps
SET step_key = level_type
WHERE step_key IS NULL;
