# Email Analyzer Testing Guide

Comprehensive testing strategy, practices, and guidelines for the Email Analyzer system.

## Testing Philosophy

### Principles

1. **Risk-Based Testing**: Focus testing effort on high-impact, high-risk areas
2. **Test at the Right Level**: Unit tests for logic, integration tests for contracts
3. **Production Parity**: Test environment should mirror production
4. **Automation First**: Automate repeatable tests, manual for exploratory

### Test Pyramid

```
        /\
       /  \       E2E Tests (Few)
      /----\      - Real email flow
     /      \     - Full system integration
    /--------\    Integration Tests (Some)
   /          \   - Service boundaries
  /            \  - External API mocks
 /--------------\ Unit Tests (Many)
                  - Business logic
                  - Pure functions
```

## Test Types

### 1. Unit Tests

**Scope**: Individual functions and modules

**Location**: `test/unit/`

**Framework**: Vitest

**Run Command**:
```bash
pnpm test
```

**What to Test**:
- Pure functions in services
- Data transformation logic
- Validation functions
- Error handling paths

**Example**:
```typescript
// test/unit/llm-client.test.ts
import { describe, it, expect } from 'vitest';
import { formatAnalysisToText } from '../../src/services/llm-client';

describe('formatAnalysisToText', () => {
  it('formats analysis JSON to readable text', () => {
    const analysis = {
      detectedLanguage: 'English',
      lifecycleContext: {
        stage: 'Awareness',
        journeyFit: 'First touch',
        timingIndicators: 'New subscriber'
      },
      subjectLineAnalysis: {
        currentSubject: 'Test Subject',
        rating: 7,
        strengths: ['Clear', 'Concise'],
        weaknesses: ['Generic'],
        alternatives: ['Better Subject 1']
      },
      recommendations: [],
      summary: 'Good email overall'
    };

    const result = formatAnalysisToText(analysis, { senderName: 'John' });

    expect(result).toContain('Hi John');
    expect(result).toContain('DETECTED EMAIL LANGUAGE: English');
    expect(result).toContain('Rating: 7/10');
  });
});
```

### 2. Integration Tests

**Scope**: Service interactions and external API contracts

**Location**: `test/integration/`

**What to Test**:
- DynamoDB client operations
- Resend API contract
- Claude API response parsing
- Webhook payload processing

**Example**:
```typescript
// test/integration/dynamodb-client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAnalysisRecord } from '../../src/services/dynamodb-client';

describe('DynamoDB Client', () => {
  // Use local DynamoDB for integration tests
  beforeAll(async () => {
    // Setup local DynamoDB table
  });

  afterAll(async () => {
    // Cleanup
  });

  it('creates analysis record with all fields', async () => {
    const params = {
      emailId: 'test-123',
      from: 'test@example.com',
      to: 'bot@example.com',
      subject: 'Test Subject',
      originalText: 'Email content',
      claudeAnalysis: 'Analysis text',
      claudeAnalysisJson: { /* structured analysis */ },
      detectedLanguage: 'English',
      contentType: 'text-only',
      imageCount: 0,
      pdfCount: 0,
      tokensUsed: 1000,
      processingTimeMs: 5000
    };

    await expect(createAnalysisRecord(params)).resolves.not.toThrow();
  });
});
```

### 3. End-to-End Tests

**Scope**: Full system flow from webhook to email response

**Approach**: Manual or semi-automated with real services

**Test Scenarios**:

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Text-only email | Plain text email | Analysis email with recommendations |
| HTML email | Rich HTML email | Analysis extracts text content |
| Email with images | Email + image attachments | Images analyzed, included in feedback |
| Email with PDF | Email + PDF attachment | PDF content extracted and analyzed |
| Non-English email | German marketing email | Analysis in German |
| Large email | >10KB text content | Analysis within timeout |

**Manual E2E Test Process**:
```bash
# 1. Prepare test email
# Create a marketing email in your email client

# 2. Send to inbound address
# Forward to jenny-bot@daapoa.resend.app

# 3. Monitor logs
cd cdk
./tail-logs.sh --follow

# 4. Verify response
# Check inbox for analysis email

# 5. Verify DynamoDB
aws dynamodb get-item \
  --table-name EmailAnalysisData \
  --key '{"emailId": {"S": "EMAIL_ID"}, "timestamp": {"N": "TIMESTAMP"}}' \
  --profile AdministratorAccess-123567778292
```

### 4. Load Tests

**Scope**: System performance under load

**Approach**: Send multiple concurrent webhooks

**Tools**: Artillery, k6, or custom script

**Example Load Test Script**:
```javascript
// load-test.js
const axios = require('axios');

const WEBHOOK_URL = 'https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod/webhook/inbound-email';

async function sendWebhook(index) {
  const start = Date.now();
  try {
    await axios.post(WEBHOOK_URL, {
      type: 'email.received',
      created_at: new Date().toISOString(),
      data: {
        email_id: `load-test-${index}-${Date.now()}`,
        from: 'loadtest@example.com',
        to: ['jenny-bot@daapoa.resend.app'],
        subject: `Load Test Email ${index}`,
        text: 'This is a load test email for performance testing.'
      }
    });
    console.log(`Request ${index}: ${Date.now() - start}ms`);
  } catch (error) {
    console.error(`Request ${index} failed: ${error.message}`);
  }
}

// Send 10 concurrent requests
Promise.all(Array(10).fill().map((_, i) => sendWebhook(i)));
```

## Mocking Strategies

### Claude API Mock

For unit tests, mock Claude responses:

```typescript
import { vi } from 'vitest';

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        detectedLanguage: 'English',
        lifecycleContext: { stage: 'Test', journeyFit: 'Test', timingIndicators: 'Test' },
        subjectLineAnalysis: {
          currentSubject: 'Test',
          rating: 7,
          strengths: [],
          weaknesses: [],
          alternatives: []
        },
        recommendations: [],
        summary: 'Test summary'
      }),
      usage_metadata: { total_tokens: 1000 }
    })
  }))
}));
```

### Resend API Mock

```typescript
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'mock-email-id' })
    }
  }))
}));
```

### DynamoDB Mock

Use `@aws-sdk/client-dynamodb-mock` or mock DocumentClient:

```typescript
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({})
    })
  },
  PutCommand: vi.fn()
}));
```

## Test Data

### Sample Email Payloads

**Text-only Email**:
```json
{
  "type": "email.received",
  "created_at": "2025-11-24T12:00:00.000Z",
  "data": {
    "email_id": "test-text-001",
    "from": "marketing@example.com",
    "to": ["jenny-bot@daapoa.resend.app"],
    "subject": "🚀 Launch Sale - 50% Off Everything!",
    "text": "Hi there!\n\nWe're excited to announce our biggest sale of the year...",
    "html": ""
  }
}
```

**Email with Attachments**:
```json
{
  "type": "email.received",
  "created_at": "2025-11-24T12:00:00.000Z",
  "data": {
    "email_id": "test-attach-001",
    "from": "marketing@example.com",
    "to": ["jenny-bot@daapoa.resend.app"],
    "subject": "Product Catalog - See Attached",
    "text": "Please find our product catalog attached.",
    "attachments": [
      {
        "filename": "catalog.pdf",
        "content_type": "application/pdf",
        "content": "base64-encoded-pdf-content"
      }
    ]
  }
}
```

### Test Fixtures Location

```
test/
├── fixtures/
│   ├── webhooks/           # Sample webhook payloads
│   │   ├── text-only.json
│   │   ├── html-email.json
│   │   ├── with-images.json
│   │   └── with-pdf.json
│   ├── analysis/           # Expected analysis outputs
│   │   └── sample-analysis.json
│   └── emails/             # Sample email content
│       ├── marketing-en.txt
│       └── marketing-de.txt
```

## Test Coverage

### Coverage Goals

| Module | Target | Priority |
|--------|--------|----------|
| `llm-client.ts` | 80% | High |
| `resend-client.ts` | 70% | High |
| `dynamodb-client.ts` | 70% | Medium |
| `webhook.ts` | 60% | Medium |

### Running Coverage Report

```bash
# Run tests with coverage
pnpm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
export default {
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50
      }
    }
  }
};
```

## CI/CD Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Testing Checklist

### Before Deployment

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] No TypeScript errors (`pnpm run build:ts`)
- [ ] Manual smoke test on staging (if available)

### After Deployment

- [ ] Health check endpoint responds
- [ ] Send test email and verify response
- [ ] Check CloudWatch logs for errors
- [ ] Verify DynamoDB write successful

### Regression Testing

When modifying:

| Changed Module | Tests to Run |
|----------------|--------------|
| `llm-client.ts` | All unit tests + E2E |
| `resend-client.ts` | Email send tests + E2E |
| `dynamodb-client.ts` | DB tests + verify production writes |
| `webhook.ts` | Integration tests + E2E |
| CDK stack | Full deployment test |

## Debugging Tests

### Verbose Output

```bash
# Run single test file with verbose output
pnpm test -- test/unit/llm-client.test.ts --reporter=verbose

# Run tests matching pattern
pnpm test -- --grep "formatAnalysisToText"
```

### Debug Mode

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/vitest run
```

### Test Isolation

```bash
# Run single test
pnpm test -- --run --testNamePattern "creates analysis record"
```

## Performance Testing Baselines

| Metric | Baseline | Acceptable | Action Threshold |
|--------|----------|------------|------------------|
| Webhook response | < 100ms | < 500ms | > 1s |
| Claude analysis | < 30s | < 45s | > 60s |
| Email send | < 500ms | < 2s | > 5s |
| DB write | < 100ms | < 500ms | > 1s |
| Total E2E | < 40s | < 60s | > 90s |

## Known Test Limitations

1. **Claude API**: Cannot be fully mocked for response quality testing
2. **Resend Webhooks**: Must use real service for E2E tests
3. **Rate Limits**: Load testing limited by external API quotas
4. **Attachments**: Large attachment tests require significant test data

## Future Testing Improvements

1. **Contract Tests**: Add Pact tests for Resend API contract
2. **Visual Regression**: Screenshot email responses for visual testing
3. **Chaos Testing**: Test resilience to API failures
4. **Security Testing**: Add OWASP ZAP scanning

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Authors**: Murat (Test Architect), Amelia (Developer)
