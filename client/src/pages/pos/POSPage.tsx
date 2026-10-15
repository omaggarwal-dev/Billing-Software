import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  Trash2,
  ChefHat,
  Receipt,
  Plus,
  Minus,
  UtensilsCrossed,
  AlertCircle,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserCheck,
  UserPlus,
  Sparkles,
  Phone,
  X,
  MessageSquare,
  Tag,
  Percent,
  BadgePercent,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import { useCartStore } from "../../store/cartStore.js";
import type { Category, MenuItem, RestaurantTable, Customer, BrandSettings } from "../../types/index.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { LoadingState } from "../../components/common/LoadingState.js";

export const POSPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedFranchiseId } = useAuthStore();

  const {
    items: cartItems,
    selectedTable,
    discount,
    taxRate,
    addItem,
    updateQuantity,
    updateItemNotes,
    setSelectedTable,
    setDiscount,
    clearCart,
    getSubtotal,
    getTax,
    getTotal,
  } = useCartStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [posError, setPosError] = useState<string | null>(null);

  // Table Seating & Party Size State
  const [partyName, setPartyName] = useState("");
  const [guestCount, setGuestCount] = useState<number>(2);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);
  const [suggestedTables, setSuggestedTables] = useState<RestaurantTable[]>([]);
  const [pendingTableSelection, setPendingTableSelection] = useState<RestaurantTable | null>(null);

  // Post-Payment KOT Modal State
  const [postPaymentOrder, setPostPaymentOrder] = useState<any | null>(null);
  const [postPaymentInvoice, setPostPaymentInvoice] = useState<any | null>(null);
  const [showKotModal, setShowKotModal] = useState(false);

  // Customer CRM Recognition State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPhoneQuery, setCustomerPhoneQuery] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchMsg, setCustomerSearchMsg] = useState<string | null>(null);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    phone: "",
    email: "",
    marketingConsent: true,
  });

  // CRM Campaign Promo & Loyalty Discount State
  const [couponCode, setCouponCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fetch Brand Settings for business info and loyalty discount rates
  const { data: brandSettings } = useQuery<BrandSettings>({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const res = await api.get("/brand-settings");
      return res.data.data;
    },
  });

  // Fetch Active Campaigns to validate promo codes
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["crm-campaigns", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/crm/campaigns");
      return res.data.data;
    },
  });

  const getCustomerLoyaltyDiscountRate = (segment?: string) => {
    if (!segment) return 0;
    const vipRate = brandSettings?.loyaltyVipDiscount ? Number(brandSettings.loyaltyVipDiscount) : 20;
    const loyalRate = brandSettings?.loyaltyLoyalDiscount ? Number(brandSettings.loyaltyLoyalDiscount) : 15;
    const regRate = brandSettings?.loyaltyRegularDiscount ? Number(brandSettings.loyaltyRegularDiscount) : 10;
    if (segment === "VIP" || segment === "HIGH_VALUE") return vipRate;
    if (segment === "LOYAL") return loyalRate;
    if (segment === "REGULAR") return regRate;
    return 0;
  };

  const applyLoyaltyDiscount = () => {
    if (!selectedCustomer) return;
    const rate = getCustomerLoyaltyDiscountRate(selectedCustomer.segment);
    if (rate <= 0) return;
    const currentSubtotal = getSubtotal();
    const disc = Number(((currentSubtotal * rate) / 100).toFixed(2));
    setDiscount(disc);
    setPromoMessage({ text: `${selectedCustomer.segment} loyalty discount (${rate}% = -₹${disc}) applied!`, type: "success" });
  };

  const applyPromoCode = (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;
    const currentSubtotal = getSubtotal();
    if (currentSubtotal <= 0) {
      setPromoMessage({ text: "Add items to cart before applying coupon", type: "error" });
      return;
    }

    let pct = 0;
    const matched = campaigns.find((c: any) => c.discountCode && c.discountCode.toUpperCase() === code);
    if (matched && matched.discountPercent) {
      pct = Number(matched.discountPercent);
    } else if (code === "WELCOME10") {
      pct = 10;
    } else if (code === "VIP20") {
      pct = 20;
    } else if (code === "LOYAL15") {
      pct = 15;
    } else if (code === "FESTIVE25") {
      pct = 25;
    } else {
      setPromoMessage({ text: `Invalid or expired coupon "${code}"`, type: "error" });
      return;
    }

    const disc = Number(((currentSubtotal * pct) / 100).toFixed(2));
    setDiscount(disc);
    setPromoMessage({ text: `Coupon "${code}" applied: ${pct}% OFF (-₹${disc})`, type: "success" });
  };

  const handleCustomerLookup = async (phoneToLookup?: string) => {
    const q = phoneToLookup !== undefined ? phoneToLookup : customerPhoneQuery;
    if (!q || q.trim().length < 3) return;

    setIsSearchingCustomer(true);
    setCustomerSearchMsg(null);
    try {
      const res = await api.get("/crm/lookup", { params: { phone: q.trim() } });
      if (res.data.data) {
        setSelectedCustomer(res.data.data);
        if (!partyName) {
          setPartyName(res.data.data.name);
        }
        setCustomerSearchMsg(null);
      } else {
        setCustomerSearchMsg("Not found. Click '+ Add' to register walk-in.");
      }
    } catch {
      setCustomerSearchMsg("Error looking up customer");
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const quickAddCustomerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/crm/customers", {
        ...quickAddForm,
        franchiseId: selectedFranchiseId,
      });
      return res.data.data;
    },
    onSuccess: (customer: Customer) => {
      setSelectedCustomer(customer);
      if (!partyName) setPartyName(customer.name);
      setShowQuickAddCustomer(false);
      setCustomerPhoneQuery("");
      setQuickAddForm({ name: "", phone: "", email: "", marketingConsent: true });
    },
    onError: (err) => {
      setPosError(extractErrorMessage(err));
    },
  });

  // Fetch Tables
  const { data: tables = [] } = useQuery<RestaurantTable[]>({
    queryKey: ["tables", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/tables");
      return res.data.data;
    },
  });

  // Fetch Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/menu/categories");
      return res.data.data;
    },
  });

  // Fetch Menu Items
  const { data: menuItems = [], isLoading: isLoadingMenu } = useQuery<MenuItem[]>({
    queryKey: ["menu-items", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/menu/items");
      return res.data.data;
    },
  });

  // Handle Smart Table Selection with capacity check
  const handleTableChange = (tableId: string) => {
    if (!tableId) {
      setSelectedTable(null);
      return;
    }

    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const remainingSeats = table.capacity - (table.currentOccupancy || 0);
    if (guestCount > remainingSeats) {
      const alternatives = tables.filter(
        (t) => t.id !== table.id && (t.capacity - (t.currentOccupancy || 0)) >= guestCount
      );
      setSuggestedTables(alternatives);
      setPendingTableSelection(table);
      setShowCapacityWarning(true);
    } else {
      setSelectedTable(table);
    }
  };

  // Place Order & Send KOT Mutation
  const placeOrderAndKOTMutation = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) throw new Error("Order cart is empty");

      const payload = {
        tableId: selectedTable?.id || null,
        customerId: selectedCustomer?.id || null,
        discount,
        taxRate,
        partyName: partyName || undefined,
        guestCount: guestCount || undefined,
        kotDecision: "SENT",
        items: cartItems.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          notes: i.notes || null,
        })),
      };

      const orderRes = await api.post("/orders", payload);
      const createdOrder = orderRes.data.data;

      // Auto generate KOT
      await api.post("/kot/generate", { orderId: createdOrder.id });
      return createdOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["kots"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      clearCart();
      setSelectedCustomer(null);
      navigate("/orders");
    },
    onError: (err) => {
      setPosError(extractErrorMessage(err));
    },
  });

  // Direct Bill & Ask KOT Decision Mutation
  const directBillMutation = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) throw new Error("Order cart is empty");

      const payload = {
        tableId: selectedTable?.id || null,
        customerId: selectedCustomer?.id || null,
        discount,
        taxRate,
        partyName: partyName || undefined,
        guestCount: guestCount || undefined,
        items: cartItems.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          notes: i.notes || null,
        })),
      };

      const orderRes = await api.post("/orders", payload);
      const createdOrder = orderRes.data.data;

      // Generate Invoice
      const invoiceRes = await api.post("/billing/invoices", { orderId: createdOrder.id });
      return { order: createdOrder, invoice: invoiceRes.data.data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setPostPaymentOrder(data.order);
      setPostPaymentInvoice(data.invoice);
      setShowKotModal(true);
    },
    onError: (err) => {
      setPosError(extractErrorMessage(err));
    },
  });

  const handleKotDecision = async (sendKot: boolean) => {
    try {
      if (sendKot && postPaymentOrder) {
        await api.post("/kot/generate", { orderId: postPaymentOrder.id });
      }
    } catch (err) {
      console.error("KOT decision error:", err);
    } finally {
      setShowKotModal(false);
      clearCart();
      navigate("/billing");
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = activeCategory ? item.categoryId === activeCategory : true;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto overflow-hidden">
      {/* LEFT COLUMN: Catalog & Item Selection */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center gap-3">
          <Input
            placeholder="Search dish by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            className="w-full sm:max-w-xs"
          />

          {/* Table Selector & Guests */}
          <div className="w-full sm:w-auto flex-1 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px]">
              <Select
                options={[
                  { value: "", label: "🛍️ Takeaway / Direct Counter" },
                  ...tables.map((t) => ({
                    value: t.id,
                    label: `🪑 Table ${t.tableNumber} (${t.currentOccupancy || 0}/${t.capacity} seated - ${t.status})`,
                  })),
                ]}
                value={selectedTable?.id || ""}
                onChange={(e) => handleTableChange(e.target.value)}
                className="w-full font-semibold"
              />
            </div>

            {selectedTable && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1.5 rounded-lg text-xs">
                  <Users className="w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={guestCount}
                    onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-10 text-center font-bold bg-white border border-gray-300 rounded text-xs py-0.5"
                    title="Party Size / Guests"
                  />
                  <span className="text-gray-500 font-medium">Guests</span>
                </div>

                <input
                  type="text"
                  placeholder="Party Name (opt)"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-28 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/70 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCategory("")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              activeCategory === ""
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Dish Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {isLoadingMenu ? (
            <LoadingState message="Loading dishes..." />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No menu items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  disabled={!item.isAvailable}
                  onClick={() => addItem(item)}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                    item.isAvailable
                      ? "bg-white border-gray-200/90 hover:border-indigo-400 hover:shadow-md active:scale-98"
                      : "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider truncate">
                        {item.category?.name}
                      </span>
                      {item.code && (
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.code}
                        </span>
                      )}
                      {!item.isAvailable && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          Out of Stock
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
                      {item.name}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <span className="text-sm font-extrabold text-gray-900">
                      ₹{Number(item.price).toFixed(2)}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Cart Terminal */}
      <div className="w-full lg:w-96 bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm leading-none">Current Order</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {selectedTable ? `Table ${selectedTable.tableNumber}` : "Takeaway / Walk-in"}
              </p>
            </div>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Customer CRM Recognition & Lookup */}
        <div className="p-3 border-b border-gray-100 bg-slate-50 space-y-2">
          {selectedCustomer ? (
            <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 relative">
              <div className="flex items-start justify-between pr-5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-xs text-gray-900">{selectedCustomer.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white uppercase">
                      {selectedCustomer.segment}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600 font-mono mt-0.5">
                    {selectedCustomer.phone} • {selectedCustomer.totalVisits} visits • ₹{Number(selectedCustomer.totalSpend).toLocaleString("en-IN")}
                  </div>
                  {selectedCustomer.preference?.favoriteItemName && (
                    <div className="text-[10px] text-indigo-700 font-medium mt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Prefers: {selectedCustomer.preference.favoriteItemName}
                    </div>
                  )}

                  {getCustomerLoyaltyDiscountRate(selectedCustomer.segment) > 0 && (
                    <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                        <BadgePercent className="w-3.5 h-3.5 text-indigo-600" />
                        {getCustomerLoyaltyDiscountRate(selectedCustomer.segment)}% Tier Discount
                      </span>
                      <button
                        type="button"
                        onClick={applyLoyaltyDiscount}
                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <Percent className="w-2.5 h-2.5" /> Apply
                      </button>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center gap-2">
                    <a
                      href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hi ${selectedCustomer.name}! Thank you for dining with ${brandSettings?.businessName || "us"}. As our valued ${selectedCustomer.segment} customer, enjoy your visit!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-medium transition-colors cursor-pointer"
                      title="Send WhatsApp Greeting"
                    >
                      <MessageSquare className="w-2.5 h-2.5" /> WhatsApp Offer
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                  title="Detach customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Customer phone..."
                    value={customerPhoneQuery}
                    onChange={(e) => {
                      setCustomerPhoneQuery(e.target.value);
                      if (e.target.value.trim().length >= 10) {
                        handleCustomerLookup(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCustomerLookup();
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-2 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleCustomerLookup()}
                  disabled={isSearchingCustomer || !customerPhoneQuery}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  {isSearchingCustomer ? "..." : "Find"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddForm((prev) => ({ ...prev, phone: customerPhoneQuery }));
                    setShowQuickAddCustomer(true);
                  }}
                  className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-0.5"
                  title="Quick Add Customer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                </button>
              </div>
              {customerSearchMsg && (
                <p className="text-[11px] text-amber-700 px-0.5">{customerSearchMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Error notification */}
        {posError && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{posError}</span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin divide-y divide-gray-100">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-semibold">Cart is empty</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click any dish on the left to add to this order
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.menuItem.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-xs leading-tight">
                      {item.menuItem.name}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      ₹{Number(item.menuItem.price).toFixed(2)} each
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 text-xs">
                    ₹{(Number(item.menuItem.price) * item.quantity).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Notes input */}
                  <input
                    type="text"
                    placeholder="Notes (e.g. less spicy)..."
                    value={item.notes || ""}
                    onChange={(e) => updateItemNotes(item.menuItem.id, e.target.value)}
                    className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  {/* Quantity controls */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-100 text-gray-600 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-xs font-bold text-gray-900 min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                      className="p-1 hover:bg-gray-100 text-gray-600 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Calculations & Checkout Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/80 space-y-3">
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Coupon / Promo Code Input */}
            <div className="pt-1 space-y-1">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Coupon (e.g. WELCOME10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyPromoCode();
                      }
                    }}
                    className="w-full text-[11px] uppercase bg-white border border-gray-200 rounded pl-6 pr-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => applyPromoCode()}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                >
                  Apply
                </button>
              </div>
              {promoMessage && (
                <p className={`text-[10px] font-medium px-0.5 ${promoMessage.type === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                  {promoMessage.text}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0">Discount (₹):</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-20 text-right text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-emerald-700"
              />
            </div>

            <div className="flex justify-between">
              <span>Tax (5% GST):</span>
              <span className="font-semibold text-gray-900">₹{tax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>TOTAL:</span>
              <span className="text-emerald-600">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="secondary"
              size="md"
              disabled={cartItems.length === 0}
              onClick={() => placeOrderAndKOTMutation.mutate()}
              isLoading={placeOrderAndKOTMutation.isPending}
              icon={<ChefHat className="w-4 h-4 text-amber-600" />}
            >
              Send KOT
            </Button>

            <Button
              variant="primary"
              size="md"
              disabled={cartItems.length === 0}
              onClick={() => directBillMutation.mutate()}
              isLoading={directBillMutation.isPending}
              icon={<Receipt className="w-4 h-4" />}
            >
              Bill & Pay
            </Button>
          </div>
        </div>
      </div>

      {/* Table Capacity Warning Modal */}
      {showCapacityWarning && pendingTableSelection && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-gray-900">Table Capacity Alert</h3>
                <p className="text-xs text-gray-500">
                  Party size ({guestCount} guests) exceeds Table {pendingTableSelection.tableNumber}'s remaining capacity ({pendingTableSelection.capacity - (pendingTableSelection.currentOccupancy || 0)} seats free).
                </p>
              </div>
            </div>

            {suggestedTables.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Recommended Alternative Tables:</p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTable(t);
                        setShowCapacityWarning(false);
                        setPendingTableSelection(null);
                      }}
                      className="p-2.5 text-left border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-bold text-indigo-950">Table {t.tableNumber}</p>
                      <p className="text-[11px] text-indigo-600">
                        {t.capacity - (t.currentOccupancy || 0)} free / {t.capacity} total
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                No single empty table has enough seats for {guestCount} guests.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCapacityWarning(false);
                  setPendingTableSelection(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedTable(pendingTableSelection);
                  setShowCapacityWarning(false);
                  setPendingTableSelection(null);
                }}
              >
                Seat Anyway (Shared Seating)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Payment KOT Prompt Modal */}
      {showKotModal && postPaymentOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Order & Invoice Generated!</h3>
              <p className="text-xs text-gray-500">
                Invoice #{postPaymentInvoice?.invoiceNumber || 'INV-001'} for ₹{postPaymentInvoice?.totalAmount || total} is ready.
              </p>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>Send KOT to Kitchen?</span>
              </div>
              <p className="text-xs text-amber-700">
                Would you like to dispatch this ticket directly to the Kitchen Display System (KOT)?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleKotDecision(false)}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-gray-500" />
                Don't Send (Prepared)
              </button>

              <button
                onClick={() => handleKotDecision(true)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                Send KOT to Kitchen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showQuickAddCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">Quick Add Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddCustomer(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="Full Name *"
                placeholder="e.g. Ananya Patel"
                value={quickAddForm.name}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                required
              />

              <Input
                label="Phone Number *"
                placeholder="e.g. +91 9876543210"
                value={quickAddForm.phone}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                required
              />

              <Input
                label="Email (Optional)"
                type="email"
                placeholder="ananya@example.com"
                value={quickAddForm.email}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, email: e.target.value })}
              />

              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={quickAddForm.marketingConsent}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, marketingConsent: e.target.checked })}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <span>Consent received for order bills, loyalty rewards & offers via SMS/WhatsApp</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <Button variant="secondary" size="sm" onClick={() => setShowQuickAddCustomer(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => quickAddCustomerMutation.mutate()}
                isLoading={quickAddCustomerMutation.isPending}
                disabled={!quickAddForm.name || !quickAddForm.phone}
              >
                Register & Attach
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
