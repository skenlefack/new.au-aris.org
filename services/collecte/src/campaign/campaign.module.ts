import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

@Module({
  controllers: [CampaignController],
  providers: [PrismaService, CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
