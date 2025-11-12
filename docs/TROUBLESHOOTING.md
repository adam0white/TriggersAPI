# TriggersAPI - Troubleshooting Guide

Common issues and solutions for local development, deployment, and production operations.

## Table of Contents

- [Local Development Issues](#local-development-issues)
- [Database Issues (D1)](#database-issues-d1)
- [KV Storage Issues](#kv-storage-issues)
- [Queue Issues](#queue-issues)
- [Workflow Issues](#workflow-issues)
- [Authentication Issues](#authentication-issues)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)
- [Network & CORS Issues](#network--cors-issues)
- [TypeScript & Build Issues](#typescript--build-issues)
- [Testing Issues](#testing-issues)
- [Production Issues](#production-issues)
- [Getting More Help](#getting-more-help)

---

## Local Development Issues

### Port 8787 Already in Use

**Problem:**
```
Error: listen EADDRINUSE: address already in use :::8787
```

**Solutions:**

1. Kill process using port 8787:
```bash
# macOS/Linux
lsof -ti:8787 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 8787).OwningProcess | Stop-Process -Force
```

2. Use different port:
```bash
wrangler dev --port 8788
```

3. Find and stop previous `wrangler dev` process:
```bash
ps aux | grep wrangler
kill <process-id>
```

---

### Wrangler Command Not Found

**Problem:**
```bash
$ wrangler dev
bash: wrangler: command not found
```

**Solutions:**

1. Install Wrangler globally:
```bash
npm install -g wrangler
```

2. Verify installation:
```bash
wrangler --version
```

3. Use npx if not installed globally:
```bash
npx wrangler dev
```

4. Check npm global path:
```bash
npm config get prefix
# Ensure this directory is in your PATH
```

---

### Module Not Found Errors

**Problem:**
```
Error: Cannot find module '@cloudflare/workers-types'
```

**Solutions:**

1. Install dependencies:
```bash
npm install
```

2. Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Verify package.json has all dependencies:
```bash
cat package.json
```

4. Check Node version:
```bash
node --version  # Should be 18.0.0+
```

---

### Hot Reload Not Working

**Problem:** Code changes don't trigger reload in `wrangler dev`.

**Solutions:**

1. Restart dev server (Ctrl+C, then `wrangler dev`)

2. Check for syntax errors:
```bash
npx tsc --noEmit
```

3. Clear Wrangler cache:
```bash
rm -rf .wrangler
wrangler dev
```

4. Use explicit watch mode:
```bash
wrangler dev --watch
```

---

### TypeScript Compilation Errors on Dev Start

**Problem:**
```
X [ERROR] TypeScript: src/index.ts(10,5): error TS2322
```

**Solutions:**

1. Fix TypeScript errors:
```bash
npx tsc --noEmit  # Shows all errors
```

2. Check tsconfig.json configuration:
```bash
cat tsconfig.json
```

3. Regenerate Cloudflare types:
```bash
npm run cf-typegen
```

4. Verify `@cloudflare/workers-types` installed:
```bash
npm list @cloudflare/workers-types
```

---

## Database Issues (D1)

### Database Not Found

**Problem:**
```
Error: D1_ERROR: no such table: events
```

**Solutions:**

1. Create database:
```bash
wrangler d1 create triggers-api
```

2. Apply schema:
```bash
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

3. Verify database binding in wrangler.toml:
```toml
[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "your-database-id"
```

4. Check database exists:
```bash
wrangler d1 list
```

---

### Schema Migration Failed

**Problem:**
```
Error: D1_ERROR: near "CREATE": syntax error
```

**Solutions:**

1. Check SQL syntax in schema.sql:
```bash
cat src/db/schema.sql
```

2. Verify file encoding is UTF-8 (not UTF-16):
```bash
file src/db/schema.sql
```

3. Apply schema step-by-step:
```bash
# Test locally first
wrangler d1 execute triggers-api --local --command "CREATE TABLE IF NOT EXISTS events (...);"
```

4. Check Wrangler version (should be 4.x+):
```bash
wrangler --version
```

---

### Cannot Query Data from D1

**Problem:** Data inserted but queries return empty results.

**Solutions:**

1. Verify using correct environment flag:
```bash
# Local
wrangler d1 execute triggers-api --local --command "SELECT * FROM events;"

# Remote (production)
wrangler d1 execute triggers-api --remote --command "SELECT * FROM events;"
```

2. Check data actually inserted:
```bash
wrangler d1 execute triggers-api --local --command "SELECT COUNT(*) FROM events;"
```

3. Verify binding name matches code:
```typescript
// In code
const result = await env.DB.prepare("SELECT * FROM events").all();
```

```toml
# In wrangler.toml
binding = "DB"  # Must match env.DB
```

---

### Data Not Persisting Locally

**Problem:** Data disappears after restarting `wrangler dev`.

**Solution:**

Local D1 data is ephemeral by default. For persistent local data:

1. Use `--persist` flag:
```bash
wrangler dev --persist
```

2. Or use remote database for development:
```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

Note: Local D1 is meant for testing, not data persistence.

---

## KV Storage Issues

### KV Binding Not Recognized

**Problem:**
```
Error: env.AUTH_KV is undefined
```

**Solutions:**

1. Create KV namespace:
```bash
wrangler kv:namespace create "AUTH_KV"
```

2. Add to wrangler.toml:
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-namespace-id"
```

3. Restart dev server after wrangler.toml changes

4. Verify namespace exists:
```bash
wrangler kv:namespace list
```

---

### Cannot Read/Write KV Locally

**Problem:** KV operations fail in local development.

**Solutions:**

1. Use `--local` flag with KV commands:
```bash
wrangler kv:key put --binding=AUTH_KV "test" "value" --local
wrangler kv:key get --binding=AUTH_KV "test" --local
```

2. For persistent local KV, use `--persist`:
```bash
wrangler dev --persist
```

3. Verify binding name matches:
```typescript
await env.AUTH_KV.get("key");  // AUTH_KV must match wrangler.toml
```

---

### KV Key Not Found

**Problem:**
```
null returned from env.AUTH_KV.get("key")
```

**Solutions:**

1. Verify key exists:
```bash
wrangler kv:key list --binding=AUTH_KV
```

2. Check key name exactly matches (case-sensitive):
```typescript
await env.AUTH_KV.get("auth:sk-test-123");  // Exact match
```

3. Verify using correct namespace (local vs remote)

4. Set key explicitly:
```bash
wrangler kv:key put --binding=AUTH_KV "auth:token" "valid" --local
```

---

## Queue Issues

### Queue Not Working Locally

**Problem:** Messages sent to queue aren't processed.

**Solution:**

Local queues behave differently:
- Messages are processed immediately (not batched)
- DLQ not functional locally
- Limited to single consumer

For full queue testing, deploy to staging environment.

---

### Queue Consumer Not Triggered

**Problem:** Queue consumer function never executes.

**Solutions:**

1. Verify queue binding in wrangler.toml:
```toml
[[queues.producers]]
binding = "EVENT_QUEUE"
queue = "event-queue"

[[queues.consumers]]
queue = "event-queue"
```

2. Check queue consumer function exported:
```typescript
export default {
  async queue(batch, env, ctx) {
    // Consumer logic
  }
}
```

3. Verify queue created:
```bash
wrangler queues list
```

4. Check queue name matches exactly in code and config

---

### Messages Stuck in Queue

**Problem:** Queue depth increasing, messages not processed.

**Solutions:**

1. Check consumer for errors:
```bash
wrangler tail  # Look for errors in consumer
```

2. Verify max retries not exceeded (messages go to DLQ)

3. Check DLQ depth:
```bash
wrangler queues consumer get event-queue
```

4. Increase concurrency if needed:
```toml
[[queues.consumers]]
max_concurrency = 20  # Increase from 10
```

5. Check for infinite loops or long-running operations

---

### Dead Letter Queue Filling Up

**Problem:** DLQ has many messages indicating failures.

**Solutions:**

1. View DLQ messages to identify issue:
```bash
# Currently requires dashboard access
```

2. Check consumer logs for errors:
```bash
wrangler tail --env production
```

3. Fix consumer code and redeploy

4. Retry DLQ messages manually:
```typescript
// Access DLQ and reprocess
```

---

## Workflow Issues

### Workflow Not Executing

**Problem:** Workflow doesn't start or complete.

**Solutions:**

1. Verify workflow binding in wrangler.toml:
```toml
[[workflows]]
binding = "PROCESS_EVENT_WORKFLOW"
name = "process-event-workflow"
class_name = "ProcessEventWorkflow"
script_name = "triggers-api"
```

2. Check workflow class exported:
```typescript
export class ProcessEventWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    // Workflow logic
  }
}
```

3. Verify workflow instantiation:
```typescript
const instance = await env.PROCESS_EVENT_WORKFLOW.create({
  params: { event }
});
```

4. Check for step errors:
```bash
wrangler tail  # Look for workflow errors
```

---

### Workflow Step Failing

**Problem:** Workflow fails at specific step.

**Solutions:**

1. Add error handling per step:
```typescript
await step.do("step-name", async () => {
  try {
    // Step logic
  } catch (error) {
    console.error("Step failed:", error);
    throw error;  // Will retry
  }
});
```

2. Check step retry behavior:
```typescript
// Workflows auto-retry failed steps
```

3. View workflow execution history in dashboard

4. Use workflow instance status:
```typescript
const status = await instance.status();
console.log(status);
```

---

## Authentication Issues

### 401 Unauthorized

**Problem:**
```json
{"error": "Unauthorized", "status": 401}
```

**Solutions:**

1. Verify Bearer token in Authorization header:
```bash
curl -H "Authorization: Bearer sk-test-1234567890..." \
  http://localhost:8787/events
```

2. Check token exists in KV:
```bash
wrangler kv:key get --binding=AUTH_KV "auth:sk-test-1234567890..." --local
```

3. Verify token format (must start with `sk-test-` or `sk-live-`):
```bash
# Valid: sk-test-1234567890abcdefghijklmnopqrstuvwxyz
# Invalid: test-token
```

4. Check token length (minimum 32 characters after prefix)

5. Set token in KV if missing:
```bash
wrangler kv:key put --binding=AUTH_KV "auth:sk-test-123..." "valid" --local
```

---

### Token Not Found in KV

**Problem:** Valid token but KV lookup returns null.

**Solutions:**

1. Verify KV key format exactly:
```typescript
const key = `auth:${token}`;  // Must match storage format
await env.AUTH_KV.get(key);
```

2. List all KV keys:
```bash
wrangler kv:key list --binding=AUTH_KV
```

3. Ensure using correct namespace (AUTH_KV not METRICS_KV)

4. Check local vs remote KV:
```bash
# Local
wrangler kv:key put --binding=AUTH_KV "auth:token" "valid" --local

# Remote
wrangler kv:key put --binding=AUTH_KV "auth:token" "valid"
```

---

### Invalid Token Format

**Problem:** Token validation fails format check.

**Solution:**

Tokens must follow format:
- Development: `sk-test-{32+ chars}`
- Production: `sk-live-{32+ chars}`

**Generate valid token:**
```bash
# Generate 32-char hex token
TOKEN="sk-test-$(openssl rand -hex 32)"
echo $TOKEN
```

---

## Deployment Issues

### Deployment Fails - Authentication Error

**Problem:**
```
Error: Authentication error: Invalid API Token
```

**Solutions:**

1. Log in again:
```bash
wrangler login
```

2. Verify logged in:
```bash
wrangler whoami
```

3. Check API token permissions (needs Workers Script Edit)

4. Generate new API token if expired

---

### Deployment Fails - Binding Error

**Problem:**
```
Error: Binding "DB" not found in account
```

**Solutions:**

1. Create missing resource:
```bash
wrangler d1 create triggers-api
# Or for KV
wrangler kv:namespace create "AUTH_KV"
```

2. Update wrangler.toml with correct IDs

3. Verify bindings exist in Cloudflare dashboard

4. Check account ID matches:
```bash
wrangler whoami  # Verify account
```

---

### Deployment Succeeds but Application Broken

**Problem:** Deployment completes but endpoints return errors.

**Solutions:**

1. Check environment variables set in dashboard:
   - Go to Workers & Pages → Your Worker → Settings → Variables

2. Verify database migrated to remote:
```bash
wrangler d1 execute triggers-api --remote --file ./src/db/schema.sql
```

3. Check production KV has auth tokens:
```bash
wrangler kv:key list --binding=AUTH_KV
```

4. View production logs:
```bash
wrangler tail --env production
```

5. Verify all bindings configured correctly

---

### Cannot Rollback Deployment

**Problem:** Rollback command fails.

**Solutions:**

1. List deployments:
```bash
wrangler deployments list
```

2. Use specific deployment ID:
```bash
wrangler rollback <deployment-id>
```

3. Alternative: Deploy previous git version:
```bash
git checkout <previous-commit>
wrangler deploy
git checkout main
```

---

## Performance Issues

### Slow API Response Times

**Problem:** API latency higher than expected.

**Solutions:**

1. Check D1 query performance:
```typescript
console.time("query");
const result = await env.DB.prepare("SELECT * FROM events").all();
console.timeEnd("query");
```

2. Add database indexes:
```sql
CREATE INDEX idx_events_status_created ON events(status, created_at);
```

3. Use KV for caching frequently accessed data:
```typescript
// Cache in KV
await env.METRICS_KV.put("cached-data", JSON.stringify(data), {
  expirationTtl: 60  // Cache for 60 seconds
});
```

4. Optimize queries (avoid SELECT *, use LIMIT):
```sql
SELECT event_id, status FROM events WHERE status = 'pending' LIMIT 100;
```

5. Check external API latency (if any)

---

### High Queue Backlog

**Problem:** Queue depth steadily increasing.

**Solutions:**

1. Increase consumer concurrency:
```toml
[[queues.consumers]]
max_concurrency = 20  # Increase from 10
```

2. Increase batch size:
```toml
max_batch_size = 200  # Increase from 100
```

3. Optimize consumer processing logic

4. Add more consumers (horizontal scaling)

5. Monitor consumer errors:
```bash
wrangler tail --env production | grep ERROR
```

---

### High Memory Usage

**Problem:** Worker exceeds memory limits.

**Solutions:**

1. Profile memory usage in Chrome DevTools

2. Avoid loading large datasets into memory:
```typescript
// Bad: Load all events
const all = await env.DB.prepare("SELECT * FROM events").all();

// Good: Use pagination
const page = await env.DB.prepare("SELECT * FROM events LIMIT 100").all();
```

3. Stream large responses:
```typescript
return new Response(stream, { headers: { "Content-Type": "application/json" }});
```

4. Clear unused variables:
```typescript
let largeData = await loadData();
// Use largeData
largeData = null;  // Help GC
```

---

### Cold Start Latency

**Problem:** First request after idle period is slow.

**Solutions:**

1. Minimize dependencies (Workers bundle size)

2. Use code splitting if possible

3. Lazy load non-critical modules:
```typescript
const heavyModule = await import('./heavy-module');
```

4. Keep Worker warm with cron trigger:
```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

5. Optimize initialization code

---

## Network & CORS Issues

### CORS Errors in Browser

**Problem:**
```
Access to fetch at 'http://localhost:8787/events' blocked by CORS policy
```

**Solutions:**

1. Add CORS headers in Worker:
```typescript
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
```

2. Handle OPTIONS preflight:
```typescript
if (request.method === "OPTIONS") {
  return new Response(null, { headers });
}
```

3. For production, restrict origin:
```typescript
"Access-Control-Allow-Origin": "https://yourdomain.com"
```

---

### Connection Timeout

**Problem:** Requests timeout before completing.

**Solutions:**

1. Check Cloudflare timeout limits (Workers: 30s CPU time)

2. Optimize long-running operations

3. Use async operations with context.waitUntil:
```typescript
ctx.waitUntil(asyncOperation());
return response;  // Don't wait for asyncOperation
```

4. For long operations, use Workflows (no timeout)

---

## TypeScript & Build Issues

### Type Errors After Update

**Problem:** TypeScript errors after updating packages.

**Solutions:**

1. Regenerate Cloudflare types:
```bash
npm run cf-typegen
```

2. Update TypeScript:
```bash
npm install -D typescript@latest
```

3. Clear TypeScript cache:
```bash
rm -rf node_modules/.cache
```

4. Check tsconfig.json compatibility

---

### Build Fails

**Problem:**
```
Error: Build failed
```

**Solutions:**

1. Check TypeScript errors:
```bash
npx tsc --noEmit
```

2. Clear build artifacts:
```bash
rm -rf .wrangler dist
```

3. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Testing Issues

### Tests Failing Locally

**Problem:** Unit tests fail with errors.

**Solutions:**

1. Run tests with verbose output:
```bash
npm run test -- --reporter=verbose
```

2. Check test environment configuration:
```bash
cat vitest.config.mts
```

3. Verify mocks for Cloudflare APIs:
```typescript
const env = getMiniflareBindings();
```

4. Regenerate worker types:
```bash
npm run cf-typegen
```

---

### Tests Pass Locally but Fail in CI

**Problem:** CI pipeline tests fail.

**Solutions:**

1. Check Node version matches CI:
```yaml
# .github/workflows
node-version: '20'
```

2. Clear CI cache

3. Verify environment variables in CI

4. Check CI has access to Cloudflare API (for remote tests)

---

## Production Issues

### 5xx Errors in Production

**Problem:** Server errors in production.

**Solutions:**

1. Check error logs:
```bash
wrangler tail --env production
```

2. Verify all bindings working (D1, KV, Queues)

3. Check environment variables set

4. Verify database schema applied:
```bash
wrangler d1 execute triggers-api --remote --command "SELECT * FROM events LIMIT 1;"
```

5. Rollback if issue persists:
```bash
wrangler rollback
```

---

### High Error Rate

**Problem:** Error rate spike in production.

**Solutions:**

1. Check Cloudflare Analytics for error types

2. View recent logs:
```bash
wrangler tail --env production
```

3. Verify external dependencies available

4. Check rate limiting not causing issues

5. Investigate recent deployments:
```bash
wrangler deployments list
```

---

### Data Loss or Inconsistency

**Problem:** Data missing or incorrect in database.

**Solutions:**

1. Check workflow step failures

2. Verify queue DLQ for failed messages

3. Review database transaction logic

4. Restore from backup if needed:
```bash
wrangler d1 execute triggers-api --remote --file backup.sql
```

5. Implement additional logging for debugging

---

## Getting More Help

### Cloudflare Resources

- **Documentation:** [developers.cloudflare.com](https://developers.cloudflare.com/)
- **Community Forums:** [community.cloudflare.com](https://community.cloudflare.com/)
- **Discord:** [Cloudflare Developers Discord](https://discord.gg/cloudflaredev)
- **Status Page:** [cloudflarestatus.com](https://www.cloudflarestatus.com/)

### Stack Overflow

Search with tags:
- `cloudflare-workers`
- `cloudflare-d1`
- `wrangler`

### GitHub Issues

For project-specific issues, open a GitHub issue with:
- Description of problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, Wrangler version)
- Relevant logs or error messages

### Cloudflare Support

Enterprise customers can contact Cloudflare Support directly.

---

## Debug Checklist

When troubleshooting, systematically check:

- [ ] Node.js and npm versions correct
- [ ] Wrangler CLI up to date
- [ ] All dependencies installed (`npm install`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] wrangler.toml configured correctly
- [ ] All resources created (D1, KV, Queues)
- [ ] Bindings match between code and config
- [ ] Environment variables set (local and production)
- [ ] Database schema applied
- [ ] Authentication tokens valid
- [ ] Logs checked for errors (`wrangler tail`)
- [ ] Recent deployments reviewed
- [ ] Network connectivity verified

---

**Still stuck?** Check the [Setup Guide](./SETUP.md) or [Deployment Guide](./DEPLOYMENT.md) for detailed instructions.
