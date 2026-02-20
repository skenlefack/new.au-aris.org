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
import { TranshumanceService } from './transhumance.service';
import { CreateTranshumanceDto } from './dto/create-transhumance.dto';
import { UpdateTranshumanceDto } from './dto/update-transhumance.dto';
import { TranshumanceFilterDto } from './dto/transhumance-filter.dto';
import type { TranshumanceCorridorEntity } from './entities/transhumance.entity';

@Controller('api/v1/livestock/transhumance')
@UseGuards(AuthGuard, TenantGuard)
export class TranshumanceController {
  constructor(private readonly transhumanceService: TranshumanceService) {}

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
    @Body() dto: CreateTranshumanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    return this.transhumanceService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & TranshumanceFilterDto,
  ): Promise<PaginatedResponse<TranshumanceCorridorEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.transhumanceService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    return this.transhumanceService.findOne(id, user);
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
    @Body() dto: UpdateTranshumanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    return this.transhumanceService.update(id, dto, user);
  }
}
