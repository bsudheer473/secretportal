import {
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

export interface AWSConsoleChange {
  secretArn: string;
  timestamp: string;
  secretName: string;
  application: string;
  environment: string;
  userId: string;
  userType: string;
  action: string;
  eventName: string;
  ipAddress: string;
  userAgent: string;
  region: string;
}

/**
 * Repository for AWS Console Changes (direct AWS access tracking)
 */
export class AWSConsoleChangesRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [100, 200, 400];

  constructor(tableName: string, region?: string) {
    const client = new DynamoDBClient({ region: region || process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

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

        if (
          error instanceof ResourceNotFoundException ||
          error.name === 'ResourceNotFoundException'
        ) {
          throw error;
        }

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

        throw error;
      }
    }

    throw lastError || new Error(`${operation} failed after ${this.maxRetries} attempts`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scan all AWS console changes
   */
  async scanAll(
    limit?: number,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    items: AWSConsoleChange[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const command = new ScanCommand({
      TableName: this.tableName,
      Limit: limit || 1000,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const result = await this.executeWithRetry<{
      Items?: AWSConsoleChange[];
      LastEvaluatedKey?: Record<string, any>;
    }>(command, 'scanAll');

    // Sort by timestamp descending (most recent first)
    const items = (result.Items || []).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
}
