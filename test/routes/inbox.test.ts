/**
 * Tests for GET /inbox endpoint
 *
 * Validates all acceptance criteria:
 * - GET /inbox endpoint implemented and accessible
 * - Accepts optional status filter (pending|delivered|failed)
 * - Accepts timestamp range parameters (from/to ISO-8601)
 * - Accepts pagination parameters (limit, offset)
 * - Query builder constructs WHERE clauses correctly
 * - Handles missing filters (returns all events)
 * - Returns events array with all fields
 * - Response includes total count for pagination
 * - Response includes limit and offset
 * - Invalid status filter rejected with 400
 * - Invalid timestamp format rejected with 400
 * - Requires authentication
 * - Returns standard API format
 * - Handles empty result set gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleInboxQuery, handleAckEvent, handleRetryEvent } from '../../src/routes/inbox';
import { EventQueries } from '../../src/db/queries';

// Mock D1 database
const mockD1 = {
  prepare: vi.fn(),
};

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

// Mock environment
const mockEnv = {
  DB: mockD1,
  METRICS_KV: mockKV,
} as unknown as Env;

// Mock execution context
const mockCtx = {
  waitUntil: vi.fn((promise: Promise<any>) => promise),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// Helper to create test requests
function createRequest(queryParams: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:8787/inbox');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new Request(url.toString(), {
    method: 'GET',
  });
}

// Helper to parse JSON response
async function parseResponse(response: Response) {
  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: JSON.parse(text),
  };
}

// Mock prepared statement
function createMockPreparedStatement(returnValue: any) {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: returnValue }),
    first: vi.fn().mockResolvedValue(returnValue),
  };
  return statement;
}

describe('GET /inbox endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful queries', () => {
    it('should return all events when no filters provided', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"test":"data1"}',
          metadata: '{"source":"test"}',
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        },
        {
          event_id: 'event-2',
          payload: '{"test":"data2"}',
          metadata: null,
          status: 'delivered',
          created_at: '2025-11-11T09:00:00Z',
          updated_at: '2025-11-11T09:30:00Z',
          retry_count: 0,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 2 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data).toHaveLength(2);
      expect(parsed.body.total).toBe(2);
      expect(parsed.body.limit).toBe(50);
      expect(parsed.body.offset).toBe(0);
      expect(parsed.body.timestamp).toBeDefined();
      expect(parsed.headers['x-correlation-id']).toBe('test-correlation-id');
      expect(parsed.headers['content-type']).toBe('application/json');
      expect(parsed.headers['cache-control']).toBe('no-cache');

      // Verify parsed payload and metadata
      expect(parsed.body.data[0].payload).toEqual({ test: 'data1' });
      expect(parsed.body.data[0].metadata).toEqual({ source: 'test' });
      expect(parsed.body.data[1].metadata).toBeUndefined();
    });

    it('should filter by status', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

      const request = createRequest({ status: 'pending' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data).toHaveLength(1);
      expect(parsed.body.data[0].status).toBe('pending');
      expect(parsed.body.total).toBe(1);
    });

    it('should filter by timestamp range', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

      const request = createRequest({
        from: '2025-11-11T00:00:00Z',
        to: '2025-11-11T23:59:59Z',
      });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data).toHaveLength(1);
    });

    it('should filter by status and timestamp range combined', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 3,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

      const request = createRequest({
        status: 'failed',
        from: '2025-11-11T00:00:00Z',
        to: '2025-11-11T23:59:59Z',
      });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data[0].status).toBe('failed');
      expect(parsed.body.data[0].retry_count).toBe(3);
    });

    it('should handle pagination with custom limit', async () => {
      const mockEvents = Array.from({ length: 10 }, (_, i) => ({
        event_id: `event-${i}`,
        payload: `{"test":"data${i}"}`,
        metadata: null,
        status: 'pending',
        created_at: '2025-11-11T10:00:00Z',
        updated_at: '2025-11-11T10:00:00Z',
        retry_count: 0,
      }));

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 100 }));

      const request = createRequest({ limit: '10' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.limit).toBe(10);
      expect(parsed.body.offset).toBe(0);
      expect(parsed.body.total).toBe(100);
    });

    it('should handle pagination with offset', async () => {
      const mockEvents = [
        {
          event_id: 'event-50',
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 100 }));

      const request = createRequest({ limit: '10', offset: '50' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.limit).toBe(10);
      expect(parsed.body.offset).toBe(50);
      expect(parsed.body.total).toBe(100);
    });

    it('should cap limit at 1000', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest({ limit: '5000' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.limit).toBe(1000); // Capped at 1000
    });

    it('should return empty array for no results', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest({ status: 'pending' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data).toEqual([]);
      expect(parsed.body.total).toBe(0);
      expect(parsed.body.limit).toBe(50);
      expect(parsed.body.offset).toBe(0);
    });

    it('should return empty array when offset exceeds total', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 10 }));

      const request = createRequest({ offset: '9999' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data).toEqual([]);
      expect(parsed.body.total).toBe(10);
      expect(parsed.body.offset).toBe(9999);
    });

    it('should include all event fields in response', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"user_id":123,"action":"login"}',
          metadata: '{"source":"web","region":"us-east"}',
          status: 'delivered',
          created_at: '2025-11-11T10:00:00.123Z',
          updated_at: '2025-11-11T10:05:00.456Z',
          retry_count: 2,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      const event = parsed.body.data[0];
      expect(event.event_id).toBe('event-1');
      expect(event.payload).toEqual({ user_id: 123, action: 'login' });
      expect(event.metadata).toEqual({ source: 'web', region: 'us-east' });
      expect(event.status).toBe('delivered');
      expect(event.created_at).toBe('2025-11-11T10:00:00.123Z');
      expect(event.updated_at).toBe('2025-11-11T10:05:00.456Z');
      expect(event.retry_count).toBe(2);
    });
  });

  describe('validation errors', () => {
    it('should return 400 for invalid status', async () => {
      const request = createRequest({ status: 'invalid' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('Invalid status');
      expect(parsed.body.error.message).toContain('pending, delivered, failed');
      expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
      expect(parsed.body.error.timestamp).toBeDefined();
    });

    it('should return 400 for invalid from timestamp', async () => {
      const request = createRequest({ from: 'not-a-date' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('Invalid from timestamp');
      expect(parsed.body.error.message).toContain('ISO-8601');
    });

    it('should return 400 for invalid to timestamp', async () => {
      const request = createRequest({ to: 'invalid-date' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('Invalid to timestamp');
      expect(parsed.body.error.message).toContain('ISO-8601');
    });

    it('should return 400 for negative offset', async () => {
      const request = createRequest({ offset: '-1' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('offset must be >= 0');
    });

    it('should return 400 for invalid limit (non-numeric)', async () => {
      const request = createRequest({ limit: 'abc' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('limit must be a positive integer');
    });

    it('should return 400 for zero limit', async () => {
      const request = createRequest({ limit: '0' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('limit must be a positive integer');
    });

    it('should return 400 for invalid offset (non-numeric)', async () => {
      const request = createRequest({ offset: 'xyz' });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(400);
      expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      expect(parsed.body.error.message).toContain('offset must be >= 0');
    });
  });

  describe('edge cases', () => {
    it('should accept valid ISO-8601 timestamps', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest({
        from: '2025-11-11T00:00:00.000Z',
        to: '2025-11-11T23:59:59.999Z',
      });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
    });

    it('should accept timestamps without milliseconds', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest({
        from: '2025-11-11T00:00:00Z',
        to: '2025-11-11T23:59:59Z',
      });
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      mockD1.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error('D1 connection failed')),
      });

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(500);
      expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
      expect(parsed.body.error.message).toBe('Failed to query inbox');
      expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
    });

    it('should handle null metadata correctly', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        },
      ];

      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.status).toBe(200);
      expect(parsed.body.data[0].metadata).toBeUndefined();
    });

    it('should handle all three status values', async () => {
      for (const status of ['pending', 'delivered', 'failed']) {
        vi.clearAllMocks();
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

        const request = createRequest({ status });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
      }
    });
  });

  describe('response structure', () => {
    it('should have correct response structure', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.body).toHaveProperty('data');
      expect(parsed.body).toHaveProperty('total');
      expect(parsed.body).toHaveProperty('limit');
      expect(parsed.body).toHaveProperty('offset');
      expect(parsed.body).toHaveProperty('timestamp');
      expect(Array.isArray(parsed.body.data)).toBe(true);
      expect(typeof parsed.body.total).toBe('number');
      expect(typeof parsed.body.limit).toBe('number');
      expect(typeof parsed.body.offset).toBe('number');
      expect(typeof parsed.body.timestamp).toBe('string');
    });

    it('should have valid ISO-8601 timestamp in response', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
      const parsed = await parseResponse(response);

      expect(parsed.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const timestamp = new Date(parsed.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should set correct response headers', async () => {
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
      mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

      const request = createRequest();
      const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('X-Correlation-ID')).toBe('test-correlation-id');
    });
  });

  describe('Story 3.2: Advanced filtering and pagination', () => {
    describe('multiple status filtering', () => {
      it('should filter by single status', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ status: 'pending' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should filter by multiple statuses (comma-separated)', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data1"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
          {
            event_id: 'event-2',
            payload: '{"test":"data2"}',
            metadata: null,
            status: 'failed',
            created_at: '2025-11-11T09:00:00Z',
            updated_at: '2025-11-11T09:00:00Z',
            retry_count: 3,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 2 }));

        const request = createRequest({ status: 'pending,failed' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(2);
        expect(parsed.body._metadata.filters_applied).toBe(2);
      });

      it('should reject invalid status in comma-separated list', async () => {
        const request = createRequest({ status: 'pending,invalid,failed' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('Invalid status: invalid');
      });
    });

    describe('retry count filtering', () => {
      it('should filter by min_retries', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'failed',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 3,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ min_retries: '2' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body.data[0].retry_count).toBe(3);
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should filter by max_retries', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 1,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ max_retries: '2' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should filter by retry count range', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'failed',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 3,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ min_retries: '2', max_retries: '5' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(2);
      });

      it('should reject negative min_retries', async () => {
        const request = createRequest({ min_retries: '-1' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('min_retries must be >= 0');
      });

      it('should reject non-numeric max_retries', async () => {
        const request = createRequest({ max_retries: 'abc' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('max_retries must be >= 0');
      });
    });

    describe('metadata filtering', () => {
      it('should filter by single metadata field', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: '{"source":"auth-service"}',
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ 'metadata.source': 'auth-service' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body.data[0].metadata).toEqual({ source: 'auth-service' });
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should filter by multiple metadata fields', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: '{"source":"auth-service","region":"us-east-1"}',
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          'metadata.source': 'auth-service',
          'metadata.region': 'us-east-1',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(2);
      });
    });

    describe('payload filtering', () => {
      it('should filter by single payload field', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"user_id":"123","action":"login"}',
            metadata: null,
            status: 'delivered',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ 'payload.user_id': '123' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body.data[0].payload.user_id).toBe('123');
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should filter by multiple payload fields', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"user_id":"123","action":"login"}',
            metadata: null,
            status: 'delivered',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          'payload.user_id': '123',
          'payload.action': 'login',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(2);
      });
    });

    describe('date-only filtering', () => {
      it('should filter by created_date (YYYY-MM-DD)', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ created_date: '2025-11-11' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(1);
      });

      it('should reject invalid created_date format', async () => {
        const request = createRequest({ created_date: '11-11-2025' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('YYYY-MM-DD');
      });

      it('should reject created_date with timestamp', async () => {
        const request = createRequest({ created_date: '2025-11-11T10:00:00Z' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      });
    });

    describe('sorting', () => {
      it('should sort by created_at DESC (default)', async () => {
        const mockEvents = [
          {
            event_id: 'event-2',
            payload: '{"test":"data2"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T11:00:00Z',
            updated_at: '2025-11-11T11:00:00Z',
            retry_count: 0,
          },
          {
            event_id: 'event-1',
            payload: '{"test":"data1"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 2 }));

        const request = createRequest();
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.sort_field).toBe('created_at');
        expect(parsed.body._metadata.sort_order).toBe('desc');
      });

      it('should sort by retry_count DESC', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'failed',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 5,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ sort: 'retry_count', order: 'desc' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.sort_field).toBe('retry_count');
        expect(parsed.body._metadata.sort_order).toBe('desc');
      });

      it('should sort by updated_at ASC', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ sort: 'updated_at', order: 'asc' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.sort_field).toBe('updated_at');
        expect(parsed.body._metadata.sort_order).toBe('asc');
      });

      it('should reject invalid sort field', async () => {
        const request = createRequest({ sort: 'invalid_field' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('Invalid sort field');
      });

      it('should reject invalid sort order', async () => {
        const request = createRequest({ order: 'invalid' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('Invalid order');
      });
    });

    describe('cursor-based pagination', () => {
      it('should return next_cursor when more results available', async () => {
        const mockEvents = Array.from({ length: 50 }, (_, i) => ({
          event_id: `event-${i}`,
          payload: `{"test":"data${i}"}`,
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        }));

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 100 }));

        const request = createRequest({ limit: '50' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.next_cursor).toBeDefined();
        expect(typeof parsed.body.next_cursor).toBe('string');
      });

      it('should not return next_cursor when on last page', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ limit: '50' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.next_cursor).toBeUndefined();
      });

      it('should accept valid cursor parameter', async () => {
        const mockEvents = [
          {
            event_id: 'event-2',
            payload: '{"test":"data2"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T09:00:00Z',
            updated_at: '2025-11-11T09:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        // Create a valid base64-encoded cursor
        const cursor = Buffer.from(
          JSON.stringify({ eventId: 'event-1', createdAt: '2025-11-11T10:00:00Z' })
        ).toString('base64');

        const request = createRequest({ cursor });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
      });

      it('should reject invalid cursor', async () => {
        const request = createRequest({ cursor: 'invalid-base64' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_CURSOR');
        expect(parsed.body.error.message).toContain('Invalid cursor format');
      });

      it('should reject malformed cursor (valid base64, invalid JSON)', async () => {
        const cursor = Buffer.from('not json').toString('base64');
        const request = createRequest({ cursor });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_CURSOR');
      });
    });

    describe('DoS prevention', () => {
      it('should allow exactly 10 filters', async () => {
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

        const request = createRequest({
          status: 'pending,failed', // 2 filters
          from: '2025-11-11T00:00:00Z', // 1 filter
          to: '2025-11-11T23:59:59Z', // 1 filter
          min_retries: '1', // 1 filter
          max_retries: '3', // 1 filter
          'metadata.source': 'test', // 1 filter
          'metadata.region': 'us-east', // 1 filter
          'payload.user_id': '123', // 1 filter
          'payload.action': 'login', // 1 filter
          // Total: 10 filters
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.filters_applied).toBe(10);
      });

      it('should reject more than 10 filters', async () => {
        const request = createRequest({
          status: 'pending,failed', // 2 filters
          from: '2025-11-11T00:00:00Z', // 1 filter
          to: '2025-11-11T23:59:59Z', // 1 filter
          min_retries: '1', // 1 filter
          max_retries: '3', // 1 filter
          'metadata.source': 'test', // 1 filter
          'metadata.region': 'us-east', // 1 filter
          'metadata.env': 'prod', // 1 filter
          'payload.user_id': '123', // 1 filter
          'payload.action': 'login', // 1 filter
          // Total: 11 filters
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('TOO_MANY_FILTERS');
        expect(parsed.body.error.message).toContain('Maximum 10 filters');
      });
    });

    describe('complex filter combinations', () => {
      it('should combine status, retry count, and metadata filters', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: '{"source":"auth-service"}',
            status: 'failed',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 3,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          status: 'failed',
          min_retries: '2',
          'metadata.source': 'auth-service',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
        expect(parsed.body._metadata.filters_applied).toBe(3);
      });

      it('should combine payload filters with sorting', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"user_id":"123","action":"login"}',
            metadata: null,
            status: 'delivered',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          'payload.user_id': '123',
          sort: 'created_at',
          order: 'asc',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.filters_applied).toBe(1);
        expect(parsed.body._metadata.sort_field).toBe('created_at');
        expect(parsed.body._metadata.sort_order).toBe('asc');
      });

      it('should combine all filter types', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"user_id":"123"}',
            metadata: '{"source":"auth-service"}',
            status: 'failed',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 3,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          status: 'failed',
          created_date: '2025-11-11',
          min_retries: '2',
          max_retries: '5',
          'metadata.source': 'auth-service',
          'payload.user_id': '123',
          sort: 'retry_count',
          order: 'desc',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.filters_applied).toBe(6);
      });
    });

    describe('backward compatibility', () => {
      it('should still work with original single status filter', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({ status: 'pending' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
      });

      it('should still work with original offset/limit pagination', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 100 }));

        const request = createRequest({ limit: '10', offset: '50' });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.limit).toBe(10);
        expect(parsed.body.offset).toBe(50);
      });

      it('should still work with timestamp range filters', async () => {
        const mockEvents = [
          {
            event_id: 'event-1',
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          },
        ];

        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement(mockEvents));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 1 }));

        const request = createRequest({
          from: '2025-11-11T00:00:00Z',
          to: '2025-11-11T23:59:59Z',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data).toHaveLength(1);
      });
    });

    describe('response metadata', () => {
      it('should include _metadata in response', async () => {
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

        const request = createRequest();
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata).toBeDefined();
        expect(parsed.body._metadata.filters_applied).toBe(0);
        expect(parsed.body._metadata.sort_field).toBe('created_at');
        expect(parsed.body._metadata.sort_order).toBe('desc');
      });

      it('should count filters correctly in metadata', async () => {
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement([]));
        mockD1.prepare.mockReturnValueOnce(createMockPreparedStatement({ count: 0 }));

        const request = createRequest({
          status: 'pending,failed',
          min_retries: '2',
          'metadata.source': 'test',
        });
        const response = await handleInboxQuery(request, mockEnv, 'test-correlation-id');
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body._metadata.filters_applied).toBe(4); // 2 statuses + min_retries + metadata.source
      });
    });
  });

  describe('Story 3.3: POST /inbox/:eventId/ack - Acknowledgment Endpoint', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('successful acknowledgment', () => {
      it('should delete event and return 200', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440000';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: '{"source":"test"}',
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        // Mock getEventById
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        // Mock deleteEvent
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // Mock KV metrics
        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-corr-123',
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.event_id).toBe(eventId);
        expect(parsed.body.data.status).toBe('deleted');
        expect(parsed.body.data.timestamp).toBeDefined();
        expect(parsed.body.timestamp).toBeDefined();
        expect(parsed.headers['x-correlation-id']).toBe('test-corr-123');
        expect(parsed.headers['content-type']).toBe('application/json');
      });

      it('should handle event with delivered status', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440001';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'delivered',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:05:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.event_id).toBe(eventId);
        expect(parsed.body.data.status).toBe('deleted');
      });

      it('should handle event with failed status', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440002';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:10:00Z',
          retry_count: 3,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('2');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.event_id).toBe(eventId);
      });

      it('should decrement metrics after deletion', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440003';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('100');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        await handleAckEvent(request, mockEnv, mockCtx, eventId);

        // Wait for waitUntil promises to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify KV metrics were updated
        expect(mockKV.get).toHaveBeenCalled();
        expect(mockKV.put).toHaveBeenCalled();
      });

      it('should handle large payload events efficiently', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440004';
        const largePayload = JSON.stringify({ data: 'x'.repeat(50000) });
        const mockEvent = {
          event_id: eventId,
          payload: largePayload,
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.status).toBe('deleted');
      });
    });

    describe('error handling', () => {
      it('should return 404 when event not found', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440099';

        // Mock getEventById returning null
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-404',
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(404);
        expect(parsed.body.error.code).toBe('NOT_FOUND');
        expect(parsed.body.error.message).toContain('Event ' + eventId + ' not found');
        expect(parsed.body.error.correlation_id).toBe('test-404');
      });

      it('should return 400 for invalid event ID format', async () => {
        const invalidEventId = 'not-a-uuid';

        const request = new Request('http://localhost:8787/inbox/' + invalidEventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-400',
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, invalidEventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('Invalid event ID format');
        expect(parsed.body.error.correlation_id).toBe('test-400');
      });

      it('should return 500 on database error', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440005';

        // Mock database error
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-500',
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(500);
        expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
        expect(parsed.body.error.message).toBe('Failed to acknowledge event');
        expect(parsed.body.error.correlation_id).toBe('test-500');
      });

      it('should succeed even if KV metrics update fails', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440006';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // KV operation fails
        mockKV.get.mockRejectedValue(new Error('KV unavailable'));
        mockKV.put.mockRejectedValue(new Error('KV unavailable'));

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        // Should still succeed despite KV failure
        expect(parsed.status).toBe(200);
        expect(parsed.body.data.status).toBe('deleted');
      });
    });

    describe('idempotency', () => {
      it('should return 404 on second ack attempt', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440007';

        // First ack: Event exists
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            event_id: eventId,
            payload: '{"test":"data"}',
            metadata: null,
            status: 'pending',
            created_at: '2025-11-11T10:00:00Z',
            updated_at: '2025-11-11T10:00:00Z',
            retry_count: 0,
          }),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request1 = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response1 = await handleAckEvent(request1, mockEnv, mockCtx, eventId);
        expect(response1.status).toBe(200);

        // Second ack: Event no longer exists
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request2 = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response2 = await handleAckEvent(request2, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response2);

        expect(parsed.status).toBe(404);
        expect(parsed.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('correlation ID', () => {
      it('should use provided correlation ID', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440008';
        const correlationId = 'custom-correlation-123';

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': correlationId,
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);

        expect(response.headers.get('x-correlation-id')).toBe(correlationId);
      });

      it('should generate correlation ID if not provided', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440009';

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);

        const correlationId = response.headers.get('x-correlation-id');
        expect(correlationId).toBeDefined();
        expect(correlationId).not.toBe('');
      });
    });

    describe('response structure', () => {
      it('should have correct response structure', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440010';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.body).toHaveProperty('data');
        expect(parsed.body).toHaveProperty('timestamp');
        expect(parsed.body.data).toHaveProperty('event_id');
        expect(parsed.body.data).toHaveProperty('status');
        expect(parsed.body.data).toHaveProperty('timestamp');
        expect(typeof parsed.body.data.event_id).toBe('string');
        expect(parsed.body.data.status).toBe('deleted');
        expect(typeof parsed.body.timestamp).toBe('string');
      });

      it('should have valid ISO-8601 timestamps', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440011';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(parsed.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        const dataTimestamp = new Date(parsed.body.data.timestamp);
        const responseTimestamp = new Date(parsed.body.timestamp);
        expect(dataTimestamp.getTime()).not.toBeNaN();
        expect(responseTimestamp.getTime()).not.toBeNaN();
      });

      it('should set correct response headers', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440012';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-headers',
          },
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);

        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('cache-control')).toBe('no-cache');
        expect(response.headers.get('x-correlation-id')).toBe('test-headers');
      });
    });

    describe('UUID validation edge cases', () => {
      it('should reject short strings', async () => {
        const invalidId = 'short';
        const request = new Request('http://localhost:8787/inbox/' + invalidId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, invalidId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      });

      it('should reject malformed UUIDs', async () => {
        const invalidId = '550e8400-e29b-41d4-a716-44665544000X';
        const request = new Request('http://localhost:8787/inbox/' + invalidId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, invalidId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
      });

      it('should accept valid UUIDs with different cases', async () => {
        const eventId = '550E8400-E29B-41D4-A716-446655440013';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/ack', {
          method: 'POST',
        });

        const response = await handleAckEvent(request, mockEnv, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
      });
    });
  });

  describe('Story 3.4: POST /inbox/:eventId/retry - Retry Failed Events', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // Mock Queue
    const mockQueue = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const mockEnvWithQueue = {
      ...mockEnv,
      EVENT_QUEUE: mockQueue,
    } as unknown as Env;

    describe('successful retry', () => {
      it('should retry a failed event with retry_count=0', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440000';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: '{"source":"test"}',
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        // Mock getEventById
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        // Mock incrementRetryCount
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // Mock updateEventStatus
        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // Mock KV metrics
        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-retry-1',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.event_id).toBe(eventId);
        expect(parsed.body.data.status).toBe('retrying');
        expect(parsed.body.data.new_attempt).toBe(1);
        expect(parsed.body.data.timestamp).toBeDefined();
        expect(parsed.body.timestamp).toBeDefined();
        expect(parsed.headers['x-correlation-id']).toBe('test-retry-1');

        // Verify queue message was sent
        expect(mockQueue.send).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId,
            payload: { test: 'data' },
            metadata: { source: 'test' },
            retryCount: 1,
            correlationId: 'test-retry-1',
            attempt: 'manual_retry',
          })
        );
      });

      it('should retry a failed event with retry_count=1', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440001';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:05:00Z',
          retry_count: 1,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.new_attempt).toBe(2);
      });

      it('should retry a failed event with retry_count=2 (last allowed retry)', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440002';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:10:00Z',
          retry_count: 2,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(200);
        expect(parsed.body.data.new_attempt).toBe(3);
        expect(mockQueue.send).toHaveBeenCalledWith(
          expect.objectContaining({
            retryCount: 3,
          })
        );
      });

      it('should decrement failed metrics after retry', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440003';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('10');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        // Wait for waitUntil to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockKV.get).toHaveBeenCalled();
        expect(mockKV.put).toHaveBeenCalled();
      });
    });

    describe('validation errors', () => {
      it('should return 404 when event not found', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440099';

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-404',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(404);
        expect(parsed.body.error.code).toBe('NOT_FOUND');
        expect(parsed.body.error.message).toContain('Event ' + eventId + ' not found');
        expect(parsed.body.error.correlation_id).toBe('test-404');
      });

      it('should return 400 for invalid event ID format', async () => {
        const invalidEventId = 'not-a-uuid';

        const request = new Request('http://localhost:8787/inbox/' + invalidEventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-400',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, invalidEventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(400);
        expect(parsed.body.error.code).toBe('INVALID_PARAMETER');
        expect(parsed.body.error.message).toContain('Invalid event ID format');
        expect(parsed.body.error.correlation_id).toBe('test-400');
      });

      it('should return 409 when event status is pending', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440010';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'pending',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-409-pending',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(409);
        expect(parsed.body.error.code).toBe('INVALID_STATE');
        expect(parsed.body.error.message).toContain("Event status is 'pending'");
        expect(parsed.body.error.message).toContain("only 'failed' events can be retried");
        expect(parsed.body.error.correlation_id).toBe('test-409-pending');
      });

      it('should return 409 when event status is delivered', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440011';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'delivered',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:05:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(409);
        expect(parsed.body.error.code).toBe('INVALID_STATE');
        expect(parsed.body.error.message).toContain("Event status is 'delivered'");
      });

      it('should return 409 when retry_count is 3 (max retries exceeded)', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440012';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:10:00Z',
          retry_count: 3,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-409-max',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(409);
        expect(parsed.body.error.code).toBe('MAX_RETRIES_EXCEEDED');
        expect(parsed.body.error.message).toContain('Event has already been retried 3 times');
        expect(parsed.body.error.message).toContain('max: 3');
        expect(parsed.body.error.correlation_id).toBe('test-409-max');
      });

      it('should return 409 when retry_count is greater than 3', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440013';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:10:00Z',
          retry_count: 5,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(409);
        expect(parsed.body.error.code).toBe('MAX_RETRIES_EXCEEDED');
        expect(parsed.body.error.message).toContain('Event has already been retried 5 times');
      });
    });

    describe('queue integration', () => {
      it('should send correct queue message with all required fields', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440020';
        const mockEvent = {
          event_id: eventId,
          payload: '{"user_id":"123","action":"login"}',
          metadata: '{"source":"auth-service","region":"us-east"}',
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:05:00Z',
          retry_count: 1,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-queue-msg',
          },
        });

        await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        expect(mockQueue.send).toHaveBeenCalledTimes(1);
        expect(mockQueue.send).toHaveBeenCalledWith({
          eventId,
          payload: { user_id: '123', action: 'login' },
          metadata: { source: 'auth-service', region: 'us-east' },
          retryCount: 2,
          correlationId: 'test-queue-msg',
          attempt: 'manual_retry',
        });
      });

      it('should send queue message with null metadata when metadata is null', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440021';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        expect(mockQueue.send).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: undefined,
          })
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440030';

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-500',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.status).toBe(500);
        expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
        expect(parsed.body.error.message).toBe('Failed to retry event');
        expect(parsed.body.error.correlation_id).toBe('test-500');
      });

      it('should succeed even if KV metrics update fails', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440031';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // KV fails
        mockKV.get.mockRejectedValue(new Error('KV unavailable'));
        mockKV.put.mockRejectedValue(new Error('KV unavailable'));

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        // Should still succeed despite KV failure
        expect(parsed.status).toBe(200);
        expect(parsed.body.data.status).toBe('retrying');
      });

      it('should handle queue send failure gracefully', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440032';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        // Queue fails
        const mockEnvWithFailingQueue = {
          ...mockEnv,
          EVENT_QUEUE: {
            send: vi.fn().mockRejectedValue(new Error('Queue unavailable')),
          },
        } as unknown as Env;

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithFailingQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        // Should fail with 500 when queue unavailable
        expect(parsed.status).toBe(500);
        expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
      });
    });

    describe('correlation ID', () => {
      it('should use provided correlation ID', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440040';
        const correlationId = 'custom-correlation-456';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': correlationId,
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        expect(response.headers.get('x-correlation-id')).toBe(correlationId);

        // Verify queue message includes correlation ID
        expect(mockQueue.send).toHaveBeenCalledWith(
          expect.objectContaining({
            correlationId,
          })
        );
      });

      it('should generate correlation ID if not provided', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440041';

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        });

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        const correlationId = response.headers.get('x-correlation-id');
        expect(correlationId).toBeDefined();
        expect(correlationId).not.toBe('');
      });
    });

    describe('response structure', () => {
      it('should have correct response structure', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440050';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.body).toHaveProperty('data');
        expect(parsed.body).toHaveProperty('timestamp');
        expect(parsed.body.data).toHaveProperty('event_id');
        expect(parsed.body.data).toHaveProperty('status');
        expect(parsed.body.data).toHaveProperty('new_attempt');
        expect(parsed.body.data).toHaveProperty('timestamp');
        expect(typeof parsed.body.data.event_id).toBe('string');
        expect(parsed.body.data.status).toBe('retrying');
        expect(typeof parsed.body.data.new_attempt).toBe('number');
        expect(typeof parsed.body.timestamp).toBe('string');
      });

      it('should have valid ISO-8601 timestamps', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440051';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);
        const parsed = await parseResponse(response);

        expect(parsed.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(parsed.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        const dataTimestamp = new Date(parsed.body.data.timestamp);
        const responseTimestamp = new Date(parsed.body.timestamp);
        expect(dataTimestamp.getTime()).not.toBeNaN();
        expect(responseTimestamp.getTime()).not.toBeNaN();
      });

      it('should set correct response headers', async () => {
        const eventId = '550e8400-e29b-41d4-a716-446655440052';
        const mockEvent = {
          event_id: eventId,
          payload: '{"test":"data"}',
          metadata: null,
          status: 'failed',
          created_at: '2025-11-11T10:00:00Z',
          updated_at: '2025-11-11T10:00:00Z',
          retry_count: 0,
        };

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(mockEvent),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockD1.prepare.mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
        });

        mockKV.get.mockResolvedValue('5');
        mockKV.put.mockResolvedValue(undefined);

        const request = new Request('http://localhost:8787/inbox/' + eventId + '/retry', {
          method: 'POST',
          headers: {
            'x-correlation-id': 'test-headers',
          },
        });

        const response = await handleRetryEvent(request, mockEnvWithQueue, mockCtx, eventId);

        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('cache-control')).toBe('no-cache');
        expect(response.headers.get('x-correlation-id')).toBe('test-headers');
      });
    });
  });
});
