# Zapier Integration Testing Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-12
**Status**: Reference

## Table of Contents

1. [Overview](#overview)
2. [Testing Phases](#testing-phases)
3. [Phase 1: Setup & Configuration Testing](#phase-1-setup--configuration-testing)
4. [Phase 2: Endpoint Testing](#phase-2-endpoint-testing)
5. [Phase 3: Integration Testing](#phase-3-integration-testing)
6. [Phase 4: End-to-End Testing](#phase-4-end-to-end-testing)
7. [Automated Testing](#automated-testing)
8. [Load Testing](#load-testing)
9. [Troubleshooting Tests](#troubleshooting-tests)

---

## Overview

This guide provides comprehensive testing procedures for the TriggersAPI Zapier integration. Follow these tests in order to ensure all components work correctly.

### Testing Prerequisites

**Required**:
- TriggersAPI deployed and accessible (local or Cloudflare Workers)
- Valid API key stored in AUTH_KV
- Zapier Platform account
- TriggersAPI app created in Zapier (Story 8.1 complete)

**Recommended Tools**:
- `curl` or Postman for API testing
- [webhook.site](https://webhook.site) for webhook testing
- Browser DevTools for debugging
- `wrangler` CLI for Cloudflare Workers

---

## Testing Phases

### Test Matrix

| Phase | Focus | Duration | Prerequisites |
|-------|-------|----------|---------------|
| **Phase 1** | Setup & Config | 10 min | Zapier app created |
| **Phase 2** | Endpoints | 15 min | Story 8.2 complete |
| **Phase 3** | Integration | 20 min | Story 8.3 complete |
| **Phase 4** | End-to-End | 30 min | All stories complete |

---

## Phase 1: Setup & Configuration Testing

**Objective**: Verify Zapier app configuration is correct

### Test 1.1: Authentication Configuration

**Test Steps**:
1. Log in to Zapier Platform
2. Navigate to your TriggersAPI app
3. Go to **Authentication** section

**Verification Checklist**:
- [ ] Authentication type is "API Key"
- [ ] Field key is `api_key`
- [ ] Field label is "API Key"
- [ ] Input format is "password" (masked)
- [ ] Help text is present and clear
- [ ] Test URL is `{{BASE_URL}}/inbox`
- [ ] Authorization header format: `Bearer {{bundle.authData.api_key}}`
- [ ] Connection label shows last 4 characters only

**Expected Result**: All configuration fields match specification

📸 **Screenshot**: Save configuration page for documentation

---

### Test 1.2: Trigger Configuration

**Test Steps**:
1. Navigate to **Triggers** section
2. Select "Event Received" trigger

**Verification Checklist**:
- [ ] Trigger key is `event`
- [ ] Trigger name is "Event Received"
- [ ] Trigger type is "REST Hook"
- [ ] Subscribe URL is `{{BASE_URL}}/zapier/hook` (POST)
- [ ] Unsubscribe URL is `{{BASE_URL}}/zapier/hook` (DELETE)
- [ ] Poll URL is `{{BASE_URL}}/zapier/hook/sample` (GET)
- [ ] Output fields include: id, event_id, event_type, timestamp, payload, metadata, created_at
- [ ] Sample data is provided

**Expected Result**: All trigger configuration matches specification

📸 **Screenshot**: Save trigger configuration for documentation

---

### Test 1.3: Output Fields Schema

**Test Steps**:
1. In trigger configuration, review output fields

**Verification Checklist**:
- [ ] `id` field is string, required
- [ ] `event_id` field is string
- [ ] `event_type` field is string
- [ ] `timestamp` field is string (date-time)
- [ ] `payload` field is object
- [ ] `metadata` field is object
- [ ] `created_at` field is string (date-time)
- [ ] All fields have help text

**Expected Result**: Schema matches `zapier-event-schema.json`

---

## Phase 2: Endpoint Testing

**Objective**: Test each backend endpoint independently

**Prerequisites**: Story 8.2 complete (endpoints implemented)

### Test 2.1: Authentication Test Endpoint

**Test**: Verify `/inbox` endpoint validates authentication

#### Valid Token Test

```bash
# Setup
export BASE_URL="http://localhost:8787"  # or deployed URL
export API_KEY="sk_live_abc123def456"    # your valid token

# Test
curl -X GET "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -v

# Expected Response
HTTP/1.1 200 OK
Content-Type: application/json

{
  "events": [],
  "total": 0,
  "status": "ok"
}
```

**Verification**:
- [ ] Status code is 200
- [ ] Response is valid JSON
- [ ] No error message

---

#### Invalid Token Test

```bash
curl -X GET "$BASE_URL/inbox" \
  -H "Authorization: Bearer invalid_token" \
  -v

# Expected Response
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid API key",
  "error_code": "UNAUTHORIZED"
}
```

**Verification**:
- [ ] Status code is 401
- [ ] Error message is clear
- [ ] Error code is present

---

#### Missing Token Test

```bash
curl -X GET "$BASE_URL/inbox" -v

# Expected Response
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Missing authorization header",
  "error_code": "MISSING_AUTH"
}
```

**Verification**:
- [ ] Status code is 401
- [ ] Error indicates missing header

---

### Test 2.2: Subscribe Endpoint

**Test**: Register a webhook subscription

#### Subscribe Success Test

```bash
# Use webhook.site for testing
export WEBHOOK_URL="https://webhook.site/your-unique-id"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}" \
  -v

# Expected Response
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "url": "https://webhook.site/your-unique-id",
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

**Verification**:
- [ ] Status code is 200
- [ ] `status` is "success"
- [ ] `url` matches sent URL
- [ ] `created_at` is ISO-8601 timestamp
- [ ] Webhook stored in database

---

#### Verify Database Entry

```bash
# Check database for webhook
npx wrangler d1 execute triggers-api --local \
  --command "SELECT * FROM zapier_webhooks"

# Expected Output
┌──────────┬─────────────┬──────────┬────────────┬─────────┐
│ id       │ webhook_url │ api_key  │ created_at │ status  │
├──────────┼─────────────┼──────────┼────────────┼─────────┤
│ webhook_ │ https://... │ sk_live_ │ 2025-11-.. │ active  │
└──────────┴─────────────┴──────────┴────────────┴─────────┘
```

**Verification**:
- [ ] Entry exists in database
- [ ] `status` is "active"
- [ ] `webhook_url` is correct

---

#### Subscribe Idempotent Test

```bash
# Subscribe again with same URL
curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}"

# Expected Response
HTTP/1.1 200 OK

{
  "status": "success",
  "url": "https://webhook.site/your-unique-id",
  "message": "Webhook already subscribed",
  "created_at": "2025-11-12T14:30:00.000Z"
}
```

**Verification**:
- [ ] Status is still 200 (not error)
- [ ] Message indicates already subscribed
- [ ] No duplicate entry in database

---

#### Subscribe Invalid URL Test

```bash
curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://not-zapier.com/webhook"}'

# Expected Response
HTTP/1.1 400 Bad Request

{
  "error": "Invalid webhook URL",
  "error_code": "INVALID_WEBHOOK_URL"
}
```

**Verification**:
- [ ] Status code is 400
- [ ] Error message is clear
- [ ] No entry created in database

---

### Test 2.3: Sample Endpoint

**Test**: Retrieve sample event data

#### Sample Success Test

```bash
curl -X GET "$BASE_URL/zapier/hook/sample" \
  -H "Authorization: Bearer $API_KEY" \
  -v

# Expected Response
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

**Verification**:
- [ ] Status code is 200
- [ ] Response is an array (not object)
- [ ] Contains at least 1 event
- [ ] Event has all required fields (id, event_id, timestamp, payload, created_at)
- [ ] Event matches schema in `zapier-event-schema.json`

---

### Test 2.4: Unsubscribe Endpoint

**Test**: Remove webhook subscription

#### Unsubscribe Success Test

```bash
curl -X DELETE "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}" \
  -v

# Expected Response
HTTP/1.1 200 OK

{
  "status": "deleted",
  "url": "https://webhook.site/your-unique-id"
}
```

**Verification**:
- [ ] Status code is 200
- [ ] `status` is "deleted"
- [ ] Entry removed from database

---

#### Verify Database Deletion

```bash
npx wrangler d1 execute triggers-api --local \
  --command "SELECT * FROM zapier_webhooks WHERE webhook_url = 'https://webhook.site/your-unique-id'"

# Expected: No results
```

**Verification**:
- [ ] No entry in database for that URL

---

#### Unsubscribe Idempotent Test

```bash
# Try to unsubscribe again (already deleted)
curl -X DELETE "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}"

# Expected Response
HTTP/1.1 200 OK

{
  "status": "deleted",
  "url": "https://webhook.site/your-unique-id",
  "message": "Webhook already deleted or not found"
}
```

**Verification**:
- [ ] Status is still 200 (not 404)
- [ ] Message indicates already deleted

---

## Phase 3: Integration Testing

**Objective**: Test webhook delivery logic

**Prerequisites**: Story 8.3 complete (event delivery implemented)

### Test 3.1: Event Delivery

**Test**: Send event and verify delivery to webhook

#### Setup

```bash
# 1. Subscribe webhook (using webhook.site)
export WEBHOOK_URL="https://webhook.site/your-unique-id"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}"

# 2. Open webhook.site in browser to monitor
# Navigate to: https://webhook.site/your-unique-id
```

---

#### Send Test Event

```bash
curl -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "event_type": "test.webhook",
      "message": "Testing Zapier delivery",
      "user_id": "user_test_123"
    },
    "metadata": {
      "source": "manual_test"
    }
  }'

# Expected Response
HTTP/1.1 202 Accepted

{
  "status": "queued",
  "event_id": "evt_67890xyz"
}
```

**Verification**:
- [ ] Event accepted (202 status)
- [ ] Event ID returned

---

#### Verify Delivery on webhook.site

**Expected in webhook.site**:
- Request method: POST
- Content-Type: application/json
- Body contains:
  ```json
  {
    "id": "evt_67890xyz",
    "event_id": "evt_67890xyz",
    "event_type": "test.webhook",
    "timestamp": "2025-11-12T...",
    "payload": {
      "event_type": "test.webhook",
      "message": "Testing Zapier delivery",
      "user_id": "user_test_123"
    },
    "metadata": { ... },
    "created_at": "2025-11-12T..."
  }
  ```

**Verification Checklist**:
- [ ] Webhook received POST request within 5 seconds
- [ ] Event ID matches
- [ ] All fields present and correct
- [ ] Timestamp is ISO-8601 format

---

### Test 3.2: Multiple Webhooks

**Test**: Verify events delivered to all registered webhooks

#### Setup Multiple Webhooks

```bash
# Create 3 different webhook.site URLs
WEBHOOK_1="https://webhook.site/unique-id-1"
WEBHOOK_2="https://webhook.site/unique-id-2"
WEBHOOK_3="https://webhook.site/unique-id-3"

# Subscribe all three
curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_1\"}"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_2\"}"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_3\"}"
```

---

#### Send Event and Verify

```bash
# Send event
curl -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"event_type": "multi_webhook_test"}}'

# Check all 3 webhook.site URLs
```

**Verification**:
- [ ] All 3 webhooks received the event
- [ ] Events have same ID and data
- [ ] Delivery happened within 5 seconds
- [ ] Database shows updated delivery stats

---

### Test 3.3: Failed Delivery Handling

**Test**: Verify retry logic for failed webhooks

#### Setup Failed Webhook

```bash
# Use a URL that returns 500 error
FAILING_WEBHOOK="https://httpstat.us/500"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$FAILING_WEBHOOK\"}"
```

---

#### Send Event and Monitor

```bash
# Send event
curl -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"event_type": "failure_test"}}'

# Monitor Worker logs
npx wrangler tail
```

**Verification**:
- [ ] Event delivery attempted
- [ ] Retry logic triggered (3 retries)
- [ ] Exponential backoff observed (1s, 4s, 9s)
- [ ] Failure logged in database
- [ ] `failure_count` incremented for webhook

---

### Test 3.4: Rate Limiting Response

**Test**: Handle 429 Too Many Requests from Zapier

```bash
# Use httpstat.us to simulate rate limiting
RATE_LIMITED_WEBHOOK="https://httpstat.us/429"

curl -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$RATE_LIMITED_WEBHOOK\"}"

# Send event
curl -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"event_type": "rate_limit_test"}}'
```

**Verification**:
- [ ] Delivery respects `Retry-After` header
- [ ] Event retried after specified time
- [ ] Not counted as hard failure

---

## Phase 4: End-to-End Testing

**Objective**: Test complete flow with real Zapier Zap

**Prerequisites**: All backend implementation complete

### Test 4.1: Create Test Zap

**Test Steps**:

1. **Create New Zap**
   - Log in to Zapier
   - Click "Create Zap"
   - Search for "TriggersAPI" in triggers
   - Select "Event Received" trigger

2. **Connect Account**
   - Click "Sign in to TriggersAPI"
   - Enter API key: `sk_live_abc123def456`
   - Click "Yes, Continue"

3. **Test Trigger**
   - Click "Test trigger"
   - Should show sample event data

4. **Add Action**
   - Choose action: "Slack" → "Send Channel Message"
   - Or any other simple action for testing
   - Configure action with event data

5. **Test Action**
   - Click "Test action"
   - Verify action executes

6. **Publish Zap**
   - Click "Publish"
   - Name: "TriggersAPI Test Zap"
   - Turn Zap ON

📸 **Screenshot**: Capture each step for documentation

---

### Test 4.2: Verify Webhook Subscription

```bash
# Check database for Zapier webhook
npx wrangler d1 execute triggers-api --command \
  "SELECT * FROM zapier_webhooks ORDER BY created_at DESC LIMIT 1"

# Should show newly created webhook with Zapier URL
# Format: https://hooks.zapier.com/hooks/catch/...
```

**Verification**:
- [ ] Webhook URL starts with `https://hooks.zapier.com/`
- [ ] Status is "active"
- [ ] API key matches connected account

---

### Test 4.3: Trigger Real Event

```bash
# Send real event to trigger Zap
curl -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "event_type": "zap.test",
      "message": "Testing real Zap execution",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "metadata": {
      "test_run": true
    }
  }'
```

**Verification**:
- [ ] Event accepted by TriggersAPI
- [ ] Zap executes within 5 seconds
- [ ] Action completes (Slack message sent, etc)
- [ ] Zap History shows successful run

---

### Test 4.4: Check Zap History

**Test Steps**:
1. Go to Zapier dashboard
2. Click on your test Zap
3. Click "Zap History" tab
4. Verify latest run

**Expected in Zap History**:
- Status: Success (green checkmark)
- Trigger Data: Shows event from TriggersAPI
- Action Data: Shows successful action execution
- Timestamp: Within last few minutes

📸 **Screenshot**: Capture successful Zap History entry

---

### Test 4.5: Turn Off Zap (Unsubscribe)

**Test Steps**:
1. Turn Zap OFF in Zapier dashboard
2. Check database for webhook status

```bash
npx wrangler d1 execute triggers-api --command \
  "SELECT * FROM zapier_webhooks"

# Webhook should be deleted
```

**Verification**:
- [ ] Webhook removed from database
- [ ] No delivery attempted for subsequent events

---

## Automated Testing

### Unit Tests

Create test file: `src/test/zapier-webhook.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Zapier Webhook Endpoints', () => {
  let env: Env;
  let apiKey: string;

  beforeEach(async () => {
    // Setup test environment
    apiKey = 'sk_test_automated_test';
    await env.AUTH_KV.put(apiKey, 'true');
  });

  afterEach(async () => {
    // Cleanup
    await env.AUTH_KV.delete(apiKey);
  });

  it('should subscribe webhook', async () => {
    const response = await fetch('http://localhost:8787/zapier/hook', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://hooks.zapier.com/hooks/catch/test/123',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('success');
  });

  it('should return sample events', async () => {
    const response = await fetch('http://localhost:8787/zapier/hook/sample', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('event_type');
  });

  it('should unsubscribe webhook', async () => {
    // First subscribe
    await fetch('http://localhost:8787/zapier/hook', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://hooks.zapier.com/hooks/catch/test/123',
      }),
    });

    // Then unsubscribe
    const response = await fetch('http://localhost:8787/zapier/hook', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://hooks.zapier.com/hooks/catch/test/123',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('deleted');
  });
});
```

**Run Tests**:
```bash
npm run test
```

---

### Integration Test Script

Create: `test-zapier-integration.sh`

```bash
#!/bin/bash
set -e

echo "Starting Zapier Integration Tests..."

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8787}"
API_KEY="${API_KEY:-sk_test_integration}"
WEBHOOK_URL="https://webhook.site/$(uuidgen)"

echo "Using BASE_URL: $BASE_URL"
echo "Using WEBHOOK_URL: $WEBHOOK_URL"

# Test 1: Subscribe
echo "Test 1: Subscribe webhook..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "200" ]; then
  echo "❌ Subscribe failed (status $STATUS)"
  exit 1
fi
echo "✅ Subscribe successful"

# Test 2: Get sample
echo "Test 2: Get sample events..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/zapier/hook/sample" \
  -H "Authorization: Bearer $API_KEY")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "200" ]; then
  echo "❌ Sample failed (status $STATUS)"
  exit 1
fi
echo "✅ Sample successful"

# Test 3: Send event
echo "Test 3: Send test event..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"event_type": "integration.test"}}')

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "202" ]; then
  echo "❌ Event send failed (status $STATUS)"
  exit 1
fi
echo "✅ Event sent"

# Test 4: Unsubscribe
echo "Test 4: Unsubscribe webhook..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/zapier/hook" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" != "200" ]; then
  echo "❌ Unsubscribe failed (status $STATUS)"
  exit 1
fi
echo "✅ Unsubscribe successful"

echo ""
echo "✅ All tests passed!"
```

**Run Script**:
```bash
chmod +x test-zapier-integration.sh
./test-zapier-integration.sh
```

---

## Load Testing

### Test Concurrent Deliveries

Create: `test-load.js`

```javascript
// test-load.js
const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const API_KEY = process.env.API_KEY || 'sk_test_load';
const CONCURRENT_REQUESTS = 100;

async function sendEvent(id) {
  const response = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: {
        event_type: 'load.test',
        test_id: id,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  return {
    id,
    status: response.status,
    ok: response.ok,
  };
}

async function runLoadTest() {
  console.log(`Starting load test with ${CONCURRENT_REQUESTS} concurrent requests...`);

  const start = Date.now();
  const promises = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(sendEvent(i));
  }

  const results = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`\nLoad Test Results:`);
  console.log(`Total Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Avg: ${(duration / CONCURRENT_REQUESTS).toFixed(2)}ms per request`);
}

runLoadTest().catch(console.error);
```

**Run Load Test**:
```bash
node test-load.js
```

---

## Troubleshooting Tests

### Common Test Failures

#### "Authentication Failed"
**Cause**: API key not in AUTH_KV
**Fix**:
```bash
npx wrangler kv:key put "sk_test_YOUR_KEY" "true" --binding=AUTH_KV
```

#### "Webhook Not Delivered"
**Cause**: Queue consumer not running or webhook URL invalid
**Fix**:
1. Check Worker logs: `npx wrangler tail`
2. Verify webhook URL in database
3. Test webhook URL manually with curl

#### "Database Error"
**Cause**: Table not created
**Fix**:
```bash
npx wrangler d1 execute triggers-api --file=src/db/schema.sql
```

---

## Testing Checklist

### Story 8.1 Completion

- [ ] All configuration files created
- [ ] Documentation is comprehensive
- [ ] Screenshots captured for guide
- [ ] Zapier app configured (UI or CLI)
- [ ] All tests in Phase 1 pass

### Story 8.2 Completion

- [ ] All endpoints implemented
- [ ] Database schema created
- [ ] All tests in Phase 2 pass
- [ ] Unit tests written and passing

### Story 8.3 Completion

- [ ] Event delivery logic implemented
- [ ] Retry logic working
- [ ] All tests in Phase 3 pass
- [ ] Integration tests passing

### Story 8.4 Completion

- [ ] End-to-end Zap works
- [ ] All tests in Phase 4 pass
- [ ] Load testing successful
- [ ] Production ready

---

## Related Documentation

- [Zapier App Setup Guide](./ZAPIER_APP_SETUP.md)
- [Zapier Handshake Protocol](./zapier-handshake-protocol.md)
- [Zapier Authentication Config](./zapier-auth-config.md)

---

*This guide is part of Story 8.1 - Zapier App Setup*
