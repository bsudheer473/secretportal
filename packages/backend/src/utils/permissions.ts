/**
 * Permission checking utilities
 */

import { UserContext, Permission, Environment } from '@secrets-portal/shared-types';
import { ApiError, ErrorCode } from './lambda-utils';

/**
 * Check if user has read permission for a secret
 */
export function hasReadPermission(
  userContext: UserContext,
  application: string,
  environment: Environment
): boolean {
  return userContext.permissions.some(permission => {
    // Admin has access to everything
    if (permission.app === '*' && permission.env === '*') {
      return true;
    }
    
    // Check specific app and env match
    const appMatch = permission.app === '*' || permission.app === application;
    const envMatch = permission.env === '*' || permission.env === environment;
    
    return appMatch && envMatch;
  });
}

/**
 * Check if user has write permission for a secret
 */
export function hasWritePermission(
  userContext: UserContext,
  application: string,
  environment: Environment
): boolean {
  return userContext.permissions.some(permission => {
    // Admin has access to everything
    if (permission.app === '*' && permission.env === '*' && permission.access === 'write') {
      return true;
    }
    
    // Check specific app and env match with write access
    const appMatch = permission.app === '*' || permission.app === application;
    const envMatch = permission.env === '*' || permission.env === environment;
    const writeAccess = permission.access === 'write';
    
    return appMatch && envMatch && writeAccess;
  });
}

/**
 * Verify user has read permission or throw error
 */
export function requireReadPermission(
  userContext: UserContext,
  application: string,
  environment: Environment
): void {
  if (!hasReadPermission(userContext, application, environment)) {
    throw new ApiError(
      ErrorCode.FORBIDDEN,
      `Access denied to ${application} ${environment} secrets`,
      403
    );
  }
}

/**
 * Verify user has write permission or throw error
 */
export function requireWritePermission(
  userContext: UserContext,
  application: string,
  environment: Environment
): void {
  if (!hasWritePermission(userContext, application, environment)) {
    throw new ApiError(
      ErrorCode.FORBIDDEN,
      `Write access denied to ${application} ${environment} secrets`,
      403
    );
  }
}

/**
 * Filter secrets based on user permissions
 */
export function filterSecretsByPermissions<T extends { application: string; environment: Environment }>(
  secrets: T[],
  userContext: UserContext
): T[] {
  return secrets.filter(secret => 
    hasReadPermission(userContext, secret.application, secret.environment)
  );
}
