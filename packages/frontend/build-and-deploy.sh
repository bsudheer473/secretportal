#!/bin/bash

# Frontend build and deployment script
# Usage: ./build-and-deploy.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="SecretsPortalStack-${ENVIRONMENT^}"

echo "=========================================="
echo "Building and Deploying Frontend - $ENVIRONMENT"
echo "=========================================="

# Get stack outputs
echo "Fetching stack outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

AWS_REGION=$(aws configure get region)

echo ""
echo "Configuration:"
echo "  API Endpoint: $API_ENDPOINT"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Distribution ID: $DISTRIBUTION_ID"
echo "  Region: $AWS_REGION"
echo ""

# Create .env.production file
echo "Creating .env.production file..."
cat > .env.production << EOF
VITE_API_ENDPOINT=$API_ENDPOINT
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_AWS_REGION=$AWS_REGION
EOF

echo "✓ .env.production created"

# Build frontend
echo ""
echo "Building frontend..."
npm run build

echo "✓ Frontend built successfully"

# Deploy to S3
echo ""
echo "Deploying to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

echo "✓ Deployed to S3"

# Invalidate CloudFront cache
echo ""
echo "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✓ CloudFront invalidation created: $INVALIDATION_ID"

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text)

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "Frontend URL: $CLOUDFRONT_URL"
echo "=========================================="
