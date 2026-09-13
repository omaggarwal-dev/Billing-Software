import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  Filter,
  Tag,
} from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Expense, ExpenseCategory, ExpenseStats, PaymentMethod } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const isManagerOrAccountant = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"].includes(user?.role || "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [form, setForm] = useState({
    categoryId: "",
    title: "",
    description: "",
    amount: 0,
    paymentMethod: "CASH" as PaymentMethod,
    notes: "",
  });

  const [newCatForm, setNewCatForm] = useState({
    name: "",
    description: "",
  });

  // Queries
  const { data: statsData } = useQuery<{ success: boolean; data: ExpenseStats }>({
    queryKey: ["expense-stats", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/expenses/stats");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: categoriesData } = useQuery<{ success: boolean; data: ExpenseCategory[] }>({
    queryKey: ["expense-categories", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/expenses/categories");
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  const { data: expensesData, isLoading } = useQuery<{ success: boolean; data: Expense[] }>({
    queryKey: ["expenses", selectedFranchiseId, selectedStatus],
    queryFn: async () => {
      const res = await api.get("/expenses", {
        params: { status: selectedStatus || undefined },
      });
      return res.data;
    },
    enabled: !!selectedFranchiseId,
  });

  // Mutations
  const expenseMutation = useMutation({
    mutationFn: async () => {
      await api.post("/expenses", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
      setIsModalOpen(false);
      setForm({
        categoryId: "",
        title: "",
        description: "",
        amount: 0,
        paymentMethod: "CASH",
        notes: "",
      });
    },
  });

  const catMutation = useMutation({
    mutationFn: async () => {
      await api.post("/expenses/categories", newCatForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setIsCatModalOpen(false);
      setNewCatForm({ name: "", description: "" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) => {
      await api.patch(`/expenses/${id}/review`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
    },
  });

  const categories = categoriesData?.data || [];
  const expenses = expensesData?.data || [];
  const stats = statsData?.data || { totalApproved: 0, pendingCount: 0, thisMonthApproved: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Unforeseen Expenses & Day-to-Day Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record petty cash, emergency maintenance, packaging, and store utility expenses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManagerOrAccountant && (
            <Button
              variant="outline"
              onClick={() => setIsCatModalOpen(true)}
              icon={<Tag className="w-4 h-4" />}
            >
              Add Category
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => {
              if (categories.length > 0 && !form.categoryId) {
                setForm((prev) => ({ ...prev, categoryId: categories[0].id }));
              }
              setIsModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Record Expense
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Approved Expenses"
          value={`₹${stats.totalApproved.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="This Month Approved"
          value={`₹${stats.thisMonthApproved.toLocaleString()}`}
          icon={<Calendar className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingCount}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          subtitle="Submitted by Cashier / Staff"
        />
      </div>

      {/* Filter bar */}
      <Card>
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedStatus("")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedStatus === "" ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setSelectedStatus("PENDING")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedStatus === "PENDING" ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 text-amber-800 hover:bg-gray-200"
              }`}
            >
              Pending ({stats.pendingCount})
            </button>
            <button
              onClick={() => setSelectedStatus("APPROVED")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedStatus === "APPROVED" ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-100 text-emerald-800 hover:bg-gray-200"
              }`}
            >
              Approved
            </button>
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      {isLoading ? (
        <LoadingState message="Loading expenses..." />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses recorded"
          description="Record daily petty cash or emergency repair expenses using the button above."
          icon={<Receipt className="w-10 h-10 text-gray-400" />}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-900">{exp.title}</span>
                      {exp.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{exp.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{exp.category?.name || "General"}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 font-mono">
                      ₹{Number(exp.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="gray">{exp.paymentMethod}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          exp.status === "APPROVED"
                            ? "success"
                            : exp.status === "PENDING"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {exp.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isManagerOrAccountant && exp.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => reviewMutation.mutate({ id: exp.id, status: "APPROVED" })}
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => reviewMutation.mutate({ id: exp.id, status: "REJECTED" })}
                            icon={<XCircle className="w-3.5 h-3.5" />}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Record Expense */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Unforeseen / Store Expense"
      >
        <div className="space-y-4">
          <Select
            label="Expense Category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          />

          <Input
            label="Expense Title"
            placeholder="e.g. Emergency sink plumbing repair"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (₹)"
              type="number"
              step="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
            <Select
              label="Paid By"
              options={[
                { value: "CASH", label: "💵 Cash" },
                { value: "UPI", label: "📱 UPI / QR" },
                { value: "CARD", label: "💳 Card" },
                { value: "OTHER", label: "Other" },
              ]}
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
            />
          </div>

          <Input
            label="Description / Purpose"
            placeholder="Optional detailed remarks or notes"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => expenseMutation.mutate()}
              isLoading={expenseMutation.isPending}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Submit Expense
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Category */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Add Expense Category"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Staff Welfare, Equipment Repair"
            value={newCatForm.name}
            onChange={(e) => setNewCatForm({ ...newCatForm, name: e.target.value })}
          />
          <Input
            label="Description"
            placeholder="Optional description"
            value={newCatForm.description}
            onChange={(e) => setNewCatForm({ ...newCatForm, description: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => catMutation.mutate()}
              isLoading={catMutation.isPending}
            >
              Save Category
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};