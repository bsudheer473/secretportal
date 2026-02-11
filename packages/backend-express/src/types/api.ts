/**
 * API request and response types
 */

import { Environment, RotationPeriod, Secret, SecretDetail, AuditLogEntry } from './models';

/**
 * Request to create a new secret
 */
export interface CreateSecretRequest {
  name: string;
  application: string;
  environment: Environment;
  rotationPeriod: RotationPeriod;
  value: string;
  description?: string;
  owner?: string;
}

/**
 * Request to update a secret value
 */
export interface UpdateSecretRequest {
  value: string;
}

/**
 * Request to update rotation period
 */
export interface UpdateRotationPeriodRequest {
  rotationPeriod: RotationPeriod;
}

/**
 * Search and filter parameters
 */
export interface SearchFilters {
  application?: string;
  environment?: Environment;
  query?: string;
  limit?: number;
  nextToken?: string;
}

/**
 * Paginated list response
 */
export interface ListSecretsResponse {
  secrets: Secret[];
  nextToken?: string;
}

/**
 * Console URL response
 */
export interface ConsoleUrlResponse {
  url: string;
}

/**
 * Audit log response
 */
export interface AuditLogResponse {
  entries: AuditLogEntry[];
  nextToken?: string;
}

/**
 * Standard API error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * User permissions extracted from Cognito groups
 */
export interface Permission {
  app: string;
  env: string;
  access: 'read' | 'write';
}

/**
 * User context from authorizer
 */
export interface UserContext {
  userId: string;
  email: string;
  groups: string[];
  permissions: Permission[];
}
