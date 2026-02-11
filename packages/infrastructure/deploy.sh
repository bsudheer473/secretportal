#!/bin/bash

# Deployment script for Secrets Management Portal
# Usage: ./deploy.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Error: Invalid environment. Must be one of: dev, staging, prod"
  echo "Usage: ./deploy.sh [dev|staging|prod]"
  exit 1
fi

echo "=========================================="
echo "Deploying Secrets Portal - $ENVIRONMENT"
echo "=========================================="

# Build shared types
echo "Building shared types..."
cd ../shared-types
npm run build

# Build backend
echo "Building backend..."
cd ../backend
npm run build

# Build infrastructure
echo "Building infrastructure..."
cd ../infrastructure
npm run build

# Synthesize CloudFormation template
echo "Synthesizing CloudFormation template..."
npm run synth:$ENVIRONMENT

# Deploy to AWS
echo "Deploying to AWS..."
npm run deploy:$ENVIRONMENT

echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
