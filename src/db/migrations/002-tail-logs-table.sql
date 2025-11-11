-- Migration 002: Tail Worker Logs Table
-- Created: 2025-11-11
-- Description: Create tail_logs table for capturing all Worker executions, logs, and metrics

-- Tail Logs Table
CREATE TABLE IF NOT EXISTS tail_logs (
  log_id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  request_id TEXT,
  correlation_id TEXT,
  log_level TEXT NOT NULL CHECK(log_level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  context_json TEXT,
  timestamp TEXT NOT NULL,
  execution_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient log querying
CREATE INDEX IF NOT EXISTS idx_tail_logs_timestamp ON tail_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tail_logs_correlation_id ON tail_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_tail_logs_worker_name ON tail_logs(worker_name);
CREATE INDEX IF NOT EXISTS idx_tail_logs_level ON tail_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_tail_logs_created ON tail_logs(created_at DESC);
