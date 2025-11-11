import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('TriggersAPI worker', () => {
	it('responds with HTML dashboard (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		const html = await response.text();
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('TriggersAPI');
		expect(html).toContain('Event Ingestion Dashboard');
		expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
	});

	it('responds with HTML dashboard (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		const html = await response.text();
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('TriggersAPI');
		expect(html).toContain('Event Ingestion Dashboard');
	});
});
