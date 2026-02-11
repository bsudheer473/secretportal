/**
 * Shared type definitions for the Secrets Management Portal
 */

export type Environment = 'NP' | 'PP' | 'Prod';

export type RotationPeriod = 45 | 60 | 90;

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'CONSOLE_ACCESS';

/**
 * Secret metadata stored in DynamoDB and returned by API
 */
export interface SecretMetadata {
  secretId: string;
  secretArn: string;
  secretName: string;
  application: string;
  environment: Environment;
  awsRegion: string;
  rotationPeriod: RotationPeriod;
  createdAt: string;
  lastModified: string;
  createdBy: string;
  lastModifiedBy: string;
  notificationSent: boolean;
  lastNotificationDate?: string;
  tags: Record<string, string>;
}

/**
 * Secret information returned to frontend
 */
export interface Secret {
  id: string;
  name: string;
  application: string;
  environment: Environment;
  rotationPeriod: RotationPeriod;
  lastModified: string;
  daysSinceRotation: number;
  awsRegion: string;
  tags: Record<string, string>;
}

/**
 * Detailed secret information including metadata
 */
export interface SecretDetail extends Secret {
  secretArn: string;
  createdAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

/**
 * Audit log entry stored in DynamoDB
 */
export interface AuditLogEntry {
  secretId: string;
  timestamp: string;
  userId: string;
  action: AuditAction;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  details?: string; // Additional details about the action (e.g., "Rotation period changed from 45 to 60 days")
}
