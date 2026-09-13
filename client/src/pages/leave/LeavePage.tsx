import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { LeaveRequest, Employee } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const LeavePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const isManagerOrHR = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "HR"].includes(user?.role || "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reason: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/employees");
      return res.data.data;
    },
  });

  // Fetch leave requests
  const { data: leaves = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["leaves", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/leave");
      return res.data.data;
    },
  });

  // Create leave request mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return api.post("/leave", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/leave/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/leave/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
  });

  const handleOpenModal = () => {
    setFormData({
      employeeId: employees[0]?.id || "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      reason: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submit leave requests, view approvals, and automate roster attendance updates
          </p>
        </div>
        <Button onClick={handleOpenModal} variant="primary" icon={<Plus className="w-4 h-4" />}>
          Apply for Leave
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Loading leave requests..." />
      ) : leaves.length === 0 ? (
        <EmptyState
          title="No Leave Requests"
          description="Submit a leave request for staff time off or vacation."
          actionLabel="Apply for Leave"
          onAction={handleOpenModal}
        />
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Approver</th>
                  {isManagerOrHR && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {l.employee?.firstName} {l.employee?.lastName || ""}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{l.employee?.employeeCode}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {new Date(l.startDate).toLocaleDateString()} — {new Date(l.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {l.reason || "No reason provided"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusBadgeVariant(l.status)} dot>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {l.approvedBy || "—"}
                    </td>
                    {isManagerOrHR && (
                      <td className="px-6 py-4 text-right space-x-2">
                        {l.status === "PENDING" && (
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => approveMutation.mutate(l.id)}
                              isLoading={approveMutation.isPending}
                              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => rejectMutation.mutate(l.id)}
                              isLoading={rejectMutation.isPending}
                              icon={<XCircle className="w-3.5 h-3.5" />}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Leave Application Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Apply for Employee Leave"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Select
            label="Employee *"
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName || ""} (${e.employeeCode})`,
            }))}
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date *"
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="End Date *"
              type="date"
              required
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Reason for Leave *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Medical emergency, planned annual leave..."
              className="block w-full rounded-lg border border-gray-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
