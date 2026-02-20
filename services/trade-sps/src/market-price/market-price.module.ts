import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { MarketPriceController } from './market-price.controller';
import { MarketPriceService } from './market-price.service';

@Module({
  controllers: [MarketPriceController],
  providers: [PrismaService, AuditService, MarketPriceService],
  exports: [MarketPriceService],
})
export class MarketPriceModule {}
