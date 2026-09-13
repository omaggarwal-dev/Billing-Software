import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Phone, Mail, Calendar, DollarSign } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Employee, EmployeeStatus } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "TERMINATED", label: "Terminated" },
];

export const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    employeeCode: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    designation: "",
    joiningDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE" as EmployeeStatus,
    basicSalary: 25000,
    allowances: 3000,
    overtimeRate: 150,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Employees
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/employees");
      return res.data.data;
    },
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone || null,
        email: data.email || null,
        designation: data.designation || null,
        joiningDate: data.joiningDate,
        status: data.status,
        salaryStructure: {
          basicSalary: Number(data.basicSalary) || 0,
          allowances: Number(data.allowances) || 0,
          overtimeRate: Number(data.overtimeRate) || 0,
        },
      };

      if (editingEmployee) {
        return api.put(`/employees/${editingEmployee.id}`, payload);
      }
      return api.post("/employees", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      handleCloseModal();
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({
      employeeCode: `EMP-${String(employees.length + 1).padStart(3, "0")}`,
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      designation: "Waiter",
      joiningDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE",
      basicSalary: 25000,
      allowances: 3000,
      overtimeRate: 150,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName || "",
      phone: emp.phone || "",
      email: emp.email || "",
      designation: emp.designation || "",
      joiningDate: new Date(emp.joiningDate).toISOString().split("T")[0],
      status: emp.status,
      basicSalary: Number(emp.salaryStructure?.basicSalary) || 0,
      allowances: Number(emp.salaryStructure?.allowances) || 0,
      overtimeRate: Number(emp.salaryStructure?.overtimeRate) || 0,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    saveMutation.mutate(formData);
  };

  const filtered = employees.filter((e) => {
    const matchesSearch =
      e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.designation || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? e.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage staff directory, designations, and salary structures
          </p>
        </div>
        <Button onClick={handleOpenCreate} variant="primary" icon={<Plus className="w-4 h-4" />}>
          Add Employee
        </Button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by code, name, designation..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="w-full sm:max-w-md"
        />

        <Select
          options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Loading staff directory..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Employees Found"
          description="Add employees to track daily attendance, leave requests, and calculate monthly payroll."
          actionLabel="Add Employee"
          onAction={handleOpenCreate}
        />
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Basic Salary</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {emp.firstName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {emp.firstName} {emp.lastName || ""}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Joined {new Date(emp.joiningDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-xs text-indigo-600">
                      {emp.employeeCode}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {emp.designation || "Staff"}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 space-y-1">
                      {emp.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{emp.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-emerald-600">
                        ₹{Number(emp.salaryStructure?.basicSalary || 0).toLocaleString("en-IN")}
                      </span>
                      {emp.salaryStructure?.allowances && Number(emp.salaryStructure.allowances) > 0 && (
                        <span className="text-[10px] text-gray-400 block">
                          + ₹{Number(emp.salaryStructure.allowances).toLocaleString("en-IN")} allowances
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusBadgeVariant(emp.status)} dot>
                        {emp.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(emp)}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingEmployee ? "Edit Employee" : "Add New Employee"}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Employee Code *"
              required
              placeholder="e.g. EMP-001"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })}
            />

            <Select
              label="Status *"
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as EmployeeStatus })}
            />

            <Input
              label="First Name *"
              required
              placeholder="e.g. Amit"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />

            <Input
              label="Last Name"
              placeholder="e.g. Kumar"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />

            <Input
              label="Designation / Role"
              placeholder="e.g. Head Chef, Waiter, Cashier"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />

            <Input
              label="Joining Date *"
              type="date"
              required
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            />

            <Input
              label="Phone Number"
              placeholder="+91 99887 76655"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="amit@restaurant.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* Salary Structure Section */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Salary Structure (Monthly)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Basic Salary (₹) *"
                type="number"
                min="0"
                required
                value={formData.basicSalary}
                onChange={(e) => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
              />

              <Input
                label="Allowances (₹)"
                type="number"
                min="0"
                value={formData.allowances}
                onChange={(e) => setFormData({ ...formData, allowances: Number(e.target.value) })}
              />

              <Input
                label="Overtime Rate (₹/hr)"
                type="number"
                min="0"
                value={formData.overtimeRate}
                onChange={(e) => setFormData({ ...formData, overtimeRate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saveMutation.isPending}>
              {editingEmployee ? "Save Changes" : "Create Employee"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
