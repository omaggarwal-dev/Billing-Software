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
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import { useCartStore } from "../../store/cartStore.js";
import type { Category, MenuItem, RestaurantTable } from "../../types/index.js";
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

  // Place Order & Send KOT Mutation
  const placeOrderAndKOTMutation = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) throw new Error("Order cart is empty");

      const payload = {
        tableId: selectedTable?.id || null,
        discount,
        taxRate,
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
      navigate("/orders");
    },
    onError: (err) => {
      setPosError(extractErrorMessage(err));
    },
  });

  // Instant Bill & Checkout Mutation
  const directBillMutation = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) throw new Error("Order cart is empty");

      const payload = {
        tableId: selectedTable?.id || null,
        discount,
        taxRate,
        items: cartItems.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          notes: i.notes || null,
        })),
      };

      const orderRes = await api.post("/orders", payload);
      const createdOrder = orderRes.data.data;

      // Generate KOT
      await api.post("/kot/generate", { orderId: createdOrder.id });

      // Generate Invoice
      const invoiceRes = await api.post("/billing/invoices", { orderId: createdOrder.id });
      return invoiceRes.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      clearCart();
      navigate("/billing");
    },
    onError: (err) => {
      setPosError(extractErrorMessage(err));
    },
  });

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = activeCategory ? item.categoryId === activeCategory : true;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

          {/* Table Selector */}
          <div className="w-full sm:w-auto flex-1 flex items-center gap-2">
            <Select
              options={[
                { value: "", label: "🛍️ Takeaway / Direct Counter" },
                ...tables.map((t) => ({
                  value: t.id,
                  label: `🪑 Table ${t.tableNumber} (${t.status})`,
                })),
              ]}
              value={selectedTable?.id || ""}
              onChange={(e) => {
                const found = tables.find((t) => t.id === e.target.value);
                setSelectedTable(found || null);
              }}
              className="w-full font-semibold"
            />
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

            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0">Discount (₹):</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-20 text-right text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
    </div>
  );
};
