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
  PaginationQuery,
} from '@aris/shared-types';
import { PublicationService } from './publication.service';
import { CreatePublicationDto } from './dto/create-publication.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import type { PublicationEntity } from './entities/publication.entity';

@Controller('api/v1/knowledge/publications')
@UseGuards(AuthGuard, TenantGuard)
export class PublicationController {
  constructor(private readonly publicationService: PublicationService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async create(
    @Body() dto: CreatePublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    return this.publicationService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('domain') domain?: string,
    @Query('type') type?: string,
    @Query('language') language?: string,
    @Query('tag') tag?: string,
  ): Promise<PaginatedResponse<PublicationEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    const filters = { domain, type, language, tag };
    return this.publicationService.findAll(user, query, filters);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    return this.publicationService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    return this.publicationService.update(id, dto, user);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.publicationService.download(id, user);
  }
}
