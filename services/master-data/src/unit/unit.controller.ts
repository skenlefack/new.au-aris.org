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
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import type { UnitRecord } from './entities/unit.entity';

@Controller('api/v1/master-data/units')
@UseGuards(AuthGuard, TenantGuard)
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async create(
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<UnitRecord>> {
    return this.unitService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<UnitRecord>> {
    return this.unitService.findAll({ page, limit, sort, order, category, search });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<UnitRecord>> {
    return this.unitService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<UnitRecord>> {
    return this.unitService.update(id, dto, user);
  }
}
