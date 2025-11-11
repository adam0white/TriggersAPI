-- TriggersAPI D1 Database Schema
-- Events table for storing ingested events with proper indexing

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  payload JSON NOT NULL,
  metadata JSON,
  status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0
);

-- Single-column indexes for WHERE clause filtering
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Composite index for inbox queries with both status and timestamp
-- This is the primary index for most inbox queries (status + time range)
CREATE INDEX IF NOT EXISTS idx_events_status_created ON events(status, created_at);
