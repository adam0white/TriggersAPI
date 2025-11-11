# D1 Schema Integration Tests

This document describes manual integration tests for the D1 schema.
These tests must be run using `wrangler d1 execute` commands.

## Setup

```bash
# Ensure schema is applied
npx wrangler d1 execute triggers-api --file=src/db/schema.sql
```

## Test Cases

### 1. Table Creation
```bash
# Verify events table exists
npx wrangler d1 execute triggers-api --command="SELECT name FROM sqlite_master WHERE type='table' AND name='events';"

# Expected: {"name": "events"}
```

### 2. Column Verification
```bash
# Check all columns exist with correct types
npx wrangler d1 execute triggers-api --command="PRAGMA table_info(events);"

# Expected columns:
# - event_id (TEXT, PRIMARY KEY)
# - payload (JSON, NOT NULL)
# - metadata (JSON, nullable)
# - status (TEXT, NOT NULL, CHECK constraint)
# - created_at (TEXT, NOT NULL)
# - updated_at (TEXT, NOT NULL)
# - retry_count (INTEGER, DEFAULT 0)
```

### 3. Index Verification
```bash
# Check all indexes exist
npx wrangler d1 execute triggers-api --command="PRAGMA index_list(events);"

# Expected indexes:
# - idx_events_status
# - idx_events_created_at
# - idx_events_status_created
```

### 4. Valid Insert Test
```bash
# Insert valid event
npx wrangler d1 execute triggers-api --command="INSERT INTO events (event_id, payload, metadata, status, created_at, updated_at) VALUES ('test-001', '{\"test\":\"data\"}', '{\"source\":\"test\"}', 'pending', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');"

# Verify insert
npx wrangler d1 execute triggers-api --command="SELECT * FROM events WHERE event_id = 'test-001';"

# Expected: Event with all fields populated
```

### 5. Null Metadata Test
```bash
# Insert event with null metadata (should succeed)
npx wrangler d1 execute triggers-api --command="INSERT INTO events (event_id, payload, metadata, status, created_at, updated_at) VALUES ('test-002', '{\"test\":\"data\"}', NULL, 'pending', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');"

# Expected: Success
```

### 6. Invalid Status Test
```bash
# Try to insert event with invalid status (should fail)
npx wrangler d1 execute triggers-api --command="INSERT INTO events (event_id, payload, status, created_at, updated_at) VALUES ('test-003', '{\"test\":\"data\"}', 'invalid', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');" 2>&1

# Expected: CHECK constraint failed error
```

### 7. Null Payload Test
```bash
# Try to insert event with null payload (should fail)
npx wrangler d1 execute triggers-api --command="INSERT INTO events (event_id, payload, status, created_at, updated_at) VALUES ('test-004', NULL, 'pending', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');" 2>&1

# Expected: NOT NULL constraint failed error
```

### 8. Index Usage Test
```bash
# Query with status filter and check index usage
npx wrangler d1 execute triggers-api --command="EXPLAIN QUERY PLAN SELECT * FROM events WHERE status = 'pending';"

# Expected: Should use idx_events_status_created or idx_events_status

# Query with status and time range
npx wrangler d1 execute triggers-api --command="EXPLAIN QUERY PLAN SELECT * FROM events WHERE status = 'pending' AND created_at >= '2025-11-10T00:00:00Z';"

# Expected: Should use idx_events_status_created composite index
```

### 9. Performance Test
```bash
# Insert 1000 events
node -e "let sql = ''; for(let i = 0; i < 1000; i++) { sql += \`INSERT INTO events (event_id, payload, status, created_at, updated_at) VALUES ('perf-\${i}', '{\"test\":\"data\"}', 'pending', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');\n\`; } console.log(sql);" > /tmp/perf-test.sql

time npx wrangler d1 execute triggers-api --file=/tmp/perf-test.sql

# Expected: Complete in reasonable time (< 5 seconds including CLI overhead)

# Verify count
npx wrangler d1 execute triggers-api --command="SELECT COUNT(*) as count FROM events;"

# Expected: count >= 1000
```

### 10. Default Value Test
```bash
# Insert without retry_count (should default to 0)
npx wrangler d1 execute triggers-api --command="INSERT INTO events (event_id, payload, status, created_at, updated_at) VALUES ('test-005', '{\"test\":\"data\"}', 'pending', '2025-11-10T12:00:00Z', '2025-11-10T12:00:00Z');"

# Verify default value
npx wrangler d1 execute triggers-api --command="SELECT retry_count FROM events WHERE event_id = 'test-005';"

# Expected: retry_count = 0
```

## Cleanup

```bash
# Clear test data
npx wrangler d1 execute triggers-api --command="DELETE FROM events WHERE event_id LIKE 'test-%' OR event_id LIKE 'perf-%';"
```

## Test Results

All tests executed on: 2025-11-10

- ✅ Table created successfully
- ✅ All columns present with correct types
- ✅ All indexes created
- ✅ Valid inserts succeed
- ✅ Null metadata accepted
- ✅ Invalid status rejected (CHECK constraint)
- ✅ Null payload rejected (NOT NULL constraint)
- ✅ Indexes used in filtered queries
- ✅ Performance acceptable (1000 inserts in ~1.3s)
- ✅ Default retry_count = 0 works
