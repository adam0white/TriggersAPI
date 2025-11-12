/**
 * API Documentation Route - Swagger UI
 *
 * Serves interactive API documentation using Swagger UI.
 * - Loads OpenAPI spec from /openapi.yaml
 * - Provides "Try it out" functionality
 * - Supports Bearer token authentication
 *
 * Routes:
 * - GET /api/docs - Swagger UI interface
 * - GET /openapi.yaml - OpenAPI specification
 */

/**
 * Serve Swagger UI HTML at /api/docs
 * Uses CDN-hosted Swagger UI with OpenAPI spec loaded from /openapi.yaml
 */
export function handleApiDocs(): Response {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="TriggersAPI Documentation - Interactive API reference with examples" />
  <title>TriggersAPI Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .topbar {
      display: none;
    }
    .swagger-ui .info {
      margin: 30px 0;
    }
    .swagger-ui .info .title {
      font-size: 36px;
      margin-bottom: 10px;
    }
    .swagger-ui .scheme-container {
      background: #fafafa;
      padding: 15px 0;
      box-shadow: 0 1px 2px 0 rgba(0,0,0,.15);
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        syntaxHighlight: {
          activate: true,
          theme: "monokai"
        }
      });
    };
  </script>
</body>
</html>`;

	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}

/**
 * Serve OpenAPI specification YAML file
 * Returns the OpenAPI spec as inline content
 */
export function handleOpenApiSpec(): Response {
	// OpenAPI spec embedded as a constant
	// In production, this could be loaded from KV or a CDN
	const openapiSpec = `openapi: 3.0.3
info:
  title: TriggersAPI
  description: |
    Edge-native event ingestion and management API built on Cloudflare Workers.

    TriggersAPI provides a robust, scalable solution for capturing, processing, and managing events with automatic retry logic, dead letter queue handling, and comprehensive observability.

    ## Key Features
    - Event ingestion with metadata support
    - Inbox query with advanced filtering and pagination
    - Event acknowledgment and retry capabilities
    - Debug modes for testing error scenarios
    - Real-time metrics and observability

    ## Authentication
    All API endpoints (except the root dashboard \`/\`) require authentication using Bearer tokens.
    Include your API key in the Authorization header:
    \`\`\`
    Authorization: Bearer sk-test-xxxxx
    \`\`\`

  version: 1.0.0
  contact:
    name: TriggersAPI Support
  license:
    name: MIT

servers:
  - url: https://triggers-api.yourdomain.workers.dev
    description: Production API
  - url: http://localhost:8787
    description: Local Development

tags:
  - name: Events
    description: Event ingestion and submission
  - name: Inbox
    description: Event retrieval and management

security:
  - BearerAuth: []

paths:
  /events:
    post:
      tags:
        - Events
      summary: Submit an event
      description: Submit an event to TriggersAPI for asynchronous processing
      operationId: postEvent
      parameters:
        - name: debug
          in: query
          description: Debug mode for testing error scenarios
          required: false
          schema:
            type: string
            enum:
              - validation_error
              - processing_error
              - dlq_routing
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - payload
              properties:
                payload:
                  type: object
                  description: The event payload
                  additionalProperties: true
                metadata:
                  type: object
                  description: Optional metadata
                  additionalProperties: true
      responses:
        '200':
          description: Event accepted
          content:
            application/json:
              schema:
                type: object
        '400':
          description: Bad Request
        '401':
          description: Unauthorized

  /inbox:
    get:
      tags:
        - Inbox
      summary: Query events
      description: Retrieve events with filtering and pagination
      operationId: getInbox
      parameters:
        - name: status
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Events retrieved
        '401':
          description: Unauthorized

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: Bearer token authentication`;

	return new Response(openapiSpec, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-yaml',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
