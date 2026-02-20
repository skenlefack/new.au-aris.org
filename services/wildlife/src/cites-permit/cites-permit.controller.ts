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
import { CitesPermitService } from './cites-permit.service';
import { CreateCitesPermitDto } from './dto/create-cites-permit.dto';
import { UpdateCitesPermitDto } from './dto/update-cites-permit.dto';
import { CitesPermitFilterDto } from './dto/cites-permit-filter.dto';
import type { CITESPermitEntity } from './entities/cites-permit.entity';

@Controller('api/v1/wildlife/cites-permits')
@UseGuards(AuthGuard, TenantGuard)
export class CitesPermitController {
  constructor(private readonly citesPermitService: CitesPermitService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateCitesPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    return this.citesPermitService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CitesPermitFilterDto,
  ): Promise<PaginatedResponse<CITESPermitEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.citesPermitService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    return this.citesPermitService.findOne(id, user);
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
    @Body() dto: UpdateCitesPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    return this.citesPermitService.update(id, dto, user);
  }
}
