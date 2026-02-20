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
import { IdentifierService } from './identifier.service';
import { CreateIdentifierDto } from './dto/create-identifier.dto';
import { UpdateIdentifierDto } from './dto/update-identifier.dto';
import type { IdentifierRecord } from './entities/identifier.entity';

@Controller('api/v1/master-data/identifiers')
@UseGuards(AuthGuard, TenantGuard)
export class IdentifierController {
  constructor(private readonly identifierService: IdentifierService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.NATIONAL_ADMIN)
  async create(
    @Body() dto: CreateIdentifierDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<IdentifierRecord>> {
    return this.identifierService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('type') type?: string,
    @Query('geoEntityId') geoEntityId?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<IdentifierRecord>> {
    return this.identifierService.findAll({
      page, limit, sort, order,
      type, geoEntityId, search,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<IdentifierRecord>> {
    return this.identifierService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.NATIONAL_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIdentifierDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<IdentifierRecord>> {
    return this.identifierService.update(id, dto, user);
  }
}
