import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ComputeStack } from './stacks/compute-stack';
import { StorageStack } from './stacks/storage-stack';
import { NetworkingStack } from './stacks/networking-stack';
import { AuthenticationStack } from './stacks/authentication-stack';
import { FrontendStack } from './stacks/frontend-stack';
import { MonitoringStack } from './stacks/monitoring-stack';

/**
 * Main stack for Secrets Management Portal
 * Orchestrates all infrastructure components
 */
export class SecretsPortalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Storage layer - DynamoDB tables
    const storageStack = new StorageStack(this, 'Storage');

    // Authentication layer - Cognito
    const authStack = new AuthenticationStack(this, 'Authentication');

    // Compute layer - Lambda functions (create authorizer first)
    const computeStack = new ComputeStack(this, 'Compute', {
      metadataTable: storageStack.metadataTable,
      auditLogTable: storageStack.auditLogTable,
      userPool: authStack.userPool,
      userPoolClient: authStack.userPoolClient,
    });

    // Networking layer - API Gateway with authorizer
    const networkingStack = new NetworkingStack(this, 'Networking', {
      userPool: authStack.userPool,
      authorizerFunction: computeStack.authorizerFunction,
      secretsFunction: computeStack.secretsFunction,
    });

    // Pass API to compute stack for Lambda integrations
    computeStack.setApi(networkingStack.api, networkingStack.authorizer!);

    // Frontend layer - S3 and CloudFront
    const frontendStack = new FrontendStack(this, 'Frontend', {
      apiEndpoint: networkingStack.api.url,
      userPoolId: authStack.userPool.userPoolId,
      userPoolClientId: authStack.userPoolClient.userPoolClientId,
      // Optional: Add custom domain and certificate ARN from context
      customDomain: this.node.tryGetContext('customDomain'),
      certificateArn: this.node.tryGetContext('certificateArn'),
    });

    // Monitoring layer - CloudWatch dashboards and alarms
    const monitoringStack = new MonitoringStack(this, 'Monitoring', {
      api: networkingStack.api,
      authorizerFunction: computeStack.authorizerFunction,
      secretsFunction: computeStack.secretsFunction,
      rotationCheckerFunction: computeStack.rotationCheckerFunction,
      metadataTable: storageStack.metadataTable,
      auditLogTable: storageStack.auditLogTable,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: networkingStack.api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: authStack.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: authStack.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${monitoringStack.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
