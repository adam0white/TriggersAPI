import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src/ui-app'),
		},
	},
	test: {
		// Exclude Playwright E2E tests and UI component tests from Workers pool
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/tests/**/*.spec.ts', // Playwright tests in tests/ directory
			'**/test/ui-*.test.ts', // UI tests don't need Workers pool
			'**/src/ui-app/**/*.test.tsx', // UI component tests use happy-dom
			'**/src/ui-app/**/*.test.ts', // UI component tests use happy-dom
		],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
				isolatedStorage: false, // Required for Workflows
				singleWorker: true, // Use single shared runtime to avoid queue consumer conflicts
			},
		},
	},
});
