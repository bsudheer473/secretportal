import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface EventBridgeStackProps extends cdk.StackProps {
  environment: string;
  metadataTableName: string;
  auditLogTableName: string;
  snsTopicArn?: string;
}

export class EventBridgeStack extends cdk.Stack {
  public readonly changeTrackerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props);

    const { environment, metadataTableName, auditLogTableName, snsTopicArn } = props;

    // Lambda function to track secrets changes
    this.changeTrackerFunction = new lambda.Function(this, 'SecretsChangeTracker', {
      functionName: `secrets-change-tracker-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'secrets-change-tracker.handler',
      code: lambda.Code.fromAsset('../../backend/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        METADATA_TABLE_NAME: metadataTableName,
        AUDIT_LOG_TABLE: auditLogTableName,
        SNS_TOPIC_ARN: snsTopicArn || '',
        AWS_REGION: this.region,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Tracks direct AWS Secrets Manager changes and writes to audit log',
    });

    // Grant permissions to read metadata table
    this.changeTrackerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${metadataTableName}`,
        ],
      })
    );

    // Grant permissions to write to audit log table
    this.changeTrackerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${auditLogTableName}`,
        ],
      })
    );

    // Grant permissions to publish to SNS (if configured)
    if (snsTopicArn) {
      this.changeTrackerFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['sns:Publish'],
          resources: [snsTopicArn],
        })
      );
    }

    // EventBridge rule to capture Secrets Manager events
    const secretsManagerRule = new events.Rule(this, 'SecretsManagerEventsRule', {
      ruleName: `secrets-manager-changes-${environment}`,
      description: 'Captures AWS Secrets Manager change events',
      eventPattern: {
        source: ['aws.secretsmanager'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['secretsmanager.amazonaws.com'],
          eventName: [
            'PutSecretValue',
            'UpdateSecret',
            'CreateSecret',
            'DeleteSecret',
            // Optionally include read events (will create more logs)
            // 'GetSecretValue',
            // 'DescribeSecret',
          ],
        },
      },
    });

    // Add Lambda as target
    secretsManagerRule.addTarget(
      new targets.LambdaFunction(this.changeTrackerFunction, {
        retryAttempts: 2,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'ChangeTrackerFunctionArn', {
      value: this.changeTrackerFunction.functionArn,
      description: 'Secrets Change Tracker Lambda Function ARN',
      exportName: `${environment}-secrets-change-tracker-arn`,
    });

    new cdk.CfnOutput(this, 'EventBridgeRuleName', {
      value: secretsManagerRule.ruleName,
      description: 'EventBridge Rule Name',
      exportName: `${environment}-secrets-eventbridge-rule`,
    });

    // Tags
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'SecretsPortal');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
