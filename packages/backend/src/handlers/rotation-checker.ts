import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SecretsMetadataRepository } from '../repositories/secrets-metadata-repository';
import { SecretMetadata } from '@secrets-portal/shared-types';
import { logger, setCorrelationId, logAwsError } from '../utils/lambda-utils';
import { randomUUID } from 'crypto';

/**
 * Rotation checker Lambda handler
 * Scans all secrets and sends notifications for those requiring rotation
 */

const snsClient = new SNSClient({ region: process.env.AWS_REGION });
const metadataRepository = new SecretsMetadataRepository(
  process.env.METADATA_TABLE_NAME!
);
const snsTopicArn = process.env.SNS_TOPIC_ARN!;

interface OverdueSecret {
  secretId: string;
  secretName: string;
  application: string;
  environment: string;
  daysSinceRotation: number;
  rotationPeriod: number;
  daysUntilDue: number;
  isOverdue: boolean;
}

interface GroupedSecrets {
  [key: string]: OverdueSecret[];
}

/**
 * Calculate days since last modification
 */
function calculateDaysSinceRotation(lastModified: string): number {
  const lastModifiedDate = new Date(lastModified);
  const currentDate = new Date();
  const diffTime = Math.abs(currentDate.getTime() - lastModifiedDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if a secret needs a reminder notification (7 days before rotation due)
 */
function needsReminderNotification(secret: SecretMetadata): boolean {
  const daysSinceRotation = calculateDaysSinceRotation(secret.lastModified);
  const daysUntilDue = secret.rotationPeriod - daysSinceRotation;
  
  // Send notification 7 days before rotation is due, or if already overdue
  // Only send if notification hasn't been sent yet
  return (daysUntilDue <= 7 || daysUntilDue < 0) && !secret.notificationSent;
}

/**
 * Check if a secret is overdue for rotation
 */
function isOverdue(secret: SecretMetadata): boolean {
  const daysSinceRotation = calculateDaysSinceRotation(secret.lastModified);
  return daysSinceRotation >= secret.rotationPeriod;
}

/**
 * Group overdue secrets by application and environment
 */
function groupSecretsByAppAndEnv(secrets: OverdueSecret[]): GroupedSecrets {
  return secrets.reduce((groups: GroupedSecrets, secret) => {
    const key = `${secret.application}-${secret.environment}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(secret);
    return groups;
  }, {});
}

/**
 * Format notification message for SNS
 */
function formatNotificationMessage(groupedSecrets: GroupedSecrets): string {
  let message = 'Secret Rotation Reminder\n\n';
  message += 'The following secrets require attention for rotation:\n\n';

  for (const [groupKey, secrets] of Object.entries(groupedSecrets)) {
    const [application, environment] = groupKey.split('-');
    message += `\n=== ${application} - ${environment} ===\n`;

    for (const secret of secrets) {
      message += `\n- Secret: ${secret.secretName}\n`;
      message += `  Days Since Rotation: ${secret.daysSinceRotation}\n`;
      message += `  Rotation Period: ${secret.rotationPeriod} days\n`;
      
      if (secret.isOverdue) {
        message += `  Status: OVERDUE by ${Math.abs(secret.daysUntilDue)} days\n`;
      } else {
        message += `  Status: Due in ${secret.daysUntilDue} days\n`;
      }
    }
  }

  message += '\n\nPlease rotate these secrets to maintain security compliance.\n';
  return message;
}

/**
 * Publish notification to SNS topic
 */
async function publishNotification(
  overdueSecrets: OverdueSecret[]
): Promise<void> {
  const groupedSecrets = groupSecretsByAppAndEnv(overdueSecrets);
  const message = formatNotificationMessage(groupedSecrets);

  const command = new PublishCommand({
    TopicArn: snsTopicArn,
    Subject: `Secret Rotation Alert - ${overdueSecrets.length} secret(s) require rotation`,
    Message: message,
  });

  try {
    const result = await snsClient.send(command);
    logger.info('Published SNS notification', {
      messageId: result.MessageId,
      overdueSecretsCount: overdueSecrets.length,
    });
  } catch (error) {
    logAwsError(error, 'publishNotification');
    throw error;
  }
}

/**
 * Update notification flags in DynamoDB
 */
async function updateNotificationFlags(
  secretIds: string[]
): Promise<void> {
  const currentDate = new Date().toISOString();

  for (const secretId of secretIds) {
    try {
      await metadataRepository.update(secretId, {
        notificationSent: true,
        lastNotificationDate: currentDate,
      });
      logger.debug('Updated notification flag', { secretId });
    } catch (error) {
      logger.error('Failed to update notification flag', {
        secretId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue processing other secrets even if one fails
    }
  }
}

/**
 * Scan all secrets and check for rotation requirements
 */
async function scanAllSecrets(): Promise<SecretMetadata[]> {
  const allSecrets: SecretMetadata[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await metadataRepository.list(100, lastEvaluatedKey);
    allSecrets.push(...result.items);
    lastEvaluatedKey = result.lastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allSecrets;
}

/**
 * Main handler function
 */
export async function handler(event: any): Promise<void> {
  // Set correlation ID for tracing
  setCorrelationId(randomUUID());
  
  logger.info('Starting rotation check', {
    eventSource: event.source,
    eventTime: event.time,
  });

  try {
    // Scan all secrets from DynamoDB
    const allSecrets = await scanAllSecrets();
    logger.info('Scanned secrets from DynamoDB', {
      totalSecrets: allSecrets.length,
    });

    // Filter secrets that need reminder notifications (7 days before or overdue)
    const secretsNeedingNotification: OverdueSecret[] = [];

    for (const secret of allSecrets) {
      if (needsReminderNotification(secret)) {
        const daysSinceRotation = calculateDaysSinceRotation(secret.lastModified);
        const daysUntilDue = secret.rotationPeriod - daysSinceRotation;
        const overdueStatus = isOverdue(secret);
        
        secretsNeedingNotification.push({
          secretId: secret.secretId,
          secretName: secret.secretName,
          application: secret.application,
          environment: secret.environment,
          daysSinceRotation,
          rotationPeriod: secret.rotationPeriod,
          daysUntilDue,
          isOverdue: overdueStatus,
        });
      }
    }

    logger.info('Identified secrets needing notification', {
      secretsNeedingNotificationCount: secretsNeedingNotification.length,
    });

    if (secretsNeedingNotification.length === 0) {
      logger.info('No secrets require rotation notifications');
      return;
    }

    // Publish notification to SNS
    await publishNotification(secretsNeedingNotification);

    // Update notification flags in DynamoDB
    const secretIds = secretsNeedingNotification.map((s) => s.secretId);
    await updateNotificationFlags(secretIds);

    logger.info('Rotation check completed successfully', {
      secretsNeedingNotificationCount: secretsNeedingNotification.length,
      notifiedSecrets: secretIds.length,
    });
  } catch (error) {
    logger.error('Rotation check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
