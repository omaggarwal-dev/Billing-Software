import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Plus,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  Filter,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { EmployeeAdvance, Employee, PaymentMethod } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const AdvancesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const isManagerOrAdmin = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "HR", "ACCOUNTANT"].includes(user?.role || "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    employeeId: "",
    amount: 0,
    reason: "",
    paymentMethod: "CASH" as PaymentMethod,
    notes: "",
  });

  // Fetch Advances
  const { data: advances = [], isLoading: isLoadingAdvances } = useQuery<EmployeeAdvance[]>({
    queryKey: ["advances", selectedFranchiseId, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus) params.append("status", selectedStatus);
      const res = await api.get(`/advances?${params.toString()}`);
      return res.data.data;
    },
  });

  // Fetch Employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/employees");
      return res.data.data;
    },
  });

  // Create Advance Mutation
  const createAdvanceMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post("/advances", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      setIsModalOpen(false);
      setForm({
        employeeId: "",
        amount: 0,
        reason: "",
        paymentMethod: "CASH",
        notes: "",
      });
      setFormError(null);
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/advances/${id}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  // KPI Calculations
  const totalPending = advances
    .filter((a) => a.status === "PENDING")
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalApproved = advances
    .filter((a) => a.status === "APPROVED")
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const pendingCount = advances.filter((a) => a.status === "PENDING").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            Employee Advances & Loans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track mid-month salary disbursements, cash advances, and automatic payroll deductions.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          Issue Advance
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Pending Approval"
          value={`₹${totalPending.toLocaleString("en-IN")}`}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          subtitle={`${pendingCount} requests awaiting manager signoff`}
        />
        <StatCard
          title="Active Approved Advances"
          value={`₹${totalApproved.toLocaleString("en-IN")}`}
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
          subtitle="Auto-deducted at next monthly payroll"
        />
        <StatCard
          title="Total Advance Records"
          value={advances.length}
          icon={<Banknote className="w-5 h-5 text-emerald-600" />}
          subtitle="All recorded disbursements"
        />
      </div>

      {/* Filter Bar */}
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
              All Records
            </button>
            <button
              onClick={() => setSelectedStatus("PENDING")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedStatus === "PENDING" ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 text-amber-800 hover:bg-gray-200"
              }`}
            >
              Pending ({pendingCount})
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

      {/* Advances Table */}
      {isLoadingAdvances ? (
        <LoadingState message="Loading advance requests..." />
      ) : advances.length === 0 ? (
        <EmptyState
          title="No advances recorded"
          description="Click Issue Advance above to log mid-month salary disbursements."
          icon={<Banknote className="w-10 h-10 text-gray-400" />}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Reason / Purpose</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payroll Recovery</th>
                  {isManagerOrAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {advances.map((adv) => {
                  const empName = adv.employee
                    ? `${adv.employee.firstName} ${adv.employee.lastName || ""}`.trim()
                    : "Staff Member";

                  return (
                    <tr key={adv.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {new Date(adv.advanceDate || adv.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900">{empName}</span>
                        {adv.employee?.designation && (
                          <p className="text-xs text-indigo-600">{adv.employee.designation}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 font-mono">
                        ₹{Number(adv.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="gray">{adv.paymentMethod}</Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                        {adv.reason || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            adv.status === "APPROVED"
                              ? "success"
                              : adv.status === "PENDING"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {adv.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {adv.payrollId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Deducted
                          </span>
                        ) : adv.status === "APPROVED" ? (
                          <span className="text-xs text-amber-600 font-medium">Next Payroll Cycle</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {isManagerOrAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {adv.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => updateStatusMutation.mutate({ id: adv.id, status: "APPROVED" })}
                                isLoading={updateStatusMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => updateStatusMutation.mutate({ id: adv.id, status: "REJECTED" })}
                                isLoading={updateStatusMutation.isPending}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Issue Advance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Employee Salary Advance"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.employeeId || form.amount <= 0) {
              setFormError("Please select an employee and enter an advance amount.");
              return;
            }
            createAdvanceMutation.mutate(form);
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Employee *
            </label>
            <Select
              options={[
                { value: "", label: "-- Choose Employee --" },
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.firstName} ${e.lastName || ""} (${e.designation || e.employeeCode})`,
                })),
              ]}
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Advance Amount (₹) *
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              placeholder="e.g. 5000"
              leftIcon={<span className="text-gray-400 font-bold">₹</span>}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Payment Method *
            </label>
            <Select
              options={[
                { value: "CASH", label: "Cash (Petty Cash Drawer)" },
                { value: "UPI", label: "UPI / QR Code Transfer" },
                { value: "BANK_TRANSFER", label: "Bank Transfer / NEFT" },
                { value: "CHEQUE", label: "Cheque" },
              ]}
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
              className="w-full font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Reason / Notes
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={2}
              placeholder="e.g. Medical emergency advance, festival advance..."
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={createAdvanceMutation.isPending}
            >
              Issue Advance
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
