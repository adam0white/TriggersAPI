# TriggersAPI - Environment Variables Reference

Complete reference for environment variables, secrets, and configuration used in TriggersAPI.

## Table of Contents

- [Overview](#overview)
- [Local Development Variables](#local-development-variables)
- [Production Variables](#production-variables)
- [Cloudflare Bindings](#cloudflare-bindings)
- [Secrets Management](#secrets-management)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Security Best Practices](#security-best-practices)

---

## Overview

TriggersAPI uses environment variables for configuration across different environments (development, staging, production). Variables are stored in:

- **Local Development:** `.env` file (never committed)
- **Production:** Cloudflare Dashboard (Workers Settings → Variables)
- **Configuration:** `wrangler.toml` for Cloudflare resources

---

## Local Development Variables

### .env File Structure

Create `.env` in project root (copy from `.env.example`):

```bash
# TriggersAPI Environment Configuration

# Authentication Tokens
AUTH_TOKEN_1=sk-test-1234567890abcdefghijklmnopqrstuvwxyz
AUTH_TOKEN_2=sk-test-abcdefghijklmnopqrstuvwxyz1234567890

# Service Configuration
LOG_LEVEL=info
ENVIRONMENT=development

# Optional: Debug Settings
DEBUG_MODE=false
```

### Variable Definitions

#### AUTH_TOKEN_1, AUTH_TOKEN_2, ...
- **Type:** String
- **Required:** No (tokens stored in KV, not env vars)
- **Format:** `sk-test-{32+ chars}` or `sk-live-{32+ chars}`
- **Description:** Bearer tokens for API authentication. Store in KV, not environment variables.
- **Example:** `sk-test-1234567890abcdefghijklmnopqrstuvwxyz`
- **Notes:** Use for local testing only. Production tokens stored in KV.

#### LOG_LEVEL
- **Type:** String (enum)
- **Required:** No
- **Default:** `info`
- **Valid Values:** `debug`, `info`, `warn`, `error`
- **Description:** Controls logging verbosity
  - `debug` - All logs including detailed debugging
  - `info` - Informational messages and above
  - `warn` - Warnings and errors only
  - `error` - Errors only
- **Example:** `LOG_LEVEL=debug`
- **Notes:** Use `debug` in development, `info` or `warn` in production

#### ENVIRONMENT
- **Type:** String (enum)
- **Required:** No
- **Default:** `development`
- **Valid Values:** `development`, `staging`, `production`
- **Description:** Identifies the current environment
- **Example:** `ENVIRONMENT=production`
- **Notes:** Used for environment-specific logic and logging

#### DEBUG_MODE
- **Type:** Boolean (as string)
- **Required:** No
- **Default:** `false`
- **Valid Values:** `true`, `false`
- **Description:** Enables debug features and verbose error messages
- **Example:** `DEBUG_MODE=true`
- **Notes:** Should be `false` in production

---

## Production Variables

Set in Cloudflare Dashboard: **Workers & Pages** → **Your Worker** → **Settings** → **Variables**

### Required Production Variables

#### LOG_LEVEL
```
LOG_LEVEL=info
```
- Use `info` or `warn` for production
- Reduces log verbosity and costs

#### ENVIRONMENT
```
ENVIRONMENT=production
```
- Identifies production environment
- Affects behavior and error reporting

### Optional Production Variables

#### RATE_LIMIT_MAX_REQUESTS
```
RATE_LIMIT_MAX_REQUESTS=1000
```
- Max requests per IP per window
- Default: 1000

#### RATE_LIMIT_WINDOW_MS
```
RATE_LIMIT_WINDOW_MS=60000
```
- Rate limit window in milliseconds
- Default: 60000 (1 minute)

---

## Cloudflare Bindings

Bindings are configured in `wrangler.toml` and accessed via `env` object in code.

### D1 Database Binding

**wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
migrations_dir = "src/db/migrations"
```

**Access in code:**
```typescript
const result = await env.DB.prepare("SELECT * FROM events").all();
```

**Environment Variable Equivalent:** None (binding only)

---

### KV Namespace Bindings

**wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Access in code:**
```typescript
// AUTH_KV - Store authentication tokens
await env.AUTH_KV.get("auth:token");
await env.AUTH_KV.put("auth:token", "valid");

// METRICS_KV - Store metrics and analytics
await env.METRICS_KV.get("metrics:summary");
await env.METRICS_KV.put("metrics:summary", JSON.stringify(data));
```

**Environment Variable Equivalent:** None (binding only)

---

### Queue Bindings

**wrangler.toml:**
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

**Access in code:**
```typescript
// Send message to queue
await env.EVENT_QUEUE.send({ eventId: "evt_123", payload: {...} });

// Process queue messages (consumer)
export default {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      // Process message
    }
  }
}
```

**Environment Variable Equivalent:** None (binding only)

---

### Workflow Binding

**wrangler.toml:**
```toml
[[workflows]]
binding = "PROCESS_EVENT_WORKFLOW"
name = "process-event-workflow"
class_name = "ProcessEventWorkflow"
script_name = "triggers-api"
```

**Access in code:**
```typescript
// Create workflow instance
const instance = await env.PROCESS_EVENT_WORKFLOW.create({
  params: { event }
});

// Get workflow status
const status = await instance.status();
```

**Environment Variable Equivalent:** None (binding only)

---

## Secrets Management

Secrets are encrypted environment variables for sensitive data.

### Setting Secrets

**Via CLI:**
```bash
wrangler secret put API_SECRET
# Enter secret value when prompted
```

**Via Dashboard:**
1. Go to **Workers & Pages** → **Your Worker** → **Settings** → **Variables**
2. Add variable and check "Encrypt"
3. Enter secret value

### Accessing Secrets

```typescript
const apiSecret = env.API_SECRET;
```

### Common Secrets

#### API_SECRET (Example)
- **Type:** String
- **Description:** Secret key for signing tokens or encrypting data
- **Example:** `your-secret-key-here`
- **Notes:** Generate with `openssl rand -hex 32`

#### WEBHOOK_SECRET (Example)
- **Type:** String
- **Description:** Secret for validating incoming webhooks
- **Example:** `webhook-secret-123`
- **Notes:** Share with webhook providers

---

## Environment-Specific Configuration

### Development Environment

```bash
# .env (local)
LOG_LEVEL=debug
ENVIRONMENT=development
DEBUG_MODE=true
AUTH_TOKEN_1=sk-test-local123...
```

**Characteristics:**
- Verbose logging
- Debug features enabled
- Local bindings (ephemeral data)
- Test tokens

---

### Staging Environment

**Cloudflare Dashboard Variables:**
```
LOG_LEVEL=info
ENVIRONMENT=staging
```

**wrangler.toml:**
```toml
[env.staging]
routes = [
  { pattern = "https://api-staging.yourdomain.com/*", zone_name = "yourdomain.com" }
]

[[env.staging.d1_databases]]
binding = "DB"
database_name = "triggers-api-staging"
database_id = "staging-db-id"

[[env.staging.kv_namespaces]]
binding = "AUTH_KV"
id = "staging-kv-id"
```

**Characteristics:**
- Production-like configuration
- Separate resources (D1, KV, Queues)
- Moderate logging
- Test tokens (sk-test-)

---

### Production Environment

**Cloudflare Dashboard Variables:**
```
LOG_LEVEL=info
ENVIRONMENT=production
```

**wrangler.toml:**
```toml
[env.production]
routes = [
  { pattern = "https://api.yourdomain.com/*", zone_name = "yourdomain.com" }
]

[[env.production.d1_databases]]
binding = "DB"
database_name = "triggers-api-production"
database_id = "production-db-id"

[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "production-kv-id"
```

**Characteristics:**
- Minimal logging (info/warn)
- Production bindings
- Live tokens (sk-live-)
- Monitoring and alerting enabled

---

## Security Best Practices

### DO ✅

- ✅ Use `.env` for local development
- ✅ Add `.env` to `.gitignore`
- ✅ Provide `.env.example` template (safe to commit)
- ✅ Use Cloudflare Dashboard for production secrets
- ✅ Encrypt sensitive variables
- ✅ Use different secrets per environment
- ✅ Rotate secrets regularly
- ✅ Use strong, random secrets (32+ characters)
- ✅ Store tokens in KV, not environment variables
- ✅ Use `sk-test-` prefix for development tokens
- ✅ Use `sk-live-` prefix for production tokens

### DON'T ❌

- ❌ Commit `.env` to version control
- ❌ Share secrets in plain text (email, Slack, etc.)
- ❌ Use same secrets across environments
- ❌ Hardcode secrets in source code
- ❌ Use weak or guessable secrets
- ❌ Store secrets in client-side code
- ❌ Log secrets to console or logs
- ❌ Store production tokens in development environment
- ❌ Use production resources in development

---

## Accessing Environment Variables in Code

### TypeScript Interface

```typescript
interface Env {
  // Bindings
  DB: D1Database;
  AUTH_KV: KVNamespace;
  METRICS_KV: KVNamespace;
  EVENT_QUEUE: Queue;
  PROCESS_EVENT_WORKFLOW: Workflow;

  // Environment Variables
  LOG_LEVEL?: string;
  ENVIRONMENT?: string;
  DEBUG_MODE?: string;

  // Secrets
  API_SECRET?: string;
}
```

### Usage Example

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Access environment variable
    const logLevel = env.LOG_LEVEL || 'info';
    const isProduction = env.ENVIRONMENT === 'production';

    // Access binding
    const db = env.DB;
    const kv = env.AUTH_KV;

    // Access secret
    const apiSecret = env.API_SECRET;

    // Use in logic
    if (env.DEBUG_MODE === 'true') {
      console.log('Debug mode enabled');
    }

    return new Response('OK');
  }
}
```

---

## Environment Variable Checklist

### Local Development
- [ ] `.env` file created (copied from `.env.example`)
- [ ] `AUTH_TOKEN_1` set with test token
- [ ] `LOG_LEVEL` set to `debug`
- [ ] `ENVIRONMENT` set to `development`
- [ ] `.env` added to `.gitignore`

### Staging
- [ ] Variables set in Cloudflare Dashboard
- [ ] `LOG_LEVEL=info`
- [ ] `ENVIRONMENT=staging`
- [ ] Separate D1 database configured
- [ ] Separate KV namespaces configured
- [ ] Test tokens in AUTH_KV

### Production
- [ ] Variables set in Cloudflare Dashboard
- [ ] `LOG_LEVEL=info` or `warn`
- [ ] `ENVIRONMENT=production`
- [ ] Production D1 database configured
- [ ] Production KV namespaces configured
- [ ] Live tokens in AUTH_KV (sk-live-)
- [ ] All secrets encrypted
- [ ] Secrets rotated from staging

---

## Troubleshooting

### Variable Not Available

**Problem:** `env.MY_VAR is undefined`

**Solutions:**
1. Check variable set in Dashboard (for production)
2. Check `.env` file (for local)
3. Restart dev server after changing `.env`
4. Verify variable name matches exactly (case-sensitive)

### Binding Not Found

**Problem:** `env.DB is undefined`

**Solutions:**
1. Check `wrangler.toml` has binding configured
2. Verify resource created (`wrangler d1 list`)
3. Restart dev server
4. Check binding name matches in code and config

### Secret Not Working

**Problem:** Secret returns undefined

**Solutions:**
1. Verify secret set in Dashboard
2. Check secret name matches exactly
3. Redeploy after adding secret
4. Use `wrangler secret list` to verify

---

## Additional Resources

- [Cloudflare Environment Variables Docs](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Bindings Docs](https://developers.cloudflare.com/workers/configuration/bindings/)
- [Cloudflare Secrets Docs](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Setup Guide](./SETUP.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

**Need help?** See [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues.
