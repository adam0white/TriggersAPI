# TriggersAPI - Project Overview

## Quick Reference

**Project:** Zapier Triggers API - Edge-native event ingestion system
**Track:** BMad Method - Greenfield
**Stack:** Cloudflare Workers, TypeScript, D1, KV, Queues, Workflows
**Epic Count:** 6 epics (32 total stories)

## What We're Building

A unified, real-time event ingestion API for Zapier built on Cloudflare's edge platform. This API transforms fragmented, integration-specific triggers into a centralized event platform with sub-100ms latency globally, guaranteed durability, and comprehensive observability.

## Current Epic

**Epic 1: Foundation & Event Ingestion + UI Skeleton**

Deploy a working event ingestion API with visible UI. Basic Cloudflare Workers monorepo with POST /events endpoint that accepts events and queues them for processing. UI skeleton at root shows system is live.

**Stories (6):**
1. Project setup: Monorepo, TypeScript, Wrangler config, D1/KV/Queue bindings
2. API Worker: POST /events endpoint with request validation
3. Auth middleware: Bearer token validation via KV lookup
4. Queue integration: Send validated events to Cloudflare Queue
5. Error handling: Structured error responses (400, 401, 503)
6. UI skeleton: HTML/CSS dashboard at root with event submission form

## Key Architecture Decisions

- **Single Worker deployment** with function-based separation (not microservices)
- **D1 (SQLite)** for event storage with automatic edge replication
- **KV** for auth tokens and real-time metrics
- **Queues** for reliable async processing with DLQ
- **Workflows** for guaranteed multi-step orchestration
- **shadcn + React** for demo UI dashboard
- **Debug flags** as primary quality indicators

## Documentation

- **PRD:** `/docs/PRD.md` - Complete requirements, epic breakdown, success criteria
- **Architecture:** `/docs/architecture.md` - Tech stack, patterns, ADRs, implementation guidelines
- **Stories:** `/stories/*.md` - Individual story files with acceptance criteria
- **Orchestration:** `/docs/orchestration-flow.md` - Agent execution log

## Epic Overview

| Epic | Focus | Stories | UI Progress |
|------|-------|---------|-------------|
| Epic 1 | Foundation + Ingestion | 6 | Skeleton + Submit Form |
| Epic 2 | Processing + Storage | 6 | + Live Metrics |
| Epic 3 | Retrieval + Management | 5 | + Event Inbox |
| Epic 4 | Observability + Logs | 5 | + Live Logs + Charts |
| Epic 5 | Debug Panel + Polish | 5 | + Debug Controls |
| Epic 6 | Performance + Docs | 5 | + Perf Testing |

## Development Approach

**Incremental:** Working, deployable system from Epic 1 onwards
**Quality:** Debug flags serve as primary quality indicators
**Testing:** Light unit tests + UI-driven debug scenarios
**Agents:** Scrum Master → Dev → QA cycle per story

## Next Steps

1. SM creates stories for Epic 1 from PRD epic breakdown
2. Dev implements each story in sequence
3. QA validates against acceptance criteria
4. Repeat until Epic 1 complete, then move to Epic 2

---

*Reference Documents: PRD.md, architecture.md*
*Current Status: Epic 1 - Story creation phase*
