/**
 * Tail Event Processor Tests
 *
 * Tests for TailEventProcessor class
 * Verifies log parsing, exception handling, and structured logging
 */

import { describe, it, expect } from 'vitest';
import { TailEventProcessor } from '../../src/lib/tail-processor';
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

describe('TailEventProcessor', () => {
	describe('processTraces', () => {
		it('should process console logs into structured entries', () => {
			const traces: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Event received'] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				log_level: 'info',
				message: 'Event received',
				worker_name: 'triggers-api',
			});
			expect(logs[0].log_id).toBeDefined();
			expect(logs[0].timestamp).toBeDefined();
		});

		it('should parse structured JSON logs and extract correlation_id', () => {
			const correlationId = 'test-correlation-id';
			const traces: TailItem[] = [
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
									context: { foo: 'bar' },
								}),
							] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0].correlation_id).toBe(correlationId);
			expect(logs[0].message).toBe('Structured log');
		});

		it('should handle exceptions and convert to error logs', () => {
			const traces: TailItem[] = [
				createTestTrace({
					exceptions: [
						{
							timestamp: Date.now(),
							name: 'TypeError',
							message: 'Cannot read property of undefined',
						},
					],
					outcome: 'exception',
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0].log_level).toBe('error');
			expect(logs[0].message).toContain('TypeError');
			expect(logs[0].message).toContain('Cannot read property of undefined');
		});

		it('should create summary entry for traces with no logs or exceptions', () => {
			const traces: TailItem[] = [
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

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0].message).toContain('Worker invocation');
			expect(logs[0].message).toContain('ok');
		});

		it('should map log level "log" to "info"', () => {
			const traces: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'log',
							message: ['Console log message'] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0].log_level).toBe('info');
		});

		it('should include request/response context in logs', () => {
			const traces: TailItem[] = [
				createTestTrace({
					event: {
						request: {
							method: 'POST',
							url: 'https://api.example.com/events',
							headers: {},
							getUnredacted: () => ({} as any),
						},
						response: {
							status: 201,
						},
					},
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Request handled'] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			const context = JSON.parse(logs[0].context_json!);
			expect(context.request).toMatchObject({
				method: 'POST',
				url: 'https://api.example.com/events',
			});
			expect(context.response).toMatchObject({
				status: 201,
			});
		});

		it('should handle multiple logs from single trace', () => {
			const traces: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['First log'] as any,
						},
						{
							timestamp: Date.now(),
							level: 'debug',
							message: ['Second log'] as any,
						},
						{
							timestamp: Date.now(),
							level: 'warn',
							message: ['Third log'] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(3);
			expect(logs[0].message).toBe('First log');
			expect(logs[1].message).toBe('Second log');
			expect(logs[2].message).toBe('Third log');
		});

		it('should handle multiple traces in batch', () => {
			const traces: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Trace 1'] as any,
						},
					],
				}),
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Trace 2'] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(2);
			expect(logs[0].message).toBe('Trace 1');
			expect(logs[1].message).toBe('Trace 2');
		});

		it('should format array messages into readable strings', () => {
			const traces: TailItem[] = [
				createTestTrace({
					logs: [
						{
							timestamp: Date.now(),
							level: 'info',
							message: ['Multiple', 'parts', { key: 'value' }] as any,
						},
					],
				}),
			];

			const logs = TailEventProcessor.processTraces(traces);

			expect(logs).toHaveLength(1);
			expect(logs[0].message).toContain('Multiple');
			expect(logs[0].message).toContain('parts');
		});
	});
});
