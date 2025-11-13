-- Migration 006: Zapier Webhooks Table
-- Epic 8.2: Webhook Subscription Management
-- Created: 2025-11-12
-- Purpose: Store Zapier webhook subscriptions for REST Hook trigger

-- Create zapier_webhooks table
CREATE TABLE IF NOT EXISTS zapier_webhooks (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_tested_at TEXT,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  CONSTRAINT valid_status CHECK (status IN ('active', 'failing', 'inactive')),
  CONSTRAINT valid_url CHECK (url LIKE 'https://hooks.zapier.com/%')
);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_status ON zapier_webhooks(status);

-- Index for sorting by creation time
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_created_at ON zapier_webhooks(created_at);

-- Index for cleanup queries (find oldest failing webhooks)
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_status_created ON zapier_webhooks(status, created_at);
