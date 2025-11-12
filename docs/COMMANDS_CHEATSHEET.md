# TriggersAPI - Commands Cheat Sheet

Quick reference for common commands used in development, testing, and deployment.

## Table of Contents

- [Setup & Installation](#setup--installation)
- [Local Development](#local-development)
- [Database (D1)](#database-d1)
- [KV Storage](#kv-storage)
- [Queues](#queues)
- [Authentication](#authentication)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring & Logs](#monitoring--logs)
- [Git Workflow](#git-workflow)

---

## Setup & Installation

### Install Node.js Dependencies
```bash
npm install
```

### Install Wrangler CLI Globally
```bash
npm install -g wrangler
```

### Update Wrangler
```bash
npm update -g wrangler
```

### Check Versions
```bash
node --version
npm --version
wrangler --version
```

### Cloudflare Authentication
```bash
# Login (opens browser)
wrangler login

# Check login status
wrangler whoami

# Logout
wrangler logout
```

---

## Local Development

### Start Development Server
```bash
npm run dev
# or
wrangler dev
```

### Start with Persistent Storage
```bash
wrangler dev --persist
```

### Start on Different Port
```bash
wrangler dev --port 8788
```

### Start with Remote Bindings
```bash
wrangler dev --remote
```

### Stop Development Server
Press `Ctrl + C` in terminal

### Clear Local Cache
```bash
rm -rf .wrangler
```

---

## Database (D1)

### Create Database
```bash
wrangler d1 create triggers-api
```

### List Databases
```bash
wrangler d1 list
```

### Apply Schema (Local)
```bash
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

### Apply Schema (Production)
```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

### Run Query (Local)
```bash
wrangler d1 execute triggers-api --local --command "SELECT * FROM events LIMIT 10;"
```

### Run Query (Production)
```bash
wrangler d1 execute triggers-api --remote --command "SELECT * FROM events LIMIT 10;"
```

### Count Events
```bash
wrangler d1 execute triggers-api --local --command "SELECT COUNT(*) FROM events;"
```

### Check Tables
```bash
wrangler d1 execute triggers-api --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Backup Database
```bash
wrangler d1 export triggers-api --remote --output backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
wrangler d1 execute triggers-api --remote --file backup-20251111.sql
```

### Delete Database
```bash
wrangler d1 delete triggers-api
```

---

## KV Storage

### Create KV Namespace
```bash
wrangler kv:namespace create "AUTH_KV"
wrangler kv:namespace create "METRICS_KV"
```

### Create Preview Namespace
```bash
wrangler kv:namespace create "AUTH_KV" --preview
```

### List Namespaces
```bash
wrangler kv:namespace list
```

### Set Key (Local)
```bash
wrangler kv:key put --binding=AUTH_KV "key-name" "value" --local
```

### Set Key (Production)
```bash
wrangler kv:key put --binding=AUTH_KV "key-name" "value"
```

### Get Key (Local)
```bash
wrangler kv:key get --binding=AUTH_KV "key-name" --local
```

### Get Key (Production)
```bash
wrangler kv:key get --binding=AUTH_KV "key-name"
```

### List Keys
```bash
wrangler kv:key list --binding=AUTH_KV
```

### Delete Key
```bash
wrangler kv:key delete --binding=AUTH_KV "key-name"
```

### Bulk Import
```bash
wrangler kv:bulk put --binding=AUTH_KV ./data.json
```

### Delete Namespace
```bash
wrangler kv:namespace delete --binding=AUTH_KV
```

---

## Queues

### Create Queue
```bash
wrangler queues create event-queue
```

### Create Dead Letter Queue
```bash
wrangler queues create event-dlq
```

### List Queues
```bash
wrangler queues list
```

### Get Queue Info
```bash
wrangler queues consumer get event-queue
```

### Delete Queue
```bash
wrangler queues delete event-queue
```

---

## Authentication

### Generate Test Token
```bash
TOKEN="sk-test-$(openssl rand -hex 32)"
echo $TOKEN
```

### Store Token in KV (Local)
```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-test-123..." "valid" --local
```

### Store Token in KV (Production)
```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-live-123..." "valid"
```

### Verify Token
```bash
wrangler kv:key get --binding=AUTH_KV "auth:sk-test-123..." --local
```

---

## Testing

### Run All Tests
```bash
npm run test
```

### Run Tests in Watch Mode
```bash
npm run test -- --watch
```

### Run Specific Test File
```bash
npm run test -- test/events.test.ts
```

### Run Tests with Coverage
```bash
npm run test -- --coverage
```

### Type Check
```bash
npx tsc --noEmit
```

### Lint Code
```bash
npx eslint src/
```

### Format Code
```bash
npx prettier --write src/
```

---

## Deployment

### Deploy to Production
```bash
npm run deploy
# or
wrangler deploy
```

### Deploy to Staging
```bash
wrangler deploy --env staging
```

### Deploy Specific Environment
```bash
wrangler deploy --env production
```

### Force Deploy (Skip Cache)
```bash
wrangler deploy --force
```

### Dry Run (Test Deploy)
```bash
wrangler deploy --dry-run
```

### List Deployments
```bash
wrangler deployments list
```

### Rollback Deployment
```bash
wrangler rollback
```

### Rollback to Specific Version
```bash
wrangler rollback <deployment-id>
```

---

## Monitoring & Logs

### View Live Logs (Local)
```bash
wrangler tail --local
```

### View Live Logs (Production)
```bash
wrangler tail
```

### View Logs for Specific Environment
```bash
wrangler tail --env production
```

### Filter Logs
```bash
wrangler tail --status error
```

### View Logs with Timestamp
```bash
wrangler tail --format pretty
```

### View Deployments
```bash
wrangler deployments list
```

### View Worker Status
```bash
wrangler deployments status
```

---

## API Testing

### Health Check
```bash
curl http://localhost:8787/health
```

### Create Event (POST /events)
```bash
curl -X POST http://localhost:8787/events \
  -H "Authorization: Bearer sk-test-123..." \
  -H "Content-Type: application/json" \
  -d '{"payload": {"test": "data"}}'
```

### Get Inbox (GET /inbox)
```bash
curl http://localhost:8787/inbox?status=pending \
  -H "Authorization: Bearer sk-test-123..."
```

### Get Inbox with Pagination
```bash
curl "http://localhost:8787/inbox?status=pending&limit=50&offset=0" \
  -H "Authorization: Bearer sk-test-123..."
```

### Acknowledge Event (POST /inbox/:id/ack)
```bash
curl -X POST http://localhost:8787/inbox/evt_123/ack \
  -H "Authorization: Bearer sk-test-123..."
```

### Retry Event (POST /inbox/:id/retry)
```bash
curl -X POST http://localhost:8787/inbox/evt_123/retry \
  -H "Authorization: Bearer sk-test-123..."
```

### Test with Debug Flags
```bash
curl -X POST http://localhost:8787/events?debug=workflow_fail \
  -H "Authorization: Bearer sk-test-123..." \
  -H "Content-Type: application/json" \
  -d '{"payload": {"test": "data"}}'
```

---

## Git Workflow

### Clone Repository
```bash
git clone <repo-url>
cd triggers-api
```

### Check Status
```bash
git status
```

### Create Branch
```bash
git checkout -b feature/new-feature
```

### Stage Changes
```bash
git add .
```

### Commit Changes
```bash
git commit -m "feat: add new feature"
```

### Push to Remote
```bash
git push origin feature/new-feature
```

### Pull Latest Changes
```bash
git pull origin main
```

### Merge Branch
```bash
git checkout main
git merge feature/new-feature
```

### View Commit History
```bash
git log --oneline
```

---

## Troubleshooting Commands

### Kill Process on Port 8787
```bash
# macOS/Linux
lsof -ti:8787 | xargs kill -9

# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8787).OwningProcess | Stop-Process
```

### Clear Node Modules
```bash
rm -rf node_modules package-lock.json
npm install
```

### Clear Wrangler Cache
```bash
rm -rf .wrangler
```

### Regenerate Cloudflare Types
```bash
npm run cf-typegen
```

### Check TypeScript Errors
```bash
npx tsc --noEmit
```

### Update All Dependencies
```bash
npm update
```

---

## Environment Variables

### Set Secret
```bash
wrangler secret put API_SECRET
# Enter value when prompted
```

### List Secrets
```bash
wrangler secret list
```

### Delete Secret
```bash
wrangler secret delete API_SECRET
```

---

## Useful Aliases (Add to .bashrc or .zshrc)

```bash
# Aliases for common commands
alias wd="wrangler dev"
alias wdp="wrangler deploy"
alias wt="wrangler tail"
alias wtl="wrangler tail --local"
alias d1="wrangler d1"
alias kv="wrangler kv:key"

# D1 shortcuts
alias d1l="wrangler d1 execute triggers-api --local --command"
alias d1r="wrangler d1 execute triggers-api --remote --command"

# Testing shortcuts
alias test="npm run test"
alias tc="npx tsc --noEmit"

# Git shortcuts
alias gs="git status"
alias ga="git add ."
alias gc="git commit -m"
alias gp="git push"
```

---

## Quick Start Sequence

**Initial Setup:**
```bash
npm install
wrangler login
wrangler d1 create triggers-api
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
wrangler kv:namespace create "AUTH_KV"
wrangler kv:namespace create "METRICS_KV"
# Update wrangler.toml with IDs
wrangler dev
```

**Daily Development:**
```bash
git pull origin main
npm install  # If package.json changed
wrangler dev
# Make changes
npm run test
git add .
git commit -m "feat: description"
git push
```

**Deploy to Production:**
```bash
npm run test
npx tsc --noEmit
git push origin main
wrangler deploy
wrangler tail  # Monitor deployment
```

---

## Additional Resources

- **Full Setup:** [SETUP.md](./SETUP.md)
- **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **API Docs:** [API.md](./API.md)
- **Architecture:** [architecture.md](./architecture.md)

---

**Bookmark this page** for quick reference during development!
