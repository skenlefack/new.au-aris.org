import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  AuthGuard,
  RolesGuard,
  TenantGuard,
  Roles,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
} from '@aris/shared-types';
import { ELearningService } from './elearning.service';
import { CreateELearningModuleDto } from './dto/create-elearning-module.dto';
import { UpdateELearningModuleDto } from './dto/update-elearning-module.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import type { ELearningModuleEntity } from './entities/elearning-module.entity';
import type { LearnerProgressEntity } from './entities/learner-progress.entity';

@Controller('api/v1/knowledge/elearning')
@UseGuards(AuthGuard, TenantGuard)
export class ELearningController {
  constructor(private readonly elearningService: ELearningService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async create(
    @Body() dto: CreateELearningModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    return this.elearningService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('domain') domain?: string,
  ): Promise<PaginatedResponse<ELearningModuleEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.elearningService.findAll(user, query, domain);
  }

  @Get('my-courses')
  async getMyCourses(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity[]>> {
    return this.elearningService.getMyCourses(user);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    return this.elearningService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateELearningModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    return this.elearningService.update(id, dto, user);
  }

  @Get(':id/enroll')
  async enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    return this.elearningService.enroll(id, user);
  }

  @Patch(':id/progress')
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    return this.elearningService.updateProgress(id, dto, user);
  }
}
