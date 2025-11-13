/**
 * Signature Service
 * Epic 8.4: Security & Validation
 *
 * Provides HMAC-SHA256 signature generation and verification for Zapier webhooks
 * - Generates signatures for outgoing webhook deliveries
 * - Verifies signatures on incoming subscription requests
 * - Uses timing-safe comparison to prevent timing attacks
 */

/**
 * SignatureService
 *
 * HMAC-SHA256 signature generation and verification for webhook security
 */
export class SignatureService {
	/**
	 * Generate HMAC-SHA256 signature for webhook payload
	 *
	 * @param payload - String or object to sign
	 * @param secret - Signing secret
	 * @returns Hex-encoded signature
	 */
	static async generateSignature(
		payload: string | Record<string, unknown>,
		secret: string
	): Promise<string> {
		const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

		// Convert secret and payload to Uint8Array
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const messageData = encoder.encode(payloadString);

		// Import key for HMAC
		const key = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		// Generate signature
		const signature = await crypto.subtle.sign('HMAC', key, messageData);

		// Convert to hex string
		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Verify incoming request signature
	 *
	 * Uses timing-safe comparison to prevent timing attacks
	 *
	 * @param payload - Request body as string
	 * @param signature - Signature to verify (hex-encoded)
	 * @param secret - Signing secret
	 * @returns True if signature is valid
	 */
	static async verifySignature(
		payload: string,
		signature: string,
		secret: string
	): Promise<boolean> {
		try {
			// Compute expected signature
			const expected = await this.generateSignature(payload, secret);

			// Timing-safe comparison
			return this.timingSafeEqual(signature, expected);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Create X-Zapier-Signature header value
	 *
	 * @param payload - Event data to sign
	 * @param secret - Signing secret
	 * @returns Formatted signature header (sha256=...)
	 */
	static async createSignatureHeader(
		payload: Record<string, unknown>,
		secret: string
	): Promise<string> {
		const signature = await this.generateSignature(payload, secret);
		return `sha256=${signature}`;
	}

	/**
	 * Parse X-Zapier-Signature header
	 *
	 * Format: "sha256=..."
	 *
	 * @param header - Signature header value
	 * @returns Parsed algorithm and signature, or null if invalid
	 */
	static parseSignatureHeader(header: string): {
		algorithm: string;
		signature: string;
	} | null {
		const match = header.match(/^(sha256)=([a-f0-9]+)$/);

		if (!match) {
			return null;
		}

		return {
			algorithm: match[1],
			signature: match[2],
		};
	}

	/**
	 * Timing-safe string comparison to prevent timing attacks
	 *
	 * Compares two strings in constant time regardless of content
	 *
	 * @param a - First string
	 * @param b - Second string
	 * @returns True if strings are equal
	 */
	private static timingSafeEqual(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}

		return result === 0;
	}
}
