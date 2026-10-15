import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";

export interface UpdateBrandSettingsInput {
  businessName?: string;
  tagline?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  fssaiNumber?: string | null;
  currencySymbol?: string;
  currencyCode?: string;
  currency?: string;
  defaultGstRate?: number;
  vipDiscountPercent?: number;
  loyalDiscountPercent?: number;
  regularDiscountPercent?: number;
  loyaltyVipDiscount?: number;
  loyaltyLoyalDiscount?: number;
  loyaltyRegularDiscount?: number;
  whatsappSupportNumber?: string | null;
}

export async function getBrandSettings() {
  let settings = await prisma.brandSettings.findFirst();

  if (!settings) {
    settings = await prisma.brandSettings.create({
      data: {
        businessName: "My Restaurant Brand",
        tagline: "Fine Dining & Hospitality",
        currencySymbol: "₹",
        currencyCode: "INR",
        defaultGstRate: 5.0,
        vipDiscountPercent: 20.0,
        loyalDiscountPercent: 15.0,
        regularDiscountPercent: 10.0,
      },
    });
  }

  return {
    ...settings,
    currency: settings.currencySymbol,
    loyaltyVipDiscount: Number(settings.vipDiscountPercent),
    loyaltyLoyalDiscount: Number(settings.loyalDiscountPercent),
    loyaltyRegularDiscount: Number(settings.regularDiscountPercent),
  };
}

export async function updateBrandSettings(data: UpdateBrandSettingsInput) {
  let settings = await prisma.brandSettings.findFirst();

  const updateData: Prisma.BrandSettingsUpdateInput = {
    businessName: data.businessName?.trim() || undefined,
    tagline: data.tagline !== undefined ? (data.tagline?.trim() || null) : undefined,
    logoUrl: data.logoUrl !== undefined ? (data.logoUrl?.trim() || null) : undefined,
    email: data.email !== undefined ? (data.email?.trim() || null) : undefined,
    phone: data.phone !== undefined ? (data.phone?.trim() || null) : undefined,
    address: data.address !== undefined ? (data.address?.trim() || null) : undefined,
    taxNumber: data.taxNumber !== undefined ? (data.taxNumber?.trim() || null) : undefined,
    fssaiNumber: data.fssaiNumber !== undefined ? (data.fssaiNumber?.trim() || null) : undefined,
    currencySymbol: (data.currencySymbol || data.currency)?.trim() || undefined,
    currencyCode: data.currencyCode?.trim() || undefined,
    defaultGstRate: data.defaultGstRate !== undefined ? Number(data.defaultGstRate) : undefined,
    vipDiscountPercent: data.vipDiscountPercent !== undefined 
      ? Number(data.vipDiscountPercent) 
      : (data.loyaltyVipDiscount !== undefined ? Number(data.loyaltyVipDiscount) : undefined),
    loyalDiscountPercent: data.loyalDiscountPercent !== undefined 
      ? Number(data.loyalDiscountPercent) 
      : (data.loyaltyLoyalDiscount !== undefined ? Number(data.loyaltyLoyalDiscount) : undefined),
    regularDiscountPercent: data.regularDiscountPercent !== undefined 
      ? Number(data.regularDiscountPercent) 
      : (data.loyaltyRegularDiscount !== undefined ? Number(data.loyaltyRegularDiscount) : undefined),
    whatsappSupportNumber: data.whatsappSupportNumber !== undefined ? (data.whatsappSupportNumber?.trim() || null) : undefined,
  };

  if (!settings) {
    settings = await prisma.brandSettings.create({
      data: {
        businessName: data.businessName?.trim() || "My Restaurant Brand",
        ...updateData,
      } as Prisma.BrandSettingsCreateInput,
    });
  } else {
    settings = await prisma.brandSettings.update({
      where: { id: settings.id },
      data: updateData,
    });
  }

  return {
    ...settings,
    currency: settings.currencySymbol,
    loyaltyVipDiscount: Number(settings.vipDiscountPercent),
    loyaltyLoyalDiscount: Number(settings.loyalDiscountPercent),
    loyaltyRegularDiscount: Number(settings.regularDiscountPercent),
  };
}
