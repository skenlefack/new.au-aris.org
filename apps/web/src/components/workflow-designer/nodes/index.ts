import type { NodeTypes } from '@xyflow/react';
import { StartNode } from './StartNode';
import { StepNode } from './StepNode';
import { DecisionNode } from './DecisionNode';
import { ForkNode } from './ForkNode';
import { JoinNode } from './JoinNode';
import { NotificationNode } from './NotificationNode';
import { EndNode } from './EndNode';

export { StartNode } from './StartNode';
export { StepNode } from './StepNode';
export { DecisionNode } from './DecisionNode';
export { ForkNode } from './ForkNode';
export { JoinNode } from './JoinNode';
export { NotificationNode } from './NotificationNode';
export { EndNode } from './EndNode';

export const nodeTypes: NodeTypes = {
  start: StartNode as any,
  step: StepNode as any,
  decision: DecisionNode as any,
  fork: ForkNode as any,
  join: JoinNode as any,
  notification: NotificationNode as any,
  end: EndNode as any,
};
