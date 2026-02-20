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
  ParseBoolPipe,
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
import { DiseaseService } from './disease.service';
import { CreateDiseaseDto } from './dto/create-disease.dto';
import { UpdateDiseaseDto } from './dto/update-disease.dto';
import type { DiseaseRecord } from './entities/disease.entity';

@Controller('api/v1/master-data/diseases')
@UseGuards(AuthGuard, TenantGuard)
export class DiseaseController {
  constructor(private readonly diseaseService: DiseaseService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async create(
    @Body() dto: CreateDiseaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DiseaseRecord>> {
    return this.diseaseService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('isWoahListed', new ParseBoolPipe({ optional: true })) isWoahListed?: boolean,
    @Query('isNotifiable', new ParseBoolPipe({ optional: true })) isNotifiable?: boolean,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<DiseaseRecord>> {
    return this.diseaseService.findAll({
      page, limit, sort, order,
      isWoahListed, isNotifiable, search,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<DiseaseRecord>> {
    return this.diseaseService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiseaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DiseaseRecord>> {
    return this.diseaseService.update(id, dto, user);
  }
}
