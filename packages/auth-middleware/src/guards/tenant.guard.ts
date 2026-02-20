import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: Record<string, string>;
      query: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Continental level (AU-IBAR) can access everything
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return true;
    }

    // Extract requested tenantId from params or query
    const requestedTenantId =
      request.params['tenantId'] ?? request.query['tenantId'];

    // If no specific tenant requested, scope to user's own tenant
    if (!requestedTenantId) {
      return true;
    }

    // User can always access their own tenant
    if (requestedTenantId === user.tenantId) {
      return true;
    }

    // REC level can access child member states — actual hierarchy check
    // is delegated to the service layer with a tenant hierarchy lookup.
    // The guard only blocks MEMBER_STATE from accessing other tenants.
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      this.logger.warn(
        `Member state user ${user.userId} attempted to access tenant ${requestedTenantId}`,
      );
      throw new ForbiddenException(
        'Member state users cannot access other tenants',
      );
    }

    // REC users: allow through, service layer validates child relationship
    if (user.tenantLevel === TenantLevel.REC) {
      return true;
    }

    throw new ForbiddenException('Unauthorized tenant access');
  }
}
