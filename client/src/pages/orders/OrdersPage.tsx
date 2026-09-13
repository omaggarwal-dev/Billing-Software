import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Receipt,
  Search,
  ChefHat,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  Plus,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { getSocket } from "../../services/socket.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Order } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

const ORDER_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All Active & Past Orders" },
  { value: "OPEN", label: "Open" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing in Kitchen" },
  { value: "READY", label: "Ready to Serve" },
  { value: "SERVED", label: "Served" },
  { value: "BILLED", label: "Billed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const OrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedFranchiseId } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch Orders
  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["orders", selectedFranchiseId, statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/orders?status=${statusFilter}` : "/orders";
      const res = await api.get(url);
      return res.data.data;
    },
  });

  // Socket.IO event listener for real-time updates
  useEffect(() => {
    const socket = getSocket();
    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    };

    socket.on("order:created", handleOrderEvent);
    socket.on("order:updated", handleOrderEvent);
    socket.on("order:status_changed", handleOrderEvent);

    return () => {
      socket.off("order:created", handleOrderEvent);
      socket.off("order:updated", handleOrderEvent);
      socket.off("order:status_changed", handleOrderEvent);
    };
  }, [queryClient]);

  // Status Change Mutations
  const serveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/orders/${id}/serve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const generateKOTMutation = useMutation({
    mutationFn: async (orderId: string) => api.post("/kot/generate", { orderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["kots"] });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (orderId: string) => api.post("/billing/invoices", { orderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate("/billing");
    },
    onError: (err) => alert(extractErrorMessage(err)),
  });

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.tableSession?.table?.tableNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor real-time kitchen progress, generate KOTs, and dispatch customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => navigate("/pos")} icon={<Plus className="w-4 h-4" />}>
            New Order
          </Button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by order # or table number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="w-full sm:max-w-md"
        />

        <Select
          options={ORDER_STATUS_FILTERS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* Orders List */}
      {isLoading ? (
        <LoadingState message="Loading live orders..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Orders Found"
          description="Create orders from the POS Terminal or Table Floor View."
          actionLabel="Open POS Terminal"
          onAction={() => navigate("/pos")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((order) => {
            const tableStr = order.tableSession?.table ? `Table ${order.tableSession.table.tableNumber}` : "Takeaway";
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

            return (
              <Card
                key={order.id}
                className="hover:shadow-md transition-shadow"
                title={
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span className="font-mono text-sm font-bold">{order.orderNumber}</span>
                  </div>
                }
                action={
                  <Badge variant={getStatusBadgeVariant(order.status)} dot>
                    {order.status}
                  </Badge>
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
                    <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                      {tableStr}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Items preview */}
                  <div className="space-y-1 text-xs text-gray-700 min-h-[48px]">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span className="truncate">
                          {item.quantity}× {item.menuItem?.name}
                        </span>
                        <span className="font-mono text-gray-500">₹{Number(item.totalPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-[11px] text-gray-400 italic">
                        + {order.items.length - 3} more item(s)...
                      </p>
                    )}
                  </div>

                  {/* Financials */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 font-extrabold text-sm text-gray-900">
                    <span className="text-xs text-gray-500 font-normal">{itemCount} items</span>
                    <span className="text-emerald-600">₹{Number(order.total).toFixed(2)}</span>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Details
                    </Button>

                    <div className="flex items-center gap-1.5">
                      {order.status === "OPEN" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => generateKOTMutation.mutate(order.id)}
                          isLoading={generateKOTMutation.isPending}
                          icon={<ChefHat className="w-3.5 h-3.5 text-amber-600" />}
                        >
                          Send KOT
                        </Button>
                      )}

                      {order.status === "READY" && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => serveMutation.mutate(order.id)}
                          isLoading={serveMutation.isPending}
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Mark Served
                        </Button>
                      )}

                      {order.status !== "BILLED" && order.status !== "CANCELLED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => generateInvoiceMutation.mutate(order.id)}
                          isLoading={generateInvoiceMutation.isPending}
                        >
                          Generate Bill
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detailed Order Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order: ${selectedOrder.orderNumber}` : "Order Details"}
        maxWidth="md"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs bg-gray-50 p-3 rounded-xl">
              <div>
                <p className="text-gray-400">Destination:</p>
                <p className="font-bold text-gray-900">
                  {selectedOrder.tableSession?.table ? `Table ${selectedOrder.tableSession.table.tableNumber}` : "Takeaway / Walk-in"}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Status:</p>
                <Badge variant={getStatusBadgeVariant(selectedOrder.status)} dot>
                  {selectedOrder.status}
                </Badge>
              </div>
            </div>

            {/* Items list */}
            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 text-xs">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="p-3 flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">
                      {item.quantity}× {item.menuItem?.name}
                    </p>
                    {item.notes && <p className="text-[11px] text-amber-600 italic">Note: {item.notes}</p>}
                  </div>
                  <span className="font-bold text-gray-800">
                    ₹{Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Math breakdown */}
            <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900">₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
              </div>
              {Number(selectedOrder.discount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-₹{Number(selectedOrder.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-semibold text-gray-900">₹{Number(selectedOrder.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-200">
                <span>TOTAL:</span>
                <span className="text-emerald-600">₹{Number(selectedOrder.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              {selectedOrder.status !== "BILLED" && selectedOrder.status !== "CANCELLED" && (
                <button
                  onClick={() => {
                    if (confirm("Cancel this order?")) {
                      cancelMutation.mutate(selectedOrder.id);
                      setSelectedOrder(null);
                    }
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" /> Cancel Order
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
