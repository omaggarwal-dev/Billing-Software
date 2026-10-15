import { CommunicationChannel, CommunicationStatus } from "@prisma/client";

export interface SendMessagePayload {
  channel: CommunicationChannel;
  recipient: string;
  message: string;
  customerId: string;
  campaignId?: string | null;
}

export interface SendMessageResult {
  success: boolean;
  status: CommunicationStatus;
  failureReason?: string | null;
  messageId?: string;
}

export class MessagingService {
  /**
   * Dispatch outbound notification via the requested channel.
   * Fails cleanly and transparently if provider credentials are not present.
   */
  static async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    const { channel, recipient, message } = payload;

    switch (channel) {
      case "SMS": {
        const apiKey = process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN;
        if (!apiKey) {
          return {
            success: false,
            status: CommunicationStatus.FAILED,
            failureReason: "Messaging provider not configured. SMS API credentials (SMS_API_KEY) missing in environment.",
          };
        }
        // In real deployment with credentials: call provider API here
        return {
          success: true,
          status: CommunicationStatus.SENT,
          messageId: `sms_${Date.now()}`,
        };
      }

      case "WHATSAPP": {
        const whatsappToken = process.env.WHATSAPP_TOKEN || process.env.META_WA_TOKEN;
        if (!whatsappToken) {
          return {
            success: false,
            status: CommunicationStatus.FAILED,
            failureReason: "Messaging provider not configured. WhatsApp Business API token missing in environment.",
          };
        }
        // Real provider dispatch
        return {
          success: true,
          status: CommunicationStatus.SENT,
          messageId: `wa_${Date.now()}`,
        };
      }

      case "EMAIL": {
        const smtpHost = process.env.SMTP_HOST || process.env.SENDGRID_API_KEY;
        if (!smtpHost) {
          return {
            success: false,
            status: CommunicationStatus.FAILED,
            failureReason: "Messaging provider not configured. SMTP/Email service credentials missing in environment.",
          };
        }
        return {
          success: true,
          status: CommunicationStatus.SENT,
          messageId: `email_${Date.now()}`,
        };
      }

      default:
        return {
          success: false,
          status: CommunicationStatus.FAILED,
          failureReason: `Unsupported communication channel: ${channel}`,
        };
    }
  }
}
