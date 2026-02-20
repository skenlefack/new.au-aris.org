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
import { SlaughterService } from './slaughter.service';
import { CreateSlaughterDto } from './dto/create-slaughter.dto';
import { UpdateSlaughterDto } from './dto/update-slaughter.dto';
import { SlaughterFilterDto } from './dto/slaughter-filter.dto';
import type { SlaughterRecordEntity } from './entities/slaughter.entity';

@Controller('api/v1/livestock/slaughter')
@UseGuards(AuthGuard, TenantGuard)
export class SlaughterController {
  constructor(private readonly slaughterService: SlaughterService) {}

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
    @Body() dto: CreateSlaughterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    return this.slaughterService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & SlaughterFilterDto,
  ): Promise<PaginatedResponse<SlaughterRecordEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.slaughterService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    return this.slaughterService.findOne(id, user);
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
    @Body() dto: UpdateSlaughterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    return this.slaughterService.update(id, dto, user);
  }
}
