import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  AuthGuard,
  TenantGuard,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  ApiResponse,
  PaginatedResponse,
} from '@aris/shared-types';
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import type { SubmissionEntity } from './entities/submission.entity';

@Controller('api/v1/collecte/submissions')
@UseGuards(AuthGuard, TenantGuard)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  async submit(
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    return this.submissionService.submit(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('campaign') campaignId?: string,
    @Query('status') status?: string,
    @Query('agent') agent?: string,
  ): Promise<PaginatedResponse<SubmissionEntity>> {
    return this.submissionService.findAll(user, {
      page,
      limit,
      campaignId,
      status,
      agent,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    return this.submissionService.findOne(id, user);
  }
}
