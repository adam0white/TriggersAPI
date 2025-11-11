# TriggersAPI

Edge-native event ingestion and management API built on Cloudflare Workers. Provides high-performance event capture, queueing, processing, and retrieval with built-in observability.

## Overview

TriggersAPI is a serverless event management system that leverages Cloudflare's global edge network to provide:

- **Fast Event Ingestion**: Accept and queue events with <100ms latency worldwide
- **Reliable Processing**: Durable workflows with automatic retries and dead-letter queue
- **Event Retrieval**: Query and manage captured events via REST API
- **Real-time Dashboard**: Monitor metrics, view logs, and manage events
- **Debug Mode**: Built-in debugging capabilities for development and testing

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **pnpm**
- **Cloudflare Account** (free tier sufficient) - [Sign up here](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI** (installed via this project)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Create Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create triggers-api
# Copy the database_id from output and update wrangler.toml

# Create KV namespace for auth tokens
npx wrangler kv:namespace create "AUTH_KV"
# Copy the id from output and update wrangler.toml
```

### 4. Run Locally

```bash
npm run dev
# Server starts at http://localhost:8787
```

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

## Project Structure

```
triggers-api/
├── src/
│   ├── index.ts              # Main Worker entry point
│   ├── routes/               # API route handlers
│   │   ├── events.ts         # POST /events - Event ingestion
│   │   ├── inbox.ts          # GET /inbox - Event retrieval
│   │   └── dashboard.ts      # GET / - Dashboard UI
│   ├── queue/                # Queue consumer logic
│   │   └── consumer.ts       # Batch event processing
│   ├── workflows/            # Durable workflow definitions
│   │   └── process-event.ts  # Event validation, storage, metrics
│   ├── tail/                 # Observability
│   │   └── worker.ts         # Log and metric capture
│   ├── middleware/           # Request middleware
│   │   ├── auth.ts           # Bearer token validation
│   │   ├── error-handler.ts  # Structured error responses
│   │   └── logger.ts         # Structured logging
│   ├── db/                   # Database layer
│   │   ├── schema.sql        # D1 table definitions
│   │   └── queries.ts        # SQL query functions
│   ├── lib/                  # Shared utilities
│   │   ├── validation.ts     # Request validation
│   │   ├── metrics.ts        # KV metrics helpers
│   │   └── debug.ts          # Debug flag handlers
│   ├── types/                # TypeScript definitions
│   │   ├── events.ts         # Event types
│   │   ├── api.ts            # API types
│   │   └── env.ts            # Environment bindings
│   └── ui/                   # Dashboard (React + shadcn)
│       ├── components/       # UI components
│       └── lib/              # UI utilities
├── test/                     # Test files
├── docs/                     # Documentation
├── wrangler.toml             # Cloudflare configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run test` - Run tests with Vitest
- `npm run cf-typegen` - Regenerate TypeScript types from wrangler.toml

## Configuration

### wrangler.toml

The main configuration file defines all Cloudflare bindings:

- **D1 Database**: SQLite database for event storage
- **KV Namespace**: Key-value store for auth tokens and metrics
- **Queue**: Event processing queue with batching and retries
- **Workflow**: Durable execution for event processing

### Environment Variables

See `.env.example` for required environment variables:

- `AUTH_TOKEN_*`: Bearer tokens for API authentication
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)
- `ENVIRONMENT`: Current environment (development, staging, production)

## API Endpoints

### Event Ingestion

```bash
POST /events
Authorization: Bearer <token>
Content-Type: application/json

{
  "payload": {
    "event_type": "user.signup",
    "user_id": "123"
  },
  "metadata": {
    "source": "web"
  }
}
```

### Event Retrieval

```bash
GET /inbox?status=pending&limit=50
Authorization: Bearer <token>
```

### Dashboard

```bash
GET /
# Serves interactive dashboard UI
```

## Development Workflow

### 1. Local Development

```bash
npm run dev
# Wrangler starts with local bindings
# D1 uses local SQLite file
# KV uses local storage
# Queue uses local simulation
```

### 2. Testing

```bash
npm run test
# Runs Vitest test suite
```

### 3. Type Generation

```bash
npm run cf-typegen
# Regenerates worker-configuration.d.ts from wrangler.toml
# Run after modifying bindings
```

### 4. Deployment

```bash
npm run deploy
# Deploys to Cloudflare's global network
# Resources (D1, KV, Queue) provisioned automatically
```

## Architecture

TriggersAPI uses a **single Worker deployment** with multiple function handlers:

- **fetch()**: Handles HTTP requests (API routes, dashboard)
- **queue()**: Processes batched events from Queue
- **tail()**: Captures logs and metrics for observability

### Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Language**: TypeScript (strict mode)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Cache**: Cloudflare KV (distributed key-value)
- **Queue**: Cloudflare Queues (message queue)
- **Workflows**: Cloudflare Workflows (durable execution)
- **UI**: React + shadcn + Tailwind CSS

### Key Features

- **Edge-Native**: Runs at 300+ global locations
- **Auto-Scaling**: Handles 0 to millions of requests
- **Zero Configuration**: No servers, databases, or infrastructure to manage
- **Durable Processing**: Guaranteed event processing with retries
- **Built-in Observability**: Automatic log and metric capture

## Debug Mode

TriggersAPI supports debug flags for testing error scenarios:

```bash
POST /events?debug=validation_error
# Returns 400 with sample validation error

POST /events?debug=processing_error
# Returns 500 after queuing event

POST /events?debug=queue_delay
# Injects 2-second artificial delay

POST /events?debug=dlq_routing
# Forces event to Dead Letter Queue
```

## Security

- **HTTPS Only**: TLS 1.2+ enforced by Cloudflare
- **Bearer Token Auth**: Tokens validated against KV store
- **Input Validation**: All payloads validated before processing
- **1MB Size Limit**: Protects against large payload attacks
- **No Sensitive Logging**: Tokens and PII sanitized in logs

## Performance

- **Event Ingestion**: <100ms p95 latency globally
- **Database Queries**: Indexed for fast retrieval
- **Metrics**: Served from KV cache (eventual consistency)
- **Queue Batching**: Up to 100 events per batch

## Deployment Environments

Configure multiple environments in wrangler.toml:

```toml
[env.staging]
# Staging-specific configuration

[env.production]
# Production-specific configuration
```

Deploy to specific environment:

```bash
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and commit: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

## Documentation

- [PRD](../docs/PRD.md) - Product Requirements Document
- [Architecture](../docs/architecture.md) - Technical Architecture
- [API Documentation](../docs/api.md) - API Reference

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Cloudflare Queues Docs](https://developers.cloudflare.com/queues/)
- [Cloudflare Workflows Docs](https://developers.cloudflare.com/workflows/)

## License

MIT

---

Built with Cloudflare Workers | Deployed on the Edge
