#!/bin/bash

# Script to sync existing AWS Secrets Manager secrets to DynamoDB metadata table
# This is useful when secrets were created outside the portal

set -e

ENVIRONMENT=${1:-dev}

if [ "$ENVIRONMENT" = "dev" ]; then
  STACK_NAME="SecretsPortalStack-Dev"
elif [ "$ENVIRONMENT" = "staging" ]; then
  STACK_NAME="SecretsPortalStack-Staging"
elif [ "$ENVIRONMENT" = "prod" ]; then
  STACK_NAME="SecretsPortalStack-Prod"
else
  echo "Error: Invalid environment. Must be one of: dev, staging, prod"
  exit 1
fi

echo "=========================================="
echo "Syncing Secrets to DynamoDB - $ENVIRONMENT"
echo "=========================================="

# Get table name (hardcoded since it's not in stack outputs)
METADATA_TABLE="secrets-metadata"

echo "Metadata Table: $METADATA_TABLE"
echo ""

# List all secrets from AWS Secrets Manager
echo "Fetching secrets from AWS Secrets Manager..."
SECRETS=$(aws secretsmanager list-secrets --query "SecretList[*].[Name,ARN,CreatedDate]" --output json)

# Count secrets
SECRET_COUNT=$(echo "$SECRETS" | jq 'length')
echo "Found $SECRET_COUNT secrets"
echo ""

# Parse each secret and add to DynamoDB
echo "$SECRETS" | jq -c '.[]' | while read -r secret; do
  NAME=$(echo "$secret" | jq -r '.[0]')
  ARN=$(echo "$secret" | jq -r '.[1]')
  CREATED=$(echo "$secret" | jq -r '.[2]')
  
  # Parse name to extract application and environment
  # Expected format: application/environment/secret-name or application-environment-secret-name
  
  # Try slash format first
  if [[ "$NAME" =~ ^([^/]+)/([^/]+)/(.+)$ ]]; then
    APP="${BASH_REMATCH[1]}"
    ENV="${BASH_REMATCH[2]}"
    SECRET_NAME="${BASH_REMATCH[3]}"
  # Try dash format
  elif [[ "$NAME" =~ ^([^-]+)-([^-]+)-(.+)$ ]]; then
    APP="${BASH_REMATCH[1]}"
    ENV="${BASH_REMATCH[2]}"
    SECRET_NAME="${BASH_REMATCH[3]}"
  else
    # Default values if pattern doesn't match
    APP="unknown"
    ENV="unknown"
    SECRET_NAME="$NAME"
  fi
  
  # Map environment names
  case "$ENV" in
    dev|development) ENV="NP" ;;
    staging|stage) ENV="PP" ;;
    prod|production) ENV="Prod" ;;
  esac
  
  # Generate a unique ID
  SECRET_ID=$(echo -n "$NAME" | md5 | cut -c1-16)
  
  echo "Processing: $NAME"
  echo "  App: $APP, Env: $ENV, ID: $SECRET_ID"
  
  # Check if already exists in DynamoDB
  EXISTS=$(aws dynamodb get-item \
    --table-name "$METADATA_TABLE" \
    --key "{\"secretId\":{\"S\":\"$SECRET_ID\"}}" \
    --query "Item.secretId.S" \
    --output text 2>/dev/null || echo "")
  
  if [ "$EXISTS" = "$SECRET_ID" ]; then
    echo "  ⚠ Already exists in DynamoDB, skipping"
  else
    # Add to DynamoDB
    aws dynamodb put-item \
      --table-name "$METADATA_TABLE" \
      --item "{
        \"secretId\": {\"S\": \"$SECRET_ID\"},
        \"name\": {\"S\": \"$SECRET_NAME\"},
        \"application\": {\"S\": \"$APP\"},
        \"environment\": {\"S\": \"$ENV\"},
        \"awsSecretArn\": {\"S\": \"$ARN\"},
        \"rotationPeriod\": {\"N\": \"90\"},
        \"createdAt\": {\"S\": \"$CREATED\"},
        \"lastRotated\": {\"S\": \"$CREATED\"},
        \"owner\": {\"S\": \"admin\"}
      }" > /dev/null
    
    echo "  ✓ Added to DynamoDB"
  fi
  echo ""
done

echo "=========================================="
echo "Sync Complete!"
echo "=========================================="
