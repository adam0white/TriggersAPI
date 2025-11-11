/**
 * Event database query helpers
 * Provides typed, structured access to D1 events table
 */

import { Event, CreateEventInput } from '../types/events';

/**
 * Advanced filters interface for complex event queries
 * Supports metadata/payload filtering, retry count ranges, sorting, and cursor pagination
 */
export interface AdvancedFilters {
  status?: string[];
  from?: string;
  to?: string;
  createdDate?: string;
  minRetries?: number;
  maxRetries?: number;
  metadata?: Record<string, string>;
  payload?: Record<string, string>;
  sort?: 'created_at' | 'updated_at' | 'retry_count';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  cursor?: { eventId: string; createdAt: string } | null;
}

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
    newStatus: 'pending' | 'delivered' | 'failed' | 'retrying'
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
   * Get events by filters with dynamic WHERE clause construction
   * Supports status, timestamp range, and pagination
   *
   * @param filters - Query filters object
   * @returns Promise<Event[]> - Array of events matching filters
   */
  async getEventsByFilters(filters: {
    status?: 'pending' | 'delivered' | 'failed';
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<Event[]> {
    const { status, from, to, limit = 50, offset = 0 } = filters;

    // Build WHERE clause dynamically
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (from) {
      whereClauses.push('created_at >= ?');
      params.push(from);
    }

    if (to) {
      whereClauses.push('created_at <= ?');
      params.push(to);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Add pagination params
    params.push(limit, offset);

    const query = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const result = await this.db.prepare(query).bind(...params).all<any>();
    const events = result.results || [];
    return events.map((row) => this.parseEventFromDb(row));
  }

  /**
   * Count events by filters (excludes pagination params)
   * Used to provide total count for pagination
   *
   * @param filters - Query filters object (without limit/offset)
   * @returns Promise<number> - Total count of events matching filters
   */
  async countEventsByFilters(filters: {
    status?: 'pending' | 'delivered' | 'failed';
    from?: string;
    to?: string;
  }): Promise<number> {
    const { status, from, to } = filters;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (from) {
      whereClauses.push('created_at >= ?');
      params.push(from);
    }

    if (to) {
      whereClauses.push('created_at <= ?');
      params.push(to);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `SELECT COUNT(*) as count FROM events ${whereClause}`;
    const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Get events by advanced filters with JSON field queries, sorting, and cursor pagination
   * Supports complex filtering including metadata/payload fields, retry counts, and multiple statuses
   *
   * @param filters - Advanced filters object
   * @returns Promise<Event[]> - Array of events matching all filters
   */
  async getEventsByAdvancedFilters(filters: AdvancedFilters): Promise<Event[]> {
    const {
      status,
      from,
      to,
      createdDate,
      minRetries,
      maxRetries,
      metadata,
      payload,
      sort = 'created_at',
      order = 'desc',
      limit = 50,
      offset = 0,
      cursor,
    } = filters;

    // Build WHERE clause dynamically
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Status filter (supports multiple)
    if (status && status.length > 0) {
      const placeholders = status.map(() => '?').join(',');
      whereClauses.push(`status IN (${placeholders})`);
      params.push(...status);
    }

    // Timestamp range
    if (from) {
      whereClauses.push('created_at >= ?');
      params.push(from);
    }

    if (to) {
      whereClauses.push('created_at <= ?');
      params.push(to);
    }

    // Date-only filtering
    if (createdDate) {
      whereClauses.push('DATE(created_at) = ?');
      params.push(createdDate);
    }

    // Retry count range
    if (minRetries !== undefined) {
      whereClauses.push('retry_count >= ?');
      params.push(minRetries);
    }

    if (maxRetries !== undefined) {
      whereClauses.push('retry_count <= ?');
      params.push(maxRetries);
    }

    // Metadata filtering (JSON search)
    if (metadata && Object.keys(metadata).length > 0) {
      for (const [key, value] of Object.entries(metadata)) {
        whereClauses.push('json_extract(metadata, ?) = ?');
        params.push(`$.${key}`, value);
      }
    }

    // Payload filtering (JSON search)
    if (payload && Object.keys(payload).length > 0) {
      for (const [key, value] of Object.entries(payload)) {
        whereClauses.push('json_extract(payload, ?) = ?');
        params.push(`$.${key}`, value);
      }
    }

    // Cursor pagination
    if (cursor) {
      const cursorClause =
        order === 'desc'
          ? 'created_at < ? OR (created_at = ? AND event_id < ?)'
          : 'created_at > ? OR (created_at = ? AND event_id > ?)';
      whereClauses.push(`(${cursorClause})`);
      params.push(cursor.createdAt, cursor.createdAt, cursor.eventId);
    }

    // Sort validation
    const validSortFields = ['created_at', 'updated_at', 'retry_count'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}, event_id DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all<any>();
    const events = result.results || [];
    return events.map((row) => this.parseEventFromDb(row));
  }

  /**
   * Count events by advanced filters (excludes pagination params)
   * Mirrors getEventsByAdvancedFilters filter logic for accurate pagination totals
   *
   * @param filters - Advanced filters object (without limit/offset/cursor/sort)
   * @returns Promise<number> - Total count of events matching filters
   */
  async countEventsByAdvancedFilters(filters: Omit<AdvancedFilters, 'limit' | 'offset' | 'cursor' | 'sort' | 'order'>): Promise<number> {
    const {
      status,
      from,
      to,
      createdDate,
      minRetries,
      maxRetries,
      metadata,
      payload,
    } = filters;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (status && status.length > 0) {
      const placeholders = status.map(() => '?').join(',');
      whereClauses.push(`status IN (${placeholders})`);
      params.push(...status);
    }

    if (from) {
      whereClauses.push('created_at >= ?');
      params.push(from);
    }

    if (to) {
      whereClauses.push('created_at <= ?');
      params.push(to);
    }

    if (createdDate) {
      whereClauses.push('DATE(created_at) = ?');
      params.push(createdDate);
    }

    if (minRetries !== undefined) {
      whereClauses.push('retry_count >= ?');
      params.push(minRetries);
    }

    if (maxRetries !== undefined) {
      whereClauses.push('retry_count <= ?');
      params.push(maxRetries);
    }

    if (metadata && Object.keys(metadata).length > 0) {
      for (const [key, value] of Object.entries(metadata)) {
        whereClauses.push('json_extract(metadata, ?) = ?');
        params.push(`$.${key}`, value);
      }
    }

    if (payload && Object.keys(payload).length > 0) {
      for (const [key, value] of Object.entries(payload)) {
        whereClauses.push('json_extract(payload, ?) = ?');
        params.push(`$.${key}`, value);
      }
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `SELECT COUNT(*) as count FROM events ${whereClause}`;
    const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Encode cursor for cursor-based pagination
   * Encodes event_id and created_at timestamp as base64 JSON string
   *
   * @param eventId - Event ID for cursor position
   * @param createdAt - Created timestamp for cursor position
   * @returns base64-encoded cursor string
   */
  encodeCursor(eventId: string, createdAt: string): string {
    const cursor = JSON.stringify({ eventId, createdAt });
    return btoa(cursor);
  }

  /**
   * Decode cursor for cursor-based pagination
   * Decodes base64 cursor string back to {eventId, createdAt}
   *
   * @param cursorStr - base64-encoded cursor string
   * @returns Decoded cursor object or null if invalid
   */
  decodeCursor(cursorStr: string): { eventId: string; createdAt: string } | null {
    try {
      const decoded = atob(cursorStr);
      const cursor = JSON.parse(decoded);
      if (cursor && typeof cursor.eventId === 'string' && typeof cursor.createdAt === 'string') {
        return cursor;
      }
      return null;
    } catch {
      return null;
    }
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
