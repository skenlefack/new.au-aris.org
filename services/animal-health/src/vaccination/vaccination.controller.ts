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
import { VaccinationService } from './vaccination.service';
import type { CoverageResult } from './vaccination.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { VaccinationFilterDto } from './dto/vaccination-filter.dto';
import type { VaccinationEntity } from './entities/vaccination.entity';

@Controller('api/v1/animal-health/vaccinations')
@UseGuards(AuthGuard, TenantGuard)
export class VaccinationController {
  constructor(private readonly vaccinationService: VaccinationService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.FIELD_AGENT,
  )
  async create(
    @Body() dto: CreateVaccinationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<VaccinationEntity>> {
    return this.vaccinationService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & VaccinationFilterDto,
  ): Promise<PaginatedResponse<VaccinationEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.vaccinationService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id/coverage')
  async getCoverage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CoverageResult>> {
    return this.vaccinationService.getCoverage(id, user);
  }
}
