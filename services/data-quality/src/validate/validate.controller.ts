import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { ApiResponse } from '@aris/shared-types';
import { ValidateService } from './validate.service';
import { ValidateRecordDto } from './dto/validate-record.dto';
import type { QualityReportEntity } from './entities/quality-report.entity';

@Controller('api/v1/data-quality')
@UseGuards(AuthGuard, TenantGuard)
export class ValidateController {
  constructor(private readonly validateService: ValidateService) {}

  @Post('validate')
  async validate(
    @Body() dto: ValidateRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<QualityReportEntity>> {
    return this.validateService.validate(dto, user);
  }
}
