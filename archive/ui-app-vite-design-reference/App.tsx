import React from 'react';
import { RunProvider } from './context/RunContext';
import { ToastProvider } from './context/ToastContext';
import { Dashboard } from './pages/Dashboard';
import { ToastStack } from './components/ToastStack';
import './styles/index.css';

/**
 * Main App Component
 * Story 7.1/7.3/7.6: Mission-Control Pulse Dashboard Root
 *
 * Features:
 * - Loads design tokens via global CSS
 * - Wraps app in RunProvider for state synchronization (Story 7.3)
 * - Wraps app in ToastProvider for global notifications (Story 7.6)
 * - Renders Dashboard with two-column layout
 * - Renders ToastStack for notifications (Story 7.6)
 * - Provides routing placeholder for future multi-page support
 */

function App() {
	return (
		<ToastProvider>
			<RunProvider>
				<div className="app">
					<Dashboard />
					<ToastStack />
				</div>
			</RunProvider>
		</ToastProvider>
	);
}

export default App;
