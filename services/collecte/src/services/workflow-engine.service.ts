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
      include: { steps: true, country: true },
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
        include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true },
      }),
      (this.prisma as any).collecteWorkflow.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<unknown>> {
    const workflow = await (this.prisma as any).collecteWorkflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true },
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
      include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true },
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
      include: { steps: { orderBy: { stepOrder: 'asc' } }, country: true },
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

export class CollectionCampaignService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(dto: Record<string, unknown>, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const startDate = new Date(dto.startDate as string);
    const endDate = new Date(dto.endDate as string);
    if (endDate <= startDate) {
      throw new HttpError(400, 'endDate must be after startDate');
    }

    const campaign = await (this.prisma as any).collectionCampaign.create({
      data: {
        code: dto.code as string,
        name: dto.name,
        description: dto.description ?? null,
        domain: dto.domain as string,
        formTemplateId: dto.formTemplateId as string,
        startDate,
        endDate,
        targetCountries: dto.targetCountries ?? null,
        targetRecIds: dto.targetRecIds ?? null,
        targetAdminAreas: dto.targetAdminAreas ?? null,
        targetSubmissions: (dto.targetSubmissions as number) ?? null,
        targetPerAgent: (dto.targetPerAgent as number) ?? null,
        frequency: (dto.frequency as string) ?? null,
        scope: (dto.scope as string) ?? 'continental',
        ownerId: user.tenantId,
        ownerType: user.tenantLevel ?? 'continental',
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

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status.toUpperCase();
    if (query.domain) where['domain'] = query.domain;

    const [data, total] = await Promise.all([
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

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<unknown>> {
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

    // Calculate progress
    const totalAssigned = campaign.assignments.length;
    const totalCompleted = campaign.assignments.filter((a: any) => a.status === 'COMPLETED').length;
    const totalSubmissions = campaign.assignments.reduce((sum: number, a: any) => sum + a.completedSubmissions, 0);

    return {
      data: {
        ...campaign,
        progress: {
          totalAgents: totalAssigned,
          completedAgents: totalCompleted,
          totalSubmissions,
          targetSubmissions: campaign.targetSubmissions,
          completionRate: campaign.targetSubmissions
            ? Math.round((totalSubmissions / campaign.targetSubmissions) * 100)
            : 0,
        },
      },
    };
  }

  async update(id: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).collectionCampaign.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Campaign ${id} not found`);

    const data: Record<string, unknown> = {};
    for (const key of [
      'name', 'description', 'targetCountries', 'targetRecIds', 'targetAdminAreas',
      'targetSubmissions', 'targetPerAgent', 'frequency', 'sendReminders', 'reminderDaysBefore', 'metadata',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.startDate) data['startDate'] = new Date(dto.startDate as string);
    if (dto.endDate) data['endDate'] = new Date(dto.endDate as string);

    const campaign = await (this.prisma as any).collectionCampaign.update({
      where: { id },
      data,
      include: { formTemplate: true, assignments: true },
    });

    return { data: campaign };
  }

  async updateStatus(id: string, status: string): Promise<ApiResponse<unknown>> {
    const campaign = await (this.prisma as any).collectionCampaign.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: { formTemplate: true, assignments: true },
    });
    return { data: campaign };
  }

  async addAssignment(campaignId: string, dto: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const campaign = await (this.prisma as any).collectionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new HttpError(404, `Campaign ${campaignId} not found`);

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

  async removeAssignment(campaignId: string, assignId: string): Promise<void> {
    const assignment = await (this.prisma as any).campaignAssignment.findFirst({
      where: { id: assignId, campaignId },
    });
    if (!assignment) throw new HttpError(404, `Assignment ${assignId} not found`);
    await (this.prisma as any).campaignAssignment.delete({ where: { id: assignId } });
  }

  async getProgress(id: string): Promise<ApiResponse<unknown>> {
    return this.findOne(id);
  }
}
