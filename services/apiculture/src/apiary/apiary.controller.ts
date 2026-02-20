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
import { ApiaryService } from './apiary.service';
import { CreateApiaryDto } from './dto/create-apiary.dto';
import { UpdateApiaryDto } from './dto/update-apiary.dto';
import { ApiaryFilterDto } from './dto/apiary-filter.dto';
import type { ApiaryEntity } from './entities/apiary.entity';

@Controller('api/v1/apiculture/apiaries')
@UseGuards(AuthGuard, TenantGuard)
export class ApiaryController {
  constructor(private readonly apiaryService: ApiaryService) {}

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
    @Body() dto: CreateApiaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    return this.apiaryService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & ApiaryFilterDto,
  ): Promise<PaginatedResponse<ApiaryEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.apiaryService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    return this.apiaryService.findOne(id, user);
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
    @Body() dto: UpdateApiaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    return this.apiaryService.update(id, dto, user);
  }
}
