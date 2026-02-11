/**
 * Authentication Lambda authorizer for API Gateway
 * Validates JWT tokens from Cognito and generates IAM policies
 */

import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResultContext,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Permission, UserContext } from '@secrets-portal/shared-types';
import { logger, setCorrelationId } from '../utils/lambda-utils';
import { randomUUID } from 'crypto';

// Environment variables
const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create JWT verifier for ID tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
});

/**
 * Lambda authorizer handler
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  // Set correlation ID for tracing
  setCorrelationId(randomUUID());
  
  logger.info('Authorization request received', {
    methodArn: event.methodArn,
  });
  
  try {
    const token = event.authorizationToken.replace('Bearer ', '');

    // Verify JWT token
    const payload = await verifier.verify(token);

    // Extract user information
    const userId = payload.sub;
    const email = payload.email as string;
    const groups = (payload['cognito:groups'] as string[]) || [];

    logger.info('Token verified successfully', {
      userId,
      email,
      groups,
    });

    // Get user permissions from groups
    const permissions = getUserPermissions(groups);

    // Parse resource ARN to check access
    const { application, environment, method } = parseResourceArn(event.methodArn);

    // Check if user has access to this resource
    const hasAccess = checkAccess(permissions, application, environment, method);

    logger.info('Access decision made', {
      userId,
      hasAccess,
      application,
      environment,
      method,
    });

    // Create user context for downstream Lambdas
    const userContext: UserContext = {
      userId,
      email,
      groups,
      permissions,
    };

    // Generate IAM policy
    const policy = generatePolicy(
      userId,
      hasAccess ? 'Allow' : 'Deny',
      event.methodArn,
      userContext
    );

    return policy;
  } catch (error) {
    logger.error('Authorization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return deny policy on any error
    throw new Error('Unauthorized');
  }
};

/**
 * Map Cognito groups to application/environment permissions
 */
export function getUserPermissions(cognitoGroups: string[]): Permission[] {
  const permissions: Permission[] = [];

  for (const group of cognitoGroups) {
    if (group === 'secrets-admin') {
      // Admin has full access to all apps and environments
      permissions.push({ app: '*', env: '*', access: 'write' });
    } else if (group.endsWith('-developer')) {
      // Developer has read/write access to NP and PP
      const app = group.replace('-developer', '');
      permissions.push({ app, env: 'NP', access: 'write' });
      permissions.push({ app, env: 'PP', access: 'write' });
    } else if (group.endsWith('-prod-viewer')) {
      // Prod viewer has read-only access to Prod
      const app = group.replace('-prod-viewer', '');
      permissions.push({ app, env: 'Prod', access: 'read' });
    }
  }

  return permissions;
}

/**
 * Parse API Gateway resource ARN to extract application and environment
 * Example ARN: arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/secrets
 */
interface ResourceInfo {
  application?: string;
  environment?: string;
  method: string;
}

function parseResourceArn(methodArn: string): ResourceInfo {
  const parts = methodArn.split('/');
  const method = parts[2] || 'GET';
  const resource = parts[3] || '';

  // Extract application and environment from query parameters or path
  // This is a simplified version - actual implementation would parse from request context
  return {
    method,
    application: undefined, // Will be checked at runtime in Lambda functions
    environment: undefined, // Will be checked at runtime in Lambda functions
  };
}

/**
 * Check if user has access to the requested resource
 */
function checkAccess(
  permissions: Permission[],
  application?: string,
  environment?: string,
  method?: string
): boolean {
  // If no specific app/env in the ARN, allow (will be checked in Lambda)
  if (!application || !environment) {
    return permissions.length > 0;
  }

  // Check if user has permission for this app/env combination
  for (const perm of permissions) {
    // Admin wildcard access
    if (perm.app === '*' && perm.env === '*') {
      return true;
    }

    // Check specific app/env match
    if (perm.app === application && perm.env === environment) {
      // For write operations, need write permission
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        return perm.access === 'write';
      }
      // For read operations, any access is sufficient
      return true;
    }
  }

  return false;
}

/**
 * Generate IAM policy document for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  userContext: UserContext
): APIGatewayAuthorizerResult {
  // Create context object for downstream Lambdas
  const context: APIGatewayAuthorizerResultContext = {
    userId: userContext.userId,
    email: userContext.email,
    groups: JSON.stringify(userContext.groups),
    permissions: JSON.stringify(userContext.permissions),
  };

  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };

  return authResponse;
}
