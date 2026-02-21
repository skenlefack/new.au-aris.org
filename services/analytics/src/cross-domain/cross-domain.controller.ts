import { Controller, Get, Query } from '@nestjs/common';
import type { ApiResponse } from '@aris/shared-types';
import { CrossDomainService } from './cross-domain.service';
import type {
  CorrelationsResponse,
  CountryRiskScore,
  LivestockPopulation,
  FisheriesCatches,
  TradeBalance,
  WildlifeCrimeTrends,
  ClimateAlert,
  PvsScoreEntry,
} from './dto/cross-domain.dto';

@Controller('analytics')
export class CrossDomainController {
  constructor(private readonly crossDomainService: CrossDomainService) {}

  @Get('cross-domain/correlations')
  async getCorrelations(
    @Query('country') country?: string,
  ): Promise<ApiResponse<CorrelationsResponse>> {
    const data = await this.crossDomainService.getCorrelations(country);
    return { data };
  }

  @Get('cross-domain/risk-score')
  async getRiskScore(
    @Query('country') country: string,
  ): Promise<ApiResponse<CountryRiskScore>> {
    const data = await this.crossDomainService.getRiskScore(country);
    return { data };
  }

  @Get('livestock/population')
  async getLivestockPopulation(
    @Query('country') country?: string,
  ): Promise<ApiResponse<LivestockPopulation[]>> {
    const data = await this.crossDomainService.getLivestockPopulation(country);
    return { data };
  }

  @Get('fisheries/catches')
  async getFisheriesCatches(
    @Query('country') country?: string,
  ): Promise<ApiResponse<FisheriesCatches[]>> {
    const data = await this.crossDomainService.getFisheriesCatches(country);
    return { data };
  }

  @Get('trade/balance')
  async getTradeBalance(
    @Query('country') country?: string,
  ): Promise<ApiResponse<TradeBalance[]>> {
    const data = await this.crossDomainService.getTradeBalance(country);
    return { data };
  }

  @Get('wildlife/crime-trends')
  async getWildlifeCrimeTrends(
    @Query('country') country?: string,
  ): Promise<ApiResponse<WildlifeCrimeTrends[]>> {
    const data = await this.crossDomainService.getWildlifeCrimeTrends(country);
    return { data };
  }

  @Get('climate/alerts')
  async getClimateAlerts(
    @Query('country') country?: string,
  ): Promise<ApiResponse<ClimateAlert[]>> {
    const data = await this.crossDomainService.getClimateAlerts(country);
    return { data };
  }

  @Get('governance/pvs-scores')
  async getPvsScores(
    @Query('country') country?: string,
  ): Promise<ApiResponse<PvsScoreEntry[]>> {
    const data = await this.crossDomainService.getPvsScores(country);
    return { data };
  }
}
