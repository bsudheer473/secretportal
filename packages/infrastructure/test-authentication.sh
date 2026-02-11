#!/bin/bash

# Authentication testing script
# Tests that users can authenticate and receive JWT tokens
# Usage: ./test-authentication.sh [dev|staging|prod] [username] [password]

set -e

ENVIRONMENT=${1:-dev}
USERNAME=${2:-admin@example.com}
PASSWORD=${3:-AdminPassword123!}

# Capitalize first letter for stack name
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
echo "Testing Authentication - $ENVIRONMENT"
echo "=========================================="

# Get Cognito configuration from stack
echo "Fetching Cognito configuration..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
  echo "Error: Could not find Cognito configuration in stack outputs"
  exit 1
fi

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo ""

# Test authentication
echo "Testing authentication for user: $USERNAME"
echo ""

AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  2>&1)

if [ $? -ne 0 ]; then
  echo "✗ Authentication failed!"
  echo "$AUTH_RESULT"
  exit 1
fi

echo "✓ Authentication successful!"
echo ""

# Extract tokens
ID_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"IdToken": "[^"]*"' | cut -d'"' -f4)
ACCESS_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"AccessToken": "[^"]*"' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"RefreshToken": "[^"]*"' | cut -d'"' -f4)

if [ -z "$ID_TOKEN" ]; then
  echo "✗ Failed to extract tokens from response"
  exit 1
fi

echo "Tokens received:"
echo "  - ID Token: ${ID_TOKEN:0:50}..."
echo "  - Access Token: ${ACCESS_TOKEN:0:50}..."
echo "  - Refresh Token: ${REFRESH_TOKEN:0:50}..."
echo ""

# Decode ID token to show user info
echo "Decoding ID token..."
echo ""

# Extract payload (second part of JWT)
PAYLOAD=$(echo "$ID_TOKEN" | cut -d'.' -f2)
# Add padding if needed
PADDING=$((4 - ${#PAYLOAD} % 4))
if [ $PADDING -ne 4 ]; then
  PAYLOAD="${PAYLOAD}$(printf '=%.0s' $(seq 1 $PADDING))"
fi

# Decode base64
DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "$PAYLOAD" | base64 -D 2>/dev/null)

echo "User Information:"
echo "$DECODED" | python3 -m json.tool 2>/dev/null || echo "$DECODED"
echo ""

# Get user groups
echo "Fetching user groups..."
GROUPS=$(aws cognito-idp admin-list-groups-for-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --query 'Groups[].GroupName' \
  --output text)

echo "User groups: $GROUPS"
echo ""

# Test API call with token
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

if [ -n "$API_ENDPOINT" ]; then
  echo "Testing API call with token..."
  echo "Endpoint: ${API_ENDPOINT}secrets"
  echo ""
  
  API_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $ID_TOKEN" \
    "${API_ENDPOINT}secrets?limit=5")
  
  HTTP_STATUS=$(echo "$API_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  BODY=$(echo "$API_RESPONSE" | sed '/HTTP_STATUS:/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ API call successful (HTTP $HTTP_STATUS)"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  else
    echo "✗ API call failed (HTTP $HTTP_STATUS)"
    echo ""
    echo "Response:"
    echo "$BODY"
  fi
else
  echo "⚠ API endpoint not found, skipping API test"
fi

echo ""
echo "=========================================="
echo "Authentication Test Complete!"
echo "=========================================="
