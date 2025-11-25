# Email Analyzer API Reference

Complete API documentation for the Email Analyzer webhook endpoints.

## Base URL

```
Production: https://{api-id}.execute-api.eu-central-1.amazonaws.com/prod
```

Current deployment:
```
https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod
```

## Endpoints

### POST /webhook/inbound-email

Receives inbound email webhooks from Resend. This is the primary endpoint that triggers email analysis.

#### Request

**Headers**
```
Content-Type: application/json
```

**Body** (Resend Webhook Payload)
```json
{
  "type": "email.received",
  "created_at": "2025-11-24T12:00:00.000Z",
  "data": {
    "email_id": "abc123-def456-ghi789",
    "from": "sender@example.com",
    "to": ["jenny-bot@daapoa.resend.app"],
    "subject": "Fwd: Marketing Email Subject",
    "text": "Plain text email content...",
    "html": "<html>HTML email content...</html>",
    "attachments": [
      {
        "filename": "image.png",
        "content_type": "image/png",
        "content": "base64-encoded-content"
      }
    ]
  }
}
```

#### Resend Webhook Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Event type, always `email.received` |
| `created_at` | ISO 8601 | Timestamp of email receipt |
| `data.email_id` | string | Unique email identifier (UUID) |
| `data.from` | string | Sender email address |
| `data.to` | string[] | Recipient email addresses |
| `data.subject` | string | Email subject line |
| `data.text` | string | Plain text body (may be empty) |
| `data.html` | string | HTML body (may be empty) |
| `data.attachments` | array | File attachments |

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "emailId": "abc123-def456-ghi789"
}
```

**Error (4xx/5xx)**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

#### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success - email processed and response sent |
| 400 | Bad Request - invalid payload |
| 500 | Internal Server Error - processing failed |

#### Processing Flow

1. Validate webhook payload structure
2. Fetch full email content from Resend API
3. Extract text and attachments
4. Download and encode images/PDFs
5. Parse sender name with Claude Haiku
6. Detect email language
7. Analyze email with Claude Sonnet 4
8. Send response email via Resend
9. Save analysis to DynamoDB
10. Return success response

#### Timing

- **Typical response time**: 30-40 seconds
- **Timeout**: 300 seconds (Lambda limit)
- **API Gateway timeout**: 29 seconds

> **Note**: API Gateway will timeout at 29s, but Lambda continues processing. The response email will still be sent even if the webhook response times out.

---

### GET /webhook/inbound-email

Health check endpoint for webhook verification.

#### Request

No parameters required.

#### Response

**Success (200 OK)**
```json
{
  "status": "healthy",
  "message": "Webhook endpoint is active"
}
```

---

## Email Analysis Response

When an email is successfully analyzed, the system sends a response email to the original sender.

### Response Email Format

**Subject**: `Re: {original-subject}`

**From**: `response@allennet.me` (configured RESEND_FROM_EMAIL)

**Body Format** (HTML with Markdown source):

```markdown
**Hi {Sender Name},**

**DETECTED EMAIL LANGUAGE:** {Language}
**ALL SUGGESTIONS BELOW ARE IN:** {Language}

**LIFECYCLE CONTEXT:**
Stage: {lifecycle stage description}
Journey Fit: {how email fits in customer journey}
Timing Indicators: {timing analysis}

**SUBJECT LINE ANALYSIS:**
Current Subject: {original subject}
Rating: {X}/10
Strengths: {list of strengths}
Weaknesses: {list of weaknesses}
Alternative Suggestions:
1. {alternative 1}
2. {alternative 2}
3. {alternative 3}

**DETAILED RECOMMENDATIONS:**

1. **{Recommendation Title}**
   Priority: {High/Medium/Low}
   {Detailed recommendation text}

   Suggested Copy:
   > {example copy}

{Additional recommendations...}

**SUMMARY:**
{Overall assessment and key takeaways}

---
Processing time: {X.X}s | Tokens used: {XXXXX}
Powered by Claude Sonnet 4
```

### Analysis Schema (Internal)

The Claude analysis returns structured JSON matching this Zod schema:

```typescript
const EmailAnalysisSchema = z.object({
  detectedLanguage: z.string(),

  lifecycleContext: z.object({
    stage: z.string(),
    journeyFit: z.string(),
    timingIndicators: z.string(),
  }),

  subjectLineAnalysis: z.object({
    currentSubject: z.string(),
    rating: z.number().min(1).max(10),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    alternatives: z.array(z.string()),
  }),

  recommendations: z.array(z.object({
    title: z.string(),
    priority: z.enum(['High', 'Medium', 'Low']),
    description: z.string(),
    suggestedCopy: z.string().optional(),
  })),

  summary: z.string(),
});
```

---

## DynamoDB Record Schema

Analysis data is persisted to DynamoDB for fine-tuning purposes.

### Table: `EmailAnalysisData`

**Primary Key**:
- Partition Key: `emailId` (String)
- Sort Key: `timestamp` (Number)

**Global Secondary Index**: `SenderIndex`
- Partition Key: `from` (String)
- Sort Key: `timestamp` (Number)

### Record Structure

```json
{
  "emailId": "abc123-def456-ghi789",
  "timestamp": 1732456800000,
  "from": "sender@example.com",
  "to": "jenny-bot@daapoa.resend.app",
  "subject": "Original email subject",
  "originalText": "Full email text content...",
  "claudeAnalysis": "Formatted analysis text...",
  "claudeAnalysisJson": {
    "detectedLanguage": "English",
    "lifecycleContext": {...},
    "subjectLineAnalysis": {...},
    "recommendations": [...],
    "summary": "..."
  },
  "detectedLanguage": "English",
  "contentType": "text-only",
  "imageCount": 0,
  "pdfCount": 0,
  "tokensUsed": 11500,
  "processingTimeMs": 32500,
  "fineTuningData": {
    "messages": [
      {
        "role": "system",
        "content": "System prompt..."
      },
      {
        "role": "user",
        "content": "User prompt with email content..."
      },
      {
        "role": "assistant",
        "content": "Claude's analysis response..."
      }
    ],
    "metadata": {
      "language": "English",
      "contentType": "text-only",
      "hasImages": false,
      "hasPDFs": false,
      "imageCount": 0,
      "pdfCount": 0,
      "tokensUsed": 11500,
      "processingTimeMs": 32500
    }
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PAYLOAD` | 400 | Webhook payload missing required fields |
| `EMAIL_FETCH_FAILED` | 500 | Failed to fetch email from Resend API |
| `ANALYSIS_FAILED` | 500 | Claude analysis failed or timed out |
| `SEND_FAILED` | 500 | Failed to send response email |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Rate Limits

### API Gateway
- **Default**: 10,000 requests/second
- **Burst**: 5,000 requests

### Lambda
- **Concurrent executions**: 1,000 (default)
- **Timeout**: 300 seconds

### Claude API
- **Rate limits**: Depends on Anthropic tier
- **Typical**: 60 requests/minute

### Resend API
- **Rate limits**: Depends on plan
- **Webhooks**: No specific limit

---

## Webhook Configuration (Resend)

### Setup Steps

1. Log in to [Resend Dashboard](https://resend.com/webhooks)
2. Navigate to Webhooks section
3. Create new webhook:
   - **Endpoint URL**: `https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email`
   - **Events**: `email.received`
4. Save and test

### Inbound Email Address

Configure an inbound email address in Resend:
- **Address**: `jenny-bot@daapoa.resend.app` (example)
- **Forward to**: Webhook endpoint

---

## Testing

### Manual Testing

```bash
# Test health endpoint
curl https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email

# Test webhook (mock payload)
curl -X POST \
  https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.received",
    "created_at": "2025-11-24T12:00:00.000Z",
    "data": {
      "email_id": "test-123",
      "from": "test@example.com",
      "to": ["jenny-bot@daapoa.resend.app"],
      "subject": "Test Email",
      "text": "This is a test email for analysis."
    }
  }'
```

### Integration Testing

Send a real email to the configured inbound address and verify:
1. Email is received by Resend
2. Webhook is triggered
3. Analysis email is sent back
4. Record is saved to DynamoDB

---

## SDK Examples

### Node.js

```typescript
import axios from 'axios';

const WEBHOOK_URL = 'https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email';

// Simulate webhook (for testing)
async function testWebhook() {
  const response = await axios.post(WEBHOOK_URL, {
    type: 'email.received',
    created_at: new Date().toISOString(),
    data: {
      email_id: 'test-' + Date.now(),
      from: 'test@example.com',
      to: ['jenny-bot@daapoa.resend.app'],
      subject: 'Test Marketing Email',
      text: 'Check out our new product launch!'
    }
  });

  console.log(response.data);
}
```

### Python

```python
import requests
from datetime import datetime

WEBHOOK_URL = 'https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email'

def test_webhook():
    payload = {
        'type': 'email.received',
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'data': {
            'email_id': f'test-{int(datetime.utcnow().timestamp())}',
            'from': 'test@example.com',
            'to': ['jenny-bot@daapoa.resend.app'],
            'subject': 'Test Marketing Email',
            'text': 'Check out our new product launch!'
        }
    }

    response = requests.post(WEBHOOK_URL, json=payload)
    print(response.json())
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Authors**: John (PM), Mary (Analyst), Amelia (Developer)
