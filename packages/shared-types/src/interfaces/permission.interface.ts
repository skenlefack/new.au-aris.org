export interface PermissionEntry {
  module: string;
  feature: string;
  action: string;
}

export interface UserPermissions {
  userId: string;
  roles: string[];
  permissions: PermissionEntry[];
}

export interface RoleInfo {
  code: string;
  name: Record<string, string>;
  level: string;
  color: string;
  icon: string;
  isSystem: boolean;
}
