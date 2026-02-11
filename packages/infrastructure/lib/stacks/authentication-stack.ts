import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Authentication stack - Cognito User Pool and groups
 * Implementation details will be added in task 3
 */
export class AuthenticationStack extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'secrets-portal-users',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // User groups for role-based access control
    this.createUserGroups();
  }

  private createUserGroups(): void {
    // Admin group with full access to all secrets
    new cognito.CfnUserPoolGroup(this, 'SecretsAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'secrets-admin',
      description: 'Full access to all secrets across all applications and environments',
    });

    // Create developer and prod-viewer groups for each of the 6 applications
    const applications = ['app1', 'app2', 'app3', 'app4', 'app5', 'app6'];

    applications.forEach((app) => {
      // Developer group: read/write access to NP and PP environments
      new cognito.CfnUserPoolGroup(this, `${app}DeveloperGroup`, {
        userPoolId: this.userPool.userPoolId,
        groupName: `${app}-developer`,
        description: `Read/write access to ${app} secrets in NP and PP environments`,
      });

      // Prod viewer group: read-only access to Prod environment
      new cognito.CfnUserPoolGroup(this, `${app}ProdViewerGroup`, {
        userPoolId: this.userPool.userPoolId,
        groupName: `${app}-prod-viewer`,
        description: `Read-only access to ${app} secrets in Prod environment`,
      });
    });
  }
}
