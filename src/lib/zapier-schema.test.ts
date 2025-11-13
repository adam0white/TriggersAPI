/**
 * Unit tests for Zapier Schema Validation
 * Epic 8.4: Security & Validation
 */

import { describe, it, expect } from 'vitest';
import { validateZapierEvent } from './zapier-schema';

describe('validateZapierEvent', () => {
	const validEvent = {
		event_id: 'evt_test_123',
		event_type: 'test_event',
		timestamp: '2025-11-12T10:30:00.000Z',
		payload: {
			message: 'Test event',
			value: 42,
		},
		metadata: {
			correlation_id: 'corr_123',
			source_ip: '192.168.1.1',
			user_agent: 'test-agent',
		},
		created_at: '2025-11-12T10:30:00.000Z',
	};

	describe('valid events', () => {
		it('should validate a valid event', () => {
			const result = validateZapierEvent(validEvent);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate event with minimal payload', () => {
			const result = validateZapierEvent({
				...validEvent,
				payload: {},
			});

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate event with minimal metadata', () => {
			const result = validateZapierEvent({
				...validEvent,
				metadata: {},
			});

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('invalid event structure', () => {
		it('should reject non-object event', () => {
			const result = validateZapierEvent('not an object');

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].field).toBe('$');
			expect(result.errors[0].constraint).toBe('type');
		});

		it('should reject null event', () => {
			const result = validateZapierEvent(null);

			expect(result.valid).toBe(false);
			expect(result.errors[0].field).toBe('$');
		});

		it('should reject array event', () => {
			const result = validateZapierEvent([]);

			expect(result.valid).toBe(false);
		});
	});

	describe('required fields', () => {
		it('should reject event missing event_id', () => {
			const { event_id, ...eventWithoutId } = validEvent;
			const result = validateZapierEvent(eventWithoutId);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_id' && e.constraint === 'required')).toBe(true);
		});

		it('should reject event missing event_type', () => {
			const { event_type, ...eventWithoutType } = validEvent;
			const result = validateZapierEvent(eventWithoutType);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_type' && e.constraint === 'required')).toBe(
				true
			);
		});

		it('should reject event missing timestamp', () => {
			const { timestamp, ...eventWithoutTimestamp } = validEvent;
			const result = validateZapierEvent(eventWithoutTimestamp);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'timestamp' && e.constraint === 'required')).toBe(
				true
			);
		});

		it('should reject event missing payload', () => {
			const { payload, ...eventWithoutPayload } = validEvent;
			const result = validateZapierEvent(eventWithoutPayload);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'payload' && e.constraint === 'required')).toBe(true);
		});

		it('should reject event missing metadata', () => {
			const { metadata, ...eventWithoutMetadata } = validEvent;
			const result = validateZapierEvent(eventWithoutMetadata);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'metadata' && e.constraint === 'required')).toBe(
				true
			);
		});

		it('should reject event missing created_at', () => {
			const { created_at, ...eventWithoutCreatedAt } = validEvent;
			const result = validateZapierEvent(eventWithoutCreatedAt);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'created_at' && e.constraint === 'required')).toBe(
				true
			);
		});

		it('should report multiple missing fields', () => {
			const result = validateZapierEvent({});

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThanOrEqual(6); // All required fields
		});
	});

	describe('event_id validation', () => {
		it('should reject non-string event_id', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: 123 });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_id' && e.constraint === 'type')).toBe(true);
		});

		it('should reject empty event_id', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: '' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_id' && e.constraint === 'length')).toBe(true);
		});

		it('should reject event_id longer than 255 characters', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: 'a'.repeat(256) });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_id' && e.constraint === 'length')).toBe(true);
		});

		it('should reject event_id with invalid characters', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: 'evt@test#123' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_id' && e.constraint === 'pattern')).toBe(true);
		});

		it('should accept event_id with underscores', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: 'evt_test_123' });

			expect(result.valid).toBe(true);
		});

		it('should accept event_id with hyphens', () => {
			const result = validateZapierEvent({ ...validEvent, event_id: 'evt-test-123' });

			expect(result.valid).toBe(true);
		});
	});

	describe('event_type validation', () => {
		it('should reject non-string event_type', () => {
			const result = validateZapierEvent({ ...validEvent, event_type: 123 });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_type' && e.constraint === 'type')).toBe(true);
		});

		it('should reject empty event_type', () => {
			const result = validateZapierEvent({ ...validEvent, event_type: '' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_type' && e.constraint === 'length')).toBe(
				true
			);
		});

		it('should reject event_type with hyphens', () => {
			const result = validateZapierEvent({ ...validEvent, event_type: 'test-event' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'event_type' && e.constraint === 'pattern')).toBe(
				true
			);
		});

		it('should accept event_type with underscores', () => {
			const result = validateZapierEvent({ ...validEvent, event_type: 'test_event' });

			expect(result.valid).toBe(true);
		});
	});

	describe('timestamp validation', () => {
		it('should reject non-string timestamp', () => {
			const result = validateZapierEvent({ ...validEvent, timestamp: 1234567890 });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'timestamp' && e.constraint === 'type')).toBe(true);
		});

		it('should reject invalid ISO-8601 timestamp', () => {
			const result = validateZapierEvent({ ...validEvent, timestamp: '2025-11-12' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'timestamp' && e.constraint === 'format')).toBe(true);
		});

		it('should reject malformed timestamp', () => {
			const result = validateZapierEvent({ ...validEvent, timestamp: 'not-a-date' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'timestamp' && e.constraint === 'format')).toBe(true);
		});

		it('should accept valid ISO-8601 timestamp', () => {
			const result = validateZapierEvent({
				...validEvent,
				timestamp: '2025-11-12T10:30:00.000Z',
			});

			expect(result.valid).toBe(true);
		});
	});

	describe('payload validation', () => {
		it('should reject non-object payload', () => {
			const result = validateZapierEvent({ ...validEvent, payload: 'not an object' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'payload' && e.constraint === 'type')).toBe(true);
		});

		it('should reject null payload', () => {
			const result = validateZapierEvent({ ...validEvent, payload: null });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'payload' && e.constraint === 'type')).toBe(true);
		});

		it('should reject payload with more than 100 properties', () => {
			const largePayload = Object.fromEntries(
				Array.from({ length: 101 }, (_, i) => [`key${i}`, i])
			);
			const result = validateZapierEvent({ ...validEvent, payload: largePayload });

			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.field === 'payload' && e.constraint === 'maxProperties')
			).toBe(true);
		});

		it('should accept payload with exactly 100 properties', () => {
			const largePayload = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, i]));
			const result = validateZapierEvent({ ...validEvent, payload: largePayload });

			expect(result.valid).toBe(true);
		});
	});

	describe('metadata validation', () => {
		it('should reject non-object metadata', () => {
			const result = validateZapierEvent({ ...validEvent, metadata: 'not an object' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'metadata' && e.constraint === 'type')).toBe(true);
		});

		it('should reject null metadata', () => {
			const result = validateZapierEvent({ ...validEvent, metadata: null });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'metadata' && e.constraint === 'type')).toBe(true);
		});
	});

	describe('created_at validation', () => {
		it('should reject non-string created_at', () => {
			const result = validateZapierEvent({ ...validEvent, created_at: 1234567890 });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'created_at' && e.constraint === 'type')).toBe(true);
		});

		it('should reject invalid ISO-8601 created_at', () => {
			const result = validateZapierEvent({ ...validEvent, created_at: 'invalid-date' });

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === 'created_at' && e.constraint === 'format')).toBe(
				true
			);
		});
	});
});
