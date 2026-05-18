import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CrossAccountRoleStackProps extends cdk.StackProps {
  /**
   * The AWS Account ID of the portal account (Account A)
   * that will assume this role.
   */
  portalAccountId: string;
}

/**
 * Cross-Account Role Stack
 * 
 * Deploy this stack in Account B (the secrets account).
 * It creates an IAM role that Account A (portal account) can assume
 * to read and update secrets.
 * 
 * Usage:
 *   cdk deploy CrossAccountRoleStack -c portalAccountId=111111111111
 */
export class CrossAccountRoleStack extends cdk.Stack {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: CrossAccountRoleStackProps) {
    super(scope, id, props);

    // Create the cross-account role
    this.role = new iam.Role(this, 'SecretsPortalCrossAccountRole', {
      roleName: 'SecretsPortalCrossAccountRole',
      description: 'Allows Secrets Portal in Account A to read/update secrets in this account',
      assumedBy: new iam.AccountPrincipal(props.portalAccountId),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Grant read and update permissions on Secrets Manager
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowSecretsManagerReadUpdate',
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:DescribeSecret',
        'secretsmanager:GetSecretValue',
        'secretsmanager:PutSecretValue',
        'secretsmanager:UpdateSecret',
        'secretsmanager:ListSecrets',
        'secretsmanager:TagResource',
        'secretsmanager:GetResourcePolicy',
      ],
      resources: ['*'], // Restrict to specific secret ARNs if needed
    }));

    // Output the role ARN
    new cdk.CfnOutput(this, 'CrossAccountRoleArn', {
      value: this.role.roleArn,
      description: 'ARN of the cross-account role. Set this as CROSS_ACCOUNT_ROLE_ARN in Account A.',
      exportName: 'SecretsPortalCrossAccountRoleArn',
    });
  }
}
