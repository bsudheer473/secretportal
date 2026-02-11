#!/bin/bash

# Deploy Docker containers to existing EC2 instance
# This script installs Docker on EC2 and runs the containers

set -e

EC2_HOST="ubuntu@44.220.58.117"
SSH_KEY="~/.ssh/aws-chatbot-key"

echo "=========================================="
echo "Deploying Docker Containers to EC2"
echo "=========================================="
echo ""

# Step 1: Install Docker on EC2 (if not already installed)
echo "📦 Step 1: Installing Docker on EC2..."
ssh -i $SSH_KEY $EC2_HOST << 'EOF'
  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo "✅ Docker installed!"
  else
    echo "✅ Docker already installed"
  fi
  
  # Check Docker Compose
  if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed!"
  else
    echo "✅ Docker Compose already installed"
  fi
EOF

echo ""

# Step 2: Stop PM2 processes (if running)
echo "🛑 Step 2: Stopping PM2 processes..."
ssh -i $SSH_KEY $EC2_HOST << 'EOF'
  if command -v pm2 &> /dev/null; then
    pm2 stop all || true
    pm2 delete all || true
    echo "✅ PM2 processes stopped"
  fi
EOF

echo ""

# Step 3: Create deployment directory
echo "📁 Step 3: Creating deployment directory..."
ssh -i $SSH_KEY $EC2_HOST << 'EOF'
  mkdir -p ~/secrets-portal-docker
  cd ~/secrets-portal-docker
EOF

echo ""

# Step 4: Copy files to EC2
echo "📤 Step 4: Copying files to EC2..."

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Copy necessary files
cp docker-compose.yml $TEMP_DIR/
cp .env.example $TEMP_DIR/.env
cp -r packages/backend-express $TEMP_DIR/
cp -r packages/frontend $TEMP_DIR/

# Copy to EC2
scp -i $SSH_KEY -r $TEMP_DIR/* $EC2_HOST:~/secrets-portal-docker/

# Cleanup
rm -rf $TEMP_DIR

echo "✅ Files copied!"
echo ""

# Step 5: Configure environment variables
echo "⚙️  Step 5: Configuring environment variables..."
echo "Please update the .env file on EC2 with your actual values"
echo ""

# Step 6: Build and start containers
echo "🐳 Step 6: Building and starting Docker containers..."
ssh -i $SSH_KEY $EC2_HOST << 'EOF'
  cd ~/secrets-portal-docker
  
  # Stop any running containers
  docker-compose down || true
  
  # Build images
  docker-compose build
  
  # Start containers
  docker-compose up -d
  
  echo "✅ Containers started!"
  echo ""
  echo "Container status:"
  docker-compose ps
EOF

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "1. SSH into EC2 and update .env file:"
echo "   ssh -i $SSH_KEY $EC2_HOST"
echo "   cd ~/secrets-portal-docker"
echo "   nano .env"
echo ""
echo "2. Restart containers after updating .env:"
echo "   docker-compose restart"
echo ""
echo "3. View logs:"
echo "   docker-compose logs -f"
echo ""
echo "4. Check status:"
echo "   docker-compose ps"
echo ""
echo "5. Access the portal:"
echo "   http://44.220.58.117"
echo ""
