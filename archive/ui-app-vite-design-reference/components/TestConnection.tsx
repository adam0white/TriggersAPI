/**
 * Test Connection Component
 * Demonstrates how to use the test auth token to connect to the backend
 */

import { useState } from 'react';
import { submitDefaultRun } from '@/services/runsApi';
import type { RunRequest } from '@/types/runs';

// Test auth token that works with backend development fallback
const TEST_AUTH_TOKEN = 'sk_test_abc123xyz789';

export function TestConnection() {
	const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
	const [message, setMessage] = useState('');
	const [response, setResponse] = useState<any>(null);

	const testConnection = async () => {
		setStatus('testing');
		setMessage('Testing connection to backend API...');
		setResponse(null);

		try {
			const testRequest: RunRequest = {
				auth_token: TEST_AUTH_TOKEN,
				payload: {
					test: true,
					timestamp: new Date().toISOString(),
					message: 'Test event from UI Mission Control',
				},
				debug_flags: {
					trace: true,
				},
			};

			const result = await submitDefaultRun(testRequest);

			setStatus('success');
			setMessage('✅ Connection successful! Backend API is working.');
			setResponse(result);
		} catch (error) {
			setStatus('error');
			setMessage(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			setResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	};

	return (
		<div style={{
			padding: '20px',
			border: '1px solid #ccc',
			borderRadius: '8px',
			margin: '20px',
			backgroundColor: '#f9f9f9'
		}}>
			<h3>API Connection Test</h3>

			<div style={{ marginBottom: '15px' }}>
				<strong>Backend URL:</strong> http://localhost:8787<br />
				<strong>Test Auth Token:</strong> <code>{TEST_AUTH_TOKEN}</code><br />
				<strong>Status:</strong> {status}
			</div>

			<button
				onClick={testConnection}
				disabled={status === 'testing'}
				style={{
					padding: '10px 20px',
					fontSize: '16px',
					backgroundColor: status === 'testing' ? '#ccc' : '#4CAF50',
					color: 'white',
					border: 'none',
					borderRadius: '4px',
					cursor: status === 'testing' ? 'not-allowed' : 'pointer',
				}}
			>
				{status === 'testing' ? 'Testing...' : 'Test Connection'}
			</button>

			{message && (
				<div style={{
					marginTop: '15px',
					padding: '10px',
					backgroundColor: status === 'success' ? '#d4edda' : status === 'error' ? '#f8d7da' : '#fff3cd',
					borderRadius: '4px',
				}}>
					{message}
				</div>
			)}

			{response && (
				<div style={{ marginTop: '15px' }}>
					<strong>Response:</strong>
					<pre style={{
						backgroundColor: '#f1f1f1',
						padding: '10px',
						borderRadius: '4px',
						overflow: 'auto'
					}}>
						{JSON.stringify(response, null, 2)}
					</pre>
				</div>
			)}

			<div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
				<strong>How to use this token in your code:</strong>
				<pre style={{
					backgroundColor: '#f1f1f1',
					padding: '10px',
					borderRadius: '4px',
					overflow: 'auto'
				}}>
{`// Import the API service
import { submitDefaultRun } from '@/services/runsApi';

// Use the test token
const TEST_AUTH_TOKEN = 'sk_test_abc123xyz789';

// Make an API call
const request = {
  auth_token: TEST_AUTH_TOKEN,
  payload: { /* your data */ },
  debug_flags: { trace: true }
};

const result = await submitDefaultRun(request);`}
				</pre>
			</div>
		</div>
	);
}