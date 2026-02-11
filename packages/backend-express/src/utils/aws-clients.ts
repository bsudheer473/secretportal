import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';

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

export const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
