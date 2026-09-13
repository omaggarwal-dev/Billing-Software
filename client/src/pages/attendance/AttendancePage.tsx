import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, Calendar, LogIn, LogOut } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Attendance, AttendanceStatus, Employee } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "On Leave" },
  { value: "HOLIDAY", label: "Holiday" },
];

export const AttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId } = useAuthStore();

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    status: "PRESENT" as AttendanceStatus,
    checkIn: "",
    checkOut: "",
    notes: "",
  });

  // Fetch employees for dropdowns
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/employees");
      return res.data.data;
    },
  });

  // Fetch attendance list
  const { data: records = [], isLoading } = useQuery<Attendance[]>({
    queryKey: ["attendance", selectedFranchiseId, dateFilter, employeeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter) {
        params.append("startDate", dateFilter);
        params.append("endDate", dateFilter);
      }
      if (employeeFilter) {
        params.append("employeeId", employeeFilter);
      }
      const res = await api.get(`/attendance?${params.toString()}`);
      return res.data.data;
    },
  });

  // Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return api.post("/attendance/check-in", { employeeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Check-Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return api.post("/attendance/check-out", { employeeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Manual Record Mutation
  const recordMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        employeeId: data.employeeId,
        date: data.date,
        status: data.status,
        notes: data.notes || null,
      };
      if (data.checkIn) payload.checkIn = new Date(`${data.date}T${data.checkIn}`).toISOString();
      if (data.checkOut) payload.checkOut = new Date(`${data.date}T${data.checkOut}`).toISOString();
      return api.post("/attendance", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  const handleOpenModal = () => {
    setFormData({
      employeeId: employees[0]?.id || "",
      date: dateFilter,
      status: "PRESENT",
      checkIn: "09:00",
      checkOut: "18:00",
      notes: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    recordMutation.mutate(formData);
  };

  // Find attendance for an employee for quick check-in check-out
  const getEmployeeRecord = (empId: string) => records.find((r) => r.employeeId === empId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track daily check-ins, check-outs, shifts, and attendance logs
          </p>
        </div>
        <Button onClick={handleOpenModal} variant="primary" icon={<Plus className="w-4 h-4" />}>
          Manual Attendance Entry
        </Button>
      </div>

      {/* Date & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-gray-500" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        <Select
          options={[
            { value: "", label: "All Staff Members" },
            ...employees.map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName || ""} (${e.employeeCode})`,
            })),
          ]}
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* Quick Attendance Check-in Roster */}
      <Card
        title="Today's Shift Roster & Quick Punch"
        subtitle="Quick check-in & check-out for staff on duty"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const record = getEmployeeRecord(emp.id);
            const isCheckedIn = !!record?.checkIn;
            const isCheckedOut = !!record?.checkOut;

            return (
              <div
                key={emp.id}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {emp.firstName} {emp.lastName || ""}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{emp.employeeCode} • {emp.designation || "Staff"}</p>
                  </div>
                  {record ? (
                    <Badge variant={getStatusBadgeVariant(record.status)}>
                      {record.status}
                    </Badge>
                  ) : (
                    <Badge variant="gray">NOT MARKED</Badge>
                  )}
                </div>

                {record && (
                  <div className="text-xs text-gray-600 space-y-1 mb-3 bg-gray-50 p-2.5 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Check In:</span>
                      <span className="font-semibold text-gray-800">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Check Out:</span>
                      <span className="font-semibold text-gray-800">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {!isCheckedIn ? (
                    <Button
                      size="sm"
                      variant="success"
                      className="w-full"
                      onClick={() => checkInMutation.mutate(emp.id)}
                      isLoading={checkInMutation.isPending}
                      icon={<LogIn className="w-3.5 h-3.5" />}
                    >
                      Check In
                    </Button>
                  ) : !isCheckedOut ? (
                    <Button
                      size="sm"
                      variant="danger"
                      className="w-full"
                      onClick={() => checkOutMutation.mutate(emp.id)}
                      isLoading={checkOutMutation.isPending}
                      icon={<LogOut className="w-3.5 h-3.5" />}
                    >
                      Check Out
                    </Button>
                  ) : (
                    <div className="w-full text-center text-xs font-semibold text-emerald-600 py-1 bg-emerald-50 rounded-lg flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Shift Completed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detailed Attendance Log */}
      {isLoading ? (
        <LoadingState message="Loading attendance logs..." />
      ) : records.length === 0 ? (
        <EmptyState
          title="No Attendance Records"
          description="No attendance entries recorded for the selected date filter."
          actionLabel="Add Record"
          onAction={handleOpenModal}
        />
      ) : (
        <Card title="Attendance Logs" subtitle={`Showing logs for ${dateFilter}`} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Check-In</th>
                  <th className="px-6 py-4">Check-Out</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {r.employee?.firstName} {r.employee?.lastName || ""}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{r.employee?.employeeCode}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusBadgeVariant(r.status)} dot>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 italic">
                      {r.notes || "No notes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Manual Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Manual Attendance Entry"
        maxWidth="md"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
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

          <Input
            label="Date *"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />

          <Select
            label="Status *"
            options={ATTENDANCE_STATUSES}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as AttendanceStatus })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Check-In Time"
              type="time"
              value={formData.checkIn}
              onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
            />
            <Input
              label="Check-Out Time"
              type="time"
              value={formData.checkOut}
              onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
            />
          </div>

          <Input
            label="Notes"
            placeholder="e.g. Approved half-day, morning medical emergency"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={recordMutation.isPending}>
              Save Attendance
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
