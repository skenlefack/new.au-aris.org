import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
} from '@aris/shared-types';
import { WorkflowService } from './workflow.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { ApproveDto, RejectDto, ReturnDto } from './dto/transition.dto';
import type {
  WorkflowInstanceEntity,
  DashboardMetrics,
} from './entities/workflow.entity';

@Controller('api/v1/workflow')
@UseGuards(AuthGuard, TenantGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('instances')
  async create(
    @Body() dto: CreateInstanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    return this.workflowService.create(dto, user);
  }

  @Get('instances')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('domain') domain?: string,
  ): Promise<PaginatedResponse<WorkflowInstanceEntity>> {
    const query: PaginationQuery & { level?: string; status?: string; domain?: string } = {
      page,
      limit,
      sort,
      order,
      level,
      status,
      domain,
    };
    return this.workflowService.findAll(user, query);
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DashboardMetrics>> {
    return this.workflowService.getDashboard(user);
  }

  @Get('instances/:id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    return this.workflowService.findOne(id, user);
  }

  @Post('instances/:id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    return this.workflowService.approve(id, dto.comment, user);
  }

  @Post('instances/:id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    return this.workflowService.reject(id, dto.reason, user);
  }

  @Post('instances/:id/return')
  async returnForCorrection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    return this.workflowService.returnForCorrection(id, dto.reason, user);
  }
}
