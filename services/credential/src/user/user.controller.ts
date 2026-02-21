import {
  Controller,
  Get,
  Put,
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
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import type { UserEntity } from './entities/user.entity';

@Controller('api/v1/users')
@UseGuards(AuthGuard, TenantGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<UserEntity>> {
    const query: PaginationQuery = { page, limit, sort, order };
    return this.userService.findAll(user, query);
  }

  @Get('me')
  async findMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<UserEntity>> {
    return this.userService.findMe(user);
  }

  @Put('me/locale')
  async updateLocale(
    @Body() dto: UpdateLocaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<UserEntity>> {
    return this.userService.updateLocale(user.userId, dto.locale);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<UserEntity>> {
    return this.userService.update(id, dto, user);
  }
}
