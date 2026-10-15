import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  FileText,
  Percent,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Award,
  Sparkles,
  Mail,
  MapPin,
  Receipt,
  Coins,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Printer,
  UtensilsCrossed,
  Store,
  Users,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import type { BrandSettings, Franchise } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { LoadingState } from "../../components/common/LoadingState.js";

export const BrandSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printSimulated, setPrintSimulated] = useState(false);
  const [selectedPreviewFranchiseId, setSelectedPreviewFranchiseId] = useState<string>("");

  const [form, setForm] = useState({
    businessName: "",
    tagline: "",
    logoUrl: "",
    email: "",
    phone: "",
    address: "",
    taxNumber: "",
    fssaiNumber: "",
    currencySymbol: "₹",
    currencyCode: "INR",
    defaultGstRate: 5,
    vipDiscountPercent: 20,
    loyalDiscountPercent: 15,
    regularDiscountPercent: 10,
    whatsappSupportNumber: "",
  });

  const { data: brandSettings, isLoading } = useQuery<BrandSettings>({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const res = await api.get("/brand-settings");
      return res.data.data;
    },
  });

  // Fetch franchises for the branch bill address simulator
  const { data: franchises = [] } = useQuery<Franchise[]>({
    queryKey: ["franchises"],
    queryFn: async () => {
      const res = await api.get("/franchises");
      return res.data.data;
    },
  });

  const activePreviewFranchise = franchises.find((f) => f.id === selectedPreviewFranchiseId);

  useEffect(() => {
    if (brandSettings) {
      setForm({
        businessName: brandSettings.businessName || "",
        tagline: brandSettings.tagline || "",
        logoUrl: brandSettings.logoUrl || "",
        email: brandSettings.email || "",
        phone: brandSettings.phone || "",
        address: brandSettings.address || "",
        taxNumber: brandSettings.taxNumber || "",
        fssaiNumber: brandSettings.fssaiNumber || "",
        currencySymbol: brandSettings.currencySymbol || brandSettings.currency || "₹",
        currencyCode: brandSettings.currencyCode || "INR",
        defaultGstRate: Number(brandSettings.defaultGstRate ?? 5),
        vipDiscountPercent: Number(
          brandSettings.vipDiscountPercent ?? brandSettings.loyaltyVipDiscount ?? 20
        ),
        loyalDiscountPercent: Number(
          brandSettings.loyalDiscountPercent ?? brandSettings.loyaltyLoyalDiscount ?? 15
        ),
        regularDiscountPercent: Number(
          brandSettings.regularDiscountPercent ?? brandSettings.loyaltyRegularDiscount ?? 10
        ),
        whatsappSupportNumber: brandSettings.whatsappSupportNumber || "",
      });
    }
  }, [brandSettings]);

  const updateMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.put("/brand-settings", {
        ...payload,
        currency: payload.currencySymbol,
        loyaltyVipDiscount: payload.vipDiscountPercent,
        loyaltyLoyalDiscount: payload.loyalDiscountPercent,
        loyaltyRegularDiscount: payload.regularDiscountPercent,
      });
      return res.data.data;
    },
    onSuccess: (data: BrandSettings) => {
      queryClient.setQueryData(["brand-settings"], data);
      queryClient.invalidateQueries({ queryKey: ["brand-settings"] });
      setSuccessMessage("Brand profile & corporate settings successfully updated across all franchises!");
      setErrorMessage(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err) => {
      setErrorMessage(extractErrorMessage(err));
      setSuccessMessage(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      setErrorMessage("Business / Brand name is required.");
      return;
    }
    updateMutation.mutate(form);
  };

  const handlePrintSimulation = () => {
    setPrintSimulated(true);
    setTimeout(() => setPrintSimulated(false), 2500);
  };

  if (isLoading) {
    return <LoadingState message="Loading brand & business settings..." />;
  }

  // Real-time calculations for the Live Receipt Preview
  const subtotal = 920.0;
  const vipRate = Number(form.vipDiscountPercent) || 0;
  const vipDiscountAmount = Number(((subtotal * vipRate) / 100).toFixed(2));
  const taxableAmount = Math.max(0, subtotal - vipDiscountAmount);
  const gstRate = Number(form.defaultGstRate) || 0;
  const totalTax = Number(((taxableAmount * gstRate) / 100).toFixed(2));
  const halfGstRate = (gstRate / 2).toFixed(1);
  const halfGstAmount = (totalTax / 2).toFixed(2);
  const grandTotal = (taxableAmount + totalTax).toFixed(2);
  const currSym = form.currencySymbol || "₹";

  const displayBranchName = activePreviewFranchise ? activePreviewFranchise.name : null;
  const displayAddress = activePreviewFranchise?.address || form.address || "Main Street, Franchise Hub, India";
  const displayPhone = activePreviewFranchise?.phone || form.phone || "+91 98765 43210";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Brand & Business Command Center
              </h1>
              <p className="text-sm text-slate-500">
                Central headquarters configuration: legal compliance, POS tax billing, and automated loyalty rewards.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Central Governance Active
          </span>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            isLoading={updateMutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Save All Settings
          </Button>
        </div>
      </div>

      {/* Brand Owner Multi-Franchise Setup Workflow Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Brand Owner Launch & Multi-Franchise Setup
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500">Step 1 of 4: Central Foundation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl border-2 border-indigo-500 bg-indigo-50/50 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase text-indigo-700">1. Brand Identity</span>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800">Legal, Taxes & Contact</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Configured right here</p>
          </div>

          {/* Step 2 */}
          <Link
            to="/franchises"
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase text-slate-400 group-hover:text-indigo-600">
                2. Franchises
              </span>
              <Store className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
              Distinct Branch Addresses <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Setup branch locations & bills</p>
          </Link>

          {/* Step 3 */}
          <Link
            to="/users"
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase text-slate-400 group-hover:text-indigo-600">
                3. Team & RBAC
              </span>
              <Users className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
              Provision Managers <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Franchise logins & cashiers</p>
          </Link>

          {/* Step 4 */}
          <Link
            to="/menu"
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase text-slate-400 group-hover:text-indigo-600">
                4. Master Menu
              </span>
              <UtensilsCrossed className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
              Dishes & Recipes <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Codes & locked SOP recipes</p>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Sections (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Brand & Corporate Identity */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <span>Brand & Corporate Identity</span>
                </div>
              }
              subtitle="Primary trade name, visual assets, and central corporate headquarters details."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Business / Trade Name *"
                    placeholder="e.g. The Royal Spice House"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    required
                  />

                  <Input
                    label="Brand Slogan / Tagline"
                    placeholder="e.g. Crafted with passion, served with love"
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Official Brand Email"
                    placeholder="contact@royalspice.com"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                  />

                  <Input
                    label="Customer Care / Hotline"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                  />
                </div>

                <div>
                  <Input
                    label="Corporate / HQ Registered Address"
                    placeholder="e.g. 42 Heritage Boulevard, High Street, Mumbai - 400001"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
                    helperText="Central corporate headquarters address. Individual franchise outlets automatically print their own unique physical address configured under Franchise Management."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <Input
                    label="Brand Logo URL"
                    placeholder="https://example.com/logo.png"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    helperText="Paste direct image link for bill printouts and web app"
                  />

                  <div className="space-y-1">
                    <Input
                      label="WhatsApp Support Number"
                      placeholder="+919876543210"
                      value={form.whatsappSupportNumber}
                      onChange={(e) => setForm({ ...form, whatsappSupportNumber: e.target.value })}
                      leftIcon={<Phone className="w-4 h-4 text-emerald-600" />}
                      helperText="Used for POS receipt sharing & loyalty messaging"
                    />
                  </div>
                </div>

                {form.whatsappSupportNumber && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>WhatsApp Direct URL ready:</span>
                    <a
                      href={`https://wa.me/${form.whatsappSupportNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline hover:text-emerald-900 inline-flex items-center gap-1"
                    >
                      wa.me/{form.whatsappSupportNumber.replace(/\D/g, "")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {/* Section 2: Statutory Compliance & Tax */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>Statutory Compliance & Taxes</span>
                </div>
              }
              subtitle="Government registration numbers printed on customer invoices and financial audits."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="GSTIN / Corporate Tax ID"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    helperText="15-character GSTIN identifier"
                  />

                  <Input
                    label="FSSAI License No."
                    placeholder="e.g. 10019022000000"
                    value={form.fssaiNumber}
                    onChange={(e) => setForm({ ...form, fssaiNumber: e.target.value })}
                    helperText="14-digit food safety license"
                  />

                  <div>
                    <Input
                      label="Default GST Rate (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.defaultGstRate}
                      onChange={(e) =>
                        setForm({ ...form, defaultGstRate: parseFloat(e.target.value) || 0 })
                      }
                      rightIcon={<span className="text-xs font-bold text-slate-400">%</span>}
                    />
                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <span>Split: CGST {halfGstRate}% + SGST {halfGstRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Tax compliance laws mandate that restaurant GSTIN and FSSAI license numbers appear on all printed thermal bills and digital receipts.
                  </span>
                </div>
              </div>
            </Card>

            {/* Section 3: Currency & Localization */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-indigo-600" />
                  <span>Currency & Localization</span>
                </div>
              }
              subtitle="Default monetary denomination used across all franchise POS counters and reporting."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Currency Symbol"
                  placeholder="₹, $, €, £, AED"
                  value={form.currencySymbol}
                  onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                  helperText="Displayed next to menu prices and receipts"
                />

                <Input
                  label="ISO Currency Code"
                  placeholder="INR, USD, EUR, GBP, AED"
                  value={form.currencyCode}
                  onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })}
                  helperText="Standard 3-letter currency code"
                />
              </div>
            </Card>

            {/* Section 4: Automated CRM Loyalty Tiers */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span>Automated CRM Loyalty Tier Discounts</span>
                  </div>
                </div>
              }
              subtitle="When cashiers enter a customer's phone number during POS checkout, the system identifies their visit count and suggests these discount rates with 1-click."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-800 uppercase tracking-wider">
                      VIP Tier
                    </span>
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                      High Value
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700">10+ visits or &ge;₹10,000 spend</p>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.vipDiscountPercent}
                    onChange={(e) =>
                      setForm({ ...form, vipDiscountPercent: parseFloat(e.target.value) || 0 })
                    }
                    rightIcon={<span className="text-xs font-bold text-amber-700">%</span>}
                  />
                </div>

                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-800 uppercase tracking-wider">
                      Loyal Tier
                    </span>
                    <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                      Frequent
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-700">5+ visits or &ge;₹4,000 spend</p>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.loyalDiscountPercent}
                    onChange={(e) =>
                      setForm({ ...form, loyalDiscountPercent: parseFloat(e.target.value) || 0 })
                    }
                    rightIcon={<span className="text-xs font-bold text-purple-700">%</span>}
                  />
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                      Regular Tier
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                      Repeat
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700">2+ visits</p>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.regularDiscountPercent}
                    onChange={(e) =>
                      setForm({ ...form, regularDiscountPercent: parseFloat(e.target.value) || 0 })
                    }
                    rightIcon={<span className="text-xs font-bold text-emerald-700">%</span>}
                  />
                </div>
              </div>
            </Card>

            {/* Bottom Save Action */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={updateMutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                Save Brand & Business Settings
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Thermal POS Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Live POS Bill Simulation</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintSimulation}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              {printSimulated ? "Simulating..." : "Test Print View"}
            </Button>
          </div>

          {/* Branch Outlet Address Switcher */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-indigo-600" />
                Simulate Bill for Branch Outlet:
              </span>
              <Link
                to="/franchises"
                className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold"
              >
                Manage Outlets <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <select
              value={selectedPreviewFranchiseId}
              onChange={(e) => setSelectedPreviewFranchiseId(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">🏢 Brand Central HQ (Default Address)</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  🏪 {f.name} &bull; {f.address || "No address set"}
                </option>
              ))}
            </select>

            {activePreviewFranchise ? (
              <div className="text-[11px] text-indigo-800 bg-indigo-50/70 p-2 rounded-lg border border-indigo-200 flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span>
                    Showing distinct bill address for <strong>{activePreviewFranchise.name}</strong>:
                  </span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {activePreviewFranchise.address || "⚠️ No address set on this franchise yet"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Every franchise branch automatically prints its own unique physical address.</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Real-time preview of how bills and receipts render across all franchise POS counters and customer WhatsApp messages.
          </p>

          {/* Thermal Paper Simulation Card */}
          <div
            className={`bg-[#fdfbf7] text-slate-800 font-mono text-xs rounded-2xl border border-amber-200/80 shadow-lg p-6 relative overflow-hidden transition-all ${
              printSimulated ? "scale-98 ring-4 ring-indigo-500/20" : ""
            }`}
            style={{
              backgroundImage: "radial-gradient(#e5e7eb 0.75px, transparent 0.75px)",
              backgroundSize: "12px 12px",
            }}
          >
            {/* Top Perforation / Receipt Teeth Effect */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-200/50 via-amber-300/60 to-amber-200/50 flex justify-between px-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-100 rounded-full -mt-0.5" />
              ))}
            </div>

            {/* Receipt Content */}
            <div className="space-y-3 pt-2">
              {/* Header: Logo, Brand Name & Distinct Franchise Address */}
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-300">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Brand Logo"
                    className="w-12 h-12 object-contain mx-auto rounded-lg mb-1"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center mx-auto text-xs font-bold">
                    {form.businessName ? form.businessName.substring(0, 2).toUpperCase() : "RM"}
                  </div>
                )}

                <h2 className="text-base font-black tracking-wider text-slate-900 uppercase">
                  {form.businessName || "MY RESTAURANT BRAND"}
                </h2>

                {displayBranchName ? (
                  <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                    {displayBranchName}
                  </p>
                ) : form.tagline ? (
                  <p className="text-[11px] text-slate-500 italic">{form.tagline}</p>
                ) : null}

                {/* DISTINCT OUTLET ADDRESS */}
                <p className="text-[11px] text-slate-700 leading-tight font-medium">
                  {displayAddress}
                </p>

                <p className="text-[10px] text-slate-600">
                  Ph: {displayPhone}
                  {form.email ? ` | ${form.email}` : ""}
                </p>

                {/* Compliance Numbers */}
                <div className="pt-1 text-[10px] text-slate-700 font-semibold space-y-0.5">
                  <div>GSTIN: {form.taxNumber || "22AAAAA0000A1Z5"}</div>
                  <div>FSSAI Lic No: {form.fssaiNumber || "10019022000000"}</div>
                </div>
              </div>

              {/* Bill Metadata */}
              <div className="text-[11px] text-slate-600 space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>BILL NO: #INV-2026-0842</span>
                  <span>TABLE: T-04</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE: {new Date().toLocaleDateString("en-GB")}</span>
                  <span>TIME: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    BRANCH: {activePreviewFranchise ? activePreviewFranchise.code : "CENTRAL"}
                  </span>
                  <span className="text-emerald-700 font-bold">TYPE: DINE-IN</span>
                </div>
              </div>

              {/* Sample Items Table */}
              <div className="pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-slate-900 text-[10px] pb-1 uppercase">
                  <span className="w-1/2">ITEM</span>
                  <span className="w-1/6 text-center">QTY</span>
                  <span className="w-1/6 text-right">RATE</span>
                  <span className="w-1/6 text-right">AMT</span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="w-1/2 truncate font-medium">DISH-01 Paneer Tikka</span>
                    <span className="w-1/6 text-center">1</span>
                    <span className="w-1/6 text-right">360</span>
                    <span className="w-1/6 text-right">{currSym}360</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/2 truncate font-medium">DISH-02 Butter Naan</span>
                    <span className="w-1/6 text-center">2</span>
                    <span className="w-1/6 text-right">70</span>
                    <span className="w-1/6 text-right">{currSym}140</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/2 truncate font-medium">DISH-03 Dum Biryani</span>
                    <span className="w-1/6 text-center">1</span>
                    <span className="w-1/6 text-right">420</span>
                    <span className="w-1/6 text-right">{currSym}420</span>
                  </div>
                </div>
              </div>

              {/* Calculations & Totals */}
              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (3 items)</span>
                  <span>{currSym} {subtotal.toFixed(2)}</span>
                </div>

                {vipRate > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>VIP Customer Loyalty ({vipRate}%)</span>
                    <span>- {currSym} {vipDiscountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Taxable Value</span>
                  <span>{currSym} {taxableAmount.toFixed(2)}</span>
                </div>

                {gstRate > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>CGST ({halfGstRate}%)</span>
                      <span>{currSym} {halfGstAmount}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>SGST ({halfGstRate}%)</span>
                      <span>{currSym} {halfGstAmount}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-300">
                  <span>NET PAYABLE</span>
                  <span className="text-indigo-950 font-black">
                    {currSym} {grandTotal}
                  </span>
                </div>
              </div>

              {/* Footer / QR info */}
              <div className="text-center text-[10px] text-slate-600 space-y-1 pt-1">
                <p className="font-bold text-slate-800">
                  *** THANK YOU FOR VISITING {activePreviewFranchise ? activePreviewFranchise.name.toUpperCase() : "US"} ***
                </p>
                <p>Please Visit Again!</p>

                {form.whatsappSupportNumber && (
                  <div className="p-1.5 rounded bg-amber-100/60 border border-amber-300/60 text-[9px] text-amber-900 mt-2">
                    Feedback or Bill Copy via WhatsApp:
                    <div className="font-bold">{form.whatsappSupportNumber}</div>
                  </div>
                )}

                <p className="text-[9px] text-slate-400 pt-1">
                  Powered by {form.businessName || "RestoMaster"} Enterprise System
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
