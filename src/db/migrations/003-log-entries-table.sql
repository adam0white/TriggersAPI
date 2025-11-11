-- Migration 003: Log Entries Table (Parsed Logs)
-- Created: 2025-11-11
-- Description: Create log_entries table for parsed/enriched log data with structured columns
-- This table stores processed logs separate from raw tail_logs for efficient querying

-- Log Entries Table (Parsed from Tail Worker events)
CREATE TABLE IF NOT EXISTS log_entries (
  log_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  request_id TEXT,
  timestamp TEXT NOT NULL,

  -- Request info
  method TEXT NOT NULL,              -- GET, POST, etc
  path TEXT NOT NULL,                -- /events, /inbox, etc
  endpoint TEXT NOT NULL,            -- categorized: /events, /inbox/:id/ack, etc
  query_params TEXT,                 -- JSON of query params
  request_headers TEXT,              -- JSON (sanitized)
  request_body_size INTEGER,         -- bytes

  -- Response info
  status_code INTEGER NOT NULL,      -- 200, 400, 500, etc
  status_class TEXT NOT NULL CHECK(status_class IN ('2xx', '4xx', '5xx')),
  response_headers TEXT,             -- JSON (sanitized)
  response_body_size INTEGER,        -- bytes

  -- Timing
  duration_ms INTEGER NOT NULL,      -- total request time
  cpu_ms INTEGER,                    -- CPU execution time
  db_query_ms INTEGER,               -- database time (if applicable)
  queue_wait_ms INTEGER,             -- queue processing time

  -- Error info
  error_code TEXT,                   -- INVALID_PAYLOAD, UNAUTHORIZED, etc
  error_message TEXT,                -- human-readable error
  error_category TEXT,               -- validation, auth, not_found, conflict, server
  error_stack TEXT,                  -- stack trace (sanitized)

  -- Context
  worker_name TEXT NOT NULL,         -- api-worker, queue-consumer, etc
  debug_flag TEXT,                   -- validation_error, processing_error, etc
  environment TEXT,                  -- dev, staging, prod
  version TEXT,                      -- service version

  -- Metadata
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_log_timestamp ON log_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_correlation ON log_entries(correlation_id);
CREATE INDEX IF NOT EXISTS idx_log_endpoint ON log_entries(endpoint);
CREATE INDEX IF NOT EXISTS idx_log_status ON log_entries(status_code);
CREATE INDEX IF NOT EXISTS idx_log_error ON log_entries(error_category);
CREATE INDEX IF NOT EXISTS idx_log_worker ON log_entries(worker_name);
CREATE INDEX IF NOT EXISTS idx_log_duration ON log_entries(duration_ms);
CREATE INDEX IF NOT EXISTS idx_log_timestamp_endpoint ON log_entries(timestamp DESC, endpoint);
