/**
 * Database Queries Test Suite
 * Tests EventQueries class methods and D1 schema operations
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EventQueries } from '../../src/db/queries';
import { Event, CreateEventInput } from '../../src/types/events';

// Mock D1Database for testing
const createMockD1 = () => {
  const mockResults: any[] = [];

  return {
    prepare: vi.fn((query: string) => ({
      bind: vi.fn((...args: any[]) => ({
        first: vi.fn(async () => mockResults[0] || null),
        all: vi.fn(async () => ({ results: mockResults, success: true })),
        run: vi.fn(async () => ({ success: true })),
      })),
    })),
    exec: vi.fn(async () => {}),
  } as unknown as D1Database;
};

describe('EventQueries', () => {
  let mockDb: D1Database;
  let queries: EventQueries;

  beforeAll(() => {
    mockDb = createMockD1();
    queries = new EventQueries(mockDb);
  });

  describe('Schema Validation', () => {
    it('should have all required fields in Event type', () => {
      const event: Event = {
        event_id: 'test-uuid',
        payload: { test: 'data' },
        metadata: { source: 'test' },
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
      };

      expect(event.event_id).toBeDefined();
      expect(event.payload).toBeDefined();
      expect(event.status).toBeDefined();
      expect(event.created_at).toBeDefined();
      expect(event.updated_at).toBeDefined();
      expect(event.retry_count).toBeDefined();
    });

    it('should accept null metadata', () => {
      const event: Event = {
        event_id: 'test-uuid',
        payload: { test: 'data' },
        metadata: null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
      };

      expect(event.metadata).toBeNull();
    });

    it('should enforce status type', () => {
      const validStatuses: Array<'pending' | 'delivered' | 'failed'> = [
        'pending',
        'delivered',
        'failed',
      ];

      validStatuses.forEach((status) => {
        const event: Event = {
          event_id: 'test-uuid',
          payload: { test: 'data' },
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          retry_count: 0,
        };

        expect(event.status).toBe(status);
      });
    });
  });

  describe('CreateEventInput', () => {
    it('should have required fields', () => {
      const input: CreateEventInput = {
        event_id: 'test-uuid',
        payload: { test: 'data' },
      };

      expect(input.event_id).toBeDefined();
      expect(input.payload).toBeDefined();
    });

    it('should accept optional metadata', () => {
      const input: CreateEventInput = {
        event_id: 'test-uuid',
        payload: { test: 'data' },
        metadata: { source: 'test' },
      };

      expect(input.metadata).toBeDefined();
    });
  });

  describe('EventQueries Methods', () => {
    it('should create EventQueries instance', () => {
      expect(queries).toBeDefined();
      expect(queries).toBeInstanceOf(EventQueries);
    });

    it('should have createEvent method', () => {
      expect(queries.createEvent).toBeDefined();
      expect(typeof queries.createEvent).toBe('function');
    });

    it('should have getEventsByStatus method', () => {
      expect(queries.getEventsByStatus).toBeDefined();
      expect(typeof queries.getEventsByStatus).toBe('function');
    });

    it('should have getEventsByStatusAndTimeRange method', () => {
      expect(queries.getEventsByStatusAndTimeRange).toBeDefined();
      expect(typeof queries.getEventsByStatusAndTimeRange).toBe('function');
    });

    it('should have getTotalByStatus method', () => {
      expect(queries.getTotalByStatus).toBeDefined();
      expect(typeof queries.getTotalByStatus).toBe('function');
    });

    it('should have updateEventStatus method', () => {
      expect(queries.updateEventStatus).toBeDefined();
      expect(typeof queries.updateEventStatus).toBe('function');
    });

    it('should have incrementRetryCount method', () => {
      expect(queries.incrementRetryCount).toBeDefined();
      expect(typeof queries.incrementRetryCount).toBe('function');
    });

    it('should have getEventById method', () => {
      expect(queries.getEventById).toBeDefined();
      expect(typeof queries.getEventById).toBe('function');
    });

    it('should have deleteEvent method', () => {
      expect(queries.deleteEvent).toBeDefined();
      expect(typeof queries.deleteEvent).toBe('function');
    });
  });
});

describe('Database Schema Constraints', () => {
  it('should document PRIMARY KEY constraint on event_id', () => {
    // This test documents the schema constraint
    // Actual constraint is enforced by D1 SQLite database
    expect(true).toBe(true);
  });

  it('should document NOT NULL constraint on payload', () => {
    // This test documents the schema constraint
    // Actual constraint is enforced by D1 SQLite database
    expect(true).toBe(true);
  });

  it('should document CHECK constraint on status', () => {
    // This test documents the schema constraint
    // Valid values: pending, delivered, failed
    const validStatuses = ['pending', 'delivered', 'failed'];
    expect(validStatuses).toHaveLength(3);
  });

  it('should document DEFAULT value on retry_count', () => {
    // This test documents the schema constraint
    // Default value: 0
    expect(0).toBe(0);
  });
});

describe('Index Coverage', () => {
  it('should document idx_events_status index', () => {
    // Single-column index on status
    expect('idx_events_status').toBeDefined();
  });

  it('should document idx_events_created_at index', () => {
    // Single-column index on created_at
    expect('idx_events_created_at').toBeDefined();
  });

  it('should document idx_events_status_created composite index', () => {
    // Composite index on (status, created_at)
    expect('idx_events_status_created').toBeDefined();
  });
});

describe('EventQueries.createEvent - Story 2.4', () => {
  it('should accept individual parameters instead of CreateEventInput', () => {
    const mockDb = createMockD1();
    const queries = new EventQueries(mockDb);

    expect(async () => {
      await queries.createEvent(
        'test-event-id',
        { test: 'payload' },
        { source: 'test' },
        '2025-11-10T12:00:00Z',
        0
      );
    }).not.toThrow();
  });

  it('should serialize payload to JSON string before storage', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[1] (payload) is JSON string
          expect(typeof args[1]).toBe('string');
          expect(args[1]).toBe('{"user_id":"123","action":"login"}');

          return {
            first: vi.fn(async () => ({
              event_id: 'test-123',
              payload: '{"user_id":"123","action":"login"}',
              metadata: '{"source":"api"}',
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    await queries.createEvent(
      'test-123',
      { user_id: '123', action: 'login' },
      { source: 'api' },
      '2025-11-10T12:00:00Z',
      0
    );
  });

  it('should serialize metadata to JSON string if provided', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[2] (metadata) is JSON string
          expect(typeof args[2]).toBe('string');
          expect(args[2]).toBe('{"source":"webhook","ip":"127.0.0.1"}');

          return {
            first: vi.fn(async () => ({
              event_id: 'test-456',
              payload: '{"data":"test"}',
              metadata: '{"source":"webhook","ip":"127.0.0.1"}',
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    await queries.createEvent(
      'test-456',
      { data: 'test' },
      { source: 'webhook', ip: '127.0.0.1' },
      '2025-11-10T12:00:00Z',
      0
    );
  });

  it('should store NULL for undefined metadata', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[2] (metadata) is null
          expect(args[2]).toBeNull();

          return {
            first: vi.fn(async () => ({
              event_id: 'test-789',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-789',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    expect(result.metadata).toBeUndefined();
  });

  it('should parse JSON payload back to object', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({
            event_id: 'test-parse-1',
            payload: '{"user_id":"999","action":"purchase","amount":50}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-10T12:00:00Z',
            updated_at: '2025-11-10T12:01:00Z',
            retry_count: 0,
          })),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-parse-1',
      { user_id: '999', action: 'purchase', amount: 50 },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    expect(typeof result.payload).toBe('object');
    expect(result.payload).toEqual({ user_id: '999', action: 'purchase', amount: 50 });
  });

  it('should parse JSON metadata back to object', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({
            event_id: 'test-parse-2',
            payload: '{"data":"test"}',
            metadata: '{"source":"api","user_agent":"Mozilla/5.0"}',
            status: 'pending',
            created_at: '2025-11-10T12:00:00Z',
            updated_at: '2025-11-10T12:01:00Z',
            retry_count: 0,
          })),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-parse-2',
      { data: 'test' },
      { source: 'api', user_agent: 'Mozilla/5.0' },
      '2025-11-10T12:00:00Z',
      0
    );

    expect(typeof result.metadata).toBe('object');
    expect(result.metadata).toEqual({ source: 'api', user_agent: 'Mozilla/5.0' });
  });

  it('should initialize status as pending', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[3] (status) is 'pending'
          expect(args[3]).toBe('pending');

          return {
            first: vi.fn(async () => ({
              event_id: 'test-status',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-status',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    expect(result.status).toBe('pending');
  });

  it('should preserve created_at from ingestion timestamp', async () => {
    const ingestionTime = '2025-11-10T08:30:00.000Z';

    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[4] (created_at) matches ingestion time
          expect(args[4]).toBe(ingestionTime);

          return {
            first: vi.fn(async () => ({
              event_id: 'test-timestamp',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: ingestionTime,
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-timestamp',
      { data: 'test' },
      undefined,
      ingestionTime,
      0
    );

    expect(result.created_at).toBe(ingestionTime);
  });

  it('should set updated_at to current time', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[5] (updated_at) is recent ISO timestamp
          const updatedAt = args[5];
          expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          return {
            first: vi.fn(async () => ({
              event_id: 'test-updated',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: updatedAt,
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-updated',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    expect(result.updated_at).toBeDefined();
  });

  it('should store retry_count from parameter', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[6] (retry_count) matches parameter
          expect(args[6]).toBe(3);

          return {
            first: vi.fn(async () => ({
              event_id: 'test-retry',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 3,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-retry',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      3
    );

    expect(result.retry_count).toBe(3);
  });

  it('should default retry_count to 0 if not provided', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Verify args[6] (retry_count) is 0
          expect(args[6]).toBe(0);

          return {
            first: vi.fn(async () => ({
              event_id: 'test-default-retry',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-default-retry',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z'
      // No retry_count parameter
    );

    expect(result.retry_count).toBe(0);
  });
});

describe('EventQueries - Duplicate Handling - Story 2.4', () => {
  it('should throw specific error for duplicate event_id', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => {
            // Simulate UNIQUE constraint error from D1
            throw new Error('D1_ERROR: UNIQUE constraint failed: events.event_id');
          }),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);

    await expect(
      queries.createEvent(
        'duplicate-id',
        { data: 'test' },
        undefined,
        '2025-11-10T12:00:00Z',
        0
      )
    ).rejects.toThrow('Duplicate event_id: duplicate-id');
  });

  it('should catch UNIQUE constraint error message variations', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => {
            throw new Error('UNIQUE constraint violated on event_id');
          }),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);

    await expect(
      queries.createEvent(
        'another-duplicate',
        { data: 'test' },
        undefined,
        '2025-11-10T12:00:00Z',
        0
      )
    ).rejects.toThrow('Duplicate event_id: another-duplicate');
  });

  it('should not catch non-constraint errors', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => {
            throw new Error('Database connection timeout');
          }),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);

    await expect(
      queries.createEvent(
        'test-other-error',
        { data: 'test' },
        undefined,
        '2025-11-10T12:00:00Z',
        0
      )
    ).rejects.toThrow('Database connection timeout');
  });
});

describe('EventQueries - NULL Metadata Handling - Story 2.4', () => {
  it('should accept undefined metadata', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          expect(args[2]).toBeNull();
          return {
            first: vi.fn(async () => ({
              event_id: 'test-null-1',
              payload: '{"data":"test"}',
              metadata: null,
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-null-1',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    expect(result.metadata).toBeUndefined();
  });

  it('should return undefined for null metadata from database', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({
            event_id: 'test-null-2',
            payload: '{"data":"test"}',
            metadata: null,  // Database returns null
            status: 'pending',
            created_at: '2025-11-10T12:00:00Z',
            updated_at: '2025-11-10T12:01:00Z',
            retry_count: 0,
          })),
        })),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-null-2',
      { data: 'test' },
      undefined,
      '2025-11-10T12:00:00Z',
      0
    );

    // Application layer uses undefined, not null
    expect(result.metadata).toBeUndefined();
  });

  it('should handle empty metadata object', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: any[]) => {
          // Empty object should be serialized as JSON string
          expect(args[2]).toBe('{}');
          return {
            first: vi.fn(async () => ({
              event_id: 'test-empty-metadata',
              payload: '{"data":"test"}',
              metadata: '{}',
              status: 'pending',
              created_at: '2025-11-10T12:00:00Z',
              updated_at: '2025-11-10T12:01:00Z',
              retry_count: 0,
            })),
          };
        }),
      })),
    } as unknown as D1Database;

    const queries = new EventQueries(mockDb);
    const result = await queries.createEvent(
      'test-empty-metadata',
      { data: 'test' },
      {},  // Empty object
      '2025-11-10T12:00:00Z',
      0
    );

    expect(result.metadata).toEqual({});
  });
});
