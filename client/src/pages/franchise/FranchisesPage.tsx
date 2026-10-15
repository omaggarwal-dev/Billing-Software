import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Receipt,
  Sparkles,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import type { Franchise, BrandSettings } from "../../types/index.js";
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
  const [previewBillFranchise, setPreviewBillFranchise] = useState<Franchise | null>(null);

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

  // Fetch brand settings for receipt preview
  const { data: brandSettings } = useQuery<BrandSettings>({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const res = await api.get("/brand-settings");
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
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.address && f.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currSym = brandSettings?.currencySymbol || brandSettings?.currency || "₹";
  const brandName = brandSettings?.businessName || "My Restaurant Brand";
  const gstin = brandSettings?.taxNumber;
  const fssai = brandSettings?.fssaiNumber;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Franchises & Branch Outlets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure multi-location branches. Each branch automatically prints its own unique physical address on customer bills and receipts.
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

      {/* Info Callout: Branch Bill Address Isolation */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-3 shadow-xs">
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block mb-0.5">Branch-Specific Invoicing & Distinct Addresses</span>
          <p className="text-slate-600 leading-relaxed">
            Every franchise branch you add here maintains its own physical street address and contact hotline. When cashiers or managers generate bills and thermal receipts at their franchise terminal, the receipt dynamically displays <strong>that franchise's distinct address</strong>.
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by franchise name, code, or branch address..."
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
          description="Create your first franchise branch to start configuring distinct addresses, tables, menus, and staff."
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
                  <span className="text-gray-400">BRANCH CODE:</span>
                  <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                    {franchise.code}
                  </span>
                </div>

                {/* Printed Address Card Highlight */}
                <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                    <span className="flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-amber-700" />
                      Printed On Bills:
                    </span>
                    <span className="text-[10px] bg-amber-200/80 px-1 rounded text-amber-950 font-medium">
                      Branch Address
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs leading-snug line-clamp-2">
                    {franchise.address ? (
                      franchise.address
                    ) : (
                      <span className="text-amber-700 italic">
                        ⚠️ No branch address set (falls back to Brand HQ)
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
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
                        <XCircle className="w-3.5 h-3.5" /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewBillFranchise(franchise)}
                      icon={<Receipt className="w-3.5 h-3.5 text-indigo-600" />}
                    >
                      Preview Bill
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(franchise)}
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                  </div>
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
        title={editingFranchise ? `Edit Franchise: ${editingFranchise.name}` : "Create Franchise Branch"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Franchise / Branch Name *"
            required
            placeholder="e.g. Grand Spice Kitchen - Downtown Branch"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            helperText="Public branch name printed under brand name on bills"
          />

          <Input
            label="Franchise Code *"
            required
            placeholder="e.g. GSP-DT-01"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            helperText="Unique uppercase identifier for this franchise unit"
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Branch Physical Address (Printed on Bills) *</span>
              <span className="text-[10px] text-indigo-600 font-bold lowercase">
                printed on customer receipts
              </span>
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
              rows={3}
              required
              placeholder="e.g. Shop #12, Ground Floor, Orion Mall, Brigade Road, Bangalore - 560025"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Every customer bill and thermal receipt issued by this franchise will print this unique physical branch address.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Branch Phone (Printed on Bills)"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              helperText="Printed on this branch's receipts"
            />

            <Input
              label="Branch Email Address"
              type="email"
              placeholder="branch@grandspice.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

      {/* Franchise Distinct Bill Preview Modal */}
      <Modal
        isOpen={!!previewBillFranchise}
        onClose={() => setPreviewBillFranchise(null)}
        title={`Receipt Preview: ${previewBillFranchise?.name || ""}`}
        maxWidth="sm"
      >
        {previewBillFranchise && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Bills generated by this branch automatically display this branch's distinct address.
              </span>
            </div>

            {/* Thermal Bill Mockup */}
            <div className="bg-[#fdfbf7] text-slate-800 font-mono text-xs rounded-xl border border-amber-200 p-5 shadow-inner space-y-3">
              <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                <h3 className="font-black text-sm uppercase text-slate-900 tracking-wide">
                  {brandName}
                </h3>
                <p className="font-bold text-xs uppercase text-indigo-900">
                  {previewBillFranchise.name}
                </p>
                <p className="text-[11px] text-slate-700 leading-snug font-medium pt-1">
                  {previewBillFranchise.address || "No address configured for this branch"}
                </p>
                <p className="text-[10px] text-slate-500">
                  Ph: {previewBillFranchise.phone || "N/A"}
                </p>
                {gstin && <p className="text-[10px] text-slate-600">GSTIN: {gstin}</p>}
                {fssai && <p className="text-[10px] text-slate-600">FSSAI: {fssai}</p>}
              </div>

              <div className="text-[10px] text-slate-500 space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>BILL NO: #INV-2026-0042</span>
                  <span>TABLE: T-02</span>
                </div>
                <div className="flex justify-between">
                  <span>BRANCH: {previewBillFranchise.code}</span>
                  <span>CASHIER: Branch Cashier</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-medium">
                  <span>1x Paneer Butter Masala</span>
                  <span>{currSym}340.00</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>2x Butter Garlic Naan</span>
                  <span>{currSym}140.00</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>1x Dum Biryani</span>
                  <span>{currSym}420.00</span>
                </div>
              </div>

              <div className="space-y-0.5 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{currSym}900.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (5%)</span>
                  <span>{currSym}45.00</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1">
                  <span>TOTAL PAYABLE</span>
                  <span>{currSym}945.00</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                <p className="font-bold text-slate-700">Thank you for visiting {previewBillFranchise.name}!</p>
                <p>Please Visit Again</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setPreviewBillFranchise(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
