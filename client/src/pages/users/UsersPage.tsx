import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Shield, Building } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { User, UserRole, Franchise } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "FRANCHISE_MANAGER", label: "Franchise Manager" },
  { value: "CASHIER", label: "Cashier" },
  { value: "CHEF", label: "Chef (Kitchen Display)" },
  { value: "WAITER", label: "Waiter (Table Ordering)" },
  { value: "HR", label: "HR / Attendance Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, selectedFranchiseId } = useAuthStore();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
    franchiseId: string;
  }>({
    name: "",
    email: "",
    password: "",
    role: "CASHIER",
    franchiseId: selectedFranchiseId || currentUser?.franchiseId || "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users", selectedFranchiseId],
    queryFn: async () => {
      const url = selectedFranchiseId ? `/users?franchiseId=${selectedFranchiseId}` : "/users";
      const res = await api.get(url);
      return res.data.data;
    },
  });

  // Fetch Franchises (for dropdown if Super Admin)
  const { data: franchises = [] } = useQuery<Franchise[]>({
    queryKey: ["franchises"],
    queryFn: async () => {
      const res = await api.get("/franchises");
      return res.data.data;
    },
    enabled: isSuperAdmin,
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingUser) {
        const payload: any = { name: data.name, email: data.email, role: data.role };
        if (data.password) payload.password = data.password;
        if (isSuperAdmin) payload.franchiseId = data.franchiseId || null;
        return api.put(`/users/${editingUser.id}`, payload);
      }
      return api.post("/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      handleCloseModal();
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch(`/users/${id}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "CASHIER",
      franchiseId: selectedFranchiseId || currentUser?.franchiseId || (franchises[0]?.id ?? ""),
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      franchiseId: user.franchiseId || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    saveMutation.mutate(formData);
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.franchise?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Users & Staff Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage system logins, franchise managers, role permissions, and user accounts
          </p>
        </div>
        <Button onClick={handleOpenCreate} variant="primary" icon={<Plus className="w-4 h-4" />}>
          Add User Account
        </Button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by name, email, or franchise..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="w-full sm:max-w-md"
        />

        <Select
          options={[
            { value: "", label: "All Roles" },
            ...AVAILABLE_ROLES.map((r) => ({ value: r.value, label: r.label })),
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      {/* Users Table */}
      {isLoading ? (
        <LoadingState message="Loading user accounts..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Users Found"
          description="Create staff login accounts to grant access to the POS, Kitchen display, or manager portal."
          actionLabel="Add User"
          onAction={handleOpenCreate}
        />
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assigned Franchise</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="primary" size="md">
                        <Shield className="w-3 h-3 mr-1" />
                        {user.role.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.franchise ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          <span>{user.franchise.name}</span>
                          <span className="text-gray-400 font-mono">({user.franchise.code})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">System Global (Super Admin)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={getStatusBadgeVariant(user.isActive ? "ACTIVE" : "INACTIVE")}
                        dot
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(user)}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() =>
                            toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive })
                          }
                          className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                            user.isActive
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
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
        title={editingUser ? "Edit User Account" : "Create User Account"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Full Name *"
            required
            placeholder="e.g. Rahul Verma"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Email Address *"
            type="email"
            required
            placeholder="rahul@restaurant.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label={editingUser ? "New Password (leave blank to keep existing)" : "Password *"}
            type="password"
            required={!editingUser}
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            helperText="Minimum 6 characters"
          />

          <Select
            label="System Role *"
            options={AVAILABLE_ROLES}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
          />

          {isSuperAdmin && (
            <Select
              label="Assigned Franchise Branch *"
              options={[
                { value: "", label: "Select a franchise" },
                ...franchises.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
              ]}
              value={formData.franchiseId}
              onChange={(e) => setFormData({ ...formData, franchiseId: e.target.value })}
            />
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saveMutation.isPending}>
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
