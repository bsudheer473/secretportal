#!/bin/bash

# Cognito user and group setup script
# Creates test users and assigns them to appropriate groups
# Usage: ./setup-cognito-users.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}

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
echo "Setting up Cognito Users - $ENVIRONMENT"
echo "=========================================="

# Get User Pool ID from stack
echo "Fetching User Pool ID from stack: $STACK_NAME"
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

if [ -z "$USER_POOL_ID" ]; then
  echo "Error: Could not find User Pool ID in stack outputs"
  exit 1
fi

echo "User Pool ID: $USER_POOL_ID"
echo ""

# Function to create a user
create_user() {
  local username=$1
  local email=$2
  local temp_password=$3
  
  echo "Creating user: $username ($email)"
  
  # Check if user already exists
  if aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" &>/dev/null; then
    echo "  ⚠ User already exists, skipping creation"
    return 0
  fi
  
  # Create user
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
    --temporary-password "$temp_password" \
    --message-action SUPPRESS \
    > /dev/null
  
  # Set permanent password
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --password "$temp_password" \
    --permanent \
    > /dev/null
  
  echo "  ✓ User created with password: $temp_password"
}

# Function to add user to group
add_user_to_group() {
  local username=$1
  local group=$2
  
  echo "Adding $username to group: $group"
  
  # Check if user is already in group
  if aws cognito-idp admin-list-groups-for-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --query "Groups[?GroupName=='$group']" \
    --output text | grep -q "$group"; then
    echo "  ⚠ User already in group, skipping"
    return 0
  fi
  
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --group-name "$group" \
    > /dev/null
  
  echo "  ✓ Added to group"
}

echo "Creating test users..."
echo ""

# Admin user
create_user "admin@example.com" "admin@example.com" "AdminPassword123!"
add_user_to_group "admin@example.com" "secrets-admin"
echo ""

# App1 users
create_user "app1-dev@example.com" "app1-dev@example.com" "App1DevPassword123!"
add_user_to_group "app1-dev@example.com" "app1-developer"
echo ""

create_user "app1-viewer@example.com" "app1-viewer@example.com" "App1ViewPassword123!"
add_user_to_group "app1-viewer@example.com" "app1-prod-viewer"
echo ""

# App2 users
create_user "app2-dev@example.com" "app2-dev@example.com" "App2DevPassword123!"
add_user_to_group "app2-dev@example.com" "app2-developer"
echo ""

create_user "app2-viewer@example.com" "app2-viewer@example.com" "App2ViewPassword123!"
add_user_to_group "app2-viewer@example.com" "app2-prod-viewer"
echo ""

# App3 users
create_user "app3-dev@example.com" "app3-dev@example.com" "App3DevPassword123!"
add_user_to_group "app3-dev@example.com" "app3-developer"
echo ""

create_user "app3-viewer@example.com" "app3-viewer@example.com" "App3ViewPassword123!"
add_user_to_group "app3-viewer@example.com" "app3-prod-viewer"
echo ""

# Multi-app user (developer for app1 and app2, viewer for app3 prod)
create_user "multi-app@example.com" "multi-app@example.com" "MultiAppPassword123!"
add_user_to_group "multi-app@example.com" "app1-developer"
add_user_to_group "multi-app@example.com" "app2-developer"
add_user_to_group "multi-app@example.com" "app3-prod-viewer"
echo ""

echo "=========================================="
echo "User Setup Complete!"
echo "=========================================="
echo ""
echo "Test Users Created:"
echo ""
echo "Admin (full access):"
echo "  Email: admin@example.com"
echo "  Password: AdminPassword123!"
echo "  Groups: secrets-admin"
echo ""
echo "App1 Developer (read/write app1 NP/PP):"
echo "  Email: app1-dev@example.com"
echo "  Password: App1DevPassword123!"
echo "  Groups: app1-developer"
echo ""
echo "App1 Viewer (read-only app1 Prod):"
echo "  Email: app1-viewer@example.com"
echo "  Password: App1ViewPassword123!"
echo "  Groups: app1-prod-viewer"
echo ""
echo "App2 Developer (read/write app2 NP/PP):"
echo "  Email: app2-dev@example.com"
echo "  Password: App2DevPassword123!"
echo "  Groups: app2-developer"
echo ""
echo "App2 Viewer (read-only app2 Prod):"
echo "  Email: app2-viewer@example.com"
echo "  Password: App2ViewPassword123!"
echo "  Groups: app2-prod-viewer"
echo ""
echo "App3 Developer (read/write app3 NP/PP):"
echo "  Email: app3-dev@example.com"
echo "  Password: App3DevPassword123!"
echo "  Groups: app3-developer"
echo ""
echo "App3 Viewer (read-only app3 Prod):"
echo "  Email: app3-viewer@example.com"
echo "  Password: App3ViewPassword123!"
echo "  Groups: app3-prod-viewer"
echo ""
echo "Multi-App User (app1+app2 dev, app3 prod viewer):"
echo "  Email: multi-app@example.com"
echo "  Password: MultiAppPassword123!"
echo "  Groups: app1-developer, app2-developer, app3-prod-viewer"
echo ""
echo "=========================================="
