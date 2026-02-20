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
import { PvsEvaluationService } from './pvs-evaluation.service';
import { CreatePVSEvaluationDto } from './dto/create-pvs-evaluation.dto';
import { UpdatePVSEvaluationDto } from './dto/update-pvs-evaluation.dto';
import { PVSEvaluationFilterDto } from './dto/pvs-evaluation-filter.dto';
import type { PVSEvaluationEntity } from './entities/pvs-evaluation.entity';

@Controller('api/v1/governance/pvs-evaluations')
@UseGuards(AuthGuard, TenantGuard)
export class PvsEvaluationController {
  constructor(private readonly pvsEvaluationService: PvsEvaluationService) {}

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
    @Body() dto: CreatePVSEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    return this.pvsEvaluationService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & PVSEvaluationFilterDto,
  ): Promise<PaginatedResponse<PVSEvaluationEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.pvsEvaluationService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    return this.pvsEvaluationService.findOne(id, user);
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
    @Body() dto: UpdatePVSEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    return this.pvsEvaluationService.update(id, dto, user);
  }
}
