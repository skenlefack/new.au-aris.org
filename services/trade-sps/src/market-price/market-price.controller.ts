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
import { MarketPriceService } from './market-price.service';
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';
import { MarketPriceFilterDto } from './dto/market-price-filter.dto';
import type { MarketPriceEntity } from './entities/market-price.entity';

@Controller('api/v1/trade/market-prices')
@UseGuards(AuthGuard, TenantGuard)
export class MarketPriceController {
  constructor(private readonly marketPriceService: MarketPriceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  )
  async create(
    @Body() dto: CreateMarketPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    return this.marketPriceService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery & MarketPriceFilterDto,
  ): Promise<PaginatedResponse<MarketPriceEntity>> {
    const { page, limit, sort, order, ...filter } = query;
    return this.marketPriceService.findAll(user, { page, limit, sort, order }, filter);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    return this.marketPriceService.findOne(id, user);
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
    @Body() dto: UpdateMarketPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    return this.marketPriceService.update(id, dto, user);
  }
}
