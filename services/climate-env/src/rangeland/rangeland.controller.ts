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
import { RangelandService } from './rangeland.service';
import { CreateRangelandDto } from './dto/create-rangeland.dto';
import { UpdateRangelandDto } from './dto/update-rangeland.dto';
import { RangelandFilterDto } from './dto/rangeland-filter.dto';
import type { RangelandConditionEntity } from './entities/rangeland.entity';

@Controller('api/v1/climate/rangelands')
@UseGuards(AuthGuard, TenantGuard)
export class RangelandController {
  constructor(private readonly rangelandService: RangelandService) {}

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
    @Body() dto: CreateRangelandDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    return this.rangelandService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & RangelandFilterDto,
  ): Promise<PaginatedResponse<RangelandConditionEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.rangelandService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    return this.rangelandService.findOne(id, user);
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
    @Body() dto: UpdateRangelandDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    return this.rangelandService.update(id, dto, user);
  }
}
