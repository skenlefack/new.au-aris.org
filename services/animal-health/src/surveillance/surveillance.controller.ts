import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, TenantGuard, RolesGuard, CurrentUser, Roles } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery, ApiResponse, PaginatedResponse } from '@aris/shared-types';
import { SurveillanceService } from './surveillance.service';
import { CreateSurveillanceDto } from './dto/create-surveillance.dto';
import { SurveillanceFilterDto } from './dto/surveillance-filter.dto';
import type { SurveillanceEntity } from './entities/surveillance.entity';

@Controller('api/v1/animal-health/surveillance')
@UseGuards(AuthGuard, TenantGuard)
export class SurveillanceController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.FIELD_AGENT,
  )
  async create(
    @Body() dto: CreateSurveillanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SurveillanceEntity>> {
    return this.surveillanceService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & SurveillanceFilterDto,
  ): Promise<PaginatedResponse<SurveillanceEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.surveillanceService.findAll(user, { page, limit, sort, order }, filter);
  }
}
