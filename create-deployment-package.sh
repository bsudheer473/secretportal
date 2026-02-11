#!/bin/bash

# Create deployment package for new AWS account
# This creates a tarball with all necessary files

echo "=========================================="
echo "Creating Deployment Package"
echo "=========================================="
echo ""

# Create temp directory
DEPLOY_DIR="secrets-portal-deployment"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

echo "📦 Step 1: Copying backend files..."
mkdir -p $DEPLOY_DIR/backend
cp -r packages/backend-express/dist $DEPLOY_DIR/backend/
cp packages/backend-express/package.json $DEPLOY_DIR/backend/
cp packages/backend-express/package-lock.json $DEPLOY_DIR/backend/
echo "✅ Backend files copied"
echo ""

echo "📦 Step 2: Copying frontend files..."
mkdir -p $DEPLOY_DIR/frontend
cp -r packages/frontend/dist/* $DEPLOY_DIR/frontend/
echo "✅ Frontend files copied"
echo ""

echo "📦 Step 3: Copying documentation..."
cp COMPLETE_DEPLOYMENT_GUIDE.md $DEPLOY_DIR/
cp AUTHENTICATION_GUIDE.md $DEPLOY_DIR/
cp QUICK_LOGIN_CREDENTIALS.txt $DEPLOY_DIR/
cp AWS_COST_BREAKDOWN.md $DEPLOY_DIR/
echo "✅ Documentation copied"
echo ""

echo "📦 Step 4: Creating deployment scripts..."

# Create quick deploy script
cat > $DEPLOY_DIR/quick-deploy.sh << 'EOFSCRIPT'
#!/bin/bash

# Quick deployment script
# Run this on your local machine after setting up AWS infrastructure

if [ -z "$1" ]; then
    echo "Usage: ./quick-deploy.sh PUBLIC_IP"
    echo "Example: ./quick-deploy.sh 54.123.45.67"
    exit 1
fi

PUBLIC_IP=$1
KEY_FILE="secrets-portal-key.pem"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: $KEY_FILE not found!"
    echo "Make sure you have the EC2 key pair in this directory"
    exit 1
fi

echo "Deploying to $PUBLIC_IP..."

# Copy backend
echo "Copying backend..."
scp -i $KEY_FILE -r backend ubuntu@$PUBLIC_IP:~/packages/backend-express/

# Copy frontend
echo "Copying frontend..."
ssh -i $KEY_FILE ubuntu@$PUBLIC_IP "sudo mkdir -p /var/www/secrets-portal"
scp -i $KEY_FILE -r frontend/* ubuntu@$PUBLIC_IP:~/frontend-temp/
ssh -i $KEY_FILE ubuntu@$PUBLIC_IP "sudo cp -r ~/frontend-temp/* /var/www/secrets-portal/ && rm -rf ~/frontend-temp"

echo "✅ Deployment complete!"
echo "Access: http://$PUBLIC_IP"
EOFSCRIPT

chmod +x $DEPLOY_DIR/quick-deploy.sh
echo "✅ Deployment scripts created"
echo ""

echo "📦 Step 5: Creating tarball..."
tar -czf secrets-portal-deployment.tar.gz $DEPLOY_DIR
echo "✅ Tarball created: secrets-portal-deployment.tar.gz"
echo ""

echo "📦 Step 6: Creating checksums..."
shasum -a 256 secrets-portal-deployment.tar.gz > secrets-portal-deployment.tar.gz.sha256
echo "✅ Checksum created"
echo ""

# Cleanup
rm -rf $DEPLOY_DIR

echo "=========================================="
echo "✅ Deployment Package Created!"
echo "=========================================="
echo ""
echo "📦 Package: secrets-portal-deployment.tar.gz"
echo "📊 Size: $(du -h secrets-portal-deployment.tar.gz | cut -f1)"
echo "🔐 SHA256: $(cat secrets-portal-deployment.tar.gz.sha256)"
echo ""
echo "📋 Next Steps:"
echo "1. Transfer package to new environment"
echo "2. Extract: tar -xzf secrets-portal-deployment.tar.gz"
echo "3. Follow: COMPLETE_DEPLOYMENT_GUIDE.md"
echo "4. Run: ./quick-deploy.sh YOUR_EC2_IP"
echo ""
