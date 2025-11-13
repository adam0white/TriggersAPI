const subscribeHook = async (z, bundle) => {
    const response = await z.request({
      method: 'POST',
      url: `${bundle.authData.base_url}/zapier/hook`,
      headers: {
        'Authorization': `Bearer ${bundle.authData.api_key}`,
        'Content-Type': 'application/json',
      },
      body: {
        url: bundle.targetUrl,
      },
    });

    return response.data;
  };

  const unsubscribeHook = async (z, bundle) => {
    const response = await z.request({
      method: 'DELETE',
      url: `${bundle.authData.base_url}/zapier/hook`,
      headers: {
        'Authorization': `Bearer ${bundle.authData.api_key}`,
        'Content-Type': 'application/json',
      },
      body: {
        url: bundle.targetUrl,
      },
    });

    return response.data;
  };

  const getRecentEvents = async (z, bundle) => {
    const response = await z.request({
      method: 'GET',
      url: `${bundle.authData.base_url}/zapier/hook/sample`,
      headers: {
        'Authorization': `Bearer ${bundle.authData.api_key}`,
      },
    });

    return response.data;
  };

  export default {
    key: 'event',
    noun: 'Event',
    display: {
      label: 'Event Received',
      description: 'Triggers when a new event is received by TriggersAPI',
    },
    operation: {
      type: 'hook',
      performSubscribe: subscribeHook,
      performUnsubscribe: unsubscribeHook,
      perform: getRecentEvents,
      performList: getRecentEvents,
      sample: {
        id: 'evt_12345abcde',
        event_id: 'evt_12345abcde',
        event_type: 'test_event',
        timestamp: '2025-11-12T14:30:00.000Z',
        payload: '{"message":"Sample test event from TriggersAPI","source":"zapier","test":true}',
        metadata: '{"correlation_id":"corr_abc123","source_ip":"192.0.2.1","user_agent":"Zapier/1.0"}',
        created_at: '2025-11-12T14:30:00.500Z',
      },
      outputFields: [
        { key: 'id', label: 'Event ID', type: 'string', required: true },
        { key: 'event_id', label: 'Event ID (Alias)', type: 'string' },
        { key: 'event_type', label: 'Event Type', type: 'string' },
        { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
        { key: 'payload', label: 'Payload', type: 'string' },
        { key: 'metadata', label: 'Metadata', type: 'string' },
        { key: 'created_at', label: 'Created At', type: 'datetime' },
      ],
    },
  };