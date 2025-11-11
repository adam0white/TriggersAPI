# TriggersAPI - Product Requirements Document

**Author:** Adam
**Date:** 2025-11-10
**Version:** 1.0

---

## Executive Summary

The Zapier Triggers API is a unified, real-time event ingestion system that transforms how automation works on the Zapier platform. Currently, triggers are fragmented across individual integrations, limiting flexibility and preventing true real-time, event-driven workflows. This API solves that by providing a public, developer-friendly RESTful interface where *any system* can send events into Zapier to power intelligent, reactive automation.

**The Strategic Vision:** This API lays the foundation for next-generation automation and agentic workflows at Zapier - moving from scheduled polling and integration-specific triggers to a unified, real-time event platform.

**The Problem We're Solving:** Developers and automation specialists are limited by Zapier's current trigger architecture. Events are trapped within individual integrations, preventing real-time reactions and cross-system orchestration. The lack of a centralized event ingestion mechanism restricts Zapier's ability to support modern, event-driven architectures.

### What Makes This Special

**Edge-Native Event Platform:** Built on Cloudflare's global network for sub-100ms latency worldwide, with zero infrastructure setup.

**Developer-First Design:** TypeScript-native API leveraging Cloudflare Workers, Queues, and Durable Objects for guaranteed durability and scalability without configuration overhead.

**Built-In Testing Excellence:** Debug flags and testing tools to demonstrate partial error pathways, retry logic, and failure scenarios - because reliable systems need testable failure modes.

**Foundation for Modernization:** A showcase of scalable backend architecture that can become the blueprint for modernizing Zapier's entire integration ecosystem.

**The "Wow" Moment:** Developers send events to a global edge network and get guaranteed delivery with built-in durability, testing capabilities, and the foundation for building agentic workflows - all without managing infrastructure.

---

## Project Classification

**Technical Type:** API/Backend (RESTful)
**Domain:** SaaS Platform / Integration Infrastructure
**Complexity:** Medium

This is a **backend API project** focused on event ingestion, persistence, and delivery. The primary technical challenges revolve around durability guarantees, scalability at the edge, and developer experience.

**Technology Stack:**

- Platform: Cloudflare (Workers, Queues, Durable Objects)
- Language: TypeScript
- Architecture: Edge-native, event-driven
- Deployment: Global edge network

**Strategic Context:** This is a greenfield project for a Zapier assignment, demonstrating advanced backend engineering skills and modern edge platform utilization. Mock data will be used where Zapier-specific APIs are unavailable.

---

## Success Criteria

**Backend Mastery Demonstration:**

- Events ingested and delivered with 99.9%+ reliability
- Sub-100ms response times for event ingestion at the edge
- Zero data loss guarantee - durable persistence before acknowledgment
- Retry logic, dead letter queues, and failure modes all working as designed

**Platform Excellence:**

- Full utilization of Cloudflare Developer Platform capabilities:
  - Workers for edge compute
  - Queues for reliable async processing
  - Durable Objects for stateful coordination
  - Workflows for complex orchestrations
  - Workers AI for potential intelligent routing/processing
  - Tail Workers for observability
- Production-quality TypeScript architecture with clean separation of concerns
- Comprehensive testing including error pathway demonstrations

**Observability & Debug Experience:**

- Debug flags as first-class features (not afterthoughts)
- Metrics UI surfacing:
  - Event flow visualization
  - Queue depths and processing stats
  - Error rates and retry patterns
  - Latency distributions
- Ability to trace individual events through the entire system
- Clear visibility into system internals for demonstration purposes

**Developer Experience:**

- Intuitive API - first event sent in < 5 minutes
- Clear, actionable error messages
- Comprehensive documentation covering happy paths and failure scenarios
- Example clients and testing utilities

**Strategic Impact (Zapier Assignment Success):**

- Demonstrates architecture that could scale to millions of events/day
- Shows edge-native approach as viable alternative to traditional cloud
- Proves depth of Cloudflare platform knowledge
- Provides blueprint for modernizing event-driven systems

---

## Product Scope

**Development Philosophy:** Incremental development with the application in a working, deployable state from Epic 1 onwards. Each epic adds capability while maintaining system stability.

### MVP - Minimum Viable Product

**Core Event Flow (Monorepo Architecture):**

1. **Event Ingestion**
   - POST /events endpoint via Worker
   - JSON payload validation
   - Send validated events to Queue
   - Return structured acknowledgment with event ID

2. **Async Event Processing**
   - Queue Consumer Worker processes batches
   - Workflow orchestration: validate → store in D1 → update KV metadata
   - Automatic retry logic via Queue configuration
   - Failed messages route to Dead Letter Queue

3. **Event Retrieval & Status**
   - GET /inbox endpoint via Worker
   - Query D1 with filters (status: pending/delivered/failed, timestamp ranges)
   - Status tracking (no actual delivery in MVP, just status updates)
   - Event acknowledgment flow

**Platform Capabilities Showcase:**

- **Workers**: Edge compute for ingestion and API endpoints
- **Queues**: Batching, retries, Dead Letter Queue handling
- **Workflows**: Guaranteed, retriable multi-step orchestration
- **D1**: Structured event data storage with SQL queries
- **KV**: Lightweight metadata (event counts, quick lookups)
- **Tail Workers**: Observability, logging, execution metrics
- **RPC**: Worker-to-Worker method calls (no internal HTTP APIs)

**Debug & Performance Testing:**

- Debug flags to trigger error pathways
  - Validation failures
  - Processing errors
  - Queue retry demonstrations
  - DLQ routing tests
- Performance testing mode
  - Simulate high load
  - Latency injection
  - Batch processing analysis

**Demo UI (Primary Showcase):**

- **Real-time Dashboard** - Central interface for demonstrating all capabilities
  - Event statistics (total, pending, delivered, failed)
  - Queue depth and batch processing metrics
  - Dead Letter Queue message counts
  - Error rates and retry patterns
  - Processing latency distributions (from Tail Worker data)
  - Event flow visualization
- **Debug Control Panel** - UI-driven debug flag controls
  - Trigger validation failures
  - Simulate processing errors
  - Demonstrate retry logic
  - Force DLQ routing
  - Inject latency for performance testing
- **Event Inbox Interface** - Browse and filter events
  - Status filtering (pending/delivered/failed)
  - Timestamp range selection
  - Event payload inspection
  - Acknowledgment actions
- **Live Tail Logs** - Real-time observability visualization
  - Tail Worker output streaming
  - Request/response inspection
  - Error tracking

**Developer Experience:**

- Clear, structured API responses
- Actionable error messages
- Mock Zapier data for testing
- Basic API documentation

**Quality Assurance Approach:**

- Debug flags serve as primary quality indicators during development
- Light unit testing for critical validation logic
- Integration verification through UI-driven debug scenarios
- Manual testing via the debug control panel
- System reliability proven through error pathway demonstrations

### Growth Features (Post-MVP)

**Advanced Observability:**

- Enhanced metrics dashboard with historical trends
- Per-event tracing through entire system lifecycle
- Detailed Tail Worker log aggregation and search
- Custom alerting on error thresholds
- Performance profiling and bottleneck identification

**Workers AI Integration:**

- Intelligent event routing based on payload analysis
- Anomaly detection in event patterns
- Smart retry strategies based on failure types
- Payload classification and tagging

**Enhanced Event Management:**

- Multiple event types with schema validation
- Event transformation pipelines
- Webhook delivery simulation with configurable retry strategies
- Event replay capabilities from historical data
- Bulk event operations

**Scalability & Reliability:**

- Rate limiting and quota management
- Multi-region event routing strategies
- Advanced batching optimizations
- Circuit breaker patterns for external dependencies
- Priority queues for critical events

**Developer Tools:**

- CLI tool for event submission and testing
- OpenAPI specification
- Swagger-style interactive API documentation UI
- SDK generation for common languages
- Interactive API playground
- Enhanced test utilities (keeping automation light)

### Vision (Future/Demo Talking Points)

**Platform Modernization:**

- Blueprint for Zapier's unified event platform
- Real Zapier API integration (when access available)
- Multi-tenant architecture with workspace isolation
- Event marketplace for discoverable triggers

**Advanced Intelligence:**

- ML-based event deduplication
- Predictive scaling based on event patterns
- Automated performance optimization
- Intelligent event batching strategies

**Enterprise Capabilities:**

- Event audit trails and compliance reporting
- Advanced security with encryption at rest
- SLA monitoring and guarantees
- Custom retention policies
- Multi-cloud event distribution

---

## API Backend Specific Requirements

This is a RESTful API backend with a demo UI, built on Cloudflare's edge platform. The architecture leverages Workers, Queues, Workflows, D1, KV, and Tail Workers in a monorepo structure with RPC-based inter-worker communication.

### API Specification

**Base Architecture:**

- All endpoints served via Cloudflare Workers at the edge
- Root (`/`) serves the demo UI dashboard
- API endpoints under `/events` and `/inbox`
- No internal HTTP APIs - Worker-to-Worker communication via RPC

**Endpoints:**

**1. POST /events**

*Purpose:* Ingest events from external systems into the triggers platform

*Request Headers:*

```
Authorization: Bearer <token>  (or API-Key: <key> if Bearer costly for MVP)
Content-Type: application/json
```

*Request Body:*

```json
{
  "payload": {
    /* Flexible JSON - the actual event data */
  },
  "metadata": {
    "event_type": "user.created",
    "source": "auth-service",
    "custom_field": "optional values"
  }
}
```

*Success Response (200):*

```json
{
  "event_id": "uuid-v4",
  "status": "accepted",
  "timestamp": "2025-11-10T12:34:56.789Z"
}
```

*Debug Query Parameters:*

- `?debug=validation_error` - Force validation failure
- `?debug=processing_error` - Force processing failure
- `?debug=queue_delay` - Inject artificial latency
- `?debug=dlq_routing` - Force Dead Letter Queue routing

*Error Responses:*

- `400 Bad Request` - Invalid payload structure
- `401 Unauthorized` - Missing or invalid auth token
- `500 Internal Server Error` - Processing error
- `503 Service Unavailable` - Queue full or system degraded

---

**2. GET /inbox**

*Purpose:* Retrieve events with filtering and pagination

*Request Headers:*

```
Authorization: Bearer <token>
```

*Query Parameters:*

- `status` - Filter by status: `pending` | `delivered` | `failed` (optional)
- `from` - Start timestamp (ISO-8601) (optional)
- `to` - End timestamp (ISO-8601) (optional)
- `limit` - Results per page (default: 50, max: 1000)
- `offset` - Pagination offset (default: 0)

*Success Response (200):*

```json
{
  "events": [
    {
      "event_id": "uuid",
      "payload": { /* original payload */ },
      "metadata": { /* original metadata */ },
      "status": "pending",
      "created_at": "2025-11-10T12:34:56.789Z",
      "updated_at": "2025-11-10T12:34:57.123Z",
      "retry_count": 0
    }
  ],
  "total": 1523,
  "limit": 50,
  "offset": 0
}
```

*Error Responses:*

- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid auth token

---

**3. POST /inbox/{event_id}/ack**

*Purpose:* Acknowledge and delete a consumed event

*Request Headers:*

```
Authorization: Bearer <token>
```

*Success Response (200):*

```json
{
  "event_id": "uuid",
  "status": "deleted",
  "timestamp": "2025-11-10T12:35:00.000Z"
}
```

*Error Responses:*

- `404 Not Found` - Event ID does not exist
- `401 Unauthorized` - Missing or invalid auth token

---

**4. POST /inbox/{event_id}/retry**

*Purpose:* Manually retry a failed event by reposting it to the queue

*Request Headers:*

```
Authorization: Bearer <token>
```

*Success Response (200):*

```json
{
  "event_id": "uuid",
  "status": "retrying",
  "new_attempt": 4,
  "timestamp": "2025-11-10T12:35:05.000Z"
}
```

*Error Responses:*

- `404 Not Found` - Event ID does not exist
- `401 Unauthorized` - Missing or invalid auth token
- `409 Conflict` - Event not in failed state

---

**5. GET / (Root)**

*Purpose:* Serve the demo UI dashboard (HTML/CSS/JS)

*Features:*

- Real-time metrics visualization
- Debug control panel
- Event inbox interface
- Live tail logs streaming

### Authentication & Authorization

**MVP Approach:**

- **Bearer Tokens** (preferred) - If implementation cost is reasonable
- **API Keys** (fallback) - If Bearer tokens add significant complexity
- Simple token validation via KV store lookup
- No user management or token generation UI in MVP (tokens pre-configured)

**Token Format:**

```
Authorization: Bearer <token>
```

OR

```
API-Key: <key>
```

**Security Considerations:**

- HTTPS only (enforced by Cloudflare)
- Token stored in KV for quick validation
- Invalid tokens return 401 with clear error message

**Growth Feature:** Full OAuth2 flow, token generation UI, multi-tenant authentication

---

## Functional Requirements

### FR-1: Event Ingestion

**FR-1.1 Event Acceptance**

- System MUST accept POST requests to /events endpoint with JSON payloads
- System MUST validate request contains `payload` object (required)
- System MUST accept optional `metadata` object with arbitrary fields
- System MUST generate unique UUID v4 for each accepted event
- System MUST return event_id, status, and timestamp in response within 100ms

**FR-1.2 Authentication**

- System MUST validate Bearer token (or API key) on all API requests
- System MUST return 401 Unauthorized for missing or invalid tokens
- System MUST perform token validation via KV store lookup
- System MUST support HTTPS only (enforced by Cloudflare)

**FR-1.3 Debug Capabilities**

- System MUST support debug query parameters on POST /events:
  - `?debug=validation_error` - Force validation failure response
  - `?debug=processing_error` - Force processing error
  - `?debug=queue_delay` - Inject artificial latency
  - `?debug=dlq_routing` - Force Dead Letter Queue routing
- Debug flags MUST trigger realistic error pathways for testing

**FR-1.4 Error Handling**

- System MUST return structured error responses with:
  - HTTP status code
  - Error message (human-readable)
  - Error code (machine-readable)
  - Timestamp
- System MUST handle malformed JSON with 400 Bad Request
- System MUST handle service degradation with 503 Service Unavailable

### FR-2: Event Processing & Storage

**FR-2.1 Queue-Based Processing**

- System MUST send accepted events to Cloudflare Queue for async processing
- System MUST process events in batches (configurable batch size)
- System MUST implement automatic retry logic via Queue configuration
- System MUST route failed events to Dead Letter Queue after max retries (default: 3)

**FR-2.2 Workflow Orchestration**

- System MUST use Cloudflare Workflows for guaranteed event processing
- Workflow MUST execute steps: validate → store in D1 → update KV metadata
- Workflow MUST be retriable on failure
- Workflow MUST maintain durability guarantees

**FR-2.3 Durable Storage**

- System MUST store events in D1 database with fields:
  - event_id (UUID, primary key)
  - payload (JSON)
  - metadata (JSON)
  - status (pending|delivered|failed)
  - created_at (timestamp)
  - updated_at (timestamp)
  - retry_count (integer)
- System MUST update KV store with aggregate metrics (event counts, status distribution)
- System MUST guarantee no data loss - events persisted before acknowledgment

**FR-2.4 Status Management**

- System MUST update event status through lifecycle: pending → delivered/failed
- System MUST increment retry_count on each processing attempt
- System MUST update updated_at timestamp on status changes

### FR-3: Event Retrieval & Management

**FR-3.1 Event Inbox Query**

- System MUST provide GET /inbox endpoint for event retrieval
- System MUST support filtering by:
  - status (pending|delivered|failed)
  - timestamp range (from/to ISO-8601)
- System MUST support pagination (limit, offset)
- System MUST return events with all stored fields
- System MUST return total count for pagination

**FR-3.2 Event Acknowledgment**

- System MUST provide POST /inbox/{event_id}/ack endpoint
- System MUST delete event from D1 on acknowledgment
- System MUST return 404 for non-existent event_id
- System MUST update KV metrics on deletion

**FR-3.3 Manual Retry**

- System MUST provide POST /inbox/{event_id}/retry endpoint
- System MUST repost event to Queue for reprocessing
- System MUST only allow retry for events in 'failed' status
- System MUST return 409 Conflict if event not in failed state
- System MUST increment retry_count and update status to 'retrying'

### FR-4: Observability & Debugging

**FR-4.1 Tail Worker Logging**

- System MUST implement Tail Worker for observability
- Tail Worker MUST capture:
  - Request/response data for all API calls
  - Console logs from all Workers
  - Uncaught exceptions and errors
  - Execution timing and latency metrics
- Tail Worker MUST store logs in accessible format (KV or D1)

**FR-4.2 Metrics Collection**

- System MUST track in KV:
  - Total events ingested
  - Events by status (pending/delivered/failed)
  - Queue depth
  - Dead Letter Queue message count
  - Error rates
  - Processing latency percentiles (p50, p95, p99)
- Metrics MUST update in real-time or near-real-time

**FR-4.3 Performance Testing**

- System MUST support latency injection via debug flags
- System MUST allow simulation of high load scenarios
- System MUST capture performance metrics during testing

### FR-5: Demo UI Dashboard

**FR-5.1 Dashboard Hosting**

- System MUST serve HTML/CSS/JS dashboard at root (/)
- Dashboard MUST be responsive and work in modern browsers
- Dashboard MUST not require authentication (demo purposes)

**FR-5.2 Real-Time Metrics Display**

- Dashboard MUST display:
  - Event statistics (total, pending, delivered, failed) with auto-refresh
  - Queue depth and batch processing stats
  - Dead Letter Queue message counts
  - Error rates and retry patterns
  - Processing latency distributions
  - Event flow visualization

**FR-5.3 Debug Control Panel**

- Dashboard MUST provide UI controls to:
  - Submit test events with debug flags
  - Trigger validation failures
  - Simulate processing errors
  - Demonstrate retry logic
  - Force DLQ routing
  - Inject latency for performance testing
- Controls MUST provide immediate visual feedback

**FR-5.4 Event Inbox Interface**

- Dashboard MUST provide interface to:
  - Browse events with filtering (status, timestamp)
  - View event details (payload, metadata)
  - Acknowledge events (trigger DELETE)
  - Retry failed events
  - Paginate through results

**FR-5.5 Live Tail Logs**

- Dashboard MUST stream Tail Worker logs in real-time
- Dashboard MUST display request/response inspection
- Dashboard MUST highlight errors and exceptions
- Dashboard MUST support log filtering/search

### FR-6: Worker Communication

**FR-6.1 RPC-Based Communication**

- System MUST use Worker-to-Worker RPC for internal communication
- Workers MUST communicate via WorkerEntrypoint classes with typed methods
- System MUST NOT use internal HTTP APIs between Workers
- RPC bindings MUST be configured in wrangler.toml

**FR-6.2 Service Boundaries**

- System MUST separate concerns into distinct Workers:
  - API Worker (handles HTTP endpoints)
  - Queue Consumer Worker (processes batches)
  - Tail Worker (observability)
  - UI Worker (serves dashboard - may be same as API Worker)

### FR-7: Mock Data & Testing

**FR-7.1 Mock Zapier Integration**

- System MUST include mock Zapier event data for demonstration
- Mock data MUST represent realistic event types and payloads
- System MUST allow easy generation of sample events via UI

**FR-7.2 Documentation**

- System MUST include API documentation covering:
  - All endpoints with request/response examples
  - Authentication setup
  - Debug flag usage
  - Error code reference
- Documentation MUST be accessible and clear

---

## Non-Functional Requirements

### NFR-1: Performance

**Response Time:**

- POST /events endpoint MUST respond within 100ms at p95 (edge latency)
- GET /inbox endpoint MUST respond within 200ms at p95 (including D1 query)
- POST /inbox/{id}/ack and /retry MUST respond within 150ms at p95
- Dashboard UI MUST load initial view within 2 seconds

**Throughput:**

- System MUST handle at least 100 events/second per edge location
- Queue Consumer MUST process batches efficiently (target: 1000 events/batch)
- System MUST demonstrate scalability potential for millions of events/day

**Latency Targets:**

- Event ingestion to Queue: < 50ms
- Queue to processing start: < 5 seconds (normal conditions)
- End-to-end event processing: < 10 seconds (ingestion → storage → status update)

**Edge Performance:**

- Leverage Cloudflare's global network for sub-100ms worldwide latency
- Zero cold starts (Workers are instantly available)
- Minimize cross-region data transfers

### NFR-2: Reliability & Durability

**Data Durability:**

- Zero data loss guarantee - events MUST be persisted before acknowledgment sent
- D1 provides durable storage with automatic replication
- Queue provides at-least-once delivery guarantees
- Workflows provide guaranteed execution with automatic retries

**Availability:**

- Target 99.9% uptime (leveraging Cloudflare's infrastructure)
- Graceful degradation - system returns 503 if queues full rather than losing data
- Dead Letter Queue ensures failed messages are never silently dropped

**Retry Logic:**

- Automatic retry up to 3 attempts via Queue configuration
- Exponential backoff between retries (configurable)
- Manual retry capability via API for failed events
- Workflow-level retry for processing failures

**Failure Handling:**

- All failures MUST be logged via Tail Worker
- Failed events MUST be routed to Dead Letter Queue
- System MUST continue processing other events if individual event fails
- Partial failures in batches MUST not block entire batch

### NFR-3: Security

**Authentication & Authorization:**

- All API endpoints (except root dashboard) MUST require valid Bearer token or API key
- Tokens stored securely in KV with encrypted values
- HTTPS enforcement via Cloudflare (TLS 1.2+)
- Invalid auth attempts MUST be logged

**Data Protection:**

- Event payloads stored in D1 with Cloudflare's encryption at rest
- No sensitive data logging in Tail Workers (sanitize before logging)
- API keys/tokens never exposed in responses or logs
- Secure headers (CORS, CSP, X-Frame-Options) on all responses

**Input Validation:**

- All API inputs MUST be validated before processing
- JSON payloads MUST be sanitized to prevent injection attacks
- Request size limits enforced (max 1MB payload)
- Rate limiting via Cloudflare features (growth feature)

**Compliance:**

- Data stored in Cloudflare data centers (specify region if needed)
- No PII collection in MVP (mock data only)
- Clear data retention policy (configurable TTL)

### NFR-4: Scalability

**Horizontal Scalability:**

- Cloudflare Workers auto-scale globally based on demand
- No infrastructure provisioning required
- Queues handle backpressure automatically
- D1 scales with Cloudflare's managed infrastructure

**Resource Limits (Cloudflare Platform):**

- Understand and work within Workers limits:
  - CPU time: 50ms per request (paid plan)
  - Memory: 128MB per Worker
  - Subrequest limit: 50 per request
- Queue batch size configurable (default: 100, max: 1000)
- D1 database size limits (currently 500MB on paid plans)

**Growth Capacity:**

- Architecture designed to scale from prototype to production
- Demonstrate ability to handle 10,000+ events/second globally
- Queue batching optimizes for high throughput
- KV caching reduces D1 query load

**Edge Distribution:**

- Workers deployed to 300+ Cloudflare edge locations globally
- Events processed close to origin for minimal latency
- D1 replicas for read performance (Cloudflare managed)

### NFR-5: Observability & Monitoring

**Logging:**

- Tail Worker MUST capture all request/response data
- Console logs from all Workers MUST be collected
- Exception tracking for all uncaught errors
- Log retention: minimum 7 days (configurable)

**Metrics & Monitoring:**

- Real-time metrics available via KV
- Historical metrics stored in D1 for trend analysis
- Dashboard auto-refresh every 5 seconds
- Latency percentiles (p50, p95, p99) calculated and displayed

**Debugging:**

- Debug flags provide deterministic error reproduction
- Event tracing from ingestion through delivery
- Tail Worker logs accessible via UI
- Clear error messages with correlation IDs

**Alerting (Growth Feature):**

- Error rate thresholds
- Queue depth warnings
- Dead Letter Queue alerts
- Performance degradation detection

### NFR-6: Developer Experience

**API Design:**

- RESTful conventions with predictable endpoints
- Consistent JSON response structures
- Clear HTTP status codes
- Comprehensive error messages with actionable guidance

**Documentation:**

- API documentation with examples for all endpoints
- Setup guide for local development
- Cloudflare platform configuration guide
- Mock data generation instructions

**Deployment:**

- Single command deployment via Wrangler CLI
- Environment-based configuration (dev, staging, prod)
- Infrastructure as code (wrangler.toml)
- Zero-downtime deployments via Workers versioning

**Code Quality:**

- TypeScript with strict mode enabled
- Consistent code style (ESLint + Prettier)
- Clear separation of concerns (Workers, utilities, types)
- Minimal external dependencies (leverage Cloudflare platform)

### NFR-7: Maintainability

**Code Organization:**

- Monorepo structure with logical separation
- Shared types and utilities across Workers
- Clear naming conventions
- Comprehensive inline documentation

**Configuration Management:**

- Environment variables for secrets (API keys, DB credentials)
- wrangler.toml for infrastructure configuration
- Feature flags for gradual rollouts (growth feature)

**Testing Strategy:**

- Light unit testing for critical validation logic
- Debug flags serve as integration tests
- Manual verification via UI-driven scenarios
- System reliability proven through error demonstrations

**Version Control:**

- Git for source control
- Semantic versioning
- Clear commit messages
- Branch strategy (main, develop, feature branches)

---

## Implementation Planning

### Development Approach

**Incremental Development:** The application will be built in working increments from Epic 1 onwards. Each epic delivers a deployable, testable slice of functionality while maintaining system stability.

**Quality Assurance:** Debug flags serve as the primary quality indicators during development. Light unit testing for critical validation logic, with system reliability proven through UI-driven debug scenarios.

**Platform Showcase:** Full utilization of Cloudflare Developer Platform (Workers, Queues, Workflows, D1, KV, Tail Workers, RPC) demonstrated through the demo UI.

### Epic Breakdown

**Project Track:** BMad Method - Greenfield

The implementation is organized into **6 focused epics**, each delivering a complete, working increment of functionality. Stories are kept lean (3-5 per epic) to maintain development momentum.

---

#### **Epic 1: Foundation & Event Ingestion + UI Skeleton**

*Deploy a working event ingestion API with visible UI*

**Goal:** Basic Cloudflare Workers monorepo with POST /events endpoint that accepts events and queues them for processing. UI skeleton at root shows system is live.

**Deliverables:**

- Monorepo structure with TypeScript + Wrangler
- API Worker serving POST /events
- Queue integration (events sent to queue)
- Basic auth (Bearer token validation via KV)
- Structured error responses
- **UI at root (/) showing "System Live" + basic event submission form**
- Deployable to Cloudflare edge

**Stories:**

1. Project setup: Monorepo, TypeScript, Wrangler config, D1/KV/Queue bindings
2. API Worker: POST /events endpoint with request validation
3. Auth middleware: Bearer token validation via KV lookup
4. Queue integration: Send validated events to Cloudflare Queue
5. Error handling: Structured error responses (400, 401, 503)
6. **UI skeleton: HTML/CSS dashboard at root with event submission form**

**Working State After Epic 1:** Can POST events via API or UI form, they're authenticated and queued. Visual confirmation system is working.

---

#### **Epic 2: Event Processing & Storage + Metrics Display**

*Guaranteed durable event processing with visible metrics*

**Goal:** Queue Consumer Worker processes batches using Workflows, stores events in D1, updates KV metrics. UI displays real-time event counts.

**Deliverables:**

- D1 database schema for events
- Queue Consumer Worker with batch processing
- Workflow orchestration (validate → store → update metrics)
- KV metrics (event counts by status)
- Dead Letter Queue configuration
- **UI metrics panel: Real-time event counts, queue stats**

**Stories:**

1. D1 schema: Create events table with proper indexes
2. Queue Consumer Worker: Consume batches, extract events
3. Workflow implementation: Multi-step orchestration with retries
4. Event storage: Write to D1 with status tracking
5. Metrics updates: KV aggregate counters, DLQ routing
6. **UI metrics: Display event counts by status, auto-refresh**

**Working State After Epic 2:** Events flow from queue → workflow → D1 storage, metrics tracked, failures route to DLQ. **UI shows live event statistics.**

---

#### **Epic 3: Event Retrieval & Management + Inbox UI**

*Query and manage events via API and UI*

**Goal:** GET /inbox with filtering, POST ack/retry endpoints for event management. UI displays event inbox with actions.

**Deliverables:**

- GET /inbox endpoint with D1 queries
- Filtering (status, timestamp range)
- Pagination (limit, offset)
- POST /inbox/{id}/ack - delete events
- POST /inbox/{id}/retry - requeue failed events
- **UI inbox interface: Browse events, view details, ack/retry buttons**

**Stories:**

1. Inbox query endpoint: GET /inbox with D1 query builder
2. Filtering & pagination: Query params, SQL WHERE clauses, limits
3. Acknowledgment endpoint: DELETE from D1, update KV metrics
4. Retry endpoint: Validate status, repost to queue, increment retry_count
5. **UI inbox: Event list, filters, detail view, action buttons**

**Working State After Epic 3:** Full CRUD capability - ingest, retrieve, acknowledge, retry events via API. **UI provides full event management interface.**

---

#### **Epic 4: Observability & Tail Worker Logs Display**

*Make the invisible visible with live logging*

**Goal:** Tail Worker captures all execution data, metrics dashboard backend, comprehensive logging. UI displays live logs and enhanced metrics.

**Deliverables:**

- Tail Worker implementation
- Log capture (requests, responses, errors, timing)
- Log storage (D1 or KV)
- Metrics calculation (latency percentiles, error rates)
- **UI live logs panel: Stream logs, error highlighting, filtering**
- **UI enhanced metrics: Latency charts, error rates, queue depth**

**Stories:**

1. Tail Worker setup: Capture all Worker executions
2. Log processing: Parse and store request/response/error data
3. Metrics calculation: Latency percentiles, error rates, queue depth
4. **UI logs display: Live tail logs streaming, error highlighting**
5. **UI metrics enhancement: Charts for latency/errors, visual indicators**

**Working State After Epic 4:** Full observability - every request logged, metrics calculated. **UI shows live execution visibility and performance metrics.**

---

#### **Epic 5: Debug Control Panel + UI Polish**

*Complete interactive testing interface*

**Goal:** Add debug control panel for error pathway testing. Polish UI with better visuals and UX.

**Deliverables:**

- Debug control panel with all 4 debug flags
- Visual feedback for debug operations
- UI polish (better layout, colors, responsiveness)
- Event flow visualization
- Mock Zapier data generator

**Stories:**

1. **Debug control panel: UI for triggering all debug flags (validation_error, processing_error, queue_delay, dlq_routing)**
2. **Visual feedback: Success/error toasts, loading states, status indicators**
3. **Event flow viz: Simple diagram showing ingestion → queue → workflow → storage**
4. **UI polish: Improved layout, color scheme, responsive design**
5. **Mock data: Zapier event templates, one-click sample generation**

**Working State After Epic 5:** Complete demo interface with interactive debug controls. **UI showcases all error pathways and system behavior.**

---

#### **Epic 6: Performance Testing + Final Polish**

*Production-ready showcase with documentation*

**Goal:** Performance testing capabilities, comprehensive documentation, final code polish.

**Deliverables:**

- Performance testing mode (load simulation, latency injection)
- Comprehensive API documentation
- Setup and deployment guide
- Architecture documentation
- Code optimization and cleanup
- Final edge case handling

**Stories:**

1. **Performance testing: Load simulation UI, latency injection controls, metrics capture**
2. **API documentation: Endpoint specs, examples, error codes, authentication guide**
3. **Setup documentation: Local dev guide, deployment steps, Cloudflare config**
4. **Architecture docs: System diagram, data flow, component descriptions**
5. **Final polish: Code review, optimization, edge cases, production readiness**

**Working State After Epic 6:** Production-ready showcase with comprehensive testing, documentation, and polish. **Ready for demo submission.**

---

### Epic Sizing Summary

| Epic | Stories | UI Progress | Complexity | Duration Est. |
|------|---------|-------------|------------|---------------|
| Epic 1 | 6 | Skeleton + Submit Form | Medium | 2-3 days |
| Epic 2 | 6 | + Live Metrics | High | 3-4 days |
| Epic 3 | 5 | + Event Inbox | Medium | 2-3 days |
| Epic 4 | 5 | + Live Logs + Charts | Medium | 3-4 days |
| Epic 5 | 5 | + Debug Panel + Polish | Medium | 2-3 days |
| Epic 6 | 5 | + Perf Testing + Docs | Low-Medium | 2-3 days |
| **Total** | **32 stories** | **Complete Showcase** | **Mixed** | **14-20 days** |

**UI Evolution:** The dashboard grows with each epic, providing visible progress throughout development. By Epic 3, the core demo is functional. Epics 4-6 add observability, debugging, and polish.

**Note:** Each epic delivers working, deployable functionality. Development proceeds one epic at a time with full completion before moving to the next.

**Next Step:** Run `workflow create-architecture` to define technical architecture, then begin Epic 1 implementation.

---

## References

- **Cloudflare Docs:** <https://developers.cloudflare.com/>

---

## PRD Summary

### What We're Building

A **unified, real-time event ingestion API** for Zapier that transforms fragmented, integration-specific triggers into a centralized, edge-native event platform. Built on Cloudflare's Developer Platform to showcase advanced backend engineering and modern serverless architecture.

### The Magic

**Edge-native performance** with sub-100ms latency globally, **guaranteed durability** with zero data loss, **built-in observability** via Tail Workers, and **comprehensive debug capabilities** - all demonstrated through an interactive UI dashboard that makes the invisible visible.

### Strategic Impact

This API provides a blueprint for modernizing Zapier's entire trigger infrastructure, enabling next-generation agentic workflows and event-driven automation at scale.

### Technical Highlights

- **4 API Endpoints:** Event ingestion, inbox retrieval, acknowledgment, retry
- **Full Platform Utilization:** Workers, Queues, Workflows, D1, KV, Tail Workers, RPC
- **Demo UI:** Real-time dashboard, debug control panel, event inbox, live tail logs
- **Zero Infrastructure:** Edge-native with auto-scaling, zero config required
- **TypeScript Monorepo:** Clean architecture with clear separation of concerns

### Requirements Coverage

- **7 Functional Requirement Groups** (FR-1 to FR-7)
- **7 Non-Functional Requirement Categories** (NFR-1 to NFR-7)
- **MVP + Growth + Vision** scope clearly defined
- **Success criteria** aligned with showcase objectives

---

## Next Steps

1. **Epic & Story Breakdown** - Run: `workflow create-epics-and-stories`
2. **Architecture** - Run: `workflow create-architecture`
3. **Implementation** - Run: `workflow dev-story` for each story

---

*This PRD captures the essence of TriggersAPI: A showcase of edge-native event ingestion with guaranteed durability, comprehensive observability, and debug-first development - built to demonstrate mastery of Cloudflare's Developer Platform and modern backend architecture.*

*Created through collaborative discovery between Adam and AI Product Manager.*
