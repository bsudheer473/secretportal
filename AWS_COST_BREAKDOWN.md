# AWS Cost Breakdown - Secrets Manager Portal

**Last Updated**: January 2026  
**Region**: US East (N. Virginia) - us-east-1  
**Pricing**: Based on AWS public pricing

---

## 💰 Monthly Cost Estimate

### Summary by Usage Level

| Component | Low Usage | Medium Usage | High Usage |
|-----------|-----------|--------------|------------|
| **Total Monthly Cost** | **$35-50** | **$75-100** | **$150-200** |

---

## 📊 Detailed Cost Breakdown

### 1. AWS Secrets Manager
**Purpose**: Store and manage secrets

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Secrets stored | 10 secrets | 50 secrets | 200 secrets | $0.40/secret/month |
| API calls | 10K/month | 100K/month | 500K/month | $0.05/10K calls |
| **Monthly Cost** | **$4.50** | **$20.50** | **$82.50** |

**Calculation**:
- Low: (10 × $0.40) + (10K × $0.05/10K) = $4 + $0.50 = $4.50
- Medium: (50 × $0.40) + (100K × $0.05/10K) = $20 + $0.50 = $20.50
- High: (200 × $0.40) + (500K × $0.05/10K) = $80 + $2.50 = $82.50

---

### 2. Amazon DynamoDB
**Purpose**: Store secrets metadata, audit logs, console changes

**Tables**:
- `secrets-metadata` (main secrets index)
- `secrets-audit-log` (access tracking)
- `aws-console-changes` (direct AWS changes)

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Storage | 1 GB | 5 GB | 20 GB | $0.25/GB/month |
| Read requests | 1M/month | 10M/month | 50M/month | $0.25/million |
| Write requests | 100K/month | 1M/month | 5M/month | $1.25/million |
| **Monthly Cost** | **$0.50** | **$4.00** | **$11.50** |

**Calculation**:
- Low: (1 × $0.25) + (1M × $0.25/M) + (0.1M × $1.25/M) = $0.25 + $0.25 + $0.125 ≈ $0.50
- Medium: (5 × $0.25) + (10M × $0.25/M) + (1M × $1.25/M) = $1.25 + $2.50 + $1.25 = $5.00
- High: (20 × $0.25) + (50M × $0.25/M) + (5M × $1.25/M) = $5 + $12.50 + $6.25 = $23.75

**Note**: Using on-demand pricing. Reserved capacity can reduce costs by 50-75%.

---

### 3. AWS Lambda
**Purpose**: Backend API, rotation checker, change tracker

**Functions**:
- Secrets API handlers (CRUD operations)
- Rotation checker (scheduled)
- Secrets change tracker (EventBridge triggered)

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Requests | 100K/month | 1M/month | 5M/month | $0.20/1M requests |
| Duration (GB-seconds) | 1,000 | 10,000 | 50,000 | $0.0000166667/GB-second |
| **Monthly Cost** | **$0.20** | **$0.40** | **$1.20** |

**Calculation**:
- Low: (0.1M × $0.20/M) + (1K × $0.0000166667) = $0.02 + $0.017 ≈ $0.20
- Medium: (1M × $0.20/M) + (10K × $0.0000166667) = $0.20 + $0.17 = $0.37
- High: (5M × $0.20/M) + (50K × $0.0000166667) = $1.00 + $0.83 = $1.83

**Free Tier**: 1M requests + 400K GB-seconds/month (covers low usage entirely)

---

### 4. Amazon Cognito
**Purpose**: User authentication and authorization

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Monthly Active Users | 10 users | 50 users | 200 users | Free up to 50K MAU |
| **Monthly Cost** | **$0** | **$0** | **$0** |

**Note**: First 50,000 MAUs are free. After that, $0.0055/MAU.

---

### 5. Amazon SNS
**Purpose**: Email notifications for Prod changes and rotation alerts

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Email notifications | 100/month | 1,000/month | 5,000/month | $2.00/100K emails |
| **Monthly Cost** | **$0** | **$0.02** | **$0.10** |

**Free Tier**: 1,000 email notifications/month

---

### 6. Amazon EventBridge
**Purpose**: Trigger Lambda on Secrets Manager changes

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Custom events | 1K/month | 10K/month | 50K/month | $1.00/million events |
| **Monthly Cost** | **$0** | **$0.01** | **$0.05** |

**Free Tier**: First 1M events/month are free

---

### 7. Amazon CloudWatch
**Purpose**: Logs, metrics, and monitoring

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Log ingestion | 1 GB/month | 5 GB/month | 20 GB/month | $0.50/GB |
| Log storage | 1 GB | 5 GB | 20 GB | $0.03/GB/month |
| Metrics | 10 custom | 50 custom | 200 custom | $0.30/metric/month |
| **Monthly Cost** | **$3.50** | **$17.65** | **$70.60** |

**Calculation**:
- Low: (1 × $0.50) + (1 × $0.03) + (10 × $0.30) = $0.50 + $0.03 + $3.00 = $3.53
- Medium: (5 × $0.50) + (5 × $0.03) + (50 × $0.30) = $2.50 + $0.15 + $15.00 = $17.65
- High: (20 × $0.50) + (20 × $0.03) + (200 × $0.30) = $10 + $0.60 + $60 = $70.60

---

### 8. EC2 Instance (Backend Express Server)
**Purpose**: Host Express.js backend API

**Current Setup**: t2.micro (1 vCPU, 1 GB RAM)

| Instance Type | vCPU | RAM | Monthly Cost | Use Case |
|---------------|------|-----|--------------|----------|
| t2.micro | 1 | 1 GB | **$8.50** | Development/Testing |
| t3.small | 2 | 2 GB | **$15.20** | Low-Medium Production |
| t3.medium | 2 | 4 GB | **$30.40** | Medium-High Production |
| t3.large | 2 | 8 GB | **$60.80** | High Production |

**Recommended**: t3.small for production ($15.20/month)

**Additional EC2 Costs**:
- EBS Storage (30 GB): $3.00/month
- Data Transfer Out (first 100 GB free, then $0.09/GB)

**Total EC2 Cost**: $18.20/month (t3.small + storage)

---

### 9. Elastic IP (Optional)
**Purpose**: Static IP for EC2 instance

| Item | Cost |
|------|------|
| Elastic IP (attached) | **$0** |
| Elastic IP (unattached) | $3.60/month |

**Note**: Free when attached to running instance

---

### 10. Data Transfer
**Purpose**: Internet data transfer

| Metric | Low Usage | Medium Usage | High Usage | Price |
|--------|-----------|--------------|------------|-------|
| Data out | 1 GB/month | 10 GB/month | 50 GB/month | First 100 GB free, then $0.09/GB |
| **Monthly Cost** | **$0** | **$0** | **$0** |

**Free Tier**: First 100 GB/month free

---

## 📈 Total Monthly Cost Summary

### By Usage Level

| Component | Low Usage | Medium Usage | High Usage |
|-----------|-----------|--------------|------------|
| Secrets Manager | $4.50 | $20.50 | $82.50 |
| DynamoDB | $0.50 | $4.00 | $11.50 |
| Lambda | $0.20 | $0.40 | $1.20 |
| Cognito | $0 | $0 | $0 |
| SNS | $0 | $0.02 | $0.10 |
| EventBridge | $0 | $0.01 | $0.05 |
| CloudWatch | $3.50 | $17.65 | $70.60 |
| EC2 (t3.small) | $18.20 | $18.20 | $18.20 |
| **TOTAL** | **$26.90** | **$60.78** | **$184.15** |

---

## 💡 Cost Optimization Strategies

### 1. Use Reserved Instances for EC2
- **Savings**: 30-70% on EC2 costs
- **1-year commitment**: Save ~40% → $10.90/month instead of $18.20
- **3-year commitment**: Save ~60% → $7.30/month instead of $18.20

### 2. DynamoDB Reserved Capacity
- **Savings**: 50-75% on read/write capacity
- **Best for**: Predictable workloads
- **Example**: Medium usage could drop from $4.00 to $1.50/month

### 3. CloudWatch Log Retention
- **Default**: Logs retained forever
- **Optimization**: Set retention to 30-90 days
- **Savings**: 50-80% on log storage costs

### 4. Lambda Optimization
- **Right-size memory**: Use 256-512 MB instead of default 1024 MB
- **Reduce cold starts**: Use provisioned concurrency only if needed
- **Savings**: 30-50% on Lambda costs

### 5. Secrets Manager Optimization
- **Consolidate secrets**: Store multiple values in one secret (JSON)
- **Example**: Instead of 10 secrets, use 2-3 secrets with multiple key-value pairs
- **Savings**: 70-80% on secret storage costs

### 6. Use AWS Free Tier
- **Lambda**: 1M requests + 400K GB-seconds/month (permanent)
- **DynamoDB**: 25 GB storage + 25 RCU + 25 WCU (permanent)
- **CloudWatch**: 10 custom metrics + 5 GB logs (permanent)
- **Cognito**: 50K MAU (permanent)

---

## 📊 Cost Comparison: Serverless vs EC2

### Option A: Fully Serverless (No EC2)
Replace Express on EC2 with API Gateway + Lambda

| Component | Monthly Cost |
|-----------|--------------|
| API Gateway | $3.50 (1M requests) |
| Lambda (backend) | $1.00 |
| Other services | $42.28 |
| **TOTAL** | **$46.78** |

**Pros**: Auto-scaling, no server management, pay-per-use  
**Cons**: Cold starts, API Gateway costs add up at scale

### Option B: Current Setup (Express on EC2)
| Component | Monthly Cost |
|-----------|--------------|
| EC2 (t3.small) | $18.20 |
| Other services | $42.58 |
| **TOTAL** | **$60.78** |

**Pros**: Consistent performance, no cold starts, simpler architecture  
**Cons**: Fixed cost regardless of usage, requires server management

**Recommendation**: Current EC2 setup is cost-effective for medium usage. Switch to serverless if usage is very low or very spiky.

---

## 🎯 Recommended Production Setup

### Small Team (10-20 users, 50 secrets)
- **EC2**: t3.small (2 vCPU, 2 GB RAM)
- **DynamoDB**: On-demand pricing
- **CloudWatch**: 30-day log retention
- **Estimated Cost**: **$50-60/month**

### Medium Team (50-100 users, 200 secrets)
- **EC2**: t3.medium (2 vCPU, 4 GB RAM) with 1-year reserved
- **DynamoDB**: Reserved capacity
- **CloudWatch**: 30-day log retention
- **Estimated Cost**: **$80-100/month**

### Large Team (200+ users, 500+ secrets)
- **EC2**: t3.large (2 vCPU, 8 GB RAM) with 1-year reserved
- **DynamoDB**: Reserved capacity + auto-scaling
- **CloudWatch**: 30-day log retention
- **Estimated Cost**: **$150-200/month**

---

## 📉 Annual Cost Projection

| Usage Level | Monthly | Annual | With Optimization |
|-------------|---------|--------|-------------------|
| Low | $27 | $324 | $200 (38% savings) |
| Medium | $61 | $732 | $500 (32% savings) |
| High | $184 | $2,208 | $1,500 (32% savings) |

**Optimization includes**: Reserved instances, DynamoDB reserved capacity, log retention policies

---

## 🔍 Cost Monitoring & Alerts

### Set Up AWS Budgets
```bash
# Create budget alert at $100/month
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

### Key Metrics to Monitor
1. **Secrets Manager API calls** - Watch for unexpected spikes
2. **DynamoDB read/write units** - Optimize queries if high
3. **EC2 CPU utilization** - Right-size instance if consistently low
4. **CloudWatch log ingestion** - Reduce verbose logging if high
5. **Lambda invocations** - Check for retry loops or errors

---

## 💰 Cost Breakdown by Feature

| Feature | Primary Cost Driver | Monthly Cost |
|---------|---------------------|--------------|
| Secret Storage | Secrets Manager | $4-80 |
| User Authentication | Cognito | $0 (free tier) |
| Audit Logging | DynamoDB + CloudWatch | $5-30 |
| Rotation Alerts | SNS + Lambda | $0.10-1 |
| Change Tracking | EventBridge + Lambda | $0.05-0.50 |
| API Backend | EC2 or Lambda | $15-60 |
| Monitoring | CloudWatch | $3-70 |

---

## 🎁 Free Tier Benefits (First 12 Months)

If you're within the first 12 months of AWS account creation:

| Service | Free Tier | Value |
|---------|-----------|-------|
| EC2 | 750 hours/month (t2.micro) | $8.50/month |
| DynamoDB | 25 GB storage + 25 RCU/WCU | $5-10/month |
| Lambda | 1M requests + 400K GB-seconds | $0.40/month |
| CloudWatch | 10 metrics + 5 GB logs | $3.50/month |
| **Total Savings** | | **$17-22/month** |

**After 12 months**: Free tier for Lambda, DynamoDB, Cognito, and CloudWatch continues permanently!

---

## Summary

✅ **Low Usage** (10 users, 10 secrets): **$27/month** ($324/year)  
✅ **Medium Usage** (50 users, 50 secrets): **$61/month** ($732/year)  
✅ **High Usage** (200 users, 200 secrets): **$184/month** ($2,208/year)

**With optimization**: Save 30-40% through reserved instances and capacity planning.

**Most cost-effective for**: Teams managing 20-200 secrets with 10-100 users.
