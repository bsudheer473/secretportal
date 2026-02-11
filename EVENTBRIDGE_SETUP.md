# EventBridge Setup for Direct AWS Access Tracking

## Overview

This EventBridge integration captures **direct AWS Secrets Manager changes** made outside the portal (via AWS Console, CLI, SDK, or IAM roles) and:

1. **Writes to audit log** - Same DynamoDB table as portal changes
2. **Sends notifications** - Email alerts for Prod environment changes
3. **Tracks everything** - Who, what, when, from where

## Architecture

```
AWS Secrets Manager (Direct Access)
    │
    ▼
CloudTrail (Captures API calls)
    │
    ▼
EventBridge Rule (Filters Secrets Manager events)
    │
    ▼
Lambda Function (secrets-change-tracker)
    │
    ├─> DynamoDB Audit Log (Write entry)
    │
    └─> SNS Topic (Send notification if Prod)
```

## What Gets Tracked

### Events Captured:
- ✅ `PutSecretValue` - Secret value updated
- ✅ `UpdateSecret` - Secret metadata updated
- ✅ `CreateSecret` - New secret created
- ✅ `DeleteSecret` - Secret deleted

### Events NOT Captured (to reduce noise):
- ❌ `GetSecretValue` - Reading secret value
- ❌ `DescribeSecret` - Viewing secret metadata

### Information Logged:
- **User**: IAM user/role name (extracted from CloudTrail)
- **Action**: CREATE, UPDATE, DELETE
- **IP Address**: Source IP from CloudTrail
- **User Agent**: AWS Console, CLI, SDK, etc.
- **Timestamp**: When the change occurred
- **Details**: "Direct AWS change: PutSecretValue by IAMUser"

## Prerequisites

### 1. CloudTrail Must Be Enabled

EventBridge relies on CloudTrail to capture API events.

**Check if CloudTrail is enabled:**
```bash
aws cloudtrail describe-trails --region us-east-1
```

**If not enabled, create a trail:**
```bash
aws cloudtrail create-trail \
  --name secrets-portal-trail \
  --s3-bucket-name your-cloudtrail-bucket

aws cloudtrail start-logging --name secrets-portal-trail
```

### 2. SNS Topic (Optional but Recommended)

For Prod change notifications, you need an SNS topic.

**Create SNS topic:**
```bash
aws sns create-topic --name secrets-prod-notifications

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:secrets-prod-notifications \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Deployment

### Option 1: Manual Deployment (Quick)

#### Step 1: Build the Lambda function
```bash
cd packages/backend
npm run build
```

#### Step 2: Create Lambda function
```bash
# Create IAM role for Lambda
aws iam create-role \
  --role-name secrets-change-tracker-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name secrets-change-tracker-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create Lambda function
cd packages/backend
zip -r function.zip dist/ node_modules/

aws lambda create-function \
  --function-name secrets-change-tracker \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/secrets-change-tracker-role \
  --handler secrets-change-tracker.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    METADATA_TABLE_NAME=secrets-metadata,
    AUDIT_LOG_TABLE=secrets-audit-log,
    SNS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT_ID:secrets-prod-notifications,
    AWS_REGION=us-east-1
  }"
```

#### Step 3: Grant DynamoDB permissions
```bash
aws iam put-role-policy \
  --role-name secrets-change-tracker-role \
  --policy-name DynamoDBAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:PutItem"
        ],
        "Resource": [
          "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/secrets-metadata",
          "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/secrets-audit-log"
        ]
      }
    ]
  }'
```

#### Step 4: Grant SNS permissions
```bash
aws iam put-role-policy \
  --role-name secrets-change-tracker-role \
  --policy-name SNSPublish \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:ACCOUNT_ID:secrets-prod-notifications"
    }]
  }'
```

#### Step 5: Create EventBridge rule
```bash
aws events put-rule \
  --name secrets-manager-changes \
  --description "Captures AWS Secrets Manager change events" \
  --event-pattern '{
    "source": ["aws.secretsmanager"],
    "detail-type": ["AWS API Call via CloudTrail"],
    "detail": {
      "eventSource": ["secretsmanager.amazonaws.com"],
      "eventName": [
        "PutSecretValue",
        "UpdateSecret",
        "CreateSecret",
        "DeleteSecret"
      ]
    }
  }'
```

#### Step 6: Add Lambda as target
```bash
# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name secrets-change-tracker --query 'Configuration.FunctionArn' --output text)

# Add Lambda permission for EventBridge
aws lambda add-permission \
  --function-name secrets-change-tracker \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:ACCOUNT_ID:rule/secrets-manager-changes

# Add target to rule
aws events put-targets \
  --rule secrets-manager-changes \
  --targets "Id"="1","Arn"="$LAMBDA_ARN"
```

### Option 2: CDK Deployment (Recommended for Production)

```bash
cd packages/infrastructure

# Add EventBridge stack to your CDK app
# (See eventbridge-stack.ts)

# Deploy
cdk deploy EventBridgeStack
```

## Testing

### Test 1: Update a secret via AWS Console

1. Go to AWS Secrets Manager Console
2. Select any secret
3. Click "Retrieve secret value"
4. Click "Edit"
5. Change the value
6. Click "Save"

**Expected Result:**
- Audit log entry created in DynamoDB
- If Prod secret: Email notification sent
- Entry visible in Access Report

### Test 2: Update via AWS CLI

```bash
aws secretsmanager put-secret-value \
  --secret-id database-password \
  --secret-string '{"password":"new-value-123"}'
```

**Expected Result:**
- Same as Test 1

### Test 3: Verify audit log

```bash
# Check DynamoDB
aws dynamodb scan \
  --table-name secrets-audit-log \
  --filter-expression "contains(details, :detail)" \
  --expression-attribute-values '{":detail":{"S":"Direct AWS change"}}'
```

### Test 4: Check Lambda logs

```bash
aws logs tail /aws/lambda/secrets-change-tracker --follow
```

## Monitoring

### CloudWatch Metrics

Monitor Lambda function:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=secrets-change-tracker \
  --start-time 2026-01-23T00:00:00Z \
  --end-time 2026-01-23T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### EventBridge Rule Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name TriggeredRules \
  --dimensions Name=RuleName,Value=secrets-manager-changes \
  --start-time 2026-01-23T00:00:00Z \
  --end-time 2026-01-23T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Troubleshooting

### Issue: No events captured

**Check CloudTrail:**
```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=PutSecretValue \
  --max-results 10
```

**Check EventBridge rule:**
```bash
aws events describe-rule --name secrets-manager-changes
```

**Check Lambda permissions:**
```bash
aws lambda get-policy --function-name secrets-change-tracker
```

### Issue: Lambda not triggered

**Check EventBridge targets:**
```bash
aws events list-targets-by-rule --rule secrets-manager-changes
```

**Check Lambda logs:**
```bash
aws logs tail /aws/lambda/secrets-change-tracker --since 1h
```

### Issue: Audit log not written

**Check Lambda IAM permissions:**
```bash
aws iam get-role-policy \
  --role-name secrets-change-tracker-role \
  --policy-name DynamoDBAccess
```

**Check DynamoDB table:**
```bash
aws dynamodb describe-table --table-name secrets-audit-log
```

## Cost Estimation

### EventBridge
- **Free tier**: 14 million events/month
- **After free tier**: $1.00 per million events
- **Estimated**: ~$0-5/month (depends on change frequency)

### Lambda
- **Free tier**: 1 million requests/month, 400,000 GB-seconds
- **After free tier**: $0.20 per million requests
- **Estimated**: ~$0-2/month

### CloudTrail
- **First trail**: Free
- **Additional trails**: $2.00 per 100,000 events
- **Estimated**: Included in first trail

### Total Estimated Cost
**~$0-10/month** (mostly covered by free tier)

## Security Considerations

1. **IAM Permissions**: Lambda has minimal permissions (read metadata, write audit log)
2. **No Secret Values**: Lambda never accesses actual secret values
3. **Audit Trail**: All Lambda invocations logged in CloudWatch
4. **Encryption**: DynamoDB tables encrypted at rest
5. **Network**: Lambda runs in AWS VPC (optional)

## Compliance Benefits

1. **Complete Audit Trail**: Captures ALL secret changes (portal + direct AWS)
2. **Real-time Alerts**: Immediate notification for Prod changes
3. **Centralized Reporting**: All access in one Access Report
4. **Regulatory Compliance**: Meets SOC 2, HIPAA, PCI-DSS requirements
5. **Forensics**: Who, what, when, where for every change

## Next Steps

1. ✅ Deploy EventBridge + Lambda
2. ✅ Test with a non-Prod secret
3. ✅ Verify audit log entry
4. ✅ Test Prod notification
5. ✅ Review Access Report
6. ✅ Document for your team

## Support

For issues or questions:
1. Check CloudWatch Logs: `/aws/lambda/secrets-change-tracker`
2. Check EventBridge metrics
3. Verify CloudTrail is enabled
4. Review IAM permissions
