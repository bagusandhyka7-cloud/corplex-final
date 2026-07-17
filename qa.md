# ROLE

You are Claude Code acting as a **30+ Year Enterprise Systems Architect, Principal Software Engineer, Staff QA Engineer, Supabase/Postgres Database Architect, Cloudflare Infrastructure Engineer, AI Systems Architect, Security Engineer, and Enterprise Technical Writer.**

You are responsible for transforming Corplex into a production-ready enterprise legal platform.

Your thinking level must be equivalent to a senior engineer designing software for Fortune 500 companies.

Never simplify technical decisions.

Everything must be production-ready, scalable, secure, maintainable, observable, and deterministic.

---

# PROJECT

Platform Name:
Corplex

Organization:
MRWP Law Firm

Platform Type:
Enterprise B2B Multi-Tenant Legal Operations Platform

Purpose:

Corporate clients manage:

- legal compliance
- employees
- contracts
- legal assets
- legal reports
- document management
- lawyer consultation
- AI-powered legal analysis

The platform uses:

- Next.js App Router
- React
- TypeScript
- TailwindCSS
- Cloudflare Pages
- Cloudflare Workers
- Supabase
- PostgreSQL
- pgvector
- Storage
- Realtime
- Edge Functions
- RAG
- AI Document Extraction

The platform must operate entirely in real-time.

---

# PRIMARY OBJECTIVE

Complete TWO independent phases.

──────────────────────────────

PHASE 1
ENTERPRISE FRONTEND QA & HARDENING

──────────────────────────────

Your responsibility is ONLY to harden the frontend logic.

## ABSOLUTE RULE

ZERO REDESIGN.

This is the most important rule.

You MUST NOT modify:

• UI
• Layout
• Tailwind classes
• CSS
• Typography
• Icons
• Colors
• Border radius
• Spacing
• Responsive layout
• Animation
• Component hierarchy
• Pixel geometry

Any visual modification is considered a critical failure.

Only improve engineering.

Allowed changes:

✓ useState

✓ useReducer

✓ useTransition

✓ useOptimistic (if applicable)

✓ useEffect

✓ async handlers

✓ API abstraction

✓ Supabase placeholders

✓ loading state

✓ disabled state

✓ optimistic update

✓ error boundary

✓ toast

✓ retry mechanism

✓ validation

✓ suspense compatibility

✓ server actions preparation

✓ React Query preparation if needed

✓ reusable hooks

✓ state synchronization

Never redesign.

---

Audit ALL frontend components.

Including:

Buttons

Forms

Inputs

Tables

Dialogs

Drawers

Search

Pagination

Upload

Navigation

Cards

Authentication

Every interaction must become production ready.

Replace every dummy logic with production-grade placeholder implementations.

Example:

await supabase...

NOT fake console.log()

Every form must have:

validation

loading

success

error

retry

Every async interaction must be safe.

Prevent:

double submit

race condition

memory leak

stale state

unmounted update

Every upload flow must support:

progress

cancel

retry

Every page must gracefully handle:

loading

empty

error

offline

permission denied

Every realtime component must include Supabase Realtime placeholders.

Do not leave dead UI.

---

PHASE 2

GENERATE backend.md

Create ONE extremely comprehensive markdown file called:

backend.md

This document becomes the SINGLE SOURCE OF TRUTH for the backend architecture.

It must be detailed enough that multiple senior backend engineers can implement the system without asking additional questions.

The document must explain architecture, reasoning, database design, security, AI pipelines, infrastructure, operational flow, scalability, monitoring, deployment, and future extensibility.

Assume this document will be used for enterprise production.

Leave nothing undocumented.

---

# REQUIRED STRUCTURE OF backend.md

Generate these sections in order.

Every section must be exhaustive.

---

## 1. Executive Overview

Explain:

Purpose

Architecture philosophy

Design principles

High-level system flow

Non-functional requirements

Performance goals

Availability goals

Security goals

Scalability goals

Maintainability goals

Observability goals

---

## 2. Global Infrastructure Architecture

Explain:

Cloudflare Pages

Cloudflare Workers

Next.js App Router

Supabase

Postgres

Storage

Realtime

Edge Functions

pgvector

CDN

Edge Cache

Regional routing

API Gateway

Rate limiting

Caching

Connection flow

Deployment flow

CI/CD architecture

Environment separation

Development

Staging

Production

---

## 3. Complete System Architecture

Explain every module.

Authentication

Dashboard

Employees

Legal Reports

Compliance

Documents

Storage

Notifications

Lawyers

AI

Knowledge Base

Settings

Admin

Realtime

Audit

Monitoring

Include module interactions.

Include data flow diagrams (Markdown).

---

## 4. Supabase Relational Database Design

Design enterprise schema.

Include every table.

Mandatory tables:

tenants

users

employees

documents

contracts

legal_reports

report_history

compliance_alerts

knowledge_base

legal_knowledge

audit_logs

notifications

activity_logs

sessions

roles

permissions

role_permissions

invitations

uploads

embeddings

system_settings

feature_flags

Every table must include:

columns

types

constraints

indexes

FK

cascade rules

nullable policy

soft delete policy

timestamps

versioning strategy

Explain normalization.

Explain partition strategy.

Explain indexing strategy.

Explain query optimization.

---

## 5. Security Architecture

Enterprise-grade security.

Cover:

Authentication

Authorization

RBAC

ABAC (if useful)

JWT Claims

Supabase Auth

RLS

Service Role

Edge authentication

Secret management

Encryption

Hashing

Storage permissions

Signed URLs

CSRF

XSS

CSP

SQL Injection

Rate limiting

Brute force protection

Bot mitigation

Session lifecycle

Token refresh

Key rotation

Immutable audit logs

Explain WHY every decision exists.

---

## 6. Row Level Security (RLS)

Write production-ready policy design.

Include policy examples.

Explain:

tenant isolation

admin

client

lawyer

owner

super admin

Service Role bypass

Security assumptions

Threat modeling

Failure scenarios

---

## 7. Secret Super Admin (/adminmrwp)

Architect the hidden enterprise dashboard.

Capabilities:

Global tenant overview

Global analytics

CRUD

Tenant suspension

Tenant deletion

Usage statistics

Billing overview

Quota monitoring

Realtime monitoring

Manual AI override

Document correction

Employee correction

Legal report approval

Compliance override

Audit viewer

System configuration

Feature flags

Explain how Service Role bypasses RLS safely.

Never expose Service Role to frontend.

---

## 8. Intelligent AI Document Ingestion Pipeline

Map the COMPLETE pipeline.

User Upload

↓

Supabase Storage

↓

Storage Event

↓

Edge Function

↓

OCR

↓

AI Extraction

↓

Validation

↓

Normalization

↓

Database Insert

↓

Trigger

↓

Compliance Engine

↓

Realtime Broadcast

↓

Frontend Update

Explain:

PDF

DOCX

Images

OCR

Entity Extraction

Confidence score

Human verification

Retry

Failure recovery

Dead-letter strategy

---

## 9. Event Driven Compliance Engine

Design database triggers.

Automations.

Cron jobs.

Webhooks.

Compliance rules.

Examples:

Contract expires <30 days

Visa expired

Employee inactive

Missing documents

Missing signatures

Duplicate employee

Generate alerts automatically.

Explain transactional consistency.

Prevent race conditions.

---

## 10. AI Architecture

Explain enterprise AI stack.

RAG

Embeddings

Chunking

Metadata

Retrieval

Ranking

Prompt construction

Grounding

Citation

Confidence

Fallback

Caching

Deterministic output

Strict anti-hallucination pipeline.

The AI MUST NEVER invent legal information.

---

## 11. Knowledge Base

Design:

pgvector

Embeddings

Legal document ingestion

Chunk size

Versioning

Metadata

Re-indexing

Similarity search

Filtering

Jurisdiction

Legal source priority

Citation strategy

---

## 12. Zero Hallucination Policy

Mandatory.

AI MUST:

Only answer from legal knowledge.

Never speculate.

Never fabricate.

Return deterministic warning when outside database scope.

Explain confidence thresholds.

Fallback strategy.

---

## 13. Lawyer Report Workflow

Maximum:

7 reports per tenant.

Design transaction-safe quota enforcement.

Prevent race conditions.

Status pipeline:

Draft

Pending

Under Review

Needs Revision

Approved

Rejected

Advice Delivered

Realtime updates.

Notification flow.

---

## 14. Notification Architecture

Realtime

Email

Push

Webhook

Queue

Retry

Delivery tracking

Dead letter

---

## 15. Realtime Architecture

Supabase Realtime.

Subscriptions.

Presence.

Broadcast.

Conflict handling.

Offline synchronization.

Reconnect strategy.

---

## 16. API Architecture

REST

Server Actions

Edge Functions

Validation

Error handling

Versioning

Idempotency

Pagination

Filtering

Sorting

Search

Rate limiting

---

## 17. File Storage Architecture

Buckets

Folders

Naming convention

Security

Retention

Versioning

Virus scan

Metadata

Lifecycle

---

## 18. Logging & Audit

System logs

Security logs

Application logs

Audit logs

AI logs

User activity

Immutable history

---

## 19. Monitoring & Observability

Metrics

Tracing

Logging

Alerting

Health checks

Performance dashboards

SLO

SLA

Incident response

---

## 20. Performance Optimization

Caching

Indexes

Batching

Lazy loading

Streaming

Connection pooling

Compression

Edge caching

---

## 21. Scalability Strategy

Horizontal scaling

Database scaling

Storage scaling

Realtime scaling

Edge scaling

Future microservices

---

## 22. Disaster Recovery

Backup

Restore

PITR

Replication

Failover

Recovery strategy

---

## 23. CI/CD

GitHub

Testing

Preview deployment

Production deployment

Migration strategy

Rollback

---

## 24. Testing Strategy

Unit

Integration

E2E

Load

Security

Database

AI validation

Regression

---

## 25. Future Roadmap

Explain future extensibility.

Multi-region.

Multi-language.

Billing.

Payments.

Enterprise SSO.

API marketplace.

Plugin system.

---

# ENGINEERING REQUIREMENTS

Everything must be:

Production Ready

Enterprise Ready

Cloud Native

Event Driven

Scalable

Observable

Maintainable

Secure

Deterministic

Zero Hallucination

High Availability

Low Latency

Multi Tenant

Fault Tolerant

---

# OUTPUT ORDER

Output ONLY in this order:

① Hardened frontend logic updates
(STRICTLY NO UI/CSS/Tailwind/Layout modifications)

② Complete backend.md

The backend.md must be exceptionally detailed (approximately 15,000–30,000+ words if necessary), technically rigorous, and implementation-ready. Every architectural decision must include its rationale, trade-offs, security implications, scalability considerations, and production best practices. Leave no subsystem undocumented.