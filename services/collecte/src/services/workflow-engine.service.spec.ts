import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkflowDefinitionService,
  ValidationChainService,
  WorkflowInstanceService,
  CollectionCampaignService,
  HttpError,
} from './workflow-engine.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

/* ── Fixtures ── */

const nationalAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000101',
  email: 'admin@ke.au-aris.org',
  firstName: 'Kenya',
  lastName: 'Admin',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000101',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const superAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000001',
  email: 'admin@au-aris.org',
  firstName: 'Super',
  lastName: 'Admin',
  role: UserRole.SUPER_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000001',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockWorkflow = {
  id: '20000000-0000-4000-a000-000000000001',
  countryId: 'country-ke',
  name: { en: 'Kenya Validation Workflow' },
  description: { en: 'Full validation from Sub-Location to National' },
  startLevel: 5,
  endLevel: 0,
  isActive: true,
  defaultTransmitDelay: 72,
  defaultValidationDelay: 48,
  autoTransmitEnabled: true,
  autoValidateEnabled: false,
  requireComment: false,
  allowReject: true,
  allowReturnForCorrection: true,
  createdBy: nationalAdmin.userId,
  steps: [
    {
      id: 'step-0',
      workflowId: '20000000-0000-4000-a000-000000000001',
      stepOrder: 0,
      levelType: 'admin5',
      adminLevel: 5,
      name: { en: 'Sub-Location Collection' },
      canEdit: true,
      canValidate: false,
      canReject: true,
      canReturnForCorrection: true,
      transmitDelayHours: null,
    },
    {
      id: 'step-1',
      workflowId: '20000000-0000-4000-a000-000000000001',
      stepOrder: 1,
      levelType: 'admin4',
      adminLevel: 4,
      name: { en: 'Location Review' },
      canEdit: false,
      canValidate: true,
      canReject: true,
      canReturnForCorrection: true,
      transmitDelayHours: 48,
    },
    {
      id: 'step-2',
      workflowId: '20000000-0000-4000-a000-000000000001',
      stepOrder: 2,
      levelType: 'admin3',
      adminLevel: 3,
      name: { en: 'Ward Validation' },
      canEdit: false,
      canValidate: true,
      canReject: true,
      canReturnForCorrection: true,
      transmitDelayHours: null,
    },
  ],
  country: { id: 'country-ke', code: 'KE', name: { en: 'Kenya' } },
};

const mockInstance = {
  id: 'instance-001',
  workflowId: mockWorkflow.id,
  submissionId: 'submission-001',
  formSubmissionId: null,
  currentStepOrder: 1,
  status: 'IN_PROGRESS',
  submittedBy: nationalAdmin.userId,
  currentDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
  currentAssigneeId: superAdmin.userId,
  priority: 'NORMAL',
  isOverdue: false,
  createdAt: new Date(),
  workflow: mockWorkflow,
};

const mockChain = {
  id: 'chain-001',
  userId: nationalAdmin.userId,
  validatorId: superAdmin.userId,
  priority: 1,
  levelType: 'national',
  isActive: true,
  backupValidatorId: null,
  createdBy: superAdmin.userId,
  user: { id: nationalAdmin.userId, email: nationalAdmin.email, firstName: 'Kenya', lastName: 'Admin', role: 'NATIONAL_ADMIN' },
  validator: { id: superAdmin.userId, email: superAdmin.email, firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' },
  backupValidator: null,
};

/* ── Helpers ── */

function makePrisma() {
  return {
    collecteWorkflow: {
      create: vi.fn().mockResolvedValue(mockWorkflow),
      findMany: vi.fn().mockResolvedValue([mockWorkflow]),
      findUnique: vi.fn().mockResolvedValue(mockWorkflow),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockWorkflow),
    },
    collecteWorkflowStep: {
      create: vi.fn().mockResolvedValue(mockWorkflow.steps[0]),
      findFirst: vi.fn().mockResolvedValue(mockWorkflow.steps[0]),
      update: vi.fn().mockResolvedValue(mockWorkflow.steps[0]),
      delete: vi.fn().mockResolvedValue(mockWorkflow.steps[0]),
    },
    collecteValidationChain: {
      create: vi.fn().mockResolvedValue(mockChain),
      findMany: vi.fn().mockResolvedValue([mockChain]),
      findUnique: vi.fn().mockResolvedValue(mockChain),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockChain),
      delete: vi.fn().mockResolvedValue(mockChain),
    },
    collecteInstance: {
      create: vi.fn().mockResolvedValue({ ...mockInstance, history: [] }),
      findMany: vi.fn().mockResolvedValue([mockInstance]),
      findUnique: vi.fn().mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      }),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockInstance),
    },
    collecteHistory: {
      create: vi.fn().mockResolvedValue({ id: 'history-001' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        id: nationalAdmin.tenantId,
        countryCode: 'KE',
      }),
    },
    country: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'country-ke',
        code: 'KE',
        name: { en: 'Kenya' },
      }),
    },
    collectionCampaign: {
      create: vi.fn().mockResolvedValue({ id: 'campaign-001' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({ id: 'campaign-001' }),
    },
    campaignAssignment: {
      create: vi.fn().mockResolvedValue({ id: 'assign-001' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'assign-001', campaignId: 'campaign-001' }),
      delete: vi.fn().mockResolvedValue({ id: 'assign-001' }),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

/* ── Tests ── */

describe('WorkflowDefinitionService', () => {
  let service: WorkflowDefinitionService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new WorkflowDefinitionService(prisma as never, kafka as never);
  });

  it('should create a workflow definition', async () => {
    const result = await service.create(
      { countryId: 'country-ke', name: { en: 'Test' }, startLevel: 5, endLevel: 0 },
      nationalAdmin,
    );

    expect(result.data).toBeDefined();
    expect(prisma.collecteWorkflow.create).toHaveBeenCalledOnce();
  });

  it('should list all workflow definitions', async () => {
    const result = await service.findAll(superAdmin, {});

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
  });

  it('should find one by ID', async () => {
    const result = await service.findOne(mockWorkflow.id);

    expect(result.data).toBeDefined();
    expect(prisma.collecteWorkflow.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockWorkflow.id } }),
    );
  });

  it('should throw 404 when not found', async () => {
    prisma.collecteWorkflow.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent')).rejects.toThrow(HttpError);
    await expect(service.findOne('nonexistent')).rejects.toThrow('not found');
  });

  it('should find workflow by country code', async () => {
    const result = await service.findByCountryCode('KE');

    expect(result.data).toBeDefined();
    expect(prisma.country.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'KE' } }),
    );
  });

  it('should update workflow settings', async () => {
    const result = await service.update(mockWorkflow.id, {
      autoTransmitEnabled: false,
      defaultTransmitDelay: 96,
    });

    expect(result.data).toBeDefined();
    expect(prisma.collecteWorkflow.update).toHaveBeenCalledOnce();
  });

  it('should create a step', async () => {
    const result = await service.createStep(mockWorkflow.id, {
      stepOrder: 3,
      levelType: 'admin1',
      adminLevel: 1,
      name: { en: 'County Validation' },
    });

    expect(result.data).toBeDefined();
    expect(prisma.collecteWorkflowStep.create).toHaveBeenCalledOnce();
  });

  it('should delete a step', async () => {
    await service.deleteStep(mockWorkflow.id, 'step-0');

    expect(prisma.collecteWorkflowStep.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'step-0' } }),
    );
  });

  it('should throw 404 when deleting non-existent step', async () => {
    prisma.collecteWorkflowStep.findFirst.mockResolvedValue(null);

    await expect(service.deleteStep(mockWorkflow.id, 'bad-id')).rejects.toThrow(HttpError);
  });
});

describe('ValidationChainService', () => {
  let service: ValidationChainService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ValidationChainService(prisma as never);
  });

  it('should create a validation chain', async () => {
    const result = await service.create(
      { userId: nationalAdmin.userId, validatorId: superAdmin.userId, levelType: 'national' },
      superAdmin,
    );

    expect(result.data).toBeDefined();
    expect(prisma.collecteValidationChain.create).toHaveBeenCalledOnce();
  });

  it('should list chains with pagination', async () => {
    const result = await service.findAll(superAdmin, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
  });

  it('should find chains by user', async () => {
    const result = await service.findByUser(nationalAdmin.userId);

    expect(result.data).toHaveLength(1);
    expect(prisma.collecteValidationChain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: nationalAdmin.userId, isActive: true },
      }),
    );
  });

  it('should find chains by validator', async () => {
    const result = await service.findByValidator(superAdmin.userId);

    expect(result.data).toHaveLength(1);
  });

  it('should delete a chain', async () => {
    await service.delete(mockChain.id);

    expect(prisma.collecteValidationChain.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockChain.id } }),
    );
  });

  it('should throw 404 when deleting non-existent chain', async () => {
    prisma.collecteValidationChain.findUnique.mockResolvedValue(null);

    await expect(service.delete('nonexistent')).rejects.toThrow(HttpError);
  });
});

describe('WorkflowInstanceService', () => {
  let service: WorkflowInstanceService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new WorkflowInstanceService(prisma as never, kafka as never);
  });

  describe('startWorkflow', () => {
    it('should create an instance and initial history entry', async () => {
      const result = await service.startWorkflow('submission-001', nationalAdmin);

      expect(result.data).toBeDefined();
      expect(prisma.collecteInstance.create).toHaveBeenCalledOnce();
      expect(prisma.collecteHistory.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledOnce();
    });

    it('should assign step 0 to submitter when canEdit=true', async () => {
      await service.startWorkflow('submission-001', nationalAdmin);

      const createCall = prisma.collecteInstance.create.mock.calls[0][0];
      expect(createCall.data.currentAssigneeId).toBe(nationalAdmin.userId);
      expect(createCall.data.currentStepOrder).toBe(0);
      expect(createCall.data.status).toBe('IN_PROGRESS');
    });

    it('should throw when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.startWorkflow('submission-001', nationalAdmin),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw when no workflow defined for country', async () => {
      prisma.collecteWorkflow.findUnique.mockResolvedValue(null);

      await expect(
        service.startWorkflow('submission-001', nationalAdmin),
      ).rejects.toThrow('No workflow defined');
    });

    it('should throw when workflow is inactive', async () => {
      prisma.collecteWorkflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        isActive: false,
      });

      await expect(
        service.startWorkflow('submission-001', nationalAdmin),
      ).rejects.toThrow('inactive');
    });

    it('should throw when workflow has no steps', async () => {
      prisma.collecteWorkflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        steps: [],
      });

      await expect(
        service.startWorkflow('submission-001', nationalAdmin),
      ).rejects.toThrow('no steps');
    });
  });

  describe('validate', () => {
    it('should advance to next step', async () => {
      // Instance at step 1, step 1 canValidate=true
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      const result = await service.validate('instance-001', {}, superAdmin);

      expect(result.data).toBeDefined();
      expect(prisma.collecteInstance.update).toHaveBeenCalledOnce();
      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'validated',
            fromStep: 1,
            toStep: 2,
          }),
        }),
      );
    });

    it('should complete when validating last step', async () => {
      // Instance at step 2 (last step)
      const lastStepInstance = {
        ...mockInstance,
        currentStepOrder: 2,
        history: [],
        submission: { id: 'submission-001' },
      };
      prisma.collecteInstance.findUnique.mockResolvedValue(lastStepInstance);

      await service.validate('instance-001', {}, superAdmin);

      const updateCall = prisma.collecteInstance.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
      expect(updateCall.data.completedAt).toBeDefined();
    });

    it('should throw when validation not allowed at current step', async () => {
      // Step 0 has canValidate=false
      const step0Instance = {
        ...mockInstance,
        currentStepOrder: 0,
        history: [],
        submission: { id: 'submission-001' },
      };
      prisma.collecteInstance.findUnique.mockResolvedValue(step0Instance);

      await expect(
        service.validate('instance-001', {}, nationalAdmin),
      ).rejects.toThrow('not allowed');
    });

    it('should throw when instance is already completed', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        status: 'COMPLETED',
        history: [],
        submission: { id: 'submission-001' },
      });

      await expect(
        service.validate('instance-001', {}, superAdmin),
      ).rejects.toThrow('Cannot perform action');
    });

    it('should publish Kafka event on validation', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.validate('instance-001', {}, superAdmin);

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.collecte.workflow.step.validated.v1',
        expect.any(String),
        expect.objectContaining({ instanceId: 'instance-001' }),
        expect.any(Object),
      );
    });

    it('should require comment when workflow.requireComment=true', async () => {
      const commentRequiredWf = { ...mockWorkflow, requireComment: true };
      const instance = {
        ...mockInstance,
        workflow: commentRequiredWf,
        history: [],
        submission: { id: 'submission-001' },
      };
      prisma.collecteInstance.findUnique.mockResolvedValue(instance);

      await expect(
        service.validate('instance-001', {}, superAdmin),
      ).rejects.toThrow('Comment is required');
    });
  });

  describe('reject', () => {
    it('should set status to REJECTED', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.reject('instance-001', { reason: 'Data quality issues' }, superAdmin);

      const updateCall = prisma.collecteInstance.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('REJECTED');
      expect(updateCall.data.currentAssigneeId).toBeNull();
    });

    it('should create history entry with reason', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.reject('instance-001', { reason: 'Data quality issues' }, superAdmin);

      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'rejected',
            reason: 'Data quality issues',
          }),
        }),
      );
    });

    it('should publish rejected event', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.reject('instance-001', { reason: 'Bad data' }, superAdmin);

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.collecte.workflow.submission.rejected.v1',
        expect.any(String),
        expect.objectContaining({
          instanceId: 'instance-001',
          reason: 'Bad data',
        }),
        expect.any(Object),
      );
    });
  });

  describe('returnForCorrection', () => {
    it('should return to step 0 and reassign to submitter', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.returnForCorrection(
        'instance-001',
        { reason: 'Missing GPS coordinates' },
        superAdmin,
      );

      const updateCall = prisma.collecteInstance.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('RETURNED');
      expect(updateCall.data.currentStepOrder).toBe(0);
      expect(updateCall.data.currentAssigneeId).toBe(nationalAdmin.userId);
    });

    it('should create history entry with return action', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.returnForCorrection(
        'instance-001',
        { reason: 'Needs correction' },
        superAdmin,
      );

      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'returned',
            fromStep: 1,
            toStep: 0,
            toAssignee: nationalAdmin.userId,
          }),
        }),
      );
    });
  });

  describe('reassign', () => {
    it('should change assignee', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.reassign(
        'instance-001',
        { newAssigneeId: 'new-validator-id' },
        superAdmin,
      );

      const updateCall = prisma.collecteInstance.update.mock.calls[0][0];
      expect(updateCall.data.currentAssigneeId).toBe('new-validator-id');
    });
  });

  describe('addComment', () => {
    it('should create a comment history entry', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [],
        submission: { id: 'submission-001' },
      });

      await service.addComment(
        'instance-001',
        { comment: 'Looks good so far' },
        superAdmin,
      );

      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'commented',
            comment: { text: 'Looks good so far' },
          }),
        }),
      );
    });
  });

  describe('dashboard', () => {
    it('getMyTasks should filter by currentAssigneeId', async () => {
      await service.getMyTasks(superAdmin, {});

      const call = prisma.collecteInstance.findMany.mock.calls[0][0];
      expect(call.where.currentAssigneeId).toBe(superAdmin.userId);
      expect(call.where.status).toEqual({ in: ['IN_PROGRESS', 'RETURNED'] });
    });

    it('getMySubmissions should filter by submittedBy', async () => {
      await service.getMySubmissions(nationalAdmin, {});

      const call = prisma.collecteInstance.findMany.mock.calls[0][0];
      expect(call.where.submittedBy).toBe(nationalAdmin.userId);
    });

    it('getStats should return aggregated stats', async () => {
      const result = await service.getStats(superAdmin);

      expect(result.data).toHaveProperty('pendingValidation');
      expect(result.data).toHaveProperty('validatedToday');
      expect(result.data).toHaveProperty('overdue');
      expect(result.data).toHaveProperty('completionRate');
      expect(result.data).toHaveProperty('byStatus');
    });

    it('getOverdue should filter by deadline < now', async () => {
      await service.getOverdue({});

      const call = prisma.collecteInstance.findMany.mock.calls[0][0];
      expect(call.where.currentDeadline).toHaveProperty('lt');
    });

    it('getTimeline should include step info and progress', async () => {
      prisma.collecteInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        history: [
          {
            id: 'h1',
            action: 'submitted',
            fromStep: null,
            toStep: 0,
            performedBy: nationalAdmin.userId,
            performedByName: 'Kenya Admin',
            createdAt: new Date(),
          },
        ],
        submission: { id: 'submission-001' },
      });

      const result = await service.getTimeline('instance-001');

      expect(result.data.instance).toBeDefined();
      expect(result.data.timeline).toHaveLength(1);
      expect(result.data.currentStep).toBeDefined();
      expect(result.data.totalSteps).toBe(3);
      expect(typeof result.data.progress).toBe('number');
    });
  });

  describe('processAutoTransmit', () => {
    it('should advance overdue instances with autoTransmitEnabled', async () => {
      const overdueInstance = {
        ...mockInstance,
        currentDeadline: new Date(Date.now() - 1000),
        currentStepOrder: 0,
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);

      const count = await service.processAutoTransmit();

      expect(count).toBe(1);
      expect(prisma.collecteInstance.update).toHaveBeenCalledOnce();
      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'auto_transmitted',
            isAutomatic: true,
          }),
        }),
      );
    });

    it('should skip instances when autoTransmitEnabled=false', async () => {
      const noAutoWorkflow = { ...mockWorkflow, autoTransmitEnabled: false };
      const overdueInstance = {
        ...mockInstance,
        currentDeadline: new Date(Date.now() - 1000),
        workflow: noAutoWorkflow,
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);

      const count = await service.processAutoTransmit();

      expect(count).toBe(0);
      expect(prisma.collecteInstance.update).not.toHaveBeenCalled();
    });

    it('should auto-complete at last step if autoValidateEnabled', async () => {
      const autoValidateWorkflow = {
        ...mockWorkflow,
        autoValidateEnabled: true,
      };
      const overdueInstance = {
        ...mockInstance,
        currentStepOrder: 2, // Last step (index 2)
        currentDeadline: new Date(Date.now() - 1000),
        workflow: autoValidateWorkflow,
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);

      const count = await service.processAutoTransmit();

      expect(count).toBe(1);
      const updateCall = prisma.collecteInstance.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
    });

    it('should return 0 when no overdue instances', async () => {
      prisma.collecteInstance.findMany.mockResolvedValue([]);

      const count = await service.processAutoTransmit();

      expect(count).toBe(0);
    });
  });

  describe('processEscalation', () => {
    it('should escalate 2x overdue instances', async () => {
      const overdueInstance = {
        ...mockInstance,
        isOverdue: true,
        currentDeadline: new Date(Date.now() - 1000),
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);
      // No recent escalation
      prisma.collecteHistory.findFirst.mockResolvedValue(null);

      const count = await service.processEscalation();

      expect(count).toBe(1);
      expect(prisma.collecteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'escalated',
            isAutomatic: true,
          }),
        }),
      );
    });

    it('should skip if recently escalated', async () => {
      const overdueInstance = {
        ...mockInstance,
        isOverdue: true,
        currentDeadline: new Date(Date.now() - 1000),
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);
      // Recent escalation exists
      prisma.collecteHistory.findFirst.mockResolvedValue({
        id: 'esc-1',
        action: 'escalated',
        createdAt: new Date(),
      });

      const count = await service.processEscalation();

      expect(count).toBe(0);
    });

    it('should reassign to backup validator if available', async () => {
      const overdueInstance = {
        ...mockInstance,
        isOverdue: true,
        currentDeadline: new Date(Date.now() - 1000),
      };
      prisma.collecteInstance.findMany.mockResolvedValue([overdueInstance]);
      prisma.collecteHistory.findFirst.mockResolvedValue(null);
      prisma.collecteValidationChain.findFirst.mockResolvedValue({
        ...mockChain,
        backupValidatorId: 'backup-validator-001',
      });

      const count = await service.processEscalation();

      expect(count).toBe(1);
      expect(prisma.collecteInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentAssigneeId: 'backup-validator-001' },
        }),
      );
    });
  });
});

describe('CollectionCampaignService', () => {
  let service: CollectionCampaignService;
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new CollectionCampaignService(prisma as never, kafka as never);
  });

  it('should create a campaign', async () => {
    const result = await service.create(
      {
        code: 'Q1_TEST',
        name: { en: 'Test Campaign' },
        domain: 'animal_health',
        formTemplateId: 'template-001',
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        scope: 'continental',
      },
      superAdmin,
    );

    expect(result.data).toBeDefined();
    expect(prisma.collectionCampaign.create).toHaveBeenCalledOnce();
  });

  it('should reject when endDate <= startDate', async () => {
    await expect(
      service.create(
        {
          code: 'BAD',
          name: { en: 'Bad' },
          domain: 'health',
          formTemplateId: 'template-001',
          startDate: '2025-06-01',
          endDate: '2025-01-01',
        },
        superAdmin,
      ),
    ).rejects.toThrow('endDate must be after startDate');
  });

  it('should list campaigns with pagination', async () => {
    const result = await service.findAll(superAdmin, { page: 1, limit: 10 });

    expect(result.data).toBeDefined();
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 10 });
  });

  it('should update campaign status', async () => {
    prisma.collectionCampaign.update.mockResolvedValue({
      id: 'campaign-001',
      status: 'ACTIVE',
    });

    const result = await service.updateStatus('campaign-001', 'ACTIVE');

    expect(result.data.status).toBe('ACTIVE');
  });

  it('should add an assignment', async () => {
    prisma.collectionCampaign.findUnique.mockResolvedValue({ id: 'campaign-001' });

    const result = await service.addAssignment('campaign-001', {
      userId: nationalAdmin.userId,
      countryCode: 'KE',
      targetSubmissions: 50,
    });

    expect(result.data).toBeDefined();
    expect(prisma.campaignAssignment.create).toHaveBeenCalledOnce();
  });

  it('should throw when adding assignment to non-existent campaign', async () => {
    prisma.collectionCampaign.findUnique.mockResolvedValue(null);

    await expect(
      service.addAssignment('nonexistent', { userId: nationalAdmin.userId }),
    ).rejects.toThrow(HttpError);
  });

  it('should remove an assignment', async () => {
    await service.removeAssignment('campaign-001', 'assign-001');

    expect(prisma.campaignAssignment.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'assign-001' } }),
    );
  });
});
