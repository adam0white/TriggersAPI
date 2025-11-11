/**
 * Tests for Request Validation Module
 *
 * Validates all acceptance criteria for request validation:
 * - payload field is required
 * - payload must be JSON object
 * - metadata is optional
 * - metadata if present must be JSON object
 */

import { describe, it, expect } from 'vitest';
import { validateEventRequest } from '../../src/lib/validation';

describe('validateEventRequest', () => {
	describe('valid requests', () => {
		it('should accept valid request with payload only', () => {
			const body = {
				payload: { test: 'data' },
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.payload).toEqual({ test: 'data' });
				expect(result.data.metadata).toBeUndefined();
			}
		});

		it('should accept valid request with payload and metadata', () => {
			const body = {
				payload: { test: 'data' },
				metadata: { event_type: 'user.created', source: 'auth-service' },
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.payload).toEqual({ test: 'data' });
				expect(result.data.metadata).toEqual({ event_type: 'user.created', source: 'auth-service' });
			}
		});

		it('should accept empty payload object', () => {
			const body = {
				payload: {},
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.payload).toEqual({});
			}
		});

		it('should accept empty metadata object', () => {
			const body = {
				payload: { test: 'data' },
				metadata: {},
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.metadata).toEqual({});
			}
		});
	});

	describe('invalid request body type', () => {
		it('should reject null body', () => {
			const result = validateEventRequest(null);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe('Request body must be a JSON object');
			}
		});

		it('should reject array body', () => {
			const result = validateEventRequest([{ payload: {} }]);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe('Request body must be a JSON object');
			}
		});

		it('should reject string body', () => {
			const result = validateEventRequest('not an object');

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe('Request body must be a JSON object');
			}
		});

		it('should reject number body', () => {
			const result = validateEventRequest(123);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe('Request body must be a JSON object');
			}
		});

		it('should reject boolean body', () => {
			const result = validateEventRequest(true);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe('Request body must be a JSON object');
			}
		});
	});

	describe('missing payload field', () => {
		it('should reject request with no payload field', () => {
			const body = {
				metadata: { test: 'data' },
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("Request body must contain 'payload' field");
			}
		});

		it('should reject empty object', () => {
			const body = {};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("Request body must contain 'payload' field");
			}
		});
	});

	describe('invalid payload type', () => {
		it('should reject null payload', () => {
			const body = {
				payload: null,
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'payload' field must be a JSON object");
			}
		});

		it('should reject array payload', () => {
			const body = {
				payload: ['not', 'an', 'object'],
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'payload' field must be a JSON object");
			}
		});

		it('should reject string payload', () => {
			const body = {
				payload: 'not an object',
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'payload' field must be a JSON object");
			}
		});

		it('should reject number payload', () => {
			const body = {
				payload: 42,
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'payload' field must be a JSON object");
			}
		});
	});

	describe('invalid metadata type', () => {
		it('should reject null metadata', () => {
			const body = {
				payload: { test: 'data' },
				metadata: null,
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'metadata' field must be a JSON object");
			}
		});

		it('should reject array metadata', () => {
			const body = {
				payload: { test: 'data' },
				metadata: ['not', 'an', 'object'],
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'metadata' field must be a JSON object");
			}
		});

		it('should reject string metadata', () => {
			const body = {
				payload: { test: 'data' },
				metadata: 'not an object',
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'metadata' field must be a JSON object");
			}
		});

		it('should reject number metadata', () => {
			const body = {
				payload: { test: 'data' },
				metadata: 42,
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error.code).toBe('INVALID_PAYLOAD');
				expect(result.error.message).toBe("'metadata' field must be a JSON object");
			}
		});
	});

	describe('edge cases', () => {
		it('should handle nested objects in payload', () => {
			const body = {
				payload: {
					nested: {
						deeply: {
							value: 'test',
						},
					},
				},
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.payload.nested.deeply.value).toBe('test');
			}
		});

		it('should handle arrays within payload object', () => {
			const body = {
				payload: {
					items: [1, 2, 3],
				},
			};

			const result = validateEventRequest(body);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.data.payload.items).toEqual([1, 2, 3]);
			}
		});

		it('should handle undefined metadata (different from null)', () => {
			const body = {
				payload: { test: 'data' },
				metadata: undefined,
			};

			const result = validateEventRequest(body);

			// undefined metadata should be accepted (it's optional)
			expect(result.valid).toBe(true);
		});
	});
});
