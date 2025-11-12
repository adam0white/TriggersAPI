-- Migration 005: Add log_level Column to log_entries
-- Created: 2025-11-12
-- Description: Add semantic log_level column (debug, info, warn, error) to support filtering in UI
-- This enables AC #4 log level filtering requirement from Story 4.4

-- Add log_level column with default value 'info'
ALTER TABLE log_entries
ADD COLUMN log_level TEXT NOT NULL DEFAULT 'info'
CHECK(log_level IN ('debug', 'info', 'warn', 'error'));

-- Backfill existing logs with appropriate log_level based on status_code and error_message
-- Classification logic:
--   - error: status_code >= 500 OR error_message exists
--   - warn: status_code >= 400 AND status_code < 500
--   - debug: debug_flag is not NULL
--   - info: everything else (default)
UPDATE log_entries
SET log_level = CASE
    WHEN status_code >= 500 OR error_message IS NOT NULL THEN 'error'
    WHEN status_code >= 400 AND status_code < 500 THEN 'warn'
    WHEN debug_flag IS NOT NULL THEN 'debug'
    ELSE 'info'
END;

-- Create index on log_level for efficient filtering
CREATE INDEX IF NOT EXISTS idx_log_level ON log_entries(log_level);

-- Create composite index for common query patterns (timestamp + log_level)
CREATE INDEX IF NOT EXISTS idx_log_timestamp_level ON log_entries(timestamp DESC, log_level);
