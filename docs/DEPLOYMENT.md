# TriggersAPI - Production Deployment Guide

Complete guide for deploying TriggersAPI to Cloudflare Workers, including pre-deployment checklist, deployment process, environment configuration, and post-deployment verification.

## Table of Contents

- [Overview](#overview)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Authentication Setup](#authentication-setup)
- [Production Environment Setup](#production-environment-setup)
- [Database Migration to Production](#database-migration-to-production)
- [KV Namespace Production Setup](#kv-namespace-production-setup)
- [Queue Production Setup](#queue-production-setup)
- [Environment Variables & Secrets](#environment-variables--secrets)
- [Deployment Process](#deployment-process)
- [Environment-Specific Deployment](#environment-specific-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring & Observability](#monitoring--observability)
- [Rollback Procedure](#rollback-procedure)
- [Zero-Downtime Deployments](#zero-downtime-deployments)
- [CI/CD Integration](#cicd-integration)
- [Production Best Practices](#production-best-practices)

---

## Overview

TriggersAPI deploys as a single Cloudflare Worker with multiple bindings to Cloudflare services (D1, KV, Queues, Workflows, Tail Workers). Deployment is managed via the Wrangler CLI.

**Deployment Architecture:**
- Single Worker: `triggers-api`
- D1 Database: `triggers-api` (production)
- KV Namespaces: `AUTH_KV`, `METRICS_KV` (production)
- Queues: `event-queue`, `event-dlq` (production)
- Workflow: `process-event-workflow`
- Tail Worker: Real-time log aggregation

**Deployment Time:** ~2-5 minutes
**Propagation Time:** ~30 seconds globally

---

## Pre-Deployment Checklist

Before deploying, verify all items:

### Code Quality
- [ ] All code committed and pushed to main branch
- [ ] No uncommitted changes (`git status` is clean)
- [ ] All tests passing locally (`npm run test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No linting errors (`npx eslint src/`)
- [ ] Code reviewed and approved (if using PR workflow)

### Environment Configuration
- [ ] Production `wrangler.toml` configured correctly
- [ ] Environment variables set in Cloudflare dashboard
- [ ] Production API tokens generated
- [ ] Secrets configured (if any)

### Database
- [ ] D1 production database created
- [ ] Schema migrations applied to production
- [ ] Database backup taken (if updating existing DB)
- [ ] Indexes verified for performance

### Services
- [ ] Production KV namespaces created
- [ ] Production queues created (event-queue, event-dlq)
- [ ] Workflow binding configured
- [ ] Tail Worker enabled for production

### Testing
- [ ] All endpoints tested locally
- [ ] UI tested and functional
- [ ] Integration tests passing
- [ ] Load testing completed (if applicable)

### Documentation
- [ ] API documentation up to date
- [ ] Deployment notes prepared
- [ ] Rollback procedure reviewed
- [ ] On-call engineer notified (if applicable)

### Monitoring
- [ ] Alerting configured
- [ ] Metrics dashboard accessible
- [ ] Log aggregation verified
- [ ] Error tracking enabled

---

## Authentication Setup

### 1. Log In to Wrangler

```bash
wrangler login
```

This opens a browser for Cloudflare authentication.

### 2. Verify Authentication

```bash
wrangler whoami
```

**Expected output:**
```
You are logged in with an OAuth Token, associated with the email <your-email>.
Account Name: <Your Account>
Account ID: <your-account-id>
```

### 3. Confirm Correct Account

If you have multiple Cloudflare accounts, verify you're deploying to the correct one.

---

## Production Environment Setup

### 1. Update wrangler.toml for Production

Your `wrangler.toml` should have environment-specific configurations:

```toml
name = "triggers-api"
main = "src/index.ts"
compatibility_date = "2025-11-11"
compatibility_flags = ["nodejs_compat"]

# Production environment (default)
[env.production]
routes = [
  { pattern = "https://api.yourdomain.com/*", zone_name = "yourdomain.com" }
]

# Staging environment (optional)
[env.staging]
routes = [
  { pattern = "https://api-staging.yourdomain.com/*", zone_name = "yourdomain.com" }
]

# Development environment (local only)
[env.development]
# No routes - local only
```

### 2. Configure Custom Domain (Optional)

To use a custom domain:

1. Add domain to Cloudflare (if not already added)
2. Configure DNS:
   - Type: CNAME
   - Name: api
   - Target: triggers-api.workers.dev
   - Proxy: Yes (orange cloud)
3. Update routes in `wrangler.toml`

---

## Database Migration to Production

### 1. Create Production D1 Database

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

### 2. Update wrangler.toml with Production ID

```toml
[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "your-production-database-id"
migrations_dir = "src/db/migrations"
```

### 3. Apply Schema to Production

```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

**Important:** Use `--remote` flag for production (not `--local`).

### 4. Verify Schema

```bash
wrangler d1 execute triggers-api --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected output: `events` table listed.

### 5. Apply Migrations (If Any)

If you have migration files in `src/db/migrations/`:

```bash
wrangler d1 migrations apply triggers-api --remote
```

### 6. Backup Strategy

**Create backup before major changes:**
```bash
# Export data
wrangler d1 export triggers-api --remote --output backup-$(date +%Y%m%d).sql
```

**Restore from backup:**
```bash
wrangler d1 execute triggers-api --remote --file backup-20251111.sql
```

---

## KV Namespace Production Setup

### 1. Create Production KV Namespaces

**AUTH_KV:**
```bash
wrangler kv:namespace create "AUTH_KV"
```

**METRICS_KV:**
```bash
wrangler kv:namespace create "METRICS_KV"
```

### 2. Update wrangler.toml

Add production namespace IDs:

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "production-auth-kv-id"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "production-metrics-kv-id"
```

### 3. Populate Production Auth Tokens

**Create production Bearer token:**
```bash
# Generate secure token (use a proper generator in production)
PROD_TOKEN="sk-live-$(openssl rand -hex 32)"
echo "Production Token: $PROD_TOKEN"
```

**Store in KV:**
```bash
wrangler kv:key put --binding=AUTH_KV "auth:$PROD_TOKEN" "valid"
```

**Important:** Save this token securely. You'll need it for API access.

### 4. Migrate Existing KV Data (If Needed)

If migrating from another environment:

**Export keys from old namespace:**
```bash
wrangler kv:key list --binding=AUTH_KV --env staging > keys-backup.json
```

**Import to production:**
```bash
# Manually import or use bulk API
```

---

## Queue Production Setup

### 1. Create Production Queues

**Event Queue:**
```bash
wrangler queues create event-queue
```

**Dead Letter Queue:**
```bash
wrangler queues create event-dlq
```

### 2. Verify wrangler.toml Configuration

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

**Production tuning considerations:**
- Increase `max_batch_size` for higher throughput
- Increase `max_concurrency` for parallel processing
- Adjust `max_retries` based on failure tolerance

---

## Environment Variables & Secrets

### 1. Set Environment Variables in Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Select your Worker
4. Go to **Settings** → **Variables**
5. Add production variables:

```
LOG_LEVEL=info
ENVIRONMENT=production
```

### 2. Set Secrets (Sensitive Data)

**Via CLI:**
```bash
wrangler secret put API_SECRET
# Enter secret value when prompted
```

**Via Dashboard:**
1. Go to Worker Settings → Variables
2. Add "Encrypted" variables
3. Click "Encrypt" for sensitive values

### 3. Environment Variable Best Practices

- Use secrets for API keys, tokens, passwords
- Use plain variables for non-sensitive config
- Never commit secrets to version control
- Rotate secrets regularly
- Use different secrets per environment

---

## Deployment Process

### 1. Final Pre-Deployment Check

```bash
# Verify logged in
wrangler whoami

# Run tests
npm run test

# Type check
npx tsc --noEmit

# Build (optional)
npm run build
```

### 2. Deploy to Production

**Standard deployment:**
```bash
wrangler deploy
```

**Or use npm script:**
```bash
npm run deploy
```

### 3. Deployment Output

Expected output:
```
⛅️ wrangler 4.x.x
-------------------
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded triggers-api (x.xx sec)
Published triggers-api (x.xx sec)
  https://triggers-api.your-account.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4. Verify Deployment

**Check deployed version:**
```bash
wrangler deployments list
```

**Expected output:**
```
Created:     2025-11-11 10:00:00
Source:      Upload from local
Author:      your-email@example.com
Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 5. Global Propagation

Cloudflare deploys globally within ~30 seconds. Your Worker is now live.

---

## Environment-Specific Deployment

### Deploy to Staging

```bash
wrangler deploy --env staging
```

### Deploy to Production

```bash
wrangler deploy --env production
```

### Deploy Specific Version

```bash
git checkout v1.2.3
wrangler deploy
```

### Environment Configuration

Each environment should have separate:
- D1 databases
- KV namespaces
- Queues
- Routes/domains
- Environment variables

**Example wrangler.toml:**
```toml
[env.staging]
d1_databases = [{ binding = "DB", database_name = "triggers-api-staging", database_id = "staging-db-id" }]

[env.production]
d1_databases = [{ binding = "DB", database_name = "triggers-api-production", database_id = "production-db-id" }]
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://api.yourdomain.com/health
```

Expected: `200 OK` with health status.

### 2. Test Authentication

```bash
curl -X POST https://api.yourdomain.com/events \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"test": "production"}}'
```

Expected: `201 Created`

### 3. Test All Endpoints

Run through critical user flows:
- POST /events (create event)
- GET /inbox (query events)
- POST /inbox/:id/ack (acknowledge)
- POST /inbox/:id/retry (retry failed)

### 4. Verify Database Writes

```bash
wrangler d1 execute triggers-api --remote --command "SELECT COUNT(*) FROM events;"
```

### 5. Check Queue Processing

Create events and verify they're processed asynchronously.

### 6. Test Dashboard UI

1. Visit `https://api.yourdomain.com`
2. Verify dashboard loads
3. Test debug control panel
4. Check metrics display
5. Verify tail logs visible

### 7. Monitor Error Rates

Check Cloudflare Dashboard:
- Navigate to **Workers & Pages** → **Your Worker** → **Metrics**
- Verify error rate is acceptable
- Check latency metrics

---

## Monitoring & Observability

### 1. View Real-Time Logs

```bash
wrangler tail
```

Or for specific environment:
```bash
wrangler tail --env production
```

### 2. Cloudflare Dashboard Analytics

1. Go to **Workers & Pages** → **Your Worker**
2. Click **Metrics** tab
3. View:
   - Requests per second
   - Success rate
   - Error rate
   - CPU time
   - Duration (latency)

### 3. Set Up Alerts

1. Navigate to **Notifications** in Cloudflare Dashboard
2. Create alert rules:
   - Error rate > 1%
   - Requests per second > threshold
   - CPU time > limit
3. Configure notification channels (email, webhook, PagerDuty)

### 4. D1 Database Metrics

```bash
wrangler d1 execute triggers-api --remote --command "SELECT status, COUNT(*) as count FROM events GROUP BY status;"
```

Monitor:
- Total events
- Pending events
- Failed events
- Retry counts

### 5. Queue Monitoring

Check queue depth in Cloudflare Dashboard:
1. Go to **Queues**
2. Select `event-queue`
3. Monitor:
   - Messages in queue
   - DLQ depth
   - Processing rate

---

## Rollback Procedure

### Option 1: Rollback to Previous Deployment

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rolling back due to issue"
```

### Option 2: Deploy Previous Git Version

```bash
# Find previous working commit
git log --oneline

# Checkout previous version
git checkout <previous-commit-hash>

# Deploy
wrangler deploy

# Return to main
git checkout main
```

### Option 3: Emergency Disable

If critical issue, temporarily disable Worker:

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** → **Your Worker**
3. Disable routes temporarily
4. Fix issue locally
5. Redeploy and re-enable

### Rollback Checklist

- [ ] Identify issue and impact
- [ ] Notify team of rollback
- [ ] Execute rollback procedure
- [ ] Verify rollback successful
- [ ] Monitor metrics post-rollback
- [ ] Document incident and root cause
- [ ] Plan fix and re-deployment

---

## Zero-Downtime Deployments

Cloudflare Workers automatically support zero-downtime deployments:

1. **Versioning:** Each deployment creates a new version
2. **Gradual Rollout:** New version gradually replaces old
3. **In-Flight Requests:** Existing requests complete on old version
4. **No Restart Required:** No downtime during deployment

**Best Practices:**
- Keep deployments backward compatible
- Use feature flags for risky changes
- Deploy during low-traffic periods
- Monitor metrics closely post-deploy
- Have rollback plan ready

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Production
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm run test

      - name: Type check
        run: npx tsc --noEmit

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Required GitHub Secrets

Add to repository settings:
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Multi-Environment Pipeline

```yaml
jobs:
  deploy-staging:
    # Deploy to staging on PR
    if: github.event_name == 'pull_request'
    steps:
      - run: wrangler deploy --env staging

  deploy-production:
    # Deploy to production on main merge
    if: github.ref == 'refs/heads/main'
    steps:
      - run: wrangler deploy --env production
```

---

## Production Best Practices

### Security

- [ ] Use encrypted secrets for sensitive data
- [ ] Rotate API tokens regularly
- [ ] Enable rate limiting
- [ ] Implement proper CORS policies
- [ ] Validate all inputs
- [ ] Use HTTPS only
- [ ] Monitor for security anomalies

### Performance

- [ ] Optimize database queries with indexes
- [ ] Use KV for caching
- [ ] Batch queue operations
- [ ] Minimize cold start time
- [ ] Use Workers Analytics to identify bottlenecks

### Reliability

- [ ] Set up error monitoring and alerting
- [ ] Configure proper retry logic
- [ ] Use Dead Letter Queues for failed messages
- [ ] Implement circuit breakers for external dependencies
- [ ] Test failure scenarios

### Cost Optimization

- [ ] Monitor usage in Cloudflare Dashboard
- [ ] Optimize D1 queries to reduce reads
- [ ] Use KV efficiently (avoid excessive writes)
- [ ] Configure appropriate queue batch sizes
- [ ] Review and optimize cold start time

### Compliance

- [ ] Review data retention policies
- [ ] Implement proper logging (GDPR compliance)
- [ ] Audit access controls
- [ ] Document security measures
- [ ] Regular security reviews

---

## Deployment Checklist

Quick reference for production deployments:

- [ ] Code tested locally
- [ ] All tests passing
- [ ] TypeScript errors resolved
- [ ] Production database migrated
- [ ] KV namespaces configured
- [ ] Queues created
- [ ] Environment variables set
- [ ] Secrets configured
- [ ] wrangler.toml updated
- [ ] Logged in via `wrangler login`
- [ ] Pre-deployment backup taken
- [ ] Run `wrangler deploy`
- [ ] Verify deployment successful
- [ ] Test all endpoints in production
- [ ] Monitor metrics for 15 minutes
- [ ] Document deployment in changelog
- [ ] Notify team of completion

---

## Additional Resources

- [Cloudflare Workers Deployment](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Analytics](https://developers.cloudflare.com/workers/observability/logs/)
- [Continuous Deployment Guide](https://developers.cloudflare.com/workers/ci-cd/)

---

## Getting Help

If deployment issues occur:
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review Cloudflare status: [cloudflarestatus.com](https://www.cloudflarestatus.com/)
3. Check deployment logs: `wrangler tail`
4. Contact Cloudflare Support (Enterprise plans)
5. Community Forums: [community.cloudflare.com](https://community.cloudflare.com/)

---

**Deployed successfully?** Monitor your application and refer to [Monitoring Guide](./CLOUDFLARE_SETUP.md#monitoring-analytics) for ongoing management.
