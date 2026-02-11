# Serverless Architecture with ALB + ECS Fargate + Route53

**Perfect for**: 200 secrets, 10-20 users, custom domain

**Estimated Cost**: $44/month (vs $60-75 with EC2)

---

## 🏗️ Architecture

```
Route53 (DNS)
    ↓
Application Load Balancer (ALB)
    ↓
ECS Fargate (Serverless Containers)
    ├── Backend Container (Express API)
    └── Frontend Container (Nginx + React)
    ↓
DynamoDB + Secrets Manager + Cognito
```

---

## 💰 Monthly Cost Breakdown

| Service | Usage | Cost |
|---------|-------|------|
| **ALB** | 1 ALB, 100K LCU-hours | $16.20 |
| **ECS Fargate** | 0.5 vCPU, 1GB RAM | $14.50 |
| **Route53** | 1 hosted zone, 1M queries | $0.50 |
| **DynamoDB** | 200 items, on-demand | $2.00 |
| **Secrets Manager** | 20 secrets (consolidated) | $8.00 |
| **Cognito** | 20 users | $0.00 |
| **CloudWatch** | Logs + metrics | $3.00 |
| **TOTAL** | | **$44.20/month** |

**Savings**: $60 → $44 = **$16/month** or **$192/year**

---

## ✅ Benefits of ALB + ECS Fargate

1. **No EC2 management** - Serverless containers
2. **Auto-scaling** - Scale to zero when not used
3. **High availability** - Multi-AZ by default
4. **Custom domain** - Use Route53 for DNS
5. **SSL/TLS** - Free certificates with ACM
6. **Health checks** - Automatic container restart
7. **Zero downtime deployments** - Rolling updates

---

## 📦 What I'll Create

1. **ECS Cluster** - Fargate serverless cluster
2. **Task Definitions** - Container configurations
3. **ALB** - Load balancer with target groups
4. **Route53** - DNS configuration
5. **ACM Certificate** - Free SSL certificate
6. **Security Groups** - Network security
7. **IAM Roles** - Container permissions
8. **CDK Stack** - Infrastructure as Code

---

## 🚀 Deployment Flow

```bash
# 1. Build and push Docker images to ECR
./build-and-push.sh

# 2. Deploy infrastructure with CDK
cd packages/infrastructure
cdk deploy

# 3. Update Route53 (if custom domain)
# Point your domain to ALB DNS name

# 4. Done! Access via your domain
https://secrets.yourdomain.com
```

---

## 📊 Comparison

| Feature | EC2 + PM2 | ALB + ECS Fargate |
|---------|-----------|-------------------|
| Cost | $60/month | $44/month ✅ |
| Scaling | Manual | Automatic ✅ |
| Availability | Single AZ | Multi-AZ ✅ |
| Maintenance | High | None ✅ |
| SSL | Manual | Automatic ✅ |
| Deployment | SSH + SCP | One command ✅ |

---

Ready to proceed? I'll create the complete CDK infrastructure!
