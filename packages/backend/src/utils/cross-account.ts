/**
 * Cross-Account Access Utility
 *
 * Assumes an IAM role in another AWS account to access Secrets Manager.
 *
 * Environment Variables:
 * - CROSS_ACCOUNT_ROLE_ARN: Role ARN in Account B (secrets account)
 *   Example: arn:aws:iam::123456789012:role/SecretsPortalCrossAccountRole
 * - CROSS_ACCOUNT_REGION: Region where secrets live (defaults to AWS_REGION)
 */

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { logger } from './lambda-utils';

const stsClient = new STSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Cache for assumed role credentials
let cachedCredentials: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
} | null = null;

/**
 * Check if cross-account access is configured
 */
export function isCrossAccountEnabled(): boolean {
  return !!process.env.CROSS_ACCOUNT_ROLE_ARN;
}

/**
 * Get the region for the secrets account
 */
export function getCrossAccountRegion(): string {
  return process.env.CROSS_ACCOUNT_REGION || process.env.AWS_REGION || 'us-east-1';
}

/**
 * Assume the cross-account role and return temporary credentials.
 * Credentials are cached until 5 minutes before expiration.
 */
async function assumeCrossAccountRole(): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}> {
  // Check if cached credentials are still valid (with 5-minute buffer)
  if (cachedCredentials) {
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;
    if (cachedCredentials.expiration.getTime() - now.getTime() > bufferMs) {
      return cachedCredentials;
    }
  }

  const roleArn = process.env.CROSS_ACCOUNT_ROLE_ARN!;

  logger.info('Assuming cross-account role', { roleArn });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `secrets-portal-${Date.now()}`,
    DurationSeconds: 3600,
  });

  const response = await stsClient.send(command);

  if (!response.Credentials) {
    throw new Error('Failed to assume cross-account role: no credentials returned');
  }

  cachedCredentials = {
    accessKeyId: response.Credentials.AccessKeyId!,
    secretAccessKey: response.Credentials.SecretAccessKey!,
    sessionToken: response.Credentials.SessionToken!,
    expiration: response.Credentials.Expiration!,
  };

  logger.info('Successfully assumed cross-account role', {
    roleArn,
    expiration: cachedCredentials.expiration.toISOString(),
  });

  return cachedCredentials;
}

/**
 * Get a Secrets Manager client configured for cross-account access.
 * If CROSS_ACCOUNT_ROLE_ARN is not set, returns a client for the current account.
 */
export async function getSecretsManagerClient(): Promise<SecretsManagerClient> {
  if (!isCrossAccountEnabled()) {
    return new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  const credentials = await assumeCrossAccountRole();
  const region = getCrossAccountRegion();

  return new SecretsManagerClient({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}
