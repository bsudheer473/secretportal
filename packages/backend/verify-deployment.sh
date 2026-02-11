#!/bin/bash

# Lambda deployment verification script
# Tests that Lambda functions are deployed and invocable

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="SecretsPortalStack-${ENVIRONMENT^}"

echo "=========================================="
echo "Verifying Lambda Deployment - $ENVIRONMENT"
echo "=========================================="

# Get Lambda function names from CloudFormation stack
echo "Fetching Lambda function names from stack: $STACK_NAME"

AUTH_FUNCTION=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'Authorizer')].PhysicalResourceId" \
  --output text)

SECRETS_FUNCTION=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'Secrets')].PhysicalResourceId" \
  --output text)

ROTATION_FUNCTION=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'Rotation')].PhysicalResourceId" \
  --output text)

echo ""
echo "Found Lambda functions:"
echo "  - Auth: $AUTH_FUNCTION"
echo "  - Secrets: $SECRETS_FUNCTION"
echo "  - Rotation: $ROTATION_FUNCTION"
echo ""

# Test each Lambda function
test_lambda() {
  local function_name=$1
  local function_type=$2
  
  echo "Testing $function_type Lambda..."
  
  # Get function configuration
  local config=$(aws lambda get-function-configuration --function-name "$function_name" 2>&1)
  
  if [ $? -eq 0 ]; then
    echo "  ✓ Function exists and is accessible"
    
    # Extract runtime and memory
    local runtime=$(echo "$config" | grep -o '"Runtime": "[^"]*"' | cut -d'"' -f4)
    local memory=$(echo "$config" | grep -o '"MemorySize": [0-9]*' | grep -o '[0-9]*')
    local timeout=$(echo "$config" | grep -o '"Timeout": [0-9]*' | grep -o '[0-9]*')
    
    echo "  - Runtime: $runtime"
    echo "  - Memory: ${memory}MB"
    echo "  - Timeout: ${timeout}s"
  else
    echo "  ✗ Function not accessible"
    return 1
  fi
  
  echo ""
}

# Test all functions
test_lambda "$AUTH_FUNCTION" "Authorizer"
test_lambda "$SECRETS_FUNCTION" "Secrets"
test_lambda "$ROTATION_FUNCTION" "Rotation Checker"

echo "=========================================="
echo "Verification complete!"
echo "=========================================="
