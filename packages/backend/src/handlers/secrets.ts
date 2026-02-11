/**
 * Secrets CRUD Lambda handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Secret, 
  Environment, 
  ListSecretsResponse,
  SecretDetail,
  ConsoleUrlResponse,
  CreateSecretRequest,
  UpdateSecretRequest,
  UpdateRotationPeriodRequest,
  RotationPeriod,
} from '@secrets-portal/shared-types';
import { 
  DescribeSecretCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
  TagResourceCommand,
} from '@aws-sdk/client-secrets-manager';
import { SecretsMetadataRepository } from '../repositories/secrets-metadata-repository';
import { AuditLogRepository } from '../repositories/audit-log-repository';
import {
  lambdaHandler,
  getUserContext,
  getRequestMetadata,
  ApiError,
  ErrorCode,
  secretsManagerClient,
  withRetry,
  logger,
} from '../utils/lambda-utils';
import { filterSecretsByPermissions, requireReadPermission, requireWritePermission } from '../utils/permissions';

const SECRETS_TABLE = process.env.SECRETS_METADATA_TABLE || 'secrets-metadata';
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE || 'secrets-audit-log';
const secretsRepo = new SecretsMetadataRepository(SECRETS_TABLE);
const auditLogRepo = new AuditLogRepository(AUDIT_LOG_TABLE);

/**
 * Calculate days since rotation
 */
function calculateDaysSinceRotation(lastModified: string): number {
  const lastModifiedDate = new Date(lastModified);
  const now = new Date();
  const diffMs = now.getTime() - lastModifiedDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Convert SecretMetadata to Secret
 */
function toSecret(metadata: any): Secret {
  return {
    id: metadata.secretId,
    name: metadata.secretName,
    application: metadata.application,
    environment: metadata.environment,
    rotationPeriod: metadata.rotationPeriod,
    lastModified: metadata.lastModified,
    daysSinceRotation: calculateDaysSinceRotation(metadata.lastModified),
    awsRegion: metadata.awsRegion,
    tags: metadata.tags || {},
  };
}

/**
 * List secrets with optional filtering
 * GET /secrets?application=app1&environment=NP&limit=50&nextToken=xxx
 */
export const listSecrets = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  
  // Parse query parameters
  const application = event.queryStringParameters?.application;
  const environment = event.queryStringParameters?.environment as Environment | undefined;
  const limit = event.queryStringParameters?.limit 
    ? parseInt(event.queryStringParameters.limit, 10) 
    : 50;
  const nextToken = event.queryStringParameters?.nextToken;
  
  // Validate limit
  if (limit < 1 || limit > 100) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Limit must be between 1 and 100',
      400
    );
  }
  
  // Validate environment if provided
  if (environment && !['NP', 'PP', 'Prod'].includes(environment)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Environment must be NP, PP, or Prod',
      400
    );
  }
  
  // Parse nextToken if provided
  let lastEvaluatedKey: Record<string, any> | undefined;
  if (nextToken) {
    try {
      lastEvaluatedKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid nextToken',
        400
      );
    }
  }
  
  // Query DynamoDB based on filters
  let result;
  
  if (application && environment) {
    // Query by application and environment using GSI
    result = await secretsRepo.queryByApplication(
      application,
      environment,
      limit,
      lastEvaluatedKey
    );
  } else if (application) {
    // Query by application only using GSI
    result = await secretsRepo.queryByApplication(
      application,
      undefined,
      limit,
      lastEvaluatedKey
    );
  } else if (environment) {
    // Query by environment using GSI
    result = await secretsRepo.queryByEnvironment(
      environment,
      limit,
      lastEvaluatedKey
    );
  } else {
    // List all secrets (scan)
    result = await secretsRepo.list(limit, lastEvaluatedKey);
  }
  
  // Convert metadata to secrets
  let secrets = result.items.map(toSecret);
  
  // Filter based on user permissions
  secrets = filterSecretsByPermissions(secrets, userContext);
  
  // Encode nextToken if there are more results
  const responseNextToken = result.lastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
    : undefined;
  
  const response: ListSecretsResponse = {
    secrets,
    nextToken: responseNextToken,
  };
  
  return response;
});

/**
 * Get secret metadata with tags from AWS Secrets Manager
 * GET /secrets/{id}
 */
export const getSecretMetadata = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  const secretId = event.pathParameters?.id;
  
  if (!secretId) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret ID is required',
      400
    );
  }
  
  // Fetch metadata from DynamoDB
  const metadata = await secretsRepo.get(secretId);
  
  if (!metadata) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'Secret not found',
      404
    );
  }
  
  // Verify user has read permission
  requireReadPermission(userContext, metadata.application, metadata.environment);
  
  // Fetch tags from AWS Secrets Manager
  const describeCommand = new DescribeSecretCommand({
    SecretId: metadata.secretArn,
  });
  
  const awsSecret = await withRetry(() => secretsManagerClient.send(describeCommand));
  
  // Merge tags from AWS with metadata
  const awsTags: Record<string, string> = {};
  if (awsSecret.Tags) {
    awsSecret.Tags.forEach(tag => {
      if (tag.Key && tag.Value) {
        awsTags[tag.Key] = tag.Value;
      }
    });
  }
  
  // Build detailed response
  const secretDetail: SecretDetail = {
    id: metadata.secretId,
    name: metadata.secretName,
    application: metadata.application,
    environment: metadata.environment,
    rotationPeriod: metadata.rotationPeriod,
    lastModified: metadata.lastModified,
    daysSinceRotation: calculateDaysSinceRotation(metadata.lastModified),
    awsRegion: metadata.awsRegion,
    tags: { ...metadata.tags, ...awsTags },
    secretArn: metadata.secretArn,
    createdAt: metadata.createdAt,
    createdBy: metadata.createdBy,
    lastModifiedBy: metadata.lastModifiedBy,
  };
  
  return secretDetail;
});

/**
 * Get AWS console URL for a secret
 * GET /secrets/{id}/console-url
 */
export const getConsoleUrl = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  const requestMetadata = getRequestMetadata(event);
  const secretId = event.pathParameters?.id;
  
  if (!secretId) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret ID is required',
      400
    );
  }
  
  // Fetch metadata from DynamoDB
  const metadata = await secretsRepo.get(secretId);
  
  if (!metadata) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'Secret not found',
      404
    );
  }
  
  // Verify user has read permission
  requireReadPermission(userContext, metadata.application, metadata.environment);
  
  // Extract secret name from ARN
  // ARN format: arn:aws:secretsmanager:region:account:secret:name-xxxxx
  const arnParts = metadata.secretArn.split(':');
  const secretNameWithSuffix = arnParts[arnParts.length - 1];
  
  // Generate AWS console URL
  const consoleUrl = `https://console.aws.amazon.com/secretsmanager/secret?name=${encodeURIComponent(secretNameWithSuffix)}&region=${metadata.awsRegion}`;
  
  // Log console access event to audit log
  try {
    await auditLogRepo.create({
      secretId: metadata.secretId,
      timestamp: new Date().toISOString(),
      userId: userContext.userId,
      action: 'CONSOLE_ACCESS',
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      success: true,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to log console access', {
      secretId: metadata.secretId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  const response: ConsoleUrlResponse = {
    url: consoleUrl,
  };
  
  return response;
});

/**
 * Create a new secret
 * POST /secrets
 */
export const createSecret = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  
  // Parse request body
  if (!event.body) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Request body is required',
      400
    );
  }
  
  let request: CreateSecretRequest;
  try {
    request = JSON.parse(event.body);
  } catch (error) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      400
    );
  }
  
  // Validate required fields
  if (!request.name || !request.application || !request.environment || 
      !request.rotationPeriod || !request.value) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: name, application, environment, rotationPeriod, value',
      400
    );
  }
  
  // Validate environment
  if (!['NP', 'PP', 'Prod'].includes(request.environment)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Environment must be NP, PP, or Prod',
      400
    );
  }
  
  // Validate rotation period
  if (![45, 60, 90].includes(request.rotationPeriod)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Rotation period must be 45, 60, or 90 days',
      400
    );
  }
  
  // Validate name format (alphanumeric and hyphens only)
  if (!/^[a-zA-Z0-9-]+$/.test(request.name)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret name must contain only alphanumeric characters and hyphens',
      400
    );
  }
  
  // Verify user has write permission
  requireWritePermission(userContext, request.application, request.environment);
  
  // Generate secret name: {application}-{environment}-{name}
  const secretName = `${request.application}-${request.environment}-${request.name}`;
  
  // Generate unique secret ID
  const secretId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  // Prepare secret value with metadata
  const secretValue = JSON.stringify({
    value: request.value,
    metadata: {
      description: request.description || '',
      owner: request.owner || userContext.email || '',
    },
  });
  
  // Create secret in AWS Secrets Manager
  const createCommand = new CreateSecretCommand({
    Name: secretName,
    SecretString: secretValue,
    Tags: [
      { Key: 'Application', Value: request.application },
      { Key: 'Environment', Value: request.environment },
      { Key: 'ManagedBy', Value: 'SecretsPortal' },
      { Key: 'RotationPeriod', Value: request.rotationPeriod.toString() },
    ],
  });
  
  const awsSecret = await withRetry(() => secretsManagerClient.send(createCommand));
  
  if (!awsSecret.ARN) {
    throw new ApiError(
      ErrorCode.AWS_ERROR,
      'Failed to create secret in AWS Secrets Manager',
      500
    );
  }
  
  // Extract region from ARN
  const arnParts = awsSecret.ARN.split(':');
  const awsRegion = arnParts[3];
  
  // Store metadata in DynamoDB
  const now = new Date().toISOString();
  const metadata = {
    secretId,
    secretArn: awsSecret.ARN,
    secretName,
    application: request.application,
    environment: request.environment,
    awsRegion,
    rotationPeriod: request.rotationPeriod,
    createdAt: now,
    lastModified: now,
    createdBy: userContext.userId,
    lastModifiedBy: userContext.userId,
    notificationSent: false,
    tags: {
      Application: request.application,
      Environment: request.environment,
      ManagedBy: 'SecretsPortal',
      RotationPeriod: request.rotationPeriod.toString(),
    },
  };
  
  await secretsRepo.create(metadata);
  
  // Return created secret
  const secret: Secret = toSecret(metadata);
  
  return secret;
});

/**
 * Update a secret value
 * PUT /secrets/{id}
 */
export const updateSecret = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  const requestMetadata = getRequestMetadata(event);
  const secretId = event.pathParameters?.id;
  
  if (!secretId) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret ID is required',
      400
    );
  }
  
  // Parse request body
  if (!event.body) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Request body is required',
      400
    );
  }
  
  let request: UpdateSecretRequest;
  try {
    request = JSON.parse(event.body);
  } catch (error) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      400
    );
  }
  
  // Validate required fields
  if (!request.value) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret value is required',
      400
    );
  }
  
  // Fetch metadata from DynamoDB
  const metadata = await secretsRepo.get(secretId);
  
  if (!metadata) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'Secret not found',
      404
    );
  }
  
  // Verify user has write permission
  requireWritePermission(userContext, metadata.application, metadata.environment);
  
  // Update secret value in AWS Secrets Manager
  const putCommand = new PutSecretValueCommand({
    SecretId: metadata.secretArn,
    SecretString: request.value,
  });
  
  await withRetry(() => secretsManagerClient.send(putCommand));
  
  // Update metadata in DynamoDB
  const now = new Date().toISOString();
  await secretsRepo.update(secretId, {
    lastModified: now,
    lastModifiedBy: userContext.userId,
    notificationSent: false,
    lastNotificationDate: undefined,
  });
  
  // Log update event to audit log
  try {
    await auditLogRepo.create({
      secretId: metadata.secretId,
      timestamp: now,
      userId: userContext.userId,
      action: 'UPDATE',
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      success: true,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to log update event', {
      secretId: metadata.secretId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  return { success: true };
});

/**
 * Update rotation period for a secret
 * PUT /secrets/{id}/rotation
 */
export const updateRotationPeriod = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  const secretId = event.pathParameters?.id;
  
  if (!secretId) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Secret ID is required',
      400
    );
  }
  
  // Parse request body
  if (!event.body) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Request body is required',
      400
    );
  }
  
  let request: UpdateRotationPeriodRequest;
  try {
    request = JSON.parse(event.body);
  } catch (error) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      400
    );
  }
  
  // Validate rotation period
  if (![45, 60, 90].includes(request.rotationPeriod)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Rotation period must be 45, 60, or 90 days',
      400
    );
  }
  
  // Fetch metadata from DynamoDB
  const metadata = await secretsRepo.get(secretId);
  
  if (!metadata) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'Secret not found',
      404
    );
  }
  
  // Verify user has write permission
  requireWritePermission(userContext, metadata.application, metadata.environment);
  
  // Update RotationPeriod tag in AWS Secrets Manager
  const tagCommand = new TagResourceCommand({
    SecretId: metadata.secretArn,
    Tags: [
      { Key: 'RotationPeriod', Value: request.rotationPeriod.toString() },
    ],
  });
  
  await withRetry(() => secretsManagerClient.send(tagCommand));
  
  // Update rotation period in DynamoDB metadata
  await secretsRepo.update(secretId, {
    rotationPeriod: request.rotationPeriod,
    tags: {
      ...metadata.tags,
      RotationPeriod: request.rotationPeriod.toString(),
    },
  });
  
  return { success: true };
});

/**
 * Search secrets by partial text matching
 * GET /secrets/search?q=query&limit=50&nextToken=xxx
 */
export const searchSecrets = lambdaHandler(async (event: APIGatewayProxyEvent) => {
  const userContext = getUserContext(event);
  
  // Parse query parameters
  const query = event.queryStringParameters?.q || '';
  const limit = event.queryStringParameters?.limit 
    ? parseInt(event.queryStringParameters.limit, 10) 
    : 50;
  const nextToken = event.queryStringParameters?.nextToken;
  
  // Validate query
  if (!query || query.trim().length === 0) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Search query is required',
      400
    );
  }
  
  // Validate limit
  if (limit < 1 || limit > 100) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Limit must be between 1 and 100',
      400
    );
  }
  
  // Parse nextToken if provided
  let lastEvaluatedKey: Record<string, any> | undefined;
  if (nextToken) {
    try {
      lastEvaluatedKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid nextToken',
        400
      );
    }
  }
  
  // Perform scan with filter expression for partial text matching
  // Note: This is not the most efficient approach for large datasets
  // In production, consider using Amazon OpenSearch or DynamoDB Streams + Lambda
  const searchQuery = query.toLowerCase();
  
  const result = await secretsRepo.list(limit * 2, lastEvaluatedKey); // Fetch more to account for filtering
  
  // Filter results by partial text matching on name, application, and environment
  let matchingSecrets = result.items.filter(metadata => {
    const nameMatch = metadata.secretName.toLowerCase().includes(searchQuery);
    const appMatch = metadata.application.toLowerCase().includes(searchQuery);
    const envMatch = metadata.environment.toLowerCase().includes(searchQuery);
    return nameMatch || appMatch || envMatch;
  });
  
  // Convert to Secret objects
  let secrets = matchingSecrets.map(toSecret);
  
  // Filter based on user permissions
  secrets = filterSecretsByPermissions(secrets, userContext);
  
  // Limit results
  const limitedSecrets = secrets.slice(0, limit);
  
  // Determine if there are more results
  const hasMore = secrets.length > limit || result.lastEvaluatedKey !== undefined;
  const responseNextToken = hasMore && result.lastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
    : undefined;
  
  const response: ListSecretsResponse = {
    secrets: limitedSecrets,
    nextToken: responseNextToken,
  };
  
  return response;
});

/**
 * Main handler function that routes requests to appropriate handlers
 * This is the entry point for the Lambda function
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.resource || event.path;

  logger.info('Routing request', { method, path });

  try {
    // Route based on method and path
    if (method === 'GET' && path === '/secrets') {
      return await listSecrets(event);
    } else if (method === 'POST' && path === '/secrets') {
      return await createSecret(event);
    } else if (method === 'GET' && path === '/secrets/search') {
      return await searchSecrets(event);
    } else if (method === 'GET' && path === '/secrets/{id}') {
      return await getSecretMetadata(event);
    } else if (method === 'PUT' && path === '/secrets/{id}') {
      return await updateSecret(event);
    } else if (method === 'GET' && path === '/secrets/{id}/console-url') {
      return await getConsoleUrl(event);
    } else if (method === 'PUT' && path === '/secrets/{id}/rotation') {
      return await updateRotationPeriod(event);
    } else {
      // Unknown route
      logger.warn('Route not found', { method, path });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Route not found: ${method} ${path}`,
          },
        }),
      };
    }
  } catch (error) {
    logger.error('Unhandled error in handler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      }),
    };
  }
};
