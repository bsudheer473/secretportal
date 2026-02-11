import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps {
  api: apigateway.RestApi;
  authorizerFunction: lambda.Function;
  secretsFunction: lambda.Function;
  rotationCheckerFunction: lambda.Function;
  metadataTable: dynamodb.Table;
  auditLogTable: dynamodb.Table;
}

/**
 * Monitoring stack - CloudWatch dashboards and alarms
 * Provides comprehensive monitoring for the Secrets Management Portal
 */
export class MonitoringStack extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id);

    // Create SNS topic for alarm notifications
    this.alarmTopic = new sns.Topic(this, 'AlarmNotificationTopic', {
      displayName: 'Secrets Portal Alarms',
      topicName: 'secrets-portal-alarms',
    });

    // Add email subscription for alarm notifications
    // Note: Email addresses should be configured via environment variables or parameters
    const alarmEmail = process.env.ALARM_EMAIL || 'admin@example.com';
    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(alarmEmail)
    );

    // Create main dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'SecretsPortalDashboard', {
      dashboardName: 'SecretsManagementPortal',
    });

    // Add API Gateway metrics
    this.addApiGatewayMetrics(props.api);

    // Add Lambda metrics
    this.addLambdaMetrics(
      props.authorizerFunction,
      props.secretsFunction,
      props.rotationCheckerFunction
    );

    // Add DynamoDB metrics
    this.addDynamoDBMetrics(props.metadataTable, props.auditLogTable);

    // Add Secrets Manager metrics
    this.addSecretsManagerMetrics();

    // Create CloudWatch alarms
    this.createAlarms(
      props.api,
      props.authorizerFunction,
      props.secretsFunction,
      props.rotationCheckerFunction,
      props.metadataTable,
      props.auditLogTable
    );
  }

  /**
   * Add API Gateway metrics to dashboard
   */
  private addApiGatewayMetrics(api: apigateway.RestApi): void {
    // API Gateway request count
    const requestCountMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // API Gateway latency (p50 and p99)
    const latencyP50Metric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'p50',
      period: cdk.Duration.minutes(5),
    });

    const latencyP99Metric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'p99',
      period: cdk.Duration.minutes(5),
    });

    // API Gateway 4xx errors
    const error4xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // API Gateway 5xx errors
    const error5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add API Gateway widgets to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Request Count',
        left: [requestCountMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency (p50 & p99)',
        left: [latencyP50Metric, latencyP99Metric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - 4xx Errors',
        left: [error4xxMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - 5xx Errors',
        left: [error5xxMetric],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * Add Lambda metrics to dashboard
   */
  private addLambdaMetrics(
    authorizerFunction: lambda.Function,
    secretsFunction: lambda.Function,
    rotationCheckerFunction: lambda.Function
  ): void {
    const functions = [
      { name: 'Authorizer', func: authorizerFunction },
      { name: 'Secrets', func: secretsFunction },
      { name: 'Rotation Checker', func: rotationCheckerFunction },
    ];

    for (const { name, func } of functions) {
      // Invocation count
      const invocationMetric = func.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Duration
      const durationMetric = func.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // Errors
      const errorMetric = func.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Throttles
      const throttleMetric = func.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Concurrent executions
      const concurrentMetric = new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        dimensionsMap: {
          FunctionName: func.functionName,
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      });

      // Add Lambda widgets to dashboard
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `Lambda ${name} - Invocations & Errors`,
          left: [invocationMetric],
          right: [errorMetric],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: `Lambda ${name} - Duration & Throttles`,
          left: [durationMetric],
          right: [throttleMetric],
          width: 12,
          height: 6,
        })
      );
    }

    // Add concurrent executions widget for all functions
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda - Concurrent Executions',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'ConcurrentExecutions',
            dimensionsMap: {
              FunctionName: authorizerFunction.functionName,
            },
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5),
            label: 'Authorizer',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'ConcurrentExecutions',
            dimensionsMap: {
              FunctionName: secretsFunction.functionName,
            },
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5),
            label: 'Secrets',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'ConcurrentExecutions',
            dimensionsMap: {
              FunctionName: rotationCheckerFunction.functionName,
            },
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5),
            label: 'Rotation Checker',
          }),
        ],
        width: 24,
        height: 6,
      })
    );
  }

  /**
   * Add DynamoDB metrics to dashboard
   */
  private addDynamoDBMetrics(
    metadataTable: dynamodb.Table,
    auditLogTable: dynamodb.Table
  ): void {
    const tables = [
      { name: 'Metadata', table: metadataTable },
      { name: 'Audit Log', table: auditLogTable },
    ];

    for (const { name, table } of tables) {
      // Read capacity units consumed
      const readCapacityMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Write capacity units consumed
      const writeCapacityMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Read throttle events
      const readThrottleMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ReadThrottleEvents',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Write throttle events
      const writeThrottleMetric = new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'WriteThrottleEvents',
        dimensionsMap: {
          TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Add DynamoDB widgets to dashboard
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `DynamoDB ${name} - Capacity Units`,
          left: [readCapacityMetric],
          right: [writeCapacityMetric],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: `DynamoDB ${name} - Throttle Events`,
          left: [readThrottleMetric, writeThrottleMetric],
          width: 12,
          height: 6,
        })
      );
    }
  }

  /**
   * Add Secrets Manager metrics to dashboard
   */
  private addSecretsManagerMetrics(): void {
    // Secrets Manager API call count
    const apiCallMetric = new cloudwatch.Metric({
      namespace: 'AWS/SecretsManager',
      metricName: 'ResourceCount',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add Secrets Manager widget to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Secrets Manager - API Calls',
        left: [apiCallMetric],
        width: 24,
        height: 6,
      })
    );
  }

  /**
   * Create CloudWatch alarms
   */
  private createAlarms(
    api: apigateway.RestApi,
    authorizerFunction: lambda.Function,
    secretsFunction: lambda.Function,
    rotationCheckerFunction: lambda.Function,
    metadataTable: dynamodb.Table,
    auditLogTable: dynamodb.Table
  ): void {
    // Alarm 1: Lambda error rate > 5% over 5-minute period
    const lambdaFunctions = [
      { name: 'Authorizer', func: authorizerFunction },
      { name: 'Secrets', func: secretsFunction },
      { name: 'RotationChecker', func: rotationCheckerFunction },
    ];

    for (const { name, func } of lambdaFunctions) {
      const errorRateAlarm = new cloudwatch.Alarm(this, `${name}ErrorRateAlarm`, {
        alarmName: `SecretsPortal-${name}-ErrorRate`,
        alarmDescription: `${name} Lambda error rate exceeds 5%`,
        metric: new cloudwatch.MathExpression({
          expression: '(errors / invocations) * 100',
          usingMetrics: {
            errors: func.metricErrors({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
            invocations: func.metricInvocations({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          },
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    }

    // Alarm 2: API Gateway 5xx errors > 10 in 5 minutes
    const api5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: 'SecretsPortal-ApiGateway-5xxErrors',
      alarmDescription: 'API Gateway 5xx errors exceed 10 in 5 minutes',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Alarm 3: DynamoDB throttling events > 5 in 5 minutes
    const tables = [
      { name: 'Metadata', table: metadataTable },
      { name: 'AuditLog', table: auditLogTable },
    ];

    for (const { name, table } of tables) {
      // Read throttle alarm
      const readThrottleAlarm = new cloudwatch.Alarm(this, `${name}ReadThrottleAlarm`, {
        alarmName: `SecretsPortal-DynamoDB-${name}-ReadThrottle`,
        alarmDescription: `DynamoDB ${name} table read throttling exceeds 5 events`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ReadThrottleEvents',
          dimensionsMap: {
            TableName: table.tableName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      readThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Write throttle alarm
      const writeThrottleAlarm = new cloudwatch.Alarm(this, `${name}WriteThrottleAlarm`, {
        alarmName: `SecretsPortal-DynamoDB-${name}-WriteThrottle`,
        alarmDescription: `DynamoDB ${name} table write throttling exceeds 5 events`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'WriteThrottleEvents',
          dimensionsMap: {
            TableName: table.tableName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      writeThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    }

    // Alarm 4: Rotation checker Lambda failures (any failure)
    const rotationCheckerFailureAlarm = new cloudwatch.Alarm(this, 'RotationCheckerFailureAlarm', {
      alarmName: 'SecretsPortal-RotationChecker-Failure',
      alarmDescription: 'Rotation checker Lambda function failed',
      metric: rotationCheckerFunction.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    rotationCheckerFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Output SNS topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarm notifications',
    });
  }
}
