import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  DollarSign,
  Printer,
  CheckCircle2,
  Eye,
  MapPin,
  Store,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Invoice, PaymentMethod, BrandSettings } from "../../types/index.js";
import { Card } from "../../components/common/Card.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { Modal } from "../../components/common/Modal.js";
import { Badge } from "../../components/common/Badge.js";
import { LoadingState } from "../../components/common/LoadingState.js";
import { EmptyState } from "../../components/common/EmptyState.js";

export const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedFranchiseId } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activePrintInvoice, setActivePrintInvoice] = useState<Invoice | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>("CASH");
  const [singleAmount, setSingleAmount] = useState<number>(0);
  const [singleTxnId, setSingleTxnId] = useState("");

  const [splits, setSplits] = useState<
    { method: PaymentMethod; amount: number; transactionId: string }[]
  >([
    { method: "CASH", amount: 0, transactionId: "" },
    { method: "UPI", amount: 0, transactionId: "" },
  ]);

  const [formError, setFormError] = useState<string | null>(null);

  // Receipt Modal State
  const [printPayload, setPrintPayload] = useState<string | null>(null);

  // Fetch Invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/billing/invoices");
      return res.data.data;
    },
  });

  // Fetch Brand Settings for receipt printing
  const { data: brandSettings } = useQuery<BrandSettings>({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const res = await api.get("/brand-settings");
      return res.data.data;
    },
  });

  // Process Payment Mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice) throw new Error("No invoice selected");

      if (isSplitMode) {
        const validSplits = splits.filter((s) => s.amount > 0);
        if (validSplits.length === 0) {
          throw new Error("Enter amounts for split payment");
        }
        const totalSplit = validSplits.reduce((sum, s) => sum + s.amount, 0);
        const rem = paymentInvoice.remainingBalance ?? Number(paymentInvoice.total);
        if (totalSplit > rem + 0.01) {
          throw new Error(`Total split payment (₹${totalSplit}) exceeds remaining balance (₹${rem})`);
        }

        const res = await api.post(`/billing/invoices/${paymentInvoice.id}/payments/split`, {
          payments: validSplits,
        });
        return res.data.data;
      } else {
        if (singleAmount <= 0) throw new Error("Payment amount must be greater than 0");
        const res = await api.post(`/billing/invoices/${paymentInvoice.id}/payments`, {
          amount: singleAmount,
          method: singleMethod,
          transactionId: singleTxnId || undefined,
        });
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setIsPaymentModalOpen(false);
      setPaymentInvoice(null);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Print Receipt Mutation
  const printMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      setActivePrintInvoice(invoice);
      const res = await api.post("/printers/print-job", {
        type: "RECEIPT",
        targetId: invoice.id,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setPrintPayload(data.rawText);
    },
    onError: (err) => alert(extractErrorMessage(err)),
  });

  const handleOpenPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
    const paid =
      inv.payments
        ?.filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const remaining = Math.max(0, Number(inv.total) - paid);

    setSingleAmount(remaining);
    setSingleMethod("CASH");
    setSingleTxnId("");
    setSplits([
      { method: "CASH", amount: remaining, transactionId: "" },
      { method: "UPI", amount: 0, transactionId: "" },
    ]);
    setFormError(null);
    setIsPaymentModalOpen(true);
  };

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.order?.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.franchise?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.franchise?.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currSym = brandSettings?.currencySymbol || brandSettings?.currency || "₹";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Billing & Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Process payments, split bills, and print thermal receipts with franchise-specific branch addresses.
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by invoice #, order #, branch name, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          className="w-full sm:max-w-md"
        />
      </div>

      {/* Invoices Table */}
      {isLoading ? (
        <LoadingState message="Loading invoices & payments..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Invoices Found"
          description="Invoices will appear here once generated from the POS terminal or Orders view."
        />
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Branch & Bill Address</th>
                  <th className="px-6 py-4">Order & Table</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Paid Amount</th>
                  <th className="px-6 py-4">Payment Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((inv) => {
                  const totalPaid =
                    inv.payments
                      ?.filter((p) => p.status === "COMPLETED")
                      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
                  const isPaid = totalPaid >= Number(inv.total) - 0.01;
                  const tableStr = inv.order?.tableSession?.table
                    ? `Table ${inv.order.tableSession.table.tableNumber}`
                    : "Takeaway";

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-indigo-600">
                        {inv.invoiceNumber}
                      </td>

                      {/* Branch & Printed Bill Address */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{inv.franchise?.name || "Main Outlet"}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{inv.franchise?.address || "HQ Address"}</span>
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{inv.order?.orderNumber}</p>
                        <span className="text-xs text-gray-500">{tableStr}</span>
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 font-black text-gray-900">
                        {currSym}{Number(inv.total).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 font-semibold text-emerald-600">
                        {currSym}{totalPaid.toFixed(2)}
                      </td>

                      <td className="px-6 py-4">
                        <Badge variant={isPaid ? "success" : "warning"} dot>
                          {isPaid ? "PAID" : "PENDING PAYMENT"}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-right space-x-2">
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleOpenPayment(inv)}
                            icon={<DollarSign className="w-3.5 h-3.5" />}
                          >
                            Collect Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printMutation.mutate(inv)}
                          icon={<Printer className="w-3.5 h-3.5" />}
                        >
                          Receipt
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedInvoice(inv)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Collect / Split Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={paymentInvoice ? `Collect Payment: ${paymentInvoice.invoiceNumber}` : "Payment"}
        maxWidth="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          {paymentInvoice && (
            <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-sm border border-gray-100">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Branch: {paymentInvoice.franchise?.name || "Main Outlet"}</span>
                <span>Order: {paymentInvoice.order?.orderNumber}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-gray-900 pt-1">
                <span>Total Invoice Due:</span>
                <span className="text-base text-emerald-600">
                  {currSym}{Number(paymentInvoice.total).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Toggle Split Payment */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div>
              <p className="text-xs font-semibold text-indigo-950">Split Payment Across Modes</p>
              <p className="text-[11px] text-gray-500">Divide balance between Cash, Card, UPI, etc.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSplitMode(!isSplitMode)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isSplitMode
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              {isSplitMode ? "Split Mode ON" : "Single Mode"}
            </button>
          </div>

          {!isSplitMode ? (
            <div className="space-y-3">
              <Select
                label="Payment Method"
                value={singleMethod}
                onChange={(e) => setSingleMethod(e.target.value as PaymentMethod)}
                options={[
                  { value: "CASH", label: "Cash" },
                  { value: "UPI", label: "UPI / QR Code" },
                  { value: "CARD", label: "Credit / Debit Card" },
                  { value: "OTHER", label: "Other / Wallet" },
                ]}
              />

              <Input
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                value={singleAmount}
                onChange={(e) => setSingleAmount(parseFloat(e.target.value) || 0)}
              />

              {singleMethod !== "CASH" && (
                <Input
                  label="Transaction / Reference ID (Optional)"
                  placeholder="e.g. UPI Ref / Txn ID"
                  value={singleTxnId}
                  onChange={(e) => setSingleTxnId(e.target.value)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {splits.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">
                      Split #{idx + 1}: {s.method}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-32 bg-white border border-gray-300 rounded px-2 py-1 text-right text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={s.amount}
                      onChange={(e) => {
                        const updated = [...splits];
                        updated[idx].amount = parseFloat(e.target.value) || 0;
                        setSplits(updated);
                      }}
                    />
                  </div>
                  {s.method !== "CASH" && (
                    <input
                      type="text"
                      placeholder="Transaction / Ref ID"
                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={s.transactionId}
                      onChange={(e) => {
                        const updated = [...splits];
                        updated[idx].transactionId = e.target.value;
                        setSplits(updated);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => payMutation.mutate()}
              isLoading={payMutation.isPending}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Complete Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receipt Thermal Printer Preview & Physical Print Modal */}
      <Modal
        isOpen={!!printPayload}
        onClose={() => {
          setPrintPayload(null);
          setActivePrintInvoice(null);
        }}
        title="Thermal Receipt Print Job"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {/* Printable Thermal Receipt Card */}
          <div
            id="printable-thermal-receipt"
            className="p-5 bg-[#fdfbf7] text-slate-900 font-mono text-xs rounded-xl border border-amber-200/80 shadow-md space-y-3"
          >
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
              <h2 className="font-black text-sm uppercase tracking-wide">
                {brandSettings?.businessName || "RESTAURANT BRAND"}
              </h2>
              {activePrintInvoice?.franchise && (
                <p className="font-bold text-xs uppercase text-indigo-950">
                  {activePrintInvoice.franchise.name}
                </p>
              )}
              <p className="text-[11px] font-medium leading-snug text-slate-800">
                {activePrintInvoice?.franchise?.address || brandSettings?.address || "Address not configured"}
              </p>
              <p className="text-[10px] text-slate-600">
                Ph: {activePrintInvoice?.franchise?.phone || brandSettings?.phone || "N/A"}
              </p>
              {brandSettings?.taxNumber && (
                <p className="text-[10px] text-slate-700 font-semibold">
                  GSTIN: {brandSettings.taxNumber}
                </p>
              )}
              {brandSettings?.fssaiNumber && (
                <p className="text-[10px] text-slate-700 font-semibold">
                  FSSAI Lic No: {brandSettings.fssaiNumber}
                </p>
              )}
            </div>

            {/* Raw ESC/POS Payload Text */}
            <pre className="text-xs whitespace-pre-wrap font-mono leading-tight text-slate-800">
              {printPayload}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 no-print">
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> ESC/POS Print Ready
            </span>
            <Button size="sm" variant="primary" onClick={() => window.print()} icon={<Printer className="w-3.5 h-3.5" />}>
              Print Physical Bill
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Details Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={`Invoice #${selectedInvoice?.invoiceNumber || ""}`}
        maxWidth="md"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {/* Franchise Outlet Header */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-sm">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>{selectedInvoice.franchise?.name || "Main Outlet"}</span>
                </div>
                <span className="text-[11px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded">
                  {selectedInvoice.franchise?.code || "BRANCH"}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-slate-700 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Printed Bill Address:</strong>{" "}
                  {selectedInvoice.franchise?.address || "Central HQ Address"}
                </span>
              </div>
              {selectedInvoice.franchise?.phone && (
                <div className="text-xs text-slate-600 pl-5">
                  Branch Phone: {selectedInvoice.franchise.phone}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-sm">
              <div>
                <p className="text-xs text-gray-500">Order ID</p>
                <p className="font-semibold text-gray-900">
                  {selectedInvoice.order?.orderNumber || selectedInvoice.orderId}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={selectedInvoice.isFullyPaid ? "success" : "warning"}>
                  {selectedInvoice.isFullyPaid ? "PAID" : "PARTIAL / UNPAID"}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium text-gray-800">
                  {new Date(selectedInvoice.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden text-sm">
              <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">Financial Breakdown</div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{currSym}{Number(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{currSym}{Number(selectedInvoice.tax).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{currSym}{Number(selectedInvoice.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 text-base">
                  <span>Total Amount</span>
                  <span className="text-emerald-600">
                    {currSym}{Number(selectedInvoice.total).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>Paid Amount</span>
                  <span>{currSym}{Number(selectedInvoice.totalPaid || 0).toFixed(2)}</span>
                </div>
                {(selectedInvoice.remainingBalance || 0) > 0 && (
                  <div className="flex justify-between text-xs text-rose-500 font-semibold pt-1">
                    <span>Remaining Balance</span>
                    <span>{currSym}{Number(selectedInvoice.remainingBalance).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => printMutation.mutate(selectedInvoice)}
                icon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Receipt
              </Button>
              <Button variant="ghost" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
