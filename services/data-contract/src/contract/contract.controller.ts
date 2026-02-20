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
import { ContractService } from './contract.service';
import { ComplianceService } from '../compliance/compliance.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import type {
  DataContractEntity,
  ComplianceMetrics,
} from './entities/contract.entity';

@Controller('api/v1/data-contracts')
@UseGuards(AuthGuard, TenantGuard)
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly complianceService: ComplianceService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
  )
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    return this.contractService.create(dto, user);
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
    @Query('owner') owner?: string,
  ): Promise<PaginatedResponse<DataContractEntity>> {
    const query: PaginationQuery & { domain?: string; status?: string; owner?: string } = {
      page,
      limit,
      sort,
      order,
      domain,
      status,
      owner,
    };
    return this.contractService.findAll(user, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    return this.contractService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    return this.contractService.update(id, dto, user);
  }

  @Get(':id/compliance')
  async getCompliance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: number,
  ): Promise<ApiResponse<ComplianceMetrics>> {
    return this.complianceService.getCompliance(id, user, days);
  }
}
