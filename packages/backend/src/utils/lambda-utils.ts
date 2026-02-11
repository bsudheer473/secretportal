/**
 * Base Lambda handler utilities
 * Provides AWS SDK clients, error handling, and response formatting
 */

import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserContext, ErrorResponse } from '@secrets-portal/shared-types';
import { randomUUID } from 'crypto';

/**
 * Initialize AWS SDK clients with proper configuration
 */
export const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const dynamoDBDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * Correlation ID for tracing requests across Lambda invocations
 */
let correlationId: string | undefined;

/**
 * Set correlation ID for the current request
 */
export function setCorrelationId(id: string): void {
  correlationId = id;
}

/**
 * Get or generate correlation ID
 */
export function getCorrelationId(): string {
  if (!correlationId) {
    correlationId = randomUUID();
  }
  return correlationId;
}

/**
 * Structured logging interface
 */
interface LogContext {
  correlationId: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  [key: string]: any;
}

/**
 * Structured logger with JSON format
 */
export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    logStructured('INFO', message, context);
  },
  warn: (message: string, context?: Record<string, any>) => {
    logStructured('WARN', message, context);
  },
  error: (message: string, context?: Record<string, any>) => {
    logStructured('ERROR', message, context);
  },
  debug: (message: string, context?: Record<string, any>) => {
    logStructured('DEBUG', message, context);
  },
};

/**
 * Log structured JSON message
 */
function logStructured(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  message: string,
  context?: Record<string, any>
): void {
  const logEntry: LogContext = {
    correlationId: getCorrelationId(),
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  
  console.log(JSON.stringify(logEntry));
}

/**
 * Log AWS API errors with full details
 */
export function logAwsError(error: any, operation: string): void {
  logger.error('AWS API Error', {
    operation,
    errorName: error.name,
    errorCode: error.code || error.$metadata?.httpStatusCode,
    errorMessage: error.message,
    requestId: error.$metadata?.requestId,
    stackTrace: error.stack,
  });
}

/**
 * Error codes for API responses
 */
export enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AWS_ERROR = 'AWS_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Exponential backoff retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Exponential backoff retry wrapper for AWS API calls
 * Retries up to 3 times with delays: 100ms, 200ms, 400ms
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Log AWS API error
      logAwsError(error, 'withRetry');
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === config.maxAttempts) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delayMs = config.baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn('Retrying operation', {
        attempt,
        maxAttempts: config.maxAttempts,
        delayMs,
        error: lastError.message,
      });
      
      await sleep(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  
  const err = error as { name?: string; code?: string };
  
  // Retry on throttling and service errors
  const retryableErrors = [
    'ThrottlingException',
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'ServiceUnavailable',
    'InternalServiceError',
    'InternalFailure',
  ];
  
  return retryableErrors.includes(err.name || '') || 
         retryableErrors.includes(err.code || '');
}

/**
 * Extract user context from API Gateway authorizer
 */
export function getUserContext(event: APIGatewayProxyEvent): UserContext {
  const authorizer = event.requestContext.authorizer;
  
  if (!authorizer) {
    throw new ApiError(
      ErrorCode.AUTH_FAILED,
      'No authorizer context found',
      401
    );
  }
  
  try {
    // Parse user context from authorizer
    const userId = authorizer.userId || authorizer.principalId;
    const email = authorizer.email;
    const groups = JSON.parse(authorizer.groups || '[]');
    const permissions = JSON.parse(authorizer.permissions || '[]');
    
    if (!userId) {
      throw new Error('User ID not found in authorizer context');
    }
    
    return {
      userId,
      email,
      groups,
      permissions,
    };
  } catch (error) {
    console.error('Failed to parse user context:', error);
    throw new ApiError(
      ErrorCode.AUTH_FAILED,
      'Invalid authorizer context',
      401
    );
  }
}

/**
 * Extract request metadata for audit logging
 */
export function getRequestMetadata(event: APIGatewayProxyEvent) {
  return {
    ipAddress: event.requestContext.identity.sourceIp || 'unknown',
    userAgent: event.requestContext.identity.userAgent || 'unknown',
  };
}

/**
 * CORS headers for API responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Format successful API response with CORS headers
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * Format error API response with CORS headers
 */
export function errorResponse(
  error: ApiError | Error,
  statusCode?: number
): APIGatewayProxyResult {
  let errorCode: string;
  let message: string;
  let status: number;
  let details: unknown;
  
  if (error instanceof ApiError) {
    errorCode = error.code;
    message = error.message;
    status = error.statusCode;
    details = error.details;
  } else {
    // Handle AWS SDK errors
    const awsError = error as { name?: string; message?: string };
    
    if (awsError.name === 'ResourceNotFoundException') {
      errorCode = ErrorCode.NOT_FOUND;
      message = 'Resource not found';
      status = 404;
    } else if (awsError.name === 'InvalidRequestException') {
      errorCode = ErrorCode.VALIDATION_ERROR;
      message = awsError.message || 'Invalid request';
      status = 400;
    } else if (awsError.name === 'ConditionalCheckFailedException') {
      errorCode = ErrorCode.VALIDATION_ERROR;
      message = 'Conditional check failed';
      status = 409;
    } else {
      errorCode = ErrorCode.INTERNAL_ERROR;
      message = 'An unexpected error occurred';
      status = 500;
    }
  }
  
  const errorBody: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      details,
    },
  };
  
  // Log error for monitoring
  logger.error('API Error', {
    code: errorCode,
    message,
    status,
    details,
    stack: error.stack,
  });
  
  return {
    statusCode: statusCode || status,
    headers: CORS_HEADERS,
    body: JSON.stringify(errorBody),
  };
}

/**
 * Lambda handler wrapper with error handling
 */
export function lambdaHandler<T>(
  handler: (event: APIGatewayProxyEvent) => Promise<T>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Generate or extract correlation ID from request
    const requestCorrelationId = event.headers['X-Correlation-ID'] || 
                                  event.headers['x-correlation-id'] || 
                                  randomUUID();
    setCorrelationId(requestCorrelationId);
    
    logger.info('Lambda invocation started', {
      httpMethod: event.httpMethod,
      path: event.path,
      resource: event.resource,
      requestId: event.requestContext.requestId,
    });
    
    try {
      // Handle OPTIONS requests for CORS
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: '',
        };
      }
      
      const result = await handler(event);
      
      logger.info('Lambda invocation completed successfully', {
        httpMethod: event.httpMethod,
        path: event.path,
      });
      
      return successResponse(result);
    } catch (error) {
      logger.error('Lambda invocation failed', {
        httpMethod: event.httpMethod,
        path: event.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return errorResponse(error as Error);
    }
  };
}
