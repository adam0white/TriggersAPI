# Zapier Webhook Monitoring & Operations

## Overview

This guide covers monitoring, debugging, and operating Zapier webhooks in production. It provides operational runbooks, alert configurations, and disaster recovery procedures for DevOps and SRE teams.

## Metrics to Monitor

### Delivery Success Rate

Track webhook delivery success percentage:

```sql
-- Query from D1 zapier_webhooks table
SELECT
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_webhooks,
  COUNT(CASE WHEN status = 'failing' THEN 1 END) as failing_webhooks,
  COUNT(*) as total_webhooks,
  ROUND(
    CAST(COUNT(CASE WHEN status = 'active' THEN 1 END) AS FLOAT) /
    CAST(COUNT(*) AS FLOAT) * 100,
    2
  ) as success_rate_percent
FROM zapier_webhooks
WHERE status IN ('active', 'failing');
```

**Target:** ≥99% success rate
**Alert threshold:** <95%
**Critical threshold:** <90%

### Webhook Status Distribution

Monitor webhook health status:

```sql
SELECT status, COUNT(*) as count
FROM zapier_webhooks
GROUP BY status;
```

Expected distribution:
- `status='active'`: >95% of total webhooks
- `status='failing'`: <5% of total webhooks
- `status='inactive'`: User-disabled webhooks (not counted in success rate)

### Delivery Latency

Monitor end-to-end delivery latency:

**Typical latency:** 2-10 seconds
- Event received at /events: 0s
- Event delivered to Zapier: 2-5s
- Zapier executes action: 3-10s
- Total: 5-15s

**Alert thresholds:**
- Warning: >30s average
- Critical: >60s average

### Failed Delivery Analysis

Query dead letter queue for failures:

```
ZAPIER_DLQ keys pattern: dlq-{webhook_id}-{event_id}

Fields stored in KV:
- webhook_id: Which webhook failed
- event_id: Which event delivery failed
- error: Failure reason
- status_code: HTTP status code
- timestamp: When failure occurred
- retry_count: Number of retry attempts
```

Common failure types:
- Timeout (HTTP 408, network timeout)
- 5xx errors (Zapier server errors)
- Network unreachable
- TLS certificate errors
- Invalid webhook URL

## Debugging Webhooks

### Check Webhook Subscription

```bash
# Query D1 for webhook details
npx wrangler d1 execute triggers-api --command \
  "SELECT id, url, status, last_error, retry_count, created_at
   FROM zapier_webhooks
   WHERE id = 'webhook_id';"

# Look for:
# - id: Webhook ID
# - url: Zapier hook URL
# - status: active/failing/inactive
# - last_error: Last failure message
# - retry_count: Number of retry attempts
# - created_at: When webhook was created
```

### Verify Webhook Delivery

```bash
# Test webhook manually
curl -X POST https://hooks.zapier.com/hooks/catch/abc123/ \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_manual_test",
    "event_type": "test",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "payload": {"test": true},
    "metadata": {},
    "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Expected: 2xx response from Zapier
# Zapier may return: 200 OK with empty body or {"status": "ok"}
```

### Check Delivery Logs

Query D1 for webhook activity:

```sql
-- Find recent webhook activity
SELECT *
FROM zapier_webhooks
WHERE updated_at > datetime('now', '-1 hour')
ORDER BY updated_at DESC;

-- Find webhooks with high retry counts
SELECT id, url, status, retry_count, last_error
FROM zapier_webhooks
WHERE retry_count > 2
ORDER BY retry_count DESC;
```

View Cloudflare Worker logs:

```bash
# Tail live logs
npx wrangler tail

# Filter for Zapier-related logs
npx wrangler tail --format pretty | grep -i zapier

# Look for:
# - "Webhook delivery failed" messages
# - "Webhook marked as failing" messages
# - HTTP status codes (200, 500, etc.)
```

## Operations

### Recovering Failing Webhooks

If webhook status='failing':

#### Option 1: Wait for auto-recovery (recommended)

Webhook automatically re-tested on next event delivery. Status changes back to 'active' if successful.

```
How it works:
1. Webhook marked as 'failing' after 4 failed delivery attempts
2. On next event, TriggersAPI attempts delivery again
3. If delivery succeeds, status → 'active', retry_count → 0
4. If delivery fails, status stays 'failing'
```

#### Option 2: Manual re-activation

```bash
# Reset webhook to active status
npx wrangler d1 execute triggers-api --command \
  "UPDATE zapier_webhooks
   SET status = 'active',
       last_error = NULL,
       retry_count = 0
   WHERE id = 'webhook_id';"
```

**Use when:** You know the issue is resolved (e.g., Zapier was temporarily down)

#### Option 3: Delete and resubscribe

```bash
# Delete webhook from D1
npx wrangler d1 execute triggers-api --command \
  "DELETE FROM zapier_webhooks WHERE id = 'webhook_id';"

# User must re-create Zap to resubscribe
```

**Use when:** Webhook URL is permanently invalid or user wants fresh start

### Webhook Cleanup

Remove stale/inactive webhooks:

```bash
# Find inactive webhooks (not updated in 30 days)
npx wrangler d1 execute triggers-api --command \
  "SELECT id, url, status, updated_at
   FROM zapier_webhooks
   WHERE status = 'inactive'
   OR (updated_at < datetime('now', '-30 days')
       AND status = 'failing');"

# Delete them (use with caution)
npx wrangler d1 execute triggers-api --command \
  "DELETE FROM zapier_webhooks
   WHERE status = 'inactive'
   OR (updated_at < datetime('now', '-30 days')
       AND status = 'failing');"
```

**Best practice:** Run cleanup monthly to reduce database size

### Rate Limiting Adjustments

Current rate limit: 100 subscriptions per IP per hour

To adjust, update `src/routes/zapier.ts`:

```typescript
// Current implementation (in-memory)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MAX = 100; // subscriptions per hour
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
```

For persistent rate limiting, migrate to D1-based limiter:

```sql
-- Create rate limit table
CREATE TABLE IF NOT EXISTS zapier_rate_limits (
  ip_address TEXT PRIMARY KEY,
  subscription_count INTEGER DEFAULT 0,
  window_start_at TEXT NOT NULL
);
```

Configuration via environment variables (future enhancement):

```toml
# wrangler.toml
[vars]
ZAPIER_RATE_LIMIT_SUBSCRIPTIONS = "100"
ZAPIER_RATE_LIMIT_WINDOW_HOURS = "1"
```

## Alerts & Escalation

### Alert Rules

Configure these alerts in your monitoring system (e.g., Cloudflare Workers Analytics, Datadog, PagerDuty):

```yaml
alerts:
  - name: "Webhook Success Rate Critical"
    condition: success_rate < 90%
    severity: critical
    action: Page on-call engineer immediately
    runbook: "#severity-1-critical"

  - name: "Webhook Success Rate Warning"
    condition: success_rate >= 90% AND success_rate < 95%
    severity: warning
    action: Create ticket, notify on-call
    runbook: "#severity-2-high"

  - name: "Webhook Success Rate Degraded"
    condition: success_rate >= 95% AND success_rate < 99%
    severity: info
    action: Log ticket for review
    runbook: "#severity-3-medium"

  - name: "High Webhook Volume"
    condition: active_webhooks > 10000
    severity: info
    action: Notify ops team (scaling concern)
    runbook: "#scaling-webhooks"

  - name: "High Failure Rate"
    condition: failing_webhooks > 20% of total
    severity: critical
    action: Page on-call engineer
    runbook: "#investigate-failures"

  - name: "DLQ Size Critical"
    condition: dlq_size > 10000
    severity: warning
    action: Notify ops team
    runbook: "#dlq-cleanup"
```

### Escalation Path

#### Severity 1 (Critical): Success rate < 90%

- **Trigger:** Page on-call engineer immediately
- **Action:** Investigate root cause, check infrastructure
- **Rollback:** May require emergency hotfix or rollback
- **Communication:** Post status page update
- **Timeline:** Resolve within 1 hour

**Runbook:**
1. Check Cloudflare Workers status page
2. Check Zapier platform status
3. Review recent deployments
4. Check D1 database health
5. Review error logs for patterns
6. If infrastructure issue: engage Cloudflare support
7. If code issue: rollback to last known good version

#### Severity 2 (High): Success rate 90-95%

- **Trigger:** Ticket created, on-call reviews within 1 hour
- **Action:** Identify affected webhooks, plan recovery
- **Mitigation:** Adjust rate limiting, disable problematic webhooks
- **Timeline:** Resolve within 4 hours

**Runbook:**
1. Query failing webhooks
2. Check for common patterns in errors
3. Test sample webhook manually
4. Re-activate failing webhooks if transient issue
5. Monitor success rate improvement

#### Severity 3 (Medium): Success rate 95-99%

- **Trigger:** Logged as ticket
- **Action:** Monitor trend, review in daily standup
- **Follow-up:** Root cause analysis
- **Timeline:** Resolve within 24 hours

**Runbook:**
1. Document failure patterns
2. Check if specific webhook URLs causing issues
3. Review logs for error trends
4. Plan preventive measures

## Maintenance Tasks

### Daily Checks

```bash
# Check overall health
npx wrangler d1 execute triggers-api --command \
  "SELECT
     COUNT(*) as total_webhooks,
     COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
     COUNT(CASE WHEN status = 'failing' THEN 1 END) as failing,
     COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive
   FROM zapier_webhooks;"

# Expected results:
# - active: >95% of total
# - failing: <5% of total
# - inactive: User-disabled (variable)

# Check for recent failures
npx wrangler d1 execute triggers-api --command \
  "SELECT COUNT(*) as failures_last_24h
   FROM zapier_webhooks
   WHERE status = 'failing'
   AND updated_at > datetime('now', '-24 hours');"
```

### Weekly Reviews

- Verify success rate >99%
- Check for any inactive webhooks that can be cleaned up
- Review largest event payloads (optimization opportunity)
- Check for any rate limit violations from same IP
- Review error logs for patterns
- Check DLQ size (should be minimal)

```bash
# Weekly report query
npx wrangler d1 execute triggers-api --command \
  "SELECT
     DATE(created_at) as date,
     COUNT(*) as new_webhooks
   FROM zapier_webhooks
   WHERE created_at > datetime('now', '-7 days')
   GROUP BY DATE(created_at)
   ORDER BY date DESC;"
```

### Monthly Reviews

- Analyze delivery latency trends
- Review webhook growth rate
- Assess infrastructure capacity
- Plan for scaling if needed
- Review security incidents
- Update documentation based on issues

**Capacity planning:**
```
Current: X active webhooks
Growth rate: Y% per month
Projected (6 months): X * (1 + Y/100)^6
Action needed if: Projected > 50000 webhooks
```

## Disaster Recovery

### If Webhook Delivery Completely Down

#### 1. Immediate Response

```bash
# Disable new webhook subscriptions (rate limit to 0)
# Edit src/routes/zapier.ts temporarily:
const RATE_LIMIT_MAX = 0; // Block new subscriptions

# Deploy emergency fix
npm run deploy

# Notify users via status page
# Example: "Zapier integration temporarily unavailable. Investigating."
```

#### 2. Investigation

Identify root cause:

```bash
# Check TriggersAPI logs
npx wrangler tail --format pretty | grep -i error

# Check Zapier platform status
curl https://status.zapier.com/api/v2/status.json

# Check network connectivity to Zapier
curl -I https://hooks.zapier.com/

# Check D1 database health
npx wrangler d1 execute triggers-api --command "SELECT COUNT(*) FROM zapier_webhooks;"

# Check recent deployments
git log -5 --oneline
```

Common causes:
- Cloudflare Workers outage
- D1 database issue
- Zapier platform issue
- Code bug in webhook delivery
- Network connectivity issue

#### 3. Recovery

Once root cause fixed:

```bash
# Re-enable webhook subscriptions
# Revert RATE_LIMIT_MAX to 100
const RATE_LIMIT_MAX = 100;

# Deploy fix
npm run deploy

# Re-activate failed webhooks
npx wrangler d1 execute triggers-api --command \
  "UPDATE zapier_webhooks
   SET status = 'active',
       retry_count = 0,
       last_error = NULL
   WHERE status = 'failing';"

# Monitor delivery for 24 hours
# Check logs and success rate hourly
```

#### 4. Post-Incident Review

Document what happened:
- Timeline of events
- Root cause analysis
- Impact assessment (how many users affected)
- Preventive measures
- Updated runbooks
- Communication summary

### If DLQ Gets Too Large

DLQ grows when webhooks are consistently failing.

```bash
# Check DLQ size (requires KV access)
npx wrangler kv:key list --namespace-id YOUR_DLQ_NAMESPACE_ID --prefix "dlq-"

# If >1000 entries:
# 1. Investigate why webhooks failing
npx wrangler d1 execute triggers-api --command \
  "SELECT last_error, COUNT(*) as count
   FROM zapier_webhooks
   WHERE status = 'failing'
   GROUP BY last_error
   ORDER BY count DESC;"

# 2. Fix root cause (see above)

# 3. Once stable, clean up old DLQ entries
# WARNING: This deletes failed event records permanently

# Clean up entries older than 7 days
# (Manual KV cleanup script needed)
```

**Prevention:**
- Monitor DLQ size daily
- Alert when DLQ size > 100 entries
- Investigate patterns in failures
- Fix systemic issues proactively

## Performance Optimization

### Webhook Delivery Batching (Future Enhancement)

Current implementation: Each webhook delivered individually (fire-and-forget)

Future optimization:
```typescript
// Batch multiple events per webhook delivery
const batchEvents = async (webhook, events) => {
  const response = await fetch(webhook.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }) // Array of events
  });
  return response;
};
```

Benefits:
- Reduce HTTP requests
- Lower bandwidth usage
- Faster delivery for high-volume webhooks

### Database Indexing

Ensure proper indexes exist:

```sql
-- Verify indexes (already created in schema)
SELECT name, sql
FROM sqlite_master
WHERE type = 'index'
AND tbl_name = 'zapier_webhooks';

-- Expected indexes:
-- 1. idx_zapier_webhooks_status (on status)
-- 2. idx_zapier_webhooks_url (on url)
-- 3. idx_zapier_webhooks_created_at (on created_at)
```

If missing, create:

```sql
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_status
  ON zapier_webhooks(status);

CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_url
  ON zapier_webhooks(url);

CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_created_at
  ON zapier_webhooks(created_at);
```

### KV Caching (Future Enhancement)

Consider caching webhook list in KV:

```typescript
// Cache active webhooks in KV for faster lookup
const cacheWebhooks = async (env) => {
  const webhooks = await db.getActiveWebhooks(env.DB);
  await env.WEBHOOK_CACHE.put(
    'active_webhooks',
    JSON.stringify(webhooks),
    { expirationTtl: 300 } // 5 minutes
  );
};

// Invalidate cache on subscribe/unsubscribe
const invalidateCache = async (env) => {
  await env.WEBHOOK_CACHE.delete('active_webhooks');
};
```

Benefits:
- Reduces D1 queries
- Faster delivery
- Lower latency

Considerations:
- Needs invalidation on subscribe/unsubscribe
- Eventual consistency (max 5 minutes)
- Increases KV usage

## Security Monitoring

### Monitor for Abuse

Watch for suspicious patterns:

```sql
-- Check for excessive subscriptions from same IP (requires logging)
-- (Future enhancement: Store IP addresses in subscriptions)

-- Check for unusual webhook URLs
SELECT url, COUNT(*) as count
FROM zapier_webhooks
WHERE url NOT LIKE '%hooks.zapier.com%'
GROUP BY url
ORDER BY count DESC;

-- Check for rapid subscription/unsubscription
SELECT DATE(created_at) as date, COUNT(*) as subscriptions
FROM zapier_webhooks
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

### Rate Limit Violations

Monitor rate limit violations:

```bash
# Check Cloudflare Worker logs for 429 responses
npx wrangler tail --format pretty | grep "429"

# Identify IPs hitting rate limits (requires logging enhancement)
# Current: Rate limiting is in-memory, no persistent logs
# Future: Log rate limit violations to KV or D1
```

## Deployment Checklist

Before deploying Zapier integration changes:

- [ ] Run all tests: `npm run test`
- [ ] Test webhook subscribe/unsubscribe flow
- [ ] Test webhook delivery with sample event
- [ ] Verify rate limiting works
- [ ] Check security validation (HTTPS URLs only)
- [ ] Review error handling and retry logic
- [ ] Update documentation if API changed
- [ ] Create rollback plan
- [ ] Notify team of deployment
- [ ] Monitor logs for 1 hour post-deployment
- [ ] Check success rate remains >99%

## Runbook Quick Reference

| Issue | Quick Fix | Details |
|-------|-----------|---------|
| Success rate < 90% | Check infrastructure status | [Severity 1](#severity-1-critical) |
| Webhook failing | Re-activate manually | [Recovering Failing Webhooks](#recovering-failing-webhooks) |
| DLQ too large | Investigate failures, clean up | [DLQ Cleanup](#if-dlq-gets-too-large) |
| Rate limit hit | Wait 1 hour or adjust limit | [Rate Limiting](#rate-limiting-adjustments) |
| Delivery timeout | Check Zapier status, retry | [Debugging](#debugging-webhooks) |
| Duplicate subscription | Delete old, create new | [Troubleshooting](./ZAPIER_INTEGRATION.md#duplicate-webhook-subscriptions) |

## Related Documentation

- [Zapier Integration Guide](./ZAPIER_INTEGRATION.md) - User-facing integration guide
- [Event Delivery Implementation](../stories/8.3-zapier-event-delivery.md) - Technical implementation
- [Security & Validation](../stories/8.4-zapier-security.md) - Security details
- [API Documentation](./API.md) - Complete API reference
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - General troubleshooting
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - System architecture

## Metrics Dashboard (Recommended)

Set up a monitoring dashboard with these metrics:

```yaml
dashboard:
  - title: "Zapier Webhook Health"
    metrics:
      - name: "Active Webhooks"
        query: "SELECT COUNT(*) FROM zapier_webhooks WHERE status='active'"
        type: gauge

      - name: "Failing Webhooks"
        query: "SELECT COUNT(*) FROM zapier_webhooks WHERE status='failing'"
        type: gauge
        alert: "> 5% of total"

      - name: "Success Rate"
        query: "SELECT (active / total * 100) FROM webhook_stats"
        type: percentage
        alert: "< 99%"

      - name: "Delivery Latency"
        query: "AVG(delivery_time_ms)"
        type: gauge
        alert: "> 30000ms"

      - name: "DLQ Size"
        query: "KV key count with prefix 'dlq-'"
        type: gauge
        alert: "> 100"
```

## Contact & Support

For operational issues:
- **On-call Engineer:** [PagerDuty escalation]
- **Ops Team:** [Slack #ops-alerts]
- **Cloudflare Support:** [Support portal]
- **Zapier Status:** https://status.zapier.com/

For questions about this runbook:
- Update this documentation with learnings
- Share operational insights with team
- Propose improvements via PR
