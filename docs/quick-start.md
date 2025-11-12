# TriggersAPI - Quick Start Guide

Get TriggersAPI running locally in under 15 minutes.

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ npm 9+ installed
- ✅ Cloudflare account created (free tier)

**Check versions:**
```bash
node --version  # Should be v18.0.0+
npm --version   # Should be 9.0.0+
```

---

## Step 1: Install Wrangler CLI (2 min)

```bash
npm install -g wrangler
```

Verify installation:
```bash
wrangler --version
```

---

## Step 2: Clone & Install Dependencies (2 min)

```bash
# Clone repository (if applicable)
git clone <repository-url>
cd triggers-api

# Install dependencies
npm install
```

---

## Step 3: Cloudflare Authentication (1 min)

```bash
wrangler login
```

This opens a browser for authentication. Log in and authorize.

Verify:
```bash
wrangler whoami
```

---

## Step 4: Create D1 Database (2 min)

```bash
# Create database
wrangler d1 create triggers-api
```

**Copy the `database_id` from output**, then update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "triggers-api"
database_id = "your-database-id-here"  # ← Paste here
migrations_dir = "src/db/migrations"
```

Apply schema:
```bash
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

---

## Step 5: Create KV Namespaces (3 min)

```bash
# Create AUTH_KV namespace
wrangler kv:namespace create "AUTH_KV"
```

**Copy the `id` from output**, then update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-auth-kv-id-here"  # ← Paste here
```

```bash
# Create METRICS_KV namespace
wrangler kv:namespace create "METRICS_KV"
```

**Copy the `id` from output**, then update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "METRICS_KV"
id = "your-metrics-kv-id-here"  # ← Paste here
```

---

## Step 6: Create Queues (2 min)

```bash
# Create event queue
wrangler queues create event-queue

# Create dead letter queue
wrangler queues create event-dlq
```

These should already be configured in `wrangler.toml`.

---

## Step 7: Add Test Authentication Token (1 min)

```bash
# Generate test token
TOKEN="sk-test-$(openssl rand -hex 32)"
echo "Your test token: $TOKEN"

# Store in KV
wrangler kv:key put --binding=AUTH_KV "auth:$TOKEN" "valid" --local
```

**Save this token!** You'll need it for API requests.

---

## Step 8: Start Development Server (1 min)

```bash
npm run dev
```

You should see:
```
⛅️ wrangler 4.x.x
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

**Success!** Your local development server is running.

---

## Step 9: Test Your Setup (2 min)

### Test 1: Health Check

Open a new terminal and run:
```bash
curl http://localhost:8787/health
```

Expected response:
```json
{"status": "healthy", "timestamp": "2025-11-11T..."}
```

### Test 2: Create an Event

```bash
curl -X POST http://localhost:8787/events \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"test": "data"}}'
```

Replace `<YOUR_TOKEN>` with the token from Step 7.

Expected response (201 Created):
```json
{
  "event_id": "evt_...",
  "status": "pending",
  "created_at": "2025-11-11T..."
}
```

### Test 3: Query Inbox

```bash
curl http://localhost:8787/inbox?status=pending \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

Expected response:
```json
{
  "events": [
    {
      "event_id": "evt_...",
      "payload": {"test": "data"},
      "status": "pending",
      "created_at": "...",
      "retry_count": 0
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0
  }
}
```

### Test 4: Dashboard UI

Open your browser to:
```
http://localhost:8787
```

You should see the TriggersAPI Dashboard with:
- Real-time metrics
- Event inbox
- Debug control panel
- Live tail logs

---

## You're Ready! 🎉

Your local TriggersAPI setup is complete. You can now:

1. **Develop locally** - Make code changes with hot reload
2. **Test endpoints** - Use cURL, Postman, or the dashboard
3. **View logs** - Run `wrangler tail --local` in another terminal
4. **Run tests** - Run `npm run test`

---

## Next Steps

### Learn More

- 📚 [Full Setup Guide](./SETUP.md) - Complete documentation
- 📖 [API Documentation](./API.md) - All endpoint details
- 🏗️ [Architecture Overview](./architecture.md) - How it works
- 🚀 [Deployment Guide](./DEPLOYMENT.md) - Deploy to production

### Common Tasks

**Stop development server:**
```bash
# Press Ctrl+C in terminal running wrangler dev
```

**Run tests:**
```bash
npm run test
```

**View logs:**
```bash
wrangler tail --local
```

**Query database:**
```bash
wrangler d1 execute triggers-api --local --command "SELECT * FROM events LIMIT 10;"
```

---

## Troubleshooting

### Port 8787 already in use?

```bash
# Kill process on port 8787
lsof -ti:8787 | xargs kill -9

# Or use different port
wrangler dev --port 8788
```

### Module not found errors?

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database not found?

```bash
# Reapply schema
wrangler d1 execute triggers-api --local --file ./src/db/schema.sql
```

### Authentication failing?

```bash
# Verify token in KV
wrangler kv:key get --binding=AUTH_KV "auth:your-token-here" --local

# If not found, add it again
wrangler kv:key put --binding=AUTH_KV "auth:your-token-here" "valid" --local
```

### More help?

See the [Troubleshooting Guide](./TROUBLESHOOTING.md) for detailed solutions.

---

## Quick Reference

### Essential Commands

```bash
# Start dev server
npm run dev

# Run tests
npm run test

# View logs
wrangler tail --local

# Query database
wrangler d1 execute triggers-api --local --command "SELECT COUNT(*) FROM events;"

# List KV keys
wrangler kv:key list --binding=AUTH_KV
```

### API Endpoints

```bash
# Health check
GET http://localhost:8787/health

# Create event
POST http://localhost:8787/events

# Get inbox
GET http://localhost:8787/inbox?status=pending

# Acknowledge event
POST http://localhost:8787/inbox/{event_id}/ack

# Retry event
POST http://localhost:8787/inbox/{event_id}/retry
```

### URLs

- **API Base:** `http://localhost:8787`
- **Dashboard:** `http://localhost:8787/`
- **Debug Panel:** `http://localhost:8787/debug`
- **API Docs:** `http://localhost:8787/api/docs`

---

## Deployment to Production

When you're ready to deploy:

1. **Run tests:**
   ```bash
   npm run test
   ```

2. **Deploy:**
   ```bash
   wrangler deploy
   ```

3. **Verify deployment:**
   ```bash
   wrangler deployments list
   ```

4. **Monitor logs:**
   ```bash
   wrangler tail
   ```

See the [Deployment Guide](./DEPLOYMENT.md) for complete instructions.

---

**Happy coding!** 🚀

For questions or issues, check the [FAQ](./faq.md) or [Troubleshooting Guide](./TROUBLESHOOTING.md).
