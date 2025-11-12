/**
 * Unit Tests for EventTimelineCanvas Component
 * Story 7.3: Event Timeline Canvas
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventTimelineCanvas } from '../EventTimelineCanvas';
import { RunProvider } from '@/context/RunContext';

// Mock WebSocket since it's not available in test environment
globalThis.WebSocket = vi.fn() as unknown as typeof WebSocket;

describe('EventTimelineCanvas', () => {
	const renderWithContext = (ui: React.ReactElement) => {
		return render(<RunProvider>{ui}</RunProvider>);
	};

	it('renders all 4 stage cards', () => {
		renderWithContext(<EventTimelineCanvas />);

		expect(screen.getByText('Ingress')).toBeInTheDocument();
		expect(screen.getByText('Queue')).toBeInTheDocument();
		expect(screen.getByText('Processing')).toBeInTheDocument();
		expect(screen.getByText('Inbox')).toBeInTheDocument();
	});

	it('renders with event timeline region role', () => {
		renderWithContext(<EventTimelineCanvas />);

		expect(screen.getByRole('region', { name: /event timeline/i })).toBeInTheDocument();
	});

	it('applies custom className', () => {
		const { container } = renderWithContext(<EventTimelineCanvas className="custom-class" />);

		expect(container.querySelector('.custom-class')).toBeInTheDocument();
	});

	it('renders stage cards in correct order', () => {
		renderWithContext(<EventTimelineCanvas />);

		const stages = ['Ingress', 'Queue', 'Processing', 'Inbox'];
		const stageElements = stages.map((stage) => screen.getByText(stage));

		// Verify stages appear in DOM order
		for (let i = 0; i < stageElements.length - 1; i++) {
			const current = stageElements[i];
			const next = stageElements[i + 1];
			expect(current.compareDocumentPosition(next)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		}
	});

	it('renders ARIA live region for status announcements', () => {
		renderWithContext(<EventTimelineCanvas />);

		const liveRegion = screen.getByRole('status');
		expect(liveRegion).toHaveAttribute('aria-live', 'polite');
		expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
	});
});
