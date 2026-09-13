import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Play, ShoppingCart, CheckCircle, RefreshCw } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { getSocket } from "../../services/socket.js";
import { useAuthStore } from "../../store/authStore.js";
import { useCartStore } from "../../store/cartStore.js";
import type { RestaurantTable } from "../../types/index.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const TablesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedFranchiseId, user } = useAuthStore();
  const setSelectedCartTable = useCartStore((state) => state.setSelectedTable);
  const canManage = ["SUPER_ADMIN", "FRANCHISE_MANAGER"].includes(user?.role || "");

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Tables
  const { data: tables = [], isLoading, refetch } = useQuery<RestaurantTable[]>({
    queryKey: ["tables", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/tables");
      return res.data.data;
    },
  });

  // Listen to live Socket.IO table events
  useEffect(() => {
    const socket = getSocket();
    const handleTableChange = () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    };

    socket.on("table:status_changed", handleTableChange);
    socket.on("table:session_opened", handleTableChange);
    socket.on("table:session_closed", handleTableChange);
    socket.on("table:created", handleTableChange);
    socket.on("table:updated", handleTableChange);

    return () => {
      socket.off("table:status_changed", handleTableChange);
      socket.off("table:session_opened", handleTableChange);
      socket.off("table:session_closed", handleTableChange);
      socket.off("table:created", handleTableChange);
      socket.off("table:updated", handleTableChange);
    };
  }, [queryClient]);

  // Create Table Mutation
  const createTableMutation = useMutation({
    mutationFn: async () => {
      return api.post("/tables", {
        tableNumber,
        capacity: Number(capacity),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setIsModalOpen(false);
      setTableNumber("");
      setCapacity(4);
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  // Open Session Mutation
  const openSessionMutation = useMutation({
    mutationFn: async (tableId: string) => {
      return api.post(`/tables/${tableId}/open-session`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err) => alert(extractErrorMessage(err)),
  });

  // Close Session Mutation
  const closeSessionMutation = useMutation({
    mutationFn: async (tableId: string) => {
      return api.post(`/tables/${tableId}/close-session`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err) => alert(extractErrorMessage(err)),
  });

  const handleOrderForTable = (table: RestaurantTable) => {
    setSelectedCartTable(table);
    navigate("/pos");
  };

  const filteredTables = tables.filter((t) =>
    statusFilter ? t.status === statusFilter : true
  );

  const availableCount = tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED" || t.status === "BILLING").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Floor Tables & Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time table occupancy, customer seating, session timers, and quick POS billing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {canManage && (
            <Button
              onClick={() => {
                setTableNumber(`T-${String(tables.length + 1).padStart(2, "0")}`);
                setFormError(null);
                setIsModalOpen(true);
              }}
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Table
            </Button>
          )}
        </div>
      </div>

      {/* Metric Pills & Status Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "" ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Tables ({tables.length})
          </button>
          <button
            onClick={() => setStatusFilter("AVAILABLE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "AVAILABLE"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Available ({availableCount})
          </button>
          <button
            onClick={() => setStatusFilter("OCCUPIED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "OCCUPIED"
                ? "bg-indigo-600 text-white"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            Occupied / Seated ({occupiedCount})
          </button>
          <button
            onClick={() => setStatusFilter("BILLING")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "BILLING"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Billing ({tables.filter((t) => t.status === "BILLING").length})
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <LoadingState message="Loading restaurant floor map..." />
      ) : filteredTables.length === 0 ? (
        <EmptyState
          title="No Tables Configured"
          description="Add restaurant tables to start seating customers and recording dine-in orders."
          actionLabel="Add First Table"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredTables.map((table) => {
            const activeSession = table.sessions?.find((s) => !s.endedAt);
            const activeOrders = activeSession?.orders || [];
            const activeOrdersCount = activeOrders.length;
            const currentSubtotal = activeOrders.reduce((sum, o) => sum + Number(o.total), 0);

            const isAvailable = table.status === "AVAILABLE";
            const isOccupied = table.status === "OCCUPIED";
            const isBilling = table.status === "BILLING";

            return (
              <div
                key={table.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-xs ${
                  isAvailable
                    ? "bg-white border-gray-200/80 hover:border-emerald-300"
                    : isOccupied
                    ? "bg-indigo-50/40 border-indigo-200 shadow-indigo-100/50"
                    : isBilling
                    ? "bg-amber-50/40 border-amber-200 shadow-amber-100/50"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">
                        Table {table.tableNumber}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Up to {table.capacity} Guests</span>
                      </p>
                    </div>

                    <Badge variant={getStatusBadgeVariant(table.status)} dot>
                      {table.status}
                    </Badge>
                  </div>

                  {/* Active Session telemetry */}
                  {activeSession && (
                    <div className="my-3 p-3 bg-white rounded-xl border border-gray-100 text-xs space-y-1.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Seated at:</span>
                        <span className="font-semibold text-gray-800">
                          {new Date(activeSession.startedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Active Orders:</span>
                        <span className="font-semibold text-indigo-600">
                          {activeOrdersCount} order(s)
                        </span>
                      </div>
                      {currentSubtotal > 0 && (
                        <div className="flex justify-between text-gray-700 font-bold pt-1 border-t border-gray-50">
                          <span>Current Bill:</span>
                          <span className="text-emerald-600">
                            ₹{currentSubtotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Bar */}
                <div className="pt-3 border-t border-gray-100/80 mt-2 flex flex-col gap-2">
                  {isAvailable ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openSessionMutation.mutate(table.id)}
                        isLoading={openSessionMutation.isPending}
                        icon={<Play className="w-3 h-3" />}
                      >
                        Seat Guest
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleOrderForTable(table)}
                        icon={<ShoppingCart className="w-3 h-3" />}
                      >
                        Take Order
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleOrderForTable(table)}
                        icon={<ShoppingCart className="w-3 h-3" />}
                      >
                        Add Items
                      </Button>
                      {isBilling || activeOrdersCount === 0 ? (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => closeSessionMutation.mutate(table.id)}
                          isLoading={closeSessionMutation.isPending}
                          icon={<CheckCircle className="w-3 h-3" />}
                        >
                          Free Table
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/billing")}
                        >
                          View Bill
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Restaurant Table"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createTableMutation.mutate();
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Table Number / Name *"
            required
            placeholder="e.g. T-01, VIP-1, Outdoor-4"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value.toUpperCase())}
          />

          <Input
            label="Seating Capacity (Guests) *"
            type="number"
            min="1"
            max="50"
            required
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createTableMutation.isPending}>
              Create Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
