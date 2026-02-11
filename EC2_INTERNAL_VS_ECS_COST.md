# EC2 (Internal) vs ECS Fargate - Cost Comparison

Cost analysis for **internal-only** deployment (no public internet access required).

**Last Updated**: January 2026  
**Region**: US East (N. Virginia) - us-east-1

---

## 💰 Quick Summary - Internal Deployment

| Deployment Option | Monthly Cost | Annual Cost | Best For |
|-------------------|--------------|-------------|----------|
| **EC2 Internal (Route53 only)** | **$84.18** | **$1,010** | Internal use, lowest cost |
| **EC2 + ALB (Public)** | **$99.88** | **$1,199** | Public internet access |
| **ECS Fargate** | **$100.28** | **$1,203** | Managed, auto-scaling |

**Winner for Internal Use**: EC2 with Route53 saves **$16.10/month** vs ECS Fargate!

---

## 📊 Detailed Cost Breakdown

### Option 1: EC2 Internal (Route53 Only) - Recommended for Internal Use

#### Compute Costs

| Component | Specification | Monthly Cost | Notes |
|-----------|--------------|--------------|-------|
| **EC2 Instance** | t3.small (2 vCPU, 2 GB RAM) | $15.20 | On-demand pricing |
| **EBS Storage** | 30 GB gp3 | $2.40 | General purpose SSD |
| **EBS Snapshots** | 10 GB (weekly backups) | $0.50 | Backup storage |
| **Route53 Hosted Zone** | 1 zone | $0.50 | DNS management |
| **Route53 Queries** | 1M queries/month | $0.00 | First 1M free |
| **Data Transfer** | Internal only | $0.00 | No internet egress |
| **Subtotal (Compute)** | | **$18.60** | |

#### Application Services

| Component | Usage | Monthly Cost | Notes |
|-----------|-------|--------------|-------|
| **DynamoDB** | 200 items, on-demand | $2.00 | Metadata + audit logs |
| **Secrets Manager** | 150 secrets | $60.00 | Secret storage ($0.40/secret) |
| **Cognito** | 20 users | $0.00 | Free tier |
| **CloudWatch Logs** | 5 GB ingestion | $2.50 | Application logs |
| **CloudWatch Metrics** | 2 custom metrics | $0.60 | CPU + Memory monitoring |
| **CloudWatch Alarms** | 3 alarms | $0.30 | CPU, Memory, Health |
| **SNS** | 1,000 emails/month | $0.02 | Alarm notifications |
| **EventBridge** | 10K events/month | $0.01 | Change tracking |
| **Lambda** | 100K invocations | $0.15 | Rotation checker |
| **Subtotal (Services)** | | **$65.58** | |

#### Total EC2 Internal Monthly Cost

| Category | Cost |
|----------|------|
| Compute (EC2 + Route53) | $18.60 |
| Services | $65.58 |
| **Total AWS Cost** | **$84.18** |
| **+ Maintenance** | **$325.00** |
| **Grand Total** | **$409.18** |

**AWS-only cost**: **$84.18/month** or **$1,010/year**


---

### Option 2: EC2 + ALB (Public Internet Access)

Use this if you need public internet access or SSL termination at load balancer.

| Category | Cost |
|----------|------|
| Compute (EC2 + ALB) | $34.30 |
| Services | $65.58 |
| **Total AWS Cost** | **$99.88** |

**Cost difference**: +$15.70/month vs internal-only

---

### Option 3: ECS Fargate (Requires ALB)

ECS Fargate requires ALB for routing, cannot use Route53 directly.

| Category | Cost |
|----------|------|
| Compute (Fargate + ALB) | $34.00 |
| Container Registry | $0.20 |
| Services | $65.58 |
| Additional | $0.50 |
| **Total AWS Cost** | **$100.28** |

---

## 📈 Cost Comparison - Internal Use Case

### AWS Costs Only

| Component | EC2 Internal | EC2 + ALB | ECS Fargate | 
|-----------|--------------|-----------|-------------|
| **Compute** | $18.60 | $34.30 | $34.20 |
| **Services** | $65.58 | $65.58 | $65.58 |
| **Additional** | $0.00 | $0.00 | $0.50 |
| **Total Monthly** | **$84.18** ✅ | **$99.88** | **$100.28** |
| **Total Annual** | **$1,010** ✅ | **$1,199** | **$1,203** |

**Savings with EC2 Internal**:
- vs EC2 + ALB: **$15.70/month** ($188/year)
- vs ECS Fargate: **$16.10/month** ($193/year)

### Including Maintenance Costs

| Component | EC2 Internal | ECS Fargate | Difference |
|-----------|--------------|-------------|------------|
| **AWS Costs** | $84.18 | $100.28 | +$16.10 |
| **Maintenance** | $325.00 | $75.00 | -$250.00 |
| **Total Monthly** | **$409.18** | **$175.28** | **-$233.90** |
| **Total Annual** | **$4,910** | **$2,103** | **-$2,807** |

**Result**: ECS Fargate still **$233.90/month cheaper** when including maintenance!

---

## 🏗️ Architecture Comparison

### EC2 Internal Architecture

```
Route53 (Internal DNS)
    ↓
EC2 Instance (Private IP or Public IP)
    ├── Nginx (Port 80/443)
    ├── Backend (Express on PM2)
    └── Frontend (Static files)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: 
- Internal: `http://secrets.internal.company.com` → EC2 Private IP
- VPN/Internal Network required for access

**Pros**:
- ✅ Lowest cost ($46.58/month)
- ✅ Simple architecture
- ✅ No ALB needed
- ✅ Secure (not exposed to internet)

**Cons**:
- ❌ Single point of failure
- ❌ No auto-scaling
- ❌ Manual SSL certificate management
- ❌ Requires VPN for remote access

### EC2 + ALB Architecture

```
Route53 (Public DNS)
    ↓
Application Load Balancer (SSL termination)
    ↓
EC2 Instance
    ├── Backend (Express on PM2)
    └── Frontend (Static files)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: `https://secrets.company.com` (public internet)

**Pros**:
- ✅ SSL termination at ALB (free ACM certificate)
- ✅ Health checks and auto-restart
- ✅ Can add multiple EC2 instances later
- ✅ Public internet access

**Cons**:
- ❌ Higher cost (+$16.20/month for ALB)
- ❌ Still single EC2 instance
- ❌ Manual scaling

### ECS Fargate Architecture

```
Route53 (Public DNS)
    ↓
Application Load Balancer (SSL termination)
    ↓
ECS Fargate (Serverless Containers)
    ├── Backend Container
    └── Frontend Container
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Access**: `https://secrets.company.com` (public internet)

**Pros**:
- ✅ Auto-scaling
- ✅ Multi-AZ high availability
- ✅ Zero downtime deployments
- ✅ Minimal maintenance
- ✅ SSL termination at ALB

**Cons**:
- ❌ Higher cost (same as EC2 + ALB)
- ❌ Requires ALB (cannot use Route53 only)
- ❌ More complex setup


---

## 🔐 Security Considerations

### Internal-Only Deployment (EC2 + Route53)

**Network Setup**:
```bash
# EC2 in private subnet (recommended)
- VPC: 10.0.0.0/16
- Private Subnet: 10.0.1.0/24
- Security Group: Allow 80/443 from VPC CIDR only
- No public IP (access via VPN/Direct Connect)

# OR EC2 with public IP (less secure)
- Security Group: Allow 80/443 from corporate IP ranges only
- Use security group whitelist
```

**Route53 Configuration**:
```bash
# Create private hosted zone (internal only)
aws route53 create-hosted-zone \
  --name internal.company.com \
  --vpc VPCRegion=us-east-1,VPCId=vpc-xxxxx \
  --caller-reference $(date +%s)

# Create A record pointing to EC2 private IP
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "secrets.internal.company.com",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": [{"Value": "10.0.1.50"}]
    }
  }]
}
```

**SSL Certificate Options**:
1. **Self-signed certificate** (free, requires trust on clients)
2. **Internal CA certificate** (if you have internal PKI)
3. **Let's Encrypt** (free, but requires public DNS validation)
4. **No SSL** (HTTP only, if acceptable for internal use)

**Cost**: $0 for self-signed or internal CA

---

## 💡 Cost Optimization Strategies

### For Internal EC2 Deployment

1. **Use Reserved Instance (1-year)**:
   - Current: $84.18/month
   - With Reserved: **$78.08/month**
   - Savings: $6.10/month ($73/year)

2. **Use Reserved Instance (3-year)**:
   - Current: $84.18/month
   - With Reserved: **$75.08/month**
   - Savings: $9.10/month ($109/year)

3. **Use t3.micro instead of t3.small** (if workload allows):
   - Current: $84.18/month
   - With t3.micro: **$75.68/month**
   - Savings: $8.50/month ($102/year)

4. **Consolidate Secrets Manager secrets**:
   - Current: 150 secrets × $0.40 = $60.00/month
   - Consolidated: 15 secrets × $0.40 = **$6.00/month**
   - Savings: $54.00/month ($648/year) - Store multiple values per secret as JSON

5. **Already optimized CloudWatch metrics**:
   - Current: 2 metrics × $0.30 = $0.60/month
   - Already minimal ✅

**Optimized Internal EC2 Cost**: **$21.08/month** (with all optimizations)

---

## 🎯 Decision Matrix

### Choose EC2 Internal (Route53 Only) If:

✅ **Internal use only** (VPN or private network access)  
✅ Want **lowest AWS cost** ($84.18/month)  
✅ Have **DevOps resources** for maintenance  
✅ Don't need public internet access  
✅ Can tolerate **single point of failure**  
✅ **10-50 users** with predictable load  
✅ Acceptable to use **HTTP or self-signed SSL**  

**Best Setup**: 
- EC2 t3.small with 1-year reserved = **$78.08/month**
- Route53 private hosted zone
- Self-signed SSL certificate
- Access via VPN

### Choose EC2 + ALB If:

✅ Need **public internet access**  
✅ Want **free SSL certificate** (ACM)  
✅ Need **health checks** and auto-restart  
✅ Plan to add **multiple EC2 instances** later  
✅ Want **SSL termination** at load balancer  
✅ Can afford **$16/month more** for ALB  

**Best Setup**: 
- EC2 t3.small with 1-year reserved = **$56.18/month**
- ALB with ACM certificate
- Public Route53 hosted zone

### Choose ECS Fargate If:

✅ Want **minimal maintenance** (1.5 hrs/month vs 6.5 hrs)  
✅ Need **auto-scaling** capabilities  
✅ Require **high availability** (multi-AZ)  
✅ Want **zero downtime deployments**  
✅ Value **operational simplicity** over cost  
✅ Plan to **scale beyond 100 users**  

**Best Setup**: 
- ECS Fargate with Spot = **$50.22/month**
- ALB with ACM certificate
- Auto-scaling enabled


---

## 📊 Real-World Scenarios

### Scenario 1: Small Internal Team (10-20 users)

**Requirements**:
- Internal use only (VPN access)
- 50 secrets
- Business hours usage
- Budget-conscious

**Recommendation**: EC2 Internal with Route53

| Component | Cost |
|-----------|------|
| EC2 t3.small (reserved 1yr) | $9.10 |
| Route53 private zone | $0.50 |
| Services (50 secrets) | $25.58 |
| **Total** | **$35.18/month** |

**Why**: Lowest cost, simple setup, meets all requirements

---

### Scenario 2: Medium Company (50-100 users)

**Requirements**:
- Public internet access
- SSL certificate required
- 150 secrets
- Need monitoring and alerts

**Recommendation**: EC2 + ALB

| Component | Cost |
|-----------|------|
| EC2 t3.small (reserved 1yr) | $9.10 |
| ALB | $16.20 |
| Route53 public zone | $0.50 |
| Services (150 secrets) | $65.58 |
| **Total** | **$91.38/month** |

**Why**: Free SSL, health checks, can scale to multiple instances

---

### Scenario 3: Large Enterprise (200+ users)

**Requirements**:
- High availability required
- Auto-scaling
- Zero downtime deployments
- 300+ secrets
- Multi-region (future)

**Recommendation**: ECS Fargate

| Component | Cost |
|-----------|------|
| ECS Fargate (2 tasks for HA) | $35.60 |
| ALB | $16.20 |
| Route53 | $0.50 |
| Services (scaled up) | $120.00 |
| **Total** | **$172.30/month** |

**Why**: Auto-scaling, HA, minimal maintenance, ready for multi-region

---

## 🎯 Bottom Line - Internal Use Case

**For internal-only deployment (lowest cost)**:
- EC2 Internal + Route53: **$84.18/month** ✅ Winner
- EC2 Internal + Route53 (Reserved 1yr): **$78.08/month** ✅ Best value
- ECS Fargate: **$100.28/month** (requires ALB)
- **Savings**: $16.10/month ($193/year) with EC2 internal

**For public internet access**:
- EC2 + ALB: **$99.88/month**
- ECS Fargate: **$100.28/month**
- **Difference**: Virtually identical ($0.40/month)

**For total cost including maintenance**:
- EC2 Internal: **$409.18/month**
- ECS Fargate: **$175.28/month** ✅ Winner
- **Savings**: $233.90/month ($2,807/year) with ECS

**Key Insights**:

1. **For internal use only**: EC2 + Route53 is **$16/month cheaper** than ECS (no ALB needed)

2. **For public access**: EC2 + ALB and ECS cost **the same** (~$100/month)

3. **Including maintenance**: ECS is **$234/month cheaper** regardless of deployment type

4. **Best value for internal use**: EC2 t3.small (reserved 1yr) + Route53 = **$78.08/month**

5. **Biggest cost driver**: Secrets Manager at $60/month for 150 secrets - consider consolidating!

---

## 📝 Setup Guide - EC2 Internal with Route53

### Quick Setup (30 minutes)

```bash
# 1. Create EC2 instance in private subnet
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --subnet-id subnet-xxxxx \
  --security-group-ids sg-xxxxx \
  --iam-instance-profile Name=SecretsPortalRole \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=secrets-portal}]'

# 2. Create Route53 private hosted zone
aws route53 create-hosted-zone \
  --name internal.company.com \
  --vpc VPCRegion=us-east-1,VPCId=vpc-xxxxx \
  --caller-reference $(date +%s)

# 3. Create A record pointing to EC2 private IP
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-record.json

# 4. SSH to EC2 and deploy application
ssh -i key.pem ubuntu@10.0.1.50
# ... deploy backend and frontend ...

# 5. Access via internal DNS
# From VPN or internal network:
curl http://secrets.internal.company.com
```

### Security Group Configuration

```bash
# Allow HTTP/HTTPS from VPC CIDR only
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 10.0.0.0/16

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 10.0.0.0/16

# Allow SSH from bastion host only
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 22 \
  --source-group sg-bastion
```

---

## Summary

**For internal use (VPN/private network)**:
- ✅ Use **EC2 + Route53** = **$84.18/month** (cheapest)
- ✅ With Reserved Instance (1yr) = **$78.08/month** (best value)
- ✅ No ALB needed (saves $16.20/month)
- ✅ Use private hosted zone ($0.50/month)
- ✅ Self-signed SSL or internal CA (free)
- ⚠️ **Note**: 150 secrets cost $60/month - consider consolidating to reduce costs

**For public internet access**:
- Use **EC2 + ALB** or **ECS Fargate** (same cost ~$100/month)
- Choose based on operational preferences
- ECS wins on maintenance (77% less time)

**Cost Optimization Tip**: 
- Consolidate secrets from 150 to 15 (store multiple values as JSON)
- Saves $54/month ($648/year)
- Optimized cost: **$30.18/month** (EC2 internal with all optimizations)

**Recommendation**: Start with **EC2 Internal + Route53** for lowest cost, migrate to ECS Fargate later if you need auto-scaling or want to reduce maintenance burden.

