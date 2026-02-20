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
import {
  AuthGuard,
  RolesGuard,
  TenantGuard,
  Roles,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type {
  ApiResponse,
  PaginatedResponse,
} from '@aris/shared-types';
import { DenominatorService } from './denominator.service';
import { CreateDenominatorDto } from './dto/create-denominator.dto';
import { UpdateDenominatorDto } from './dto/update-denominator.dto';
import type { DenominatorRecord } from './entities/denominator.entity';

@Controller('api/v1/master-data/denominators')
@UseGuards(AuthGuard, TenantGuard)
export class DenominatorController {
  constructor(private readonly denominatorService: DenominatorService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateDenominatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    return this.denominatorService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('countryCode') countryCode?: string,
    @Query('speciesId') speciesId?: string,
    @Query('year') year?: number,
    @Query('source') source?: string,
  ): Promise<PaginatedResponse<DenominatorRecord>> {
    return this.denominatorService.findAll({
      page, limit, sort, order,
      countryCode, speciesId, year, source,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<DenominatorRecord>> {
    return this.denominatorService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDenominatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    return this.denominatorService.update(id, dto, user);
  }

  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async validate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    return this.denominatorService.validate(id, user);
  }
}
