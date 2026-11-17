export interface SmsDispatchRecord {
  id: string;
  recipient: string;
  deviceId: string;
  deviceName?: string;
  parameter: string;
  value: number;
  threshold: number;
  message: string;
  status: 'DELIVERED' | 'FAILED';
  carrierLatencyMs: number;
  timestamp: Date;
}

class MockSmsService {
  private dispatchHistory: SmsDispatchRecord[] = [];

  async sendAlertSms(params: {
    recipient?: string;
    deviceId: string;
    deviceName?: string;
    parameter: string;
    value: number;
    threshold: number;
    message?: string;
  }): Promise<SmsDispatchRecord> {
    const recipient = params.recipient || '+1 (555) 019-2834 [Operations On-Call]';
    const deviceName = params.deviceName || params.deviceId;
    const body = params.message || 
      `[NEXUSFLOW CRITICAL ALERT] Device ${deviceName} reported ${params.parameter}=${params.value.toFixed(2)}, violating threshold (${params.threshold}). Action required immediately.`;

    const latency = Math.floor(Math.random() * 80) + 20; // 20-100ms simulated carrier delivery

    const record: SmsDispatchRecord = {
      id: `sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recipient,
      deviceId: params.deviceId,
      deviceName,
      parameter: params.parameter,
      value: params.value,
      threshold: params.threshold,
      message: body,
      status: 'DELIVERED',
      carrierLatencyMs: latency,
      timestamp: new Date(),
    };

    this.dispatchHistory.unshift(record);
    if (this.dispatchHistory.length > 200) {
      this.dispatchHistory.pop();
    }

    console.log(`[Mock SMS] 📲 Dispatched to ${recipient} | Latency: ${latency}ms | Message: "${body}"`);
    return record;
  }

  getHistory(): SmsDispatchRecord[] {
    return [...this.dispatchHistory];
  }

  clearHistory(): void {
    this.dispatchHistory = [];
  }
}

export const smsService = new MockSmsService();
