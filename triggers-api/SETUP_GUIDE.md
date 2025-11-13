# TriggersAPI Zapier Integration - Setup Guide

## Overview
Your Zapier integration has been successfully configured and pushed to the Zapier platform! This integration allows you to receive real-time event notifications from TriggersAPI using REST Hooks.

## What Was Fixed

### 1. Authentication Configuration
- **Added API Key Authentication**: Custom authentication using your TriggersAPI Bearer token
- **Two Auth Fields**:
  - `API Key`: Your TriggersAPI Bearer token (same one you use for POST /events)
  - `Base URL`: Your TriggersAPI server URL (default: http://localhost:8787)
- **Test Function**: Validates authentication by calling GET /health endpoint

### 2. Event Trigger (REST Hooks)
- **Subscribe**: POST /zapier/hook - Registers webhook URL with TriggersAPI
- **Unsubscribe**: DELETE /zapier/hook - Removes webhook subscription
- **Get Sample**: GET /zapier/hook/sample - Retrieves sample events for testing

### 3. File Structure
```
triggers-api/
├── index.js              # Main app definition with authentication
├── triggers/
│   └── event.js         # REST Hook trigger for events
├── test/
│   ├── example.test.js
│   └── authentication.test.js
├── package.json
├── .zapierapprc         # Contains app ID and BASE_URL environment
└── jest.config.js
```

## How to Create Your First Zap

### Step 1: Open Zapier Editor
1. Go to https://zapier.com/app/zaps
2. Click "Create Zap"

### Step 2: Set Up the Trigger
1. Search for "TriggersAPI" in the trigger app search
2. Select your TriggersAPI app
3. Choose trigger: **"Event Received"**
4. Click "Continue"

### Step 3: Connect Your Account
1. Click "Sign in to TriggersAPI"
2. Enter your credentials:
   - **API Key**: Your TriggersAPI Bearer token
     - Example: `secret_abc123def456`
     - This is the SAME token you use for `POST /events`
   - **Base URL**: Your TriggersAPI server URL
     - For local testing: `http://localhost:8787`
     - For production: Your deployed URL
3. Click "Continue"

### Step 4: Test the Trigger
1. Zapier will call GET /zapier/hook/sample to get test data
2. You should see a sample event appear
3. Click "Continue"

### Step 5: Set Up the Action
1. Choose what you want to do when an event is received
   - Examples: Send email, create Slack message, update spreadsheet
2. Configure the action using fields from the event:
   - `id` - Event ID
   - `event_type` - Type of event
   - `timestamp` - When the event occurred
   - `payload` - JSON data (use in text fields or parse with Code step)
   - `metadata` - Additional context

### Step 6: Turn On Your Zap
1. Click "Publish"
2. Your Zap is now live!

## Testing Your Integration

### 1. Make Sure TriggersAPI is Running
```bash
# Start your TriggersAPI server
cd /Users/abdul/Downloads/Projects/TriggersAPI
npm run dev
```

### 2. Create a Test Event
```bash
curl -X POST http://localhost:8787/events \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_event",
    "payload": {
      "message": "Hello from TriggersAPI!"
    }
  }'
```

### 3. Check Zapier
- Your Zap should receive the event
- The action should execute automatically

## Important API Endpoints

Your TriggersAPI server needs to implement these endpoints for Zapier:

### Subscribe to Webhook
```
POST /zapier/hook
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}

Response: 200 OK
{
  "id": "sub_12345",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  "created_at": "2025-11-12T20:00:00.000Z"
}
```

### Unsubscribe from Webhook
```
DELETE /zapier/hook
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}

Response: 200 OK
```

### Get Sample Event
```
GET /zapier/hook/sample
Authorization: Bearer {api_key}

Response: 200 OK
[
  {
    "id": "evt_12345",
    "event_id": "evt_12345",
    "event_type": "test_event",
    "timestamp": "2025-11-12T14:30:00.000Z",
    "payload": "{\"message\":\"Sample event\"}",
    "metadata": "{\"source\":\"zapier\"}",
    "created_at": "2025-11-12T14:30:00.500Z"
  }
]
```

### Health Check (for authentication test)
```
GET /health
Authorization: Bearer {api_key}

Response: 200 OK
{
  "status": "ok"
}
```

## Triggering Events to Zapier

When an event occurs in your TriggersAPI:

1. **Store the event** in your database
2. **Find all webhook subscriptions** for this event type
3. **POST to each subscribed URL**:

```javascript
// Example webhook payload to Zapier
POST https://hooks.zapier.com/hooks/catch/123456/abcdef/
Content-Type: application/json

{
  "id": "evt_12345abcde",
  "event_id": "evt_12345abcde",
  "event_type": "order.created",
  "timestamp": "2025-11-12T14:30:00.000Z",
  "payload": "{\"order_id\":\"ord_123\",\"amount\":99.99}",
  "metadata": "{\"user_id\":\"usr_456\"}",
  "created_at": "2025-11-12T14:30:00.500Z"
}
```

## Validation Results

✅ **All validation checks passed!**

Warnings (informational only):
- Consider setting `cleanInputData: false` for more control
- Consider adding direct links to auth field documentation
- Consider validating the Base URL format

## Next Steps

1. **Implement the webhook endpoints** in your TriggersAPI server
2. **Test locally** with ngrok or localhost (if Zapier can reach it)
3. **Create your first Zap** following the guide above
4. **Monitor the Zapier dashboard** for task history and errors

## Updating the Integration

When you make changes:

```bash
cd triggers-api
zapier validate      # Check for errors
zapier push         # Deploy new version
```

## Useful Commands

```bash
# Validate your integration
zapier validate

# Push updates to Zapier
zapier push

# View app details
zapier describe

# Open Zapier dashboard
zapier open

# View logs (when users test)
zapier logs --type=http --detailed
```

## Support

- Zapier Platform Documentation: https://platform.zapier.com/
- Your App Dashboard: https://developer.zapier.com/app/233128
- REST Hooks Guide: https://platform.zapier.com/build/hook-trigger

## Summary

You're all set! Your integration is live on Zapier at version 1.0.0. Users can now:
1. Connect their TriggersAPI account using their Bearer token
2. Create Zaps that trigger on events
3. Automate workflows based on your event data

The API key they need is their **TriggersAPI Bearer token** - the same one they use for POST /events. Make sure this is clear in your documentation!
