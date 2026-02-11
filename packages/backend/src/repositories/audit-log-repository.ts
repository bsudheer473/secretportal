import {
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AuditLogEntry } from '@secrets-portal/shared-types';

/**
 * Repository for managing audit log entries in DynamoDB
 * Implements exponential backoff retry logic for throttling errors
 */
export class AuditLogRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [100, 200, 400]; // milliseconds

  constructor(tableName: string, region?: string) {
    const client = new DynamoDBClient({ region: region || process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Execute a command with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    command: any,
    operation: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.docClient.send(command);
        return result as T;
      } catch (error: any) {
        lastError = error;

        // Don't retry on resource not found
        if (
          error instanceof ResourceNotFoundException ||
          error.name === 'ResourceNotFoundException'
        ) {
          throw error;
        }

        // Retry on throttling errors
        if (
          error.name === 'ThrottlingException' ||
          error.name === 'ProvisionedThroughputExceededException'
        ) {
          if (attempt < this.maxRetries - 1) {
            const delay = this.retryDelays[attempt];
            console.log(
              `${operation} throttled, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`
            );
            await this.sleep(delay);
            continue;
          }
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError || new Error(`${operation} failed after ${this.maxRetries} attempts`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a new audit log entry
   * Automatically sets TTL to 90 days from now
   */
  async create(entry: AuditLogEntry): Promise<void> {
    // Calculate TTL (90 days from now in seconds since epoch)
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...entry,
        ttl,
      },
    });

    await this.executeWithRetry(command, 'create audit log');
  }

  /**
   * Query audit log entries by secret ID
   * Returns entries sorted by timestamp in descending order (most recent first)
   */
  async queryBySecretId(
    secretId: string,
    limit?: number,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    items: AuditLogEntry[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'secretId = :secretId',
      ExpressionAttributeValues: { ':secretId': secretId },
      ScanIndexForward: false, // Sort in descending order (most recent first)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const result = await this.executeWithRetry<{
      Items?: AuditLogEntry[];
      LastEvaluatedKey?: Record<string, any>;
    }>(command, 'queryBySecretId');

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
}
