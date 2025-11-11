/**
 * Dashboard Route Handler
 *
 * Serves the HTML/CSS/JavaScript dashboard UI at GET /
 * No authentication required - public demo interface
 */

// Dashboard HTML - inline for single deployment artifact
// This approach ensures the HTML is bundled with the Worker deployment
const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TriggersAPI - Event Ingestion Dashboard</title>
  <style>
    /* Inline CSS for fast load time */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 800px;
      width: 100%;
      padding: 40px;
    }

    header {
      margin-bottom: 40px;
      text-align: center;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 20px;
    }

    h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 10px;
    }

    .status {
      display: inline-block;
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }

    .status.loading {
      background: #f59e0b;
    }

    .status.error {
      background: #ef4444;
    }

    .form-group {
      margin-bottom: 24px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
      font-size: 14px;
    }

    input[type="text"],
    textarea,
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    input[type="text"]:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    textarea {
      resize: vertical;
      min-height: 150px;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    button {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-submit {
      background: #667eea;
      color: white;
    }

    .btn-submit:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-submit:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
      transform: none;
    }

    .btn-clear {
      background: #f0f0f0;
      color: #333;
    }

    .btn-clear:hover {
      background: #e5e5e5;
    }

    .response-section {
      margin-top: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      display: none;
    }

    .response-section.visible {
      display: block;
    }

    .response-section.success {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .response-section.error {
      background: #fef2f2;
      border-color: #fecaca;
    }

    .response-title {
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .response-section.success .response-title {
      color: #15803d;
    }

    .response-section.error .response-title {
      color: #b91c1c;
    }

    .response-content {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      overflow-x: auto;
      background: white;
      padding: 12px;
      border-radius: 4px;
      color: #333;
      line-height: 1.5;
    }

    .response-section.error .response-content {
      color: #7f1d1d;
    }

    .hint {
      font-size: 12px;
      color: #666;
      margin-top: 6px;
    }

    @media (max-width: 640px) {
      .container {
        padding: 20px;
      }

      h1 {
        font-size: 22px;
      }

      .button-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>TriggersAPI</h1>
      <p style="color: #666; margin-bottom: 16px; font-size: 14px;">
        Real-time Event Ingestion at the Edge
      </p>
      <div class="status" id="status">System Live</div>
    </header>

    <form id="eventForm">
      <!-- Bearer Token Input -->
      <div class="form-group">
        <label for="bearerToken">Authorization Token</label>
        <input
          type="text"
          id="bearerToken"
          name="bearerToken"
          placeholder="sk_test_abc123xyz789"
          value="sk_test_abc123xyz789"
        />
        <div class="hint">Your Bearer token (required for API calls)</div>
      </div>

      <!-- Payload Input -->
      <div class="form-group">
        <label for="payload">Event Payload (JSON)*</label>
        <textarea
          id="payload"
          name="payload"
          placeholder='{"user_id": "12345", "action": "created", "timestamp": "2025-11-10T12:00:00Z"}'
          required
        >{
  "user_id": "12345",
  "action": "account_created",
  "email": "user@example.com"
}</textarea>
        <div class="hint">The actual event data (must be valid JSON)</div>
      </div>

      <!-- Metadata Input -->
      <div class="form-group">
        <label for="metadata">Event Metadata (JSON)</label>
        <textarea
          id="metadata"
          name="metadata"
          placeholder='{"event_type": "user.created", "source": "auth-service"}'
        >{
  "event_type": "user.created",
  "source": "auth-service"
}</textarea>
        <div class="hint">Additional metadata about the event (optional)</div>
      </div>

      <!-- Debug Flag -->
      <div class="form-group">
        <label for="debugFlag">Debug Flag (optional)</label>
        <select id="debugFlag" name="debugFlag">
          <option value="">None</option>
          <option value="validation_error">validation_error</option>
          <option value="processing_error">processing_error</option>
          <option value="queue_delay">queue_delay</option>
          <option value="dlq_routing">dlq_routing</option>
        </select>
        <div class="hint">For testing error pathways (see docs)</div>
      </div>

      <!-- Buttons -->
      <div class="button-group">
        <button type="submit" class="btn-submit" id="submitBtn">Submit Event</button>
        <button type="reset" class="btn-clear">Clear Form</button>
      </div>
    </form>

    <!-- Response Display -->
    <div class="response-section" id="response">
      <div class="response-title" id="responseTitle">Response</div>
      <div class="response-content" id="responseContent"></div>
    </div>
  </div>

  <script>
    // Client-side form handling
    const form = document.getElementById('eventForm');
    const submitBtn = document.getElementById('submitBtn');
    const response = document.getElementById('response');
    const responseTitle = document.getElementById('responseTitle');
    const responseContent = document.getElementById('responseContent');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form values
      const bearerToken = document.getElementById('bearerToken').value;
      const payload = document.getElementById('payload').value;
      const metadata = document.getElementById('metadata').value;
      const debugFlag = document.getElementById('debugFlag').value;

      // Validate inputs
      if (!bearerToken.trim()) {
        showError('Authorization token is required');
        return;
      }

      let payloadObj, metadataObj;

      try {
        payloadObj = JSON.parse(payload);
      } catch (e) {
        showError('Payload must be valid JSON: ' + e.message);
        return;
      }

      if (metadata.trim()) {
        try {
          metadataObj = JSON.parse(metadata);
        } catch (e) {
          showError('Metadata must be valid JSON: ' + e.message);
          return;
        }
      }

      // Prepare request
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      response.classList.remove('visible', 'success', 'error');

      try {
        // Build URL with debug flag if present
        let url = '/events';
        if (debugFlag) {
          url += '?debug=' + encodeURIComponent(debugFlag);
        }

        // Send request
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + bearerToken,
          },
          body: JSON.stringify({
            payload: payloadObj,
            ...(metadataObj && { metadata: metadataObj }),
          }),
        });

        const data = await res.json();

        if (res.ok) {
          showSuccess(data);
        } else {
          showError(data.error?.message || 'Unknown error', data.error?.code);
        }
      } catch (error) {
        showError('Failed to send request: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Event';
      }
    });

    function showSuccess(data) {
      response.classList.add('visible', 'success');
      response.classList.remove('error');
      responseTitle.textContent = 'Success';
      responseContent.textContent = JSON.stringify(data, null, 2);
    }

    function showError(message, code) {
      response.classList.add('visible', 'error');
      response.classList.remove('success');
      responseTitle.textContent = 'Error: ' + (code || 'Unknown');
      responseContent.textContent = message;
    }
  </script>
</body>
</html>
`;

/**
 * Handle dashboard requests
 * Returns HTML/CSS/JavaScript dashboard UI
 */
export async function handleDashboard(request: Request): Promise<Response> {
	return new Response(dashboardHTML, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		},
	});
}
