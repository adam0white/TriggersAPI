-- Migration 004: Metrics History Table
-- Created: 2025-11-11
-- Description: Create metrics_history table for storing historical metric snapshots
-- Used for trend analysis, alerting, and dashboard graphs over time

CREATE TABLE IF NOT EXISTS metrics_history (
  metric_id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,        -- latency_p50, latency_p95, latency_p99, error_rate, throughput, queue_depth, cpu_p50, etc
  endpoint TEXT,                    -- /events, /inbox, /inbox/:id/ack, /inbox/:id/retry (if applicable)
  value REAL NOT NULL,              -- numeric value of the metric
  unit TEXT,                        -- ms, percent, rps, count, etc
  timestamp TEXT NOT NULL,          -- when the metric was calculated
  data_points INTEGER,              -- how many logs/events were used in calculation
  confidence REAL,                  -- 0-1, confidence level in metric accuracy
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON metrics_history(endpoint);
CREATE INDEX IF NOT EXISTS idx_metrics_type_endpoint ON metrics_history(metric_type, endpoint);
CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp ON metrics_history(metric_type, timestamp DESC);
