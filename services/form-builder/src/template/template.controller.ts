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
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import type { FormTemplateEntity } from './entities/template.entity';

@Controller('api/v1/form-builder/templates')
@UseGuards(AuthGuard, TenantGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('domain') domain?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedResponse<FormTemplateEntity>> {
    const query: PaginationQuery & { domain?: string; status?: string } = {
      page,
      limit,
      sort,
      order,
      domain,
      status,
    };
    return this.templateService.findAll(user, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.update(id, dto, user);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.publish(id, user);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
  )
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.archive(id, user);
  }

  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FormTemplateEntity>> {
    return this.templateService.preview(id, user);
  }
}
