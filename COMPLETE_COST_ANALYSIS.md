# Secrets Portal - Complete Cost Analysis

Detailed cost breakdown for all deployment options: EC2, ECS Fargate, and AWS Amplify.

**Last Updated**: January 2026  
**Region**: US East (N. Virginia) - us-east-1  
**Assumptions**: 150 secrets, 20 users, 2 CloudWatch metrics

---

## 📊 Quick Comparison Summary

| Deployment Option | Monthly Cost | Annual Cost | Setup Time | Maintenance | Best For |
|-------------------|--------------|-------------|------------|-------------|----------|
| **EC2 Internal** | **$84.18** | **$1,010** | 2-3 hours | 6-8 hrs/month | Internal use, lowest AWS cost |
| **EC2 + ALB** | **$99.88** | **$1,199** | 2-3 hours | 6-8 hrs/month | Public access, predictable cost |
| **ECS Fargate** | **$100.28** | **$1,203** | 3-4 hours | 1-2 hrs/month | Auto-scaling, high availability |
| **Amplify + Lambda** | **$69.10** | **$829** | 1-2 hours | < 1 hr/month | Serverless, CI/CD, lowest total cost |

---

# Section 1: EC2 Deployment

Complete cost analysis for EC2-based deployment options.

---

## 1.1 EC2 Internal (Route53 Only) - For Internal Use

**Architecture**:
```
Route53 Private Hosted Zone
    ↓
EC2 Instance (Private IP)
    ├── Nginx (Port 80/443)
    ├── Backend (Express + PM2)
    └── Frontend (React static files)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: Internal only via VPN or private network

### Monthly Cost Breakdown

| Component | Specification | Monthly Cost | Annual Cost |
|-----------|--------------|--------------|-------------|
| **EC2 Instance** | t3.small (2 vCPU, 2 GB RAM) | $15.20 | $182.40 |
| **EBS Storage** | 30 GB gp3 | $2.40 | $28.80 |
| **EBS Snapshots** | 10 GB (weekly backups) | $0.50 | $6.00 |
| **Route53** | Private hosted zone | $0.50 | $6.00 |
| **DynamoDB** | 200 items, on-demand | $2.00 | $24.00 |
| **Secrets Manager** | 150 secrets @ $0.40 each | $60.00 | $720.00 |
| **Cognito** | 20 users | $0.00 | $0.00 |
| **CloudWatch Logs** | 5 GB ingestion | $2.50 | $30.00 |
| **CloudWatch Metrics** | 2 custom metrics | $0.60 | $7.20 |
| **CloudWatch Alarms** | 3 alarms | $0.30 | $3.60 |
| **SNS** | 1,000 emails/month | $0.02 | $0.24 |
| **EventBridge** | 10K events/month | $0.01 | $0.12 |
| **Lambda** | Rotation checker | $0.15 | $1.80 |
| **TOTAL** | | **$84.18** | **$1,010** |

### Cost Optimization Options

| Optimization | Current | Optimized | Savings |
|--------------|---------|-----------|---------|
| **Reserved Instance (1-year)** | $84.18 | $78.08 | $6.10/month |
| **Reserved Instance (3-year)** | $84.18 | $75.08 | $9.10/month |
| **Consolidate Secrets** (150→15) | $84.18 | $30.18 | $54.00/month |
| **Use t3.micro** | $84.18 | $75.68 | $8.50/month |

**Best Optimized Cost**: $21.08/month (with all optimizations)

### Pros and Cons

**Pros**:
- ✅ Lowest AWS cost for internal use
- ✅ Simple architecture
- ✅ Full control over environment
- ✅ No ALB needed (saves $16.20/month)
- ✅ Predictable costs

**Cons**:
- ❌ Manual server management
- ❌ Single point of failure
- ❌ No auto-scaling
- ❌ Requires VPN for access
- ❌ Manual SSL certificate management
- ❌ High maintenance (6-8 hours/month)

### Maintenance Costs

| Task | Frequency | Time/Month | Cost @ $50/hr |
|------|-----------|------------|---------------|
| OS updates | Weekly | 2 hours | $100 |
| Security patches | Monthly | 1 hour | $50 |
| PM2 monitoring | Daily | 2 hours | $100 |
| Log rotation | Monthly | 0.5 hours | $25 |
| Backup verification | Weekly | 1 hour | $50 |
| **Total** | | **6.5 hours** | **$325** |

**Total Cost with Maintenance**: $84.18 + $325 = **$409.18/month**

---

## 1.2 EC2 + ALB - For Public Access

**Architecture**:
```
Route53 (Public DNS)
    ↓
Application Load Balancer (SSL termination)
    ↓
EC2 Instance
    ├── Backend (Express + PM2)
    └── Frontend (React static files)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: Public internet with HTTPS

### Monthly Cost Breakdown

| Component | Specification | Monthly Cost | Annual Cost |
|-----------|--------------|--------------|-------------|
| **EC2 Instance** | t3.small (2 vCPU, 2 GB RAM) | $15.20 | $182.40 |
| **EBS Storage** | 30 GB gp3 | $2.40 | $28.80 |
| **EBS Snapshots** | 10 GB | $0.50 | $6.00 |
| **ALB** | 1 load balancer | $16.20 | $194.40 |
| **Route53** | Public hosted zone | $0.50 | $6.00 |
| **DynamoDB** | 200 items | $2.00 | $24.00 |
| **Secrets Manager** | 150 secrets | $60.00 | $720.00 |
| **Cognito** | 20 users | $0.00 | $0.00 |
| **CloudWatch** | Logs + metrics + alarms | $3.42 | $41.04 |
| **SNS** | Notifications | $0.02 | $0.24 |
| **EventBridge** | Events | $0.01 | $0.12 |
| **Lambda** | Rotation checker | $0.15 | $1.80 |
| **SSL Certificate** | ACM | $0.00 | $0.00 |
| **TOTAL** | | **$99.88** | **$1,199** |

### Cost Optimization Options

| Optimization | Current | Optimized | Savings |
|--------------|---------|-----------|---------|
| **Reserved Instance (1-year)** | $99.88 | $93.78 | $6.10/month |
| **Reserved Instance (3-year)** | $99.88 | $90.78 | $9.10/month |
| **Consolidate Secrets** | $99.88 | $45.88 | $54.00/month |

**Best Optimized Cost**: $36.78/month (with all optimizations)

### Pros and Cons

**Pros**:
- ✅ Public internet access
- ✅ Free SSL certificate (ACM)
- ✅ Health checks and auto-restart
- ✅ Can add multiple EC2 instances
- ✅ Predictable costs

**Cons**:
- ❌ Higher cost (+$15.70 vs internal)
- ❌ Manual server management
- ❌ Single EC2 instance (unless scaled)
- ❌ High maintenance (6-8 hours/month)
- ❌ Manual scaling

**Total Cost with Maintenance**: $99.88 + $325 = **$424.88/month**

---

## 1.3 EC2 Cost Summary

| Deployment | AWS Cost | Maintenance | Total | Best For |
|------------|----------|-------------|-------|----------|
| **EC2 Internal** | $84.18 | $325 | $409.18 | Internal use only |
| **EC2 + ALB** | $99.88 | $325 | $424.88 | Public access needed |
| **EC2 Reserved (1yr)** | $78.08 | $325 | $403.08 | Long-term commitment |

**Recommendation**: Use EC2 Internal for lowest AWS cost, but consider maintenance burden.

---

# Section 2: ECS Fargate Deployment

Complete cost analysis for ECS Fargate serverless container deployment.

---

## 2.1 ECS Fargate with ALB

**Architecture**:
```
Route53 (Public DNS)
    ↓
Application Load Balancer (SSL termination)
    ↓
ECS Fargate Cluster (Multi-AZ)
    ├── Backend Container (Express API)
    └── Frontend Container (Nginx + React)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: Public internet with HTTPS, auto-scaling

### Monthly Cost Breakdown

| Component | Specification | Monthly Cost | Annual Cost |
|-----------|--------------|--------------|-------------|
| **Fargate vCPU** | 0.5 vCPU × 730 hours | $14.60 | $175.20 |
| **Fargate Memory** | 1 GB × 730 hours | $3.20 | $38.40 |
| **ALB** | 1 load balancer + LCU | $16.20 | $194.40 |
| **ECR Storage** | 2 GB (2 images) | $0.20 | $2.40 |
| **Route53** | Public hosted zone | $0.50 | $6.00 |
| **DynamoDB** | 200 items | $2.00 | $24.00 |
| **Secrets Manager** | 150 secrets | $60.00 | $720.00 |
| **Cognito** | 20 users | $0.00 | $0.00 |
| **CloudWatch** | Logs + metrics + alarms | $3.42 | $41.04 |
| **SNS** | Notifications | $0.02 | $0.24 |
| **EventBridge** | Events | $0.01 | $0.12 |
| **Lambda** | Rotation checker | $0.15 | $1.80 |
| **SSL Certificate** | ACM | $0.00 | $0.00 |
| **TOTAL** | | **$100.28** | **$1,203** |

### Cost Optimization Options

| Optimization | Current | Optimized | Savings |
|--------------|---------|-----------|---------|
| **Fargate Spot** (70% discount) | $100.28 | $88.18 | $12.10/month |
| **Reduce to 0.25 vCPU** | $100.28 | $92.98 | $7.30/month |
| **Consolidate Secrets** | $100.28 | $46.28 | $54.00/month |
| **Business Hours Only** | $100.28 | $23.36 | $76.92/month |

**Best Optimized Cost**: $16.91/month (Fargate Spot + business hours + consolidated secrets)

### Pros and Cons

**Pros**:
- ✅ Zero server management
- ✅ Auto-scaling (handles any traffic)
- ✅ Multi-AZ high availability
- ✅ Zero downtime deployments
- ✅ Container-based (portable)
- ✅ Minimal maintenance (1-2 hours/month)
- ✅ Built-in health checks

**Cons**:
- ❌ Slightly higher cost than EC2
- ❌ Requires ALB (cannot use Route53 only)
- ❌ More complex initial setup
- ❌ Cold starts possible (rare)

### Maintenance Costs

| Task | Frequency | Time/Month | Cost @ $50/hr |
|------|-----------|------------|---------------|
| Image updates | Weekly | 0.5 hours | $25 |
| Service monitoring | Daily | 0.5 hours | $25 |
| Task definition updates | Monthly | 0.5 hours | $25 |
| **Total** | | **1.5 hours** | **$75** |

**Total Cost with Maintenance**: $100.28 + $75 = **$175.28/month**

**Savings vs EC2**: $409.18 - $175.28 = **$233.90/month** ($2,807/year)

---

## 2.2 ECS Fargate Spot (Cost-Optimized)

Use Fargate Spot for 70% discount on compute costs.

### Monthly Cost Breakdown

| Component | Regular | Spot | Savings |
|-----------|---------|------|---------|
| **Fargate vCPU** | $14.60 | $4.38 | $10.22 |
| **Fargate Memory** | $3.20 | $0.96 | $2.24 |
| **Other costs** | $82.48 | $82.48 | $0.00 |
| **TOTAL** | **$100.28** | **$88.18** | **$12.10** |

**Trade-off**: Spot instances can be interrupted (rare for low traffic workloads)

---

## 2.3 ECS Cost Summary

| Deployment | AWS Cost | Maintenance | Total | Best For |
|------------|----------|-------------|-------|----------|
| **ECS Fargate** | $100.28 | $75 | $175.28 | Auto-scaling, HA |
| **ECS Fargate Spot** | $88.18 | $75 | $163.18 | Cost-optimized |
| **ECS Business Hours** | $23.36 | $75 | $98.36 | Dev/test environments |

**Recommendation**: Use ECS Fargate for production with auto-scaling needs and minimal maintenance.

---

# Section 3: AWS Amplify Deployment

Complete cost analysis for AWS Amplify + Lambda serverless deployment.

---

## 3.1 Amplify + Lambda (Fully Serverless)

**Architecture**:
```
Route53 (Optional - Custom Domain)
    ↓
AWS Amplify (Frontend - React App on CDN)
    ↓
API Gateway (REST API)
    ↓
Lambda Functions (Backend Logic)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: Global CDN, auto-scaling, CI/CD from Git

### Monthly Cost Breakdown

| Component | Specification | Monthly Cost | Annual Cost |
|-----------|--------------|--------------|-------------|
| **Amplify Hosting** | Build + hosting + CDN | $0.00 | $0.00 |
| **Amplify Build** | 30 builds × 5 min | $0.00 | $0.00 |
| **Amplify Storage** | 5 GB | $0.00 | $0.00 |
| **Amplify Transfer** | 15 GB/month | $0.00 | $0.00 |
| **API Gateway** | 1M requests | $3.50 | $42.00 |
| **Lambda Requests** | 1M requests | $0.20 | $2.40 |
| **Lambda Duration** | 10K GB-seconds | $0.17 | $2.04 |
| **DynamoDB** | 200 items | $2.00 | $24.00 |
| **Secrets Manager** | 150 secrets | $60.00 | $720.00 |
| **Cognito** | 20 users | $0.00 | $0.00 |
| **CloudWatch** | Logs + metrics | $3.20 | $38.40 |
| **SNS** | Notifications | $0.02 | $0.24 |
| **EventBridge** | Events | $0.01 | $0.12 |
| **Route53** | Optional domain | $0.00 | $0.00 |
| **SSL Certificate** | ACM | $0.00 | $0.00 |
| **TOTAL** | | **$69.10** | **$829** |

**Note**: Amplify hosting is FREE within generous free tier limits!

### Amplify Free Tier (Permanent)

| Resource | Free Tier | Typical Usage | Cost if Exceeded |
|----------|-----------|---------------|------------------|
| **Build minutes** | 1,000/month | 150/month | $0.01/minute |
| **Storage** | 5 GB | 2 GB | $0.023/GB |
| **Data transfer** | 15 GB/month | 10 GB | $0.15/GB |

**Result**: Most small to medium apps stay within free tier!

### Cost Optimization Options

| Optimization | Current | Optimized | Savings |
|--------------|---------|-----------|---------|
| **Consolidate Secrets** | $69.10 | $15.10 | $54.00/month |
| **Reduce API calls** | $69.10 | $65.60 | $3.50/month |
| **Use Lambda free tier** | $69.10 | $68.73 | $0.37/month |

**Best Optimized Cost**: $11.10/month (with consolidated secrets)

### Pros and Cons

**Pros**:
- ✅ **Lowest total cost** ($69/month)
- ✅ Zero server management
- ✅ Auto-scaling (infinite scale)
- ✅ Global CDN (fast worldwide)
- ✅ **CI/CD built-in** (auto-deploy on git push)
- ✅ Free SSL certificates
- ✅ Preview environments for branches
- ✅ Pay per request (cost-effective for low traffic)
- ✅ **Minimal maintenance** (< 1 hour/month)

**Cons**:
- ❌ Cold starts (1-3 seconds on first request)
- ❌ Lambda limits (15 min timeout, 10 GB memory)
- ❌ More complex debugging than Express
- ❌ API Gateway costs add up at very high scale
- ❌ Requires code changes (Express → Lambda)

### Maintenance Costs

| Task | Frequency | Time/Month | Cost @ $50/hr |
|------|-----------|------------|---------------|
| Monitor deployments | Weekly | 0.25 hours | $12.50 |
| Update dependencies | Monthly | 0.25 hours | $12.50 |
| Review logs | Weekly | 0.25 hours | $12.50 |
| **Total** | | **0.75 hours** | **$37.50** |

**Total Cost with Maintenance**: $69.10 + $37.50 = **$106.60/month**

**Savings vs EC2**: $409.18 - $106.60 = **$302.58/month** ($3,631/year)

---

## 3.2 Amplify + EC2 Backend (Hybrid)

Keep Express backend on EC2, use Amplify for frontend only.

### Monthly Cost Breakdown

| Component | Monthly Cost |
|-----------|--------------|
| **Amplify Hosting** | $0.00 |
| **EC2 t3.small** | $15.20 |
| **EBS Storage** | $2.40 |
| **Services** | $65.58 |
| **TOTAL** | **$83.18** |

**Use case**: Want Amplify benefits but don't want to convert to Lambda

---

## 3.3 Amplify Cost Summary

| Deployment | AWS Cost | Maintenance | Total | Best For |
|------------|----------|-------------|-------|----------|
| **Amplify + Lambda** | $69.10 | $37.50 | $106.60 | Serverless, CI/CD |
| **Amplify + EC2** | $83.18 | $325 | $408.18 | Keep Express backend |
| **Amplify Optimized** | $15.10 | $37.50 | $52.60 | With secret consolidation |

**Recommendation**: Use Amplify + Lambda for lowest cost and best developer experience.

---

# Final Comparison & Recommendations

---

## Cost Comparison Table

### AWS Costs Only (24/7 Operation)

| Solution | Monthly | Annual | 5-Year Total |
|----------|---------|--------|--------------|
| **Amplify + Lambda** | **$69.10** ✅ | **$829** | **$4,145** |
| **EC2 Internal** | $84.18 | $1,010 | $5,050 |
| **EC2 + ALB** | $99.88 | $1,199 | $5,995 |
| **ECS Fargate** | $100.28 | $1,203 | $6,015 |

**Winner**: Amplify + Lambda saves **$15-31/month**

### Total Cost Including Maintenance

| Solution | AWS Cost | Maintenance | Total | 5-Year Total |
|----------|----------|-------------|-------|--------------|
| **Amplify + Lambda** | $69.10 | $37.50 | **$106.60** ✅ | **$6,396** |
| **ECS Fargate** | $100.28 | $75.00 | $175.28 | $10,517 |
| **EC2 Internal** | $84.18 | $325.00 | $409.18 | $24,551 |
| **EC2 + ALB** | $99.88 | $325.00 | $424.88 | $25,493 |

**Winner**: Amplify + Lambda saves **$69-318/month** including maintenance!

---

## Decision Matrix

### Choose EC2 If:

✅ Internal use only (VPN access)  
✅ Want lowest AWS bill ($84/month)  
✅ Have DevOps resources (6-8 hrs/month)  
✅ Need full control over environment  
✅ Can commit to reserved instances  
✅ Comfortable with manual deployments  

**Best EC2 Setup**: t3.small (reserved 1yr) + Route53 = **$78.08/month**

---

### Choose ECS Fargate If:

✅ Need auto-scaling  
✅ Require high availability (multi-AZ)  
✅ Want zero downtime deployments  
✅ Prefer containers over VMs  
✅ Can afford $100/month  
✅ Want minimal maintenance (1-2 hrs/month)  

**Best ECS Setup**: Fargate Spot = **$88.18/month**

---

### Choose Amplify + Lambda If:

✅ Want **lowest total cost** ($69/month)  
✅ Want **zero server management**  
✅ Need **CI/CD** (auto-deploy on git push)  
✅ Have variable or low traffic  
✅ Can tolerate cold starts (1-3 seconds)  
✅ Want **global CDN**  
✅ Willing to convert Express to Lambda  

**Best Amplify Setup**: Lambda + consolidated secrets = **$15.10/month**

---

## ROI Analysis

### 5-Year Total Cost of Ownership

| Solution | Year 1 | Year 2-5 | 5-Year Total | Avg/Month |
|----------|--------|----------|--------------|-----------|
| **Amplify + Lambda** | $1,279 | $1,279/yr | **$6,396** | $106.60 |
| **ECS Fargate** | $2,103 | $2,103/yr | **$10,517** | $175.28 |
| **EC2 Internal** | $4,910 | $4,910/yr | **$24,551** | $409.18 |
| **EC2 + ALB** | $5,099 | $5,099/yr | **$25,493** | $424.88 |

**Savings with Amplify over 5 years**:
- vs EC2 Internal: **$18,155** (74% cheaper)
- vs EC2 + ALB: **$19,097** (75% cheaper)
- vs ECS Fargate: **$4,121** (39% cheaper)

---

## Final Recommendation

### For Your Use Case (150 secrets, 20 users, internal tool):

**Best Option**: **AWS Amplify + Lambda**

**Why**:
1. **Lowest cost**: $69/month vs $84-100/month
2. **Minimal maintenance**: < 1 hour/month vs 6-8 hours
3. **CI/CD built-in**: Deploy on git push
4. **Auto-scaling**: Handles any traffic
5. **Global CDN**: Fast loading worldwide
6. **5-year savings**: $18,000+ vs EC2

**Trade-offs**:
- Cold starts (1-3 seconds) - acceptable for internal tool
- Need to convert Express to Lambda (2-3 hours one-time work)

**ROI**: 
- Time saved: 5-7 hours/month = $250-350/month
- Cost saved: $15-31/month
- **Total value**: $265-381/month = **$3,180-4,572/year**

---

## Summary

✅ **Amplify + Lambda**: Lowest cost, best for most use cases  
✅ **ECS Fargate**: Best for auto-scaling and high availability  
✅ **EC2**: Best for full control and internal-only use  

**Recommended**: Start with **Amplify + Lambda** for lowest cost and maintenance, migrate to ECS if you need more control later.

