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
import { HealthEventService } from './health-event.service';
import { CreateHealthEventDto } from './dto/create-health-event.dto';
import { UpdateHealthEventDto } from './dto/update-health-event.dto';
import { HealthEventFilterDto } from './dto/health-event-filter.dto';
import type { HealthEventEntity } from './entities/health-event.entity';

@Controller('api/v1/animal-health/events')
@UseGuards(AuthGuard, TenantGuard)
export class HealthEventController {
  constructor(private readonly healthEventService: HealthEventService) {}

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
    @Body() dto: CreateHealthEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    return this.healthEventService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & HealthEventFilterDto,
  ): Promise<PaginatedResponse<HealthEventEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.healthEventService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity & { labResults?: unknown[] }>> {
    return this.healthEventService.findOne(id, user);
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
    @Body() dto: UpdateHealthEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    return this.healthEventService.update(id, dto, user);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    return this.healthEventService.confirm(id, user);
  }
}
