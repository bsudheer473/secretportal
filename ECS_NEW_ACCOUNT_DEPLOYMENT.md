# ECS Fargate Deployment - New AWS Account Checklist

Complete step-by-step guide to deploy Secrets Portal using Docker containers on AWS ECS Fargate in a new AWS account.

**Time**: 2-3 hours  
**Cost**: $44/month (vs $60 with EC2)  
**Difficulty**: Medium

---

## 🎯 What You'll Deploy

```
Route53 (Optional - Custom Domain)
    ↓
Application Load Balancer (ALB)
    ↓
ECS Fargate Cluster
    ├── Backend Container (Express API)
    └── Frontend Container (Nginx + React)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Benefits**:
- ✅ No EC2 management (serverless containers)
- ✅ Auto-scaling and high availability
- ✅ Zero downtime deployments
- ✅ Lower cost than EC2
- ✅ Multi-AZ by default

---

## ✅ Pre-Deployment Requirements

- [ ] AWS Account created and accessible
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Docker installed locally
- [ ] Node.js 18+ installed
- [ ] Project source code available
- [ ] Have 2-3 hours available

---

## 📋 Phase 1: AWS Foundation Setup (45 min)

### Step 1.1: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Verify configuration
aws sts get-caller-identity
```

**Save these values**:
- AWS Account ID: _______________
- Region: us-east-1 (or your preferred region)


### Step 1.2: Create DynamoDB Tables (10 min)

```bash
# Create secrets-metadata table
aws dynamodb create-table \
  --table-name secrets-metadata \
  --attribute-definitions \
    AttributeName=secretName,AttributeType=S \
  --key-schema \
    AttributeName=secretName,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Create secrets-audit-log table
aws dynamodb create-table \
  --table-name secrets-audit-log \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Create aws-console-changes table
aws dynamodb create-table \
  --table-name aws-console-changes \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Verify tables
aws dynamodb list-tables --region us-east-1
```

**Checklist**:
- [ ] secrets-metadata table created
- [ ] secrets-audit-log table created
- [ ] aws-console-changes table created
- [ ] All tables show ACTIVE status


### Step 1.3: Create Cognito User Pool (15 min)

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name secrets-portal-users \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --username-attributes email \
  --region us-east-1

# Save the UserPoolId from output
USER_POOL_ID="us-east-1_XXXXXXXXX"

# Create user pool client
aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name secrets-portal-client \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region us-east-1

# Save the ClientId from output
CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"

# Create user groups
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name secrets-admin \
  --description "Full access to all secrets" \
  --region us-east-1

aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name webapp-developer \
  --description "Access to webapp secrets" \
  --region us-east-1

aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name webapp-prod-viewer \
  --description "Read-only access to webapp production" \
  --region us-east-1

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --region us-east-1

# Add admin to secrets-admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --group-name secrets-admin \
  --region us-east-1
```

**Save these values**:
- User Pool ID: _______________
- Client ID: _______________
- Admin Email: admin@example.com
- Temp Password: TempPass123!


### Step 1.4: Create VPC and Networking (10 min)

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=secrets-portal-vpc}]' \
  --query 'Vpc.VpcId' \
  --output text \
  --region us-east-1)

echo "VPC ID: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region us-east-1

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=secrets-portal-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text \
  --region us-east-1)

# Attach IGW to VPC
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region us-east-1

# Create public subnets in 2 AZs (required for ALB)
SUBNET1_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secrets-portal-subnet-1}]' \
  --query 'Subnet.SubnetId' \
  --output text \
  --region us-east-1)

SUBNET2_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secrets-portal-subnet-2}]' \
  --query 'Subnet.SubnetId' \
  --output text \
  --region us-east-1)

# Create route table
RTB_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=secrets-portal-rtb}]' \
  --query 'RouteTable.RouteTableId' \
  --output text \
  --region us-east-1)

# Add route to internet
aws ec2 create-route \
  --route-table-id $RTB_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region us-east-1

# Associate subnets with route table
aws ec2 associate-route-table \
  --subnet-id $SUBNET1_ID \
  --route-table-id $RTB_ID \
  --region us-east-1

aws ec2 associate-route-table \
  --subnet-id $SUBNET2_ID \
  --route-table-id $RTB_ID \
  --region us-east-1
```

**Save these values**:
- VPC ID: _______________
- Subnet 1 ID: _______________
- Subnet 2 ID: _______________


### Step 1.5: Create Security Groups (10 min)

```bash
# Create ALB security group
ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name secrets-portal-alb-sg \
  --description "Security group for ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text \
  --region us-east-1)

# Allow HTTP and HTTPS to ALB
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

# Create ECS tasks security group
ECS_SG_ID=$(aws ec2 create-security-group \
  --group-name secrets-portal-ecs-sg \
  --description "Security group for ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text \
  --region us-east-1)

# Allow traffic from ALB to ECS tasks
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp \
  --port 80 \
  --source-group $ALB_SG_ID \
  --region us-east-1

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG_ID \
  --region us-east-1
```

**Save these values**:
- ALB Security Group ID: _______________
- ECS Security Group ID: _______________

---

## 📋 Phase 2: Container Registry Setup (20 min)

### Step 2.1: Create ECR Repositories

```bash
# Create backend repository
aws ecr create-repository \
  --repository-name secrets-portal-backend \
  --region us-east-1

# Create frontend repository
aws ecr create-repository \
  --repository-name secrets-portal-frontend \
  --region us-east-1

# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $AWS_ACCOUNT_ID"

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

**Checklist**:
- [ ] Backend repository created
- [ ] Frontend repository created
- [ ] Docker logged into ECR


### Step 2.2: Build and Push Docker Images

```bash
# Navigate to project root
cd /path/to/secrets-portal

# Build backend
cd packages/backend-express
npm install
npm run build

# Build backend Docker image
docker build -t secrets-portal-backend .

# Tag and push backend
docker tag secrets-portal-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest

# Build frontend
cd ../frontend
npm install
npm run build

# Build frontend Docker image
docker build -t secrets-portal-frontend .

# Tag and push frontend
docker tag secrets-portal-frontend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest

# Verify images in ECR
aws ecr describe-images \
  --repository-name secrets-portal-backend \
  --region us-east-1

aws ecr describe-images \
  --repository-name secrets-portal-frontend \
  --region us-east-1
```

**Checklist**:
- [ ] Backend built successfully
- [ ] Backend image pushed to ECR
- [ ] Frontend built successfully
- [ ] Frontend image pushed to ECR

---

## 📋 Phase 3: IAM Roles Setup (15 min)

### Step 3.1: Create ECS Task Execution Role

```bash
# Create trust policy file
cat > ecs-task-execution-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create execution role
aws iam create-role \
  --role-name SecretsPortalECSExecutionRole \
  --assume-role-policy-document file://ecs-task-execution-trust-policy.json \
  --region us-east-1

# Attach AWS managed policy
aws iam attach-role-policy \
  --role-name SecretsPortalECSExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  --region us-east-1
```


### Step 3.2: Create ECS Task Role (Application Permissions)

```bash
# Create task role policy
cat > ecs-task-role-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:$AWS_ACCOUNT_ID:table/secrets-metadata",
        "arn:aws:dynamodb:us-east-1:$AWS_ACCOUNT_ID:table/secrets-audit-log",
        "arn:aws:dynamodb:us-east-1:$AWS_ACCOUNT_ID:table/aws-console-changes"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsersInGroup"
      ],
      "Resource": "arn:aws:cognito-idp:us-east-1:$AWS_ACCOUNT_ID:userpool/*"
    }
  ]
}
EOF

# Create task role
aws iam create-role \
  --role-name SecretsPortalECSTaskRole \
  --assume-role-policy-document file://ecs-task-execution-trust-policy.json \
  --region us-east-1

# Create and attach policy
aws iam put-role-policy \
  --role-name SecretsPortalECSTaskRole \
  --policy-name SecretsPortalTaskPolicy \
  --policy-document file://ecs-task-role-policy.json \
  --region us-east-1
```

**Checklist**:
- [ ] ECS Execution Role created
- [ ] ECS Task Role created
- [ ] Policies attached

---

## 📋 Phase 4: Application Load Balancer Setup (20 min)

### Step 4.1: Create Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name secrets-portal-alb \
  --subnets $SUBNET1_ID $SUBNET2_ID \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text \
  --region us-east-1)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text \
  --region us-east-1)

echo "ALB DNS: $ALB_DNS"
```

**Save this value**:
- ALB DNS Name: _______________


### Step 4.2: Create Target Groups

```bash
# Create target group for backend
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
  --name secrets-portal-backend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text \
  --region us-east-1)

# Create target group for frontend
FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
  --name secrets-portal-frontend-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text \
  --region us-east-1)
```

### Step 4.3: Create ALB Listeners and Rules

```bash
# Create HTTP listener (default to frontend)
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --query 'Listeners[0].ListenerArn' \
  --output text \
  --region us-east-1)

# Add rule to forward /api/* to backend
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 1 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  --region us-east-1
```

**Checklist**:
- [ ] ALB created
- [ ] Backend target group created
- [ ] Frontend target group created
- [ ] HTTP listener created
- [ ] API routing rule created

---

## 📋 Phase 5: ECS Cluster and Services (30 min)

### Step 5.1: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name secrets-portal-cluster \
  --region us-east-1

# Enable Container Insights (optional but recommended)
aws ecs update-cluster-settings \
  --cluster secrets-portal-cluster \
  --settings name=containerInsights,value=enabled \
  --region us-east-1
```


### Step 5.2: Create CloudWatch Log Groups

```bash
# Create log group for backend
aws logs create-log-group \
  --log-group-name /ecs/secrets-portal-backend \
  --region us-east-1

# Create log group for frontend
aws logs create-log-group \
  --log-group-name /ecs/secrets-portal-frontend \
  --region us-east-1

# Set retention (optional - 7 days)
aws logs put-retention-policy \
  --log-group-name /ecs/secrets-portal-backend \
  --retention-in-days 7 \
  --region us-east-1

aws logs put-retention-policy \
  --log-group-name /ecs/secrets-portal-frontend \
  --retention-in-days 7 \
  --region us-east-1
```

### Step 5.3: Create ECS Task Definition

```bash
# Create task definition JSON
cat > task-definition.json <<EOF
{
  "family": "secrets-portal",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/SecretsPortalECSExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/SecretsPortalECSTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest",
      "cpu": 256,
      "memory": 512,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "AWS_REGION", "value": "us-east-1"},
        {"name": "USER_POOL_ID", "value": "$USER_POOL_ID"},
        {"name": "CLIENT_ID", "value": "$CLIENT_ID"},
        {"name": "DYNAMODB_TABLE_NAME", "value": "secrets-metadata"},
        {"name": "AUDIT_TABLE_NAME", "value": "secrets-audit-log"},
        {"name": "CONSOLE_CHANGES_TABLE_NAME", "value": "aws-console-changes"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/secrets-portal-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    },
    {
      "name": "frontend",
      "image": "$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend:latest",
      "cpu": 256,
      "memory": 512,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/secrets-portal-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "frontend"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1
```


### Step 5.4: Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster secrets-portal-cluster \
  --service-name secrets-portal-backend \
  --task-definition secrets-portal \
  --desired-count 1 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1_ID,$SUBNET2_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --region us-east-1

# Create frontend service
aws ecs create-service \
  --cluster secrets-portal-cluster \
  --service-name secrets-portal-frontend \
  --task-definition secrets-portal \
  --desired-count 1 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1_ID,$SUBNET2_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$FRONTEND_TG_ARN,containerName=frontend,containerPort=80" \
  --health-check-grace-period-seconds 60 \
  --region us-east-1
```

### Step 5.5: Wait for Services to Start (5-10 min)

```bash
# Check service status
aws ecs describe-services \
  --cluster secrets-portal-cluster \
  --services secrets-portal-backend secrets-portal-frontend \
  --region us-east-1

# Check running tasks
aws ecs list-tasks \
  --cluster secrets-portal-cluster \
  --region us-east-1

# View logs
aws logs tail /ecs/secrets-portal-backend --follow --region us-east-1
aws logs tail /ecs/secrets-portal-frontend --follow --region us-east-1
```

**Wait until**:
- [ ] Both services show "runningCount": 1
- [ ] Tasks are in RUNNING state
- [ ] Target groups show healthy targets
- [ ] No errors in CloudWatch logs

---

## 📋 Phase 6: Testing and Verification (20 min)

### Step 6.1: Test Application Access

```bash
# Get ALB DNS name
echo "Access your application at: http://$ALB_DNS"

# Test backend health
curl http://$ALB_DNS/api/health

# Test frontend
curl http://$ALB_DNS
```

### Step 6.2: Login and Functional Testing

1. **Open browser**: Navigate to `http://YOUR_ALB_DNS`
2. **Login**: Use admin@example.com / TempPass123!
3. **Change password**: Set new permanent password
4. **Create secret**: Test creating a new secret
5. **List secrets**: Verify secrets appear
6. **Update secret**: Test updating a secret
7. **Check audit log**: Verify audit trail

**Checklist**:
- [ ] Application loads in browser
- [ ] Can login successfully
- [ ] Can create secrets
- [ ] Can view secrets list
- [ ] Can update secrets
- [ ] Audit logs are recorded
- [ ] Filters work (application, environment)


---

## 📋 Phase 7: Optional Enhancements (30-60 min)

### Option A: Add HTTPS with ACM Certificate

```bash
# Request certificate (requires domain ownership)
CERT_ARN=$(aws acm request-certificate \
  --domain-name secrets.yourdomain.com \
  --validation-method DNS \
  --query 'CertificateArn' \
  --output text \
  --region us-east-1)

# Get validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1

# Add CNAME records to your DNS (Route53 or external)
# Wait for validation...

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --region us-east-1

# Add API routing rule for HTTPS
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --query 'Listeners[?Port==`443`].ListenerArn' \
  --output text \
  --region us-east-1)

aws elbv2 create-rule \
  --listener-arn $HTTPS_LISTENER_ARN \
  --priority 1 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  --region us-east-1
```

### Option B: Setup Custom Domain with Route53

```bash
# Create hosted zone (if you don't have one)
HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' \
  --output text)

# Create A record pointing to ALB
cat > route53-record.json <<EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "secrets.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].CanonicalHostedZoneId' --output text)",
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://route53-record.json
```

### Option C: Enable Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/secrets-portal-cluster/secrets-portal-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 4 \
  --region us-east-1

# Create scaling policy (CPU-based)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/secrets-portal-cluster/secrets-portal-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }' \
  --region us-east-1
```

### Option D: Setup Teams Notifications

See **TEAMS_NOTIFICATIONS_SETUP.md** for complete instructions.

Quick setup:
1. Create Power Automate flow with webhook trigger
2. Add webhook URL to task definition environment variables
3. Update ECS service with new task definition


---

## 🔄 Deployment Updates

### Update Application Code

```bash
# 1. Build new images locally
cd packages/backend-express
npm run build
docker build -t secrets-portal-backend .
docker tag secrets-portal-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend:latest

# 2. Force new deployment (ECS will pull latest image)
aws ecs update-service \
  --cluster secrets-portal-cluster \
  --service secrets-portal-backend \
  --force-new-deployment \
  --region us-east-1

# 3. Monitor deployment
aws ecs describe-services \
  --cluster secrets-portal-cluster \
  --services secrets-portal-backend \
  --region us-east-1
```

### Update Environment Variables

```bash
# 1. Update task definition JSON with new env vars
# 2. Register new task definition revision
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1

# 3. Update service to use new revision
aws ecs update-service \
  --cluster secrets-portal-cluster \
  --service secrets-portal-backend \
  --task-definition secrets-portal:2 \
  --region us-east-1
```

### Rollback to Previous Version

```bash
# List task definition revisions
aws ecs list-task-definitions \
  --family-prefix secrets-portal \
  --region us-east-1

# Update service to previous revision
aws ecs update-service \
  --cluster secrets-portal-cluster \
  --service secrets-portal-backend \
  --task-definition secrets-portal:1 \
  --region us-east-1
```

---

## 📊 Monitoring and Logs

### View CloudWatch Logs

```bash
# Tail backend logs
aws logs tail /ecs/secrets-portal-backend --follow --region us-east-1

# Tail frontend logs
aws logs tail /ecs/secrets-portal-frontend --follow --region us-east-1

# Filter for errors
aws logs filter-log-events \
  --log-group-name /ecs/secrets-portal-backend \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### Check Service Health

```bash
# Service status
aws ecs describe-services \
  --cluster secrets-portal-cluster \
  --services secrets-portal-backend secrets-portal-frontend \
  --region us-east-1

# Task status
aws ecs list-tasks \
  --cluster secrets-portal-cluster \
  --service-name secrets-portal-backend \
  --region us-east-1

# Target group health
aws elbv2 describe-target-health \
  --target-group-arn $BACKEND_TG_ARN \
  --region us-east-1
```

### Setup CloudWatch Alarms

```bash
# CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-portal-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ServiceName,Value=secrets-portal-backend Name=ClusterName,Value=secrets-portal-cluster \
  --region us-east-1

# Memory alarm
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-portal-high-memory \
  --alarm-description "Alert when memory exceeds 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ServiceName,Value=secrets-portal-backend Name=ClusterName,Value=secrets-portal-cluster \
  --region us-east-1
```


---

## 🆘 Troubleshooting

### Issue: Tasks Keep Stopping

**Check**:
```bash
# View stopped tasks
aws ecs list-tasks \
  --cluster secrets-portal-cluster \
  --desired-status STOPPED \
  --region us-east-1

# Get task details
aws ecs describe-tasks \
  --cluster secrets-portal-cluster \
  --tasks TASK_ID \
  --region us-east-1
```

**Common causes**:
- Insufficient memory/CPU
- Application crashes (check logs)
- Health check failures
- IAM permission issues

### Issue: Target Group Shows Unhealthy

**Check**:
```bash
# Target health
aws elbv2 describe-target-health \
  --target-group-arn $BACKEND_TG_ARN \
  --region us-east-1

# Check health check path
curl http://TASK_IP:3000/api/health
```

**Fix**:
- Verify health check path exists
- Check security group allows ALB → ECS traffic
- Increase health check grace period

### Issue: Can't Access Application

**Check**:
```bash
# Verify ALB is active
aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region us-east-1

# Check listener rules
aws elbv2 describe-rules \
  --listener-arn $LISTENER_ARN \
  --region us-east-1

# Test ALB directly
curl -v http://$ALB_DNS
```

**Fix**:
- Verify security group allows inbound 80/443
- Check target groups have healthy targets
- Verify listener rules are correct

### Issue: Backend Can't Access DynamoDB

**Check logs**:
```bash
aws logs tail /ecs/secrets-portal-backend --follow --region us-east-1
```

**Fix**:
- Verify task role has DynamoDB permissions
- Check DynamoDB table names in environment variables
- Verify tables exist in correct region

### Issue: Authentication Fails

**Check**:
- Verify USER_POOL_ID and CLIENT_ID are correct
- Check Cognito user exists and is in correct group
- Verify task role has Cognito permissions

---

## 💰 Cost Optimization

### Current Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| **ALB** | 1 ALB, 100K LCU-hours | $16.20 |
| **ECS Fargate** | 0.5 vCPU, 1GB RAM, 24/7 | $14.50 |
| **DynamoDB** | 200 items, on-demand | $2.00 |
| **Secrets Manager** | 20 secrets | $8.00 |
| **CloudWatch** | Logs + metrics | $3.00 |
| **Data Transfer** | Minimal | $0.50 |
| **TOTAL** | | **$44.20/month** |

### Cost Reduction Tips

1. **Use Fargate Spot** (save 70%):
```bash
# Update service to use Fargate Spot
aws ecs update-service \
  --cluster secrets-portal-cluster \
  --service secrets-portal-backend \
  --capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=1,base=0 \
  --region us-east-1
```

2. **Reduce task size** (if possible):
- Change from 0.5 vCPU to 0.25 vCPU
- Reduce memory from 1GB to 512MB

3. **Consolidate secrets** in Secrets Manager:
- Store multiple secrets in one JSON object
- Reduces from $8/month to $0.40/month

4. **Reduce log retention**:
```bash
aws logs put-retention-policy \
  --log-group-name /ecs/secrets-portal-backend \
  --retention-in-days 3 \
  --region us-east-1
```

5. **Use scheduled scaling** (stop at night):
```bash
# Scale to 0 at night (if not needed 24/7)
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id service/secrets-portal-cluster/secrets-portal-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --scheduled-action-name scale-down-night \
  --schedule "cron(0 22 * * ? *)" \
  --scalable-target-action MinCapacity=0,MaxCapacity=0 \
  --region us-east-1
```

**Potential savings**: $44/month → $25/month with optimizations


---

## 📝 Important Values to Save

Create a secure document with these values:

```
=== AWS Account Information ===
AWS Account ID: _______________
Region: us-east-1

=== Network ===
VPC ID: _______________
Subnet 1 ID: _______________
Subnet 2 ID: _______________
ALB Security Group ID: _______________
ECS Security Group ID: _______________

=== Load Balancer ===
ALB ARN: _______________
ALB DNS Name: _______________
Backend Target Group ARN: _______________
Frontend Target Group ARN: _______________

=== ECS ===
Cluster Name: secrets-portal-cluster
Backend Service: secrets-portal-backend
Frontend Service: secrets-portal-frontend
Task Definition: secrets-portal

=== ECR ===
Backend Repository: $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-backend
Frontend Repository: $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/secrets-portal-frontend

=== IAM Roles ===
Execution Role: SecretsPortalECSExecutionRole
Task Role: SecretsPortalECSTaskRole

=== DynamoDB Tables ===
Metadata Table: secrets-metadata
Audit Log Table: secrets-audit-log
Console Changes Table: aws-console-changes

=== Cognito ===
User Pool ID: _______________
Client ID: _______________
Admin Email: admin@example.com
Admin Password: (set on first login)

=== Application Access ===
URL: http://YOUR_ALB_DNS
HTTPS URL (if configured): https://secrets.yourdomain.com

=== CloudWatch Log Groups ===
Backend Logs: /ecs/secrets-portal-backend
Frontend Logs: /ecs/secrets-portal-frontend
```

---

## ✅ Final Verification Checklist

### Infrastructure
- [ ] VPC and subnets created in 2 AZs
- [ ] Security groups configured correctly
- [ ] ALB created and active
- [ ] Target groups created with health checks
- [ ] ECS cluster created
- [ ] IAM roles created with correct permissions
- [ ] CloudWatch log groups created

### Containers
- [ ] Docker images built successfully
- [ ] Images pushed to ECR
- [ ] Task definition registered
- [ ] Services created and running
- [ ] Tasks in RUNNING state
- [ ] No errors in CloudWatch logs

### Application
- [ ] Can access application via ALB DNS
- [ ] Login works with admin credentials
- [ ] Can create secrets
- [ ] Can view secrets list
- [ ] Can update secrets
- [ ] Filters work (application, environment)
- [ ] Audit logs are recorded
- [ ] Permissions work (group-based access)

### Optional
- [ ] HTTPS configured with ACM certificate
- [ ] Custom domain configured with Route53
- [ ] Auto-scaling enabled
- [ ] CloudWatch alarms configured
- [ ] Teams notifications configured
- [ ] Backup/disaster recovery plan documented

---

## 🎯 Success Criteria

✅ Application accessible via ALB DNS  
✅ All services running and healthy  
✅ Can login and manage secrets  
✅ Audit logging working  
✅ Group-based permissions enforced  
✅ No errors in logs  
✅ Cost within budget ($44/month)  

---

## 📚 Next Steps

1. **Create additional users** for your teams
2. **Import existing secrets** from other systems
3. **Setup custom domain** (optional)
4. **Configure HTTPS** with ACM (optional)
5. **Setup Teams notifications** (optional)
6. **Configure auto-scaling** based on usage
7. **Setup billing alerts** in CloudWatch
8. **Document runbooks** for your team
9. **Schedule regular backups** of DynamoDB tables
10. **Review and optimize costs** monthly

---

## 📖 Reference Documents

- **ALB_ECS_ARCHITECTURE.md** - Architecture overview and cost analysis
- **DOCKER_DEPLOYMENT_GUIDE.md** - Docker container details
- **AUTHENTICATION_GUIDE.md** - User and group management
- **TEAMS_NOTIFICATIONS_SETUP.md** - Teams integration
- **AWS_COST_BREAKDOWN.md** - Detailed cost analysis

---

## 🚀 Quick Command Reference

```bash
# View service status
aws ecs describe-services --cluster secrets-portal-cluster --services secrets-portal-backend --region us-east-1

# View logs
aws logs tail /ecs/secrets-portal-backend --follow --region us-east-1

# Force new deployment
aws ecs update-service --cluster secrets-portal-cluster --service secrets-portal-backend --force-new-deployment --region us-east-1

# Scale service
aws ecs update-service --cluster secrets-portal-cluster --service secrets-portal-backend --desired-count 2 --region us-east-1

# Check target health
aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_ARN --region us-east-1

# View task details
aws ecs describe-tasks --cluster secrets-portal-cluster --tasks TASK_ID --region us-east-1
```

---

## Summary

**Total Time**: 2-3 hours  
**Monthly Cost**: $44 (vs $60 with EC2)  
**Difficulty**: Medium  
**Maintenance**: Minimal (serverless)  

**You now have**:
- ✅ Fully serverless container deployment
- ✅ Auto-scaling and high availability
- ✅ Zero downtime deployments
- ✅ Multi-AZ redundancy
- ✅ Comprehensive monitoring and logging
- ✅ Production-ready infrastructure
- ✅ Lower cost than EC2

**Congratulations!** Your Secrets Portal is now running on ECS Fargate! 🎉

