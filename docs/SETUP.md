# TriggersAPI - Local Development Setup Guide

Complete guide for setting up TriggersAPI locally, including prerequisites, environment configuration, and initial testing.

## Table of Contents

- [Prerequisites & Requirements](#prerequisites--requirements)
- [System Requirements](#system-requirements)
- [Software Installation](#software-installation)
- [Cloudflare Account Setup](#cloudflare-account-setup)
- [Pre-Setup Checklist](#pre-setup-checklist)
- [Initial Project Setup](#initial-project-setup)
- [Environment Configuration](#environment-configuration)
- [Dependency Installation](#dependency-installation)
- [Database Setup (D1)](#database-setup-d1)
- [KV Namespace Setup](#kv-namespace-setup)
- [Queue Configuration](#queue-configuration)
- [Workflow Configuration](#workflow-configuration)
- [Tail Worker Setup](#tail-worker-setup)
- [Bearer Token Setup](#bearer-token-setup)
- [Starting Local Development Server](#starting-local-development-server)
- [Testing Your Setup](#testing-your-setup)
- [Common Development Workflows](#common-development-workflows)
- [Next Steps](#next-steps)

---

## Prerequisites & Requirements

### System Requirements

**Minimum Requirements:**
- Operating System: macOS 10.15+, Ubuntu 20.04+, or Windows 10+ with WSL2
- Node.js: 18.0.0 or higher (LTS recommended)
- npm: 9.0.0 or higher
- Disk Space: 2GB free minimum
- Internet Connection: Required for initial setup and API access
- Cloudflare Account: Free tier sufficient for development

**Recommended Setup:**
- Node.js: 20.x LTS
- npm: 10.x
- Code Editor: VS Code with extensions (TypeScript, Prettier, ESLint)
- Terminal: iTerm2 (macOS), Windows Terminal (Windows), or any modern terminal

---

## Software Installation

### 1. Install Node.js and npm

**macOS (via Homebrew):**
```bash
brew install node@20
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows (via installer):**
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer (choose LTS version)
3. Restart terminal after installation

**Verify Installation:**
```bash
node --version  # Should show v18.0.0 or higher
npm --version   # Should show 9.0.0 or higher
```

### 2. Install Wrangler CLI

Wrangler is Cloudflare's official CLI tool for managing Workers.

```bash
npm install -g wrangler
```

**Verify Installation:**
```bash
wrangler --version
```

Expected output: `wrangler 4.x.x` or higher

### 3. Install Git (Optional but Recommended)

**macOS:**
```bash
brew install git
```

**Ubuntu/Debian:**
```bash
sudo apt-get install git
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/)

---

## Cloudflare Account Setup

### 1. Create Cloudflare Account

1. Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Sign up with email (free tier is sufficient)
3. Verify your email address

### 2. Obtain API Token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template
5. Configure permissions:
   - Account Settings: Read
   - User Details: Read
   - Workers Scripts: Edit
   - Workers KV Storage: Edit
   - Workers Tail: Read
   - D1: Edit
6. Click **Continue to Summary** → **Create Token**
7. **Copy and save the token** (you won't see it again)

### 3. Find Your Account ID

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Look for **Account ID** on the right sidebar
3. Copy and save this ID

---

## Pre-Setup Checklist

Before proceeding, verify you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] Wrangler CLI installed (`wrangler --version`)
- [ ] Cloudflare account created
- [ ] Cloudflare API token obtained
- [ ] Cloudflare Account ID obtained
- [ ] Git installed (optional)
- [ ] Code editor installed (VS Code recommended)

---

## Initial Project Setup

### 1. Clone or Create Project

**If cloning from repository:**
```bash
git clone <repository-url>
cd triggers-api
```

**If starting from scratch:**
```bash
mkdir triggers-api
cd triggers-api
npm init -y
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `wrangler` - Cloudflare Workers CLI
- `typescript` - TypeScript compiler
- `@cloudflare/workers-types` - TypeScript types for Workers
- `@cloudflare/vitest-pool-workers` - Testing framework
- `eslint`, `prettier` - Code quality tools
- Additional dependencies for UI and testing

**Verify Installation:**
```bash
ls node_modules/ | wc -l  # Should show many packages
```

---

## Environment Configuration

### 1. Create Local Environment File

Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Edit `.env` File

Open `.env` in your editor and configure:

```bash
# TriggersAPI Environment Configuration

# Authentication
# Create test Bearer tokens (minimum 32 characters)
AUTH_TOKEN_1=sk-test-1234567890abcdefghijklmnopqrstuvwxyz

# Service Configuration
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Environment: development, staging, production
ENVIRONMENT=development
```

**Important:** Never commit `.env` to version control. It's already in `.gitignore`.

### 3. Configure wrangler.toml

The `wrangler.toml` file is the main configuration for Cloudflare Workers.

**Key configuration sections:**

```toml
name = "triggers-api"
main = "src/index.ts"
compatibility_date = "2025-11-11"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true
```

You'll update this file with resource IDs as you create them.

---

## Database Setup (D1)

D1 is Cloudflare's SQL database. You need to create a database and apply the schema.

### 1. Create D1 Database

```bash
wrangler d1 create triggers-api
```

**Output:**
```
✅ Successfully created DB 'triggers-api'

[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. Update wrangler.toml

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "your-database-id-here"  # Replace with actual ID
migrations_dir = "src/db/migrations"
```

### 3. Apply Database Schema

The schema file is located at `src/db/schema.sql`.

**Apply locally (for development):**
```bash
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

**Apply to remote (for production):**
```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

### 4. Verify Schema Applied

**Query the database locally:**
```bash
wrangler d1 execute triggers-api --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected output should show `events` table.

### 5. Schema Overview

The `events` table structure:
```sql
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  payload JSON NOT NULL,
  metadata JSON,
  status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0
);
```

**Indexes for performance:**
- `idx_events_status` - Filter by status
- `idx_events_created_at` - Filter by timestamp
- `idx_events_status_created` - Combined status + timestamp queries

---

## KV Namespace Setup

KV (Key-Value) storage is used for authentication tokens and metrics.

### 1. Create KV Namespaces

**Create AUTH KV namespace:**
```bash
wrangler kv:namespace create "AUTH_KV"
```

Output:
```
🌀 Creating namespace with title "triggers-api-AUTH_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "AUTH_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

**Create METRICS KV namespace:**
```bash
wrangler kv:namespace create "METRICS_KV"
```

### 2. Create Preview Namespaces (Optional)

For local development with preview:
```bash
wrangler kv:namespace create "AUTH_KV" --preview
wrangler kv:namespace create "METRICS_KV" --preview
```

### 3. Update wrangler.toml

Add the namespace IDs to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-auth-kv-id-here"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "your-metrics-kv-id-here"
```

### 4. Populate Test Authentication Token

Add a test Bearer token to AUTH_KV:

```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-test-1234567890abcdefghijklmnopqrstuvwxyz" "valid" --local
```

**Verify:**
```bash
wrangler kv:key get --binding=AUTH_KV "auth:sk-test-1234567890abcdefghijklmnopqrstuvwxyz" --local
```

Expected output: `valid`

---

## Queue Configuration

Queues handle asynchronous event processing with automatic retries.

### 1. Create Event Queue

```bash
wrangler queues create event-queue
```

### 2. Create Dead Letter Queue (DLQ)

```bash
wrangler queues create event-dlq
```

The DLQ stores messages that fail after max retries.

### 3. Verify wrangler.toml Configuration

Your `wrangler.toml` should have:

```toml
[[queues.producers]]
binding = "EVENT_QUEUE"
queue = "event-queue"

[[queues.consumers]]
queue = "event-queue"
max_batch_size = 100
max_batch_timeout = 1
max_retries = 3
dead_letter_queue = "event-dlq"
max_concurrency = 10
```

**Configuration explanation:**
- `max_batch_size: 100` - Process up to 100 messages per batch
- `max_batch_timeout: 1` - Wait max 1 second before processing batch
- `max_retries: 3` - Retry failed messages 3 times before DLQ
- `max_concurrency: 10` - Process up to 10 batches concurrently

### 4. Local Queue Behavior

In local development (`wrangler dev`), queues work but messages are processed immediately rather than batched.

---

## Workflow Configuration

Workflows provide durable execution with automatic retries and state management.

### 1. Verify Workflow Binding

Your `wrangler.toml` should have:

```toml
[[workflows]]
binding = "PROCESS_EVENT_WORKFLOW"
name = "process-event-workflow"
class_name = "ProcessEventWorkflow"
script_name = "triggers-api"
```

### 2. Workflow Definition

The workflow is defined in `src/workflows/process-event-workflow.ts`.

**Workflow steps:**
1. Validate event payload
2. Store event in D1 database
3. Update metrics in KV

Each step is retried automatically on failure.

### 3. Local Workflow Execution

Workflows run in local development but without full durability guarantees.

---

## Tail Worker Setup

Tail Workers capture logs and observability data from your Worker.

### 1. Verify Tail Configuration

Your `wrangler.toml` should have:

```toml
[[tail_consumers]]
service = "triggers-api"
```

### 2. Enable Observability

```toml
[observability]
enabled = true
```

### 3. View Logs Locally

In a separate terminal, run:
```bash
wrangler tail --local
```

Or for remote (after deployment):
```bash
wrangler tail
```

You'll see real-time logs including:
- Request/response data
- Console logs
- Errors and exceptions
- Performance metrics

---

## Bearer Token Setup

### 1. Generate Test Token

Create a test Bearer token (minimum 32 characters):

```bash
# Example format: sk-test-{random-string}
AUTH_TOKEN=sk-test-1234567890abcdefghijklmnopqrstuvwxyz
```

### 2. Add to Environment

Update your `.env` file:
```bash
AUTH_TOKEN_1=sk-test-1234567890abcdefghijklmnopqrstuvwxyz
```

### 3. Store in KV

```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-test-1234567890abcdefghijklmnopqrstuvwxyz" "valid" --local
```

### 4. Use in API Requests

Include in Authorization header:
```bash
Authorization: Bearer sk-test-1234567890abcdefghijklmnopqrstuvwxyz
```

---

## Starting Local Development Server

### 1. Start Wrangler Dev Server

```bash
npm run dev
```

Or directly:
```bash
wrangler dev
```

**Expected output:**
```
⛅️ wrangler 4.x.x
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 2. Access the Application

**API Endpoints:**
- Base URL: `http://localhost:8787`
- Health check: `http://localhost:8787/health`

**Dashboard UI:**
- Dashboard: `http://localhost:8787/`
- Debug Control Panel: `http://localhost:8787/debug`

**API Documentation:**
- Swagger UI: `http://localhost:8787/api/docs`

### 3. Hot Reload

The dev server automatically reloads when you make code changes. You'll see:
```
[wrangler:inf] Detected changes, restarting server...
```

### 4. Stop the Server

Press `Ctrl+C` in the terminal running `wrangler dev`.

---

## Testing Your Setup

### 1. Health Check

Test the API is running:
```bash
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-11T..."
}
```

### 2. Create Test Event

Test POST /events endpoint:
```bash
curl -X POST http://localhost:8787/events \
  -H "Authorization: Bearer sk-test-1234567890abcdefghijklmnopqrstuvwxyz" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "user_id": "test-user-123",
      "action": "test_action",
      "timestamp": "2025-11-11T10:00:00Z"
    }
  }'
```

Expected response (201 Created):
```json
{
  "event_id": "evt_...",
  "status": "pending",
  "created_at": "2025-11-11T..."
}
```

### 3. Query Inbox

Get pending events:
```bash
curl -X GET "http://localhost:8787/inbox?status=pending" \
  -H "Authorization: Bearer sk-test-1234567890abcdefghijklmnopqrstuvwxyz"
```

Expected response (200 OK):
```json
{
  "events": [
    {
      "event_id": "evt_...",
      "payload": {...},
      "status": "pending",
      "created_at": "...",
      "retry_count": 0
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0
  }
}
```

### 4. Acknowledge Event

Mark event as delivered:
```bash
curl -X POST "http://localhost:8787/inbox/{event_id}/ack" \
  -H "Authorization: Bearer sk-test-1234567890abcdefghijklmnopqrstuvwxyz"
```

Expected response (200 OK):
```json
{
  "event_id": "evt_...",
  "status": "delivered",
  "updated_at": "..."
}
```

### 5. Run Unit Tests

```bash
npm run test
```

Expected output:
```
✓ All tests passed
```

### 6. Test Dashboard UI

1. Open `http://localhost:8787` in browser
2. You should see the TriggersAPI Dashboard
3. Try the Debug Control Panel to generate mock events
4. Verify real-time metrics display
5. Check live tail logs

---

## Common Development Workflows

### Typical Development Session

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Make code changes** in `src/` directory

3. **Test changes** via cURL or UI

4. **View logs** in terminal or tail worker

5. **Run tests** before committing:
   ```bash
   npm run test
   ```

### Debugging

**Console logging:**
```typescript
console.log('Debug info:', data);
```

**Chrome DevTools:**
1. Open `chrome://inspect` in Chrome
2. Click "Open dedicated DevTools for Node"
3. Set breakpoints in your code

**VS Code debugger:**
Configure `.vscode/launch.json` for debugging (see IDE docs).

### Project Structure Navigation

```
src/
├── index.ts                  # Main Worker entry point
├── routes/                   # API endpoint handlers
│   ├── events.ts            # POST /events
│   ├── inbox.ts             # GET /inbox
│   ├── ack.ts               # POST /inbox/:id/ack
│   └── retry.ts             # POST /inbox/:id/retry
├── queue/                    # Queue consumer logic
│   └── event-consumer.ts    # Processes events from queue
├── workflows/                # Workflow definitions
│   └── process-event-workflow.ts  # Durable event processing
├── middleware/               # Auth and error handling
│   ├── auth.ts              # Bearer token validation
│   └── error-handler.ts     # Error middleware
├── db/                       # Database
│   ├── schema.sql           # D1 schema
│   ├── queries.ts           # Database queries
│   └── migrations/          # Schema migrations
├── lib/                      # Utility functions
│   ├── logger.ts            # Logging utility
│   └── validators.ts        # Input validation
├── types/                    # TypeScript types
│   └── index.ts             # Type definitions
├── ui/                       # Frontend dashboard
│   └── dashboard.tsx        # React dashboard
└── tail/                     # Tail Worker
    └── tail-consumer.ts     # Log aggregation
```

### TypeScript Configuration

**Type checking:**
```bash
npx tsc --noEmit
```

**Build:**
```bash
npm run build
```

The `tsconfig.json` is configured with:
- `strict: true` - Maximum type safety
- `target: ES2020` - Modern JavaScript features
- Source maps enabled for debugging

---

## Next Steps

1. **Read the [API Documentation](./API.md)** - Understand all endpoints
2. **Read the [Architecture Overview](./architecture.md)** - Understand system design
3. **Try the [Troubleshooting Guide](./TROUBLESHOOTING.md)** - If you hit issues
4. **Deploy to Production** - See [Deployment Guide](./DEPLOYMENT.md)
5. **Set up CI/CD** - Automate testing and deployment

---

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [KV Storage Documentation](https://developers.cloudflare.com/kv/)
- [Queues Documentation](https://developers.cloudflare.com/queues/)
- [Workflows Documentation](https://developers.cloudflare.com/workflows/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

## Getting Help

If you encounter issues:
1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [Cloudflare Community Forums](https://community.cloudflare.com/)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/cloudflare-workers)
4. Open an issue on GitHub (project-specific)

---

**Ready to deploy?** Continue to the [Deployment Guide](./DEPLOYMENT.md).
