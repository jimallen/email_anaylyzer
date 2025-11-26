# PRD: Persona-Based Email Analysis System

## 1. Introduction/Overview

### Problem Statement
The current Email Analyzer provides a single, uniform analysis perspective for all emails. Users who need different types of feedback (brand expertise, business strategy, customer perspective) must either:
- Send multiple emails to different services
- Mentally translate generic feedback into their specific context
- Miss insights that would come from domain-specific expertise

### Proposed Solution
Implement a persona-based analysis system where different email recipient addresses trigger different AI personas, each with unique expertise, tone, and focus areas. This provides users with triangulated, multi-perspective feedback tailored to their specific needs.

### Value Proposition
- **Targeted Expertise**: Get feedback from specialized perspectives (brand expert, business consultant, customer viewpoint)
- **Contextual Analysis**: Each persona analyzes based on their domain knowledge and background
- **Efficient Workflow**: Single email, specific persona - no need for multiple tools or services
- **Richer Insights**: Different personas surface different issues and opportunities

## 2. Current State Analysis

### Existing Email Analysis Flow
The current system (`src/routes/webhook.ts:34-250`) implements:
1. Webhook receives email via Resend inbound
2. Fetches full email content and attachments
3. Parses sender name with Claude Haiku
4. Detects language with Claude
5. Calls Claude Sonnet 4 for analysis with **single, fixed system prompt**
6. Formats response email with **uniform structure**
7. Sends response via Resend
8. Stores analysis data in DynamoDB

### Current System Components Affected
- **LLM Client** (`src/services/llm-client.ts`): Currently uses hard-coded system prompts
- **Email Formatter** (`src/services/email-formatter.ts`): Single HTML template for all responses
- **DynamoDB Client** (`src/services/dynamodb-client.ts`): Stores analysis data without persona context
- **Webhook Handler** (`src/routes/webhook.ts`): No recipient-based routing logic

### Existing Constraints
- AWS Lambda timeout: 5 minutes (sufficient for persona analysis)
- Claude API rate limits: Tier-dependent (no change needed)
- DynamoDB: Pay-per-request (adding persona table is cost-effective)
- Resend: Supports multiple inbound addresses (persona@domain.com)

## 3. Goals

### Primary Goals
1. **Enable persona-based analysis** via recipient email address mapping (e.g., `jenny-bot@allennet.me`)
2. **Support 3 initial personas** with distinct expertise, tone, and focus areas
3. **Maintain backward compatibility** for existing catchall email addresses (default to Jenny-bot)
4. **Store persona configurations** in DynamoDB for runtime flexibility

### Secondary Goals
5. Provide persona identity in response emails (subject line, signature)
6. Enable basic visual customization per persona (color scheme, header)
7. Support hybrid analysis structure (standard + persona-specific sections)

### Success Criteria
- Users can send emails to persona-specific addresses and receive appropriately tailored analysis
- Jenny-bot, Christoph-bot, and icp-bot personas are operational with distinct outputs
- Existing users experience no breaking changes
- Persona configurations can be updated without code deployment

## 4. User Stories

### Core User Stories

**US-1: Persona-Specific Analysis**
> As a **marketing professional**, I want to **send my email to `jenny-bot@allennet.me`** so that **I receive brand-focused, all-around copywriting feedback from a persona with deep brand experience**.

**US-2: Business Strategy Perspective**
> As a **founder in the photo/card industry**, I want to **send my email to `christoph-bot@allennet.me`** so that **I receive strategic, business-oriented feedback from someone with consulting and industry expertise**.

**US-3: Customer Empathy Feedback**
> As a **product manager**, I want to **send my email to `icp-bot@allennet.me`** so that **I understand how my target customer (busy, affluent mom) would perceive and react to my email**.

**US-4: Default Behavior**
> As an **existing user**, I want to **send emails to the catchall address** so that **I continue to receive analysis with Jenny-bot as the default persona without any disruption**.

**US-5: Persona Identification**
> As a **user receiving analysis**, I want to **see which persona analyzed my email** so that **I understand the perspective and can reference the persona's expertise in my improvements**.

### Administrative User Stories

**US-6: Persona Configuration**
> As a **system administrator**, I want to **create and update persona definitions via script** so that **I can add new personas or refine existing ones without code deployment**.

**US-7: Email Address Mapping**
> As a **system administrator**, I want to **configure inbound email addresses in Resend** so that **each persona has a dedicated address that routes to the analysis system**.

## 5. Functional Requirements

### FR-1: Persona Data Model
- **FR-1.1**: Create DynamoDB table `EmailAnalysisPersonas` with schema:
  - `personaId` (String, partition key): Unique identifier (e.g., "jenny-bot")
  - `emailAddress` (String, GSI partition key): Inbound email address
  - `name` (String): Display name (e.g., "Jenny-bot")
  - `description` (String): Background and expertise summary
  - `systemPrompt` (String): Custom LLM system prompt with persona instructions
  - `focusAreas` (String[]): List of focus areas (e.g., ["brand voice", "emotional appeal"])
  - `tone` (String): Tone description (e.g., "encouraging but detailed")
  - `customSections` (String[]): Optional persona-specific analysis sections
  - `emailConfig` (Object): Visual customization (color, header text)
  - `isActive` (Boolean): Enable/disable persona
  - `createdAt` (Number): Timestamp
  - `updatedAt` (Number): Timestamp

### FR-2: Persona Lookup Service
- **FR-2.1**: Implement `getPersonaByEmail(email: string)` in new service `src/services/persona-service.ts`
- **FR-2.2**: Query DynamoDB using GSI on `emailAddress` field
- **FR-2.3**: Return default Jenny-bot persona if no match found
- **FR-2.4**: Cache persona data in Lambda memory (1-hour TTL) to reduce DynamoDB reads

### FR-3: Persona-Aware LLM Analysis
- **FR-3.1**: Modify `callClaudeForAnalysis()` in `llm-client.ts` to accept `Persona` object
- **FR-3.2**: Replace hard-coded system prompt with `persona.systemPrompt`
- **FR-3.3**: Inject persona context (name, focus areas) into analysis prompt
- **FR-3.4**: Support hybrid analysis structure:
  - Standard sections: lifecycle context, subject line evaluation, body analysis
  - Persona-specific sections: Append custom sections from `persona.customSections`

### FR-4: Persona-Aware Email Formatting
- **FR-4.1**: Modify `formatSuccessEmail()` in `email-formatter.ts` to accept `Persona` object
- **FR-4.2**: Update subject line format: `[{Persona Name} Analysis] Your email feedback`
- **FR-4.3**: Add persona signature/footer with name and background description
- **FR-4.4**: Apply basic visual customization from `persona.emailConfig`:
  - Primary color for headers/accents
  - Custom greeting text
  - Persona avatar/icon (optional, future enhancement)

### FR-5: Webhook Handler Updates
- **FR-5.1**: Extract recipient email address (`to` field) from webhook payload
- **FR-5.2**: Call `getPersonaByEmail(toEmail)` before LLM analysis
- **FR-5.3**: Pass persona object to `callClaudeForAnalysis()` and `formatSuccessEmail()`
- **FR-5.4**: Log persona information in structured logs for observability

### FR-6: DynamoDB Analysis Data Enhancement
- **FR-6.1**: Add `personaId` and `personaName` fields to analysis records
- **FR-6.2**: Update `createAnalysisRecord()` to include persona metadata
- **FR-6.3**: Enable persona-based analysis queries for future insights

### FR-7: Persona Seed Script
- **FR-7.1**: Create script `scripts/seed-personas.ts` to populate initial personas:
  - **Jenny-bot**: Deep brand experience, all-arounder, built Westwing and ESN in Germany
  - **Christoph-bot**: Founder of Kartenmachai, former Bain consultant, 15 years in cards/photobook industry
  - **icp-bot**: Ideal customer profile - mom in mid-30s, affluent, 2 kids, tired but pressured to capture memories and send Christmas cards
- **FR-7.2**: Script should be idempotent (safe to run multiple times)

## 6. Integration Requirements

### Components to Modify

#### 6.1 DynamoDB Client (`src/services/dynamodb-client.ts`)
- **Add**: Persona CRUD operations
- **Add**: `getPersonaByEmail()` with GSI query
- **Add**: `getDefaultPersona()` for fallback
- **Modify**: `createAnalysisRecord()` to include persona metadata

#### 6.2 LLM Client (`src/services/llm-client.ts`)
- **Modify**: `callClaudeForAnalysis()` signature to accept `Persona` parameter
- **Replace**: Hard-coded system prompt with `persona.systemPrompt`
- **Add**: Persona context injection in user message

#### 6.3 Email Formatter (`src/services/email-formatter.ts`)
- **Modify**: `formatSuccessEmail()` to accept `Persona` parameter
- **Add**: Persona name to subject line
- **Add**: Persona signature/footer section
- **Add**: Basic CSS customization based on `persona.emailConfig`

#### 6.4 Webhook Handler (`src/routes/webhook.ts`)
- **Add**: Import persona service
- **Add**: Extract recipient email from webhook payload
- **Add**: Persona lookup before analysis
- **Modify**: Pass persona to LLM and email formatter
- **Add**: Persona logging for observability

#### 6.5 CDK Stack (`cdk/lib/email-analyzer-stack.ts`)
- **Add**: New DynamoDB table `EmailAnalysisPersonas`
- **Add**: GSI on `emailAddress` field
- **Add**: Lambda IAM permissions for persona table read access
- **Update**: Environment variables with persona table name

### New Components to Create

#### 6.6 Persona Service (`src/services/persona-service.ts`)
- `getPersonaByEmail(email: string): Promise<Persona | null>`
- `getDefaultPersona(): Promise<Persona>`
- `getAllPersonas(): Promise<Persona[]>` (for future admin UI)
- `createPersona(persona: Persona): Promise<void>` (for scripts)
- `updatePersona(personaId: string, updates: Partial<Persona>): Promise<void>`
- In-memory caching with 1-hour TTL

#### 6.7 Persona Type Definitions (`src/lib/persona-types.ts`)
- `Persona` interface
- `PersonaEmailConfig` interface
- `PersonaAnalysisSection` interface
- Zod schemas for validation

#### 6.8 Seed Script (`scripts/seed-personas.ts`)
- Command-line script to populate initial 3 personas
- Uses `persona-service` to create/update personas
- Idempotent operations

### API Changes
- **Webhook payload**: No changes (Resend format remains same)
- **Internal APIs**: Function signatures updated to accept `Persona` parameter

### Database Schema Changes
- **New Table**: `EmailAnalysisPersonas`
- **Existing Table**: `EmailAnalysisData` adds `personaId` and `personaName` fields (backward compatible)

## 7. Non-Goals (Out of Scope)

### Explicitly Out of Scope for MVP
1. **Multi-persona responses**: Sending multiple emails with different persona perspectives
2. **Admin UI**: Web interface for persona management
3. **User-created personas**: Users defining their own custom personas
4. **Persona authentication**: Security/access control for persona-specific addresses
5. **A/B testing framework**: Comparing persona effectiveness
6. **Persona learning**: Personas adapting based on user feedback
7. **Real-time persona switching**: Changing persona mid-conversation
8. **Advanced email templates**: Complex HTML templates with rich media per persona
9. **Persona analytics dashboard**: Metrics on persona usage and effectiveness
10. **Natural language persona selection**: "Analyze this as a brand expert" in email body

### Future Considerations (Post-MVP)
- Admin API endpoints for persona CRUD operations
- Persona performance metrics (user ratings, engagement)
- Dynamic persona creation via LLM
- Persona chaining (sequential analysis by multiple personas)

## 8. Design Considerations

### UI/UX Requirements

#### 8.1 Email Subject Line Format
```
[Jenny-bot Analysis] Your email feedback - "Your Subject Line"
```
- Persona name clearly visible in brackets
- Original subject line preserved for context

#### 8.2 Email Body Structure (Hybrid Format)
```
Hi [Sender Name],

[PERSONA INTRO]
I'm Jenny-bot, and I bring deep brand experience from building companies
like Westwing and ESN in Germany. Here's my analysis of your email...

[STANDARD SECTIONS - from current implementation]
📊 Lifecycle Context
📧 Subject Line Analysis
✍️ Body Content Review
🎯 Call-to-Action Evaluation

[PERSONA-SPECIFIC SECTIONS - customizable]
🎨 Brand Voice Assessment (Jenny-bot specific)
📈 Strategic Positioning (Christoph-bot specific)
💭 Customer Emotional Response (icp-bot specific)

[OVERALL RECOMMENDATIONS]
...

[PERSONA SIGNATURE]
---
Best regards,
Jenny-bot
Brand Expert | Built Westwing & ESN in Germany
```

#### 8.3 Visual Customization
- **Primary color**: Used for headers, section dividers, CTA buttons
- **Header banner**: Optional colored banner with persona name
- **Typography**: Same for all personas (maintainability)
- **Icons**: Same emoji/icon set (consistency)

### Persona Definitions

#### 8.4 Jenny-bot Configuration
```typescript
{
  personaId: "jenny-bot",
  emailAddress: "jenny-bot@allennet.me",
  name: "Jenny-bot",
  description: "Deep brand experience, all-arounder. Built brands like Westwing and ESN in Germany.",
  tone: "Encouraging, detail-oriented, brand-focused",
  focusAreas: [
    "Brand voice consistency",
    "Emotional appeal",
    "Visual presentation",
    "Overall copywriting quality"
  ],
  customSections: ["Brand Voice Assessment"],
  emailConfig: {
    primaryColor: "#E91E63", // Pink
    headerText: "Brand Expert Analysis"
  },
  systemPrompt: `You are Jenny-bot, an AI persona embodying the expertise of Jenny,
a seasoned brand builder with deep experience creating and scaling brands like
Westwing and ESN in the German market. You bring an all-around marketing perspective
with special emphasis on brand voice, emotional resonance, and presentation quality.

Your analysis style is:
- Encouraging but honest - celebrate strengths while identifying opportunities
- Detail-oriented - notice nuances in tone, word choice, and brand consistency
- Brand-focused - always consider how the email reflects and builds the brand
- Practical - provide actionable recommendations that can be implemented immediately

Focus Areas:
- Brand voice consistency and personality
- Emotional appeal and connection with the audience
- Visual presentation and formatting
- Subject line effectiveness
- Call-to-action clarity and persuasiveness
- Overall copywriting quality and professionalism

Analyze the email from a brand builder's perspective, considering both immediate
effectiveness and long-term brand building.`
}
```

#### 8.5 Christoph-bot Configuration
```typescript
{
  personaId: "christoph-bot",
  emailAddress: "christoph-bot@allennet.me",
  name: "Christoph-bot",
  description: "Founder of Kartenmachai, former Bain consultant. 15 years of experience in cards and photobook industry.",
  tone: "Strategic, analytical, business-focused",
  focusAreas: [
    "Strategic positioning",
    "Business value proposition",
    "Competitive differentiation",
    "Customer lifetime value optimization"
  ],
  customSections: ["Strategic Business Analysis"],
  emailConfig: {
    primaryColor: "#1976D2", // Blue
    headerText: "Strategic Analysis"
  },
  systemPrompt: `You are Christoph-bot, an AI persona embodying the expertise of
Christoph, founder of Kartenmachai and former Bain consultant with 15 years of
experience in the cards and photobook industry. You bring a strategic, business-oriented
perspective to email analysis.

Your analysis style is:
- Strategic - focus on business objectives and competitive positioning
- Analytical - use frameworks and structured thinking from consulting background
- Industry-expert - leverage deep knowledge of cards/photobook market dynamics
- ROI-focused - consider customer acquisition cost, lifetime value, and conversion

Focus Areas:
- Strategic positioning and differentiation
- Value proposition clarity
- Competitive advantages highlighted
- Customer journey optimization
- Pricing and offer psychology
- Conversion funnel effectiveness
- Industry-specific best practices (cards, photobooks, memories)

Analyze the email through the lens of a founder and consultant, focusing on
business impact and strategic alignment.`
}
```

#### 8.6 icp-bot Configuration
```typescript
{
  personaId: "icp-bot",
  emailAddress: "icp-bot@allennet.me",
  name: "icp-bot",
  description: "Represents your ideal customer: mom in mid-30s, affluent, 2 kids. Tired but feels pressure to capture memories and social pressure to send Christmas cards.",
  tone: "Authentic, empathetic, customer-voice",
  focusAreas: [
    "Emotional resonance with target customer",
    "Pain point acknowledgment",
    "Decision-making triggers",
    "Time and mental load considerations"
  ],
  customSections: ["Customer Emotional Response"],
  emailConfig: {
    primaryColor: "#9C27B0", // Purple
    headerText: "Customer Perspective"
  },
  systemPrompt: `You are icp-bot, an AI persona representing the ideal customer profile:
a mom in her mid-30s, affluent, with 2 kids. She's tired, juggling multiple responsibilities,
but feels pressure to capture family memories and social expectations to send Christmas cards.

Your analysis style is:
- Authentic - speak as the actual customer would speak and feel
- Empathetic - understand the emotional and practical challenges she faces
- Honest - share genuine reactions, including skepticism or resistance
- Time-conscious - always aware of limited time and mental bandwidth

Your Perspective:
- You want to preserve memories but feel overwhelmed by the task
- You're willing to pay for convenience and quality (affluent)
- You feel social pressure around holidays (Christmas cards, milestones)
- You're skeptical of marketing but respond to genuine understanding
- You need decisions to be easy and quick
- You value brands that "get" your life situation

Focus Areas:
- Does this email understand my actual life and challenges?
- Does it make me feel seen and understood, or just marketed to?
- Is the value proposition clear and relevant to my needs?
- Does it respect my time and make the decision easy?
- Does it trigger FOMO, social pressure, or genuine desire?
- Would I actually open, read, and act on this email?

Analyze the email as if YOU are receiving it. Share your honest emotional and
practical reactions. What would make you delete it? What would make you act?`
}
```

## 9. Technical Considerations

### 9.1 Architecture Patterns
- **Service-oriented**: New `persona-service` follows existing service pattern
- **Dependency injection**: Persona passed as parameter to maintain testability
- **Separation of concerns**: Persona logic isolated from core email processing

### 9.2 Testing Strategy

#### Unit Tests
- `persona-service.ts`: Persona CRUD operations, caching logic
- `llm-client.ts`: Persona-aware system prompt generation
- `email-formatter.ts`: Persona-specific formatting logic
- Cache invalidation and TTL behavior

#### Integration Tests
- End-to-end webhook flow with different persona addresses
- DynamoDB persona table read/write operations
- Persona fallback to Jenny-bot when email not found
- Persona data injection into LLM and email formatter

#### Test Data
- Create test personas in test environment
- Mock persona responses for predictable test outputs
- Test with all 3 initial personas + unknown address (default behavior)

### 9.3 Performance Implications

#### DynamoDB Reads
- **Impact**: 1 additional DynamoDB read per email (persona lookup)
- **Mitigation**: In-memory caching with 1-hour TTL
- **Cost**: ~$0.00000025 per read (negligible)
- **Latency**: ~50ms per read, ~0ms with cache hit

#### Lambda Memory
- **Impact**: Persona cache stored in Lambda memory
- **Mitigation**: Personas are small (~5KB each), 3 personas = ~15KB
- **Current**: 2048MB allocated, 15KB is negligible

#### LLM Token Usage
- **Impact**: Persona system prompts are longer (~500-800 tokens vs current ~300)
- **Cost increase**: ~$0.001-0.002 per email (minimal)
- **Latency**: ~2-3 seconds additional (within acceptable range)

### 9.4 Security Considerations

#### Persona Data Access
- **DynamoDB Encryption**: Use encryption at rest (AWS managed keys)
- **IAM Permissions**: Lambda has read-only access to persona table
- **No PII**: Persona definitions contain no sensitive user data

#### Email Address Security
- **Obscurity**: Persona email addresses not publicly advertised
- **Future**: Add Resend webhook signature verification (already in architecture docs)
- **Rate Limiting**: API Gateway throttling prevents abuse

#### System Prompt Injection
- **Risk**: Malicious persona system prompts could manipulate LLM
- **Mitigation**: Admin-only persona creation (no user input)
- **Validation**: Schema validation for persona fields
- **Future**: Prompt injection detection and sanitization

### 9.5 Backward Compatibility
- **Existing analysis records**: No migration needed (new fields optional)
- **Webhook payload**: No changes to Resend webhook format
- **Default behavior**: Catchall addresses use Jenny-bot (preserves functionality)
- **API signatures**: Internal only, no breaking changes to external APIs

### 9.6 Error Handling
- **Persona not found**: Fall back to Jenny-bot, log warning
- **DynamoDB errors**: Fall back to Jenny-bot, log error
- **Invalid persona data**: Validate schema, reject invalid personas
- **Cache failures**: Continue without cache, slower but functional

### 9.7 Observability
- **Structured Logging**: Add persona info to all log events
  ```json
  {
    "reqId": "req-123",
    "emailId": "abc-def",
    "personaId": "jenny-bot",
    "personaName": "Jenny-bot",
    "toEmail": "jenny-bot@allennet.me",
    "cacheHit": true
  }
  ```
- **CloudWatch Metrics**: Track persona usage distribution
- **Error Tracking**: Separate persona-related errors from analysis errors

### 9.8 Migration Strategy

#### Phase 1: Infrastructure (Week 1)
1. Create `EmailAnalysisPersonas` DynamoDB table via CDK
2. Deploy CDK stack updates
3. Verify table creation and IAM permissions

#### Phase 2: Code Implementation (Week 1-2)
4. Implement `persona-service.ts` with caching
5. Create seed script for initial 3 personas
6. Update `llm-client.ts` for persona-aware analysis
7. Update `email-formatter.ts` for persona formatting
8. Modify `webhook.ts` handler for persona lookup
9. Update `dynamodb-client.ts` for persona metadata

#### Phase 3: Testing (Week 2)
10. Write unit tests for all new functions
11. Write integration tests for end-to-end flow
12. Manual testing with all 3 personas
13. Load testing to verify performance impact

#### Phase 4: Deployment (Week 3)
14. Deploy to staging environment
15. Configure persona email addresses in Resend
16. Run seed script to populate personas
17. End-to-end testing in staging
18. Deploy to production
19. Smoke test with each persona

### 9.9 Rollback Plan
- **DynamoDB table**: RETAIN policy (no data loss on rollback)
- **Code rollback**: Deploy previous Lambda version
- **Email addresses**: Keep configured, fall back to default behavior
- **Data**: New persona fields are optional (backward compatible)

## 10. Success Metrics

### Key Performance Indicators

#### Functional Success
- **Persona Accuracy**: 100% of emails to persona addresses receive correct persona analysis
- **Default Fallback**: 100% of catchall/unknown emails use Jenny-bot
- **Uptime**: No increase in errors or timeouts (maintain 99.9% success rate)

#### Performance Metrics
- **Latency Impact**: Persona lookup adds <100ms to total processing time
- **Cache Hit Rate**: >80% of persona lookups served from cache after warmup
- **Token Usage**: Persona prompts add ~500 tokens (acceptable increase)

#### Adoption Metrics
- **Persona Distribution**: Track usage of each persona over 4 weeks
  - Jenny-bot: Expected 50-60% (default + brand focus users)
  - Christoph-bot: Expected 20-30% (business/strategy users)
  - icp-bot: Expected 15-25% (customer empathy users)
- **User Retention**: Existing users continue using service (no dropoff)

#### Quality Metrics
- **User Satisfaction**: Qualitative feedback on persona analysis quality
- **Analysis Differentiation**: Verify persona outputs are meaningfully different
- **Persona Consistency**: Each persona maintains consistent voice across analyses

### Monitoring Dashboards
- **CloudWatch Dashboard**:
  - Persona usage distribution (pie chart)
  - Persona lookup latency (p50, p95, p99)
  - Cache hit rate percentage
  - Errors by persona (stacked bar chart)
- **DynamoDB Metrics**:
  - Persona table read capacity
  - Persona table latency

## 11. Decisions & Resolved Questions

**Status**: All questions resolved on 2025-11-25

### Technical Decisions
1. **Q**: Should persona system prompts be stored as plain text or support templating?
   - **DECISION**: Use YAML templating for system prompts
   - **Rationale**: Provides flexibility for variable injection and structured prompt management

2. **Q**: What's the cache invalidation strategy when personas are updated?
   - **DECISION**: Wait for 1-hour TTL expiration
   - **Rationale**: Simple, predictable, acceptable delay for persona updates

3. **Q**: Should we implement persona versioning to track changes over time?
   - **DECISION**: Not for MVP, implement later if needed
   - **Rationale**: Add complexity without immediate value, can add `version` field later

### Product Decisions
4. **Q**: How should we handle email addresses with multiple recipient addresses (CC/BCC)?
   - **DECISION**: Do not support CC/BCC, use only primary "to" field
   - **Rationale**: Simplifies implementation, edge case can be addressed if needed

5. **Q**: Should users be notified if they use an invalid persona address?
   - **DECISION**: No notification, silently fall back to Jenny-bot
   - **Rationale**: Avoid user confusion, maintain seamless experience

6. **Q**: Do we need persona-specific error messages and formatting?
   - **DECISION**: No, use same error format for all personas
   - **Rationale**: Error handling should be consistent, personalization not critical for errors

### Business Decisions
7. **Q**: How many personas do we expect to support long-term?
   - **DECISION**: Plan for up to 10 personas
   - **Rationale**: Reasonable scale, fits in-memory caching strategy (~50KB total)

8. **Q**: Should persona email addresses be documented publicly or kept private?
   - **DECISION**: Doesn't matter, decide based on rollout preference
   - **Rationale**: No technical or security constraints, purely operational decision

9. **Q**: What's the process for requesting new personas?
   - **DECISION**: No formal request process, admin adds personas ad-hoc
   - **Rationale**: Small-scale operation, formalization not needed yet

---

## Appendix

### A. Persona Schema (Zod)
```typescript
import { z } from 'zod';

export const PersonaEmailConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  headerText: z.string().min(1).max(100),
});

export const PersonaSchema = z.object({
  personaId: z.string().min(1).max(50),
  emailAddress: z.string().email(),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(500),
  systemPrompt: z.string().min(100).max(5000),
  focusAreas: z.array(z.string()).min(1).max(10),
  tone: z.string().min(5).max(200),
  customSections: z.array(z.string()).max(5).optional(),
  emailConfig: PersonaEmailConfigSchema,
  isActive: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Persona = z.infer<typeof PersonaSchema>;
export type PersonaEmailConfig = z.infer<typeof PersonaEmailConfigSchema>;
```

### B. DynamoDB Table Definition (CDK)
```typescript
const personaTable = new dynamodb.Table(this, 'EmailAnalysisPersonas', {
  tableName: 'EmailAnalysisPersonas',
  partitionKey: { name: 'personaId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// GSI for email address lookup
personaTable.addGlobalSecondaryIndex({
  indexName: 'EmailAddressIndex',
  partitionKey: { name: 'emailAddress', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Grant Lambda read access
personaTable.grantReadData(lambdaFunction);
```

### C. Estimated Implementation Effort

| Component | Effort (hours) | Complexity |
|-----------|---------------|------------|
| DynamoDB table + CDK updates | 2 | Low |
| Persona service + caching | 6 | Medium |
| LLM client updates | 4 | Medium |
| Email formatter updates | 6 | Medium |
| Webhook handler updates | 3 | Low |
| Type definitions + schemas | 2 | Low |
| Seed script | 4 | Low |
| Unit tests | 8 | Medium |
| Integration tests | 6 | Medium |
| Documentation | 3 | Low |
| **Total** | **44 hours** | **~1 sprint** |

### D. Related Documentation
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System architecture
- [TESTING.md](../docs/TESTING.md) - Testing strategy
- [API_REFERENCE.md](../docs/API_REFERENCE.md) - Webhook API specification
- [FINE_TUNING_FORMAT.md](../FINE_TUNING_FORMAT.md) - Data format for model fine-tuning

### E. References
- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Resend Inbound Email Documentation](https://resend.com/docs/api-reference/emails/receive-email)
- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Langchain Structured Output](https://js.langchain.com/docs/modules/model_io/output_parsers/structured)

---

**Document Version**: 1.1
**Last Updated**: 2025-11-25
**Author**: Product Requirements Document
**Status**: Approved - Ready for Implementation
**Approved By**: Jim
**Approval Date**: 2025-11-25

### Approval Summary
- ✅ All persona definitions approved (Jenny-bot, Christoph-bot, icp-bot)
- ✅ All open questions resolved with decisions documented in Section 11
- ✅ Phase 1 (Prerequisites & Configuration) complete
- 🚀 Ready to proceed to Phase 2 (Infrastructure Implementation)
