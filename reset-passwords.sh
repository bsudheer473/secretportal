#!/bin/bash

# Reset passwords for all test users
# User Pool ID
USER_POOL_ID="us-east-1_O9Yt0QiW0"

echo "Resetting passwords for test users..."
echo ""

# Reset admin password
echo "1. Resetting admin@example.com password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password "AdminPassword123!" \
  --permanent

echo "   ✅ admin@example.com password set to: AdminPassword123!"
echo ""

# Reset webapp user password
echo "2. Resetting app1-dev@example.com (webapp user) password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username app1-dev@example.com \
  --password "WebAppPassword123!" \
  --permanent

echo "   ✅ app1-dev@example.com password set to: WebAppPassword123!"
echo ""

# Reset api-service user password
echo "3. Resetting app2-dev@example.com (api-service user) password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username app2-dev@example.com \
  --password "ApiServicePassword123!" \
  --permanent

echo "   ✅ app2-dev@example.com password set to: ApiServicePassword123!"
echo ""

# Reset prod viewer user password
echo "4. Resetting app3-dev@example.com (prod viewer user) password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username app3-dev@example.com \
  --password "ProdViewPassword123!" \
  --permanent

echo "   ✅ app3-dev@example.com password set to: ProdViewPassword123!"
echo ""

echo "=========================================="
echo "All passwords reset successfully!"
echo "=========================================="
echo ""
echo "📋 CREDENTIALS SUMMARY:"
echo ""
echo "1. Admin (Full Access):"
echo "   Email: admin@example.com"
echo "   Password: AdminPassword123!"
echo ""
echo "2. webapp User (NP/PP only):"
echo "   Email: app1-dev@example.com"
echo "   Password: WebAppPassword123!"
echo ""
echo "3. api-service User (NP/PP only):"
echo "   Email: app2-dev@example.com"
echo "   Password: ApiServicePassword123!"
echo ""
echo "4. Prod Viewer (webapp NP/PP/Prod read-only):"
echo "   Email: app3-dev@example.com"
echo "   Password: ProdViewPassword123!"
echo ""
echo "Login URL: http://44.220.58.117"
echo ""
