# Zapier REST Hook Handshake Protocol

**Version**: 1.0.0
**Last Updated**: 2025-11-12
**Status**: Draft/Reference

## Table of Contents

1. [Overview](#overview)
2. [Webhook Lifecycle](#webhook-lifecycle)
3. [Subscribe Phase](#subscribe-phase)
4. [Test Phase](#test-phase)
5. [Delivery Phase](#delivery-phase)
6. [Unsubscribe Phase](#unsubscribe-phase)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Implementation Checklist](#implementation-checklist)

---

## Overview

The Zapier REST Hook protocol defines how TriggersAPI communicates with Zapier's webhook infrastructure to deliver real-time events. This protocol involves four distinct phases:

1. **Subscribe**: Zapier registers a webhook URL with TriggersAPI
2. **Test**: Zapier verifies the webhook is working correctly
3. **Delivery**: TriggersAPI pushes events to the registered webhook
4. **Unsubscribe**: Zapier removes the webhook when no longer needed

### Protocol Flow Diagram

```
┌─────────────┐                                    ┌──────────────┐
│   Zapier    │                                    │ TriggersAPI  │
│  Platform   │                                    │   Backend    │
└──────┬──────┘                                    └──────┬───────┘
       │                                                  │
       │  Phase 1: Subscribe                             │
       │  POST /zapier/hook                              │
       │  { "url": "https://hooks.zapier.com/..." }     │
       ├────────────────────────────────────────────────▶│
       │                                                  │
       │  Store webhook URL in database                  │
       │  ◀────────────────────────────────────────────  │
       │  200 OK { "status": "success" }                 │
       │                                                  │
       │  Phase 2: Test                                  │
       │  GET /zapier/hook/sample                        │
       ├────────────────────────────────────────────────▶│
       │                                                  │
       │  Return sample event                            │
       │  ◀────────────────────────────────────────────  │
       │  200 OK [{ sample event data }]                 │
       │                                                  │
       │  Phase 3: Delivery (when events occur)          │
       │                                                  │
       │  ◀────────────────────────────────────────────  │
       │  POST https://hooks.zapier.com/...              │
       │  { event data }                                 │
       │                                                  │
       │  200 OK { "status": "success" }                 │
       │  ────────────────────────────────────────────▶  │
       │                                                  │
       │  Phase 4: Unsubscribe                           │
       │  DELETE /zapier/hook                            │
       │  { "url": "https://hooks.zapier.com/..." }     │
       ├────────────────────────────────────────────────▶│
       │                                                  │
       │  Remove webhook URL from database               │
       │  ◀────────────────────────────────────────────  │
       │  200 OK { "status": "deleted" }                 │
       │                                                  │
```

---

## Webhook Lifecycle

### State Transitions

```
┌──────────┐  Subscribe   ┌───────────┐   Test    ┌────────┐
│   New    │─────────────▶│  Pending  │──────────▶│ Active │
│   Zap    │              │  Webhook  │           │ Webhook│
└──────────┘              └───────────┘           └────┬───┘
                                                        │
                                                        │ Events
                                                        │ Delivered
                                                        ▼
                                                   ┌────────┐
                         Unsubscribe               │ Deleted│
                         ◀─────────────────────────│ Webhook│
                                                   └────────┘
```

### State Descriptions

| State | Description | TriggersAPI Action |
|-------|-------------|-------------------|
| **New Zap** | User creates Zap with TriggersAPI trigger | None (Zapier-side only) |
| **Pending Webhook** | Zapier sends subscribe request | Store webhook URL in database with status "pending" |
| **Active Webhook** | Test passes, webhook is ready | Update status to "active", begin event delivery |
| **Deleted Webhook** | User disables/deletes Zap | Remove webhook from database, stop delivery |

---

## Subscribe Phase

### Purpose

Register a new webhook subscription when a user creates or enables a Zap with the TriggersAPI trigger.

### Request from Zapier

```http
POST /zapier/hook HTTP/1.1
Host: triggers-api.yourdomain.workers.dev
Authorization: Bearer sk_live_abc123def456
Content-Type: application/json

{
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}
```

### Request Details

| Field | Value | Description |
|-------|-------|-------------|
| **Method** | `POST` | HTTP POST request |
| **Path** | `/zapier/hook` | Webhook subscription endpoint |
| **Header: Authorization** | `Bearer {token}` | User's API key from Zapier auth |
| **Header: Content-Type** | `application/json` | JSON request body |
| **Body: url** | `https://hooks.zapier.com/...` | Unique webhook URL for this Zap |

### Expected Response from TriggersAPI

#### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

#### Duplicate Subscription (Idempotent)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  "message": "Webhook already subscribed",
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

### TriggersAPI Implementation (Story 8.2)

```typescript
// Example implementation pseudocode
async function subscribeWebhook(request: Request, env: Env) {
  // 1. Validate authentication
  const apiKey = extractBearerToken(request);
  await validateApiKey(apiKey, env.AUTH_KV);

  // 2. Parse webhook URL from body
  const body = await request.json();
  const webhookUrl = body.url;

  // 3. Validate webhook URL format
  if (!webhookUrl.startsWith('https://hooks.zapier.com/')) {
    return jsonResponse({ error: 'Invalid webhook URL' }, 400);
  }

  // 4. Check if webhook already exists (idempotent)
  const existing = await env.DB.prepare(
    'SELECT * FROM zapier_webhooks WHERE webhook_url = ?'
  ).bind(webhookUrl).first();

  if (existing) {
    return jsonResponse({
      status: 'success',
      url: webhookUrl,
      message: 'Webhook already subscribed',
      created_at: existing.created_at
    }, 200);
  }

  // 5. Store webhook in database
  const webhookId = generateId('webhook');
  await env.DB.prepare(`
    INSERT INTO zapier_webhooks (id, webhook_url, api_key, created_at, status)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    webhookId,
    webhookUrl,
    apiKey,
    new Date().toISOString(),
    'active'
  ).run();

  // 6. Return success response
  return jsonResponse({
    status: 'success',
    url: webhookUrl,
    created_at: new Date().toISOString()
  }, 200);
}
```

### Database Schema

```sql
CREATE TABLE zapier_webhooks (
  id TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_delivered_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  delivery_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0
);

CREATE INDEX idx_zapier_webhooks_status ON zapier_webhooks(status);
CREATE INDEX idx_zapier_webhooks_api_key ON zapier_webhooks(api_key);
```

---

## Test Phase

### Purpose

Zapier verifies the webhook is working by requesting sample event data. This helps users see example data in the Zap Editor.

### Request from Zapier

```http
GET /zapier/hook/sample HTTP/1.1
Host: triggers-api.yourdomain.workers.dev
Authorization: Bearer sk_live_abc123def456
```

### Request Details

| Field | Value | Description |
|-------|-------|-------------|
| **Method** | `GET` | HTTP GET request |
| **Path** | `/zapier/hook/sample` | Sample data endpoint |
| **Header: Authorization** | `Bearer {token}` | User's API key from Zapier auth |

### Expected Response from TriggersAPI

#### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "evt_12345abcde",
    "event_id": "evt_12345abcde",
    "event_type": "test_event",
    "timestamp": "2025-11-12T14:30:00.000Z",
    "payload": {
      "message": "Sample test event from TriggersAPI",
      "source": "zapier",
      "test": true
    },
    "metadata": {
      "correlation_id": "corr_abc123",
      "source_ip": "192.0.2.1",
      "user_agent": "Zapier/1.0"
    },
    "created_at": "2025-11-12T14:30:00.500Z"
  }
]
```

**Important**:
- Response MUST be an array (even with single item)
- Sample data MUST match the output fields schema
- Return 1-3 sample events (Zapier typically uses the first)

### TriggersAPI Implementation (Story 8.2)

```typescript
// Example implementation pseudocode
async function getSampleEvents(request: Request, env: Env) {
  // 1. Validate authentication
  const apiKey = extractBearerToken(request);
  await validateApiKey(apiKey, env.AUTH_KV);

  // 2. Return hardcoded sample event(s)
  const sampleEvents = [
    {
      id: 'evt_12345abcde',
      event_id: 'evt_12345abcde',
      event_type: 'test_event',
      timestamp: new Date().toISOString(),
      payload: {
        message: 'Sample test event from TriggersAPI',
        source: 'zapier',
        test: true,
        user_id: 'user_sample_123'
      },
      metadata: {
        correlation_id: 'corr_sample_abc',
        source_ip: '192.0.2.1',
        user_agent: 'Zapier/1.0'
      },
      created_at: new Date().toISOString()
    }
  ];

  return jsonResponse(sampleEvents, 200);
}
```

**Note**: In Story 8.3, you may optionally return recent real events instead of hardcoded samples, but hardcoded is simpler and always works.

---

## Delivery Phase

### Purpose

When an event is received by TriggersAPI (via `/events` endpoint), it should be delivered to all active Zapier webhooks.

### Request from TriggersAPI to Zapier

```http
POST https://hooks.zapier.com/hooks/catch/123456/abcdef/ HTTP/1.1
Content-Type: application/json

{
  "id": "evt_67890xyz",
  "event_id": "evt_67890xyz",
  "event_type": "user.signup",
  "timestamp": "2025-11-12T15:45:00.000Z",
  "payload": {
    "user_id": "user_123",
    "email": "user@example.com",
    "plan": "pro"
  },
  "metadata": {
    "correlation_id": "corr_xyz789",
    "source_ip": "203.0.113.45",
    "user_agent": "Mozilla/5.0..."
  },
  "created_at": "2025-11-12T15:45:00.250Z"
}
```

### Request Details

| Field | Value | Description |
|-------|-------|-------------|
| **Method** | `POST` | HTTP POST request |
| **URL** | `https://hooks.zapier.com/...` | Unique webhook URL from subscribe phase |
| **Header: Content-Type** | `application/json` | JSON event data |
| **Body** | Event data | Complete event matching schema |

### Expected Response from Zapier

#### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success"
}
```

**Zapier Accepted Status Codes**:
- `200 OK` - Event received and processed
- `201 Created` - Event received (some integrations)
- Any `2xx` status - Treat as success

#### Rate Limited Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "status": "throttled",
  "retry_after": 60
}
```

#### Error Response

```http
HTTP/1.1 500 Internal Server Error

{
  "error": "Internal processing error"
}
```

### TriggersAPI Implementation (Story 8.3)

```typescript
// Example implementation pseudocode
async function deliverEventToWebhooks(event: Event, env: Env) {
  // 1. Fetch all active webhooks
  const webhooks = await env.DB.prepare(
    'SELECT * FROM zapier_webhooks WHERE status = ?'
  ).bind('active').all();

  if (webhooks.results.length === 0) {
    return; // No webhooks to deliver to
  }

  // 2. Deliver to each webhook in parallel
  const deliveryPromises = webhooks.results.map(async (webhook) => {
    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        // Success - update delivery stats
        await env.DB.prepare(`
          UPDATE zapier_webhooks
          SET last_delivered_at = ?, delivery_count = delivery_count + 1
          WHERE id = ?
        `).bind(new Date().toISOString(), webhook.id).run();

        return { success: true, webhook_id: webhook.id };
      } else {
        // Non-2xx response - log failure
        await logWebhookFailure(webhook.id, response.status, env);
        return { success: false, webhook_id: webhook.id, status: response.status };
      }
    } catch (error) {
      // Network error, timeout, etc - retry later
      await logWebhookFailure(webhook.id, 0, env);
      return { success: false, webhook_id: webhook.id, error: error.message };
    }
  });

  // 3. Wait for all deliveries to complete
  const results = await Promise.allSettled(deliveryPromises);

  // 4. Log overall delivery stats
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  console.log(`Delivered event ${event.id} to ${successful}/${webhooks.results.length} webhooks`);
}
```

### Retry Strategy

**Exponential Backoff**:
- 1st retry: After 1 second
- 2nd retry: After 4 seconds (2^2)
- 3rd retry: After 9 seconds (3^2)
- After 3 failures: Move to dead-letter queue

**Retry Conditions**:
- 5xx server errors (Zapier internal error)
- Network timeouts (no response within 5 seconds)
- Connection failures (DNS, network errors)

**DO NOT Retry**:
- 4xx client errors (invalid webhook URL, bad format)
- 401/403 authentication errors (Zap deleted/disabled)
- 429 rate limit (use `Retry-After` header instead)

---

## Unsubscribe Phase

### Purpose

Remove webhook subscription when a user disables or deletes their Zap.

### Request from Zapier

```http
DELETE /zapier/hook HTTP/1.1
Host: triggers-api.yourdomain.workers.dev
Authorization: Bearer sk_live_abc123def456
Content-Type: application/json

{
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}
```

### Request Details

| Field | Value | Description |
|-------|-------|-------------|
| **Method** | `DELETE` | HTTP DELETE request |
| **Path** | `/zapier/hook` | Webhook subscription endpoint |
| **Header: Authorization** | `Bearer {token}` | User's API key from Zapier auth |
| **Header: Content-Type** | `application/json` | JSON request body |
| **Body: url** | `https://hooks.zapier.com/...` | Webhook URL to unsubscribe |

### Expected Response from TriggersAPI

#### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "deleted",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}
```

#### Webhook Not Found (Idempotent)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "deleted",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  "message": "Webhook already deleted or not found"
}
```

**Important**: Return 200 even if webhook doesn't exist (idempotent delete).

### TriggersAPI Implementation (Story 8.2)

```typescript
// Example implementation pseudocode
async function unsubscribeWebhook(request: Request, env: Env) {
  // 1. Validate authentication
  const apiKey = extractBearerToken(request);
  await validateApiKey(apiKey, env.AUTH_KV);

  // 2. Parse webhook URL from body
  const body = await request.json();
  const webhookUrl = body.url;

  // 3. Delete webhook from database
  const result = await env.DB.prepare(
    'DELETE FROM zapier_webhooks WHERE webhook_url = ?'
  ).bind(webhookUrl).run();

  // 4. Return success (even if not found - idempotent)
  return jsonResponse({
    status: 'deleted',
    url: webhookUrl,
    message: result.meta.changes === 0 ? 'Webhook already deleted or not found' : undefined
  }, 200);
}
```

---

## Error Handling

### Client Errors (4xx)

| Status | Scenario | Response | Action |
|--------|----------|----------|--------|
| **400 Bad Request** | Missing `url` field | `{"error": "Missing webhook URL"}` | Fix request format |
| **401 Unauthorized** | Invalid/missing API key | `{"error": "Invalid API key"}` | Check authentication |
| **403 Forbidden** | API key lacks permissions | `{"error": "Insufficient permissions"}` | Use correct API key |
| **422 Unprocessable Entity** | Invalid webhook URL format | `{"error": "Invalid webhook URL format"}` | Validate URL |

### Server Errors (5xx)

| Status | Scenario | Response | Action |
|--------|----------|----------|--------|
| **500 Internal Server Error** | Database error | `{"error": "Internal server error"}` | Retry request |
| **503 Service Unavailable** | Database unavailable | `{"error": "Service temporarily unavailable"}` | Retry with backoff |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "error_code": "INVALID_WEBHOOK_URL",
  "details": {
    "field": "url",
    "reason": "Must start with https://hooks.zapier.com/"
  }
}
```

---

## Security Considerations

### Authentication

- **Bearer Token**: All endpoints require valid API key in `Authorization: Bearer {token}` header
- **Token Validation**: Verify token against `AUTH_KV` namespace
- **Token Scoping**: Consider separate tokens for Zapier integration (future enhancement)

### Webhook URL Validation

```typescript
function isValidZapierWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Must be Zapier domain
    if (!parsed.hostname.endsWith('zapier.com')) {
      return false;
    }

    // Must match webhook URL pattern
    if (!parsed.pathname.startsWith('/hooks/catch/')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

### Rate Limiting

- **Subscribe/Unsubscribe**: Limit to 10 requests per minute per API key
- **Sample Endpoint**: Limit to 60 requests per minute per API key
- **Delivery**: No rate limit (internal operation)

### Signature Verification (Story 8.4)

Future enhancement: Add HMAC signature verification for webhook deliveries.

```typescript
// Future implementation
function generateWebhookSignature(payload: string, secret: string): string {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Include in delivery request
headers: {
  'Content-Type': 'application/json',
  'X-TriggersAPI-Signature': generateWebhookSignature(body, secret)
}
```

---

## Implementation Checklist

### Phase 1: Subscribe/Unsubscribe (Story 8.2)

- [ ] Create `/zapier/hook` route handler
- [ ] Implement `POST /zapier/hook` (subscribe)
- [ ] Implement `DELETE /zapier/hook` (unsubscribe)
- [ ] Implement `GET /zapier/hook/sample` (test data)
- [ ] Create `zapier_webhooks` database table
- [ ] Add authentication validation
- [ ] Add webhook URL validation
- [ ] Handle idempotent subscribe/unsubscribe
- [ ] Return proper error responses
- [ ] Write unit tests for all endpoints

### Phase 2: Event Delivery (Story 8.3)

- [ ] Implement webhook delivery logic in queue consumer
- [ ] Fetch active webhooks from database
- [ ] Deliver events via POST to webhook URLs
- [ ] Handle successful deliveries (update stats)
- [ ] Handle failed deliveries (log errors)
- [ ] Implement retry logic with exponential backoff
- [ ] Handle rate limiting (429 responses)
- [ ] Add delivery timeout (5 seconds)
- [ ] Update webhook delivery metrics
- [ ] Write integration tests for delivery

### Phase 3: Monitoring (Story 8.5)

- [ ] Track delivery success/failure rates
- [ ] Alert on sustained failures
- [ ] Dashboard metrics for webhook health
- [ ] Dead-letter queue for failed events
- [ ] Webhook status management (auto-disable on failures)

---

## Related Documentation

- [Zapier App Setup Guide](./ZAPIER_APP_SETUP.md)
- [Zapier Event Schema](./zapier-event-schema.json)
- [Zapier Trigger Configuration](./zapier-trigger-config.yaml)
- [Zapier Testing Guide](./zapier-testing-guide.md)

---

## References

- [Zapier REST Hooks Documentation](https://platform.zapier.com/build/rest-hooks)
- [Zapier Webhook Best Practices](https://platform.zapier.com/build/webhook-best-practices)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

---

**Change Log**

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-12 | Initial handshake protocol documentation |

---

*This document is part of Story 8.1 - Zapier App Setup*
