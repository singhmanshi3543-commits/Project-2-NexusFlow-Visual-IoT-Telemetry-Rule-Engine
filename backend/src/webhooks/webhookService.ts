export interface WebhookDeliveryRecord {
  id: string;
  url: string;
  attempt: number;
  statusCode?: number;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED_SSRF';
  payload: any;
  error?: string;
  latencyMs: number;
  timestamp: Date;
}

export class WebhookService {
  private deliveryHistory: WebhookDeliveryRecord[] = [];

  // Protect against SSRF: check protocols and dangerous cloud metadata / loopback IPs
  private validateUrl(targetUrl: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, reason: 'Invalid protocol: only http and https are allowed' };
      }

      const hostname = parsed.hostname.toLowerCase();
      // Block common cloud metadata IPs
      if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'instance-data') {
        return { valid: false, reason: 'Destination blocked by SSRF security policy (cloud metadata endpoint)' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed URL' };
    }
  }

  async dispatch(params: {
    url: string;
    payload: any;
    headers?: Record<string, string>;
    retries?: number;
    timeoutMs?: number;
  }): Promise<WebhookDeliveryRecord> {
    const { url, payload, headers = {}, retries = 3, timeoutMs = 4000 } = params;

    const validation = this.validateUrl(url);
    if (!validation.valid) {
      const record: WebhookDeliveryRecord = {
        id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        url,
        attempt: 1,
        status: 'REJECTED_SSRF',
        payload,
        error: validation.reason,
        latencyMs: 0,
        timestamp: new Date(),
      };
      this.recordDelivery(record);
      return record;
    }

    let lastError = '';
    let attempt = 0;
    const startTime = Date.now();

    while (attempt < retries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'NexusFlow-Webhook-Engine/1.0',
            ...headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const latencyMs = Date.now() - startTime;
        const record: WebhookDeliveryRecord = {
          id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          url,
          attempt,
          statusCode: response.status,
          status: response.ok ? 'SUCCESS' : 'FAILED',
          payload,
          latencyMs,
          timestamp: new Date(),
        };

        this.recordDelivery(record);
        console.log(`[Webhook] 🌐 Dispatched to ${url} | HTTP ${response.status} | Latency: ${latencyMs}ms`);
        return record;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err.message;
        console.warn(`[Webhook] Attempt ${attempt}/${retries} failed for ${url}: ${lastError}`);
        if (attempt < retries) {
          // Wait briefly before retry
          await new Promise(r => setTimeout(r, 200 * attempt));
        }
      }
    }

    const failureRecord: WebhookDeliveryRecord = {
      id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url,
      attempt,
      status: 'FAILED',
      payload,
      error: lastError,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
    this.recordDelivery(failureRecord);
    return failureRecord;
  }

  private recordDelivery(record: WebhookDeliveryRecord): void {
    this.deliveryHistory.unshift(record);
    if (this.deliveryHistory.length > 200) {
      this.deliveryHistory.pop();
    }
  }

  getHistory(): WebhookDeliveryRecord[] {
    return [...this.deliveryHistory];
  }
}

export const webhookService = new WebhookService();
