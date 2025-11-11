import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		// Exclude Playwright E2E tests and UI static tests from vitest
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/tests/**/*.spec.ts', // Playwright tests in tests/ directory
			'**/test/ui-*.test.ts', // UI tests don't need Workers pool
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
