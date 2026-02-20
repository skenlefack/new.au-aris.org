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
import { AuthGuard, TenantGuard, RolesGuard, CurrentUser, Roles } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { LabResultService } from './lab-result.service';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import { LabResultFilterDto } from './dto/lab-result-filter.dto';
import type { LabResultEntity } from './entities/lab-result.entity';

@Controller('api/v1/animal-health/lab-results')
@UseGuards(AuthGuard, TenantGuard)
export class LabResultController {
  constructor(private readonly labResultService: LabResultService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.FIELD_AGENT,
  )
  async create(
    @Body() dto: CreateLabResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LabResultEntity>> {
    return this.labResultService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & LabResultFilterDto,
  ): Promise<PaginatedResponse<LabResultEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.labResultService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LabResultEntity>> {
    return this.labResultService.findOne(id, user);
  }
}
