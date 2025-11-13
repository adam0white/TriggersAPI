

import packageJson from './package.json' with { type: 'json' };
import zapier from 'zapier-platform-core';
import event from './triggers/event.js';

const testAuthentication = async (z, bundle) => {
    const response = await z.request({
        method: 'GET',
        url: `${bundle.authData.base_url}/health`,
        headers: {
            'Authorization': `Bearer ${bundle.authData.api_key}`,
        },
    });

    if (response.status !== 200) {
        throw new Error('Authentication failed. Please check your API key.');
    }

    return response.data;
};

export default {
    // This is just shorthand to reference the installed dependencies you have.
    // Zapier will need to know these before we can upload.
    version: packageJson.version,
    platformVersion: zapier.version,

    authentication: {
        type: 'custom',
        fields: [
            {
                key: 'api_key',
                label: 'API Key',
                required: true,
                type: 'string',
                helpText: 'Enter your TriggersAPI Bearer token (the same one you use for POST /events)',
            },
            {
                key: 'base_url',
                label: 'Base URL',
                required: true,
                type: 'string',
                default: 'http://localhost:8787',
                helpText: 'Your TriggersAPI base URL (e.g., http://localhost:8787 for local testing)',
            },
        ],
        test: testAuthentication,
        connectionLabel: '{{bundle.authData.base_url}}',
    },

    // If you want your trigger to show up, you better include it here!
    triggers: {
        [event.key]: event,
    },

    // If you want your searches to show up, you better include it here!
    searches: {},

    // If you want your creates to show up, you better include it here!
    creates: {},

    resources: {},
};
