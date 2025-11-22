# Product Brief: Email analyzer

**Date:** 2025-11-17
**Author:** Jim
**Context:** Internal team tool

---

## Executive Summary

Email analyzer is an AI-powered email review service that eliminates the CMO bottleneck in email approval workflows. The 3-person team currently sends CRM emails to the CMO for review, but they consistently miss basic tone and brand issues, wasting the CMO's time on repetitive feedback.

This tool leverages a fine-tuned LLM model already deployed at https://sparky.tail468b81.ts.net/ to provide instant, automated feedback. Team members simply forward draft emails to a dedicated address and receive analysis within seconds. The service handles both text and screenshot content, uses whitelist-based security, and runs on the existing sparky infrastructure.

By catching basic issues before they reach the CMO, this tool frees up strategic leadership time while improving the quality and speed of customer communications.

---

## Core Vision

### Problem Statement

The CMO is a bottleneck in the email approval process. A 3-person team sends CRM emails to the CMO for review, but they consistently miss basic tone and brand issues that the CMO has to catch and send back for revision. This creates delays, wastes the CMO's time on repetitive feedback, and slows down customer communication.

### Proposed Solution

An email-based feedback service that team members can send their draft CRM emails to for automated review. The service receives the draft email, analyzes it using a fine-tuned LLM model (already deployed at https://sparky.tail468b81.ts.net/ with OpenAI-compatible API), and replies with specific feedback on tone and brand issues. This gives team members instant, CMO-quality feedback before they send emails for final approval or directly to customers.

---

## Target Users

### Primary Users

**The 3-person team** who draft CRM emails to prospects and customers. They need to catch tone and brand issues before sending emails to the CMO for review. Their current workflow is to draft in their email client and forward to the CMO. They're comfortable with email as their primary tool and need feedback that's immediate and actionable so they can fix issues quickly.

### Secondary Users

**The CMO** - while she doesn't directly use the tool, she's the key beneficiary. The tool reduces the volume of low-quality emails reaching her inbox, allowing her to focus on strategic feedback rather than catching basic tone and brand mistakes.

---

## MVP Scope

### Core Features

1. **Email Receiving Service** - Listens at a dedicated email address for incoming draft emails
2. **Whitelist Security** - Accept emails only from approved domains and email addresses (no complex authentication needed for MVP)
3. **Content Extraction** - Parse plain text and images (including screenshots) from incoming emails
4. **LLM Analysis** - Send extracted content to the fine-tuned model at https://sparky.tail468b81.ts.net/ via OpenAI-compatible API
5. **Automated Response** - Reply to sender with text-based feedback on tone and brand issues
6. **Basic Logging** - Log incoming requests, analysis results, errors, and response times for debugging and monitoring

### Out of Scope for MVP

- User authentication system (relying on email whitelist instead)
- Usage analytics dashboard and visualizations
- Direct CRM integration
- Formatted/styled feedback responses (plain text is sufficient)
- Model retraining or feedback loop collection

### MVP Success Criteria

- Team members can successfully send draft emails to the service and receive feedback
- Whitelist correctly blocks unauthorized senders
- Service handles both plain text and image content (screenshots)
- Feedback response time is fast enough to be useful (under 30 seconds)
- CMO reports reduced volume of emails with basic tone/brand issues

### Future Vision

- **Analytics Dashboard** - Track usage patterns, common issues, team improvement over time
- **CRM Integration** - Analyze emails directly within the CRM before sending
- **Feedback Loop** - Collect CMO corrections to continuously improve the model
- **Suggested Rewrites** - Not just feedback, but AI-generated alternative versions
- **Advanced Authentication** - OAuth or SSO integration for larger team deployments

---

## Technical Preferences

**Infrastructure:**
- Hosted on the same server as the LLM model (sparky.tail468b81.ts.net)
- Utilizes existing fine-tuned model via OpenAI-compatible API endpoint

**Email Service:**
- **Resend** for inbound email receiving and webhook delivery
- Service will expose webhook endpoint to receive parsed email data from Resend
- Resend handles email routing and parsing, delivers structured data via HTTP POST

**Configuration:**
- Whitelist stored in config file (editable without redeployment)
- Config-driven approach for easy maintenance

**Error Handling:**
- If sparky API unavailable: send error email back to sender with retry instructions
- Log all errors for debugging

---

_This Product Brief captures the vision and requirements for Email analyzer._

_It was created through collaborative discovery and reflects the unique needs of this internal team tool project._

_Next: Use the PRD workflow (`/bmad:bmm:workflows:prd`) to create detailed product requirements from this brief._
