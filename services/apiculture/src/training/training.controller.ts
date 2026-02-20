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
import { AuthGuard, TenantGuard, RolesGuard, CurrentUser, Roles } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { TrainingService } from './training.service';
import { CreateBeekeeperTrainingDto } from './dto/create-training.dto';
import { UpdateBeekeeperTrainingDto } from './dto/update-training.dto';
import { TrainingFilterDto } from './dto/training-filter.dto';
import type { BeekeeperTrainingEntity } from './entities/training.entity';

@Controller('api/v1/apiculture/training')
@UseGuards(AuthGuard, TenantGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.FIELD_AGENT,
  )
  async create(
    @Body() dto: CreateBeekeeperTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    return this.trainingService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & TrainingFilterDto,
  ): Promise<PaginatedResponse<BeekeeperTrainingEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.trainingService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    return this.trainingService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBeekeeperTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    return this.trainingService.update(id, dto, user);
  }
}
