import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { SecretsMetadataRepository } from '../repositories/secrets-metadata-repository';
import { AuditLogRepository } from '../repositories/audit-log-repository';
import { AWSConsoleChangesRepository } from '../repositories/aws-console-changes-repository';
import { 
  DescribeSecretCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { secretsManagerClient } from '../utils/aws-clients';
import { filterSecretsByPermissions, requireReadPermission, requireWritePermission } from '../utils/permissions';
import { sendProdSecretChangeNotification } from '../utils/notifications';
import {
  Secret,
  ListSecretsResponse,
  SecretDetail,
  ConsoleUrlResponse,
  CreateSecretRequest,
  UpdateSecretRequest,
  UpdateRotationPeriodRequest,
  AuditLogResponse,
} from '../types';

const SECRETS_TABLE = process.env.SECRETS_METADATA_TABLE || 'secrets-metadata';
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE || 'secrets-audit-log';
const AWS_CONSOLE_CHANGES_TABLE = process.env.AWS_CONSOLE_CHANGES_TABLE || 'aws-console-changes';

const secretsRepo = new SecretsMetadataRepository(SECRETS_TABLE);
const auditLogRepo = new AuditLogRepository(AUDIT_LOG_TABLE);
const consoleChangesRepo = new AWSConsoleChangesRepository(AWS_CONSOLE_CHANGES_TABLE);

export class SecretsController {
  /**
   * List secrets with optional filtering
   * GET /api/secrets?application=app1&environment=NP&limit=50
   */
  async listSecrets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const application = req.query.application as string | undefined;
      const environment = req.query.environment as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const nextToken = req.query.nextToken as string | undefined;

      // Parse nextToken if provided
      let lastEvaluatedKey: Record<string, any> | undefined;
      if (nextToken) {
        try {
          lastEvaluatedKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        } catch (error) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid nextToken');
        }
      }

      // Query DynamoDB based on filters
      let result;
      if (application && environment) {
        result = await secretsRepo.queryByApplication(application, environment as any, limit, lastEvaluatedKey);
      } else if (application) {
        result = await secretsRepo.queryByApplication(application, undefined, limit, lastEvaluatedKey);
      } else if (environment) {
        result = await secretsRepo.queryByEnvironment(environment as any, limit, lastEvaluatedKey);
      } else {
        result = await secretsRepo.list(limit, lastEvaluatedKey);
      }

      // Convert metadata to secrets
      let secrets = result.items.map(this.toSecret.bind(this));

      // Filter based on user permissions
      secrets = filterSecretsByPermissions(secrets, user);

      // Encode nextToken if there are more results
      const responseNextToken = result.lastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
        : undefined;

      const response: ListSecretsResponse = {
        secrets,
        nextToken: responseNextToken,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search secrets by name
   * GET /api/secrets/search?q=database
   */
  async searchSecrets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!query) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Search query is required');
      }

      // For now, just list all and filter client-side
      // TODO: Implement DynamoDB search with scan and filter
      const result = await secretsRepo.list(limit);
      let secrets = result.items
        .filter(item => {
          const secretName = (item as any).name || (item as any).secretName || '';
          const application = (item as any).application || '';
          const environment = (item as any).environment || '';
          
          // Search in name, application, or environment
          const searchText = (query || '').toLowerCase();
          return secretName.toLowerCase().includes(searchText) ||
                 application.toLowerCase().includes(searchText) ||
                 environment.toLowerCase().includes(searchText);
        })
        .map(this.toSecret.bind(this));

      // Filter based on user permissions
      secrets = filterSecretsByPermissions(secrets, user);

      const response: ListSecretsResponse = {
        secrets,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get secret metadata
   * GET /api/secrets/:id
   */
  async getSecret(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const secretId = req.params.id;

      const metadata = await secretsRepo.get(secretId);
      if (!metadata) {
        throw new ApiError(404, 'NOT_FOUND', 'Secret not found');
      }

      // Verify user has read permission
      requireReadPermission(user, metadata.application, metadata.environment);

      // Get the secret ARN (handle both field names)
      const secretArn = (metadata as any).awsSecretArn || (metadata as any).secretArn;
      
      // Fetch tags from AWS Secrets Manager
      const describeCommand = new DescribeSecretCommand({
        SecretId: secretArn,
      });
      const awsSecret = await secretsManagerClient.send(describeCommand);

      // Merge tags
      const awsTags: Record<string, string> = {};
      if (awsSecret.Tags) {
        awsSecret.Tags.forEach(tag => {
          if (tag.Key && tag.Value) {
            awsTags[tag.Key] = tag.Value;
          }
        });
      }

      const secretDetail: SecretDetail = {
        id: metadata.secretId,
        name: (metadata as any).name || (metadata as any).secretName,
        application: metadata.application,
        environment: metadata.environment,
        rotationPeriod: metadata.rotationPeriod,
        lastModified: (metadata as any).lastRotated || (metadata as any).lastModified,
        daysSinceRotation: this.calculateDaysSinceRotation((metadata as any).lastRotated || (metadata as any).lastModified),
        awsRegion: (metadata as any).awsRegion || 'us-east-1',
        tags: { ...metadata.tags, ...awsTags },
        secretArn: secretArn,
        createdAt: (metadata as any).createdAt || (metadata as any).lastRotated,
        createdBy: (metadata as any).owner || (metadata as any).createdBy || 'unknown',
        lastModifiedBy: (metadata as any).owner || (metadata as any).lastModifiedBy || 'unknown',
      };

      res.json(secretDetail);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new secret
   * POST /api/secrets
   */
  async createSecret(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const request: CreateSecretRequest = req.body;

      // Validate required fields
      if (!request.name || !request.application || !request.environment || 
          !request.rotationPeriod || !request.value) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Missing required fields');
      }

      // Validate environment
      if (!['NP', 'PP', 'Prod'].includes(request.environment)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Environment must be NP, PP, or Prod');
      }

      // Validate rotation period
      if (![45, 60, 90].includes(request.rotationPeriod)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Rotation period must be 45, 60, or 90 days');
      }

      // Verify user has write permission
      requireWritePermission(user, request.application, request.environment);

      // Generate secret name
      const secretName = `${request.application}-${request.environment}-${request.name}`;
      const secretId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Create secret in AWS Secrets Manager
      const createCommand = new CreateSecretCommand({
        Name: secretName,
        SecretString: JSON.stringify({
          value: request.value,
          metadata: {
            description: request.description || '',
            owner: request.owner || user.email || '',
          },
        }),
        Tags: [
          { Key: 'Application', Value: request.application },
          { Key: 'Environment', Value: request.environment },
          { Key: 'ManagedBy', Value: 'SecretsPortal' },
          { Key: 'RotationPeriod', Value: request.rotationPeriod.toString() },
        ],
      });

      const awsSecret = await secretsManagerClient.send(createCommand);

      if (!awsSecret.ARN) {
        throw new ApiError(500, 'AWS_ERROR', 'Failed to create secret in AWS Secrets Manager');
      }

      // Store metadata in DynamoDB
      const now = new Date().toISOString();
      await secretsRepo.create({
        secretId,
        secretName: request.name,
        application: request.application,
        environment: request.environment,
        secretArn: awsSecret.ARN,
        rotationPeriod: request.rotationPeriod,
        lastModified: now,
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        tags: {},
        createdAt: now,
        createdBy: user.email || user.userId,
        lastModifiedBy: user.email || user.userId,
        notificationSent: false,
      });

      // Log audit event
      await auditLogRepo.create({
        secretId,
        timestamp: now,
        userId: user.email || user.userId,
        action: 'CREATE',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
      });

      res.status(201).json({ id: secretId, secretArn: awsSecret.ARN });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update secret value
   * PUT /api/secrets/:id
   */
  async updateSecret(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const secretId = req.params.id;
      const request: UpdateSecretRequest = req.body;

      if (!request.value) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Secret value is required');
      }

      const metadata = await secretsRepo.get(secretId);
      if (!metadata) {
        throw new ApiError(404, 'NOT_FOUND', 'Secret not found');
      }

      // Verify user has write permission
      requireWritePermission(user, metadata.application, metadata.environment);

      // Get the secret ARN (handle both field names)
      const secretArn = (metadata as any).awsSecretArn || (metadata as any).secretArn;
      if (!secretArn) {
        throw new ApiError(500, 'INTERNAL_ERROR', 'Secret ARN not found');
      }

      // Update secret in AWS Secrets Manager
      const putCommand = new PutSecretValueCommand({
        SecretId: secretArn,
        SecretString: JSON.stringify({
          value: request.value,
          metadata: {
            description: metadata.tags?.description || '',
            owner: metadata.createdBy,
          },
        }),
      });

      await secretsManagerClient.send(putCommand);

      // Update metadata in DynamoDB - update both lastModified and lastRotated for compatibility
      const now = new Date().toISOString();
      await secretsRepo.update(secretId, {
        lastModified: now,
        lastModifiedBy: user.email || user.userId,
        ...(({ lastRotated: now } as any)), // Also update lastRotated for backward compatibility
      });

      // Log audit event
      await auditLogRepo.create({
        secretId,
        timestamp: now,
        userId: user.email || user.userId,
        action: 'UPDATE',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
        details: 'Secret value updated',
      });

      // Send notification if this is a Prod secret
      if (metadata.environment === 'Prod') {
        await sendProdSecretChangeNotification(
          metadata.secretName,
          metadata.application,
          'UPDATE',
          'Secret value updated',
          user.email || user.userId
        );
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AWS console URL
   * GET /api/secrets/:id/console-url
   */
  async getConsoleUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const secretId = req.params.id;

      const metadata = await secretsRepo.get(secretId);
      if (!metadata) {
        throw new ApiError(404, 'NOT_FOUND', 'Secret not found');
      }

      // Verify user has read permission
      requireReadPermission(user, metadata.application, metadata.environment);

      // Extract secret name from ARN (handle both field names)
      const secretArn = (metadata as any).awsSecretArn || (metadata as any).secretArn;
      if (!secretArn) {
        throw new ApiError(500, 'INTERNAL_ERROR', 'Secret ARN not found');
      }
      
      const region = (metadata as any).awsRegion || 'us-east-1';

      // Generate AWS console URL - use the ARN-based format for direct access
      const consoleUrl = `https://${region}.console.aws.amazon.com/secretsmanager/secret?name=${encodeURIComponent(secretArn)}&region=${region}`;

      // Log console access
      await auditLogRepo.create({
        secretId: metadata.secretId,
        timestamp: new Date().toISOString(),
        userId: user.email || user.userId,
        action: 'CONSOLE_ACCESS',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
      });

      const response: ConsoleUrlResponse = { url: consoleUrl };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update rotation period
   * PUT /api/secrets/:id/rotation
   */
  async updateRotation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const secretId = req.params.id;
      const request: UpdateRotationPeriodRequest = req.body;

      if (!request.rotationPeriod || ![45, 60, 90].includes(request.rotationPeriod)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Rotation period must be 45, 60, or 90 days');
      }

      const metadata = await secretsRepo.get(secretId);
      if (!metadata) {
        throw new ApiError(404, 'NOT_FOUND', 'Secret not found');
      }

      // Verify user has write permission
      requireWritePermission(user, metadata.application, metadata.environment);

      const oldRotationPeriod = metadata.rotationPeriod;

      // Update metadata in DynamoDB
      await secretsRepo.update(secretId, {
        rotationPeriod: request.rotationPeriod,
        lastModifiedBy: user.email || user.userId,
      });

      // Log audit event
      const details = `Rotation period changed from ${oldRotationPeriod} to ${request.rotationPeriod} days`;
      await auditLogRepo.create({
        secretId,
        timestamp: new Date().toISOString(),
        userId: user.email || user.userId,
        action: 'UPDATE',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
        details,
      });

      // Send notification if this is a Prod secret
      if (metadata.environment === 'Prod') {
        await sendProdSecretChangeNotification(
          metadata.secretName,
          metadata.application,
          'ROTATION_CHANGE',
          details,
          user.email || user.userId
        );
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit logs for a secret
   * GET /api/secrets/:id/audit
   */
  async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const secretId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;

      // Verify secret exists and user has read permission
      const metadata = await secretsRepo.get(secretId);
      if (!metadata) {
        throw new ApiError(404, 'NOT_FOUND', 'Secret not found');
      }

      requireReadPermission(user, metadata.application, metadata.environment);

      // Query audit logs
      const result = await auditLogRepo.queryBySecretId(secretId, limit);

      const response: AuditLogResponse = {
        entries: result.items,
        nextToken: result.lastEvaluatedKey ? JSON.stringify(result.lastEvaluatedKey) : undefined,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get access report - all audit logs across all secrets
   * GET /api/reports/access
   */
  async getAccessReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const limit = parseInt(req.query.limit as string) || 1000;

      // Only admins can view full access report
      const isAdmin = user.permissions.some(p => p.app === '*' && p.env === '*');
      if (!isAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'Only administrators can view access reports');
      }

      // Get all audit logs
      const result = await auditLogRepo.scanAll(limit);

      // Get all secrets metadata to enrich the report
      const secretsResult = await secretsRepo.list(1000);
      const secretsMap = new Map(
        secretsResult.items.map(s => [s.secretId, s])
      );

      // Enrich audit logs with secret names
      const enrichedEntries = result.items.map(entry => {
        const metadata = secretsMap.get(entry.secretId);
        
        if (metadata) {
          // Secret found in portal
          return {
            ...entry,
            secretName: metadata.secretName,
            application: metadata.application,
            environment: metadata.environment,
          };
        } else {
          // Secret not in portal (direct AWS access to non-portal secret)
          // Extract secret name from ARN or use the secretId
          let secretName = entry.secretId;
          if (entry.secretId.includes(':secret:')) {
            // Extract name from ARN: arn:aws:secretsmanager:region:account:secret:name-XXXXX
            const parts = entry.secretId.split(':secret:');
            if (parts[1]) {
              secretName = parts[1].split('-')[0]; // Remove the random suffix
            }
          }
          
          return {
            ...entry,
            secretName: `${secretName} (Not in Portal)`,
            application: 'External',
            environment: 'Unknown',
          };
        }
      });

      res.json({
        entries: enrichedEntries,
        total: enrichedEntries.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AWS Console changes report - all direct AWS changes
   * GET /api/reports/console-changes
   */
  async getConsoleChangesReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const limit = parseInt(req.query.limit as string) || 1000;

      // Only admins can view console changes report
      const isAdmin = user.permissions.some(p => p.app === '*' && p.env === '*');
      if (!isAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'Only administrators can view console changes reports');
      }

      // Get all AWS console changes
      const result = await consoleChangesRepo.scanAll(limit);

      res.json({
        entries: result.items,
        total: result.items.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get distinct applications from secrets metadata
   * GET /api/secrets/applications
   */
  async getApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;

      // Get all secrets metadata
      const result = await secretsRepo.list(1000);
      
      // Filter secrets based on user permissions
      const filteredSecrets = filterSecretsByPermissions(result.items.map(this.toSecret.bind(this)), user);
      
      // Extract unique applications
      const applications = [...new Set(
        filteredSecrets.map(secret => secret.application).filter(Boolean)
      )].sort();

      res.json({ applications });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get distinct environments from secrets metadata
   * GET /api/secrets/environments
   */
  async getEnvironments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;

      // Get all secrets metadata
      const result = await secretsRepo.list(1000);
      
      // Filter secrets based on user permissions
      const filteredSecrets = filterSecretsByPermissions(result.items.map(this.toSecret.bind(this)), user);
      
      // Extract unique environments
      const environments = [...new Set(
        filteredSecrets.map(secret => secret.environment).filter(Boolean)
      )].sort();

      res.json({ environments });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  private toSecret(metadata: any): Secret {
    return {
      id: metadata.secretId,
      name: metadata.name || metadata.secretName, // DynamoDB uses 'name', not 'secretName'
      application: metadata.application,
      environment: metadata.environment,
      rotationPeriod: metadata.rotationPeriod,
      lastModified: metadata.lastRotated || metadata.lastModified, // DynamoDB uses 'lastRotated'
      daysSinceRotation: this.calculateDaysSinceRotation(metadata.lastRotated || metadata.lastModified),
      awsRegion: metadata.awsRegion || 'us-east-1',
      tags: metadata.tags || {},
    };
  }

  private calculateDaysSinceRotation(lastModified: string): number {
    if (!lastModified) return 0;
    const lastModifiedDate = new Date(lastModified);
    const now = new Date();
    const diffMs = now.getTime() - lastModifiedDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
