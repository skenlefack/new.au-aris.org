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
import { ProtectedAreaService } from './protected-area.service';
import { CreateProtectedAreaDto } from './dto/create-protected-area.dto';
import { UpdateProtectedAreaDto } from './dto/update-protected-area.dto';
import { ProtectedAreaFilterDto } from './dto/protected-area-filter.dto';
import type { ProtectedAreaEntity } from './entities/protected-area.entity';

@Controller('api/v1/wildlife/protected-areas')
@UseGuards(AuthGuard, TenantGuard)
export class ProtectedAreaController {
  constructor(private readonly protectedAreaService: ProtectedAreaService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateProtectedAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    return this.protectedAreaService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & ProtectedAreaFilterDto,
  ): Promise<PaginatedResponse<ProtectedAreaEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.protectedAreaService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    return this.protectedAreaService.findOne(id, user);
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
    @Body() dto: UpdateProtectedAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    return this.protectedAreaService.update(id, dto, user);
  }
}
