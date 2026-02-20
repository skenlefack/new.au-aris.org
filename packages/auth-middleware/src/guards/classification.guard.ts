import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataClassification, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export const CLASSIFICATION_KEY = 'aris_data_classification';

export const RequireClassification = (
  classification: DataClassification,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(CLASSIFICATION_KEY, classification);

/**
 * Maps minimum role required per data classification level.
 * Roles listed have access to that classification and all below it.
 */
const CLASSIFICATION_ACCESS: Record<DataClassification, UserRole[]> = {
  [DataClassification.PUBLIC]: [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
    UserRole.ANALYST,
    UserRole.FIELD_AGENT,
  ],
  [DataClassification.PARTNER]: [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
    UserRole.ANALYST,
  ],
  [DataClassification.RESTRICTED]: [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
  ],
  [DataClassification.CONFIDENTIAL]: [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
  ],
};

@Injectable()
export class ClassificationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredClassification = this.reflector.getAllAndOverride<
      DataClassification | undefined
    >(CLASSIFICATION_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredClassification) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const allowedRoles = CLASSIFICATION_ACCESS[requiredClassification];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} cannot access ${requiredClassification} data`,
      );
    }

    return true;
  }
}
