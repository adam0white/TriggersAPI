/**
 * MetricsScheduler - Automated metrics calculation scheduler
 * Story 4.3: Metrics Calculation
 *
 * Runs metrics calculations every 30 seconds to keep metrics up-to-date
 * for dashboard display and monitoring.
 */

import type { MetricsCalculator } from './metrics-calculator';
import { logger } from './logger';

/**
 * MetricsScheduler class
 * Manages automated periodic execution of metrics calculations
 */
export class MetricsScheduler {
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private isRunning: boolean = false;
	private readonly intervalMs: number = 30000; // 30 seconds

	constructor(
		private calculator: MetricsCalculator,
		private loggerInstance = logger,
	) {}

	/**
	 * Start the metrics calculation scheduler
	 * Runs calculations every 30 seconds
	 */
	start(): void {
		if (this.isRunning) {
			this.loggerInstance.warn('Metrics scheduler already running');
			return;
		}

		this.loggerInstance.info('Starting metrics scheduler', { interval: `${this.intervalMs / 1000}s` });
		this.isRunning = true;

		// Run immediately on startup
		this.runMetrics();

		// Schedule periodic runs
		this.intervalId = setInterval(() => {
			this.runMetrics();
		}, this.intervalMs);
	}

	/**
	 * Stop the metrics calculation scheduler
	 */
	stop(): void {
		if (!this.isRunning) {
			this.loggerInstance.warn('Metrics scheduler not running');
			return;
		}

		this.loggerInstance.info('Stopping metrics scheduler');

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.isRunning = false;
	}

	/**
	 * Run metrics calculation cycle
	 * Catches and logs errors to prevent scheduler from stopping
	 */
	private async runMetrics(): Promise<void> {
		try {
			this.loggerInstance.debug('Metrics calculation cycle starting');
			const startTime = Date.now();

			await this.calculator.runAllMetricsCalculations();

			const duration = Date.now() - startTime;
			this.loggerInstance.info('Metrics calculation cycle completed', { duration_ms: duration });
		} catch (error) {
			this.loggerInstance.error('Metrics calculation cycle failed', {
				error: String(error),
				message: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	/**
	 * Check if scheduler is currently running
	 */
	isSchedulerRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Get current interval in milliseconds
	 */
	getInterval(): number {
		return this.intervalMs;
	}
}
