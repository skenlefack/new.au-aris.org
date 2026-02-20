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
import { CrimeService } from './crime.service';
import { CreateCrimeDto } from './dto/create-crime.dto';
import { UpdateCrimeDto } from './dto/update-crime.dto';
import { CrimeFilterDto } from './dto/crime-filter.dto';
import type { WildlifeCrimeEntity } from './entities/crime.entity';

@Controller('api/v1/wildlife/crimes')
@UseGuards(AuthGuard, TenantGuard)
export class CrimeController {
  constructor(private readonly crimeService: CrimeService) {}

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
    @Body() dto: CreateCrimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    return this.crimeService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CrimeFilterDto,
  ): Promise<PaginatedResponse<WildlifeCrimeEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.crimeService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    return this.crimeService.findOne(id, user);
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
    @Body() dto: UpdateCrimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    return this.crimeService.update(id, dto, user);
  }
}
