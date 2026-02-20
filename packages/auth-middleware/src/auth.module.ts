import { DynamicModule, Module, Global } from '@nestjs/common';
import {
  AuthModuleOptions,
  AUTH_MODULE_OPTIONS,
} from './interfaces/jwt-payload.interface';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantGuard } from './guards/tenant.guard';
import { ClassificationGuard } from './guards/classification.guard';

@Global()
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        {
          provide: AUTH_MODULE_OPTIONS,
          useValue: options,
        },
        AuthGuard,
        RolesGuard,
        TenantGuard,
        ClassificationGuard,
      ],
      exports: [
        AUTH_MODULE_OPTIONS,
        AuthGuard,
        RolesGuard,
        TenantGuard,
        ClassificationGuard,
      ],
    };
  }
}
