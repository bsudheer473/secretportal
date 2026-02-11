import { EventBridgeEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SecretsMetadataRepository } from '../repositories/secrets-metadata-repository';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger, setCorrelationId, logAwsError } from '../utils/lambda-utils';
import { randomUUID } from 'crypto';

/**
 * Secrets Change Tracker Lambda handler
 * Captures direct AWS Secrets Manager changes via EventBridge
 * Writes to audit log and sends notifications for Prod changes
 */

const snsClient = new SNSClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const metadataRepository = new SecretsMetadataRepository(
  process.env.METADATA_TABLE_NAME!
);
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE!;
const AWS_CONSOLE_CHANGES_TABLE = process.env.AWS_CONSOLE_CHANGES_TABLE || 'aws-console-changes';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

interface SecretsManagerEvent {
  version: string;
  id: string;
  'detail-type': string;
  source: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    eventVersion: string;
    userIdentity: {
      type: string;
      principalId: string;
      arn: string;
      accountId: string;
      userName?: string;
      sessionContext?: {
        sessionIssuer?: {
          userName?: string;
        };
      };
    };
    eventTime: string;
    eventSource: string;
    eventName: string;
    awsRegion: string;
    sourceIPAddress: string;
    userAgent: string;
    requestParameters: {
      secretId: string;
      versionStages?: string[];
    };
    responseElements: any;
    requestID: string;
    eventID: string;
    readOnly: boolean;
    eventType: string;
  };
}

/**
 * Extract user identifier from CloudTrail event
 */
function extractUserId(userIdentity: any): string {
  if (userIdentity.userName) {
    return userIdentity.userName;
  }
  if (userIdentity.sessionContext?.sessionIssuer?.userName) {
    return userIdentity.sessionContext.sessionIssuer.userName;
  }
  if (userIdentity.arn) {
    // Extract user/role name from ARN
    const arnParts = userIdentity.arn.split('/');
    return arnParts[arnParts.length - 1];
  }
  return userIdentity.principalId || 'Unknown';
}

/**
 * Map CloudTrail event name to audit action
 */
function mapEventToAction(eventName: string): string {
  const actionMap: Record<string, string> = {
    'PutSecretValue': 'UPDATE',
    'UpdateSecret': 'UPDATE',
    'CreateSecret': 'CREATE',
    'DeleteSecret': 'DELETE',
    'GetSecretValue': 'READ',
    'DescribeSecret': 'READ',
  };
  return actionMap[eventName] || eventName;
}

/**
 * Get secret metadata from DynamoDB by ARN
 */
async function getSecretByArn(secretArn: string): Promise<any | null> {
  try {
    const result = await metadataRepository.list(1000);
    const secret = result.items.find(
      (s: any) => s.secretArn === secretArn || s.awsSecretArn === secretArn
    );
    return secret || null;
  } catch (error) {
    logger.error('Failed to get secret by ARN', { secretArn, error });
    return null;
  }
}

/**
 * Write to AWS Console Changes table (separate from portal audit log)
 */
async function writeConsoleChange(
  secretArn: string,
  secretName: string,
  application: string,
  environment: string,
  userId: string,
  userType: string,
  action: string,
  eventName: string,
  ipAddress: string,
  userAgent: string,
  region: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const command = new PutCommand({
    TableName: AWS_CONSOLE_CHANGES_TABLE,
    Item: {
      secretArn,
      timestamp: new Date().toISOString(),
      secretName,
      application,
      environment,
      userId,
      userType, // IAMUser, AssumedRole, Root, etc.
      action,
      eventName, // Original CloudTrail event name
      ipAddress,
      userAgent,
      region,
      ttl,
    },
  });

  try {
    await docClient.send(command);
    logger.info('Wrote AWS console change entry', { secretArn, userId, action });
  } catch (error) {
    logAwsError(error, 'writeConsoleChange');
    throw error;
  }
}

/**
 * Write audit log entry to DynamoDB (legacy portal audit log)
 */
async function writeAuditLog(
  secretId: string,
  userId: string,
  action: string,
  ipAddress: string,
  userAgent: string,
  details: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const command = new PutCommand({
    TableName: AUDIT_LOG_TABLE,
    Item: {
      secretId,
      timestamp: new Date().toISOString(),
      userId,
      action,
      ipAddress,
      userAgent,
      success: true,
      details,
      ttl,
    },
  });

  try {
    await docClient.send(command);
    logger.info('Wrote audit log entry', { secretId, userId, action });
  } catch (error) {
    logAwsError(error, 'writeAuditLog');
    throw error;
  }
}

/**
 * Send SNS notification for Prod changes
 */
async function sendProdChangeNotification(
  secretName: string,
  application: string,
  userId: string,
  action: string,
  details: string
): Promise<void> {
  if (!SNS_TOPIC_ARN) {
    logger.warn('SNS_TOPIC_ARN not configured, skipping notification');
    return;
  }

  const message = `Production Secret Change Alert (Direct AWS Access)\n\n` +
    `Action: ${action}\n` +
    `Secret: ${secretName}\n` +
    `Application: ${application}\n` +
    `Environment: Prod\n` +
    `Modified By: ${userId} (via AWS Console/CLI/SDK)\n` +
    `Details: ${details}\n` +
    `Timestamp: ${new Date().toISOString()}\n\n` +
    `This change was made directly in AWS, not through the Secrets Portal.`;

  try {
    const command = new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `[PROD] Direct AWS Change - ${secretName}`,
      Message: message,
    });

    await snsClient.send(command);
    logger.info('Sent Prod change notification', { secretName, userId });
  } catch (error) {
    logAwsError(error, 'sendProdChangeNotification');
    // Don't throw - notification failure shouldn't block audit logging
  }
}

/**
 * Main handler function
 */
export async function handler(
  event: EventBridgeEvent<string, SecretsManagerEvent['detail']>
): Promise<void> {
  setCorrelationId(randomUUID());

  logger.info('Processing Secrets Manager event', {
    eventName: event.detail.eventName,
    secretId: event.detail.requestParameters?.secretId,
  });

  try {
    const { detail } = event;
    const { eventName, userIdentity, sourceIPAddress, userAgent, requestParameters } = detail;

    // Skip read-only events (GetSecretValue, DescribeSecret) to avoid noise
    if (eventName === 'GetSecretValue' || eventName === 'DescribeSecret') {
      logger.debug('Skipping read-only event', { eventName });
      return;
    }

    const secretArn = requestParameters.secretId;
    if (!secretArn) {
      logger.warn('No secretId in event', { eventName });
      return;
    }

    const userId = extractUserId(userIdentity);
    const action = mapEventToAction(eventName);
    const details = `Direct AWS change: ${eventName} by ${userIdentity.type}`;

    // Get secret metadata from DynamoDB
    const metadata = await getSecretByArn(secretArn);
    
    if (metadata) {
      // Secret found in portal - write to both tables
      
      // Write to AWS Console Changes table (new, detailed)
      await writeConsoleChange(
        secretArn,
        metadata.secretName,
        metadata.application,
        metadata.environment,
        userId,
        userIdentity.type,
        action,
        eventName,
        sourceIPAddress,
        userAgent,
        detail.awsRegion
      );

      // Write to legacy audit log (for backward compatibility)
      await writeAuditLog(
        metadata.secretId,
        userId,
        action,
        sourceIPAddress,
        userAgent,
        details
      );

      // Send notification if Prod environment
      if (metadata.environment === 'Prod') {
        await sendProdChangeNotification(
          metadata.secretName,
          metadata.application,
          userId,
          action,
          details
        );
      }

      logger.info('Successfully processed Secrets Manager event', {
        secretId: metadata.secretId,
        secretName: metadata.secretName,
        environment: metadata.environment,
        userId,
        action,
      });
    } else {
      // Secret not in portal - still write to AWS Console Changes table
      let secretName = secretArn;
      if (secretArn.includes(':secret:')) {
        const parts = secretArn.split(':secret:');
        if (parts[1]) {
          secretName = parts[1];
        }
      }

      await writeConsoleChange(
        secretArn,
        secretName,
        'External',
        'Unknown',
        userId,
        userIdentity.type,
        action,
        eventName,
        sourceIPAddress,
        userAgent,
        detail.awsRegion
      );

      // Also write to legacy audit log
      await writeAuditLog(
        secretArn,
        userId,
        action,
        sourceIPAddress,
        userAgent,
        `${details} (Secret not in portal)`
      );

      logger.info('Processed external secret change', {
        secretArn,
        secretName,
        userId,
        action,
      });
    }
  } catch (error) {
    logger.error('Failed to process Secrets Manager event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
