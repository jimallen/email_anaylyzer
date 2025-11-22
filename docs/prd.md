# email_anaylyzer - Product Requirements Document

**Author:** Jim
**Date:** 2025-11-17
**Version:** 1.0

---

## Executive Summary

Email analyzer is an AI-powered email review service that eliminates the CMO bottleneck in email approval workflows. A 3-person team currently sends CRM emails to the CMO for review, but they consistently miss basic tone and brand issues. The CMO wastes time providing repetitive feedback on the same basic mistakes.

This service leverages a fine-tuned LLM model already deployed at https://sparky.tail468b81.ts.net/ to provide instant, automated feedback. Team members forward draft emails to a dedicated address via Resend, the service analyzes content and replies with specific tone and brand feedback within seconds.

### What Makes This Special

**Personalized AI that knows YOUR standards.** Unlike generic writing assistants, this uses a model fine-tuned specifically on your company's tone and brand voice - the same standards your CMO enforces. It's not generic advice; it's feedback that reflects your actual company culture and communication style.

---

## Project Classification

**Technical Type:** API Backend
**Domain:** General (Internal Tooling)
**Complexity:** Low

This is a backend service that receives inbound emails via Resend webhooks, processes content (text + images), calls the fine-tuned LLM API for analysis, and sends email responses. No user interface - pure backend orchestration between email service, LLM API, and response delivery.

{{#if domain_context_summary}}

### Domain Context

{{domain_context_summary}}
{{/if}}

---

## Success Criteria

**Primary Success Metrics:**

1. **Team Adoption** - All 3 team members use the service for every CRM email draft before sending to CMO
2. **CMO Time Savings** - CMO reports spending significantly less time on basic tone/brand corrections (target: 50%+ reduction in review time)
3. **Quality Improvement** - Fewer emails bounced back to team for basic fixes (emails pass CMO review on first submission more often)
4. **Response Speed** - Service provides feedback in under 30 seconds consistently

**Key Validation:**
- CMO confirms the AI feedback aligns with her actual standards
- Team finds the feedback actionable and accurate
- Service reliability is high enough that team trusts it (>95% uptime)

Success means the 3-person team has a trusted "first reviewer" that catches the basics, freeing the CMO to focus on strategic feedback rather than repetitive corrections.

---

## Product Scope

### MVP - Minimum Viable Product

**Core Loop:** Team member forwards draft email → Service analyzes via LLM → Replies with feedback

**Must-Have Capabilities:**
1. **Email Receiving** - Listen for incoming emails via Resend webhook
2. **Whitelist Security** - Accept only emails from approved domains/addresses (config file)
3. **Content Extraction** - Parse plain text and images (screenshots) from incoming emails
4. **LLM Analysis** - Send content to sparky.tail468b81.ts.net API with OpenAI-compatible format
5. **Automated Response** - Reply to sender with text-based tone/brand feedback
6. **Basic Logging** - Log requests, responses, errors, and timing for debugging

**MVP Success Gate:**
All 3 team members can send drafts, receive accurate feedback in <30 seconds, and the CMO sees improvement in first-submission quality.

### Growth Features (Post-MVP)

**Phase 2 - Enhanced Insights:**
- **Usage Analytics** - Track patterns: who uses it most, common issues caught, improvement trends
- **Feedback Quality Tracking** - CMO can flag when AI feedback was wrong/right to measure accuracy
- **Team Dashboard** - Simple view showing usage and quality metrics

**Phase 3 - Workflow Integration:**
- **CRM Integration** - Analyze emails directly in the CRM before sending (no forwarding needed)
- **Suggested Rewrites** - Not just feedback, but AI-generated alternative versions
- **Batch Analysis** - Analyze multiple drafts at once

### Vision (Future)

**Advanced Capabilities:**
- **Continuous Model Improvement** - Collect CMO corrections to retrain and improve the model
- **Multi-Model Support** - Different models for different email types (sales, support, executive)
- **Advanced Authentication** - OAuth/SSO for larger team deployments
- **Template Library** - Pre-approved email templates that pass analysis automatically
- **Real-time Collaboration** - Multiple team members can review AI feedback together

---

{{#if domain_considerations}}

## Domain-Specific Requirements

{{domain_considerations}}

This section shapes all functional and non-functional requirements below.
{{/if}}

---

{{#if innovation_patterns}}

## Innovation & Novel Patterns

{{innovation_patterns}}

### Validation Approach

{{validation_approach}}
{{/if}}

---

## API Backend Specific Requirements

### System Architecture Flow

**Inbound Email Processing:**
1. Resend receives email at designated address (`.resend.app` domain or custom domain)
2. Resend parses email to JSON, stores attachments, generates download URLs
3. Resend POSTs `email.received` webhook event to service endpoint
4. Service validates sender against whitelist (email address or domain matching)
5. Service extracts text content and downloads any image attachments
6. Service formats content for LLM API call
7. Service calls sparky LLM API for analysis
8. Service receives feedback from LLM
9. Service sends email response via Resend sending API
10. Service logs transaction (sender, timestamp, result, errors)

### API Specification

**Webhook Endpoint (Inbound from Resend):**
- **Endpoint:** `POST /webhook/inbound-email`
- **Content-Type:** `application/json`
- **Event Type:** `email.received`
- **Payload Structure:** Resend's standard webhook format containing:
  - Email metadata (from, to, subject, timestamp)
  - Text and HTML body content
  - Attachments list with download URLs
- **Validation:** Check sender email/domain against whitelist before processing
- **Response:** HTTP 200 on success, 403 if sender blocked, 500 on processing error

**LLM API Call (Outbound to Sparky):**
- **Endpoint:** `POST https://sparky.tail468b81.ts.net/v1/chat/completions`
- **Content-Type:** `application/json`
- **Authentication:** None required (internal network)
- **Request Format:** OpenAI-compatible chat completion format
  ```json
  {
    "model": "email-analyzer",
    "messages": [{"role": "user", "content": "<email_text_and_image_context>"}],
    "max_tokens": <configurable, suggest 500-1000>
  }
  ```
- **Response Format:** Standard OpenAI format with `choices[0].message.content` containing feedback
- **Timeout:** 25 seconds (to stay under 30-second user expectation)
- **Error Handling:** If timeout or error, send fallback email to user with error message

**Email Response (Outbound via Resend Sending API):**
- **Endpoint:** Resend's sending API
- **From Address:** Configured "no-reply" or service address
- **To Address:** Original sender from inbound email
- **Subject:** `Re: <original_subject>` or custom format
- **Body:** Plain text feedback from LLM analysis
- **Error Handling:** Log failed sends, retry once, then log permanent failure

### Authentication & Authorization

**Whitelist-Based Security:**
- **Config File Format:** JSON or YAML with two arrays:
  - `allowed_emails`: Exact email addresses (e.g., `["user1@company.com", "user2@company.com"]`)
  - `allowed_domains`: Domain patterns (e.g., `["@company.com", "@partners.company.com"]`)
- **Validation Logic:** Check exact email match first, then domain suffix match
- **Blocked Sender Response:** HTTP 403, optionally send email: "You're not authorized to use this service"
- **No Complex Auth:** No OAuth, JWT, or session management for MVP

**Resend Webhook Validation:**
- **Strategy:** Whitelist-only (no signature verification for MVP)
- **Future:** Consider adding Resend webhook signature verification in post-MVP

**Sparky API Access:**
- **No Authentication:** Open access within sparky server network (assumes internal trust)

{{#if platform_requirements}}

### Platform Support

{{platform_requirements}}
{{/if}}

{{#if device_features}}

### Device Capabilities

{{device_features}}
{{/if}}

{{#if tenant_model}}

### Multi-Tenancy Architecture

{{tenant_model}}
{{/if}}

{{#if permission_matrix}}

### Permissions & Roles

{{permission_matrix}}
{{/if}}
{{/if}}

---

{{#if ux_principles}}

## User Experience Principles

{{ux_principles}}

### Key Interactions

{{key_interactions}}
{{/if}}

---

## Functional Requirements

### Email Reception & Processing

**User Workflow Context:** Team member drafts email → takes manual screenshot → attaches screenshot to email → sends to analyzer service → receives feedback

**FR1:** System receives incoming emails via Resend webhook at designated endpoint
**FR2:** System parses email metadata (sender, recipient, subject, timestamp) from webhook payload
**FR3:** System extracts plain text content from email body (if present)
**FR4:** System detects image attachments (screenshots) in incoming email
**FR5:** System downloads image attachments from Resend's attachment URLs
**FR6:** System supports common image formats (PNG, JPG, JPEG) for screenshot analysis

### Security & Access Control

**FR7:** System validates sender email address against whitelist before processing
**FR8:** System validates sender domain against whitelist if exact email not matched
**FR9:** System blocks emails from non-whitelisted senders and returns HTTP 403
**FR10:** System loads whitelist configuration from config file (emails and domains)
**FR11:** System allows whitelist updates without service redeployment

### Content Analysis

**Image Handling Strategy:** LLM supports vision - screenshots sent directly to model for visual analysis (formatting, layout, design, tone)

**FR12:** System formats extracted content (text and/or screenshot images) for LLM API input using OpenAI vision format
**FR13:** System encodes screenshot images as base64 or provides image URLs in messages array
**FR14:** System sends multimodal requests to sparky LLM API endpoint with text and image content
**FR15:** System specifies "email-analyzer" model in API requests
**FR16:** System configures max_tokens for LLM response (500-1000 tokens)
**FR17:** System receives tone and brand feedback from LLM API response (covering both textual and visual aspects)
**FR18:** System handles screenshot-only emails (no text in body) by sending image-only analysis request
**FR19:** System handles text-only emails (no screenshot) by sending text-only analysis request
**FR20:** System handles hybrid emails (text + screenshot) by sending combined multimodal request

### Response Generation

**FR21:** System sends email response to original sender via Resend sending API
**FR22:** System formats response with appropriate subject line (Re: original subject or custom format)
**FR23:** System includes LLM-generated feedback in plain text format
**FR24:** System sends responses within 30 seconds of receiving inbound email
**FR25:** System retries failed email sends once before logging permanent failure

### Error Handling & Recovery

**FR26:** System detects LLM API timeouts (>25 seconds) and handles gracefully
**FR27:** System sends fallback error email to sender if LLM API fails or times out
**FR28:** System logs all processing errors with context for debugging
**FR29:** System returns appropriate HTTP status codes to Resend webhook (200/403/500)
**FR30:** System handles missing email content gracefully (no text, no screenshot)
**FR31:** System handles image download failures without blocking entire analysis
**FR32:** System handles unsupported image formats by notifying user in response

### Logging & Monitoring

**FR33:** System logs every inbound email request with sender and timestamp
**FR34:** System logs LLM API analysis results for each request
**FR35:** System logs response delivery status and timing
**FR36:** System logs all errors with full context (sender, content summary, error details)
**FR37:** System tracks response time metrics for performance monitoring
**FR38:** System provides structured logs suitable for debugging and auditing
**FR39:** System logs whether request included screenshot, text, or both

### Configuration Management

**FR40:** System reads configuration from file without requiring code changes
**FR41:** System supports environment-specific configuration (dev/staging/prod)
**FR42:** System configures Resend API credentials via config
**FR43:** System configures sparky LLM API endpoint URL via config
**FR44:** System configures email response templates via config
**FR45:** System configures timeout values via config
**FR46:** System configures max image size limits via config

### Service Operations

**FR47:** System maintains >95% uptime for reliable team usage
**FR48:** System handles concurrent email processing for multiple team members
**FR49:** System gracefully shuts down and rejects new requests during maintenance
**FR50:** System provides health check endpoint for monitoring service status

---

**Total: 50 Functional Requirements**

These FRs define the complete capability set for the MVP. Every capability discussed in vision, scope, and API backend sections is represented here at the appropriate altitude (WHAT the system can do, not HOW it's implemented).

---

## Non-Functional Requirements

### Performance

**Response Time:**
- **NFR-P1:** End-to-end processing (receive email → analyze → send response) completes in <30 seconds for 95% of requests
- **NFR-P2:** LLM API calls timeout after 25 seconds to ensure overall response time constraint
- **NFR-P3:** Webhook endpoint responds to Resend within 5 seconds to acknowledge receipt
- **NFR-P4:** Image download from Resend attachment URLs completes within 10 seconds

**Throughput:**
- **NFR-P5:** System handles up to 10 concurrent email analysis requests (sufficient for 3-person team)
- **NFR-P6:** System processes emails sequentially per sender to avoid race conditions

### Security

**Data Protection:**
- **NFR-S1:** Email content is not persisted beyond log retention period (suggest 30 days)
- **NFR-S2:** Logs containing email content are stored securely with restricted access
- **NFR-S3:** Whitelist configuration file has restricted file permissions (read-only for service)
- **NFR-S4:** Communication with sparky LLM API occurs within internal network (no public exposure)

**Access Control:**
- **NFR-S5:** Whitelist validation executes before any content processing or logging
- **NFR-S6:** Blocked senders receive no information about system internals in error responses
- **NFR-S7:** Resend API credentials stored in environment variables or secure config, never in code

**Audit & Compliance:**
- **NFR-S8:** All email processing events are logged with sender identity and timestamp
- **NFR-S9:** Logs are tamper-evident (append-only or write-once storage)

### Reliability

**Availability:**
- **NFR-R1:** Service maintains >95% uptime during business hours
- **NFR-R2:** Service implements graceful degradation (returns error email vs failing silently)
- **NFR-R3:** Service automatically restarts on crash with process supervision

**Error Recovery:**
- **NFR-R4:** Failed email sends are retried once with exponential backoff (1 second delay)
- **NFR-R5:** Service continues processing new requests even if individual request fails
- **NFR-R6:** LLM API failures trigger fallback response, not system failure

### Integration

**Resend API:**
- **NFR-I1:** Service handles Resend webhook payload format changes gracefully (version tolerance)
- **NFR-I2:** Service validates webhook payload structure before processing
- **NFR-I3:** Service supports Resend attachment download with proper error handling
- **NFR-I4:** Service uses Resend sending API with proper retry logic

**Sparky LLM API:**
- **NFR-I5:** Service uses OpenAI-compatible API format for maximum portability
- **NFR-I6:** Service handles LLM API response format variations (streaming vs complete)
- **NFR-I7:** Service validates LLM response structure before extracting feedback
- **NFR-I8:** Service monitors LLM API availability and logs downtime

### Maintainability

**Configuration:**
- **NFR-M1:** All environment-specific values externalized to config (no hardcoded URLs/credentials)
- **NFR-M2:** Whitelist changes take effect within 60 seconds without service restart
- **NFR-M3:** Configuration validation occurs on service startup with clear error messages

**Monitoring & Debugging:**
- **NFR-M4:** Logs include correlation IDs to trace individual email processing flows
- **NFR-M5:** Health check endpoint returns service status and dependency health (Resend, Sparky API)
- **NFR-M6:** Metrics exposed for monitoring: request count, success rate, average response time, error rate

**Deployment:**
- **NFR-M7:** Service runs on sparky.tail468b81.ts.net infrastructure alongside LLM model
- **NFR-M8:** Service supports zero-downtime deployments (graceful shutdown of in-flight requests)
- **NFR-M9:** Service startup completes within 30 seconds including config validation

---

## Summary

**We've captured:**

- **50 Functional Requirements** across 7 capability areas (email processing, security, analysis, response, error handling, logging, configuration, operations)
- **35 Non-Functional Requirements** across 5 categories (performance, security, reliability, integration, maintainability)
- **MVP scope** clearly defined with manual screenshot workflow
- **API backend architecture** fully specified (Resend webhooks → whitelist validation → image download → sparky LLM → email response)

**What makes this product valuable:**

Email analyzer scales the CMO's expertise by providing instant, personalized feedback that reflects your company's actual tone and brand standards - not generic writing advice. The 3-person team gets a trusted "first reviewer" that catches basic issues before consuming CMO time, allowing leadership to focus on strategic feedback rather than repetitive corrections.

---

_This PRD captures the essence of email_anaylyzer - an AI-powered service that eliminates approval bottlenecks by automating quality control with company-specific standards._

_Created through collaborative discovery between Jim and AI facilitator._
