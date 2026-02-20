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
import { LegalFrameworkService } from './legal-framework.service';
import { CreateLegalFrameworkDto } from './dto/create-legal-framework.dto';
import { UpdateLegalFrameworkDto } from './dto/update-legal-framework.dto';
import { LegalFrameworkFilterDto } from './dto/legal-framework-filter.dto';
import type { LegalFrameworkEntity } from './entities/legal-framework.entity';

@Controller('api/v1/governance/legal-frameworks')
@UseGuards(AuthGuard, TenantGuard)
export class LegalFrameworkController {
  constructor(private readonly legalFrameworkService: LegalFrameworkService) {}

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
    @Body() dto: CreateLegalFrameworkDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    return this.legalFrameworkService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & LegalFrameworkFilterDto,
  ): Promise<PaginatedResponse<LegalFrameworkEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.legalFrameworkService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    return this.legalFrameworkService.findOne(id, user);
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
    @Body() dto: UpdateLegalFrameworkDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    return this.legalFrameworkService.update(id, dto, user);
  }

  @Post(':id/adopt')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async adopt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    return this.legalFrameworkService.adopt(id, user);
  }
}
