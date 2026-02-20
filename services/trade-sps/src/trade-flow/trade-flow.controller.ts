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
import { TradeFlowService } from './trade-flow.service';
import { CreateTradeFlowDto } from './dto/create-trade-flow.dto';
import { UpdateTradeFlowDto } from './dto/update-trade-flow.dto';
import { TradeFlowFilterDto } from './dto/trade-flow-filter.dto';
import type { TradeFlowEntity } from './entities/trade-flow.entity';

@Controller('api/v1/trade/flows')
@UseGuards(AuthGuard, TenantGuard)
export class TradeFlowController {
  constructor(private readonly tradeFlowService: TradeFlowService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateTradeFlowDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    return this.tradeFlowService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & TradeFlowFilterDto,
  ): Promise<PaginatedResponse<TradeFlowEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.tradeFlowService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    return this.tradeFlowService.findOne(id, user);
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
    @Body() dto: UpdateTradeFlowDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    return this.tradeFlowService.update(id, dto, user);
  }
}
