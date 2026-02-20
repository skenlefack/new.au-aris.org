import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type {
  JwtPayload,
  AuthenticatedUser,
  AuthModuleOptions,
} from '../interfaces/jwt-payload.interface';
import { AUTH_MODULE_OPTIONS } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = parts[1];

    try {
      const payload = jwt.verify(token, this.options.publicKey, {
        algorithms: (this.options.algorithms as jwt.Algorithm[]) ?? ['RS256'],
      }) as JwtPayload;

      // Check if token has been blacklisted (e.g. after logout)
      if (this.options.isTokenBlacklisted) {
        if (await this.options.isTokenBlacklisted(token)) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      const user: AuthenticatedUser = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantLevel: payload.tenantLevel,
      };

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(
        `JWT verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
