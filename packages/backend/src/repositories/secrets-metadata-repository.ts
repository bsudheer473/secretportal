import {
  DynamoDBClient,
  ConditionalCheckFailedException,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { SecretMetadata, Environment } from '@secrets-portal/shared-types';

/**
 * Repository for managing secrets metadata in DynamoDB
 * Implements exponential backoff retry logic for throttling errors
 */
export class SecretsMetadataRepository {
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

        // Don't retry on conditional check failures or resource not found
        if (
          error instanceof ConditionalCheckFailedException ||
          error instanceof ResourceNotFoundException ||
          error.name === 'ConditionalCheckFailedException' ||
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
   * Create a new secret metadata entry
   */
  async create(metadata: SecretMetadata): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: metadata,
      ConditionExpression: 'attribute_not_exists(secretId)',
    });

    try {
      await this.executeWithRetry(command, 'create');
    } catch (error: any) {
      if (
        error instanceof ConditionalCheckFailedException ||
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new Error(`Secret with ID ${metadata.secretId} already exists`);
      }
      throw error;
    }
  }

  /**
   * Update an existing secret metadata entry
   */
  async update(
    secretId: string,
    updates: Partial<Omit<SecretMetadata, 'secretId'>>
  ): Promise<void> {
    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    if (updateExpressions.length === 0) {
      return; // Nothing to update
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { secretId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(secretId)',
    });

    try {
      await this.executeWithRetry(command, 'update');
    } catch (error: any) {
      if (
        error instanceof ConditionalCheckFailedException ||
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new Error(`Secret with ID ${secretId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get a secret metadata entry by ID
   */
  async get(secretId: string): Promise<SecretMetadata | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { secretId },
    });

    try {
      const result = await this.executeWithRetry<{ Item?: SecretMetadata }>(
        command,
        'get'
      );
      return result.Item || null;
    } catch (error: any) {
      if (
        error instanceof ResourceNotFoundException ||
        error.name === 'ResourceNotFoundException'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all secret metadata entries
   */
  async list(limit?: number, lastEvaluatedKey?: Record<string, any>): Promise<{
    items: SecretMetadata[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const command = new ScanCommand({
      TableName: this.tableName,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const result = await this.executeWithRetry<{
      Items?: SecretMetadata[];
      LastEvaluatedKey?: Record<string, any>;
    }>(command, 'list');

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query secrets by application and optionally by environment
   */
  async queryByApplication(
    application: string,
    environment?: Environment,
    limit?: number,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    items: SecretMetadata[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'application-index',
      KeyConditionExpression: environment
        ? 'application = :app AND environment = :env'
        : 'application = :app',
      ExpressionAttributeValues: environment
        ? { ':app': application, ':env': environment }
        : { ':app': application },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const result = await this.executeWithRetry<{
      Items?: SecretMetadata[];
      LastEvaluatedKey?: Record<string, any>;
    }>(command, 'queryByApplication');

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query secrets by environment
   */
  async queryByEnvironment(
    environment: Environment,
    limit?: number,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    items: SecretMetadata[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'environment-index',
      KeyConditionExpression: 'environment = :env',
      ExpressionAttributeValues: { ':env': environment },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const result = await this.executeWithRetry<{
      Items?: SecretMetadata[];
      LastEvaluatedKey?: Record<string, any>;
    }>(command, 'queryByEnvironment');

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
}
