# TriggersAPI Documentation

**Version:** 1.0.0

Edge-native event ingestion and management API built on Cloudflare Workers. TriggersAPI provides a robust, scalable solution for capturing, processing, and managing events with automatic retry logic, dead letter queue handling, and comprehensive observability.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [POST /events](#post-events)
   - [GET /inbox](#get-inbox)
   - [POST /inbox/:id/ack](#post-inboxidack)
   - [POST /inbox/:id/retry](#post-inboxidretry)
4. [Request/Response Schemas](#requestresponse-schemas)
5. [Error Codes Reference](#error-codes-reference)
6. [Rate Limiting](#rate-limiting)
7. [Code Examples](#code-examples)
   - [cURL](#curl-examples)
   - [JavaScript/Node.js](#javascript-examples)
   - [Python](#python-examples)
8. [Event Payload Guidelines](#event-payload-guidelines)
9. [Metadata Fields](#metadata-fields)
10. [Pagination](#pagination)
11. [Debug Modes](#debug-modes)
12. [Interactive API Explorer](#interactive-api-explorer)

---

## Quick Start

Get up and running with TriggersAPI in under 5 minutes.

### Prerequisites

- A valid Bearer token (test token: `sk-test-` prefix, production: `sk-live-` prefix)
- HTTP client (cURL, Postman, or programming language HTTP library)

### 1. Submit Your First Event

```bash
curl -X POST https://triggers-api.yourdomain.workers.dev/events \
  -H "Authorization: Bearer sk-test-abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "event_type": "user.created",
      "user_id": "12345",
      "email": "user@example.com"
    }
  }'
```

**Expected Response (200 OK):**
```json
{
  "data": {
    "event_id": "evt_1234567890abcdef",
    "status": "accepted",
    "timestamp": "2025-11-11T14:30:00Z"
  },
  "timestamp": "2025-11-11T14:30:00Z"
}
```

### 2. Query Your Inbox

```bash
curl -X GET https://triggers-api.yourdomain.workers.dev/inbox \
  -H "Authorization: Bearer sk-test-abc123def456"
```

### 3. Check the Dashboard

Navigate to `https://triggers-api.yourdomain.workers.dev/` in your browser to see the visual dashboard with real-time metrics.

---

## Authentication

All API endpoints (except the root dashboard `/`) require authentication using Bearer tokens.

### Token Format

Include your API key in the `Authorization` header with the `Bearer` scheme:

```
Authorization: Bearer <your-api-key>
```

### Token Prefixes

- **Test tokens:** `sk-test-{alphanumeric}` (32+ characters after prefix)
- **Production tokens:** `sk-live-{alphanumeric}` (32+ characters after prefix)

### Example Valid Tokens

```
sk-test-abc123def456ghi789jkl012mno345pqr678
sk-live-xyz987wvu654tsr321qpo098nml765kji432
```

### Authentication Errors

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 401 | `MISSING_AUTHORIZATION` | Authorization header is missing |
| 401 | `INVALID_AUTH_SCHEME` | Must use Bearer scheme |
| 401 | `INVALID_TOKEN_FORMAT` | Token format is invalid |
| 401 | `INVALID_TOKEN` | Token not found or expired |
| 503 | `AUTH_SERVICE_ERROR` | Authentication service unavailable |

### Best Practices

- Store tokens securely (environment variables, secret managers)
- Never commit tokens to version control
- Rotate tokens regularly
- Use test tokens for development/testing
- Use production tokens only in production environments

---

## API Endpoints

### POST /events

Submit an event to TriggersAPI for asynchronous processing. Events are queued immediately and processed in the background with automatic retry logic.

**Endpoint:** `POST /events`

**Authentication:** Required (Bearer token)

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "payload": {
    // Your event data (required)
  },
  "metadata": {
    // Optional metadata for categorization
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payload` | object | Yes | Event payload containing your event data |
| `metadata` | object | No | Optional metadata (tags, priority, correlation_id, etc.) |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `debug` | string | Debug mode: `validation_error`, `processing_error`, `dlq_routing` |

**Success Response (200 OK):**

```json
{
  "data": {
    "event_id": "evt_1234567890abcdef",
    "status": "accepted",
    "timestamp": "2025-11-11T14:30:00Z"
  },
  "timestamp": "2025-11-11T14:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid payload or JSON
- `401 Unauthorized` - Missing/invalid Bearer token
- `413 Payload Too Large` - Request exceeds 1MB limit
- `500 Internal Server Error` - Processing failure
- `503 Service Unavailable` - Queue service unavailable

---

### GET /inbox

Retrieve events from your inbox with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /inbox`

**Authentication:** Required (Bearer token)

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `status` | string | Filter by status (comma-separated: `pending,delivered,failed`) | All |
| `from` | ISO-8601 | Start timestamp filter | - |
| `to` | ISO-8601 | End timestamp filter | - |
| `created_date` | YYYY-MM-DD | Filter by specific date | - |
| `min_retries` | integer | Minimum retry count | - |
| `max_retries` | integer | Maximum retry count | - |
| `metadata.<key>` | string | Filter by metadata field | - |
| `payload.<key>` | string | Filter by payload field | - |
| `sort` | string | Sort field: `created_at`, `updated_at`, `retry_count` | `created_at` |
| `order` | string | Sort order: `asc`, `desc` | `desc` |
| `limit` | integer | Max results per page (max 1000) | 50 |
| `offset` | integer | Pagination offset | 0 |
| `cursor` | string | Cursor for cursor-based pagination | - |

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "event_id": "evt_001",
      "status": "delivered",
      "payload": {
        "event_type": "user.created",
        "user_id": "12345"
      },
      "metadata": {
        "tags": ["production"]
      },
      "created_at": "2025-11-11T14:00:00Z",
      "updated_at": "2025-11-11T14:00:05Z",
      "processed_at": "2025-11-11T14:00:05Z",
      "retry_count": 0,
      "error_message": null
    }
  ],
  "total": 156,
  "limit": 50,
  "offset": 0,
  "next_cursor": "base64encodedcursor...",
  "timestamp": "2025-11-11T14:30:00Z",
  "_metadata": {
    "filters_applied": 2,
    "sort_field": "created_at",
    "sort_order": "desc"
  }
}
```

**Filter Limit:** Maximum 10 filters per query (DoS prevention)

---

### POST /inbox/:id/ack

Acknowledge and permanently delete an event from the inbox. This operation cannot be undone.

**Endpoint:** `POST /inbox/{event_id}/ack`

**Authentication:** Required (Bearer token)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | UUID | Event ID to acknowledge |

**Success Response (200 OK):**

```json
{
  "data": {
    "event_id": "evt_001",
    "status": "deleted",
    "timestamp": "2025-11-11T14:30:00Z"
  },
  "timestamp": "2025-11-11T14:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid event ID format
- `401 Unauthorized` - Missing/invalid Bearer token
- `404 Not Found` - Event does not exist
- `500 Internal Server Error` - Database error

---

### POST /inbox/:id/retry

Retry a failed event by re-queuing it for processing. Only events with `failed` status can be retried.

**Endpoint:** `POST /inbox/{event_id}/retry`

**Authentication:** Required (Bearer token)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | UUID | Event ID to retry |

**Retry Limits:** Events can be retried up to **3 times maximum**.

**Success Response (200 OK):**

```json
{
  "data": {
    "event_id": "evt_001",
    "status": "retrying",
    "new_attempt": 2,
    "timestamp": "2025-11-11T14:30:00Z"
  },
  "timestamp": "2025-11-11T14:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid event ID format
- `401 Unauthorized` - Missing/invalid Bearer token
- `404 Not Found` - Event does not exist
- `409 Conflict` - Event status is not `failed` or max retries exceeded
  - `INVALID_STATE`: Event must be in `failed` status
  - `MAX_RETRIES_EXCEEDED`: Event already retried 3 times

---

## Request/Response Schemas

### Event Object

```json
{
  "event_id": "string (UUID)",
  "status": "pending | delivered | failed | retrying",
  "payload": {
    // Arbitrary JSON object
  },
  "metadata": {
    // Arbitrary JSON object
  },
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp",
  "processed_at": "ISO-8601 timestamp | null",
  "retry_count": "integer >= 0",
  "error_message": "string | null"
}
```

### Error Response

All error responses follow this structure:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable error description",
    "timestamp": "ISO-8601 timestamp",
    "correlation_id": "UUID for request tracing"
  }
}
```

---

## Error Codes Reference

| HTTP Status | Error Code | Description | Resolution |
|-------------|------------|-------------|------------|
| **400** | `INVALID_JSON` | Request body is not valid JSON | Check JSON syntax |
| **400** | `INVALID_PAYLOAD` | Missing or invalid `payload` field | Ensure `payload` is a JSON object |
| **400** | `MISSING_PAYLOAD_FIELD` | Required `payload` field missing | Include `payload` in request body |
| **400** | `INVALID_METADATA_TYPE` | `metadata` must be an object | Ensure `metadata` is a JSON object |
| **400** | `INVALID_PARAMETER` | Invalid query parameter value | Check parameter format and allowed values |
| **400** | `TOO_MANY_FILTERS` | More than 10 filters in query | Reduce filter count to 10 or fewer |
| **400** | `INVALID_CURSOR` | Cursor format is invalid | Use cursor from previous response |
| **401** | `MISSING_AUTHORIZATION` | Authorization header missing | Include `Authorization: Bearer <token>` |
| **401** | `INVALID_AUTH_SCHEME` | Must use Bearer scheme | Use `Bearer` scheme, not Basic or other |
| **401** | `INVALID_TOKEN_FORMAT` | Token format is invalid | Check token prefix and length |
| **401** | `INVALID_TOKEN` | Token not found or expired | Verify token is valid and not revoked |
| **404** | `NOT_FOUND` | Event does not exist | Check event ID is correct |
| **409** | `INVALID_STATE` | Event in wrong state for operation | Only `failed` events can be retried |
| **409** | `MAX_RETRIES_EXCEEDED` | Event already retried 3 times | Handle event manually or acknowledge |
| **413** | `PAYLOAD_TOO_LARGE` | Request exceeds 1MB limit | Reduce payload size to under 1MB |
| **500** | `INTERNAL_ERROR` | Unexpected server error | Retry request, contact support if persists |
| **500** | `PROCESSING_ERROR` | Event processing failed | Check event payload format |
| **500** | `DATABASE_ERROR` | Database operation failed | Retry request |
| **503** | `AUTH_SERVICE_ERROR` | Auth service unavailable | Retry request after delay |
| **503** | `QUEUE_SERVICE_ERROR` | Queue service unavailable | Retry request after delay |
| **503** | `SERVICE_UNAVAILABLE` | Service temporarily down | Retry with exponential backoff |

### Debug Error Codes

When using debug query parameters, these errors are intentional for testing:

- `?debug=validation_error` → `INVALID_PAYLOAD` (400)
- `?debug=processing_error` → `PROCESSING_ERROR` (500)
- `?debug=dlq_routing` → Event forced to dead letter queue (200 with debug note)

---

## Rate Limiting

**Rate Limit Policy:** 1000 requests per minute per Bearer token

**Applies to:** All authenticated endpoints (`POST /events`, `GET /inbox`, `POST /ack`, `POST /retry`)

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1699900800
```

### 429 Too Many Requests

When rate limit is exceeded:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit of 1000 requests/minute exceeded",
    "retry_after": 30,
    "timestamp": "2025-11-11T14:30:00Z",
    "correlation_id": "uuid"
  }
}
```

### Best Practices

- Implement exponential backoff for retries
- Monitor `X-RateLimit-Remaining` header
- Batch events when possible
- Cache inbox queries when appropriate
- Handle 429 responses gracefully

---

## Code Examples

### cURL Examples

#### Submit Event (Minimal)

```bash
curl -X POST https://triggers-api.yourdomain.workers.dev/events \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "event_type": "user.created",
      "user_id": "12345"
    }
  }'
```

#### Submit Event (With Metadata)

```bash
curl -X POST https://triggers-api.yourdomain.workers.dev/events \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "event_type": "order.placed",
      "order_id": "ord_xyz789",
      "total": 99.99
    },
    "metadata": {
      "tags": ["production", "high-priority"],
      "priority": "high",
      "correlation_id": "corr_abc123"
    }
  }'
```

#### Query Inbox (All Events)

```bash
curl -X GET "https://triggers-api.yourdomain.workers.dev/inbox" \
  -H "Authorization: Bearer $API_TOKEN"
```

#### Query Inbox (Filtered)

```bash
curl -X GET "https://triggers-api.yourdomain.workers.dev/inbox?status=failed&limit=20&sort=created_at&order=desc" \
  -H "Authorization: Bearer $API_TOKEN"
```

#### Acknowledge Event

```bash
curl -X POST "https://triggers-api.yourdomain.workers.dev/inbox/evt_001/ack" \
  -H "Authorization: Bearer $API_TOKEN"
```

#### Retry Failed Event

```bash
curl -X POST "https://triggers-api.yourdomain.workers.dev/inbox/evt_001/retry" \
  -H "Authorization: Bearer $API_TOKEN"
```

---

### JavaScript Examples

#### Submit Event (Node.js with fetch)

```javascript
const API_TOKEN = process.env.TRIGGERS_API_TOKEN;
const API_URL = 'https://triggers-api.yourdomain.workers.dev';

async function submitEvent(payload, metadata = {}) {
  try {
    const response = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload, metadata }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }

    const data = await response.json();
    console.log('Event submitted:', data.data.event_id);
    return data;
  } catch (error) {
    console.error('Failed to submit event:', error);
    throw error;
  }
}

// Usage
const payload = {
  event_type: 'user.created',
  user_id: '12345',
  email: 'user@example.com',
};

const metadata = {
  tags: ['production'],
  priority: 'high',
};

submitEvent(payload, metadata)
  .then(result => console.log('Success:', result))
  .catch(err => console.error('Error:', err));
```

#### Query Inbox with Filtering

```javascript
async function queryInbox(filters = {}) {
  const params = new URLSearchParams();

  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.order) params.append('order', filters.order);

  try {
    const response = await fetch(`${API_URL}/inbox?${params}`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }

    const data = await response.json();
    console.log(`Found ${data.total} events, showing ${data.data.length}`);
    return data;
  } catch (error) {
    console.error('Failed to query inbox:', error);
    throw error;
  }
}

// Usage
queryInbox({ status: 'failed', limit: 50, sort: 'created_at', order: 'desc' })
  .then(inbox => {
    inbox.data.forEach(event => {
      console.log(`Event ${event.event_id}: ${event.status}`);
    });
  });
```

#### Retry Failed Event

```javascript
async function retryEvent(eventId) {
  try {
    const response = await fetch(`${API_URL}/inbox/${eventId}/retry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }

    const data = await response.json();
    console.log(`Event retried: attempt ${data.data.new_attempt}`);
    return data;
  } catch (error) {
    console.error('Failed to retry event:', error);
    throw error;
  }
}

// Usage
retryEvent('evt_001')
  .then(result => console.log('Retry queued:', result))
  .catch(err => console.error('Retry failed:', err));
```

---

### Python Examples

#### Submit Event

```python
import os
import requests
from typing import Dict, Any, Optional

API_TOKEN = os.environ.get('TRIGGERS_API_TOKEN')
API_URL = 'https://triggers-api.yourdomain.workers.dev'

def submit_event(payload: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> Dict:
    """
    Submit an event to TriggersAPI

    Args:
        payload: Event payload data
        metadata: Optional metadata (tags, priority, etc.)

    Returns:
        API response with event_id and status

    Raises:
        requests.HTTPError: If API request fails
    """
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json',
    }

    body = {'payload': payload}
    if metadata:
        body['metadata'] = metadata

    response = requests.post(
        f'{API_URL}/events',
        headers=headers,
        json=body,
        timeout=10
    )

    response.raise_for_status()

    data = response.json()
    print(f"Event submitted: {data['data']['event_id']}")
    return data

# Usage
try:
    payload = {
        'event_type': 'user.created',
        'user_id': '12345',
        'email': 'user@example.com'
    }

    metadata = {
        'tags': ['production'],
        'priority': 'high'
    }

    result = submit_event(payload, metadata)
    print(f"Success: {result}")

except requests.HTTPError as e:
    error_detail = e.response.json()
    print(f"API Error: {error_detail['error']['message']}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

#### Query Inbox with Filters

```python
def query_inbox(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = 'created_at',
    order: str = 'desc'
) -> Dict:
    """
    Query events from inbox with filtering

    Args:
        status: Filter by status (e.g., 'pending', 'failed')
        limit: Maximum results per page
        offset: Pagination offset
        sort: Sort field
        order: Sort order ('asc' or 'desc')

    Returns:
        Inbox response with events array and pagination metadata
    """
    headers = {
        'Authorization': f'Bearer {API_TOKEN}'
    }

    params = {
        'limit': limit,
        'offset': offset,
        'sort': sort,
        'order': order
    }

    if status:
        params['status'] = status

    response = requests.get(
        f'{API_URL}/inbox',
        headers=headers,
        params=params,
        timeout=10
    )

    response.raise_for_status()

    data = response.json()
    print(f"Found {data['total']} events, showing {len(data['data'])}")
    return data

# Usage
try:
    inbox = query_inbox(status='failed', limit=20)

    for event in inbox['data']:
        print(f"Event {event['event_id']}: {event['status']}")
        if event.get('error_message'):
            print(f"  Error: {event['error_message']}")

except requests.HTTPError as e:
    print(f"API Error: {e.response.json()}")
```

#### Retry Failed Event

```python
def retry_event(event_id: str) -> Dict:
    """
    Retry a failed event

    Args:
        event_id: Event ID to retry

    Returns:
        Retry response with new attempt number
    """
    headers = {
        'Authorization': f'Bearer {API_TOKEN}'
    }

    response = requests.post(
        f'{API_URL}/inbox/{event_id}/retry',
        headers=headers,
        timeout=10
    )

    response.raise_for_status()

    data = response.json()
    print(f"Event retried: attempt {data['data']['new_attempt']}")
    return data

# Usage
try:
    result = retry_event('evt_001')
    print(f"Retry queued: {result}")
except requests.HTTPError as e:
    error = e.response.json()
    if error['error']['code'] == 'MAX_RETRIES_EXCEEDED':
        print("Event has reached maximum retry limit (3)")
    elif error['error']['code'] == 'INVALID_STATE':
        print("Event must be in 'failed' status to retry")
    else:
        print(f"Error: {error['error']['message']}")
```

---

## Event Payload Guidelines

### Payload Structure

```json
{
  "payload": {
    // Your event data - any valid JSON object
  },
  "metadata": {
    // Optional metadata for categorization
  }
}
```

### Required Fields

- `payload` (object, required): The actual event data

### Optional Fields

- `metadata` (object, optional): Supporting information

### Size Limits

- Maximum request size: **1MB**
- Recommended payload size: **< 100KB** for optimal performance

### Field Naming Conventions

- Use `snake_case` for field names
- Keep field names descriptive but concise
- Avoid special characters in field names
- Use consistent naming across events

### Common Event Types

#### User Events

```json
{
  "payload": {
    "event_type": "user.created",
    "user_id": "usr_12345",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2025-11-11T14:30:00Z"
  }
}
```

#### Order Events

```json
{
  "payload": {
    "event_type": "order.placed",
    "order_id": "ord_xyz789",
    "customer_id": "cust_abc123",
    "total": 99.99,
    "currency": "USD",
    "items": [
      {"sku": "PRODUCT-1", "quantity": 2, "price": 49.99}
    ]
  }
}
```

#### Webhook Events

```json
{
  "payload": {
    "event_type": "webhook.received",
    "source": "stripe",
    "webhook_id": "wh_123456",
    "data": {
      // Webhook payload
    }
  }
}
```

---

## Metadata Fields

Metadata provides optional context and categorization for events without affecting the core payload.

### Standard Metadata Fields

#### tags (array of strings)

```json
{
  "metadata": {
    "tags": ["production", "high-priority", "customer-facing"]
  }
}
```

- **Purpose:** Categorize and filter events
- **Max tags:** 10 per event
- **Use cases:** Environment tags, priority flags, feature flags

#### priority (string enum)

```json
{
  "metadata": {
    "priority": "high"
  }
}
```

- **Values:** `low`, `medium`, `high`, `critical`
- **Default:** `medium`
- **Purpose:** Indicate event importance

#### correlation_id (string)

```json
{
  "metadata": {
    "correlation_id": "corr_abc123xyz"
  }
}
```

- **Format:** UUID or custom trace ID
- **Purpose:** Link related events across systems
- **Use case:** Distributed tracing

#### idempotency_key (string)

```json
{
  "metadata": {
    "idempotency_key": "idem_order_12345_attempt_1"
  }
}
```

- **Format:** Unique string (UUID recommended)
- **Purpose:** Prevent duplicate event processing
- **Note:** Server validates within configurable time window

### Custom Metadata

You can add custom metadata fields:

```json
{
  "metadata": {
    "customer_tier": "premium",
    "region": "us-west",
    "campaign_id": "campaign_summer_2025"
  }
}
```

**Guidelines:**
- Use `snake_case` naming
- Keep values simple (string, number, boolean)
- Maximum metadata size: **1KB**

---

## Pagination

The `/inbox` endpoint supports both **offset-based** and **cursor-based** pagination.

### Offset-Based Pagination

Simple pagination using `limit` and `offset`:

```bash
# Page 1 (first 50 events)
GET /inbox?limit=50&offset=0

# Page 2 (next 50 events)
GET /inbox?limit=50&offset=50

# Page 3
GET /inbox?limit=50&offset=100
```

**Response includes:**
```json
{
  "data": [...],
  "total": 500,
  "limit": 50,
  "offset": 100,
  "has_more": true
}
```

### Cursor-Based Pagination

More efficient for large datasets:

```bash
# First request
GET /inbox?limit=50

# Use next_cursor from response
GET /inbox?limit=50&cursor=base64encodedcursor
```

**Response includes:**
```json
{
  "data": [...],
  "next_cursor": "base64encodedcursor...",
  "limit": 50
}
```

### Best Practices

- Use cursor-based pagination for large datasets
- Keep `limit` reasonable (50-100 recommended)
- Cache results when possible
- Handle `has_more: false` to stop pagination

---

## Debug Modes

Test error scenarios using debug query parameters on `POST /events`.

### Available Debug Modes

#### 1. Validation Error

```bash
POST /events?debug=validation_error
```

**Response (400):**
```json
{
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Debug: Forced validation error",
    "is_debug": true,
    "timestamp": "2025-11-11T14:30:00Z"
  }
}
```

#### 2. Processing Error

```bash
POST /events?debug=processing_error
```

Event is queued successfully, but returns 500 error for testing.

**Response (500):**
```json
{
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Debug: Forced processing error for testing",
    "timestamp": "2025-11-11T14:30:00Z"
  }
}
```

#### 3. Dead Letter Queue Routing

```bash
POST /events?debug=dlq_routing
```

Forces event to dead letter queue for testing DLQ handling.

**Response (200):**
```json
{
  "data": {
    "event_id": "evt_123",
    "status": "accepted",
    "timestamp": "2025-11-11T14:30:00Z",
    "debug_note": "Event forced to dead letter queue"
  }
}
```

### Important Notes

- Debug modes are **only for testing**
- Use **test tokens** with debug modes
- Never use debug modes in production
- Debug responses include `"is_debug": true` or `"debug_note"`

---

## Interactive API Explorer

Access the interactive Swagger UI documentation at:

**URL:** `https://triggers-api.yourdomain.workers.dev/api/docs`

### Features

- Browse all API endpoints
- View request/response schemas
- Try out endpoints directly in browser
- Test with your Bearer token
- See real responses from your API

### How to Use

1. Navigate to `/api/docs`
2. Click **Authorize** button (top right)
3. Enter your Bearer token: `Bearer sk-test-xxxxx`
4. Click **Authorize** to save
5. Select an endpoint to test
6. Click **Try it out**
7. Fill in parameters and request body
8. Click **Execute** to send request
9. View response below

### Advantages

- No need for external tools (Postman, cURL)
- Interactive testing within browser
- Auto-generated examples from OpenAPI spec
- Immediate feedback on request/response format

---

## Support & Resources

- **Dashboard:** `https://triggers-api.yourdomain.workers.dev/`
- **API Documentation:** `https://triggers-api.yourdomain.workers.dev/api/docs`
- **OpenAPI Spec:** `https://triggers-api.yourdomain.workers.dev/openapi.yaml`

---

## Changelog

### Version 1.0.0 (2025-11-11)

- Initial release
- Event ingestion endpoint (`POST /events`)
- Inbox query endpoint (`GET /inbox`)
- Acknowledge endpoint (`POST /inbox/:id/ack`)
- Retry endpoint (`POST /inbox/:id/retry`)
- Bearer token authentication
- Advanced filtering and pagination
- Debug modes for testing
- Interactive Swagger UI documentation
