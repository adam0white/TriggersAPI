// Copy this into your Zapier app's index.js file after running: zapier init triggers-api --template=minimal

const subscribeHook = async (z, bundle) => {
  // Subscribe to webhook
  const data = {
    target_url: bundle.targetUrl,
    event_type: 'event.created'
  };

  const options = {
    url: `${process.env.BASE_URL}/zapier/hook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bundle.authData.api_key}`
    },
    body: data
  };

  const response = await z.request(options);
  return response.data;
};

const unsubscribeHook = async (z, bundle) => {
  // Unsubscribe from webhook
  const hookId = bundle.subscribeData.id;

  const options = {
    url: `${process.env.BASE_URL}/zapier/hook`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${bundle.authData.api_key}`
    },
    params: {
      hook_url: bundle.targetUrl
    }
  };

  const response = await z.request(options);
  return response.data;
};

const getTestData = async (z, bundle) => {
  // Get sample data for testing
  const options = {
    url: `${process.env.BASE_URL}/zapier/hook`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bundle.authData.api_key}`
    }
  };

  const response = await z.request(options);
  return [response.data]; // Must return array
};

const performList = async (z, bundle) => {
  // This is called when testing the trigger
  return getTestData(z, bundle);
};

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication: {
    type: 'custom',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        required: true,
        type: 'string',
        helpText: 'Your TriggersAPI Bearer token'
      }
    ],
    test: {
      url: `${process.env.BASE_URL}/inbox`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer {{bundle.authData.api_key}}'
      }
    }
  },

  triggers: {
    event: {
      key: 'event',
      noun: 'Event',
      display: {
        label: 'Event Received',
        description: 'Triggers when a new event is received by TriggersAPI',
        important: true
      },

      operation: {
        type: 'hook',

        performSubscribe: subscribeHook,
        performUnsubscribe: unsubscribeHook,

        perform: performList,
        performList: performList,

        inputFields: [],

        sample: {
          id: 'evt_123',
          event_id: 'user_signup_456',
          event_type: 'user.signup',
          timestamp: '2025-11-12T18:30:00Z',
          payload: {
            user_id: '12345',
            email: 'user@example.com',
            name: 'John Doe'
          },
          metadata: {
            source: 'web_app',
            ip_address: '203.0.113.42'
          },
          created_at: '2025-11-12T18:30:00.123Z'
        },

        outputFields: [
          { key: 'id', label: 'Event ID', type: 'string' },
          { key: 'event_id', label: 'Event Identifier', type: 'string' },
          { key: 'event_type', label: 'Event Type', type: 'string' },
          { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
          { key: 'payload', label: 'Payload', type: 'object' },
          { key: 'metadata', label: 'Metadata', type: 'object' },
          { key: 'created_at', label: 'Created At', type: 'datetime' }
        ]
      }
    }
  }
};
