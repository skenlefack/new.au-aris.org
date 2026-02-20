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
import { TemporalityService } from './temporality.service';
import { CreateTemporalityDto } from './dto/create-temporality.dto';
import { UpdateTemporalityDto } from './dto/update-temporality.dto';
import type { TemporalityRecord } from './entities/temporality.entity';

@Controller('api/v1/master-data/temporalities')
@UseGuards(AuthGuard, TenantGuard)
export class TemporalityController {
  constructor(private readonly temporalityService: TemporalityService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async create(
    @Body() dto: CreateTemporalityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TemporalityRecord>> {
    return this.temporalityService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('calendarType') calendarType?: string,
    @Query('year') year?: number,
    @Query('countryCode') countryCode?: string,
  ): Promise<PaginatedResponse<TemporalityRecord>> {
    return this.temporalityService.findAll({
      page, limit, sort, order,
      calendarType, year, countryCode,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<TemporalityRecord>> {
    return this.temporalityService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemporalityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TemporalityRecord>> {
    return this.temporalityService.update(id, dto, user);
  }
}
