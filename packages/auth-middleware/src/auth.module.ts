import {
  DynamicModule,
  Module,
  Global,
  type Provider,
  type Type,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  type AuthModuleOptions,
  AUTH_MODULE_OPTIONS,
} from './interfaces/jwt-payload.interface';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantGuard } from './guards/tenant.guard';
import { ClassificationGuard } from './guards/classification.guard';
import { RateLimitGuard } from './security/rate-limit.guard';
import { CsrfGuard } from './security/csrf.guard';
import { IpFilterGuard } from './security/ip-filter.guard';
import { SanitizePipe } from './security/sanitize.pipe';
import { AuditLogInterceptor } from './security/audit-log.interceptor';

const SECURITY_PROVIDERS: Type[] = [
  RateLimitGuard,
  CsrfGuard,
  IpFilterGuard,
  SanitizePipe,
  AuditLogInterceptor,
];

const CORE_PROVIDERS: Type[] = [
  AuthGuard,
  RolesGuard,
  TenantGuard,
  ClassificationGuard,
];

function buildProviders(options?: AuthModuleOptions): Provider[] {
  const providers: Provider[] = [
    ...CORE_PROVIDERS,
    ...SECURITY_PROVIDERS,
  ];

  if (options?.security?.auditLog) {
    providers.push({
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    });
  }

  return providers;
}

const ALL_EXPORTS: Type[] = [...CORE_PROVIDERS, ...SECURITY_PROVIDERS];

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
        ...buildProviders(options),
      ],
      exports: [AUTH_MODULE_OPTIONS, ...ALL_EXPORTS],
    };
  }

  static forRootAsync(asyncOptions: {
    imports?: DynamicModule['imports'];
    useFactory: (
      ...args: never[]
    ) => AuthModuleOptions | Promise<AuthModuleOptions>;
    inject?: DynamicModule['providers'];
  }): DynamicModule {
    return {
      module: AuthModule,
      imports: asyncOptions.imports ?? [],
      providers: [
        {
          provide: AUTH_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: (asyncOptions.inject ?? []) as never[],
        },
        ...CORE_PROVIDERS,
        ...SECURITY_PROVIDERS,
      ],
      exports: [AUTH_MODULE_OPTIONS, ...ALL_EXPORTS],
    };
  }
}
