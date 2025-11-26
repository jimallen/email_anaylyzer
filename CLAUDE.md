# Email Analyzer - Claude Code Context

> **For Claude Code**: This project uses custom documentation files for agent guidance.

## Project Documentation

**Read [AGENT.md](AGENT.md) first** - Complete project guide including:
- Project summary and tech stack
- Documentation index with when to read each doc
- Key files by task (analysis, formatting, deployment, debugging)
- Architecture overview and processing flow
- Common commands and environment configuration

## Coding Standards

**Follow [.agent.rules.md](.agent.rules.md)** - Celebrate GmbH TypeScript coding standards including:
- TDD practices and testing requirements
- Naming conventions and code organization
- Git commit hygiene (Conventional Commits)
- TypeScript-specific best practices
- Function/method implementation checklist

## Quick Start for Agents

1. **First time?** Read [AGENT.md](AGENT.md) to understand the project
2. **Making changes?** Check [AGENT.md](AGENT.md) "Key Files by Task" section
3. **Writing code?** Follow [.agent.rules.md](.agent.rules.md) standards
4. **Need details?** Consult specific docs listed in [AGENT.md](AGENT.md)

## Project Type

**Serverless AWS Application**: Fastify + Lambda + API Gateway + DynamoDB + Claude AI

**Current Focus**: Email analysis service with persona-based feedback system
- never disable linting