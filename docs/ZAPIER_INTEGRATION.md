# TriggersAPI Zapier Integration Guide

## Overview

TriggersAPI integrates with Zapier via REST Hook triggers, enabling you to:
- Receive TriggersAPI events in 6,000+ Zapier-connected apps
- Send events to Slack, Gmail, Notion, HubSpot, and more
- Build custom workflows without writing code
- Trigger actions based on event type, timestamp, or payload

## Quick Start

### 1. Create Your First Zap

a) Go to https://zapier.com/app/dashboard
b) Click "Create" → "Create Zap"
c) Choose trigger: "TriggersAPI"
d) Select: "Event Received"
e) Connect your TriggersAPI instance (provide API endpoint URL)
f) Test trigger to verify connection
g) Choose an action (e.g., "Slack" → "Send Direct Message")
h) Configure action using event fields (see Field Mapping below)
i) Test action
j) Turn on Zap

### 2. Send Your First Event

```bash
curl -X POST https://your-triggersapi.com/events \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "payment_received",
    "payload": {
      "amount": 100,
      "currency": "USD",
      "customer": "John Doe"
    }
  }'
```

### 3. Verify in Your App

Within seconds, the event should trigger your action:
- Check Slack for DM
- Check Gmail for email
- Check Notion for database entry
- etc.

## Architecture

### Event Flow

```
1. Event ingested at POST /events
   ↓
2. Event queued for processing
   ↓
3. Event stored in D1 database
   ↓
4. Event delivered to all active Zapier webhooks
   ↓
5. Zapier receives event and triggers configured actions
   ↓
6. Actions execute in connected apps (Slack, Gmail, etc)
```

### Webhook Lifecycle

#### Subscribe (Zap Creation)

```
Zapier → POST /zapier/hook
{ "url": "https://hooks.zapier.com/hooks/catch/abc123/" }

TriggersAPI → 201 Created
{ "status": "success", "id": "webhook_id", "url": "..." }

Backend: Webhook URL stored in D1 zapier_webhooks table
Status: 'active'
```

#### Test (Zap Validation)

```
Zapier → GET /zapier/hook

TriggersAPI → 200 OK
{
  "event_id": "evt_test_...",
  "event_type": "test_event",
  "timestamp": "2025-11-12T14:30:00Z",
  "payload": {...},
  "metadata": {...}
}

Purpose: Validates integration working, returns sample data
```

#### Deliver (Event Happens)

```
TriggersAPI → POST https://hooks.zapier.com/.../
{
  "event_id": "evt_abc123",
  "event_type": "payment_received",
  "timestamp": "2025-11-12T14:35:00Z",
  "payload": {...},
  "metadata": {...}
}

Zapier → 200 OK
(empty body or {"status": "ok"})

Retry: If 5xx or timeout, exponential backoff (2s, 4s, 8s, 16s)
After 4 failed attempts: webhook marked as 'failing'
```

#### Unsubscribe (Zap Deleted)

```
Zapier → DELETE /zapier/hook
{ "url": "https://hooks.zapier.com/hooks/catch/abc123/" }

TriggersAPI → 200 OK
{ "status": "success", "message": "Webhook subscription removed" }

Backend: Webhook URL deleted from D1 zapier_webhooks table
```

## API Reference

### Endpoints

#### POST /zapier/hook

**Subscribe to receive events**

Request:
```bash
POST /zapier/hook
Content-Type: application/json
X-Zapier-Signature: sha256=...

{
  "url": "https://hooks.zapier.com/hooks/catch/abc123/"
}
```

Response (201 Created):
```json
{
  "status": "success",
  "id": "webhook_id_uuid",
  "url": "https://hooks.zapier.com/hooks/catch/abc123/",
  "message": "Webhook subscription created"
}
```

Error Responses:
- 400: Invalid URL or missing field
- 409: Webhook already subscribed (duplicate)
- 429: Rate limit exceeded (max 100 per hour per IP)
- 500: Server error

#### GET /zapier/hook

**Test webhook connectivity**

Request:
```bash
GET /zapier/hook
```

Response (200 OK):
```json
{
  "event_id": "evt_test_1699822200000",
  "event_type": "test_event",
  "timestamp": "2025-11-12T14:30:00.000Z",
  "payload": {
    "message": "Sample test event from TriggersAPI",
    "source": "zapier_test"
  },
  "metadata": {
    "correlation_id": "corr_test_abc-123",
    "source_ip": "192.0.2.1",
    "user_agent": "Zapier/1.0"
  },
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

Headers:
- `X-Zapier-Signature: sha256=...` (if signing enabled)

#### DELETE /zapier/hook

**Unsubscribe from events**

Request:
```bash
DELETE /zapier/hook
Content-Type: application/json
X-Zapier-Signature: sha256=...

{
  "url": "https://hooks.zapier.com/hooks/catch/abc123/"
}
```

Response (200 OK):
```json
{
  "status": "success",
  "message": "Webhook subscription removed"
}
```

Error Responses:
- 400: Invalid URL or missing field
- 404: Webhook not found
- 401: Invalid signature
- 500: Server error

## Field Mapping

Events sent to Zapier follow this schema:

```typescript
interface ZapierEvent {
  event_id: string;        // Unique event identifier (evt_*)
  event_type: string;      // Event category/type
  timestamp: string;       // ISO-8601 timestamp when event occurred
  payload: {
    [key: string]: unknown // Custom event data
  };
  metadata: {
    correlation_id?: string;  // For tracing across systems
    source_ip?: string;       // Client IP that created event
    user_agent?: string;      // HTTP user agent
  };
  created_at: string;      // ISO-8601 timestamp when event was created
}
```

### Example Payload

```json
{
  "event_id": "evt_1699822200000_abc",
  "event_type": "payment_received",
  "timestamp": "2025-11-12T14:30:00.000Z",
  "payload": {
    "amount": 150.00,
    "currency": "USD",
    "customer_id": "cust_123",
    "customer_name": "John Doe",
    "payment_method": "credit_card",
    "invoice_id": "inv_456"
  },
  "metadata": {
    "correlation_id": "req_789",
    "source_ip": "203.0.113.42"
  },
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

### Mapping in Zapier

In your Zap action, you can use these fields:

- `{event_id}` - Maps to event_id field
- `{event_type}` - Maps to event_type field
- `{timestamp}` - Maps to timestamp field
- `{created_at}` - Maps to created_at field
- `{payload.field_name}` - Maps to custom payload fields
- `{metadata.correlation_id}` - Maps to correlation ID
- etc.

Example Slack message using mapping:
```
Event #{event_id} received
Type: {event_type}
Time: {timestamp}
Details: {payload}
```

## Security

### HTTPS Required

All webhook URLs must use HTTPS (no HTTP). This ensures:
- Encrypted communication
- Authentication via TLS certificates
- Protection against man-in-the-middle attacks

### Signature Verification (Optional)

If configured, webhook requests include `X-Zapier-Signature` header:

```
X-Zapier-Signature: sha256=abcd1234...
```

To verify:
```bash
# Get the payload from request body
PAYLOAD=$(cat)

# Get secret from environment
SECRET=$ZAPIER_SIGNING_SECRET

# Compute expected signature
EXPECTED=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

# Compare with header value (without "sha256=" prefix)
```

### Rate Limiting

- Maximum 100 webhook subscriptions per IP per hour
- Prevents abuse and DoS attempts
- Rate limit resets hourly

### Authentication

Zapier integration uses standard authentication for webhook management:
- Bearer token in Authorization header
- API key validation
- Per-tenant secret verification (in multi-tenant setup)

## Troubleshooting

### "Test trigger" fails with "No sample found"

**Cause:** TriggersAPI webhook endpoint not responding

**Solution:**
1. Check TriggersAPI is running: `npm run dev` (development)
2. Verify Cloudflare Workers deployment (production)
3. Check firewall/network connectivity
4. Verify API key authentication is correct
5. Check TriggersAPI logs for errors

### Slack message not arriving

**Cause:** Webhook delivery failed or Slack not authorized

**Solution:**
1. Check Zapier task history: go to Zap → View status
2. Look for delivery errors (usually network or timeout)
3. Verify Slack authorization: Zap → Slack action → "Change account"
4. Re-authorize if needed
5. Test action again with "Test action" button

### Event not appearing in any app

**Cause:** Webhook delivery not working

**Solution:**
1. Verify webhook subscription active: query D1 zapier_webhooks table
   ```sql
   SELECT * FROM zapier_webhooks WHERE status = 'active';
   ```
2. Check webhook delivery logs in TriggersAPI tail logs
3. Verify event being sent to /events endpoint
4. Check request body format matches schema
5. Test webhook manually with curl:
   ```bash
   curl -X POST https://your-webhook-url \
     -H "Content-Type: application/json" \
     -d '{...event payload...}'
   ```

### Rate limit error (429)

**Cause:** Too many webhook subscriptions from same IP

**Solution:**
1. This is intentional to prevent abuse
2. Limit resets hourly
3. If creating many Zaps, use different IPs or wait between creations
4. For production at scale, contact support for rate limit increase

### Duplicate webhook subscriptions

**Cause:** Same webhook URL subscribed multiple times

**Solution:**
1. Check for 409 Conflict response when subscribing
2. Query database for existing subscription:
   ```sql
   SELECT * FROM zapier_webhooks WHERE url = 'your-webhook-url';
   ```
3. Delete old subscription before creating new one
4. Use Zapier's unsubscribe flow when deleting Zaps

## Monitoring

### Webhook Health

Monitor webhook delivery success rates:

```bash
# Check webhook status in D1
SELECT
  status,
  COUNT(*) as count
FROM zapier_webhooks
GROUP BY status;

# Expected results:
# status='active': Most webhooks
# status='failing': Very few (<5%)
# status='inactive': User-disabled
```

### Active Subscriptions

Check active webhook subscriptions:

```bash
# Query D1 (admin only)
SELECT COUNT(*) as active_subscriptions
FROM zapier_webhooks
WHERE status = 'active';
```

### Failed Webhooks

Monitor failed webhook deliveries:

```bash
# Query webhooks with failures
SELECT id, url, last_error, retry_count
FROM zapier_webhooks
WHERE status = 'failing';

# Check dead letter queue for failed events
# (Requires admin access to ZAPIER_DLQ KV)
```

## Examples

### Example 1: Slack Notification

Create Zap that sends Slack DM for every event:

1. Trigger: TriggersAPI → Event Received
2. Action: Slack → Send Direct Message
3. To: @your-username
4. Message:
   ```
   {event_type} event just occurred
   Event ID: {event_id}
   Time: {timestamp}
   Details: {payload}
   ```

### Example 2: Gmail Email Archive

Create Zap that emails summary of each event:

1. Trigger: TriggersAPI → Event Received
2. Filter: event_type is "important" (optional)
3. Action: Gmail → Send Email
4. To: archive@your-domain.com
5. Subject: [Event] {event_type} - {timestamp}
6. Body:
   ```
   Event ID: {event_id}
   Type: {event_type}
   Received: {timestamp}

   Payload:
   {payload}
   ```

### Example 3: Notion Event Log

Create Zap that logs all events to Notion:

1. Trigger: TriggersAPI → Event Received
2. Action: Notion → Create Database Item
3. Map fields:
   - Event ID: {event_id}
   - Type: {event_type}
   - Timestamp: {timestamp}
   - Payload: {payload}
   - Correlation ID: {metadata.correlation_id}

### Example 4: Conditional Routing

Create Zap that routes events based on type:

1. Trigger: TriggersAPI → Event Received
2. Filter: event_type is "error"
3. Action: PagerDuty → Create Incident
4. Add another path for event_type is "success"
5. Action: Slack → Send Channel Message

### Example 5: Multi-Step Workflow

Create Zap with multiple actions per event:

1. Trigger: TriggersAPI → Event Received
2. Action 1: Slack → Send notification
3. Action 2: Google Sheets → Add row to log
4. Action 3: Airtable → Create record
5. Action 4: Webhooks → POST to external API

## Best Practices

1. **Use meaningful event_type values**
   - Examples: "order_placed", "payment_received", "user_signup"
   - Avoid generic names like "event" or "data"

2. **Include correlation IDs**
   - Helps trace events across your system
   - Include in metadata.correlation_id

3. **Validate event structure**
   - Ensure payload fields are consistent
   - Use same field names across events of same type

4. **Monitor webhook success rates**
   - Check metrics regularly
   - Alert if success rate drops below 99%

5. **Test Zaps in development first**
   - Use test events before production
   - Verify integration with sample data

6. **Keep payloads reasonable**
   - Avoid extremely large payloads (>1MB)
   - Compress or paginate if needed

7. **Set up alerts**
   - Webhook delivery failures
   - High event volume
   - Unusual event types

8. **Use filters wisely**
   - Filter by event_type to reduce noise
   - Use Zapier's built-in filters for conditional logic
   - Avoid processing irrelevant events

9. **Handle retries gracefully**
   - Zapier may retry failed deliveries
   - Ensure actions are idempotent
   - Use correlation_id to detect duplicates

10. **Document your event schema**
    - Maintain consistent field naming
    - Document expected payload structure
    - Version your event schemas if needed

## Advanced Topics

### Custom Event Filtering

Filter events in Zapier using built-in filter step:

```
Only continue if...
  event_type exactly matches "payment_received"
  AND
  payload.amount is greater than 100
```

### Event Transformation

Transform event data before sending to actions:

```
Use Formatter by Zapier:
- Input: {payload.timestamp}
- Format: Date/Time → Format (MMM DD, YYYY)
- Output: Formatted date for human reading
```

### Webhook URL Management

Best practices for webhook URLs:

- Never hardcode webhook URLs in your app
- Store URLs in database (D1 zapier_webhooks table)
- Validate URLs before storing
- Clean up stale webhooks periodically

### Error Handling

Handle webhook delivery errors:

```javascript
// Retry logic (built into TriggersAPI)
const deliverWithRetry = async (webhook, event) => {
  const maxRetries = 4;
  const delays = [2000, 4000, 8000, 16000];

  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      return; // Success
    } catch (error) {
      if (i < maxRetries - 1) {
        await sleep(delays[i]);
      }
    }
  }
  // After all retries failed, mark webhook as 'failing'
};
```

### Performance Optimization

Optimize webhook delivery:

- Batch events (future enhancement)
- Use async delivery (already implemented)
- Cache webhook list in KV (future enhancement)
- Monitor delivery latency

## Support & Feedback

For issues or feature requests:
- Check troubleshooting guide above
- Review Zapier task history for specific error messages
- Check [TriggersAPI logs](./TROUBLESHOOTING.md#viewing-logs)
- Contact TriggersAPI support with webhook IDs and timestamps

## Related Documentation

- [Zapier App Setup](./ZAPIER_APP_SETUP.md) - Create the Zapier app
- [Demo Zaps & Use Cases](./ZAPIER_DEMO_ZAPS.md) - Step-by-step Zap creation
- [Webhook Monitoring Guide](./ZAPIER_WEBHOOK_MONITORING.md) - Operations runbook
- [Quick Start Guide](./ZAPIER_DEMO_QUICK_START.md) - Get started in 45 minutes
- [Verification Checklist](./ZAPIER_VERIFICATION_CHECKLIST.md) - Testing guide
- [API Documentation](./API.md) - Complete API reference
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - System architecture

## Changelog

### Epic 8 - Zapier Integration (2025-11-12)

- Added REST Hook trigger support
- Implemented webhook subscription management
- Added event delivery with retry logic
- Implemented security and validation
- Created comprehensive documentation
- Added demo Zaps and test scripts
