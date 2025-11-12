# TriggersAPI - Frequently Asked Questions (FAQ)

Common questions and answers about TriggersAPI setup, development, deployment, and operations.

## Table of Contents

- [General Questions](#general-questions)
- [Setup & Installation](#setup--installation)
- [Local Development](#local-development)
- [Database (D1)](#database-d1)
- [KV Storage](#kv-storage)
- [Queues & Workflows](#queues--workflows)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Performance & Scaling](#performance--scaling)
- [Costs & Billing](#costs--billing)
- [Troubleshooting](#troubleshooting)

---

## General Questions

### What is TriggersAPI?

TriggersAPI is a serverless event ingestion and delivery API built on Cloudflare Workers. It provides a Zapier-like webhook system for receiving, queuing, and delivering events with built-in retry logic, observability, and a real-time dashboard.

### What technologies does TriggersAPI use?

- **Cloudflare Workers** - Serverless compute platform
- **D1** - SQL database (SQLite-compatible)
- **KV** - Key-Value storage for auth and metrics
- **Queues** - Asynchronous message processing
- **Workflows** - Durable execution for event processing
- **Tail Workers** - Real-time log aggregation
- **TypeScript** - Type-safe development
- **React** - Dashboard UI

### Is TriggersAPI free to use?

**Development:** Yes, Cloudflare's free tier is sufficient for local development and testing.

**Production:** Depends on usage:
- Free tier: 100,000 requests/day
- For higher usage, see [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Can I use TriggersAPI for production?

Yes! TriggersAPI is production-ready with:
- Global edge deployment
- Automatic scaling
- Built-in retry logic
- Dead Letter Queue for failed events
- Real-time monitoring
- Zero-downtime deployments

---

## Setup & Installation

### What are the prerequisites for running TriggersAPI?

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Wrangler CLI (Cloudflare's tool)
- Cloudflare account (free tier works)
- 2GB+ free disk space

See [Setup Guide](./SETUP.md#prerequisites--requirements) for details.

### Do I need to install a database locally?

No! D1 database runs entirely in Cloudflare's infrastructure. For local development, Wrangler provides a local D1 emulator.

### How long does initial setup take?

- **Quick setup:** 5-10 minutes (if familiar with Cloudflare)
- **Complete setup:** 15-30 minutes (first time)
- **Reading docs:** 1-2 hours (recommended)

See [Quick Start Guide](./quick-start.md) for fastest setup.

### Can I run TriggersAPI without Cloudflare?

No, TriggersAPI is built specifically for Cloudflare Workers and uses Cloudflare-specific services (D1, KV, Queues, Workflows). However, the architecture could be adapted to other platforms with equivalent services.

---

## Local Development

### How do I start the development server?

```bash
npm run dev
```

Or directly:
```bash
wrangler dev
```

Access at `http://localhost:8787`

See [Setup Guide - Starting Local Development Server](./SETUP.md#starting-local-development-server).

### Why is port 8787 already in use?

Another process (likely a previous `wrangler dev` session) is using the port.

**Solution:**
```bash
# macOS/Linux
lsof -ti:8787 | xargs kill -9

# Or use different port
wrangler dev --port 8788
```

See [Troubleshooting - Port Already in Use](./TROUBLESHOOTING.md#port-8787-already-in-use).

### Does local data persist between restarts?

**By default:** No, local D1 and KV data is ephemeral.

**To persist:**
```bash
wrangler dev --persist
```

Or use `--remote` to connect to production resources (use with caution).

### Can I use production data locally?

**Not recommended** for development. Instead:
1. Create staging environment with copy of production data
2. Use `wrangler dev --remote --env staging`

For safety, never modify production data from local dev.

### How do I debug my Worker locally?

**Options:**
1. **Console logs:** Use `console.log()`, visible in terminal
2. **Chrome DevTools:** Open `chrome://inspect` in Chrome
3. **VS Code debugger:** Configure launch.json for debugging
4. **Wrangler tail:** `wrangler tail --local` for real-time logs

See [Setup Guide - Debugging Techniques](./SETUP.md#debugging-techniques).

---

## Database (D1)

### How do I create a D1 database?

```bash
wrangler d1 create triggers-api
```

Copy the output `database_id` to `wrangler.toml`.

See [Setup Guide - Database Setup](./SETUP.md#database-setup-d1).

### How do I apply the database schema?

**Local:**
```bash
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

**Production:**
```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

### Can I use migrations with D1?

Yes! Place migration files in `src/db/migrations/` and run:
```bash
wrangler d1 migrations apply triggers-api --remote
```

### What are D1 limits?

**Free Tier:**
- 5 GB storage per database
- 5 million reads per day
- 100,000 writes per day

**Paid Plans:** Higher limits available.

See [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/).

### How do I query D1 from Dashboard?

1. Go to Cloudflare Dashboard → **D1**
2. Click on your database
3. Click **Console** tab
4. Enter SQL query and click **Execute**

See [Cloudflare Setup - D1 Management](./CLOUDFLARE_SETUP.md#d1-database-management).

### How do I backup my D1 database?

```bash
wrangler d1 export triggers-api --remote --output backup-$(date +%Y%m%d).sql
```

Restore:
```bash
wrangler d1 execute triggers-api --remote --file backup-20251111.sql
```

See [Deployment Guide - Database Backup](./DEPLOYMENT.md#database-migration-to-production).

---

## KV Storage

### What is KV used for in TriggersAPI?

- **AUTH_KV:** Stores Bearer tokens for authentication
- **METRICS_KV:** Stores aggregated metrics and analytics

### How do I create a KV namespace?

```bash
wrangler kv:namespace create "AUTH_KV"
```

Copy the output `id` to `wrangler.toml`.

See [Setup Guide - KV Namespace Setup](./SETUP.md#kv-namespace-setup).

### How do I add authentication tokens to KV?

**Local:**
```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-test-123..." "valid" --local
```

**Production:**
```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-live-123..." "valid"
```

### What are KV limits?

**Free Tier:**
- 100,000 reads per day
- 1,000 writes per day
- 1 GB storage

**Paid Plans:** Higher limits available.

See [Cloudflare KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/).

### Can I browse KV data in Dashboard?

Yes! Go to Cloudflare Dashboard → **Workers** → **KV** → Select namespace → **View**.

See [Cloudflare Setup - KV Management](./CLOUDFLARE_SETUP.md#kv-namespace-management).

---

## Queues & Workflows

### What's the difference between Queues and Workflows?

**Queues:**
- Asynchronous message processing
- Batch processing (up to 100 messages)
- Retries and Dead Letter Queue
- Best for: High-throughput event processing

**Workflows:**
- Durable execution with state management
- Step-by-step execution with automatic retries
- Guaranteed execution (at-least-once)
- Best for: Multi-step processes requiring durability

### How do Queues work locally?

In local development, queues work but with limitations:
- Messages processed immediately (not batched)
- No real Dead Letter Queue
- Single consumer only

For full testing, deploy to staging environment.

### Why are my queue messages not being processed?

**Common issues:**
1. Consumer function not exported
2. Queue name mismatch in code and config
3. Queue consumer crashing (check logs)
4. Max retries exceeded (messages in DLQ)

See [Troubleshooting - Queue Issues](./TROUBLESHOOTING.md#queue-issues).

### How do I monitor queue depth?

**Dashboard:**
1. Go to **Workers** → **Queues**
2. View current depth for each queue

**Programmatically:**
- Not currently available via API

### What happens if a workflow step fails?

Workflows automatically retry failed steps with exponential backoff. If all retries fail, the workflow fails and can be manually restarted.

---

## Authentication

### How does authentication work?

TriggersAPI uses Bearer token authentication:
1. Client sends `Authorization: Bearer <token>` header
2. Worker validates token exists in AUTH_KV
3. If valid, request proceeds; otherwise, 401 Unauthorized

### How do I create a Bearer token?

**Format:** `sk-test-{32+ chars}` (development) or `sk-live-{32+ chars}` (production)

**Generate:**
```bash
TOKEN="sk-test-$(openssl rand -hex 32)"
echo $TOKEN
```

Then store in KV.

See [Setup Guide - Bearer Token Setup](./SETUP.md#bearer-token-setup).

### Can I rotate tokens without downtime?

Yes:
1. Generate new token
2. Store new token in KV
3. Update clients to use new token
4. After transition period, remove old token from KV

### How do I revoke a token?

Remove from KV:
```bash
wrangler kv:key delete --binding=AUTH_KV "auth:sk-test-old-token"
```

### Can I implement rate limiting per token?

Yes! Use KV to track request counts per token:
```typescript
const key = `rate_limit:${token}:${currentMinute}`;
const count = await env.METRICS_KV.get(key);
// Increment and check against limit
```

---

## Deployment

### How do I deploy to production?

```bash
wrangler deploy
```

Or using npm script:
```bash
npm run deploy
```

See [Deployment Guide](./DEPLOYMENT.md#deployment-process).

### Do I need to build before deploying?

No, Wrangler handles TypeScript compilation automatically during deployment.

### How long does deployment take?

- **Deployment:** 2-5 minutes
- **Global propagation:** ~30 seconds

### Can I deploy to multiple environments?

Yes! Configure environments in `wrangler.toml`:

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

See [Deployment Guide - Environment-Specific Deployment](./DEPLOYMENT.md#environment-specific-deployment).

### What if deployment fails?

1. Check error message
2. Verify logged in: `wrangler whoami`
3. Verify bindings created (D1, KV, Queues)
4. Check wrangler.toml configuration
5. Review [Troubleshooting - Deployment Issues](./TROUBLESHOOTING.md#deployment-issues)

### How do I rollback a deployment?

```bash
wrangler rollback
```

Or rollback to specific version:
```bash
wrangler rollback <deployment-id>
```

See [Deployment Guide - Rollback Procedure](./DEPLOYMENT.md#rollback-procedure).

### Is there downtime during deployment?

No! Cloudflare Workers support zero-downtime deployments:
- New version gradually replaces old
- In-flight requests complete on old version
- No restart required

---

## Performance & Scaling

### How fast is TriggersAPI?

Typical response times:
- **POST /events:** 50-150ms (includes D1 write)
- **GET /inbox:** 30-100ms (D1 query)
- **POST /inbox/:id/ack:** 40-120ms (D1 update)

Actual latency depends on:
- Geographic location (edge proximity)
- Database query complexity
- Payload size

### Does TriggersAPI scale automatically?

Yes! Cloudflare Workers automatically scale:
- Handle millions of requests
- Deploy to 300+ global edge locations
- No configuration needed
- Pay only for usage

### What are the performance limits?

**Per Request:**
- 50ms CPU time (free tier)
- 30 seconds wall-clock time
- 128 MB memory
- 10 MB request/response size

**Workers Limits:**
See [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/).

### How can I optimize performance?

1. **Add database indexes** - Speed up queries
2. **Use KV caching** - Cache frequently accessed data
3. **Batch queue operations** - Process multiple messages together
4. **Minimize CPU time** - Optimize hot paths
5. **Use async operations** - Don't block on non-critical tasks

See [Troubleshooting - Performance Issues](./TROUBLESHOOTING.md#performance-issues).

### Can I monitor performance in real-time?

Yes:
- **Wrangler tail:** `wrangler tail` for live logs
- **Dashboard Metrics:** Real-time charts in Cloudflare Dashboard
- **Custom logging:** Add timing logs in code

See [Cloudflare Setup - Monitoring & Analytics](./CLOUDFLARE_SETUP.md#monitoring--analytics).

---

## Costs & Billing

### How much does it cost to run TriggersAPI?

**Free Tier:** $0/month
- 100,000 requests per day
- Sufficient for testing and small projects

**Paid Plans:** Starting at $5/month
- Workers Paid: 10 million requests included, then $0.50 per additional million
- D1: First 5 GB and 25M reads free, then usage-based
- KV: First 100K operations free, then usage-based

See [Cloudflare Pricing](https://www.cloudflare.com/plans/developer-platform/).

### How do I monitor my usage?

1. Go to Cloudflare Dashboard → **Workers & Pages** → **Plans and Usage**
2. View current usage for all services
3. Set up alerts for approaching limits

See [Cloudflare Setup - Usage & Billing](./CLOUDFLARE_SETUP.md#usage--billing).

### Can I set spending limits?

Not directly, but you can:
1. Monitor usage daily
2. Set up alerts
3. Implement rate limiting in Worker code
4. Use Cloudflare's usage notifications

### What happens if I exceed free tier limits?

**Without payment method:** Requests are throttled or blocked.

**With payment method:** Automatically billed for overage at standard rates.

---

## Troubleshooting

### Where can I find error logs?

**Local development:**
- Terminal output from `wrangler dev`

**Production:**
```bash
wrangler tail
```

Or view in Dashboard: **Workers & Pages** → **Your Worker** → **Logs**.

### My API returns 401 Unauthorized

**Check:**
1. Authorization header present: `Authorization: Bearer <token>`
2. Token format correct: `sk-test-...` or `sk-live-...`
3. Token exists in AUTH_KV
4. Token length sufficient (32+ chars after prefix)

See [Troubleshooting - Authentication Issues](./TROUBLESHOOTING.md#authentication-issues).

### My database queries are slow

**Solutions:**
1. Add indexes to frequently queried columns
2. Use LIMIT to reduce result size
3. Avoid SELECT * (specify columns)
4. Check query execution plan

See [Troubleshooting - Performance Issues](./TROUBLESHOOTING.md#performance-issues).

### How do I get help?

1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [Cloudflare Documentation](https://developers.cloudflare.com/)
3. Search [Community Forums](https://community.cloudflare.com/)
4. Ask on [Cloudflare Discord](https://discord.gg/cloudflaredev)
5. Check [Stack Overflow](https://stackoverflow.com/questions/tagged/cloudflare-workers)

---

## Additional Questions?

### Where can I learn more?

- [Setup Guide](./SETUP.md) - Complete setup instructions
- [API Documentation](./API.md) - API endpoint reference
- [Architecture Overview](./architecture.md) - System design
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues

### How do I contribute?

If this is an open-source project:
1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request

### Can I use TriggersAPI commercially?

Check the project license. Most permissive licenses (MIT, Apache 2.0) allow commercial use.

### Is there a community or support channel?

Check the project README for:
- Discord/Slack community
- GitHub Discussions
- Issue tracker

---

**Still have questions?** Open a GitHub issue or check the [documentation index](./SETUP.md).
