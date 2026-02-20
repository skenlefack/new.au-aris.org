import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@aris/shared-types';

export const ROLES_KEY = 'aris_roles';

export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
