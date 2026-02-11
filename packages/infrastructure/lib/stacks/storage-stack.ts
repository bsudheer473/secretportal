import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Storage stack - DynamoDB tables for metadata and audit logs
 * Implementation details will be added in task 2
 */
export class StorageStack extends Construct {
  public readonly metadataTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Secrets metadata table
    this.metadataTable = new dynamodb.Table(this, 'SecretsMetadata', {
      tableName: 'secrets-metadata',
      partitionKey: {
        name: 'secretId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying by application and environment
    this.metadataTable.addGlobalSecondaryIndex({
      indexName: 'application-index',
      partitionKey: {
        name: 'application',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'environment',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add GSI for querying by environment
    this.metadataTable.addGlobalSecondaryIndex({
      indexName: 'environment-index',
      partitionKey: {
        name: 'environment',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Audit log table
    this.auditLogTable = new dynamodb.Table(this, 'SecretsAuditLog', {
      tableName: 'secrets-audit-log',
      partitionKey: {
        name: 'secretId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
