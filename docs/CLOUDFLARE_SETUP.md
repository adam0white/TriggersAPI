# TriggersAPI - Cloudflare Dashboard Setup Guide

Complete guide for configuring and managing TriggersAPI resources in the Cloudflare Dashboard.

## Table of Contents

- [Accessing Cloudflare Dashboard](#accessing-cloudflare-dashboard)
- [Workers & Pages Overview](#workers--pages-overview)
- [D1 Database Management](#d1-database-management)
- [KV Namespace Management](#kv-namespace-management)
- [Queues Management](#queues-management)
- [Monitoring & Analytics](#monitoring--analytics)
- [Worker Settings](#worker-settings)
- [Routes & Custom Domains](#routes--custom-domains)
- [Alerts & Notifications](#alerts--notifications)
- [Usage & Billing](#usage--billing)

---

## Accessing Cloudflare Dashboard

### 1. Log In

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Enter your email and password
3. Complete 2FA if enabled (recommended)

### 2. Navigate to Workers

1. Click **Workers & Pages** in left sidebar
2. You'll see all deployed Workers and Pages projects

### 3. Find Your Worker

- Search for `triggers-api` in the list
- Or filter by name/date

---

## Workers & Pages Overview

### Worker Dashboard Sections

After selecting your Worker, you'll see:

1. **Overview** - Quick stats and deployment info
2. **Metrics** - Performance and usage analytics
3. **Logs** - Real-time and historical logs (via Tail Workers)
4. **Settings** - Configuration and variables
5. **Triggers** - Routes, cron schedules
6. **Resources** - Bindings (D1, KV, Queues, etc.)
7. **Deployments** - Version history and rollback

---

## D1 Database Management

### Accessing D1

1. In Cloudflare Dashboard, click **D1** in left sidebar
2. You'll see all your D1 databases

### View Database Details

1. Click on `triggers-api` database
2. View:
   - **Database ID** - Unique identifier
   - **Name** - Database name
   - **Size** - Current storage usage
   - **Tables** - List of tables
   - **Queries** - Run queries in console

### Run Queries in Dashboard

1. Click **Console** tab
2. Enter SQL query:
   ```sql
   SELECT * FROM events ORDER BY created_at DESC LIMIT 10;
   ```
3. Click **Execute**
4. View results in table format

### Useful Queries

**Count total events:**
```sql
SELECT COUNT(*) as total FROM events;
```

**Count by status:**
```sql
SELECT status, COUNT(*) as count FROM events GROUP BY status;
```

**Recent events:**
```sql
SELECT event_id, status, created_at FROM events
ORDER BY created_at DESC LIMIT 20;
```

**Failed events:**
```sql
SELECT event_id, retry_count, updated_at FROM events
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

### View Schema

1. Click **Schema** tab
2. View all tables and indexes
3. See column definitions

### Backups

**Manual Export:**
1. Click **Export** button
2. Download SQL dump
3. Save securely

**Automated Backups:**
- Not available in free tier
- Enterprise plans have automatic backups

### Database Limits

**Free Tier:**
- 5 GB storage per database
- 5 million reads per day
- 100,000 writes per day

**Paid Plans:**
- See [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

---

## KV Namespace Management

### Accessing KV

1. In Cloudflare Dashboard, click **Workers** → **KV**
2. You'll see all KV namespaces

### View Namespace Details

1. Click on namespace (e.g., `AUTH_KV`)
2. View:
   - **Namespace ID** - Unique identifier
   - **Name** - Namespace name
   - **Keys** - Number of keys stored
   - **Storage** - Total storage used

### Browse Keys

1. Click **View** next to namespace
2. Browse keys with search
3. Filter by prefix

### Add/Edit Keys

**Add new key:**
1. Click **Add Entry**
2. Enter key name (e.g., `auth:sk-live-123...`)
3. Enter value (e.g., `valid`)
4. Optional: Set expiration (TTL)
5. Click **Save**

**Edit existing key:**
1. Click key name
2. Modify value
3. Click **Save**

**Delete key:**
1. Click key name
2. Click **Delete**
3. Confirm deletion

### Bulk Operations

**Import keys:**
1. Click **Import**
2. Upload JSON file with key-value pairs
3. Format:
   ```json
   [
     {"key": "auth:token1", "value": "valid"},
     {"key": "auth:token2", "value": "valid"}
   ]
   ```

**Export keys:**
1. Click **Export**
2. Download JSON file

### KV Limits

**Free Tier:**
- 100,000 reads per day
- 1,000 writes per day
- 1 GB storage

**Paid Plans:**
- See [KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)

---

## Queues Management

### Accessing Queues

1. In Cloudflare Dashboard, click **Workers** → **Queues**
2. You'll see all queues

### View Queue Details

1. Click on queue (e.g., `event-queue`)
2. View:
   - **Queue Name**
   - **Messages** - Current queue depth
   - **Consumers** - Number of consumers
   - **DLQ** - Dead Letter Queue status
   - **Throughput** - Messages per second

### Monitor Queue Depth

**Real-time monitoring:**
- Dashboard shows current queue depth
- Refresh for updates

**Historical metrics:**
- View charts for message throughput
- Identify bottlenecks

### Dead Letter Queue (DLQ)

**View DLQ messages:**
1. Click on DLQ (`event-dlq`)
2. See messages that failed after max retries
3. Investigate failure reasons

**Reprocess DLQ messages:**
- Currently requires manual reprocessing via Worker code
- Or delete and recreate via API

### Queue Limits

**Free Tier:**
- 1 million operations per day
- 10 MB message size

**Paid Plans:**
- See [Queues Pricing](https://developers.cloudflare.com/queues/platform/pricing/)

---

## Monitoring & Analytics

### Worker Metrics

1. Go to **Workers & Pages** → **Your Worker** → **Metrics**
2. View:
   - **Requests** - Total requests over time
   - **Success Rate** - Percentage of successful requests
   - **Error Rate** - Percentage of failed requests
   - **CPU Time** - Average CPU time per request
   - **Duration** - Average response time

**Time ranges:**
- Last 1 hour
- Last 24 hours
- Last 7 days
- Last 30 days

### Request Breakdown

**By Status Code:**
- 2xx (Success)
- 4xx (Client errors)
- 5xx (Server errors)

**By Country:**
- Geographic distribution of requests
- Identify traffic sources

**By Endpoint:**
- Most requested endpoints
- Identify hotspots

### Real-Time Logs

**Via Tail Workers:**
1. Go to **Workers & Pages** → **Your Worker** → **Logs (Real-time)**
2. Or use CLI: `wrangler tail`

**Log details:**
- Request/response data
- Console logs
- Errors and exceptions
- Performance metrics
- Custom log messages

**Filtering:**
- By log level (debug, info, warn, error)
- By status code
- By request method
- By custom criteria

### Historical Logs

**Logpush (Enterprise only):**
- Send logs to S3, R2, or other storage
- Long-term log retention
- Advanced analysis

---

## Worker Settings

### Environment Variables

1. Go to **Workers & Pages** → **Your Worker** → **Settings** → **Variables**
2. Add variables:
   - **Plain text** - Non-sensitive config
   - **Encrypted** - Sensitive secrets

**Add variable:**
1. Click **Add Variable**
2. Enter name and value
3. Check **Encrypt** for secrets
4. Click **Save**

**Edit variable:**
1. Click **Edit** next to variable
2. Modify value
3. Click **Save**

**Delete variable:**
1. Click **Delete** next to variable
2. Confirm deletion

### Bindings

1. Go to **Resources** tab
2. View all bindings:
   - D1 Databases
   - KV Namespaces
   - Queues
   - Workflows
   - Service Bindings

**Add binding:**
1. Click **Add Binding**
2. Select type (D1, KV, Queue, etc.)
3. Choose resource
4. Enter binding name (e.g., `DB`)
5. Click **Save**

**Remove binding:**
1. Click **Remove** next to binding
2. Confirm removal

### Compatibility Dates

View and update Worker compatibility date:
- Determines which features and behaviors are available
- Update for new features

---

## Routes & Custom Domains

### View Routes

1. Go to **Workers & Pages** → **Your Worker** → **Triggers**
2. View configured routes

### Add Route

1. Click **Add Route**
2. Enter route pattern (e.g., `https://api.yourdomain.com/*`)
3. Select zone (domain)
4. Click **Save**

### Custom Domain Setup

**Prerequisites:**
- Domain added to Cloudflare
- DNS configured

**Steps:**
1. Add route with custom domain pattern
2. Configure DNS:
   - Type: CNAME
   - Name: api (or subdomain)
   - Target: your-worker.workers.dev
   - Proxy: Enabled (orange cloud)
3. SSL/TLS: Full (strict) recommended

### Workers.dev Subdomain

Every Worker gets a free subdomain:
- Format: `your-worker.your-subdomain.workers.dev`
- Can be disabled for security

---

## Alerts & Notifications

### Configure Alerts

1. Go to **Notifications** in top navigation
2. Click **Add**
3. Select alert type:
   - Workers error rate
   - Workers requests per second
   - D1 usage
   - KV usage
   - Queue depth

**Example: Error Rate Alert**
1. Select "Workers error rate"
2. Set threshold (e.g., > 1%)
3. Set time window (e.g., 5 minutes)
4. Click **Next**

### Notification Channels

**Email:**
- Enter email address
- Verify email

**Webhook:**
- Enter webhook URL
- Configure payload format

**PagerDuty (Enterprise):**
- Integrate with PagerDuty
- Configure incident routing

### Alert Best Practices

- Set error rate alerts (> 1% for 5 min)
- Set CPU time alerts (approaching limits)
- Set queue depth alerts (backlog building)
- Test alerts to verify delivery

---

## Usage & Billing

### View Usage

1. Go to **Workers & Pages** → **Plans and Usage**
2. View current usage:
   - Workers requests
   - Workers CPU time
   - D1 reads/writes
   - KV operations
   - Queue operations

### Usage Limits

**Free Tier:**
- 100,000 requests per day
- 10 ms CPU time per request
- D1: 5M reads, 100K writes per day
- KV: 100K reads, 1K writes per day
- Queues: 1M operations per day

**Paid Plans:**
- Workers Paid: $5/month + usage
- Unmetered: Higher limits
- Enterprise: Custom pricing

### Monitor Costs

1. View estimated costs in Dashboard
2. Set spending limits (if available)
3. Review monthly invoices

### Optimize Usage

**Reduce costs:**
- Optimize database queries (add indexes)
- Cache frequently accessed data in KV
- Use batch operations for queues
- Minimize CPU time (optimize code)
- Use Workers Analytics to identify bottlenecks

---

## Worker Versions & Rollback

### View Deployments

1. Go to **Workers & Pages** → **Your Worker** → **Deployments**
2. View deployment history:
   - Deployment ID
   - Timestamp
   - Author
   - Status

### Rollback

**Via Dashboard:**
1. Click **Rollback** next to previous deployment
2. Confirm rollback
3. Monitor metrics after rollback

**Via CLI:**
```bash
wrangler rollback
```

### Version Management

- Cloudflare keeps deployment history
- Can roll back to any previous version
- Gradual rollout for new versions

---

## Security Settings

### Access Control

**API Tokens:**
1. Go to **My Profile** → **API Tokens**
2. Create scoped tokens
3. Rotate tokens regularly

**Account Access:**
- Manage team members
- Set role-based permissions
- Enable 2FA (required)

### Rate Limiting

**Via Cloudflare Firewall:**
1. Go to **Security** → **WAF**
2. Configure rate limiting rules
3. Set thresholds per IP

**Via Worker Code:**
- Implement custom rate limiting
- Use KV to track request counts

### DDoS Protection

Cloudflare provides automatic DDoS protection:
- Layer 3/4 protection
- Layer 7 (HTTP) protection
- Always enabled

---

## Best Practices

### Dashboard Usage

- ✅ Check metrics daily
- ✅ Set up alerts for critical thresholds
- ✅ Review logs regularly
- ✅ Monitor queue depth
- ✅ Check D1 storage usage
- ✅ Rotate API tokens quarterly
- ✅ Back up D1 database before major changes
- ✅ Test in staging before production

### Performance Monitoring

- Watch CPU time (optimize if approaching limits)
- Monitor response times (target < 200ms)
- Check error rates (target < 0.1%)
- Identify slow queries in D1
- Optimize KV usage (cache effectively)

### Security

- Use encrypted variables for secrets
- Restrict API token permissions
- Enable 2FA for all accounts
- Review access logs
- Update dependencies regularly

---

## Troubleshooting via Dashboard

### High Error Rate

1. Check **Metrics** → Error rate chart
2. View **Logs** for error messages
3. Identify failing endpoints
4. Check recent deployments (rollback if needed)

### Slow Performance

1. Check **Metrics** → CPU time and duration
2. Identify slow endpoints
3. Review D1 queries (add indexes)
4. Check KV cache hit rate

### Queue Backlog

1. Check **Queues** → Queue depth
2. View DLQ for failed messages
3. Increase consumer concurrency
4. Optimize consumer code

---

## Additional Resources

- [Cloudflare Dashboard Docs](https://developers.cloudflare.com/fundamentals/account-and-billing/)
- [Workers Dashboard Guide](https://developers.cloudflare.com/workers/observability/)
- [D1 Dashboard Guide](https://developers.cloudflare.com/d1/observability/)
- [Setup Guide](./SETUP.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Need help?** Contact Cloudflare Support or visit [Community Forums](https://community.cloudflare.com/).
