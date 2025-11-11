/**
 * Event database query helpers
 * Provides typed, structured access to D1 events table
 */

import { Event, CreateEventInput } from '../types/events';

/**
 * EventQueries class encapsulates all database operations for events
 */
export class EventQueries {
  constructor(private db: D1Database) {}

  /**
   * Create a new event in the database
   * Store all event fields with JSON serialization for payload/metadata
   * Use INSERT to enforce UNIQUE constraint on event_id
   *
   * @param event_id - Event UUID
   * @param payload - Event payload object (will be serialized to JSON)
   * @param metadata - Optional metadata object (will be serialized to JSON)
   * @param timestamp - Original ingestion timestamp (created_at)
   * @param retryCount - Workflow retry attempt number (default: 0)
   * @returns Promise<Event> - Created event with all fields parsed
   */
  async createEvent(
    event_id: string,
    payload: Record<string, any>,
    metadata: Record<string, any> | undefined,
    timestamp: string,
    retryCount: number = 0
  ): Promise<Event> {
    const now = new Date().toISOString();

    try {
      const result = await this.db
        .prepare(`
          INSERT INTO events (
            event_id,
            payload,
            metadata,
            status,
            created_at,
            updated_at,
            retry_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *
        `)
        .bind(
          event_id,                              // TEXT PRIMARY KEY
          JSON.stringify(payload),               // JSON → TEXT
          metadata ? JSON.stringify(metadata) : null, // JSON or NULL
          'pending',                             // status: pending
          timestamp,                             // created_at: original ingestion time
          now,                                   // updated_at: current time
          retryCount                             // retry_count: 0 on first attempt
        )
        .first<any>();

      if (!result) {
        throw new Error('Failed to retrieve inserted event');
      }

      // Parse JSON strings back to objects for application layer
      return this.parseEventFromDb(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        throw new Error(`Duplicate event_id: ${event_id}`);
      }
      throw error;
    }
  }

  /**
   * Get all events by status
   *
   * @param status - Event status filter
   * @returns Promise<Event[]> - Array of events
   */
  async getEventsByStatus(status: 'pending' | 'delivered' | 'failed'): Promise<Event[]> {
    const result = await this.db
      .prepare('SELECT * FROM events WHERE status = ? ORDER BY created_at DESC')
      .bind(status)
      .all<any>();

    const events = result.results || [];
    return events.map((row) => this.parseEventFromDb(row));
  }

  /**
   * Get events by status and time range with pagination
   *
   * @param status - Event status filter
   * @param from - Start timestamp (ISO-8601)
   * @param to - End timestamp (ISO-8601)
   * @param limit - Maximum number of results (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns Promise<Event[]> - Array of events
   */
  async getEventsByStatusAndTimeRange(
    status: string,
    from: string,
    to: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Event[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM events
        WHERE status = ? AND created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(status, from, to, limit, offset)
      .all<any>();

    const events = result.results || [];
    return events.map((row) => this.parseEventFromDb(row));
  }

  /**
   * Get total count of events by status
   *
   * @param status - Event status filter
   * @returns Promise<number> - Count of events
   */
  async getTotalByStatus(status: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM events WHERE status = ?')
      .bind(status)
      .first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Update event status
   *
   * @param eventId - Event ID to update
   * @param newStatus - New status value
   * @returns Promise<void>
   */
  async updateEventStatus(
    eventId: string,
    newStatus: 'pending' | 'delivered' | 'failed'
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare('UPDATE events SET status = ?, updated_at = ? WHERE event_id = ?')
      .bind(newStatus, now, eventId)
      .run();
  }

  /**
   * Increment retry count for an event
   *
   * @param eventId - Event ID to update
   * @returns Promise<void>
   */
  async incrementRetryCount(eventId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        UPDATE events
        SET retry_count = retry_count + 1, updated_at = ?
        WHERE event_id = ?
      `)
      .bind(now, eventId)
      .run();
  }

  /**
   * Get a single event by ID
   *
   * @param eventId - Event ID to retrieve
   * @returns Promise<Event | null> - Event or null if not found
   */
  async getEventById(eventId: string): Promise<Event | null> {
    const result = await this.db
      .prepare('SELECT * FROM events WHERE event_id = ?')
      .bind(eventId)
      .first<any>();

    if (!result) return null;

    return this.parseEventFromDb(result);
  }

  /**
   * Delete an event by ID
   *
   * @param eventId - Event ID to delete
   * @returns Promise<void>
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM events WHERE event_id = ?')
      .bind(eventId)
      .run();
  }

  /**
   * Helper: Parse event from database (parse JSON strings)
   * D1 returns payload/metadata as TEXT, need to parse to objects
   *
   * @param row - Raw database row with JSON strings
   * @returns Event - Event with parsed payload/metadata objects
   */
  private parseEventFromDb(row: any): Event {
    return {
      ...row,
      payload: typeof row.payload === 'string'
        ? JSON.parse(row.payload)
        : row.payload,
      metadata: row.metadata
        ? (typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata)
        : undefined,
    };
  }
}
