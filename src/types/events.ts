/**
 * Event type definitions for D1 database schema
 * Matches the events table structure in src/db/schema.sql
 */

/**
 * Event record stored in D1 database
 */
export interface Event {
	event_id: string;
	payload: Record<string, any>;
	metadata?: Record<string, any> | null;
	status: 'pending' | 'delivered' | 'failed';
	created_at: string; // ISO-8601 timestamp
	updated_at: string; // ISO-8601 timestamp
	retry_count: number;
}

/**
 * Input structure for creating new events
 */
export interface CreateEventInput {
	event_id: string;
	payload: Record<string, any>;
	metadata?: Record<string, any>;
}

/**
 * Query result from D1 with results array
 */
export interface EventQueryResult {
	results: Event[];
	success: boolean;
}
