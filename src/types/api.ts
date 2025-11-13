/**
 * API Types
 * Shared TypeScript types for API requests and responses
 */

// ============================================================
// Zapier Webhook Types
// ============================================================

/**
 * Zapier webhook subscription record in database
 */
export interface ZapierWebhookSubscription {
  id: string;
  url: string;
  status: 'active' | 'failing' | 'inactive';
  created_at: string;
  last_tested_at?: string;
  last_error?: string;
  retry_count: number;
}

/**
 * Request body for subscribing to webhooks
 * POST /zapier/hook
 */
export interface ZapierSubscribeRequest {
  url: string;
}

/**
 * Response for webhook subscription
 * POST /zapier/hook
 */
export interface ZapierSubscribeResponse {
  status: 'success' | 'error';
  url: string;
  id: string;
  message?: string;
}

/**
 * Sample event response for webhook testing
 * GET /zapier/hook
 */
export interface ZapierTestResponse {
  event_id: string;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Request body for unsubscribing from webhooks
 * DELETE /zapier/hook
 */
export interface ZapierUnsubscribeRequest {
  url: string;
}

/**
 * Response for webhook unsubscription
 * DELETE /zapier/hook
 */
export interface ZapierUnsubscribeResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * Webhook delivery status for POST /events response
 * Epic 8.3: Event Delivery
 */
export interface WebhookDeliveryStatus {
  subscribed_webhooks: number;
  status: 'queued_for_delivery' | 'no_webhooks' | 'delivery_error';
  estimated_delivery_time?: string;
}
