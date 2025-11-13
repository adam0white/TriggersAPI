/**
 * Unit tests for SignatureService
 * Epic 8.4: Security & Validation
 */

import { describe, it, expect } from 'vitest';
import { SignatureService } from './signature-service';

describe('SignatureService', () => {
	const testSecret = 'test-secret-key-12345';
	const testPayload = { event_id: 'test_123', message: 'Hello World' };

	describe('generateSignature', () => {
		it('should generate a valid HMAC-SHA256 signature for string payload', async () => {
			const payload = 'test payload';
			const signature = await SignatureService.generateSignature(payload, testSecret);

			expect(signature).toBeDefined();
			expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex is 64 characters
		});

		it('should generate a valid HMAC-SHA256 signature for object payload', async () => {
			const signature = await SignatureService.generateSignature(testPayload, testSecret);

			expect(signature).toBeDefined();
			expect(signature).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should generate consistent signatures for same payload', async () => {
			const sig1 = await SignatureService.generateSignature(testPayload, testSecret);
			const sig2 = await SignatureService.generateSignature(testPayload, testSecret);

			expect(sig1).toBe(sig2);
		});

		it('should generate different signatures for different payloads', async () => {
			const sig1 = await SignatureService.generateSignature({ message: 'A' }, testSecret);
			const sig2 = await SignatureService.generateSignature({ message: 'B' }, testSecret);

			expect(sig1).not.toBe(sig2);
		});

		it('should generate different signatures for different secrets', async () => {
			const sig1 = await SignatureService.generateSignature(testPayload, 'secret1');
			const sig2 = await SignatureService.generateSignature(testPayload, 'secret2');

			expect(sig1).not.toBe(sig2);
		});
	});

	describe('verifySignature', () => {
		it('should verify valid signature', async () => {
			const payload = JSON.stringify(testPayload);
			const signature = await SignatureService.generateSignature(payload, testSecret);

			const isValid = await SignatureService.verifySignature(payload, signature, testSecret);

			expect(isValid).toBe(true);
		});

		it('should reject invalid signature', async () => {
			const payload = JSON.stringify(testPayload);
			const invalidSignature = 'a'.repeat(64);

			const isValid = await SignatureService.verifySignature(payload, invalidSignature, testSecret);

			expect(isValid).toBe(false);
		});

		it('should reject signature with wrong secret', async () => {
			const payload = JSON.stringify(testPayload);
			const signature = await SignatureService.generateSignature(payload, 'wrong-secret');

			const isValid = await SignatureService.verifySignature(payload, signature, testSecret);

			expect(isValid).toBe(false);
		});

		it('should reject signature with modified payload', async () => {
			const originalPayload = JSON.stringify(testPayload);
			const signature = await SignatureService.generateSignature(originalPayload, testSecret);

			const modifiedPayload = JSON.stringify({ ...testPayload, hacked: true });
			const isValid = await SignatureService.verifySignature(modifiedPayload, signature, testSecret);

			expect(isValid).toBe(false);
		});
	});

	describe('createSignatureHeader', () => {
		it('should create properly formatted signature header', async () => {
			const header = await SignatureService.createSignatureHeader(testPayload, testSecret);

			expect(header).toMatch(/^sha256=[a-f0-9]{64}$/);
		});

		it('should include sha256 algorithm prefix', async () => {
			const header = await SignatureService.createSignatureHeader(testPayload, testSecret);

			expect(header).toContain('sha256=');
		});
	});

	describe('parseSignatureHeader', () => {
		it('should parse valid signature header', () => {
			const validHeader = 'sha256=abc123def456';
			const parsed = SignatureService.parseSignatureHeader(validHeader);

			expect(parsed).not.toBeNull();
			expect(parsed?.algorithm).toBe('sha256');
			expect(parsed?.signature).toBe('abc123def456');
		});

		it('should reject header without algorithm prefix', () => {
			const invalidHeader = 'abc123def456';
			const parsed = SignatureService.parseSignatureHeader(invalidHeader);

			expect(parsed).toBeNull();
		});

		it('should reject header with invalid algorithm', () => {
			const invalidHeader = 'md5=abc123def456';
			const parsed = SignatureService.parseSignatureHeader(invalidHeader);

			expect(parsed).toBeNull();
		});

		it('should reject header with non-hex signature', () => {
			const invalidHeader = 'sha256=GHIJKLMN';
			const parsed = SignatureService.parseSignatureHeader(invalidHeader);

			expect(parsed).toBeNull();
		});

		it('should reject empty header', () => {
			const parsed = SignatureService.parseSignatureHeader('');

			expect(parsed).toBeNull();
		});
	});

	describe('end-to-end signature flow', () => {
		it('should successfully verify signature created with createSignatureHeader', async () => {
			// Create signature header
			const header = await SignatureService.createSignatureHeader(testPayload, testSecret);

			// Parse header
			const parsed = SignatureService.parseSignatureHeader(header);
			expect(parsed).not.toBeNull();

			// Verify signature
			const payload = JSON.stringify(testPayload);
			const isValid = await SignatureService.verifySignature(
				payload,
				parsed!.signature,
				testSecret
			);

			expect(isValid).toBe(true);
		});
	});
});
