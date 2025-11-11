/**
 * Tail Worker Integration Tests
 *
 * Tests for processTailEvents function
 * Verifies D1 batch insertion and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processTailEvents } from '../../src/tail/worker';
import type { TailItem } from '../../src/types/tail';

// Helper function to create test TraceItem with required fields
function createTestTrace(overrides: Partial<TailItem> = {}): TailItem {
	return {
		scriptName: 'triggers-api',
		event: null,
		eventTimestamp: Date.now(),
		logs: [],
		exceptions: [],
		diagnosticsChannelEvents: [],
		outcome: 'ok',
		scriptTags: [],
		dispatchNamespace: null,
		scriptVersion: null,
		entrypoint: null,
		executionModel: 'standard',
		truncated: false,
		cpuTime: 10,
		wallTime: 100,
		...overrides,
	};
}

describe('Tail Worker', () => {
	let mockEnv: Env;
	let mockDB: D1Database;

	beforeEach(() => {
		// Mock D1 database
		mockDB = {
			prepare: vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				run: vi.fn().mockResolvedValue({ success: true }),
			}),
			batch: vi.fn().mockResolvedValue([{ success: true }]),
			exec: vi.fn(),
			dump: vi.fn(),
		} as unknown as D1Database;

		mockEnv = {
			DB: mockDB,
		} as Env;
	});

	describe('processTailEvents', () => {
		it('should process tail events and insert logs to D1', async () => {
			const events: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Test log message'] as any,
						},
					],
				}),
			];

			await processTailEvents(events, mockEnv);

			expect(mockDB.batch).toHaveBeenCalled();
		});

		it('should handle multiple traces in single event', async () => {
			const events: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['First trace'] as any,
						},
					],
				}),
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Second trace'] as any,
						},
					],
				}),
			];

			await processTailEvents(events, mockEnv);

			expect(mockDB.batch).toHaveBeenCalled();
		});

		it('should handle exceptions gracefully without throwing', async () => {
			const events: TailItem[] = [
				createTestTrace({
					exceptions: [
						{
							timestamp: Date.now(),
							name: 'Error',
							message: 'Test exception',
						},
					],
					outcome: 'exception',
				}),
			];

			await expect(processTailEvents(events, mockEnv)).resolves.not.toThrow();
		});

		it('should handle D1 batch failures gracefully', async () => {
			// Mock D1 to throw error
			mockDB.batch = vi.fn().mockRejectedValue(new Error('D1 batch failed'));

			const events: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Test log'] as any,
						},
					],
				}),
			];

			// Should not throw even if D1 fails
			await expect(processTailEvents(events, mockEnv)).resolves.not.toThrow();
		});

		it('should skip processing if no traces', async () => {
			const events: TailItem[] = [];

			await processTailEvents(events, mockEnv);

			// Should not call batch if no logs
			expect(mockDB.batch).not.toHaveBeenCalled();
		});

		it('should handle empty events array', async () => {
			const events: TailItem[] = [];

			await processTailEvents(events, mockEnv);

			expect(mockDB.batch).not.toHaveBeenCalled();
		});

		it('should handle traces with no logs or exceptions', async () => {
			const events: TailItem[] = [
				createTestTrace({
					event: {
						request: {
							method: 'GET',
							url: 'https://api.example.com/metrics',
							headers: {},
							getUnredacted: () => ({} as any),
						},
						response: {
							status: 200,
						},
					},
				}),
			];

			await processTailEvents(events, mockEnv);

			// Should create summary entry
			expect(mockDB.batch).toHaveBeenCalled();
		});

		it('should handle structured JSON logs with correlation IDs', async () => {
			const correlationId = 'test-correlation-123';
			const events: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: [
								JSON.stringify({
									level: 'info',
									message: 'Structured log',
									correlation_id: correlationId,
								}),
							] as any,
						},
					],
				}),
			];

			await processTailEvents(events, mockEnv);

			expect(mockDB.batch).toHaveBeenCalled();
		});
	});
});
