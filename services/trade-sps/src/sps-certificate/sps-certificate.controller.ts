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
import { SpsCertificateService } from './sps-certificate.service';
import { CreateSpsCertificateDto } from './dto/create-sps-certificate.dto';
import { UpdateSpsCertificateDto } from './dto/update-sps-certificate.dto';
import { SpsCertificateFilterDto } from './dto/sps-certificate-filter.dto';
import type { SpsCertificateEntity } from './entities/sps-certificate.entity';

@Controller('api/v1/trade/sps-certificates')
@UseGuards(AuthGuard, TenantGuard)
export class SpsCertificateController {
  constructor(private readonly spsCertificateService: SpsCertificateService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
  )
  async create(
    @Body() dto: CreateSpsCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    return this.spsCertificateService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & SpsCertificateFilterDto,
  ): Promise<PaginatedResponse<SpsCertificateEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.spsCertificateService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    return this.spsCertificateService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpsCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    return this.spsCertificateService.update(id, dto, user);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
  )
  async issue(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    return this.spsCertificateService.issue(id, user);
  }
}
