/**
 * Latency Injection Module
 * Story 6.1: Network Simulation for Performance Testing
 *
 * Simulates various network conditions by injecting latency, jitter, and packet loss
 */

export interface LatencyProfile {
	name: string;
	baseLatency: number; // milliseconds
	jitter: number; // random variance (0-jitter)
	packetLoss: number; // 0-100 percentage
	throttle: 'off' | '3g' | '4g' | 'lte' | 'full';
}

export const PRESET_PROFILES: Record<string, LatencyProfile> = {
	none: {
		name: 'None',
		baseLatency: 0,
		jitter: 0,
		packetLoss: 0,
		throttle: 'full',
	},
	poor: {
		name: 'Poor Network',
		baseLatency: 300,
		jitter: 150,
		packetLoss: 5,
		throttle: '3g',
	},
	mobile3g: {
		name: 'Mobile 3G',
		baseLatency: 200,
		jitter: 100,
		packetLoss: 2,
		throttle: '3g',
	},
	mobile4g: {
		name: 'Mobile 4G',
		baseLatency: 100,
		jitter: 50,
		packetLoss: 1,
		throttle: '4g',
	},
	satellite: {
		name: 'Satellite',
		baseLatency: 500,
		jitter: 200,
		packetLoss: 3,
		throttle: 'lte',
	},
};

export class LatencyInjector {
	private profile: LatencyProfile | null = null;
	private enabled: boolean = false;
	private customProfiles: Map<string, LatencyProfile> = new Map();

	constructor() {
		// Load custom profiles from localStorage
		this.loadCustomProfiles();
	}

	/**
	 * Set the active latency profile
	 */
	setProfile(profile: LatencyProfile): void {
		this.profile = profile;
		this.enabled = true;
	}

	/**
	 * Disable latency injection
	 */
	disable(): void {
		this.enabled = false;
		this.profile = null;
	}

	/**
	 * Check if latency injection is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get current profile
	 */
	getProfile(): LatencyProfile | null {
		return this.profile ? { ...this.profile } : null;
	}

	/**
	 * Apply latency to a fetch operation
	 */
	async applyLatency<T>(operation: () => Promise<T>): Promise<T> {
		if (!this.enabled || !this.profile) {
			return operation();
		}

		// Check packet loss
		if (Math.random() < this.profile.packetLoss / 100) {
			throw new Error('Simulated packet loss');
		}

		// Calculate delay
		const jitterAmount = Math.random() * this.profile.jitter;
		const delay = this.profile.baseLatency + jitterAmount;

		// Add throttle-based delay (approximate bandwidth simulation)
		const throttleDelay = this.getThrottleDelay(this.profile.throttle);
		const totalDelay = delay + throttleDelay;

		// Simulate delay
		await this.sleep(totalDelay);

		// Execute operation
		return operation();
	}

	/**
	 * Get throttle delay based on connection type
	 */
	private getThrottleDelay(throttle: LatencyProfile['throttle']): number {
		const throttleDelays: Record<string, number> = {
			'3g': 100,
			'4g': 50,
			lte: 30,
			full: 0,
			off: 0,
		};
		return throttleDelays[throttle] || 0;
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Save a custom profile
	 */
	saveCustomProfile(id: string, profile: LatencyProfile): void {
		this.customProfiles.set(id, profile);
		this.persistCustomProfiles();
	}

	/**
	 * Delete a custom profile
	 */
	deleteCustomProfile(id: string): void {
		this.customProfiles.delete(id);
		this.persistCustomProfiles();
	}

	/**
	 * Get all custom profiles
	 */
	getCustomProfiles(): Map<string, LatencyProfile> {
		return new Map(this.customProfiles);
	}

	/**
	 * Get a preset or custom profile by ID
	 */
	getProfileById(id: string): LatencyProfile | null {
		// Check presets first
		if (PRESET_PROFILES[id]) {
			return { ...PRESET_PROFILES[id] };
		}

		// Check custom profiles
		const custom = this.customProfiles.get(id);
		return custom ? { ...custom } : null;
	}

	/**
	 * Load custom profiles from localStorage (browser-only)
	 */
	private loadCustomProfiles(): void {
		try {
			if (typeof localStorage === 'undefined') return;
			const stored = localStorage.getItem('latency-custom-profiles');
			if (stored) {
				const profiles = JSON.parse(stored);
				Object.entries(profiles).forEach(([id, profile]) => {
					this.customProfiles.set(id, profile as LatencyProfile);
				});
			}
		} catch (error) {
			console.error('Failed to load custom latency profiles:', error);
		}
	}

	/**
	 * Persist custom profiles to localStorage (browser-only)
	 */
	private persistCustomProfiles(): void {
		try {
			if (typeof localStorage === 'undefined') return;
			const profiles: Record<string, LatencyProfile> = {};
			this.customProfiles.forEach((profile, id) => {
				profiles[id] = profile;
			});
			localStorage.setItem('latency-custom-profiles', JSON.stringify(profiles));
		} catch (error) {
			console.error('Failed to save custom latency profiles:', error);
		}
	}

	/**
	 * Create a fetch wrapper with latency injection (browser-only)
	 */
	createFetchWrapper(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
		if (typeof window === 'undefined' || typeof window.fetch === 'undefined') {
			// In Worker environment, return standard fetch
			return fetch.bind(globalThis);
		}
		const originalFetch = window.fetch.bind(window);

		return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			return this.applyLatency(() => originalFetch(input, init));
		};
	}

	/**
	 * Get latency stats description
	 */
	getProfileDescription(profile: LatencyProfile): string {
		const parts: string[] = [];

		if (profile.baseLatency > 0) {
			parts.push(`${profile.baseLatency}ms base latency`);
		}

		if (profile.jitter > 0) {
			parts.push(`±${profile.jitter}ms jitter`);
		}

		if (profile.packetLoss > 0) {
			parts.push(`${profile.packetLoss}% packet loss`);
		}

		if (profile.throttle !== 'off' && profile.throttle !== 'full') {
			parts.push(`${profile.throttle.toUpperCase()} throttle`);
		}

		return parts.length > 0 ? parts.join(', ') : 'No latency';
	}

	/**
	 * Estimate total delay range
	 */
	estimateDelayRange(profile: LatencyProfile): { min: number; max: number } {
		const throttleDelay = this.getThrottleDelay(profile.throttle);
		const min = profile.baseLatency + throttleDelay;
		const max = profile.baseLatency + profile.jitter + throttleDelay;

		return { min, max };
	}
}

/**
 * Global latency injector instance
 */
export const globalLatencyInjector = new LatencyInjector();
