/* globals describe, it, expect */

import zapier from 'zapier-platform-core';
import App from '../index.js';

const appTester = zapier.createAppTester(App);

describe('Authentication', () => {
  it('should authenticate with valid API key', async () => {
    const bundle = {
      authData: {
        api_key: process.env.API_KEY || 'test_api_key_12345',
        base_url: process.env.BASE_URL || 'http://localhost:8787',
      },
    };

    const response = await appTester(App.authentication.test, bundle);
    expect(response).toBeDefined();
  });

  it('should fail with invalid API key', async () => {
    const bundle = {
      authData: {
        api_key: 'invalid_key',
        base_url: process.env.BASE_URL || 'http://localhost:8787',
      },
    };

    try {
      await appTester(App.authentication.test, bundle);
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toContain('Authentication failed');
    }
  });
});
