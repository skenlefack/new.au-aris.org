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
import { CaptureService } from './capture.service';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { UpdateCaptureDto } from './dto/update-capture.dto';
import { CaptureFilterDto } from './dto/capture-filter.dto';
import type { FishCaptureEntity } from './entities/capture.entity';

@Controller('api/v1/fisheries/captures')
@UseGuards(AuthGuard, TenantGuard)
export class CaptureController {
  constructor(private readonly captureService: CaptureService) {}

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
    @Body() dto: CreateCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    return this.captureService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & CaptureFilterDto,
  ): Promise<PaginatedResponse<FishCaptureEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.captureService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    return this.captureService.findOne(id, user);
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
    @Body() dto: UpdateCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    return this.captureService.update(id, dto, user);
  }
}
