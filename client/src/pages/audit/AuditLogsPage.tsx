import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Search, Eye, User as UserIcon, Building } from "lucide-react";
import { api } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { AuditLog } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const AuditLogsPage: React.FC = () => {
  const { selectedFranchiseId } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch Audit Logs
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs", selectedFranchiseId, entityFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityFilter) params.append("entity", entityFilter);
      if (searchTerm) params.append("action", searchTerm);
      const res = await api.get(`/audit-logs?${params.toString()}`);
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Security & Operational Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable trace of system events, financial payments, orders, user role changes, and payroll approvals
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search actions (e.g. CREATE_ORDER, RECORD_PAYMENT)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="w-full sm:max-w-md"
        />

        <Select
          options={[
            { value: "", label: "All Entities" },
            { value: "Order", label: "Orders" },
            { value: "Invoice", label: "Invoices" },
            { value: "Payment", label: "Payments" },
            { value: "KOT", label: "KOTs" },
            { value: "Employee", label: "Employees" },
            { value: "Payroll", label: "Payrolls" },
            { value: "Attendance", label: "Attendance" },
            { value: "LeaveRequest", label: "Leaves" },
            { value: "Franchise", label: "Franchises" },
            { value: "User", label: "Users" },
          ]}
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Loading audit trails..." />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Audit Logs Found"
          description="System events and mutations will appear here automatically."
        />
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity</th>
                  <th className="px-6 py-4">Triggered By</th>
                  <th className="px-6 py-4">Franchise</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="primary">{log.entity}</Badge>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {log.user ? (
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                          <span>{log.user.name}</span>
                          <span className="text-gray-400">({log.user.role})</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">System Automation</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {log.franchise ? (
                        <div className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          <span>{log.franchise.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Global</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inspect Log Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Inspection"
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl">
              <div>
                <span className="text-gray-400">Action:</span>
                <p className="font-bold text-gray-900 font-mono mt-0.5">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-gray-400">Entity & ID:</span>
                <p className="font-bold text-gray-900 font-mono mt-0.5">
                  {selectedLog.entity} ({selectedLog.entityId || "N/A"})
                </p>
              </div>
            </div>

            {/* Old Data vs New Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Previous State (Old)
                </p>
                <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60">
                  {selectedLog.oldData
                    ? JSON.stringify(selectedLog.oldData, null, 2)
                    : "null"}
                </pre>
              </div>

              <div>
                <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  New State (Mutated)
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60">
                  {selectedLog.newData
                    ? JSON.stringify(selectedLog.newData, null, 2)
                    : "null"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
