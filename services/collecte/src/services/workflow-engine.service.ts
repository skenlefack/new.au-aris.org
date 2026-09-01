import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'collecte-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// ── Workflow Definitions ──

// Country includes BigInt `population` — select only safe fields to avoid JSON serialization errors
const COUNTRY_SELECT = {
  select: { id: true, code: true, name: true, flag: true, isActive: true, tenantId: true },
};

const WF_INCLUDE = {
  steps: { orderBy: { stepOrder: 'asc' as const } },
  country: COUNTRY_SELECT,
};

export class WorkflowDefinitionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const workflow = await (this.prisma as any).collecteWorkflow.create({
      data: {
        countryId: dto.countryId as string,
        name: dto.name,
        description: dto.description ?? null,
        startLevel: dto.startLevel ?? 5,
        endLevel: dto.endLevel ?? 0,
        defaultTransmitDelay: dto.defaultTransmitDelay ?? 72,
        defaultValidationDelay: dto.defaultValidationDelay ?? 48,
        autoTransmitEnabled: dto.autoTransmitEnabled ?? true,
        autoValidateEnabled: dto.autoValidateEnabled ?? false,
        requireComment: dto.requireComment ?? false,
        allowReject: dto.allowReject ?? true,
        allowReturnForCorrection: dto.allowReturnForCorrection ?? true,
        notifyOnSubmit: dto.notifyOnSubmit ?? true,
        notifyOnValidate: dto.notifyOnValidate ?? true,
        notifyOnReject: dto.notifyOnReject ?? true,
        notifyOnAutoTransmit: dto.notifyOnAutoTransmit ?? true,
        metadata: dto.metadata ?? null,
        createdBy: user.userId,
      },
      include: WF_INCLUDE,
    });

    return { data: workflow };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; isActive?: boolean },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where['isActive'] = query.isActive;

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteWorkflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: WF_INCLUDE,
      }),
      (this.prisma as any).collecteWorkflow.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<unknown>> {
    const workflow = await (this.prisma as any).collecteWorkflow.findUnique({
      where: { id },
      include: WF_INCLUDE,
    });
    if (!workflow) throw new HttpError(404, `Workflow ${id} not found`);
    return { data: workflow };
  }

  async findByCountryCode(code: string): Promise<ApiResponse<unknown>> {
    const country = await (this.prisma as any).country.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!country) throw new HttpError(404, `Country ${code} not found`);

    const workflow = await (this.prisma as any).collecteWorkflow.findUnique({
      where: { countryId: country.id },
      include: WF_INCLUDE,
    });
    if (!workflow) throw new HttpError(404, `No workflow defined for country ${code}`);
    return { data: workflow };
  }

  async update(id: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).collecteWorkflow.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Workflow ${id} not found`);

    const data: Record<string, unknown> = {};
    for (const key of [
      'name', 'description', 'isActive', 'startLevel', 'endLevel',
      'defaultTransmitDelay', 'defaultValidationDelay', 'autoTransmitEnabled',
      'autoValidateEnabled', 'requireComment', 'allowReject', 'allowReturnForCorrection',
      'notifyOnSubmit', 'notifyOnValidate', 'notifyOnReject', 'notifyOnAutoTransmit', 'metadata',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }

    const workflow = await (this.prisma as any).collecteWorkflow.update({
      where: { id },
      data,
      include: WF_INCLUDE,
    });

    return { data: workflow };
  }

  // ── Steps ──

  async createStep(workflowId: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const workflow = await (this.prisma as any).collecteWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new HttpError(404, `Workflow ${workflowId} not found`);

    const step = await (this.prisma as any).collecteWorkflowStep.create({
      data: {
        workflowId,
        stepOrder: dto.stepOrder as number,
        levelType: dto.levelType as string,
        adminLevel: (dto.adminLevel as number) ?? null,
        name: dto.name,
        description: dto.description ?? null,
        assignmentMode: (dto.assignmentMode as string) ?? 'any',
        allowedFunctionIds: dto.allowedFunctionIds ?? null,
        canValidate: dto.canValidate ?? true,
        canReject: dto.canReject ?? true,
        canReturnForCorrection: dto.canReturnForCorrection ?? true,
        canEdit: dto.canEdit ?? false,
        canAddComment: dto.canAddComment ?? true,
        canAttachFiles: dto.canAttachFiles ?? true,
        transmitDelayHours: (dto.transmitDelayHours as number) ?? null,
        validationDelayHours: (dto.validationDelayHours as number) ?? null,
        autoRouteToNext: dto.autoRouteToNext ?? true,
        requireChooseValidator: dto.requireChooseValidator ?? false,
        metadata: dto.metadata ?? null,
      },
    });

    return { data: step };
  }

  async updateStep(workflowId: string, stepId: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const step = await (this.prisma as any).collecteWorkflowStep.findFirst({
      where: { id: stepId, workflowId },
    });
    if (!step) throw new HttpError(404, `Step ${stepId} not found in workflow ${workflowId}`);

    const data: Record<string, unknown> = {};
    for (const key of [
      'name', 'description', 'assignmentMode', 'allowedFunctionIds',
      'canValidate', 'canReject', 'canReturnForCorrection', 'canEdit',
      'canAddComment', 'canAttachFiles', 'transmitDelayHours', 'validationDelayHours',
      'autoRouteToNext', 'requireChooseValidator', 'metadata',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }

    const updated = await (this.prisma as any).collecteWorkflowStep.update({
      where: { id: stepId },
      data,
    });

    return { data: updated };
  }

  async deleteStep(workflowId: string, stepId: string): Promise<void> {
    const step = await (this.prisma as any).collecteWorkflowStep.findFirst({
      where: { id: stepId, workflowId },
    });
    if (!step) throw new HttpError(404, `Step ${stepId} not found in workflow ${workflowId}`);
    await (this.prisma as any).collecteWorkflowStep.delete({ where: { id: stepId } });
  }
}

// ── Validation Chains ──

export class ValidationChainService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const chain = await (this.prisma as any).collecteValidationChain.create({
      data: {
        userId: dto.userId as string,
        validatorId: dto.validatorId as string,
        priority: (dto.priority as number) ?? 1,
        levelType: dto.levelType as string,
        backupValidatorId: (dto.backupValidatorId as string) ?? null,
        metadata: dto.metadata ?? null,
        createdBy: user.userId,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        validator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        backupValidator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    return { data: chain };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; userId?: string; validatorId?: string },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (query.userId) where['userId'] = query.userId;
    if (query.validatorId) where['validatorId'] = query.validatorId;

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteValidationChain.findMany({
        where,
        skip,
        take: limit,
        orderBy: { priority: 'asc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          validator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          backupValidator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      }),
      (this.prisma as any).collecteValidationChain.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findByUser(userId: string): Promise<ApiResponse<unknown>> {
    const chains = await (this.prisma as any).collecteValidationChain.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: 'asc' },
      include: {
        validator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        backupValidator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    return { data: chains };
  }

  async findByValidator(validatorId: string): Promise<ApiResponse<unknown>> {
    const chains = await (this.prisma as any).collecteValidationChain.findMany({
      where: { validatorId, isActive: true },
      orderBy: { priority: 'asc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    return { data: chains };
  }

  async update(id: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).collecteValidationChain.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Validation chain ${id} not found`);

    const data: Record<string, unknown> = {};
    if (dto.priority !== undefined) data['priority'] = dto.priority;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.backupValidatorId !== undefined) data['backupValidatorId'] = dto.backupValidatorId;
    if (dto.metadata !== undefined) data['metadata'] = dto.metadata;

    const chain = await (this.prisma as any).collecteValidationChain.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        validator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        backupValidator: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    return { data: chain };
  }

  async delete(id: string): Promise<void> {
    const existing = await (this.prisma as any).collecteValidationChain.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Validation chain ${id} not found`);
    await (this.prisma as any).collecteValidationChain.delete({ where: { id } });
  }
}

// ── Workflow Instance Engine ──

export class WorkflowInstanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  /** Start the workflow for a submission */
  async startWorkflow(
    submissionId: string,
    user: AuthenticatedUser,
    opts?: { formSubmissionId?: string; priority?: string },
  ): Promise<ApiResponse<unknown>> {
    // Find the user's tenant → country → workflow
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) throw new HttpError(400, 'Tenant not found');

    let workflow: any = null;

    // Try to find workflow by tenant's country code
    if (tenant.countryCode) {
      const country = await (this.prisma as any).country.findUnique({
        where: { code: tenant.countryCode },
      });
      if (country) {
        workflow = await (this.prisma as any).collecteWorkflow.findUnique({
          where: { countryId: country.id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      }
    }

    if (!workflow) {
      throw new HttpError(400, 'No workflow defined for your country. Please configure a workflow first.');
    }

    if (!workflow.isActive) {
      throw new HttpError(400, 'The workflow for your country is currently inactive.');
    }

    if (workflow.steps.length === 0) {
      throw new HttpError(400, 'The workflow has no steps configured.');
    }

    // Find the first validator for this user
    const validatorChains = await (this.prisma as any).collecteValidationChain.findMany({
      where: {
        userId: user.userId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
      include: { validator: true },
    });

    const firstStep = workflow.steps[0];
    let assigneeId: string | null = null;

    // If step 0 is data entry (canEdit=true), the submitter holds it first
    // Otherwise, look for a validator
    if (firstStep.canEdit && firstStep.stepOrder === 0) {
      // Step 0 is data entry — assignee is the submitter
      assigneeId = user.userId;
    } else if (validatorChains.length > 0) {
      assigneeId = validatorChains[0].validatorId;
    }

    // Calculate deadline
    const delayHours = firstStep.transmitDelayHours ?? workflow.defaultTransmitDelay;
    const deadline = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    // Create the instance
    const instance = await (this.prisma as any).collecteInstance.create({
      data: {
        workflowId: workflow.id,
        submissionId,
        formSubmissionId: opts?.formSubmissionId ?? null,
        currentStepOrder: 0,
        status: 'IN_PROGRESS',
        submittedBy: user.userId,
        currentDeadline: deadline,
        currentAssigneeId: assigneeId,
        priority: opts?.priority ?? 'NORMAL',
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        history: true,
      },
    });

    // Create initial history entry
    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: instance.id,
        action: 'submitted',
        toStep: 0,
        performedBy: user.userId,
        performedByName: user.email,
        toAssignee: assigneeId,
        isAutomatic: false,
      },
    });

    // Publish Kafka event
    await this.publishEvent('ms.collecte.workflow.submission.created.v1', {
      instanceId: instance.id,
      submissionId,
      workflowId: workflow.id,
      assigneeId,
      stepOrder: 0,
    }, user);

    // Re-fetch with history
    const result = await (this.prisma as any).collecteInstance.findUnique({
      where: { id: instance.id },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });

    return { data: result };
  }

  /** List workflow instances */
  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; status?: string; assignee?: string; priority?: string },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status.toUpperCase();
    if (query.assignee) where['currentAssigneeId'] = query.assignee;
    if (query.priority) where['priority'] = query.priority.toUpperCase();

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { currentDeadline: 'asc' }],
        include: {
          workflow: { include: { country: true } },
          submission: true,
        },
      }),
      (this.prisma as any).collecteInstance.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /** Get instance detail with full history */
  async findOne(id: string): Promise<ApiResponse<unknown>> {
    const instance = await (this.prisma as any).collecteInstance.findUnique({
      where: { id },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true } },
        submission: true,
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!instance) throw new HttpError(404, `Workflow instance ${id} not found`);
    return { data: instance };
  }

  /** Validate — advance to next step */
  async validate(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const instance = await this.getActiveInstance(id);
    const workflow = instance.workflow;
    const steps = workflow.steps;
    const currentStep = steps.find((s: any) => s.stepOrder === instance.currentStepOrder);

    if (!currentStep?.canValidate) {
      throw new HttpError(400, 'Validation is not allowed at this step');
    }

    if (workflow.requireComment && !dto.comment) {
      throw new HttpError(400, 'Comment is required for validation');
    }

    const nextStepOrder = instance.currentStepOrder + 1;
    const nextStep = steps.find((s: any) => s.stepOrder === nextStepOrder);

    // Find next validator
    let nextAssigneeId: string | null = null;
    if (nextStep) {
      if (dto.nextValidatorId) {
        nextAssigneeId = dto.nextValidatorId as string;
      } else {
        nextAssigneeId = await this.findNextValidator(
          instance.currentAssigneeId ?? user.userId,
          nextStep,
        );
      }
    }

    // Calculate next deadline
    let nextDeadline: Date | null = null;
    if (nextStep) {
      const delayHours = nextStep.transmitDelayHours ?? workflow.defaultTransmitDelay;
      nextDeadline = new Date(Date.now() + delayHours * 60 * 60 * 1000);
    }

    const isCompleted = !nextStep;

    // Update instance
    const updated = await (this.prisma as any).collecteInstance.update({
      where: { id },
      data: {
        currentStepOrder: isCompleted ? instance.currentStepOrder : nextStepOrder,
        status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isCompleted ? new Date() : null,
        currentDeadline: nextDeadline,
        currentAssigneeId: nextAssigneeId,
        isOverdue: false,
      },
    });

    // Create history entry
    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: id,
        action: 'validated',
        fromStep: instance.currentStepOrder,
        toStep: isCompleted ? null : nextStepOrder,
        performedBy: user.userId,
        performedByName: user.email,
        comment: dto.comment ? { text: dto.comment } : null,
        fromAssignee: instance.currentAssigneeId,
        toAssignee: nextAssigneeId,
        isAutomatic: false,
      },
    });

    // Publish event
    const eventType = isCompleted
      ? 'ms.collecte.workflow.submission.completed.v1'
      : 'ms.collecte.workflow.step.validated.v1';
    await this.publishEvent(eventType, {
      instanceId: id,
      stepOrder: instance.currentStepOrder,
      nextStepOrder: isCompleted ? null : nextStepOrder,
      validatedBy: user.userId,
      nextAssigneeId,
    }, user);

    return this.findOne(id);
  }

  /** Reject the submission */
  async reject(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const instance = await this.getActiveInstance(id);
    const currentStep = instance.workflow.steps.find((s: any) => s.stepOrder === instance.currentStepOrder);

    if (!currentStep?.canReject && !instance.workflow.allowReject) {
      throw new HttpError(400, 'Rejection is not allowed at this step');
    }

    await (this.prisma as any).collecteInstance.update({
      where: { id },
      data: {
        status: 'REJECTED',
        currentAssigneeId: null,
        currentDeadline: null,
      },
    });

    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: id,
        action: 'rejected',
        fromStep: instance.currentStepOrder,
        performedBy: user.userId,
        performedByName: user.email,
        reason: dto.reason as string,
        comment: dto.comment ? { text: dto.comment } : null,
        fromAssignee: instance.currentAssigneeId,
        isAutomatic: false,
      },
    });

    await this.publishEvent('ms.collecte.workflow.submission.rejected.v1', {
      instanceId: id,
      rejectedBy: user.userId,
      reason: dto.reason,
      submittedBy: instance.submittedBy,
    }, user);

    return this.findOne(id);
  }

  /** Return for correction */
  async returnForCorrection(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const instance = await this.getActiveInstance(id);
    const currentStep = instance.workflow.steps.find((s: any) => s.stepOrder === instance.currentStepOrder);

    if (!currentStep?.canReturnForCorrection && !instance.workflow.allowReturnForCorrection) {
      throw new HttpError(400, 'Return for correction is not allowed at this step');
    }

    // Return to step 0 (the original submitter)
    const returnToStep = 0;

    await (this.prisma as any).collecteInstance.update({
      where: { id },
      data: {
        status: 'RETURNED',
        currentStepOrder: returnToStep,
        currentAssigneeId: instance.submittedBy,
        currentDeadline: new Date(Date.now() + instance.workflow.defaultTransmitDelay * 60 * 60 * 1000),
        isOverdue: false,
      },
    });

    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: id,
        action: 'returned',
        fromStep: instance.currentStepOrder,
        toStep: returnToStep,
        performedBy: user.userId,
        performedByName: user.email,
        reason: dto.reason as string,
        comment: dto.comment ? { text: dto.comment } : null,
        fromAssignee: instance.currentAssigneeId,
        toAssignee: instance.submittedBy,
        isAutomatic: false,
      },
    });

    await this.publishEvent('ms.collecte.workflow.submission.returned.v1', {
      instanceId: id,
      returnedBy: user.userId,
      reason: dto.reason,
      submittedBy: instance.submittedBy,
    }, user);

    return this.findOne(id);
  }

  /** Reassign to another validator */
  async reassign(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const instance = await this.getActiveInstance(id);
    const newAssigneeId = dto.newAssigneeId as string;

    await (this.prisma as any).collecteInstance.update({
      where: { id },
      data: { currentAssigneeId: newAssigneeId },
    });

    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: id,
        action: 'reassigned',
        fromStep: instance.currentStepOrder,
        toStep: instance.currentStepOrder,
        performedBy: user.userId,
        performedByName: user.email,
        reason: (dto.reason as string) ?? null,
        fromAssignee: instance.currentAssigneeId,
        toAssignee: newAssigneeId,
        isAutomatic: false,
      },
    });

    return this.findOne(id);
  }

  /** Add comment */
  async addComment(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const instance = await (this.prisma as any).collecteInstance.findUnique({ where: { id } });
    if (!instance) throw new HttpError(404, `Workflow instance ${id} not found`);

    await (this.prisma as any).collecteHistory.create({
      data: {
        instanceId: id,
        action: 'commented',
        fromStep: instance.currentStepOrder,
        toStep: instance.currentStepOrder,
        performedBy: user.userId,
        performedByName: user.email,
        comment: { text: dto.comment },
        attachments: dto.attachments ?? null,
        isAutomatic: false,
      },
    });

    return this.findOne(id);
  }

  /** Get instance history */
  async getHistory(id: string): Promise<ApiResponse<unknown>> {
    const history = await (this.prisma as any).collecteHistory.findMany({
      where: { instanceId: id },
      orderBy: { createdAt: 'asc' },
    });
    return { data: history };
  }

  // ── Dashboard ──

  /** My tasks — instances assigned to me */
  async getMyTasks(user: AuthenticatedUser, query: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      currentAssigneeId: user.userId,
      status: { in: ['IN_PROGRESS', 'RETURNED'] },
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { currentDeadline: 'asc' }],
        include: {
          workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true } },
          submission: true,
        },
      }),
      (this.prisma as any).collecteInstance.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /** My submissions — instances I submitted */
  async getMySubmissions(user: AuthenticatedUser, query: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { submittedBy: user.userId };

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true } },
          submission: true,
          history: { orderBy: { createdAt: 'asc' } },
        },
      }),
      (this.prisma as any).collecteInstance.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /** Dashboard stats */
  async getStats(user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const [
      pendingCount,
      validatedToday,
      overdueCount,
      completedThisMonth,
      totalThisMonth,
      byStatus,
    ] = await Promise.all([
      // My pending tasks
      (this.prisma as any).collecteInstance.count({
        where: {
          currentAssigneeId: user.userId,
          status: { in: ['IN_PROGRESS', 'RETURNED'] },
        },
      }),
      // Validated today (by me)
      (this.prisma as any).collecteHistory.count({
        where: {
          performedBy: user.userId,
          action: 'validated',
          performedAt: { gte: today },
        },
      }),
      // Overdue instances assigned to me
      (this.prisma as any).collecteInstance.count({
        where: {
          currentAssigneeId: user.userId,
          status: { in: ['IN_PROGRESS', 'RETURNED'] },
          currentDeadline: { lt: now },
        },
      }),
      // Completed this month (globally)
      (this.prisma as any).collecteInstance.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
      // Total this month
      (this.prisma as any).collecteInstance.count({
        where: {
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
      // By status
      Promise.all([
        (this.prisma as any).collecteInstance.count({ where: { status: 'IN_PROGRESS' } }),
        (this.prisma as any).collecteInstance.count({ where: { status: 'COMPLETED' } }),
        (this.prisma as any).collecteInstance.count({ where: { status: 'REJECTED' } }),
        (this.prisma as any).collecteInstance.count({ where: { status: 'RETURNED' } }),
      ]),
    ]);

    const completionRate = totalThisMonth > 0
      ? Math.round((completedThisMonth / totalThisMonth) * 100)
      : 0;

    return {
      data: {
        pendingValidation: pendingCount,
        validatedToday,
        overdue: overdueCount,
        completionRate,
        byStatus: {
          inProgress: byStatus[0],
          completed: byStatus[1],
          rejected: byStatus[2],
          returned: byStatus[3],
        },
      },
    };
  }

  /** Overdue instances */
  async getOverdue(query: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      status: { in: ['IN_PROGRESS', 'RETURNED'] },
      currentDeadline: { lt: new Date() },
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).collecteInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { currentDeadline: 'asc' },
        include: {
          workflow: { include: { country: true } },
          submission: true,
        },
      }),
      (this.prisma as any).collecteInstance.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /** Timeline for a specific instance */
  async getTimeline(id: string): Promise<ApiResponse<unknown>> {
    const instance = await (this.prisma as any).collecteInstance.findUnique({
      where: { id },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!instance) throw new HttpError(404, `Workflow instance ${id} not found`);

    // Build timeline with step info
    const steps = instance.workflow.steps;
    const timeline = instance.history.map((h: any) => {
      const step = steps.find((s: any) => s.stepOrder === (h.toStep ?? h.fromStep));
      return {
        ...h,
        stepName: step?.name ?? null,
        levelType: step?.levelType ?? null,
      };
    });

    return {
      data: {
        instance,
        timeline,
        currentStep: steps.find((s: any) => s.stepOrder === instance.currentStepOrder),
        totalSteps: steps.length,
        progress: steps.length > 0
          ? Math.round((instance.currentStepOrder / (steps.length - 1)) * 100)
          : 0,
      },
    };
  }

  // ── Auto-transmit cron logic ──

  async processAutoTransmit(): Promise<number> {
    const now = new Date();

    // Find overdue instances
    const overdueInstances = await (this.prisma as any).collecteInstance.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'RETURNED'] },
        currentDeadline: { lt: now },
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
      take: 100,
    });

    let processed = 0;

    for (const instance of overdueInstances) {
      try {
        const workflow = instance.workflow;
        if (!workflow.autoTransmitEnabled) continue;

        const nextStepOrder = instance.currentStepOrder + 1;
        const nextStep = workflow.steps.find((s: any) => s.stepOrder === nextStepOrder);

        const action = workflow.autoValidateEnabled ? 'auto_validated' : 'auto_transmitted';

        if (nextStep) {
          // Find next validator
          const nextAssigneeId = await this.findNextValidator(
            instance.currentAssigneeId ?? instance.submittedBy,
            nextStep,
          );

          const delayHours = nextStep.transmitDelayHours ?? workflow.defaultTransmitDelay;
          const deadline = new Date(Date.now() + delayHours * 60 * 60 * 1000);

          await (this.prisma as any).collecteInstance.update({
            where: { id: instance.id },
            data: {
              currentStepOrder: nextStepOrder,
              currentDeadline: deadline,
              currentAssigneeId: nextAssigneeId,
              isOverdue: true,
            },
          });

          await (this.prisma as any).collecteHistory.create({
            data: {
              instanceId: instance.id,
              action,
              fromStep: instance.currentStepOrder,
              toStep: nextStepOrder,
              comment: {
                text: `Automatically ${action.replace('_', ' ')} after deadline expired`,
              },
              fromAssignee: instance.currentAssigneeId,
              toAssignee: nextAssigneeId,
              isAutomatic: true,
            },
          });
        } else {
          // Last step — auto-complete if autoValidateEnabled
          if (workflow.autoValidateEnabled) {
            await (this.prisma as any).collecteInstance.update({
              where: { id: instance.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                isOverdue: true,
              },
            });

            await (this.prisma as any).collecteHistory.create({
              data: {
                instanceId: instance.id,
                action: 'auto_validated',
                fromStep: instance.currentStepOrder,
                comment: { text: 'Automatically validated at final step after deadline expired' },
                isAutomatic: true,
              },
            });
          }
        }

        processed++;
      } catch (err) {
        console.error(`[WorkflowEngine] Failed to auto-transmit instance ${instance.id}:`, err);
      }
    }

    return processed;
  }

  /** Escalation: find instances that are 2x overdue */
  async processEscalation(): Promise<number> {
    const now = new Date();
    let escalated = 0;

    // Find instances where deadline is more than 2x the configured delay
    const instances = await (this.prisma as any).collecteInstance.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'RETURNED'] },
        currentDeadline: { lt: now },
        isOverdue: true, // Already auto-transmitted once
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
      take: 50,
    });

    for (const instance of instances) {
      try {
        // Check if already escalated recently
        const recentEscalation = await (this.prisma as any).collecteHistory.findFirst({
          where: {
            instanceId: instance.id,
            action: 'escalated',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (recentEscalation) continue;

        // Try to find a backup validator
        if (instance.currentAssigneeId) {
          const chain = await (this.prisma as any).collecteValidationChain.findFirst({
            where: {
              validatorId: instance.currentAssigneeId,
              isActive: true,
              backupValidatorId: { not: null },
            },
          });

          if (chain?.backupValidatorId) {
            await (this.prisma as any).collecteInstance.update({
              where: { id: instance.id },
              data: { currentAssigneeId: chain.backupValidatorId },
            });
          }
        }

        await (this.prisma as any).collecteHistory.create({
          data: {
            instanceId: instance.id,
            action: 'escalated',
            fromStep: instance.currentStepOrder,
            comment: { text: 'Escalated due to extended overdue status' },
            fromAssignee: instance.currentAssigneeId,
            isAutomatic: true,
          },
        });

        escalated++;
      } catch (err) {
        console.error(`[WorkflowEngine] Failed to escalate instance ${instance.id}:`, err);
      }
    }

    return escalated;
  }

  // ── Private helpers ──

  private async getActiveInstance(id: string): Promise<any> {
    const instance = await (this.prisma as any).collecteInstance.findUnique({
      where: { id },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    if (!instance) throw new HttpError(404, `Workflow instance ${id} not found`);
    if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(instance.status)) {
      throw new HttpError(400, `Cannot perform action on instance with status: ${instance.status}`);
    }
    return instance;
  }

  private async findNextValidator(currentUserId: string, nextStep: any): Promise<string | null> {
    // 1. Try ValidationChain
    const chains = await (this.prisma as any).collecteValidationChain.findMany({
      where: {
        userId: currentUserId,
        levelType: nextStep.levelType,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    if (chains.length > 0) {
      return chains[0].validatorId;
    }

    // 2. Fallback: find any user at the next level type
    // This is a simplified fallback - in production would use geo matching
    return null;
  }

  private async publishEvent(
    topic: string,
    payload: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(
        topic,
        (payload['instanceId'] as string) ?? uuidv4(),
        payload,
        headers,
      );
    } catch (error) {
      console.error(`[WorkflowEngine] Failed to publish event to ${topic}:`, error);
    }
  }
}

// ── Collection Campaign Service ──

/**
 * Hierarchy level rank — higher number = higher authority.
 * Used to enforce: "campaigns created at a higher level cannot be modified by a lower level".
 */
const LEVEL_RANK: Record<string, number> = {
  MEMBER_STATE: 1,
  COUNTRY: 1, // alias used in some ownerType values
  REC: 2,
  CONTINENTAL: 3,
};

export class CollectionCampaignService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const isPermanent = !!dto.isPermanent;
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (!isPermanent) {
      if (!dto.startDate || !dto.endDate) {
        throw new HttpError(400, 'startDate and endDate are required for scheduled campaigns');
      }
      startDate = new Date(dto.startDate as string);
      endDate = new Date(dto.endDate as string);
      if (endDate <= startDate) {
        throw new HttpError(400, 'endDate must be after startDate');
      }
    }

    const campaign = await (this.prisma as any).collectionCampaign.create({
      data: {
        code: dto.code as string,
        name: dto.name,
        description: dto.description ?? null,
        domain: dto.domain as string,
        formTemplateId: dto.formTemplateId as string,
        formTemplateIds: Array.isArray(dto.formTemplateIds) ? dto.formTemplateIds : (dto.formTemplateId ? [dto.formTemplateId as string] : []),
        isPermanent,
        startDate,
        endDate,
        autoActivate: !isPermanent && !!dto.autoActivate,
        autoClose: !isPermanent && !!dto.autoClose,
        targetCountries: dto.targetCountries ?? null,
        targetRecIds: dto.targetRecIds ?? null,
        targetAdminAreas: dto.targetAdminAreas ?? null,
        targetSubmissions: (dto.targetSubmissions as number) ?? null,
        targetPerAgent: (dto.targetPerAgent as number) ?? null,
        frequency: isPermanent ? 'permanent' : ((dto.frequency as string) ?? null),
        scope: (dto.scope as string) ?? 'continental',
        ownerId: user.tenantId,
        ownerType: user.tenantLevel ?? 'CONTINENTAL',
        sendReminders: dto.sendReminders ?? true,
        reminderDaysBefore: (dto.reminderDaysBefore as number) ?? 3,
        metadata: dto.metadata ?? null,
        createdBy: user.userId,
      },
      include: { formTemplate: true, assignments: true },
    });

    return { data: campaign };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; status?: string; domain?: string },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = await this.buildVisibilityFilter(user, query);

    const [rawData, total] = await Promise.all([
      (this.prisma as any).collectionCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          formTemplate: { select: { id: true, name: true, domain: true } },
          assignments: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        },
      }),
      (this.prisma as any).collectionCampaign.count({ where }),
    ]);

    // Enrich each campaign with real submission stats from submissions table
    // Campaign ID may exist in both campaigns + collection_campaigns tables (same UUID)
    const data = await Promise.all(rawData.map(async (c: any) => {
      const fromAssignments = (c.assignments ?? []).reduce(
        (sum: number, a: any) => sum + (a.completedSubmissions ?? 0), 0,
      );

      // Check if submissions exist for this campaign ID (same ID shared with Campaign table)
      const submissionCount = await (this.prisma as any).submission.count({ where: { campaignId: c.id } }).catch(() => 0);

      let totalSubmissions = 0;
      let validated = 0;
      let rejected = 0;
      let pending = 0;
      let distinctCountries: string[] = [];

      if (submissionCount > 0) {
        // Real submissions exist — get detailed stats
        const [val, rej, countriesRaw] = await Promise.all([
          (this.prisma as any).submission.count({ where: { campaignId: c.id, status: 'VALIDATED' } }),
          (this.prisma as any).submission.count({ where: { campaignId: c.id, status: 'REJECTED' } }),
          (this.prisma as any).$queryRawUnsafe(
            `SELECT DISTINCT loc AS country FROM (
               SELECT CASE
                 WHEN data->>'admin_location' LIKE '%/%' THEN trim(split_part(data->>'admin_location', '/', 1))
                 ELSE data->>'admin_location'
               END AS loc
               FROM public.submissions
               WHERE campaign_id = $1::uuid
                 AND data->>'admin_location' IS NOT NULL
             ) sub
             WHERE loc IN (
               'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cameroon','CAR',
               'Cape Verde','Central African Republic','Chad','Comoros','Congo Brazaville',
               'Congo (Rep. of)','Congo DR','DR Congo','DRC',
               'Cote d''Ivoire','Côte d''Ivoire','Djibouti','Egypt','Equatorial Guinea',
               'Eritrea','Eswatini','Ethiopia','Gabon','Gambia','The Gambia','Ghana','Guinea',
               'Guinea Conakry','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya',
               'Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique',
               'Namibia','Niger','Nigeria','Rwanda','Sao Tome','Senegal','Seychelles',
               'Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Swaziland',
               'Tanzania','Tchad','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
               'ZA','KE','ET','NG','GH','TZ','UG','ZW','BW','MZ','SD','SN','BJ','CM','TD',
               'CD','CG','DJ','EG','ER','GA','GM','GN','GW','LR','LS','LY','MG','ML','MR',
               'MU','MW','NA','NE','RW','SC','SL','SO','SS','SZ','TN','DZ','AO','BF','BI',
               'CF','CI','CV','GQ','KM','MA','ST','TG','ZM'
             )`,
            c.id,
          ),
        ]);
        totalSubmissions = Math.max(submissionCount, c.metadata?.importedRows ?? 0);
        validated = val;
        rejected = rej;
        pending = submissionCount - val - rej;
        distinctCountries = (countriesRaw as any[]).map((r: any) => r.country).filter(Boolean);
      } else {
        totalSubmissions = fromAssignments || (c.metadata?.importedRows ?? 0);
      }

      return {
        ...c,
        totalSubmissions,
        progress: {
          totalSubmissions,
          validated,
          rejected,
          pending,
          completionRate: c.targetSubmissions
            ? Math.round((totalSubmissions / c.targetSubmissions) * 100)
            : 0,
          totalAgents: (c.assignments ?? []).length,
          distinctCountries,
        },
      };
    }));

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const campaign = await (this.prisma as any).collectionCampaign.findUnique({
      where: { id },
      include: {
        formTemplate: true,
        assignments: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!campaign) throw new HttpError(404, `Campaign ${id} not found`);

    // Visibility check
    const canSee = await this.canAccessCampaign(user, campaign);
    if (!canSee) throw new HttpError(404, `Campaign ${id} not found`);

    // Calculate progress — from real submissions or assignments/metadata
    const totalAssigned = campaign.assignments.length;
    const totalCompleted = campaign.assignments.filter((a: any) => a.status === 'COMPLETED').length;
    const fromAssignments = campaign.assignments.reduce((sum: number, a: any) => sum + (a.completedSubmissions ?? 0), 0);

    // Check if submissions exist for this campaign ID (same ID shared with Campaign table)
    const submissionCount = await (this.prisma as any).submission.count({ where: { campaignId: id } }).catch(() => 0);

    let totalSubmissions = 0;
    let validated = 0;
    let rejected = 0;
    let pending = 0;
    let distinctCountries: string[] = [];

    if (submissionCount > 0) {
      const [val, rej, countriesRaw] = await Promise.all([
        (this.prisma as any).submission.count({ where: { campaignId: id, status: 'VALIDATED' } }),
        (this.prisma as any).submission.count({ where: { campaignId: id, status: 'REJECTED' } }),
        (this.prisma as any).$queryRawUnsafe(
          `SELECT DISTINCT loc AS country FROM (
             SELECT CASE
               WHEN data->>'admin_location' LIKE '%/%' THEN trim(split_part(data->>'admin_location', '/', 1))
               ELSE data->>'admin_location'
             END AS loc
             FROM public.submissions
             WHERE campaign_id = $1::uuid
               AND data->>'admin_location' IS NOT NULL
           ) sub
           WHERE loc IN (
             'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cameroon','CAR',
             'Cape Verde','Central African Republic','Chad','Comoros','Congo Brazaville',
             'Congo (Rep. of)','Congo DR','DR Congo','DRC',
             'Cote d''Ivoire','Côte d''Ivoire','Djibouti','Egypt','Equatorial Guinea',
             'Eritrea','Eswatini','Ethiopia','Gabon','Gambia','The Gambia','Ghana','Guinea',
             'Guinea Conakry','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya',
             'Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique',
             'Namibia','Niger','Nigeria','Rwanda','Sao Tome','Senegal','Seychelles',
             'Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Swaziland',
             'Tanzania','Tchad','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
             'ZA','KE','ET','NG','GH','TZ','UG','ZW','BW','MZ','SD','SN','BJ','CM','TD',
             'CD','CG','DJ','EG','ER','GA','GM','GN','GW','LR','LS','LY','MG','ML','MR',
             'MU','MW','NA','NE','RW','SC','SL','SO','SS','SZ','TN','DZ','AO','BF','BI',
             'CF','CI','CV','GQ','KM','MA','ST','TG','ZM'
           )`,
          id,
        ),
      ]);
      totalSubmissions = Math.max(submissionCount, campaign.metadata?.importedRows ?? 0);
      validated = val;
      rejected = rej;
      pending = submissionCount - val - rej;
      distinctCountries = (countriesRaw as any[]).map((r: any) => r.country).filter(Boolean);
    } else {
      totalSubmissions = fromAssignments || (campaign.metadata?.importedRows ?? 0);
    }

    return {
      data: {
        ...campaign,
        progress: {
          totalAgents: totalAssigned,
          completedAgents: totalCompleted,
          totalSubmissions,
          validated,
          rejected,
          pending,
          targetSubmissions: campaign.targetSubmissions,
          completionRate: campaign.targetSubmissions
            ? Math.round((totalSubmissions / campaign.targetSubmissions) * 100)
            : 0,
          distinctCountries,
        },
      },
    };
  }

  async update(id: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).collectionCampaign.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Campaign ${id} not found`);

    await this.assertCanEdit(user, existing);

    const data: Record<string, unknown> = {};
    for (const key of [
      'name', 'description', 'targetCountries', 'targetRecIds', 'targetAdminAreas',
      'excludedCountries', 'excludedRecIds',
      'targetSubmissions', 'targetPerAgent', 'frequency', 'sendReminders', 'reminderDaysBefore', 'metadata', 'formTemplateIds',
      'formTemplateId', 'isPermanent', 'autoActivate', 'autoClose',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    // Handle dates — allow setting to null for permanent campaigns
    if (dto.startDate !== undefined) data['startDate'] = dto.startDate ? new Date(dto.startDate as string) : null;
    if (dto.endDate !== undefined) data['endDate'] = dto.endDate ? new Date(dto.endDate as string) : null;

    const campaign = await (this.prisma as any).collectionCampaign.update({
      where: { id },
      data,
      include: { formTemplate: true, assignments: true },
    });

    return { data: campaign };
  }

  async updateStatus(id: string, status: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).collectionCampaign.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!existing) throw new HttpError(404, `Campaign ${id} not found`);

    await this.assertCanEdit(user, existing);

    const campaign = await (this.prisma as any).collectionCampaign.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: { formTemplate: true, assignments: true },
    });

    // Publish Kafka events for status changes
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'ACTIVE') {
      await this.publishCampaignEvent(campaign, user, 'ACTIVATED');
    } else if (upperStatus === 'COMPLETED') {
      await this.publishCampaignEvent(campaign, user, 'COMPLETED');
    }

    return { data: campaign };
  }

  /**
   * Publish campaign lifecycle events to Kafka for the message service to pick up.
   * The message consumer listens for campaign.activated/completed events
   * and sends notifications to all users in the target countries.
   */
  private async publishCampaignEvent(
    campaign: Record<string, unknown>,
    user: AuthenticatedUser,
    action: 'ACTIVATED' | 'COMPLETED',
  ): Promise<void> {
    const topic = action === 'ACTIVATED'
      ? 'ms.collecte.campaign.activated.v1'
      : 'ms.collecte.campaign.completed.v1';

    const name = campaign.name as Record<string, string> | string;
    const campaignName = typeof name === 'string' ? name : (name?.en || name?.fr || 'Campaign');

    const payload = {
      campaignId: campaign.id,
      campaignName,
      domain: campaign.domain,
      status: action,
      targetCountries: campaign.targetCountries,
      isPermanent: campaign.isPermanent ?? false,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      scope: campaign.scope,
    };

    try {
      await Promise.race([
        this.kafkaProducer.send(
          topic,
          campaign.id as string,
          payload,
          {
            correlationId: crypto.randomUUID(),
            sourceService: 'collecte-service',
            tenantId: user.tenantId,
            userId: user.userId,
            schemaVersion: '1',
            timestamp: new Date().toISOString(),
          },
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), 5000)),
      ]);
    } catch (err) {
      console.error(`[CollectionCampaignService] Kafka publish ${topic} failed:`, err);
    }
  }

  /**
   * Scheduler — called periodically (e.g., every 5 minutes via cron route).
   * Auto-activates PLANNED campaigns whose startDate has arrived (when autoActivate=true).
   * Auto-closes ACTIVE campaigns whose endDate has passed (when autoClose=true).
   * Returns counts of campaigns transitioned.
   */
  async runScheduler(): Promise<{ activated: number; completed: number }> {
    const now = new Date();
    const today = new Date(now.toISOString().slice(0, 10)); // midnight UTC

    // 1. Auto-activate: PLANNED + autoActivate + startDate <= today
    const toActivate = await (this.prisma as any).collectionCampaign.findMany({
      where: {
        status: 'PLANNED',
        autoActivate: true,
        isPermanent: false,
        startDate: { lte: today },
      },
    });

    let activated = 0;
    for (const campaign of toActivate) {
      try {
        await (this.prisma as any).collectionCampaign.update({
          where: { id: campaign.id },
          data: { status: 'ACTIVE' },
        });
        // Publish activation event for notifications
        const systemUser = {
          userId: campaign.createdBy || 'system',
          tenantId: campaign.ownerId || '00000000-0000-4000-a000-000000000001',
          tenantLevel: campaign.ownerType || 'CONTINENTAL',
          role: 'SUPER_ADMIN',
          email: 'system@au-aris.org',
        } as AuthenticatedUser;
        await this.publishCampaignEvent(campaign, systemUser, 'ACTIVATED');
        activated++;
        console.log(`[Scheduler] Auto-activated campaign ${campaign.code} (${campaign.id})`);
      } catch (err) {
        console.error(`[Scheduler] Failed to auto-activate ${campaign.id}:`, err);
      }
    }

    // 2. Auto-close: ACTIVE + autoClose + endDate < today
    const toComplete = await (this.prisma as any).collectionCampaign.findMany({
      where: {
        status: 'ACTIVE',
        autoClose: true,
        isPermanent: false,
        endDate: { lt: today },
      },
    });

    let completed = 0;
    for (const campaign of toComplete) {
      try {
        await (this.prisma as any).collectionCampaign.update({
          where: { id: campaign.id },
          data: { status: 'COMPLETED' },
        });
        const systemUser = {
          userId: campaign.createdBy || 'system',
          tenantId: campaign.ownerId || '00000000-0000-4000-a000-000000000001',
          tenantLevel: campaign.ownerType || 'CONTINENTAL',
          role: 'SUPER_ADMIN',
          email: 'system@au-aris.org',
        } as AuthenticatedUser;
        await this.publishCampaignEvent(campaign, systemUser, 'COMPLETED');
        completed++;
        console.log(`[Scheduler] Auto-completed campaign ${campaign.code} (${campaign.id})`);
      } catch (err) {
        console.error(`[Scheduler] Failed to auto-complete ${campaign.id}:`, err);
      }
    }

    return { activated, completed };
  }

  async deleteCampaign(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await (this.prisma as any).collectionCampaign.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!existing) throw new HttpError(404, `Campaign ${id} not found`);

    await this.assertCanEdit(user, existing);

    // Delete assignments first (FK constraint)
    if (existing.assignments?.length) {
      await (this.prisma as any).campaignAssignment.deleteMany({ where: { campaignId: id } });
    }

    await (this.prisma as any).collectionCampaign.delete({ where: { id } });
  }

  async addAssignment(campaignId: string, dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const campaign = await (this.prisma as any).collectionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new HttpError(404, `Campaign ${campaignId} not found`);

    await this.assertCanEdit(user, campaign);

    const assignment = await (this.prisma as any).campaignAssignment.create({
      data: {
        campaignId,
        userId: dto.userId as string,
        countryCode: (dto.countryCode as string) ?? null,
        adminLevel1: (dto.adminLevel1 as string) ?? null,
        adminLevel2: (dto.adminLevel2 as string) ?? null,
        adminLevel3: (dto.adminLevel3 as string) ?? null,
        adminLevel4: (dto.adminLevel4 as string) ?? null,
        adminLevel5: (dto.adminLevel5 as string) ?? null,
        targetSubmissions: (dto.targetSubmissions as number) ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate as string) : null,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });

    return { data: assignment };
  }

  async removeAssignment(campaignId: string, assignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await (this.prisma as any).collectionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new HttpError(404, `Campaign ${campaignId} not found`);

    await this.assertCanEdit(user, campaign);

    const assignment = await (this.prisma as any).campaignAssignment.findFirst({
      where: { id: assignId, campaignId },
    });
    if (!assignment) throw new HttpError(404, `Assignment ${assignId} not found`);
    await (this.prisma as any).campaignAssignment.delete({ where: { id: assignId } });
  }

  async getProgress(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    return this.findOne(id, user);
  }

  // ── Visibility ──────────────────────────────────────────────────────

  /**
   * Build Prisma WHERE filter for campaign listing.
   *
   * Visibility rules:
   *  - CONTINENTAL → sees everything
   *  - REC → own campaigns + campaigns targeting this REC (targetRecIds) +
   *          campaigns targeting any of the REC's member countries (targetCountries)
   *  - MEMBER_STATE → own campaigns + campaigns targeting this country (targetCountries)
   */
  private async buildVisibilityFilter(
    user: AuthenticatedUser,
    query: { status?: string; domain?: string },
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};

    // Function-based filtering: campaigns with metadata.targetFunctionId
    // are only visible to users assigned to that function (or SUPER_ADMIN)
    if (user.role !== 'SUPER_ADMIN' && user.tenantLevel === TenantLevel.CONTINENTAL) {
      // Get user's function IDs
      const userFunctions = await (this.prisma as any).userFunction.findMany({
        where: { userId: user.userId },
        select: { functionId: true },
      }).catch(() => []);
      const userFunctionIds = new Set(userFunctions.map((uf: any) => uf.functionId));

      // Find campaigns with targetFunctionId that the user does NOT have
      const restrictedCampaigns = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id FROM public.collection_campaigns
         WHERE metadata->>'targetFunctionId' IS NOT NULL
           AND metadata->>'targetFunctionId' NOT IN (${
             userFunctionIds.size > 0
               ? [...userFunctionIds].map((id) => `'${id}'`).join(',')
               : "'none'"
           })`,
      ).catch(() => []);
      const excludeIds = (restrictedCampaigns as any[]).map((r: any) => r.id);

      if (excludeIds.length > 0) {
        where['id'] = { notIn: excludeIds };
      }
    }

    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: user.tenantId },
        select: { level: true, countryCode: true },
      });

      if (tenant?.level === 'MEMBER_STATE' && tenant.countryCode) {
        // MS sees: own campaigns + campaigns targeting this country
        // targetCountries is Json? (not String[]), so use Prisma JSON filter
        const cc = tenant.countryCode.toUpperCase();
        where['OR'] = [
          { ownerId: user.tenantId },
          { targetCountries: { path: [], array_contains: [cc] } },
        ];
      } else if (tenant?.level === 'REC') {
        // REC sees: own + targeting this REC + targeting any member country
        const memberTenants = await (this.prisma as any).tenant.findMany({
          where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
          select: { countryCode: true },
        });
        const countryCodes: string[] = memberTenants
          .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
          .filter(Boolean);

        const conditions: Record<string, unknown>[] = [
          { ownerId: user.tenantId },
          { targetRecIds: { path: [], array_contains: [user.tenantId] } },
        ];
        for (const code of countryCodes) {
          conditions.push({ targetCountries: { path: [], array_contains: [code] } });
        }

        where['OR'] = conditions;
      } else {
        // Fallback: strict tenant isolation
        where['ownerId'] = user.tenantId;
      }
    }

    if (query.status) where['status'] = query.status.toUpperCase();
    if (query.domain) where['domain'] = query.domain; // Backward compat: reads legacy domain field, prefer targets[]

    return where;
  }

  /**
   * Check if a user can see a campaign (used for findOne).
   */
  private async canAccessCampaign(
    user: AuthenticatedUser,
    campaign: { ownerId: string | null; targetCountries: unknown; targetRecIds: unknown; excludedCountries?: unknown; excludedRecIds?: unknown; metadata?: any },
  ): Promise<boolean> {
    // Function-restricted campaigns: check user has the required function
    const targetFunctionId = campaign.metadata?.targetFunctionId;
    if (targetFunctionId && user.role !== 'SUPER_ADMIN') {
      const hasFunction = await (this.prisma as any).userFunction.findFirst({
        where: { userId: user.userId, functionId: targetFunctionId },
      }).catch(() => null);
      if (!hasFunction) return false;
    }
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return true;
    if (campaign.ownerId === user.tenantId) return true;

    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: user.tenantId },
      select: { level: true, countryCode: true },
    });
    if (!tenant) return false;

    const targetCountries = Array.isArray(campaign.targetCountries)
      ? (campaign.targetCountries as string[]).map((c: string) => c.toUpperCase())
      : [];
    const targetRecIds = Array.isArray(campaign.targetRecIds)
      ? (campaign.targetRecIds as string[])
      : [];

    const excludedCountries = Array.isArray(campaign.excludedCountries)
      ? (campaign.excludedCountries as string[]).map((c: string) => c.toUpperCase())
      : [];
    const excludedRecIds = Array.isArray(campaign.excludedRecIds)
      ? (campaign.excludedRecIds as string[])
      : [];

    if (tenant.level === 'MEMBER_STATE' && tenant.countryCode) {
      const cc = tenant.countryCode.toUpperCase();
      if (!targetCountries.includes(cc)) return false;
      // Check exclusion
      if (excludedCountries.includes(cc)) return false;
      return true;
    }

    if (tenant.level === 'REC') {
      // REC can see if it is directly targeted
      if (targetRecIds.includes(user.tenantId)) {
        // Check exclusion
        if (excludedRecIds.includes(user.tenantId)) return false;
        return true;
      }

      // Or if any of its member countries are targeted (and not excluded)
      const memberTenants = await (this.prisma as any).tenant.findMany({
        where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
        select: { countryCode: true },
      });
      const memberCodes: string[] = memberTenants
        .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
        .filter(Boolean);
      return targetCountries.some((c: string) => memberCodes.includes(c) && !excludedCountries.includes(c));
    }

    return false;
  }

  // ── Editability ─────────────────────────────────────────────────────

  /**
   * Assert the user can edit a campaign; throws 403 if not.
   *
   * Rules:
   *  - CONTINENTAL can edit everything
   *  - A lower level CANNOT modify a campaign created at a higher level
   *  - Same level: can only edit own campaigns
   *  - Higher level can edit lower level's campaigns within their scope
   *    (REC can edit campaigns created by their member states)
   */
  private async assertCanEdit(
    user: AuthenticatedUser,
    campaign: { ownerId: string | null; ownerType: string },
  ): Promise<void> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;

    const userRank = LEVEL_RANK[user.tenantLevel?.toUpperCase() ?? ''] ?? 0;
    const ownerRank = LEVEL_RANK[campaign.ownerType?.toUpperCase() ?? ''] ?? 0;

    // Lower level cannot modify higher-level campaigns
    if (userRank < ownerRank) {
      throw new HttpError(
        403,
        `Cannot modify a campaign created at ${campaign.ownerType} level. ` +
        `Only users at that level or above can edit it.`,
      );
    }

    // Same or higher level: owner can always edit
    if (campaign.ownerId === user.tenantId) return;

    // REC editing a member state's campaign: check parent-child
    if (
      user.tenantLevel === TenantLevel.REC &&
      (campaign.ownerType?.toUpperCase() === 'MEMBER_STATE' || campaign.ownerType?.toUpperCase() === 'COUNTRY')
    ) {
      const ownerTenant = await (this.prisma as any).tenant.findUnique({
        where: { id: campaign.ownerId },
        select: { parentId: true },
      });
      if (ownerTenant?.parentId === user.tenantId) return;
    }

    throw new HttpError(
      403,
      'You do not have permission to modify this campaign.',
    );
  }
}
