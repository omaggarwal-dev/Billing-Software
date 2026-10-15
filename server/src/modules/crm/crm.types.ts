import { CustomerSegment, CampaignType, CampaignStatus, CommunicationChannel, CommunicationStatus } from "@prisma/client";

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  marketingConsent?: boolean;
  notes?: string | null;
  dietaryNotes?: string | null;
  spicePreference?: string | null;
  seatingPreference?: string | null;
}

export interface CustomerFilterParams {
  query?: string;
  segment?: CustomerSegment;
  hasConsent?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  channel?: CommunicationChannel;
  targetSegment?: CustomerSegment | null;
  messageTemplate: string;
  discountCode?: string | null;
  discountPercent?: number | null;
  cooldownDays?: number;
  scheduledAt?: string | null;
}

export interface RecipientPreview {
  customerId: string;
  customerName: string;
  phone: string;
  segment: CustomerSegment;
  renderedMessage: string;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface SegmentDistribution {
  segment: CustomerSegment;
  count: number;
  percentage: number;
  totalSpend: number;
  avgVisits: number;
}
