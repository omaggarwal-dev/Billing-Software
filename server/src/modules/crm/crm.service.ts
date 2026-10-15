import { CustomerSegment, CampaignType, CampaignStatus, CommunicationChannel, CommunicationStatus, Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { MessagingService } from "./messaging.service.js";
import type {
  CreateCustomerInput,
  CustomerFilterParams,
  CreateCampaignInput,
  RecipientPreview,
  SegmentDistribution,
} from "./crm.types.js";

export class CRMService {
  /**
   * Search / list customers with filters and pagination
   */
  static async searchCustomers(franchiseId: string | null, params: CustomerFilterParams) {
    const { query, segment, hasConsent, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (franchiseId) {
      where.OR = [
        { franchiseId },
        { franchiseId: null },
      ];
    }

    if (segment) {
      where.segment = segment;
    }

    if (hasConsent !== undefined) {
      where.marketingConsent = hasConsent;
    }

    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: {
          preference: true,
          franchise: { select: { id: true, name: true, code: true } },
          _count: { select: { visits: true, orders: true } },
        },
        orderBy: { lastVisitAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fast POS customer lookup by phone
   */
  static async lookupCustomerByPhone(phone: string) {
    if (!phone || phone.trim().length < 3) {
      return null;
    }
    const cleanPhone = phone.trim();

    // Try exact match first
    let customer = await prisma.customer.findFirst({
      where: {
        phone: { equals: cleanPhone },
      },
      include: {
        preference: true,
        visits: {
          take: 3,
          orderBy: { visitDate: "desc" },
        },
      },
    });

    // If not found, try endsWith/contains match for partial phone
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: {
          phone: { contains: cleanPhone },
        },
        include: {
          preference: true,
          visits: {
            take: 3,
            orderBy: { visitDate: "desc" },
          },
        },
      });
    }

    return customer;
  }

  /**
   * Get customer details by ID
   */
  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        preference: true,
        franchise: { select: { id: true, name: true, code: true } },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 10,
          include: { franchise: { select: { name: true } } },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            items: { include: { menuItem: { select: { name: true } } } },
            invoice: { select: { invoiceNumber: true, total: true, isPaid: true } },
          },
        },
        communicationLogs: {
          orderBy: { createdAt: "desc" },
          take: 15,
          include: { campaign: { select: { name: true, type: true } } },
        },
      },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    return customer;
  }

  /**
   * Create new customer (with optional preferences)
   */
  static async createCustomer(data: CreateCustomerInput, franchiseId?: string | null) {
    const cleanPhone = data.phone.trim();
    if (!cleanPhone) {
      throw new AppError("Customer phone number is required", 400);
    }

    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
    });
    if (existing) {
      throw new AppError("A customer with this phone number already exists", 400);
    }

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          franchiseId: franchiseId || null,
          name: data.name.trim(),
          phone: cleanPhone,
          email: data.email?.trim() || null,
          birthday: data.birthday ? new Date(data.birthday) : null,
          anniversary: data.anniversary ? new Date(data.anniversary) : null,
          marketingConsent: data.marketingConsent !== false,
          segment: CustomerSegment.NEW,
          notes: data.notes?.trim() || null,
        },
      });

      if (data.dietaryNotes || data.spicePreference || data.seatingPreference) {
        await tx.customerPreference.create({
          data: {
            customerId: customer.id,
            dietaryNotes: data.dietaryNotes?.trim() || null,
            spicePreference: data.spicePreference?.trim() || null,
            seatingPreference: data.seatingPreference?.trim() || null,
          },
        });
      }

      return tx.customer.findUnique({
        where: { id: customer.id },
        include: { preference: true },
      });
    });
  }

  /**
   * Update customer profile and preferences
   */
  static async updateCustomer(id: string, data: Partial<CreateCustomerInput>) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    let optOutAt = customer.optOutAt;
    if (data.marketingConsent === false && customer.marketingConsent !== false) {
      optOutAt = new Date();
    } else if (data.marketingConsent === true) {
      optOutAt = null;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          phone: data.phone !== undefined ? data.phone.trim() : undefined,
          email: data.email !== undefined ? data.email?.trim() || null : undefined,
          birthday: data.birthday !== undefined ? (data.birthday ? new Date(data.birthday) : null) : undefined,
          anniversary: data.anniversary !== undefined ? (data.anniversary ? new Date(data.anniversary) : null) : undefined,
          marketingConsent: data.marketingConsent !== undefined ? data.marketingConsent : undefined,
          optOutAt,
          notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
        },
      });

      if (data.dietaryNotes !== undefined || data.spicePreference !== undefined || data.seatingPreference !== undefined) {
        await tx.customerPreference.upsert({
          where: { customerId: id },
          create: {
            customerId: id,
            dietaryNotes: data.dietaryNotes?.trim() || null,
            spicePreference: data.spicePreference?.trim() || null,
            seatingPreference: data.seatingPreference?.trim() || null,
          },
          update: {
            dietaryNotes: data.dietaryNotes !== undefined ? data.dietaryNotes?.trim() || null : undefined,
            spicePreference: data.spicePreference !== undefined ? data.spicePreference?.trim() || null : undefined,
            seatingPreference: data.seatingPreference !== undefined ? data.seatingPreference?.trim() || null : undefined,
          },
        });
      }

      return tx.customer.findUnique({
        where: { id },
        include: { preference: true },
      });
    });
  }

  /**
   * Hook called when an order is settled/paid
   * Records visit, updates spend, recalculates RFM segmentation and top preferences
   */
  static async recordCustomerTransaction(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        customer: true,
      },
    });

    if (!order || !order.customerId) {
      return null;
    }

    const customerId = order.customerId;
    const now = new Date();

    // 1. Create or ensure CustomerVisit
    const existingVisit = await prisma.customerVisit.findUnique({
      where: { orderId: order.id },
    });

    if (!existingVisit) {
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      await prisma.customerVisit.create({
        data: {
          customerId,
          franchiseId: order.franchiseId,
          orderId: order.id,
          tableSessionId: order.tableSessionId,
          spend: order.total,
          itemsCount,
          visitDate: now,
        },
      });
    }

    // 2. Compute total visits & spend
    const allVisits = await prisma.customerVisit.findMany({
      where: { customerId },
    });
    const totalVisits = allVisits.length;
    const totalSpend = allVisits.reduce((acc, v) => acc + Number(v.spend), 0);
    const averageOrderValue = totalVisits > 0 ? totalSpend / totalVisits : 0;

    // 3. Analyze item & category preference
    const allCustomerOrders = await prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { menuItem: true } } },
    });

    const itemFrequency = new Map<string, { name: string; categoryId: string; count: number }>();
    for (const ord of allCustomerOrders) {
      for (const item of ord.items) {
        const entry = itemFrequency.get(item.menuItemId) || {
          name: item.menuItem.name,
          categoryId: item.menuItem.categoryId,
          count: 0,
        };
        entry.count += item.quantity;
        itemFrequency.set(item.menuItemId, entry);
      }
    }

    let topItemId: string | null = null;
    let topItemName: string | null = null;
    let topCategoryId: string | null = null;
    let maxQuantity = 0;

    for (const [mId, meta] of itemFrequency.entries()) {
      if (meta.count > maxQuantity) {
        maxQuantity = meta.count;
        topItemId = mId;
        topItemName = meta.name;
        topCategoryId = meta.categoryId;
      }
    }

    if (topItemId && topItemName) {
      await prisma.customerPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          favoriteMenuItemId: topItemId,
          favoriteItemName: topItemName,
          favoriteCategoryId: topCategoryId,
        },
        update: {
          favoriteMenuItemId: topItemId,
          favoriteItemName: topItemName,
          favoriteCategoryId: topCategoryId,
        },
      });
    }

    // 4. Calculate RFM Segment
    let segment: CustomerSegment = CustomerSegment.NEW;
    if (totalSpend >= 20000) {
      segment = CustomerSegment.HIGH_VALUE;
    } else if (totalVisits >= 10 || totalSpend >= 10000) {
      segment = CustomerSegment.VIP;
    } else if (totalVisits >= 5 || totalSpend >= 4000) {
      segment = CustomerSegment.LOYAL;
    } else if (totalVisits >= 2) {
      segment = CustomerSegment.REGULAR;
    } else {
      segment = CustomerSegment.NEW;
    }

    // 5. Update Customer record
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalVisits,
        totalSpend: new Prisma.Decimal(totalSpend.toFixed(2)),
        averageOrderValue: new Prisma.Decimal(averageOrderValue.toFixed(2)),
        lastVisitAt: now,
        firstVisitAt: order.customer?.firstVisitAt || now,
        segment,
      },
      include: { preference: true },
    });

    return updatedCustomer;
  }

  /**
   * Recalculate RFM Segments across all customers
   * Detects AT_RISK (>30 days since last visit) and INACTIVE (>60 days since last visit)
   */
  static async recalculateSegments(franchiseId?: string | null) {
    const where: Prisma.CustomerWhereInput = franchiseId ? { franchiseId } : {};
    const customers = await prisma.customer.findMany({ where });

    const now = Date.now();
    let updatedCount = 0;

    for (const c of customers) {
      let targetSegment = c.segment;
      const visits = c.totalVisits;
      const spend = Number(c.totalSpend);

      if (c.lastVisitAt) {
        const daysSinceLastVisit = (now - c.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastVisit >= 60) {
          targetSegment = CustomerSegment.INACTIVE;
        } else if (daysSinceLastVisit >= 30 && visits >= 2) {
          targetSegment = CustomerSegment.AT_RISK;
        } else {
          // Normal active segmentation
          if (spend >= 20000) {
            targetSegment = CustomerSegment.HIGH_VALUE;
          } else if (visits >= 10 || spend >= 10000) {
            targetSegment = CustomerSegment.VIP;
          } else if (visits >= 5 || spend >= 4000) {
            targetSegment = CustomerSegment.LOYAL;
          } else if (visits >= 2) {
            targetSegment = CustomerSegment.REGULAR;
          } else {
            targetSegment = CustomerSegment.NEW;
          }
        }
      } else {
        targetSegment = CustomerSegment.NEW;
      }

      if (targetSegment !== c.segment) {
        await prisma.customer.update({
          where: { id: c.id },
          data: { segment: targetSegment },
        });
        updatedCount++;
      }
    }

    return { totalEvaluated: customers.length, updatedCount };
  }

  /**
   * Get CRM Segment Analytics distribution
   */
  static async getSegmentAnalytics(franchiseId?: string | null) {
    const where: Prisma.CustomerWhereInput = franchiseId ? { franchiseId } : {};
    const [totalCustomers, optedInCount, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { ...where, marketingConsent: true } }),
      prisma.customer.findMany({
        where,
        select: {
          segment: true,
          totalSpend: true,
          totalVisits: true,
        },
      }),
    ]);

    const segmentStats: Record<string, { count: number; spend: number; visits: number }> = {};
    for (const seg of Object.values(CustomerSegment)) {
      segmentStats[seg] = { count: 0, spend: 0, visits: 0 };
    }

    for (const c of customers) {
      if (segmentStats[c.segment]) {
        segmentStats[c.segment].count += 1;
        segmentStats[c.segment].spend += Number(c.totalSpend);
        segmentStats[c.segment].visits += c.totalVisits;
      }
    }

    const distribution: SegmentDistribution[] = Object.entries(segmentStats).map(
      ([seg, data]) => ({
        segment: seg as CustomerSegment,
        count: data.count,
        percentage: totalCustomers > 0 ? Number(((data.count / totalCustomers) * 100).toFixed(1)) : 0,
        totalSpend: Number(data.spend.toFixed(2)),
        avgVisits: data.count > 0 ? Number((data.visits / data.count).toFixed(1)) : 0,
      })
    );

    const totalRevenue = customers.reduce((sum, c) => sum + Number(c.totalSpend), 0);
    const avgLifetimeSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    return {
      totalCustomers,
      optedInCount,
      optInRate: totalCustomers > 0 ? Number(((optedInCount / totalCustomers) * 100).toFixed(1)) : 0,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgLifetimeSpend: Number(avgLifetimeSpend.toFixed(2)),
      distribution,
    };
  }

  /**
   * Preview eligible recipients for a campaign with template variable interpolation
   */
  static async previewCampaignRecipients(
    campaignData: {
      targetSegment?: CustomerSegment | null;
      cooldownDays?: number;
      messageTemplate: string;
      discountCode?: string | null;
      discountPercent?: number | null;
    },
    franchiseId?: string | null
  ): Promise<{ eligible: RecipientPreview[]; ineligiblesCount: number; totalMatched: number }> {
    const {
      targetSegment,
      cooldownDays = 7,
      messageTemplate,
      discountCode,
      discountPercent,
    } = campaignData;

    const where: Prisma.CustomerWhereInput = {};
    if (franchiseId) {
      where.OR = [{ franchiseId }, { franchiseId: null }];
    }
    if (targetSegment) {
      where.segment = targetSegment;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        preference: true,
        communicationLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const now = Date.now();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

    const eligible: RecipientPreview[] = [];
    let ineligiblesCount = 0;

    for (const c of customers) {
      let isEligible = true;
      let reason: string | undefined;

      // 1. Consent check
      if (!c.marketingConsent) {
        isEligible = false;
        reason = "Opted out of marketing";
      }

      // 2. Cooldown check
      if (isEligible && c.communicationLogs.length > 0) {
        const lastSentTime = c.communicationLogs[0].createdAt.getTime();
        if (now - lastSentTime < cooldownMs) {
          isEligible = false;
          const daysLeft = Math.ceil((cooldownMs - (now - lastSentTime)) / (24 * 60 * 60 * 1000));
          reason = `In cooldown (${daysLeft} days remaining)`;
        }
      }

      // 3. Render template
      const favDish = c.preference?.favoriteItemName || "your favorite dishes";
      const renderedMessage = messageTemplate
        .replace(/\{\{customerName\}\}/g, c.name)
        .replace(/\{\{favoriteItem\}\}/g, favDish)
        .replace(/\{\{discountCode\}\}/g, discountCode || "SPECIAL")
        .replace(/\{\{discountPercent\}\}/g, discountPercent ? `${discountPercent}%` : "10%")
        .replace(/\{\{brandName\}\}/g, "RestoMaster");

      if (isEligible) {
        eligible.push({
          customerId: c.id,
          customerName: c.name,
          phone: c.phone,
          segment: c.segment,
          renderedMessage,
          isEligible: true,
        });
      } else {
        ineligiblesCount++;
      }
    }

    return {
      eligible,
      ineligiblesCount,
      totalMatched: customers.length,
    };
  }

  /**
   * List campaigns
   */
  static async listCampaigns(franchiseId?: string | null) {
    const where: Prisma.CampaignWhereInput = franchiseId ? { OR: [{ franchiseId }, { franchiseId: null }] } : {};
    return prisma.campaign.findMany({
      where,
      include: {
        rules: true,
        _count: { select: { communicationLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create campaign
   */
  static async createCampaign(data: CreateCampaignInput, franchiseId?: string | null) {
    return prisma.campaign.create({
      data: {
        franchiseId: franchiseId || null,
        name: data.name.trim(),
        type: data.type,
        status: CampaignStatus.DRAFT,
        channel: data.channel || CommunicationChannel.SMS,
        targetSegment: data.targetSegment || null,
        messageTemplate: data.messageTemplate,
        discountCode: data.discountCode?.trim() || null,
        discountPercent:
          data.discountPercent !== undefined && data.discountPercent !== null
            ? new Prisma.Decimal(data.discountPercent)
            : null,
        cooldownDays: data.cooldownDays ?? 7,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
  }

  /**
   * Execute campaign with transparent provider logging and cooldown enforcement
   */
  static async executeCampaign(campaignId: string, franchiseId?: string | null) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError("Campaign not found", 404);
    }

    // Evaluate eligible recipients
    const preview = await this.previewCampaignRecipients(
      {
        targetSegment: campaign.targetSegment,
        cooldownDays: campaign.cooldownDays,
        messageTemplate: campaign.messageTemplate,
        discountCode: campaign.discountCode,
        discountPercent: campaign.discountPercent ? Number(campaign.discountPercent) : null,
      },
      franchiseId || campaign.franchiseId
    );

    let deliveredCount = 0;
    let failedCount = 0;

    for (const recipient of preview.eligible) {
      const sendResult = await MessagingService.sendMessage({
        channel: campaign.channel,
        recipient: recipient.phone,
        message: recipient.renderedMessage,
        customerId: recipient.customerId,
        campaignId: campaign.id,
      });

      await prisma.communicationLog.create({
        data: {
          customerId: recipient.customerId,
          campaignId: campaign.id,
          channel: campaign.channel,
          recipient: recipient.phone,
          message: recipient.renderedMessage,
          status: sendResult.status,
          failureReason: sendResult.failureReason || null,
          sentAt: sendResult.status === CommunicationStatus.SENT ? new Date() : null,
        },
      });

      if (sendResult.status === CommunicationStatus.SENT || sendResult.status === CommunicationStatus.DELIVERED) {
        deliveredCount++;
      } else {
        failedCount++;
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.COMPLETED,
        totalRecipients: preview.eligible.length,
        deliveredCount,
        failedCount,
        sentAt: new Date(),
      },
    });

    return {
      campaign: updated,
      totalRecipients: preview.eligible.length,
      deliveredCount,
      failedCount,
    };
  }

  /**
   * List communication logs
   */
  static async listCommunicationLogs(franchiseId?: string | null, customerId?: string) {
    const where: Prisma.CommunicationLogWhereInput = {};
    if (customerId) {
      where.customerId = customerId;
    } else if (franchiseId) {
      where.customer = {
        OR: [{ franchiseId }, { franchiseId: null }],
      };
    }

    return prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true, segment: true } },
        campaign: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
