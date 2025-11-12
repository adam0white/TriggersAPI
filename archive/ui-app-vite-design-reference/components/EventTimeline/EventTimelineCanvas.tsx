/**
 * EventTimelineCanvas Component - Main timeline visualization
 * Story 7.3: Event Timeline Canvas
 *
 * Features:
 * - 4 stage cards (Ingress, Queue, Processing, Inbox)
 * - Connecting progress bar showing flow
 * - Single-run mode (default) with animated transitions
 * - Batch aggregation mode with progress bars and latency percentiles
 * - Real-time WebSocket updates
 * - Inline log drawer for stage inspection
 * - Full keyboard navigation and accessibility
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useRun } from '@/context/RunContext';
import { StageCard } from './StageCard';
import { StageLogDrawer } from './StageLogDrawer';
import type { EventTimelineCanvasProps, StageName } from '@/types/runs';

/**
 * Stage names in order
 */
const STAGES: StageName[] = ['ingress', 'queue', 'processing', 'inbox'];

/**
 * Batch mode stage card component with progress bars
 */
function BatchStageCard({ stage, batchState }: { stage: StageName; batchState: any }) {
	if (!batchState) return null;

	const stageProgress = batchState.stage_progress[stage];
	const totalEvents = batchState.total_events;
	const completedPercent = totalEvents > 0 ? (stageProgress.completed / totalEvents) * 100 : 0;
	const inProgressPercent = totalEvents > 0 ? (stageProgress.in_progress / totalEvents) * 100 : 0;
	const failedPercent = totalEvents > 0 ? (stageProgress.failed / totalEvents) * 100 : 0;

	// Get latency percentiles (processing doesn't have p99 in response, only ingress/queue)
	const latencies = stage === 'inbox' ? null : batchState.stage_latencies[`${stage}_ms`];

	/**
	 * Get stage display name
	 */
	const getStageName = (stageName: StageName): string => {
		const names: Record<StageName, string> = {
			ingress: 'Ingress',
			queue: 'Queue',
			processing: 'Processing',
			inbox: 'Inbox',
		};
		return names[stageName];
	};

	return (
		<div className="bg-surface-elevated border border-neutral-500/20 rounded-lg p-lg shadow-card-base">
			<div className="flex items-center justify-between mb-sm">
				<h3 className="text-h3 text-neutral-100 font-medium">{getStageName(stage)}</h3>
				<span className="text-xs text-neutral-400">
					{stageProgress.completed + stageProgress.in_progress + stageProgress.failed}/{totalEvents}
				</span>
			</div>

			{/* Progress bar */}
			<div className="h-2 bg-surface-base rounded-full overflow-hidden mb-sm">
				<div className="h-full flex">
					{completedPercent > 0 && (
						<div
							className="bg-accent-1 transition-all duration-300"
							style={{ width: `${completedPercent}%` }}
							aria-label={`${stageProgress.completed} events completed`}
						/>
					)}
					{inProgressPercent > 0 && (
						<div
							className="bg-primary transition-all duration-300"
							style={{ width: `${inProgressPercent}%` }}
							aria-label={`${stageProgress.in_progress} events in progress`}
						/>
					)}
					{failedPercent > 0 && (
						<div
							className="bg-alert-error transition-all duration-300"
							style={{ width: `${failedPercent}%` }}
							aria-label={`${stageProgress.failed} events failed`}
						/>
					)}
				</div>
			</div>

			{/* Throughput counter */}
			<div className="flex items-center gap-md text-xs">
				<div className="flex items-center gap-xs">
					<div className="w-2 h-2 rounded-full bg-accent-1" />
					<span className="text-neutral-100">{stageProgress.completed} done</span>
				</div>
				{stageProgress.in_progress > 0 && (
					<div className="flex items-center gap-xs">
						<div className="w-2 h-2 rounded-full bg-primary" />
						<span className="text-neutral-100">{stageProgress.in_progress} active</span>
					</div>
				)}
				{stageProgress.failed > 0 && (
					<div className="flex items-center gap-xs">
						<div className="w-2 h-2 rounded-full bg-alert-error" />
						<span className="text-alert-error">{stageProgress.failed} failed</span>
					</div>
				)}
			</div>

			{/* Latency percentiles */}
			{latencies && (
				<div className="mt-sm pt-sm border-t border-neutral-500/20">
					<p className="text-xs text-neutral-400 mb-xs">Latency Percentiles</p>
					<div className="flex items-center gap-md text-xs">
						<div>
							<span className="text-neutral-400">p50:</span>{' '}
							<span className="text-neutral-100 font-medium">{latencies.p50}ms</span>
						</div>
						<div>
							<span className="text-neutral-400">p95:</span>{' '}
							<span className="text-neutral-100 font-medium">{latencies.p95}ms</span>
						</div>
						<div>
							<span className="text-neutral-400">p99:</span>{' '}
							<span className="text-neutral-100 font-medium">{latencies.p99}ms</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * EventTimelineCanvas Component
 */
export function EventTimelineCanvas({ className }: EventTimelineCanvasProps) {
	const { runState, batchState, isBatchMode, isConnected, connectionError } = useRun();
	const [activeLogDrawer, setActiveLogDrawer] = useState<StageName | null>(null);
	const stageRefs = useRef<Record<StageName, HTMLDivElement | null>>({
		ingress: null,
		queue: null,
		processing: null,
		inbox: null,
	});

	/**
	 * Handle keyboard navigation between stages
	 */
	const handleKeyDown = useCallback((e: React.KeyboardEvent, currentStage: StageName) => {
		const currentIndex = STAGES.indexOf(currentStage);

		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			e.preventDefault();
			const nextIndex = (currentIndex + 1) % STAGES.length;
			const nextStage = STAGES[nextIndex];
			stageRefs.current[nextStage]?.focus();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const prevIndex = (currentIndex - 1 + STAGES.length) % STAGES.length;
			const prevStage = STAGES[prevIndex];
			stageRefs.current[prevStage]?.focus();
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			setActiveLogDrawer(currentStage);
		}
	}, []);

	/**
	 * Get progress connector fill percentage
	 */
	const getProgressFill = (): number => {
		if (!runState.current_stage) return 0;

		const currentIndex = STAGES.indexOf(runState.current_stage);
		if (currentIndex === -1) return 0;

		// Calculate percentage based on completed stages
		// Each stage transition = 25% (4 stages total)
		return ((currentIndex + 1) / STAGES.length) * 100;
	};

	/**
	 * Get whether a stage is interactive (can view logs)
	 */
	const isStageInteractive = (stage: StageName): boolean => {
		const stageState = runState.stages[stage];
		// Stage is interactive if it has completed, is active, or has an error
		return stageState.status === 'success' || stageState.status === 'active' || stageState.status === 'error';
	};

	return (
		<div className={cn('space-y-lg', className)} role="region" aria-label="Event Timeline">
			{/* Batch mode badge */}
			{isBatchMode && batchState && (
				<div className="flex items-center justify-between p-sm bg-primary/10 border border-primary/30 rounded-lg">
					<div className="flex items-center gap-sm">
						<span className="px-2 py-0.5 bg-primary text-neutral-100 rounded text-xs font-bold">BATCH</span>
						<span className="text-sm text-neutral-100">
							{batchState.total_events} events
						</span>
					</div>
					<span className="text-xs text-neutral-400">
						{batchState.events_completed} completed · {batchState.events_failed} failed
					</span>
				</div>
			)}

			{/* Connection status indicator */}
			{!isConnected && connectionError && (
				<div
					className="p-sm bg-alert-warning/10 border border-alert-warning/30 rounded-lg text-xs text-neutral-100"
					role="alert"
				>
					⚠️ Updates paused: {connectionError}
				</div>
			)}

			{/* ARIA live region for status announcements */}
			<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{runState.current_stage && `Event is now in ${runState.current_stage} stage`}
			</div>

			{/* Batch mode: show batch aggregation cards */}
			{isBatchMode && batchState ? (
				<div className="space-y-lg">
					{STAGES.map((stage) => (
						<BatchStageCard key={stage} stage={stage} batchState={batchState} />
					))}
				</div>
			) : (
				/* Single-run mode: show stage cards with connecting progress bar */
				<div className="relative space-y-lg">
					{STAGES.map((stage, index) => {
						const stageState = runState.stages[stage];
						const isActive = runState.current_stage === stage;
						const isInteractive = isStageInteractive(stage);

						return (
							<div key={stage} className="relative">
								{/* Connecting line between stages (vertical) */}
								{index < STAGES.length - 1 && (
									<div className="absolute left-6 top-full w-0.5 h-lg z-0">
										<div className="w-full h-full bg-neutral-500/20">
											{/* Progress indicator on connector */}
											<div
												className="w-full bg-primary transition-all duration-500"
												style={{
													height: getProgressFill() > (index + 1) * 25 ? '100%' : '0%',
												}}
											/>
										</div>
									</div>
								)}

								{/* Stage card */}
								<div
									ref={(el) => {
										stageRefs.current[stage] = el;
									}}
									tabIndex={isInteractive ? 0 : -1}
									onKeyDown={(e) => handleKeyDown(e, stage)}
									className="relative z-10 group"
								>
									<StageCard
										stage={stage}
										stageState={stageState}
										isActive={isActive}
										isInteractive={isInteractive}
										onViewLogs={() => setActiveLogDrawer(stage)}
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Stage log drawer */}
			<StageLogDrawer
				isOpen={activeLogDrawer !== null}
				onClose={() => setActiveLogDrawer(null)}
				stage={activeLogDrawer || 'ingress'}
				runId={runState.run_id}
				error={activeLogDrawer ? runState.stages[activeLogDrawer]?.error : undefined}
				retryEligible={false} // TODO: Implement retry logic
				onRetry={() => {
					// TODO: Implement retry logic
				}}
			/>
		</div>
	);
}
