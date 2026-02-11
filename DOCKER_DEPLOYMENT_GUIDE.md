# Docker Deployment Guide

Complete guide to deploy Secrets Portal using Docker containers.

---

## 🎯 Deployment Options

### Option 1: Docker on Existing EC2 (Recommended - Easiest Migration)
- Keep your current EC2 instance
- Run Docker containers instead of PM2
- Same cost, better portability

### Option 2: AWS ECS/Fargate (Serverless Containers)
- No EC2 management
- Auto-scaling
- Pay only for what you use

### Option 3: AWS App Runner (Simplest)
- Fully managed
- Auto-deploy from Git
- Easiest setup

---

## 📦 What's Been Created

```
secrets-portal/
├── docker-compose.yml              # Multi-container orchestration
├── .env.example                    # Environment variables template
├── deploy-docker-ec2.sh           # Automated EC2 deployment
├── packages/
│   ├── backend-express/
│   │   └── Dockerfile             # Backend container
│   └── frontend/
│       ├── Dockerfile             # Frontend container (multi-stage)
│       └── nginx.conf             # Nginx configuration
```

---

## 🚀 Option 1: Deploy to Existing EC2

### Quick Deployment (5 minutes)

```bash
# Run the deployment script
./deploy-docker-ec2.sh
```

This script will:
1. ✅ Install Docker and Docker Compose on EC2
2. ✅ Stop PM2 processes
3. ✅ Copy files to EC2
4. ✅ Build Docker images
5. ✅ Start containers

### Manual Steps After Deployment

1. **SSH into EC2**:
```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117
cd ~/secrets-portal-docker
```

2. **Update .env file**:
```bash
nano .env

# Update these values:
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=your_client_id
TEAMS_WEBHOOK_URL=your_webhook_url
```

3. **Restart containers**:
```bash
docker-compose restart
```

4. **Verify**:
```bash
docker-compose ps
docker-compose logs -f
```

---

## 🐳 Docker Commands Reference

### Container Management

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Check status
docker-compose ps

# Rebuild and restart
docker-compose up -d --build
```

### Troubleshooting

```bash
# Check container health
docker ps

# Enter backend container
docker exec -it secrets-portal-backend sh

# Enter frontend container
docker exec -it secrets-portal-frontend sh

# View resource usage
docker stats

# Clean up old images
docker system prune -a
```

---

## 🏗️ Option 2: AWS ECS/Fargate Deployment

### Prerequisites

- AWS CLI configured
- ECR (Elastic Container Registry) repository

### Step 1: Create ECR Repositories

```bash
# Create repositories
aws ecr create-repository --repository-name secrets-portal-backend
aws ecr create-repository --repository-name secrets-portal-frontend

# Get login command
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### Step 2: Build and Push Images

```bash
# Build backend
cd packages/backend-express
docker build -t secrets-portal-backend .
docker tag secrets-portal-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest

# Build frontend
cd ../frontend
docker build -t secrets-portal-frontend .
docker tag secrets-portal-frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest
```

### Step 3: Create ECS Task Definition

Create `ecs-task-definition.json`:

```json
{
  "family": "secrets-portal",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {"name": "USER_POOL_ID", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/secrets-portal",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    },
    {
      "name": "frontend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/secrets-portal",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "frontend"
        }
      }
    }
  ]
}
```

### Step 4: Create ECS Service

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create ECS cluster
aws ecs create-cluster --cluster-name secrets-portal-cluster

# Create service
aws ecs create-service \
  --cluster secrets-portal-cluster \
  --service-name secrets-portal-service \
  --task-definition secrets-portal \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

## 🎨 Option 3: AWS App Runner (Easiest)

### Step 1: Push to ECR (same as ECS)

### Step 2: Create App Runner Service

```bash
# Create App Runner service for backend
aws apprunner create-service \
  --service-name secrets-portal-backend \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  }'
```

---

## 💰 Cost Comparison

### Current Setup (EC2 + PM2)
- **EC2 t3.small**: $15.20/month
- **Total**: ~$60/month

### Docker on EC2
- **EC2 t3.small**: $15.20/month
- **Total**: ~$60/month (same cost, better deployment)

### ECS Fargate
- **Fargate (0.5 vCPU, 1GB)**: ~$15/month
- **ALB**: ~$16/month
- **Total**: ~$75/month (no EC2 management)

### App Runner
- **App Runner**: ~$25/month (includes everything)
- **Total**: ~$70/month (easiest option)

---

## 🔄 Migration Path

### From PM2 to Docker on EC2 (Zero Downtime)

1. **Deploy Docker containers** (runs on different ports)
2. **Test Docker setup** (verify everything works)
3. **Update nginx/load balancer** (point to Docker containers)
4. **Stop PM2 processes** (old setup)
5. **Done!**

---

## 📊 Benefits of Docker

### ✅ Advantages

1. **Portability**: Run anywhere (local, EC2, ECS, etc.)
2. **Consistency**: Same environment everywhere
3. **Easy rollback**: Just restart old container
4. **Resource isolation**: Better resource management
5. **Easier scaling**: Add more containers easily
6. **Simpler deployment**: One command to deploy
7. **Better monitoring**: Container-level metrics

### ⚠️ Considerations

1. **Learning curve**: Need to learn Docker commands
2. **Slightly more memory**: Docker overhead (~100MB)
3. **Initial setup**: Takes time to set up properly

---

## 🧪 Local Development

### Run Locally with Docker

```bash
# Copy environment file
cp .env.example .env

# Update .env with your AWS credentials

# Start containers
docker-compose up

# Access:
# Frontend: http://localhost
# Backend: http://localhost:3000
```

### Development with Hot Reload

For development, you can mount volumes:

```yaml
# docker-compose.dev.yml
services:
  backend:
    volumes:
      - ./packages/backend-express/src:/app/src
    command: npm run dev
```

---

## 🔒 Security Best Practices

### 1. Use AWS Secrets Manager for Sensitive Data

Instead of .env file, use AWS Secrets Manager:

```bash
# Store secrets
aws secretsmanager create-secret \
  --name secrets-portal/config \
  --secret-string '{"USER_POOL_ID":"...","CLIENT_ID":"..."}'

# Update task definition to use secrets
"secrets": [
  {
    "name": "USER_POOL_ID",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:secrets-portal/config:USER_POOL_ID::"
  }
]
```

### 2. Use IAM Roles (ECS/Fargate)

Don't use AWS access keys in containers. Use IAM roles:

```json
{
  "taskRoleArn": "arn:aws:iam::123456789:role/SecretsPortalTaskRole",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole"
}
```

### 3. Scan Images for Vulnerabilities

```bash
# Scan with AWS ECR
aws ecr start-image-scan --repository-name secrets-portal-backend --image-id imageTag=latest

# Or use Trivy
docker run aquasec/trivy image secrets-portal-backend:latest
```

---

## 📈 Monitoring

### CloudWatch Logs

```bash
# View logs
aws logs tail /ecs/secrets-portal --follow

# Filter logs
aws logs filter-log-events \
  --log-group-name /ecs/secrets-portal \
  --filter-pattern "ERROR"
```

### Container Insights

Enable Container Insights for ECS:

```bash
aws ecs put-account-setting \
  --name containerInsights \
  --value enabled
```

---

## 🆘 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check if port is in use
sudo netstat -tulpn | grep :3000

# Check environment variables
docker exec secrets-portal-backend env
```

### Out of Memory

```bash
# Increase memory limit in docker-compose.yml
services:
  backend:
    mem_limit: 1g
    mem_reservation: 512m
```

### Permission Issues

```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker
```

---

## Summary

✅ **Docker files created** for backend and frontend  
✅ **Docker Compose** for easy orchestration  
✅ **Deployment script** for EC2  
✅ **Multiple deployment options** (EC2, ECS, App Runner)  
✅ **Same cost** as current setup (if using EC2)  
✅ **Better portability** and easier deployments  

**Recommended**: Start with **Docker on EC2** (easiest migration), then consider ECS/Fargate later if needed.

**Ready to deploy?** Run: `./deploy-docker-ec2.sh`
