import { UserContext, Secret, Permission } from '../types';
import { ApiError } from '../middleware/error-handler';

/**
 * Filter secrets based on user permissions
 */
export function filterSecretsByPermissions(secrets: Secret[], user: UserContext): Secret[] {
  return secrets.filter(secret => hasReadPermission(user, secret.application, secret.environment));
}

/**
 * Check if user has read permission for app/env
 */
export function hasReadPermission(user: UserContext, app: string, env: string): boolean {
  return user.permissions.some(perm => {
    if (perm.app === '*' && perm.env === '*') return true;
    if (perm.app === app && perm.env === env) return true;
    return false;
  });
}

/**
 * Check if user has write permission for app/env
 */
export function hasWritePermission(user: UserContext, app: string, env: string): boolean {
  return user.permissions.some(perm => {
    if (perm.app === '*' && perm.env === '*' && perm.access === 'write') return true;
    if (perm.app === app && perm.env === env && perm.access === 'write') return true;
    return false;
  });
}

/**
 * Require read permission or throw error
 */
export function requireReadPermission(user: UserContext, app: string, env: string): void {
  if (!hasReadPermission(user, app, env)) {
    throw new ApiError(403, 'FORBIDDEN', `No read access to ${app}/${env}`);
  }
}

/**
 * Require write permission or throw error
 */
export function requireWritePermission(user: UserContext, app: string, env: string): void {
  if (!hasWritePermission(user, app, env)) {
    throw new ApiError(403, 'FORBIDDEN', `No write access to ${app}/${env}`);
  }
}
