-- Workflow Graph Versions: stores snapshots of the graph before each save
CREATE TABLE IF NOT EXISTS workflow.workflow_graph_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow.workflow_definitions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary VARCHAR(500),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(definition_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_wgv_definition ON workflow.workflow_graph_versions(definition_id);
