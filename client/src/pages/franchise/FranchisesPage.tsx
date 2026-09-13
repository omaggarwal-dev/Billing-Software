import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Search, Edit2, CheckCircle2, XCircle, Phone, Mail, MapPin } from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import type { Franchise } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge, getStatusBadgeVariant } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const FranchisesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch franchises
  const { data: franchises = [], isLoading } = useQuery<Franchise[]>({
    queryKey: ["franchises"],
    queryFn: async () => {
      const res = await api.get("/franchises");
      return res.data.data;
    },
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingFranchise) {
        return api.put(`/franchises/${editingFranchise.id}`, data);
      }
      return api.post("/franchises", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      queryClient.invalidateQueries({ queryKey: ["navbar-franchises"] });
      handleCloseModal();
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch(`/franchises/${id}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      queryClient.invalidateQueries({ queryKey: ["navbar-franchises"] });
    },
  });

  const handleOpenCreate = () => {
    setEditingFranchise(null);
    setFormData({ name: "", code: "", address: "", phone: "", email: "" });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (franchise: Franchise) => {
    setEditingFranchise(franchise);
    setFormData({
      name: franchise.name,
      code: franchise.code,
      address: franchise.address || "",
      phone: franchise.phone || "",
      email: franchise.email || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFranchise(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    saveMutation.mutate(formData);
  };

  const filtered = franchises.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Franchises</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage multi-unit restaurant locations, configurations, and active status
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
        >
          Add New Franchise
        </Button>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by franchise name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="max-w-md"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <LoadingState message="Loading franchises..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Franchises Found"
          description="Create your first franchise branch to start configuring tables, menus, and staff."
          actionLabel="Add Franchise"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((franchise) => (
            <Card
              key={franchise.id}
              className="hover:shadow-md transition-shadow"
              title={
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <span className="truncate">{franchise.name}</span>
                </div>
              }
              action={
                <Badge
                  variant={getStatusBadgeVariant(franchise.isActive ? "ACTIVE" : "INACTIVE")}
                  dot
                >
                  {franchise.isActive ? "Active" : "Inactive"}
                </Badge>
              }
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100 font-mono">
                  <span className="text-gray-400">CODE:</span>
                  <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                    {franchise.code}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
                  {franchise.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="truncate">{franchise.address}</span>
                    </div>
                  )}
                  {franchise.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{franchise.phone}</span>
                    </div>
                  )}
                  {franchise.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{franchise.email}</span>
                    </div>
                  )}
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50 rounded-xl text-center text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{franchise._count?.employees || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Staff</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{franchise._count?.tables || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Tables</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{franchise._count?.orders || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Orders</p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: franchise.id,
                        isActive: !franchise.isActive,
                      })
                    }
                    className={`text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                      franchise.isActive
                        ? "text-rose-600 hover:text-rose-700"
                        : "text-emerald-600 hover:text-emerald-700"
                    }`}
                  >
                    {franchise.isActive ? (
                      <>
                        <XCircle className="w-4 h-4" /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Activate
                      </>
                    )}
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(franchise)}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingFranchise ? "Edit Franchise" : "Create New Franchise"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Franchise Name *"
            required
            placeholder="e.g. Grand Spice Kitchen Downtown"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Franchise Code *"
            required
            placeholder="e.g. GSP-DT-01"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            helperText="Unique uppercase identifier for this franchise unit"
          />

          <Input
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="branch@grandspice.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Physical Address
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Unit #, Mall/Street name, City, State, PIN"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saveMutation.isPending}>
              {editingFranchise ? "Save Changes" : "Create Franchise"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
