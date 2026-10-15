import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Plus,
  Send,
  Sparkles,
  Phone,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Gift,
  MessageSquare,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type {
  Customer,
  CustomerSegment,
  Campaign,
  CommunicationLog,
  CRMAnalytics,
  CampaignType,
  CommunicationChannel,
} from "../../types/index.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Card } from "../../components/common/Card.js";
import { StatCard } from "../../components/common/StatCard.js";
import { LoadingState } from "../../components/common/LoadingState.js";

const SEGMENT_COLORS: Record<CustomerSegment, { bg: string; text: string; border: string }> = {
  NEW: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  REGULAR: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  LOYAL: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  VIP: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  HIGH_VALUE: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  AT_RISK: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  INACTIVE: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  WIN_BACK: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  OCCASIONAL: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

export const CRMPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "campaigns" | "logs">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | "ALL">("ALL");

  // Modals & Drawers
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Customer Form State
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    birthday: "",
    anniversary: "",
    marketingConsent: true,
    notes: "",
    dietaryNotes: "",
    spicePreference: "Medium",
    seatingPreference: "Indoor",
  });

  // New Campaign Form State
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    type: "WIN_BACK" as CampaignType,
    channel: "SMS" as CommunicationChannel,
    targetSegment: "AT_RISK" as CustomerSegment | "ALL",
    messageTemplate: "Hi {{customerName}}, we miss you at RestoMaster! Enjoy {{discountPercent}} off your favorite {{favoriteItem}} with code {{discountCode}}.",
    discountCode: "WELCOMEBACK",
    discountPercent: 15,
    cooldownDays: 7,
  });

  // Query: Analytics
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery<CRMAnalytics>({
    queryKey: ["crm-analytics", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/crm/analytics", { params: { franchiseId: selectedFranchiseId } });
      return res.data.data;
    },
  });

  // Query: Customers
  const { data: customerResult, isLoading: isLoadingCustomers } = useQuery<{
    customers: Customer[];
    pagination: { total: number };
  }>({
    queryKey: ["crm-customers", selectedFranchiseId, searchQuery, selectedSegment],
    queryFn: async () => {
      const res = await api.get("/crm/customers", {
        params: {
          franchiseId: selectedFranchiseId,
          query: searchQuery || undefined,
          segment: selectedSegment !== "ALL" ? selectedSegment : undefined,
        },
      });
      return { customers: res.data.data, pagination: res.data.pagination };
    },
  });

  // Query: Selected Customer Detail
  const { data: customerDetail } = useQuery<Customer>({
    queryKey: ["crm-customer-detail", selectedCustomerId],
    queryFn: async () => {
      const res = await api.get(`/crm/customers/${selectedCustomerId}`);
      return res.data.data;
    },
    enabled: !!selectedCustomerId,
  });

  // Query: Campaigns
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["crm-campaigns", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/crm/campaigns", { params: { franchiseId: selectedFranchiseId } });
      return res.data.data;
    },
  });

  // Query: Communication Logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery<CommunicationLog[]>({
    queryKey: ["crm-logs", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/crm/logs", { params: { franchiseId: selectedFranchiseId } });
      return res.data.data;
    },
  });

  // Mutation: Recalculate Segments
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/crm/recalculate-segments", { franchiseId: selectedFranchiseId });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      setActionSuccess(data.message || "Segments recalculated successfully");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  // Mutation: Create Customer
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: typeof customerForm) => {
      const res = await api.post("/crm/customers", {
        ...payload,
        franchiseId: selectedFranchiseId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm-analytics"] });
      setShowAddCustomerModal(false);
      setCustomerForm({
        name: "",
        phone: "",
        email: "",
        birthday: "",
        anniversary: "",
        marketingConsent: true,
        notes: "",
        dietaryNotes: "",
        spicePreference: "Medium",
        seatingPreference: "Indoor",
      });
      setActionSuccess("Customer added successfully!");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  // Mutation: Create Campaign
  const createCampaignMutation = useMutation({
    mutationFn: async (payload: typeof campaignForm) => {
      const res = await api.post("/crm/campaigns", {
        ...payload,
        targetSegment: payload.targetSegment !== "ALL" ? payload.targetSegment : null,
        franchiseId: selectedFranchiseId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] });
      setShowCampaignModal(false);
      setPreviewData(null);
      setActionSuccess("Campaign created successfully!");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  // Mutation: Preview Campaign
  const previewCampaignMutation = useMutation({
    mutationFn: async (payload: typeof campaignForm) => {
      const res = await api.post("/crm/campaigns/preview", {
        ...payload,
        targetSegment: payload.targetSegment !== "ALL" ? payload.targetSegment : null,
        franchiseId: selectedFranchiseId,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  // Mutation: Execute Campaign
  const executeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await api.post(`/crm/campaigns/${campaignId}/execute`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["crm-logs"] });
      setActionSuccess(data.message || "Campaign executed successfully");
      setTimeout(() => setActionSuccess(null), 5000);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Customer CRM & Retention</h1>
              <p className="text-xs md:text-sm text-slate-400">
                Closed-loop customer profiles, RFM behavioral intelligence, and automated marketing campaigns
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            isLoading={recalculateMutation.isPending}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Recalculate RFM
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddCustomerModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Customer
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "overview"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Overview & Intelligence
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "customers"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Customer Directory ({customerResult?.pagination?.total || 0})
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "campaigns"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Automated Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "logs"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Communication Audit Logs
        </button>
      </div>

      {/* TAB 1: OVERVIEW & INTELLIGENCE */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {isLoadingAnalytics ? (
            <LoadingState message="Loading CRM metrics..." />
          ) : (
            <>
              {/* High-level KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                  title="Total Customer Base"
                  value={analytics?.totalCustomers || 0}
                  subtitle={`${analytics?.optedInCount || 0} Marketing Opt-ins`}
                  icon={<Users className="w-6 h-6" />}
                  color="indigo"
                />
                <StatCard
                  title="Marketing Consent"
                  value={`${analytics?.optInRate || 0}%`}
                  subtitle="Compliant & Active Profiles"
                  icon={<ShieldCheck className="w-6 h-6" />}
                  color="emerald"
                />
                <StatCard
                  title="CRM Lifetime Revenue"
                  value={`₹${(analytics?.totalRevenue || 0).toLocaleString("en-IN")}`}
                  subtitle="Tracked Customer Spend"
                  icon={<DollarSign className="w-6 h-6" />}
                  color="purple"
                />
                <StatCard
                  title="Avg Customer Lifetime Value"
                  value={`₹${(analytics?.avgLifetimeSpend || 0).toLocaleString("en-IN")}`}
                  subtitle="Spend Per Customer"
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="amber"
                />
              </div>

              {/* Segment Intelligence Cards */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Automated RFM Segment Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics?.distribution.map((item) => {
                    const colors = SEGMENT_COLORS[item.segment] || {
                      bg: "bg-slate-800",
                      text: "text-slate-300",
                      border: "border-slate-700",
                    };
                    return (
                      <div
                        key={item.segment}
                        className={`p-5 rounded-xl border ${colors.bg} ${colors.border} flex flex-col justify-between`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900/60 ${colors.text}`}>
                            {item.segment.replace("_", " ")}
                          </span>
                          <span className="text-xl font-bold text-white">{item.count}</span>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <span className="block text-slate-400">Share</span>
                            <span className="font-semibold text-slate-200">{item.percentage}%</span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Avg Visits</span>
                            <span className="font-semibold text-slate-200">{item.avgVisits}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Total Spend</span>
                            <span className="font-semibold text-slate-200">₹{item.totalSpend.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions / Intelligence Banner */}
              <Card className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border-indigo-900/40 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      Automated Customer Lifecycle Recommendations
                    </h4>
                    <p className="text-sm text-slate-300 mt-1">
                      {analytics?.distribution.find((d) => d.segment === "AT_RISK")?.count || 0} customers are currently flagged as <strong>At Risk</strong> (&gt;30 days without a visit).
                      Launch an automated Win-Back campaign with personalized dish recommendations.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setCampaignForm((prev) => ({
                        ...prev,
                        type: "WIN_BACK",
                        targetSegment: "AT_RISK",
                        messageTemplate: "We miss having you at RestoMaster! Enjoy 15% off {{favoriteItem}} with code WINBACK15.",
                      }));
                      setShowCampaignModal(true);
                    }}
                    icon={<Send className="w-4 h-4" />}
                  >
                    Launch Win-Back
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOMER DIRECTORY */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search phone, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
              />
            </div>

            {/* Segment Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              {(["ALL", "VIP", "LOYAL", "REGULAR", "NEW", "AT_RISK", "INACTIVE"] as const).map((seg) => (
                <button
                  key={seg}
                  onClick={() => setSelectedSegment(seg as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedSegment === seg
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

          {/* Customers Table */}
          <Card className="overflow-hidden p-0">
            {isLoadingCustomers ? (
              <LoadingState message="Loading customers..." />
            ) : customerResult?.customers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-semibold text-slate-300">No customers found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add walk-ins from POS or click "Add Customer" above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Customer</th>
                      <th className="py-3.5 px-4 font-semibold">Segment</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Visits</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Lifetime Spend</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Avg Order</th>
                      <th className="py-3.5 px-4 font-semibold">Favorite Item</th>
                      <th className="py-3.5 px-4 font-semibold">Consent</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customerResult?.customers.map((c) => {
                      const segColor = SEGMENT_COLORS[c.segment] || {
                        bg: "bg-slate-800",
                        text: "text-slate-300",
                        border: "border-slate-700",
                      };
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{c.name}</div>
                            <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {c.phone}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${segColor.bg} ${segColor.text} ${segColor.border}`}
                            >
                              {c.segment.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-white">{c.totalVisits}</td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-400">
                            ₹{Number(c.totalSpend).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-300">
                            ₹{Number(c.averageOrderValue).toFixed(0)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-indigo-300 font-medium bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/40">
                              {c.preference?.favoriteItemName || "No orders yet"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {c.marketingConsent ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Opted In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                                <XCircle className="w-3.5 h-3.5" /> Opted Out
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                  `Hi ${c.name}! We appreciate you dining with us. As our valued ${c.segment} guest, enjoy special rewards on your next visit!`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                title="Send WhatsApp Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedCustomerId(c.id)}
                                icon={<Eye className="w-3.5 h-3.5" />}
                              >
                                Profile
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Automated Customer Campaigns</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeted retention promotions with dynamic template rendering and frequency cooldown safeguards
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPreviewData(null);
                setShowCampaignModal(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              New Campaign
            </Button>
          </div>

          {isLoadingCampaigns ? (
            <LoadingState message="Loading campaigns..." />
          ) : campaigns.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-semibold text-slate-300">No campaigns created yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Create your first targeted loyalty or win-back campaign.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <Card key={camp.id} className="p-5 flex flex-col justify-between border-slate-800">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                          {camp.type.replace("_", " ")}
                        </span>
                        <h4 className="text-base font-bold text-white mt-1.5">{camp.name}</h4>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          camp.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono">
                      "{camp.messageTemplate}"
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs border-t border-slate-800 pt-3">
                      <div>
                        <span className="block text-slate-500">Channel</span>
                        <span className="font-semibold text-slate-300">{camp.channel}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Target Segment</span>
                        <span className="font-semibold text-slate-300">
                          {camp.targetSegment || "All Segments"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Cooldown</span>
                        <span className="font-semibold text-slate-300">{camp.cooldownDays} days</span>
                      </div>
                    </div>

                    {camp.status === "COMPLETED" && (
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Total Recipients: <strong className="text-white">{camp.totalRecipients}</strong></span>
                        <span className="text-emerald-400">Delivered: <strong>{camp.deliveredCount}</strong></span>
                        <span className="text-rose-400">Logged/Unsent: <strong>{camp.failedCount}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => executeCampaignMutation.mutate(camp.id)}
                      isLoading={executeCampaignMutation.isPending}
                      icon={<Send className="w-3.5 h-3.5" />}
                    >
                      {camp.status === "COMPLETED" ? "Re-Run Campaign" : "Execute & Send"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMUNICATION LOGS */}
      {activeTab === "logs" && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Outbound Communications Audit Trail</h3>
            <span className="text-xs text-slate-400">{logs.length} Total Dispatches Recorded</span>
          </div>

          {isLoadingLogs ? (
            <LoadingState message="Loading communication logs..." />
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-semibold text-slate-300">No communication logs</p>
              <p className="text-xs text-slate-500 mt-1">Logs will appear when campaigns are dispatched.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Channel</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Message & Provider Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{l.customer?.name || "Customer"}</div>
                        <div className="text-xs text-slate-400 font-mono">{l.recipient}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">{l.channel}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            l.status === "SENT" || l.status === "DELIVERED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="text-xs text-slate-300 truncate">{l.message}</div>
                        {l.failureReason && (
                          <div className="text-xs text-amber-400/90 mt-0.5 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            {l.failureReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Add Customer Profile
              </h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="Customer Full Name *"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                required
              />

              <Input
                label="Phone Number *"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                required
              />

              <Input
                label="Email Address"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                placeholder="rahul@example.com"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Birthday"
                  type="date"
                  value={customerForm.birthday}
                  onChange={(e) => setCustomerForm({ ...customerForm, birthday: e.target.value })}
                />
                <Input
                  label="Anniversary"
                  type="date"
                  value={customerForm.anniversary}
                  onChange={(e) => setCustomerForm({ ...customerForm, anniversary: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Spice Preference"
                  value={customerForm.spicePreference}
                  onChange={(e) => setCustomerForm({ ...customerForm, spicePreference: e.target.value })}
                  options={[
                    { value: "Mild", label: "Mild" },
                    { value: "Medium", label: "Medium" },
                    { value: "Spicy", label: "Spicy" },
                    { value: "Extra Spicy", label: "Extra Spicy" },
                  ]}
                />
                <Select
                  label="Seating Preference"
                  value={customerForm.seatingPreference}
                  onChange={(e) => setCustomerForm({ ...customerForm, seatingPreference: e.target.value })}
                  options={[
                    { value: "Indoor", label: "Indoor AC" },
                    { value: "Outdoor", label: "Outdoor Terrace" },
                    { value: "Window", label: "Window Side" },
                    { value: "Booth", label: "Booth" },
                  ]}
                />
              </div>

              <Input
                label="Dietary / Allergy Notes"
                value={customerForm.dietaryNotes}
                onChange={(e) => setCustomerForm({ ...customerForm, dietaryNotes: e.target.value })}
                placeholder="e.g. Jain, Gluten Free, Nut Allergy"
              />

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={customerForm.marketingConsent}
                  onChange={(e) => setCustomerForm({ ...customerForm, marketingConsent: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <span>Customer grants consent for promotional SMS & WhatsApp updates</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setShowAddCustomerModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => createCustomerMutation.mutate(customerForm)}
                isLoading={createCustomerMutation.isPending}
                disabled={!customerForm.name || !customerForm.phone}
              >
                Save Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: CUSTOMER PROFILE DETAILS */}
      {selectedCustomerId && customerDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{customerDetail.name}</h3>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      SEGMENT_COLORS[customerDetail.segment]?.bg
                    } ${SEGMENT_COLORS[customerDetail.segment]?.text} ${
                      SEGMENT_COLORS[customerDetail.segment]?.border
                    }`}
                  >
                    {customerDetail.segment.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{customerDetail.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomerId(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="block text-xs text-slate-400">Total Visits</span>
                <span className="text-lg font-bold text-white">{customerDetail.totalVisits}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="block text-xs text-slate-400">Lifetime Spend</span>
                <span className="text-lg font-bold text-emerald-400">
                  ₹{Number(customerDetail.totalSpend).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="block text-xs text-slate-400">Avg Order Value</span>
                <span className="text-lg font-bold text-indigo-400">
                  ₹{Number(customerDetail.averageOrderValue).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Preferences */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-sm">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                Taste & Dining Preferences
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Favorite Dish:</span>{" "}
                  <strong className="text-indigo-300">
                    {customerDetail.preference?.favoriteItemName || "Analyzing order history..."}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Spice Level:</span>{" "}
                  <strong className="text-slate-200">
                    {customerDetail.preference?.spicePreference || "Standard"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Seating:</span>{" "}
                  <strong className="text-slate-200">
                    {customerDetail.preference?.seatingPreference || "Any"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Dietary Notes:</span>{" "}
                  <strong className="text-slate-200">
                    {customerDetail.preference?.dietaryNotes || "None"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase font-semibold text-slate-400">Recent Order History</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {customerDetail.orders && customerDetail.orders.length > 0 ? (
                  customerDetail.orders.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-indigo-300 font-semibold">{ord.orderNumber}</span>
                        <span className="text-slate-500 ml-2">
                          {new Date(ord.createdAt).toLocaleDateString("en-IN")}
                        </span>
                        <div className="text-slate-400 truncate max-w-xs mt-0.5">
                          {ord.items.map((it: any) => `${it.quantity}x ${it.menuItem?.name}`).join(", ")}
                        </div>
                      </div>
                      <span className="font-bold text-white">₹{Number(ord.total).toLocaleString("en-IN")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No orders recorded yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <a
                href={`https://wa.me/${customerDetail.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hi ${customerDetail.name}! Thank you for dining with us. As our valued ${customerDetail.segment} guest, we would love to see you again soon. Show this message for 15% off your next visit!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send Offer via WhatsApp
              </a>
              <Button variant="secondary" onClick={() => setSelectedCustomerId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CAMPAIGN BUILDER & PREVIEW */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-indigo-400" />
                Create Automated Retention Campaign
              </h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="Campaign Name *"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="e.g. Weekend Win-Back 15%"
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Campaign Type"
                  value={campaignForm.type}
                  onChange={(e) => setCampaignForm({ ...campaignForm, type: e.target.value as CampaignType })}
                  options={[
                    { value: "WIN_BACK", label: "Win-Back (Inactive Customers)" },
                    { value: "BIRTHDAY", label: "Birthday Special" },
                    { value: "LOYALTY_REWARD", label: "VIP Loyalty Reward" },
                    { value: "FESTIVE", label: "Festive Announcement" },
                    { value: "CUSTOM", label: "Custom Broadcast" },
                  ]}
                />
                <Select
                  label="Channel"
                  value={campaignForm.channel}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, channel: e.target.value as CommunicationChannel })
                  }
                  options={[
                    { value: "SMS", label: "SMS Gateway" },
                    { value: "WHATSAPP", label: "WhatsApp Business API" },
                    { value: "EMAIL", label: "Email Newsletter" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Select
                  label="Target Segment"
                  value={campaignForm.targetSegment}
                  onChange={(e) => setCampaignForm({ ...campaignForm, targetSegment: e.target.value as any })}
                  options={[
                    { value: "ALL", label: "All Segments" },
                    { value: "AT_RISK", label: "At Risk" },
                    { value: "INACTIVE", label: "Inactive" },
                    { value: "REGULAR", label: "Regular" },
                    { value: "LOYAL", label: "Loyal" },
                    { value: "VIP", label: "VIP" },
                    { value: "NEW", label: "New Walk-ins" },
                  ]}
                />
                <Input
                  label="Discount Code"
                  value={campaignForm.discountCode}
                  onChange={(e) => setCampaignForm({ ...campaignForm, discountCode: e.target.value })}
                  placeholder="e.g. WINBACK15"
                />
                <Input
                  label="Discount %"
                  type="number"
                  value={campaignForm.discountPercent}
                  onChange={(e) => setCampaignForm({ ...campaignForm, discountPercent: Number(e.target.value) })}
                />
              </div>

              {/* Message Template with Dynamic Tags */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Message Template (Dynamic Tag Interpolation)
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    "{{customerName}}",
                    "{{favoriteItem}}",
                    "{{discountCode}}",
                    "{{discountPercent}}",
                    "{{brandName}}",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setCampaignForm((prev) => ({
                          ...prev,
                          messageTemplate: `${prev.messageTemplate} ${tag}`,
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-mono hover:bg-indigo-900 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={campaignForm.messageTemplate}
                  onChange={(e) => setCampaignForm({ ...campaignForm, messageTemplate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Preview Button */}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => previewCampaignMutation.mutate(campaignForm)}
                isLoading={previewCampaignMutation.isPending}
                icon={<Eye className="w-4 h-4" />}
              >
                Preview Eligible Recipients & Render Message
              </Button>

              {/* Live Preview Results */}
              {previewData && (
                <div className="p-3 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-semibold">
                      Eligible: {previewData.eligible.length} / {previewData.totalMatched} matched
                    </span>
                    <span className="text-slate-400">
                      Excluded (cooldown/opt-out): {previewData.ineligiblesCount}
                    </span>
                  </div>
                  {previewData.eligible.length > 0 && (
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 text-[11px] font-semibold uppercase">
                          Sample Render for {previewData.eligible[0].customerName}:
                        </span>
                        <a
                          href={`https://wa.me/${previewData.eligible[0].phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            previewData.eligible[0].renderedMessage
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" /> Test on WhatsApp
                        </a>
                      </div>
                      <p className="font-mono text-emerald-300">"{previewData.eligible[0].renderedMessage}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setShowCampaignModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => createCampaignMutation.mutate(campaignForm)}
                isLoading={createCampaignMutation.isPending}
                disabled={!campaignForm.name || !campaignForm.messageTemplate}
              >
                Save Campaign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
