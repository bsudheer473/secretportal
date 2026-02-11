import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UserContext, Permission } from '../types';

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create JWT verifier for ID tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
});

export interface AuthRequest extends Request {
  user?: UserContext;
}

/**
 * Authentication middleware
 * Verifies Cognito JWT token and attaches user context to request
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'AUTH_FAILED',
          message: 'Missing or invalid authorization header',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const payload = await verifier.verify(token);

    // Extract user information
    const userId = payload.sub;
    const email = payload.email as string;
    const groups = (payload['cognito:groups'] as string[]) || [];

    // Get user permissions from groups
    const permissions = getUserPermissions(groups);

    // Attach user context to request
    req.user = {
      userId,
      email,
      groups,
      permissions,
    };

    next();
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Map Cognito groups to application/environment permissions
 */
function getUserPermissions(cognitoGroups: string[]): Permission[] {
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
