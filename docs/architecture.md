# TriggersAPI - Architecture

## Executive Summary

Edge-native event ingestion API built on Cloudflare Workers with TypeScript. Single Worker deployment with multiple function handlers (API routes, queue consumer, tail worker) leveraging automatic resource provisioning for D1, KV, Queues, and Workflows. Monorepo structure with clean separation of concerns.

## Project Initialization

**First Implementation Story (Epic 1, Story 1):**

```bash
npm create cloudflare@latest triggers-api
```

**Interactive Setup:**
- Select: **Worker** template
- Language: **TypeScript**
- Git: **Yes**
- Deploy: **No** (manual deploy after configuration)

**What This Provides:**
- TypeScript configuration (tsconfig.json)
- Wrangler CLI tooling and wrangler.toml
- Basic Worker structure (src/index.ts)
- Package.json with Cloudflare dependencies
- Type definitions via `wrangler types`

**Post-Initialization Configuration:**
- Add D1, KV, Queue, Workflow bindings to wrangler.toml
- Configure multiple route handlers in single Worker
- Set up queue consumer and tail worker functions
- Cloudflare automatically provisions resources on first deploy

**Architectural Decision:** Single Worker deployment (not microservices) with function-based separation. Simpler deployment, lower latency (no cross-Worker HTTP), easier debugging.

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
| -------- | -------- | ------- | ------------- | --------- |
| Platform | Cloudflare Workers | Latest | All | Edge-native, auto-scaling, zero-config infrastructure |
| Language | TypeScript (strict) | 5.x | All | Type safety, excellent Cloudflare support, developer experience |
| Database | D1 (SQLite) | Latest | 2,3,4,6 | Managed SQLite at edge, automatic replication, SQL queries |
| Cache/Metadata | Cloudflare KV | Latest | 2,3,4 | Low-latency key-value for metrics, auth tokens |
| Queue | Cloudflare Queues | Latest | 1,2,6 | Built-in batching, retries, DLQ, at-least-once delivery |
| Workflows | Cloudflare Workflows | Latest | 2,6 | Guaranteed execution, durable orchestration |
| Observability | Tail Workers | Latest | 4,6 | Automatic log/metric capture for all Worker executions |
| API Pattern | REST | N/A | 1,3 | Simple, predictable, widely understood |
| Auth | Bearer tokens + KV | N/A | 1,3 | Fast validation, no external dependencies |
| UI Framework | shadcn + React | Latest | 1,2,3,4,5 | Modern components, Tailwind, TypeScript-native |
| Styling | Tailwind CSS | 3.x | 1,5 | Utility-first, fast development, included with shadcn |
| Build Tool | Wrangler | Latest | All | Official Cloudflare CLI, handles bundling/deployment |
| Linting | ESLint | 8.x | All | Code quality, catches errors early |
| Formatting | Prettier | 3.x | All | Consistent code style across project |
| Testing | Vitest (light) | Latest | 1,2,6 | Fast, Vite-native, light coverage for critical paths |

## Project Structure

```
triggers-api/
├── package.json
├── wrangler.toml                 # Single config with all bindings
├── tsconfig.json
├── .env.example
├── README.md
│
├── src/
│   ├── index.ts                  # Main Worker entry point
│   │
│   ├── routes/                   # API route handlers
│   │   ├── events.ts             # POST /events
│   │   ├── inbox.ts              # GET /inbox, POST /inbox/:id/ack, /retry
│   │   └── dashboard.ts          # GET / - serves UI
│   │
│   ├── queue/
│   │   └── consumer.ts           # Queue batch consumer
│   │
│   ├── workflows/
│   │   └── process-event.ts     # Workflow: validate → store → metrics
│   │
│   ├── tail/
│   │   └── worker.ts             # Tail Worker for observability
│   │
│   ├── middleware/
│   │   ├── auth.ts               # Bearer token validation
│   │   ├── error-handler.ts     # Structured error responses
│   │   └── logger.ts             # Structured logging
│   │
│   ├── db/
│   │   ├── schema.sql            # D1 table definitions
│   │   └── queries.ts            # SQL query functions
│   │
│   ├── lib/
│   │   ├── validation.ts         # Request validation
│   │   ├── metrics.ts            # KV metrics helpers
│   │   └── debug.ts              # Debug flag handlers
│   │
│   ├── types/
│   │   ├── events.ts             # Event type definitions
│   │   ├── api.ts                # API request/response types
│   │   └── env.ts                # Cloudflare bindings types
│   │
│   └── ui/                       # Dashboard UI (shadcn + React)
│       ├── index.html
│       ├── App.tsx
│       ├── components/
│       │   ├── ui/               # shadcn components
│       │   ├── MetricsDashboard.tsx
│       │   ├── EventInbox.tsx
│       │   ├── DebugPanel.tsx
│       │   └── TailLogs.tsx
│       └── lib/
│           └── api-client.ts     # Fetch wrapper for API calls
│
├── test/
│   ├── routes/
│   ├── queue/
│   └── lib/
│
└── docs/
    ├── PRD.md
    ├── architecture.md
    └── api.md
```

## Epic to Architecture Mapping

| Epic | Components | Files |
|------|------------|-------|
| Epic 1: Foundation + UI Skeleton | API Worker, Queue binding, Auth middleware, UI skeleton | `src/index.ts`, `src/routes/events.ts`, `src/middleware/auth.ts`, `src/ui/` |
| Epic 2: Processing + Metrics | Queue Consumer, Workflows, D1 schema, KV metrics | `src/queue/consumer.ts`, `src/workflows/process-event.ts`, `src/db/schema.sql`, `src/lib/metrics.ts` |
| Epic 3: Retrieval + Inbox UI | Inbox routes, D1 queries, UI inbox component | `src/routes/inbox.ts`, `src/db/queries.ts`, `src/ui/components/EventInbox.tsx` |
| Epic 4: Observability + Logs UI | Tail Worker, metrics calculation, UI components | `src/tail/worker.ts`, `src/lib/metrics.ts`, `src/ui/components/TailLogs.tsx` |
| Epic 5: Debug + Polish | Debug flag handlers, UI debug panel, mock data | `src/lib/debug.ts`, `src/ui/components/DebugPanel.tsx` |
| Epic 6: Performance + Docs | Load testing, documentation, final optimization | All components |

## Technology Stack Details

### Core Technologies

**Cloudflare Workers** - Edge compute running at 300+ global locations, zero cold starts, auto-scaling

**D1 (SQLite)** - Managed SQLite database with automatic replication and read replicas at edge

**Cloudflare KV** - Distributed key-value store for auth tokens and real-time metrics (eventual consistency)

**Cloudflare Queues** - Message queue with built-in batching (up to 1000/batch), automatic retries (3x), Dead Letter Queue

**Cloudflare Workflows** - Durable execution engine for multi-step orchestration with guaranteed delivery

**Tail Workers** - Automatic observability capturing all Worker executions, console logs, exceptions, timing

### Integration Points

**Worker → Queue** - Events pushed to queue after validation, acknowledged immediately to client

**Queue → Workflow** - Batch processing triggers Workflow for each event (validate → D1 write → KV update)

**Workflow → D1** - Durable writes to events table with transaction support

**Workflow → KV** - Increment aggregate counters (total events, status counts, error rates)

**Tail Worker → KV/D1** - Log capture stored for dashboard consumption

**UI → Worker API** - React SPA makes fetch() calls to REST endpoints (same origin, no CORS)

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### 1. Error Response Structure

**ALL API errors MUST use this exact format:**

```typescript
{
  error: {
    code: string,        // Machine-readable: "INVALID_PAYLOAD", "UNAUTHORIZED"
    message: string,     // Human-readable error description
    timestamp: string,   // ISO-8601
    correlation_id: string  // UUID for tracing
  }
}
```

### 2. Success Response Structure

**ALL API success responses:**

```typescript
{
  data: T,              // Actual response payload
  timestamp: string     // ISO-8601
}
```

### 3. Logging Format (for Tail Worker consumption)

```typescript
{
  level: "debug" | "info" | "warn" | "error",
  message: string,
  correlation_id: string,
  timestamp: string,    // ISO-8601
  context: Record<string, any>  // Additional data
}
```

### 4. Debug Flag Handling

**Query param `?debug=<flag>` triggers specific behavior:**

- `validation_error` → Return 400 with sample validation error
- `processing_error` → Return 500 after queuing
- `queue_delay` → Inject 2s artificial delay
- `dlq_routing` → Force event to Dead Letter Queue

**Implementation:** Check in route handler BEFORE normal logic

## Consistency Rules

### Naming Conventions

**Files/Directories:** `kebab-case` (e.g., `event-processor.ts`, `api-client.ts`)

**Functions/Variables:** `camelCase` (e.g., `validateEvent`, `eventId`)

**Types/Interfaces:** `PascalCase` (e.g., `EventPayload`, `ApiResponse`)

**Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_BATCH_SIZE`, `DEFAULT_LIMIT`)

**Database Tables:** `snake_case` (e.g., `events`, `event_logs`)

**Database Columns:** `snake_case` (e.g., `event_id`, `created_at`, `retry_count`)

**API Routes:** `kebab-case` (e.g., `/events`, `/inbox/:id/ack`)

### Code Organization

**Feature-based grouping:** Group by domain (`routes/`, `queue/`, `workflows/`) NOT by type (`controllers/`, `services/`)

**Shared utilities:** Place in `lib/` for cross-cutting concerns

**Types:** Centralized in `types/` directory, exported from index files

**Tests:** Mirror src/ structure in test/ directory (e.g., `test/routes/events.test.ts`)

### Error Handling

**Middleware pattern:** Wrap route handlers with error boundary that catches all exceptions and formats to standard error response

**Correlation IDs:** Generate UUID on request entry, pass through all layers, include in logs and error responses

**Never expose internals:** Sanitize error messages, log full stack traces but return generic messages to API consumers

**Status codes:**
- 400: Client error (bad request, validation failure)
- 401: Unauthorized (invalid/missing token)
- 404: Resource not found
- 409: Conflict (e.g., retry on non-failed event)
- 500: Server error (unexpected failures)
- 503: Service unavailable (queue full, degraded state)

### Logging Strategy

**Structured JSON logs** via console methods, captured by Tail Worker

**Log levels:**
- `debug`: Verbose flow information (dev only)
- `info`: Normal operations (event received, processed)
- `warn`: Unexpected but handled (retry triggered, fallback used)
- `error`: Failures requiring attention (unhandled exceptions, DLQ routing)

**NEVER log sensitive data:** Sanitize auth tokens, filter PII before logging

**Include correlation_id in ALL logs** for request tracing

## Data Architecture

### D1 Schema (SQLite)

```sql
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  payload JSON NOT NULL,
  metadata JSON,
  status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'failed')),
  created_at TEXT NOT NULL,  -- ISO-8601 timestamp
  updated_at TEXT NOT NULL,  -- ISO-8601 timestamp
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_status_created ON events(status, created_at);
```

### KV Storage Structure

**Auth Tokens:**
- Key: `auth:token:<token>`
- Value: `{ valid: true, created_at: "..." }`

**Metrics (Real-time):**
- Key: `metrics:events:total`
- Key: `metrics:events:pending`
- Key: `metrics:events:delivered`
- Key: `metrics:events:failed`
- Key: `metrics:queue:depth`
- Key: `metrics:dlq:count`

**Atomic increments** using KV's atomic operations

## API Contracts

**Full API specification documented in PRD.md**

Key contracts:
- POST /events - Event ingestion with `{payload, metadata}` structure
- GET /inbox - Query with filters (status, timestamps, pagination)
- POST /inbox/:id/ack - Delete acknowledged event
- POST /inbox/:id/retry - Requeue failed event
- GET / - Serve dashboard UI

All endpoints require `Authorization: Bearer <token>` except root dashboard.

## Security Architecture

**Authentication:** Bearer tokens validated against KV store on every API request

**HTTPS Only:** Enforced by Cloudflare, TLS 1.2+ minimum

**Input Validation:** All payloads validated before processing, max 1MB limit

**Secrets:** Stored as environment variables in Cloudflare dashboard, bound to Worker

**No Sensitive Logging:** Tokens and PII sanitized before Tail Worker capture

**Rate Limiting:** (Growth feature) Use Cloudflare Rate Limiting rules

## Performance Considerations

**Edge Latency:** Target < 100ms for POST /events at p95 (Cloudflare global network)

**D1 Optimization:** Indexes on status and created_at for fast inbox queries

**KV Caching:** Metrics served from KV (eventual consistency acceptable)

**Queue Batching:** Process up to 1000 events/batch for efficiency

**UI Performance:** React lazy loading, code splitting, Tailwind for minimal CSS

**CDN:** Static UI assets cached at edge

## Deployment Architecture

**Single Worker Deployment** to Cloudflare's global network (300+ locations)

**wrangler deploy** - Atomic deployments with instant rollback capability

**Automatic Resource Provisioning** - D1, KV, Queues created on first deploy based on wrangler.toml bindings

**Zero Downtime** - Gradual rollout across edge locations

**Environments:** Use wrangler.toml `[env.staging]` and `[env.production]` sections

## Development Environment

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or pnpm
- Cloudflare account (free tier sufficient)
- Wrangler CLI (installed via create command)

### Setup Commands

```bash
# Initialize project
npm create cloudflare@latest triggers-api
cd triggers-api

# Install dependencies
npm install

# Install shadcn
npx shadcn@latest init

# Local development (with bindings)
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy

# Generate TypeScript types for bindings
npx wrangler types
```

## Architecture Decision Records (ADRs)

### ADR-001: Single Worker vs Microservices

**Decision:** Single Worker with function-based separation

**Rationale:** Simpler deployment, lower latency (no inter-Worker HTTP), easier debugging, sufficient for this scale

**Trade-offs:** Less isolation between components, but acceptable for this use case

### ADR-002: D1 (SQLite) for Event Storage

**Decision:** Use Cloudflare D1 instead of external database

**Rationale:** Edge-native, automatic replication, zero configuration, excellent for read-heavy inbox queries

**Trade-offs:** SQLite limitations (no complex joins at scale), but sufficient for event table

### ADR-003: Bearer Tokens via KV

**Decision:** Simple Bearer tokens validated against KV store

**Rationale:** Fast validation (< 1ms), no external auth service, sufficient for MVP showcase

**Trade-offs:** No OAuth flow, but acceptable for demo purposes

### ADR-004: shadcn for UI

**Decision:** shadcn + React + Tailwind for dashboard

**Rationale:** Modern, customizable components, TypeScript-native, copy-paste approach allows full control

**Trade-offs:** Manual component installation vs full UI library, but provides learning opportunity

### ADR-005: Debug Flags as Quality Indicators

**Decision:** Debug flags trigger error pathways, serve as primary testing mechanism

**Rationale:** Showcases error handling without complex test infrastructure, demonstrates system behavior visually

**Trade-offs:** Less automated test coverage, but aligns with demo/showcase goals

---

_Generated by BMAD Decision Architecture Workflow_
_Date: 2025-11-10_
_For: Adam_
