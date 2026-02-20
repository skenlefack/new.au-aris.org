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
import { SpeciesService } from './species.service';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';
import type { SpeciesRecord } from './entities/species.entity';

@Controller('api/v1/master-data/species')
@UseGuards(AuthGuard, TenantGuard)
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async create(
    @Body() dto: CreateSpeciesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpeciesRecord>> {
    return this.speciesService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<SpeciesRecord>> {
    return this.speciesService.findAll({ page, limit, sort, order, category, search });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<SpeciesRecord>> {
    return this.speciesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpeciesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpeciesRecord>> {
    return this.speciesService.update(id, dto, user);
  }
}
