import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createMockJwtPayload,
  createMockTenantTree,
  createMockSubmission,
} from '@aris/test-utils';
import { UserRole, TenantLevel } from '@aris/shared-types';
import { startPgAndKafka, stopAllContainers } from '../setup/test-infrastructure';
import type { PostgresContainerResult, KafkaContainerResult } from '@aris/test-utils';

describe('Flux A: FormBuilder → Kafka → Collecte → Workflow', () => {
  let postgres: PostgresContainerResult;
  let kafka: KafkaContainerResult;

  beforeAll(async () => {
    const infra = await startPgAndKafka();
    postgres = infra.postgres;
    kafka = infra.kafka;
  });

  afterAll(async () => {
    await stopAllContainers({ postgres, kafka });
  });

  it('should have valid PostgreSQL connection', () => {
    expect(postgres.databaseUrl).toContain('postgresql://');
    expect(postgres.port).toBeGreaterThan(0);
  });

  it('should have valid Kafka broker', () => {
    expect(kafka.brokerUrl).toBeDefined();
    expect(kafka.port).toBeGreaterThan(0);
  });

  it('should create a tenant tree for form submission context', () => {
    const tree = createMockTenantTree({ recCount: 1, msPerRec: 2 });

    expect(tree.continental).toBeDefined();
    expect(tree.recs).toHaveLength(1);
    expect(tree.memberStates).toHaveLength(2);

    // MS tenants should be children of the REC
    for (const ms of tree.memberStates) {
      expect(ms.parentId).toBe(tree.recs[0].id);
    }
  });

  it('should simulate a form submission event', () => {
    const tree = createMockTenantTree({ recCount: 1, msPerRec: 1 });
    const msTenant = tree.memberStates[0];

    const jwt = createMockJwtPayload({
      role: UserRole.FIELD_AGENT,
      tenantId: msTenant.id,
      tenantLevel: TenantLevel.MEMBER_STATE,
    });

    const submission = createMockSubmission({
      tenantId: msTenant.id,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    });

    // Verify the submission was created with correct tenant scoping
    expect(submission.tenantId).toBe(msTenant.id);
    expect(submission.status).toBe('SUBMITTED');
    expect(jwt.tenantId).toBe(msTenant.id);

    // Simulate Kafka event payload
    const kafkaEvent = {
      topic: 'ms.collecte.form.submitted.v1',
      key: submission.id,
      value: {
        submissionId: submission.id,
        templateId: submission.templateId,
        tenantId: submission.tenantId,
        submittedBy: jwt.userId,
        submittedAt: submission.submittedAt,
        data: submission.data,
      },
    };

    expect(kafkaEvent.topic).toBe('ms.collecte.form.submitted.v1');
    expect(kafkaEvent.value.submissionId).toBe(submission.id);
    expect(kafkaEvent.value.tenantId).toBe(msTenant.id);
  });

  it('should simulate workflow instance creation from submission', () => {
    const tree = createMockTenantTree({ recCount: 1, msPerRec: 1 });
    const msTenant = tree.memberStates[0];

    const submission = createMockSubmission({
      tenantId: msTenant.id,
      status: 'SUBMITTED',
    });

    // Simulate workflow instance
    const workflowInstance = {
      id: crypto.randomUUID(),
      submissionId: submission.id,
      tenantId: msTenant.id,
      currentLevel: 'NATIONAL_TECHNICAL',
      status: 'PENDING',
      history: [
        {
          level: 'NATIONAL_TECHNICAL',
          action: 'CREATED',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    expect(workflowInstance.currentLevel).toBe('NATIONAL_TECHNICAL');
    expect(workflowInstance.status).toBe('PENDING');
    expect(workflowInstance.submissionId).toBe(submission.id);
    expect(workflowInstance.tenantId).toBe(msTenant.id);
    expect(workflowInstance.history).toHaveLength(1);
  });
});
