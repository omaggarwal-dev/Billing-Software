import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  AlertTriangle,
  History,
  TrendingDown,
  Search,
  CheckCircle2,
  DollarSign,
  Truck,
  Edit2,
  Filter,
} from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { InventoryItem, InventoryTransaction, InventoryStats } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const canManage = ["SUPER_ADMIN", "FRANCHISE_MANAGER"].includes(user?.role || "");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "critical">("all");
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Forms state
  const [itemForm, setItemForm] = useState({
    name: "",
    code: "",
    category: "",
    unit: "kg",
    currentStock: 0,
    minimumStock: 5,
    reorderLevel: 10,
    purchasePrice: 0,
    supplier: "",
  });

  const [stockInForm, setStockInForm] = useState({
    supplier: "",
    invoiceNumber: "",
    notes: "",
    items: [{ inventoryItemId: "", quantity: 1, unitPrice: 0 }],
  });

  const [adjustForm, setAdjustForm] = useState({
    inventoryItemId: "",
    type: "WASTAGE" as "WASTAGE" | "ADJUSTMENT" | "RETURN",
    quantity: 0,
    notes: "",
  });

  // Queries
  const { data: statsData } = useQuery<{ success: boolean; data: InventoryStats }>({
    queryKey: ["inventory-stats", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/inventory/stats");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: itemsData, isLoading } = useQuery<{ success: boolean; data: InventoryItem[] }>({
    queryKey: ["inventory-items", selectedFranchiseId, filterStatus, searchTerm],
    queryFn: async () => {
      const res = await api.get("/inventory", {
        params: { status: filterStatus, search: searchTerm },
      });
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: ledgerData } = useQuery<{ success: boolean; data: InventoryTransaction[] }>({
    queryKey: ["inventory-transactions", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/inventory/transactions", { params: { limit: 50 } });
      return res.data;
    },
    enabled: isLedgerModalOpen && !!selectedFranchiseId,
  });

  // Mutations
  const itemMutation = useMutation({
    mutationFn: async () => {
      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, itemForm);
      } else {
        await api.post("/inventory", itemForm);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      setIsItemModalOpen(false);
      setEditingItem(null);
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async () => {
      await api.post("/inventory/stock-in", stockInForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      setIsStockInModalOpen(false);
      setStockInForm({
        supplier: "",
        invoiceNumber: "",
        notes: "",
        items: [{ inventoryItemId: "", quantity: 1, unitPrice: 0 }],
      });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      await api.post("/inventory/adjust", adjustForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      setIsAdjustModalOpen(false);
    },
  });

  const stats = statsData?.data || { totalItems: 0, totalValue: 0, lowStockCount: 0, criticalStockCount: 0 };
  const items = itemsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inventory & Stock Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track raw materials, stock receipts, automatic recipe consumption, and wastage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsLedgerModalOpen(true)}
            icon={<History className="w-4 h-4" />}
          >
            Audit Ledger
          </Button>

          <Button
            variant="success"
            onClick={() => setIsStockInModalOpen(true)}
            icon={<Truck className="w-4 h-4" />}
          >
            Receive Stock (Stock-In)
          </Button>

          {canManage && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingItem(null);
                setItemForm({
                  name: "",
                  code: "",
                  category: "",
                  unit: "kg",
                  currentStock: 0,
                  minimumStock: 5,
                  reorderLevel: 10,
                  purchasePrice: 0,
                  supplier: "",
                });
                setIsItemModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Raw Material
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Raw Materials"
          value={stats.totalItems}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Total Inventory Value"
          value={`₹${stats.totalValue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockCount}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          subtitle="Stock ≤ Minimum limit"
        />
        <StatCard
          title="Critical / Out of Stock"
          value={stats.criticalStockCount}
          icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
          subtitle="Stock ≤ 50% or 0"
        />
      </div>

      {/* Filters and Controls */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search raw material name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 text-xs font-semibold">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterStatus === "all" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => setFilterStatus("low")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterStatus === "low" ? "bg-amber-500 text-white shadow-sm" : "text-amber-700 hover:text-amber-900"
                }`}
              >
                Low Stock ({stats.lowStockCount})
              </button>
              <button
                onClick={() => setFilterStatus("critical")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterStatus === "critical" ? "bg-rose-500 text-white shadow-sm" : "text-rose-700 hover:text-rose-900"
                }`}
              >
                Critical ({stats.criticalStockCount})
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Items Table */}
      {isLoading ? (
        <LoadingState message="Loading inventory items..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No raw materials found"
          description="Get started by adding raw materials or recording fresh stock receipts."
          icon={<Package className="w-10 h-10 text-gray-400" />}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Min Stock Limit</th>
                  <th className="py-3 px-4">Cost / Unit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {items.map((item) => {
                  const stock = Number(item.currentStock);
                  const min = Number(item.minimumStock);
                  const isLow = stock <= min && min > 0;
                  const isCritical = stock <= min * 0.5 || stock === 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900">{item.name}</span>
                        {item.code && <span className="block text-xs text-gray-400 font-mono">{item.code}</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{item.category || "General"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold text-base ${
                            isCritical ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"
                          }`}
                        >
                          {stock.toFixed(2)}
                        </span>{" "}
                        <span className="text-xs text-gray-500 font-semibold">{item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {min} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-gray-700">₹{Number(item.purchasePrice).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        {isCritical ? (
                          <Badge variant="danger">CRITICAL</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">LOW STOCK</Badge>
                        ) : (
                          <Badge variant="success">IN STOCK</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAdjustForm({
                              inventoryItemId: item.id,
                              type: "WASTAGE",
                              quantity: -1,
                              notes: "Kitchen wastage",
                            });
                            setIsAdjustModalOpen(true);
                          }}
                        >
                          Wastage / Adjust
                        </Button>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(item);
                              setItemForm({
                                name: item.name,
                                code: item.code || "",
                                category: item.category || "",
                                unit: item.unit,
                                currentStock: Number(item.currentStock),
                                minimumStock: Number(item.minimumStock),
                                reorderLevel: Number(item.reorderLevel),
                                purchasePrice: Number(item.purchasePrice),
                                supplier: item.supplier || "",
                              });
                              setIsItemModalOpen(true);
                            }}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Receive Stock (Stock-In) */}
      <Modal
        isOpen={isStockInModalOpen}
        onClose={() => setIsStockInModalOpen(false)}
        title="Receive Fresh Inventory (Stock-In)"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supplier / Vendor"
              placeholder="e.g. Apex Dairy Foods"
              value={stockInForm.supplier}
              onChange={(e) => setStockInForm({ ...stockInForm, supplier: e.target.value })}
            />
            <Input
              label="Invoice / Bill No."
              placeholder="e.g. INV-9041"
              value={stockInForm.invoiceNumber}
              onChange={(e) => setStockInForm({ ...stockInForm, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Received Items
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setStockInForm({
                    ...stockInForm,
                    items: [...stockInForm.items, { inventoryItemId: "", quantity: 1, unitPrice: 0 }],
                  })
                }
              >
                + Add Item
              </Button>
            </div>

            {stockInForm.items.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <Select
                    options={items.map((it) => ({ value: it.id, label: `${it.name} (${it.unit})` }))}
                    placeholder="Select raw material"
                    value={row.inventoryItemId}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].inventoryItemId = e.target.value;
                      const matched = items.find((x) => x.id === e.target.value);
                      if (matched) updated[idx].unitPrice = Number(matched.purchasePrice);
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].quantity = Number(e.target.value);
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="₹ Cost"
                    value={row.unitPrice}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].unitPrice = Number(e.target.value);
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                  />
                </div>
                {stockInForm.items.length > 1 && (
                  <button
                    onClick={() => {
                      const updated = stockInForm.items.filter((_, i) => i !== idx);
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <Input
            label="Notes"
            placeholder="Optional receiving remarks"
            value={stockInForm.notes}
            onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsStockInModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => stockInMutation.mutate()}
              isLoading={stockInMutation.isPending}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Stock-In
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Create/Edit Item */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? "Edit Raw Material" : "Add Raw Material"}
      >
        <div className="space-y-4">
          <Input
            label="Item Name"
            placeholder="e.g. Paneer, Butter, Basmati Rice"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Category"
              placeholder="e.g. Dairy, Spices"
              value={itemForm.category}
              onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
            />
            <Select
              label="Unit"
              options={[
                { value: "kg", label: "Kilograms (kg)" },
                { value: "g", label: "Grams (g)" },
                { value: "l", label: "Liters (l)" },
                { value: "ml", label: "Milliliters (ml)" },
                { value: "pcs", label: "Pieces (pcs)" },
              ]}
              value={itemForm.unit}
              onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {!editingItem && (
              <Input
                label="Opening Stock"
                type="number"
                value={itemForm.currentStock}
                onChange={(e) => setItemForm({ ...itemForm, currentStock: Number(e.target.value) })}
              />
            )}
            <Input
              label="Min Stock"
              type="number"
              value={itemForm.minimumStock}
              onChange={(e) => setItemForm({ ...itemForm, minimumStock: Number(e.target.value) })}
            />
            <Input
              label="Cost / Unit (₹)"
              type="number"
              value={itemForm.purchasePrice}
              onChange={(e) => setItemForm({ ...itemForm, purchasePrice: Number(e.target.value) })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => itemMutation.mutate()}
              isLoading={itemMutation.isPending}
            >
              {editingItem ? "Update Item" : "Create Item"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Stock Adjustment */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Record Wastage or Stock Adjustment"
      >
        <div className="space-y-4">
          <Select
            label="Type"
            options={[
              { value: "WASTAGE", label: "Kitchen Wastage / Spoilage (-)" },
              { value: "ADJUSTMENT", label: "Inventory Audit Adjustment (+/-)" },
              { value: "RETURN", label: "Supplier Return (-)" },
            ]}
            value={adjustForm.type}
            onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
          />
          <Input
            label="Quantity (use negative for deduction e.g. -2)"
            type="number"
            step="0.1"
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
          />
          <Input
            label="Reason / Notes"
            placeholder="e.g. Expired dairy batch, physical count discrepancy"
            value={adjustForm.notes}
            onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => adjustMutation.mutate()}
              isLoading={adjustMutation.isPending}
            >
              Apply Adjustment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Audit Ledger */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title="Inventory Transaction Audit Ledger"
        maxWidth="2xl"
      >
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          {ledgerData?.data && ledgerData.data.length > 0 ? (
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Qty</th>
                  <th className="py-2 px-3">Stock Change</th>
                  <th className="py-2 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerData.data.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 px-3 font-semibold text-gray-900">{tx.inventoryItem?.name}</td>
                    <td className="py-2 px-3">
                      <Badge
                        variant={
                          tx.type === "PURCHASE"
                            ? "success"
                            : tx.type === "CONSUMPTION"
                            ? "primary"
                            : tx.type === "WASTAGE"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-bold font-mono">
                      {Number(tx.quantity) > 0 ? `+${Number(tx.quantity)}` : Number(tx.quantity)}
                    </td>
                    <td className="py-2 px-3 text-gray-500 font-mono">
                      {Number(tx.previousStock)} → {Number(tx.newStock)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 truncate max-w-xs">{tx.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-6 text-sm text-gray-500">No transactions recorded yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
};