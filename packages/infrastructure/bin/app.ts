#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SecretsPortalStack } from '../lib/secrets-portal-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Environment-specific configuration
const envConfig = {
  dev: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    stackName: 'SecretsPortalStack-Dev',
    tags: {
      Environment: 'Development',
      ManagedBy: 'CDK',
      Project: 'SecretsPortal',
    },
  },
  staging: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    stackName: 'SecretsPortalStack-Staging',
    tags: {
      Environment: 'Staging',
      ManagedBy: 'CDK',
      Project: 'SecretsPortal',
    },
  },
  prod: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    stackName: 'SecretsPortalStack-Prod',
    tags: {
      Environment: 'Production',
      ManagedBy: 'CDK',
      Project: 'SecretsPortal',
    },
  },
};

const config = envConfig[environment as keyof typeof envConfig];

if (!config) {
  throw new Error(`Invalid environment: ${environment}. Must be one of: dev, staging, prod`);
}

new SecretsPortalStack(app, config.stackName, {
  env: {
    account: config.account,
    region: config.region,
  },
  description: `Secrets Management Portal Infrastructure - ${config.tags.Environment}`,
  tags: config.tags,
});
