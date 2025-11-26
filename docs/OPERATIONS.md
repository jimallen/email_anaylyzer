# Email Analyzer Operations Guide

Production operations, monitoring, and troubleshooting guide for the Email Analyzer system.

## Overview

This document covers day-to-day operations, monitoring, incident response, and maintenance procedures for the Email Analyzer production environment.

## Infrastructure

### AWS Resources

| Resource | Name/ARN | Purpose |
|----------|----------|---------|
| Lambda | `EmailAnalyzerStack-EmailAnalyzerFunction*` | Main processing function |
| API Gateway | `Email Analyzer Service` | Public webhook endpoint |
| DynamoDB | `EmailAnalysisData` | Fine-tuning data storage |
| DynamoDB | `EmailAnalysisPersonas` ✨ NEW | AI persona configurations with GSI on emailAddress |
| CloudWatch Logs | `/aws/lambda/EmailAnalyzerStack-*` | Application logs |

### External Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Resend | Email sending & webhooks | [resend.com/overview](https://resend.com/overview) |
| Anthropic | Claude AI analysis | [console.anthropic.com](https://console.anthropic.com) |

### Current Configuration

- **Region**: `eu-central-1` (Frankfurt)
- **Webhook URL**: `https://9e33ejoon0.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email` ✨ UPDATED
- **FROM Address**: `jenny-bot@allennet.me` ✨ UPDATED (persona-branded)
- **Lambda Memory**: 2048 MB
- **Lambda Timeout**: 300 seconds
- **Personas**:
  - `jenny-bot@allennet.me` - Brand & Marketing Expert
  - `christoph-bot@allennet.me` - Conversion & Performance Expert
  - `icp-bot@allennet.me` - Ideal Customer Profile Expert

## Monitoring

### CloudWatch Logs

#### Tail Logs Utility

```bash
cd cdk

# Follow logs in real-time
./tail-logs.sh --follow

# View last 10 minutes
./tail-logs.sh --since 10m

# View last hour
./tail-logs.sh --since 1h

# View specific time range
./tail-logs.sh --since 2025-11-24T10:00:00Z
```

#### CloudWatch Insights Queries

Access via AWS Console: CloudWatch → Logs → Logs Insights

**Errors in last hour:**
```sql
fields @timestamp, @message
| filter @message like /level":50/
| sort @timestamp desc
| limit 100
```

**Successful analyses:**
```sql
fields @timestamp, emailId, duration, tokensUsed
| filter @message like /"success":true/
| sort @timestamp desc
| limit 50
```

**Average processing time:**
```sql
stats avg(duration) as avg_duration,
      max(duration) as max_duration,
      count(*) as count
by bin(1h)
| filter @message like /"msg":"Request processing completed"/
```

**Token usage by day:**
```sql
stats sum(tokensUsed) as total_tokens
by bin(1d)
| filter @message like /tokensUsed/
```

**Persona usage distribution:** ✨ NEW
```sql
stats count(*) as requests by personaName
| filter @message like /personaName/
| sort requests desc
```

**Persona cache hit rate:** ✨ NEW
```sql
stats
  sum(case when cacheHit = true then 1 else 0 end) as cache_hits,
  sum(case when cacheHit = false then 1 else 0 end) as cache_misses,
  (sum(case when cacheHit = true then 1 else 0 end) * 100.0 / count(*)) as hit_rate_percent
| filter @message like /cacheHit/
```

**Persona resolution failures:** ✨ NEW
```sql
fields @timestamp, recipientEmail, @message
| filter @message like /No persona found/
| sort @timestamp desc
| limit 50
```

### Key Metrics

#### Lambda Metrics (CloudWatch)
- `Invocations` - Number of webhook calls
- `Duration` - Processing time (target: <60s p95)
- `Errors` - Failed invocations
- `Throttles` - Rate limiting events
- `ConcurrentExecutions` - Simultaneous runs

#### Application Metrics (from logs)
- Processing time per email
- Token usage per analysis
- Email send success rate
- DynamoDB save success rate
- ✨ **Persona cache hit rate** (target: >85%)
- ✨ **Persona usage distribution** (requests per persona)
- ✨ **Persona resolution failures** (should be near zero)

### Health Checks

**API Gateway Health:**
```bash
curl https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email
```

Expected response:
```json
{"status": "healthy", "message": "Webhook endpoint is active"}
```

**Lambda Function Status:**
```bash
aws lambda get-function \
  --function-name EmailAnalyzerStack-EmailAnalyzerFunction6AFF08ED-kZiiqZsM6qL9 \
  --query 'Configuration.State' \
  --profile AdministratorAccess-123567778292
```

Expected: `"Active"`

## Troubleshooting

### Common Issues

#### 1. Emails Not Being Analyzed

**Symptoms:** User sends email, no response received

**Diagnostic Steps:**
```bash
# 1. Check recent logs for errors
./tail-logs.sh --since 30m | grep -E '"level":(40|50)'

# 2. Verify Lambda is receiving webhooks
./tail-logs.sh --since 30m | grep "incoming request"

# 3. Check Resend webhook delivery
# Go to resend.com → Webhooks → Check delivery status
```

**Common Causes:**
- Resend webhook misconfigured
- Lambda function error
- Claude API rate limit
- RESEND_FROM_EMAIL not verified

#### 2. Analysis Timeout

**Symptoms:** `Request processing exceeded 30-second target` in logs

**Diagnostic Steps:**
```bash
# Check for timeout patterns
./tail-logs.sh --since 1h | grep "exceeded 30-second target"
```

**Solutions:**
- Normal for complex emails with attachments
- Check Claude API status for latency issues
- Consider increasing Lambda memory (more CPU)

#### 3. Email Send Failures (403)

**Symptoms:** `Resend API returned 403` in logs

**Error Message:**
```
You can only send testing emails to your own email address
```

**Solution:**
1. Verify domain in Resend dashboard
2. Update `RESEND_FROM_EMAIL` to verified domain address
3. Redeploy: `cd cdk && ./deploy.sh`

#### 4. Claude API Errors

**Symptoms:** `Claude analysis failed` in logs

**Common Causes:**
- API key invalid or expired
- Rate limit exceeded
- Model temporarily unavailable

**Solutions:**
```bash
# Verify API key is set
aws lambda get-function-configuration \
  --function-name EmailAnalyzerStack-EmailAnalyzerFunction6AFF08ED-kZiiqZsM6qL9 \
  --query 'Environment.Variables.ANTHROPIC_API_KEY' \
  --profile AdministratorAccess-123567778292

# Check Anthropic status: status.anthropic.com
```

#### 5. DynamoDB Write Failures

**Symptoms:** `Failed to save analysis data to DynamoDB` in logs

**Note:** This is non-critical - email analysis still works.

**Diagnostic:**
```bash
# Check DynamoDB table status
aws dynamodb describe-table \
  --table-name EmailAnalysisData \
  --query 'Table.TableStatus' \
  --profile jim-stage
```

#### 6. Persona Resolution Issues ✨ NEW

**Symptoms:** Email analyzed by wrong persona or default persona when specific persona expected

**Diagnostic Steps:**
```bash
# 1. Check persona table has all personas
aws dynamodb scan \
  --table-name EmailAnalysisPersonas \
  --region eu-central-1 \
  --profile jim-stage

# 2. Verify persona email routing in logs
./tail-logs.sh --since 1h | grep "Looking up persona"

# 3. Check cache hit rate
./tail-logs.sh --since 1h | grep "cacheHit"
```

**Common Causes:**
- Persona not seeded in DynamoDB (run `scripts/seed-personas.ts`)
- Resend inbound routing sending to wrong email address
- Typo in recipient email address
- Default persona (jenny-bot) missing from database

**Solutions:**
```bash
# Re-seed personas (idempotent)
AWS_PROFILE=jim-stage AWS_REGION=eu-central-1 npx tsx scripts/seed-personas.ts

# Verify Resend routes match persona emails exactly
# Go to resend.com/emails/inbound → Check routes

# Clear Lambda cache by redeploying
cd cdk && ./deploy.sh
```

#### 7. Low Persona Cache Hit Rate ✨ NEW

**Symptoms:** Cache hit rate < 85% in CloudWatch Insights query

**Expected Behavior:** Cache should hit >85% for normal usage

**Diagnostic:**
```bash
# Check cache hit rate over last 24 hours
# Use CloudWatch Insights "Persona cache hit rate" query
```

**Common Causes:**
- Cold starts clearing in-memory cache
- Low traffic (cache TTL expires before reuse)
- Lambda scaling out to multiple instances

**Solutions:**
- Normal behavior for low-traffic environments
- If traffic is high and cache rate still low, consider Redis/ElastiCache
- Verify personas aren't being updated frequently (triggers cache misses)
```

### Log Message Reference

| Log Level | Meaning | Action |
|-----------|---------|--------|
| `"level":30` (INFO) | Normal operation | None |
| `"level":40` (WARN) | Warning, non-critical | Monitor |
| `"level":50` (ERROR) | Error, needs attention | Investigate |

**Key Log Messages:**

| Message | Meaning |
|---------|---------|
| `"msg":"incoming request"` | Webhook received |
| `"msg":"Claude analysis completed"` | Analysis successful |
| `"msg":"Email send failed"` | Resend error |
| `"msg":"Request processing completed"` | Full cycle complete |

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | System completely down | Immediate |
| P2 | Major feature broken | < 1 hour |
| P3 | Minor issue, workaround exists | < 24 hours |
| P4 | Cosmetic/minor | Best effort |

### Incident Checklist

1. **Acknowledge** - Note start time
2. **Assess** - Determine severity and impact
3. **Investigate** - Check logs, metrics, external services
4. **Mitigate** - Apply temporary fix if available
5. **Resolve** - Deploy permanent fix
6. **Document** - Update runbook with learnings

### Escalation Contacts

| Issue Type | Contact |
|------------|---------|
| AWS Infrastructure | AWS Support |
| Resend Issues | support@resend.com |
| Claude API | support@anthropic.com |

## Maintenance Procedures

### Deploying Updates

```bash
# 1. Pull latest code
git pull origin master

# 2. Review changes
git log --oneline -5

# 3. Deploy
cd cdk
./deploy.sh

# 4. Verify deployment
./tail-logs.sh --follow --since 2m
```

### Updating Environment Variables

```bash
# Method 1: Full redeploy (recommended)
# Edit cdk/.env, then:
cd cdk && ./deploy.sh

# Method 2: Direct Lambda update (quick fix)
aws lambda update-function-configuration \
  --function-name EmailAnalyzerStack-EmailAnalyzerFunction6AFF08ED-kZiiqZsM6qL9 \
  --environment "Variables={KEY=value,...}" \
  --profile AdministratorAccess-123567778292
```

### Rotating API Keys

1. Generate new key in respective dashboard
2. Update `cdk/.env` with new key
3. Deploy: `./deploy.sh`
4. Verify functionality
5. Revoke old key

### Database Maintenance

**Export Fine-tuning Data:**
```bash
aws dynamodb scan \
  --table-name EmailAnalysisData \
  --output json \
  --profile AdministratorAccess-123567778292 \
  > export.json
```

**Query by Sender:**
```bash
aws dynamodb query \
  --table-name EmailAnalysisData \
  --index-name SenderIndex \
  --key-condition-expression "#from = :email" \
  --expression-attribute-names '{"#from": "from"}' \
  --expression-attribute-values '{":email": {"S": "sender@example.com"}}' \
  --profile AdministratorAccess-123567778292
```

## Cost Management

### Estimated Costs

| Service | Cost per Email | Monthly (100 emails) |
|---------|----------------|----------------------|
| Lambda | $0.001 | $0.10 |
| API Gateway | $0.000003 | $0.01 |
| DynamoDB | $0.0000025 | $0.01 |
| Claude API | $0.015 | $1.50 |
| **Total** | **~$0.016** | **~$1.62** |

### Cost Monitoring

```bash
# Check Lambda costs (requires Cost Explorer)
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-11-30 \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --filter '{"Dimensions": {"Key": "SERVICE", "Values": ["AWS Lambda"]}}' \
  --profile AdministratorAccess-123567778292
```

## Backup & Recovery

### DynamoDB
- **Point-in-time recovery**: Enabled
- **Retention policy**: RETAIN (data preserved on stack delete)
- **Recovery**: Use AWS Console or CLI to restore

### Lambda Code
- **Source**: Git repository
- **Recovery**: Redeploy from source with `./deploy.sh`

### Configuration
- **Source**: `cdk/.env` (not committed)
- **Backup**: Store securely in password manager
- **Recovery**: Recreate from `.env.example` template

## Security Operations

### Access Control

- Lambda execution role has minimal permissions
- API Gateway is public (no authentication)
- DynamoDB access restricted to Lambda role

### Audit Logging

- CloudTrail logs all AWS API calls
- CloudWatch logs all application activity

### Security Checklist

- [ ] API keys stored securely (not in git)
- [ ] Lambda role follows least privilege
- [ ] CloudWatch logs retained appropriately
- [ ] Regular rotation of API keys

## SLA Targets

| Metric | Target | Current |
|--------|--------|---------|
| Availability | 99% | ~99.5% |
| Response Time (p95) | < 60s | ~40s |
| Error Rate | < 5% | ~1% |

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Authors**: Bob (Scrum Master), Murat (Test Architect), Winston (Architect)
