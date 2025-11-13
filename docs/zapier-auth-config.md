# Zapier Authentication Configuration Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-12
**Status**: Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication Type: API Key](#authentication-type-api-key)
3. [Setting Up Authentication in Zapier UI](#setting-up-authentication-in-zapier-ui)
4. [Setting Up Authentication in Zapier CLI](#setting-up-authentication-in-zapier-cli)
5. [Testing Authentication](#testing-authentication)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)
8. [Future Enhancements](#future-enhancements)

---

## Overview

TriggersAPI uses **API Key authentication** (Bearer Token) for authenticating Zapier webhook requests. This is the simplest and most commonly used authentication method for Zapier integrations.

### Why API Key Authentication?

- **Simple**: No OAuth flow needed
- **Fast**: Quick setup for users
- **Secure**: Bearer tokens validated against KV store
- **Flexible**: Easy to rotate or revoke tokens
- **Standard**: Follows HTTP Bearer token standard (RFC 6750)

### Authentication Flow

```
┌─────────────┐                        ┌──────────────┐
│   Zapier    │                        │ TriggersAPI  │
│  Platform   │                        │   Backend    │
└──────┬──────┘                        └──────┬───────┘
       │                                      │
       │  User enters API key in Zapier      │
       │  "sk_live_abc123..."                │
       │                                      │
       │  Test Authentication                 │
       │  GET /inbox                          │
       │  Authorization: Bearer sk_live_...  │
       ├─────────────────────────────────────▶│
       │                                      │
       │  Validate token against AUTH_KV     │
       │  ◀─────────────────────────────────  │
       │  200 OK (if valid)                   │
       │  401 Unauthorized (if invalid)       │
       │                                      │
       │  All future requests include token  │
       │  Authorization: Bearer sk_live_...  │
       ├─────────────────────────────────────▶│
       │                                      │
```

---

## Authentication Type: API Key

### Configuration Specification

```yaml
authentication:
  type: "api_key"
  placement: "header"

  fields:
    - key: "api_key"
      label: "API Key"
      type: "string"
      required: true
      help_text: "Enter your TriggersAPI Bearer token"
      placeholder: "sk_live_..."
      input_format: "password"  # Masks input

  test:
    method: "GET"
    url: "{{process.env.BASE_URL}}/inbox"
    headers:
      Authorization: "Bearer {{bundle.authData.api_key}}"
    expected_status: 200

  connection_label:
    template: "TriggersAPI ({{bundle.authData.api_key | slice:-4}})"
```

### Field Configuration

| Field | Value | Purpose |
|-------|-------|---------|
| **type** | `api_key` | Tells Zapier this uses API key authentication |
| **placement** | `header` | Token sent in HTTP Authorization header |
| **key** | `api_key` | Variable name for storing user's token |
| **label** | "API Key" | Display label in Zapier UI |
| **input_format** | `password` | Masks token input (shows dots) |
| **required** | `true` | Field cannot be empty |

### Test Endpoint

Zapier tests authentication by calling:

```http
GET /inbox HTTP/1.1
Host: triggers-api.yourdomain.workers.dev
Authorization: Bearer sk_live_abc123def456
```

**Expected Response**:
- **200 OK**: Token is valid → Authentication success
- **401 Unauthorized**: Token is invalid → Authentication failed
- **403 Forbidden**: Token lacks permissions → Authentication failed

---

## Setting Up Authentication in Zapier UI

### Step 1: Navigate to Authentication Settings

1. Log in to [Zapier Platform](https://platform.zapier.com)
2. Select your **TriggersAPI** app
3. Click **"Authentication"** in the left sidebar

📸 **Screenshot Placeholder**: `zapier-auth-nav.png`

### Step 2: Choose Authentication Type

1. Click **"Add Authentication"**
2. Select **"API Key"** from the list
3. Click **"Continue"**

📸 **Screenshot Placeholder**: `zapier-auth-type-select.png`

### Step 3: Configure Authentication Fields

#### Input Field Configuration

```
Field Label: API Key
Field Key: api_key
Field Type: String
Required: Yes (checked)
Help Text: Enter your TriggersAPI Bearer token. You can find this in your TriggersAPI dashboard or environment variables.
Placeholder: sk_live_...
Input Format: Password (hides characters)
```

📸 **Screenshot Placeholder**: `zapier-auth-field-config.png`

#### Authentication Test Configuration

```
Test Request Type: GET
Test URL: {{process.env.BASE_URL}}/inbox

Headers:
  Authorization: Bearer {{bundle.authData.api_key}}

Expected Response Status: 200
```

**Template Variables**:
- `{{process.env.BASE_URL}}` - Your TriggersAPI base URL (set in environment)
- `{{bundle.authData.api_key}}` - User's entered API key

📸 **Screenshot Placeholder**: `zapier-auth-test-config.png`

#### Connection Label Configuration

The connection label shows the user which account they've connected:

```
Label Template: TriggersAPI ({{bundle.authData.api_key | slice:-4}})
```

**Result**: Displays as "TriggersAPI (...3456)" (shows last 4 characters)

📸 **Screenshot Placeholder**: `zapier-connection-label.png`

### Step 4: Save Configuration

1. Review all settings
2. Click **"Save Authentication Settings"**
3. You'll be returned to the app dashboard

---

## Setting Up Authentication in Zapier CLI

### Step 1: Define Authentication in `index.js`

Create or edit your app's main entry file:

```javascript
// index.js
const authentication = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'string',
      required: true,
      helpText: 'Enter your TriggersAPI Bearer token. You can find this in your TriggersAPI dashboard.',
      inputFormat: 'password',
    },
  ],
  test: async (z, bundle) => {
    // Test authentication by calling /inbox endpoint
    const response = await z.request({
      method: 'GET',
      url: `${process.env.BASE_URL}/inbox`,
      headers: {
        Authorization: `Bearer ${bundle.authData.api_key}`,
      },
    });

    // If request succeeds (200 OK), authentication is valid
    return response.data;
  },
  connectionLabel: (z, bundle) => {
    // Show last 4 characters of API key
    const apiKey = bundle.authData.api_key || '';
    const lastFour = apiKey.slice(-4);
    return `TriggersAPI (...${lastFour})`;
  },
};

module.exports = {
  version: require('./package.json').version,
  platformVersion: '16.0.0',
  authentication,
  // ... rest of your app configuration
};
```

### Step 2: Configure Request Authentication

Add authentication to all API requests:

```javascript
// Automatically add Bearer token to all requests
const addAuthToHeader = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

module.exports = {
  // ... authentication config from above
  beforeRequest: [addAuthToHeader],
};
```

### Step 3: Environment Variables

Create `.env` file for local testing:

```bash
# .env
BASE_URL=http://localhost:8787
# Or for deployed environment:
# BASE_URL=https://triggers-api.yourdomain.workers.dev
```

### Step 4: Test Authentication Locally

```bash
# Start Zapier CLI dev server
zapier dev

# In another terminal, test authentication
curl -X GET http://localhost:3000/test/auth \
  -H "Content-Type: application/json" \
  -d '{"api_key": "sk_live_your_test_token"}'

# Expected: "Authentication successful"
```

---

## Testing Authentication

### Manual Testing via Zapier UI

1. **Navigate to Test Tab**
   - Go to your app in Zapier Platform
   - Click **"Authentication"** → **"Test Your Authentication"**

2. **Enter Test Credentials**
   - API Key: `sk_live_abc123def456` (your actual token)
   - Click **"Test"**

3. **Expected Results**

   **Success**:
   ```
   ✓ Authentication successful
   Connection: TriggersAPI (...def456)
   ```

   **Failure**:
   ```
   ✗ Authentication failed
   Error: 401 Unauthorized
   ```

📸 **Screenshot Placeholder**: `zapier-auth-test-success.png`

### Testing via cURL

#### Valid Token Test

```bash
curl -X GET http://localhost:8787/inbox \
  -H "Authorization: Bearer sk_live_valid_token"

# Expected: 200 OK with event list
{
  "events": [],
  "total": 0,
  "status": "ok"
}
```

#### Invalid Token Test

```bash
curl -X GET http://localhost:8787/inbox \
  -H "Authorization: Bearer invalid_token"

# Expected: 401 Unauthorized
{
  "error": "Invalid API key",
  "error_code": "UNAUTHORIZED"
}
```

#### Missing Token Test

```bash
curl -X GET http://localhost:8787/inbox

# Expected: 401 Unauthorized
{
  "error": "Missing authorization header",
  "error_code": "MISSING_AUTH"
}
```

### Testing in TriggersAPI Backend

Verify tokens are stored correctly in AUTH_KV:

```bash
# List all API keys (local development)
npx wrangler kv:key list --binding=AUTH_KV --local

# Get specific key value
npx wrangler kv:key get "sk_live_abc123def456" --binding=AUTH_KV --local

# Should return: "true" (if valid)
```

---

## Troubleshooting

### Common Issues

#### 1. "Authentication Test Failed: 401 Unauthorized"

**Possible Causes**:
- API key is incorrect or expired
- API key not stored in AUTH_KV namespace
- BASE_URL is incorrect

**Solutions**:

```bash
# Verify API key exists in KV
npx wrangler kv:key get "sk_live_YOUR_KEY" --binding=AUTH_KV

# Add API key manually
npx wrangler kv:key put "sk_live_YOUR_KEY" "true" --binding=AUTH_KV

# Check BASE_URL in Zapier Platform environment
# Ensure it matches your deployed Worker URL
```

#### 2. "Authentication Test Failed: 404 Not Found"

**Possible Causes**:
- `/inbox` endpoint not implemented
- BASE_URL is incorrect
- Worker not deployed

**Solutions**:

```bash
# Test endpoint directly
curl -X GET https://your-worker.workers.dev/inbox

# Verify Worker is deployed
npx wrangler deployments list

# Check routes in wrangler.toml
```

#### 3. "Authentication Test Failed: Network Error"

**Possible Causes**:
- BASE_URL is not publicly accessible
- Worker is behind firewall
- Local server not running

**Solutions**:

```bash
# For local testing, use ngrok
ngrok http 8787

# Use ngrok URL as BASE_URL
# https://abc123.ngrok-free.app

# Or deploy to Cloudflare Workers
npm run deploy
```

#### 4. "Connection Label Shows Full API Key"

**Problem**: Security risk - full token visible in Zapier UI

**Solution**: Update connection label template:

```javascript
// Correct (shows last 4 only)
connectionLabel: (z, bundle) => {
  const apiKey = bundle.authData.api_key || '';
  return `TriggersAPI (...${apiKey.slice(-4)})`;
}

// Incorrect (shows full key) ❌
connectionLabel: (z, bundle) => {
  return `TriggersAPI (${bundle.authData.api_key})`;
}
```

#### 5. "API Key Not Sent in Requests"

**Problem**: Bearer token missing from webhook requests

**Solution**: Verify `beforeRequest` hook is configured:

```javascript
const addAuthToHeader = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

module.exports = {
  beforeRequest: [addAuthToHeader],
  // ... rest of config
};
```

---

## Security Best Practices

### Token Storage

- **Never log API keys**: Sanitize logs to remove tokens
- **Use KV for validation**: Store tokens in Cloudflare KV, not D1
- **Hash tokens (optional)**: Consider storing SHA-256 hash for extra security

### Token Format

Use a consistent, identifiable format:

```
sk_live_abc123def456  (Production)
sk_test_xyz789uvw012  (Testing)
```

**Benefits**:
- Easy to identify in logs (prefix `sk_`)
- Distinguish environments (`live` vs `test`)
- Consistent length for validation

### Token Generation

```bash
# Generate secure random token
openssl rand -hex 32

# Add prefix
TOKEN="sk_live_$(openssl rand -hex 20)"
echo $TOKEN

# Store in KV
npx wrangler kv:key put "$TOKEN" "true" --binding=AUTH_KV
```

### Token Rotation

Implement token rotation for security:

```typescript
// Example token rotation logic
async function rotateApiKey(oldKey: string, env: Env): Promise<string> {
  // Generate new token
  const newKey = `sk_live_${generateRandomString(40)}`;

  // Store new token
  await env.AUTH_KV.put(newKey, 'true');

  // Mark old token for deletion (grace period)
  await env.AUTH_KV.put(`${oldKey}:deprecated`, new Date().toISOString(), {
    expirationTtl: 86400 * 7, // 7 days
  });

  // Delete old token after grace period
  setTimeout(() => env.AUTH_KV.delete(oldKey), 86400 * 7 * 1000);

  return newKey;
}
```

### Rate Limiting

Protect authentication endpoint from brute force:

```typescript
// Example rate limiting
async function checkRateLimit(apiKey: string, env: Env): Promise<boolean> {
  const key = `ratelimit:auth:${apiKey}`;
  const count = await env.AUTH_KV.get(key);

  if (count && parseInt(count) > 10) {
    return false; // Rate limited
  }

  await env.AUTH_KV.put(key, String((parseInt(count || '0') + 1)), {
    expirationTtl: 60, // 1 minute window
  });

  return true; // Not rate limited
}
```

### Token Scoping (Future)

Consider implementing token scopes:

```typescript
// Future enhancement
interface TokenMetadata {
  scopes: string[];      // ['read:events', 'write:events', 'zapier:webhook']
  expires_at: string;    // ISO-8601 timestamp
  created_at: string;
  last_used_at: string;
}

// Store metadata alongside token
await env.AUTH_KV.put(`meta:${token}`, JSON.stringify(metadata));
```

---

## Future Enhancements

### OAuth 2.0 Authentication

For public app submission, consider upgrading to OAuth:

**Benefits**:
- No manual token entry
- Automatic token refresh
- Revocable access
- Better UX for users

**Implementation**:
```yaml
authentication:
  type: "oauth2"
  oauth2_config:
    authorization_url: "{{process.env.BASE_URL}}/oauth/authorize"
    access_token_url: "{{process.env.BASE_URL}}/oauth/token"
    scope: "read:events write:webhooks"
```

### Session-Based Authentication

For dashboard-integrated setup:

```yaml
authentication:
  type: "session"
  session_config:
    login_url: "{{process.env.BASE_URL}}/zapier/login"
    # User logs in via browser, Zapier stores session
```

### Webhook Signature Verification

Add HMAC signature to webhook deliveries (Story 8.4):

```typescript
// Generate signature
const signature = await generateHMAC(payload, webhook.secret);

// Include in delivery request
headers: {
  'X-TriggersAPI-Signature': signature,
  'X-TriggersAPI-Timestamp': timestamp
}
```

---

## Testing Checklist

### Authentication Setup

- [ ] API Key authentication type configured in Zapier
- [ ] Input field labeled "API Key" with password format
- [ ] Test endpoint configured to `/inbox`
- [ ] Connection label shows last 4 characters only
- [ ] Bearer token included in Authorization header

### Token Management

- [ ] Test tokens stored in AUTH_KV (local and deployed)
- [ ] Token validation works in `/inbox` endpoint
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Missing tokens return 401 with clear error
- [ ] Token format follows `sk_live_*` pattern

### Security

- [ ] Tokens never logged in plaintext
- [ ] Connection label hides full token
- [ ] Rate limiting prevents brute force (future)
- [ ] HTTPS enforced for all requests
- [ ] Token rotation process documented

### User Experience

- [ ] Help text explains where to find token
- [ ] Authentication test provides clear feedback
- [ ] Error messages are helpful (not generic)
- [ ] Connection label is descriptive

---

## Related Documentation

- [Zapier App Setup Guide](./ZAPIER_APP_SETUP.md)
- [Zapier Handshake Protocol](./zapier-handshake-protocol.md)
- [Environment Variables Guide](./ENVIRONMENT_VARS.md)

---

## References

- [Zapier Authentication Documentation](https://platform.zapier.com/build/auth)
- [API Key Authentication Guide](https://platform.zapier.com/build/api-key-auth)
- [OAuth 2.0 Authentication](https://platform.zapier.com/build/oauth)
- [HTTP Bearer Token (RFC 6750)](https://datatracker.ietf.org/doc/html/rfc6750)

---

**Change Log**

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-12 | Initial authentication configuration guide |

---

*This guide is part of Story 8.1 - Zapier App Setup*
