import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { CRMService } from "./crm.service.js";
import { CustomerSegment } from "@prisma/client";

export async function searchCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || (req.query.franchiseId as string) || null;
    const result = await CRMService.searchCustomers(franchiseId, {
      query: req.query.query as string,
      segment: req.query.segment as CustomerSegment,
      hasConsent: req.query.hasConsent !== undefined ? req.query.hasConsent === "true" : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    return res.json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function lookupByPhone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const phone = (req.query.phone as string) || "";
    const customer = await CRMService.lookupCustomerByPhone(phone);
    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const customer = await CRMService.getCustomerById(id);
    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || req.body.franchiseId || null;
    const customer = await CRMService.createCustomer(req.body, franchiseId);
    return res.status(201).json({
      success: true,
      data: customer,
      message: "Customer created successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const customer = await CRMService.updateCustomer(id, req.body);
    return res.json({
      success: true,
      data: customer,
      message: "Customer updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || (req.query.franchiseId as string) || null;
    const analytics = await CRMService.getSegmentAnalytics(franchiseId);
    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}

export async function recalculateSegments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || (req.query.franchiseId as string) || null;
    const result = await CRMService.recalculateSegments(franchiseId);
    return res.json({
      success: true,
      data: result,
      message: `Recalculated RFM segments for ${result.totalEvaluated} customers (${result.updatedCount} updated)`,
    });
  } catch (error) {
    next(error);
  }
}

export async function listCampaigns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || (req.query.franchiseId as string) || null;
    const campaigns = await CRMService.listCampaigns(franchiseId);
    return res.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCampaign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || req.body.franchiseId || null;
    const campaign = await CRMService.createCampaign(req.body, franchiseId);
    return res.status(201).json({
      success: true,
      data: campaign,
      message: "Campaign created successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function previewCampaign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || req.body.franchiseId || null;
    const preview = await CRMService.previewCampaignRecipients(req.body, franchiseId);
    return res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function executeCampaign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = req.params.id as string;
    const franchiseId = req.user?.franchiseId || null;
    const result = await CRMService.executeCampaign(campaignId, franchiseId);
    return res.json({
      success: true,
      data: result,
      message: `Campaign executed. ${result.deliveredCount} delivered, ${result.failedCount} failed/logged.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function listLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const franchiseId = req.user?.franchiseId || (req.query.franchiseId as string) || null;
    const customerId = req.query.customerId as string | undefined;
    const logs = await CRMService.listCommunicationLogs(franchiseId, customerId);
    return res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
