import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Redirect,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
} from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginatedResponse, ApiResponse } from '@aris/shared-types';
import { FileService } from './file.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { PresignDto } from './dto/presign.dto';
import { ListFilesDto } from './dto/list-files.dto';
import type { FileRecordEntity } from './entities/file-record.entity';

interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller('api/v1/drive')
@UseGuards(AuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FileRecordEntity>> {
    return this.fileService.upload(file, dto, user);
  }

  @Post('presign')
  async presign(
    @Body() dto: PresignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<{ uploadUrl: string; fileId: string; key: string }>> {
    return this.fileService.presign(dto, user);
  }

  @Get('files')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFilesDto,
  ): Promise<PaginatedResponse<FileRecordEntity>> {
    return this.fileService.findAll(user, query);
  }

  @Get('files/:id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<FileRecordEntity>> {
    return this.fileService.findOne(id, user);
  }

  @Get('files/:id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.fileService.download(id, user);
  }

  @Delete('files/:id')
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.fileService.softDelete(id, user);
  }
}
