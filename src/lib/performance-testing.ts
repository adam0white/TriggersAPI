/**
 * Performance Testing Module
 * Story 6.1: Performance Testing Module
 *
 * Provides load simulation, metrics capture, and performance benchmarking
 */

export interface LoadTestConfig {
	eventRate: number; // events per second
	duration: number; // seconds
	templateId: string; // from mock templates
	randomizePayloads: boolean;
	authToken: string;
}

export interface LoadTestMetrics {
	startTime: number;
	endTime: number;
	totalEvents: number;
	successCount: number;
	failureCount: number;
	latencies: number[]; // all measured latencies
	errors: Array<{ code: string; count: number; message?: string }>;
	timestamp: number;
	bytesTransferred: number;
}

export interface LoadTestProgress {
	eventsSent: number;
	elapsedTime: number;
	eventsRemaining: number;
	currentRate: number;
	status: 'idle' | 'running' | 'paused' | 'complete' | 'stopped';
}

export interface LoadTestStats {
	throughput: number;
	latencyMin: number;
	latencyMax: number;
	latencyAvg: number;
	latencyP50: number;
	latencyP75: number;
	latencyP90: number;
	latencyP95: number;
	latencyP99: number;
	latencyP999: number;
	errorRate: number;
	successRate: number;
	durationMs: number;
	totalBytes: number;
}

export interface LatencyBucket {
	label: string;
	min: number;
	max: number;
	count: number;
	percentage: number;
}

export class PerformanceTestRunner {
	private config: LoadTestConfig;
	private metrics: LoadTestMetrics;
	private running: boolean = false;
	private paused: boolean = false;
	private eventsSent: number = 0;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private progressCallback: ((progress: LoadTestProgress) => void) | null = null;
	private metricsCallback: ((metrics: LoadTestMetrics) => void) | null = null;

	constructor(config: LoadTestConfig) {
		this.config = config;
		this.metrics = {
			startTime: 0,
			endTime: 0,
			totalEvents: 0,
			successCount: 0,
			failureCount: 0,
			latencies: [],
			errors: [],
			timestamp: Date.now(),
			bytesTransferred: 0,
		};
	}

	/**
	 * Register callback for progress updates
	 */
	onProgress(callback: (progress: LoadTestProgress) => void): void {
		this.progressCallback = callback;
	}

	/**
	 * Register callback for metrics updates
	 */
	onMetrics(callback: (metrics: LoadTestMetrics) => void): void {
		this.metricsCallback = callback;
	}

	/**
	 * Start the load test
	 */
	async start(): Promise<void> {
		this.running = true;
		this.paused = false;
		this.eventsSent = 0;
		this.metrics.startTime = Date.now();
		this.metrics.timestamp = Date.now();

		const expectedTotalEvents = this.config.eventRate * this.config.duration;
		const intervalMs = 1000 / this.config.eventRate;
		const deadline = this.metrics.startTime + this.config.duration * 1000;

		// Emit initial progress
		this.emitProgress();

		// Use setInterval for more consistent event rate
		this.intervalHandle = setInterval(async () => {
			if (!this.running) {
				this.cleanup();
				return;
			}

			if (Date.now() >= deadline) {
				this.stop();
				return;
			}

			if (!this.paused) {
				await this.sendEvent();
				this.eventsSent++;
				this.metrics.totalEvents++;
				this.emitProgress();
				this.emitMetrics();
			}
		}, intervalMs);
	}

	/**
	 * Send a single event
	 */
	private async sendEvent(): Promise<void> {
		const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

		try {
			// Get event from mock data generator (browser-only)
			const event = (typeof window !== 'undefined' && (window as any).mockDataGenerator?.generateEvent(this.config.templateId)) || {
				type: this.config.templateId,
				source: 'performance-test',
				data: { timestamp: new Date().toISOString() },
			};

			// Calculate request size
			const requestBody = JSON.stringify(event);
			const requestSize = new Blob([requestBody]).size;

			const response = await fetch('/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.config.authToken}`,
				},
				body: requestBody,
			});

			const latency = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
			this.metrics.latencies.push(latency);
			this.metrics.bytesTransferred += requestSize;

			if (response.ok) {
				this.metrics.successCount++;
				// Add response size
				const responseText = await response.text();
				this.metrics.bytesTransferred += new Blob([responseText]).size;
			} else {
				this.metrics.failureCount++;
				const status = response.status;
				const statusText = response.statusText;
				this.addError(status.toString(), `HTTP ${status}: ${statusText}`);
			}
		} catch (error) {
			const latency = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
			this.metrics.latencies.push(latency);
			this.metrics.failureCount++;

			const errorCode = error instanceof Error ? error.name : 'unknown';
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.addError(errorCode, errorMessage);
		}
	}

	/**
	 * Add error to metrics
	 */
	private addError(code: string, message?: string): void {
		const errorEntry = this.metrics.errors.find((e) => e.code === code);
		if (errorEntry) {
			errorEntry.count++;
		} else {
			this.metrics.errors.push({ code, count: 1, message });
		}
	}

	/**
	 * Emit progress update
	 */
	private emitProgress(): void {
		if (this.progressCallback) {
			const elapsed = Date.now() - this.metrics.startTime;
			const expectedTotal = this.config.eventRate * this.config.duration;
			const remaining = Math.max(0, expectedTotal - this.eventsSent);
			const currentRate = elapsed > 0 ? this.eventsSent / (elapsed / 1000) : 0;

			this.progressCallback({
				eventsSent: this.eventsSent,
				elapsedTime: elapsed,
				eventsRemaining: remaining,
				currentRate: currentRate,
				status: this.getStatus(),
			});
		}
	}

	/**
	 * Emit metrics update
	 */
	private emitMetrics(): void {
		if (this.metricsCallback) {
			this.metricsCallback({ ...this.metrics });
		}
	}

	/**
	 * Get current status
	 */
	private getStatus(): LoadTestProgress['status'] {
		if (!this.running && this.eventsSent === 0) return 'idle';
		if (!this.running && this.eventsSent > 0) return 'complete';
		if (this.paused) return 'paused';
		return 'running';
	}

	/**
	 * Pause the load test
	 */
	pause(): void {
		this.paused = true;
		this.emitProgress();
	}

	/**
	 * Resume the load test
	 */
	resume(): void {
		this.paused = false;
		this.emitProgress();
	}

	/**
	 * Stop the load test
	 */
	stop(): void {
		this.running = false;
		this.metrics.endTime = Date.now();
		this.cleanup();
		this.emitProgress();
		this.emitMetrics();
	}

	/**
	 * Clean up interval
	 */
	private cleanup(): void {
		if (this.intervalHandle !== null) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): LoadTestMetrics {
		return { ...this.metrics };
	}

	/**
	 * Calculate performance statistics
	 */
	calculateStats(): LoadTestStats {
		const latencies = [...this.metrics.latencies].sort((a, b) => a - b);
		const durationMs = this.metrics.endTime > 0 ? this.metrics.endTime - this.metrics.startTime : Date.now() - this.metrics.startTime;

		const durationSec = durationMs / 1000;
		const throughput = durationSec > 0 ? this.metrics.successCount / durationSec : 0;
		const errorRate = this.metrics.totalEvents > 0 ? (this.metrics.failureCount / this.metrics.totalEvents) * 100 : 0;
		const successRate = this.metrics.totalEvents > 0 ? (this.metrics.successCount / this.metrics.totalEvents) * 100 : 0;

		return {
			throughput,
			latencyMin: latencies.length > 0 ? latencies[0] : 0,
			latencyMax: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
			latencyAvg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
			latencyP50: this.percentile(latencies, 0.5),
			latencyP75: this.percentile(latencies, 0.75),
			latencyP90: this.percentile(latencies, 0.9),
			latencyP95: this.percentile(latencies, 0.95),
			latencyP99: this.percentile(latencies, 0.99),
			latencyP999: this.percentile(latencies, 0.999),
			errorRate,
			successRate,
			durationMs,
			totalBytes: this.metrics.bytesTransferred,
		};
	}

	/**
	 * Calculate latency percentile
	 */
	private percentile(arr: number[], p: number): number {
		if (arr.length === 0) return 0;
		const index = Math.ceil(arr.length * p) - 1;
		return arr[Math.max(0, Math.min(index, arr.length - 1))];
	}

	/**
	 * Get latency distribution buckets
	 */
	getLatencyBuckets(): LatencyBucket[] {
		const buckets: LatencyBucket[] = [
			{ label: '0-10ms', min: 0, max: 10, count: 0, percentage: 0 },
			{ label: '10-50ms', min: 10, max: 50, count: 0, percentage: 0 },
			{ label: '50-100ms', min: 50, max: 100, count: 0, percentage: 0 },
			{ label: '100-500ms', min: 100, max: 500, count: 0, percentage: 0 },
			{ label: '500ms+', min: 500, max: Infinity, count: 0, percentage: 0 },
		];

		this.metrics.latencies.forEach((latency) => {
			for (const bucket of buckets) {
				if (latency >= bucket.min && latency < bucket.max) {
					bucket.count++;
					break;
				}
			}
		});

		const total = this.metrics.latencies.length;
		buckets.forEach((bucket) => {
			bucket.percentage = total > 0 ? (bucket.count / total) * 100 : 0;
		});

		return buckets;
	}

	/**
	 * Assess if performance meets criteria
	 */
	assessPerformance(): {
		pass: boolean;
		criteria: {
			throughput: { target: number; actual: number; pass: boolean };
			latencyP95: { target: number; actual: number; pass: boolean };
			errorRate: { target: number; actual: number; pass: boolean };
		};
		recommendations: string[];
	} {
		const stats = this.calculateStats();
		const recommendations: string[] = [];

		const throughputPass = stats.throughput >= 100;
		const latencyPass = stats.latencyP95 < 100;
		const errorRatePass = stats.errorRate < 1;

		if (!throughputPass) {
			recommendations.push(
				`Throughput below target (${stats.throughput.toFixed(2)} events/sec vs 100 events/sec). Consider optimizing event processing.`,
			);
		}

		if (!latencyPass) {
			recommendations.push(
				`Latency p95 above target (${stats.latencyP95.toFixed(2)}ms vs 100ms). Check network conditions and server performance.`,
			);
		}

		if (!errorRatePass) {
			recommendations.push(`Error rate above target (${stats.errorRate.toFixed(2)}% vs 1%). Review error logs and fix failing requests.`);
		}

		if (throughputPass && latencyPass && errorRatePass) {
			recommendations.push('All performance criteria met! System is performing optimally.');
		}

		return {
			pass: throughputPass && latencyPass && errorRatePass,
			criteria: {
				throughput: { target: 100, actual: stats.throughput, pass: throughputPass },
				latencyP95: { target: 100, actual: stats.latencyP95, pass: latencyPass },
				errorRate: { target: 1, actual: stats.errorRate, pass: errorRatePass },
			},
			recommendations,
		};
	}

	/**
	 * Export results as JSON
	 */
	exportResults(): string {
		const stats = this.calculateStats();
		const assessment = this.assessPerformance();
		const buckets = this.getLatencyBuckets();

		const results = {
			timestamp: this.metrics.timestamp,
			config: this.config,
			metrics: this.metrics,
			stats,
			assessment,
			latencyBuckets: buckets,
		};

		return JSON.stringify(results, null, 2);
	}

	/**
	 * Check if test is running
	 */
	isRunning(): boolean {
		return this.running;
	}

	/**
	 * Check if test is paused
	 */
	isPaused(): boolean {
		return this.paused;
	}
}
