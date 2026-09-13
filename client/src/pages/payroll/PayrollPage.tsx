import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, CheckCircle2, Lock, Eye } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Payroll } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PayrollPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId, user } = useAuthStore();
  const canManage = ["SUPER_ADMIN", "FRANCHISE_MANAGER", "ACCOUNTANT"].includes(user?.role || "");

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [generateData, setGenerateData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  // Fetch Payroll list
  const { data: payrolls = [], isLoading } = useQuery<Payroll[]>({
    queryKey: ["payrolls", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/payroll");
      return res.data.data;
    },
  });

  // Fetch Selected Payroll Details
  const { data: detailedPayroll, isLoading: isLoadingDetail } = useQuery<Payroll>({
    queryKey: ["payroll-detail", selectedPayrollId],
    queryFn: async () => {
      const res = await api.get(`/payroll/${selectedPayrollId}`);
      return res.data.data;
    },
    enabled: !!selectedPayrollId,
  });

  // Generate Payroll mutation
  const generateMutation = useMutation({
    mutationFn: async (data: typeof generateData) => {
      return api.post("/payroll/generate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      setIsGenerateModalOpen(false);
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/payroll/${id}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-detail", selectedPayrollId] });
    },
  });

  // Mark Paid mutation
  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/payroll/${id}/pay`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-detail", selectedPayrollId] });
    },
  });

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    generateMutation.mutate(generateData);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll & Salary</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate monthly salary calculations, attendance deductions, finalization, and disbursements
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsGenerateModalOpen(true)}
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
          >
            Generate Monthly Payroll
          </Button>
        )}
      </div>

      {/* Payrolls List */}
      {isLoading ? (
        <LoadingState message="Loading payroll records..." />
      ) : payrolls.length === 0 ? (
        <EmptyState
          title="No Payrolls Generated"
          description="Generate payroll for the current or previous month based on recorded employee salaries and attendance."
          actionLabel="Generate Payroll"
          onAction={() => setIsGenerateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {payrolls.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-md transition-shadow"
              title={
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span>
                    {MONTH_NAMES[p.month - 1]} {p.year}
                  </span>
                </div>
              }
              action={
                <Badge variant={getStatusBadgeVariant(p.status)} dot>
                  {p.status}
                </Badge>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50 rounded-xl text-center text-xs">
                  <div>
                    <p className="font-bold text-gray-700">₹{Number(p.totalGross).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Gross</p>
                  </div>
                  <div>
                    <p className="font-bold text-rose-600">-₹{Number(p.totalDeductions).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Deductions</p>
                  </div>
                  <div>
                    <p className="font-bold text-emerald-600">₹{Number(p.totalNet).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Net Pay</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">
                    {p._count?.items || 0} Staff payslips
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPayrollId(p.id)}
                    icon={<Eye className="w-3.5 h-3.5" />}
                  >
                    View Payslips
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Payroll Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Payroll"
        maxWidth="sm"
      >
        <form onSubmit={handleGenerateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Select
            label="Month *"
            options={MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name }))}
            value={generateData.month}
            onChange={(e) => setGenerateData({ ...generateData, month: parseInt(e.target.value, 10) })}
          />

          <Select
            label="Year *"
            options={[2024, 2025, 2026, 2027].map((y) => ({ value: y, label: String(y) }))}
            value={generateData.year}
            onChange={(e) => setGenerateData({ ...generateData, year: parseInt(e.target.value, 10) })}
          />

          <p className="text-xs text-gray-500 bg-indigo-50 p-3 rounded-lg border border-indigo-100 leading-relaxed">
            ℹ️ Generates gross and net calculations using active salary structures and automatically calculates deductions from recorded unexcused absences.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={generateMutation.isPending}>
              Generate Payroll
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detailed Payroll Modal */}
      <Modal
        isOpen={!!selectedPayrollId}
        onClose={() => setSelectedPayrollId(null)}
        title={
          detailedPayroll
            ? `Payroll: ${MONTH_NAMES[detailedPayroll.month - 1]} ${detailedPayroll.year}`
            : "Payroll Details"
        }
        maxWidth="4xl"
      >
        {isLoadingDetail || !detailedPayroll ? (
          <LoadingState message="Loading payslips breakdown..." />
        ) : (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900 text-white rounded-xl">
              <div>
                <p className="text-xs text-slate-400">Total Gross</p>
                <p className="text-lg font-bold">₹{Number(detailedPayroll.totalGross).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Deductions</p>
                <p className="text-lg font-bold text-rose-400">-₹{Number(detailedPayroll.totalDeductions).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Net Payable</p>
                <p className="text-lg font-bold text-emerald-400">₹{Number(detailedPayroll.totalNet).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <Badge variant={getStatusBadgeVariant(detailedPayroll.status)} size="md" dot>
                  {detailedPayroll.status}
                </Badge>
              </div>
            </div>

            {/* Payslips Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Basic</th>
                    <th className="px-4 py-3">Allowances</th>
                    <th className="px-4 py-3">Bonus</th>
                    <th className="px-4 py-3">Deductions</th>
                    <th className="px-4 py-3">Advance</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Net Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailedPayroll.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.employee?.firstName} {item.employee?.lastName || ""}
                        <span className="block text-[10px] text-gray-400 font-mono">
                          {item.employee?.employeeCode} • {item.employee?.designation || "Staff"}
                        </span>
                      </td>
                      <td className="px-4 py-3">₹{Number(item.basicSalary).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">₹{Number(item.allowances).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-emerald-600">₹{Number(item.bonus).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-rose-600">-₹{Number(item.deductions).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-amber-600">-₹{Number(item.advance).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700 text-sm">
                        ₹{Number(item.netSalary).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                {detailedPayroll.status === "DRAFT" && (
                  <Button
                    variant="primary"
                    onClick={() => finalizeMutation.mutate(detailedPayroll.id)}
                    isLoading={finalizeMutation.isPending}
                    icon={<Lock className="w-4 h-4" />}
                  >
                    Finalize Payroll
                  </Button>
                )}
                {detailedPayroll.status === "FINALIZED" && (
                  <Button
                    variant="success"
                    onClick={() => payMutation.mutate(detailedPayroll.id)}
                    isLoading={payMutation.isPending}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Mark as Paid & Disbursed
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
