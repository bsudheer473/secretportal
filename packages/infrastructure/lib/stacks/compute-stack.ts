import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ComputeStackProps {
  metadataTable: dynamodb.Table;
  auditLogTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

/**
 * Compute stack - Lambda functions
 * Lambda authorizer and other functions
 */
export class ComputeStack extends Construct {
  public readonly authorizerFunction: lambda.Function;
  public readonly rotationCheckerFunction: lambda.Function;
  public readonly rotationTopic: sns.Topic;
  public readonly secretsFunction: lambda.Function;
  
  private metadataTable: dynamodb.Table;
  private auditLogTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id);

    this.metadataTable = props.metadataTable;
    this.auditLogTable = props.auditLogTable;

    // Create CloudWatch Log Groups with 30-day retention for all Lambda functions
    const authorizerLogGroup = new logs.LogGroup(this, 'AuthorizerLogGroup', {
      logGroupName: '/aws/lambda/secrets-portal-authorizer',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const secretsLogGroup = new logs.LogGroup(this, 'SecretsLogGroup', {
      logGroupName: '/aws/lambda/secrets-portal-secrets',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const rotationCheckerLogGroup = new logs.LogGroup(this, 'RotationCheckerLogGroup', {
      logGroupName: '/aws/lambda/secrets-portal-rotation-checker',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda authorizer for API Gateway
    this.authorizerFunction = new lambda.Function(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/auth.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        USER_POOL_ID: props.userPool.userPoolId,
        CLIENT_ID: props.userPoolClient.userPoolClientId,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'Lambda authorizer for API Gateway - validates Cognito JWT tokens',
      logGroup: authorizerLogGroup,
    });

    // Secrets CRUD Lambda function
    this.secretsFunction = new lambda.Function(this, 'SecretsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/secrets.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        SECRETS_METADATA_TABLE: props.metadataTable.tableName,
        AUDIT_LOG_TABLE: props.auditLogTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'Handles all secrets CRUD operations',
      logGroup: secretsLogGroup,
    });

    // Grant permissions to secrets Lambda
    props.metadataTable.grantReadWriteData(this.secretsFunction);
    props.auditLogTable.grantWriteData(this.secretsFunction);
    
    // Grant Secrets Manager permissions
    this.secretsFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:DescribeSecret',
        'secretsmanager:CreateSecret',
        'secretsmanager:UpdateSecret',
        'secretsmanager:PutSecretValue',
        'secretsmanager:ListSecrets',
        'secretsmanager:TagResource',
        'secretsmanager:GetResourcePolicy',
      ],
      resources: ['*'],
    }));

    // SNS topic for rotation notifications
    this.rotationTopic = new sns.Topic(this, 'RotationNotificationTopic', {
      displayName: 'Secret Rotation Notifications',
      topicName: 'secrets-rotation-notifications',
    });

    // Add email subscription for rotation notifications
    // Note: Email addresses should be configured via environment variables or parameters
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'admin@example.com';
    this.rotationTopic.addSubscription(
      new subscriptions.EmailSubscription(notificationEmail)
    );

    // Rotation checker Lambda function
    this.rotationCheckerFunction = new lambda.Function(this, 'RotationCheckerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/rotation-checker.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        METADATA_TABLE_NAME: props.metadataTable.tableName,
        SNS_TOPIC_ARN: this.rotationTopic.topicArn,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      description: 'Checks secrets for rotation requirements and sends notifications',
      logGroup: rotationCheckerLogGroup,
    });

    // Grant permissions to rotation checker Lambda
    props.metadataTable.grantReadWriteData(this.rotationCheckerFunction);
    this.rotationTopic.grantPublish(this.rotationCheckerFunction);

    // EventBridge rule for daily rotation checks at 09:00 UTC
    const rotationCheckRule = new events.Rule(this, 'RotationCheckRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '9',
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Triggers rotation checker Lambda daily at 09:00 UTC',
    });

    // Add rotation checker Lambda as target
    rotationCheckRule.addTarget(new targets.LambdaFunction(this.rotationCheckerFunction));

    // Grant EventBridge permission to invoke Lambda
    this.rotationCheckerFunction.addPermission('AllowEventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: rotationCheckRule.ruleArn,
    });

    // Output SNS topic ARN
    new cdk.CfnOutput(scope, 'RotationTopicArn', {
      value: this.rotationTopic.topicArn,
      description: 'SNS Topic ARN for rotation notifications',
    });
  }

  /**
   * Set API Gateway and create Lambda integrations
   * Called after NetworkingStack is created
   */
  public setApi(api: apigateway.RestApi, authorizer: apigateway.TokenAuthorizer): void {
    // This method will be used by NetworkingStack to wire up Lambda integrations
    // The actual endpoint creation is done in NetworkingStack
  }
}
