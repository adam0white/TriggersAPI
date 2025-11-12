/**
 * Database initialization module
 * Executes schema creation and index setup for D1 database
 */

/**
 * Initialize D1 database with events table and indexes
 * Safe to run multiple times (uses IF NOT EXISTS)
 *
 * @param db - D1Database binding from Cloudflare Workers environment
 * @returns Promise<void>
 * @throws Error if schema creation fails
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
	const schema = `
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
    CREATE INDEX IF NOT EXISTS idx_events_status_created ON events(status, created_at);
  `;

	try {
		await db.exec(schema);
	} catch (error) {
		console.error('Failed to initialize database:', error);
		throw new Error(`Database initialization failed: ${error}`);
	}
}
