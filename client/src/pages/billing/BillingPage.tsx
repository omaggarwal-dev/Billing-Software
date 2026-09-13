import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  DollarSign,
  Printer,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { api, extractErrorMessage } from "../../services/api.js";
import { useAuthStore } from "../../store/authStore.js";
import type { Invoice, PaymentMethod } from "../../types/index.js";
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

  // Receipt Preview state
  const [printPayload, setPrintPayload] = useState<string | null>(null);

  // Fetch Invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", selectedFranchiseId],
    queryFn: async () => {
      const res = await api.get("/billing/invoices");
      return res.data.data;
    },
  });

  // Record Payment Mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice) return;

      if (isSplitMode) {
        return api.post("/payments", {
          invoiceId: paymentInvoice.id,
          splits: splits.map((s) => ({
            method: s.method,
            amount: Number(s.amount),
            transactionId: s.transactionId || null,
          })),
        });
      }

      return api.post("/payments", {
        invoiceId: paymentInvoice.id,
        method: singleMethod,
        amount: Number(singleAmount),
        transactionId: singleTxnId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setIsPaymentModalOpen(false);
      setPaymentInvoice(null);
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  // Print Receipt Mutation
  const printMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await api.post("/printers/print-job", {
        type: "RECEIPT",
        targetId: invoiceId,
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
    const paid = inv.payments
      ?.filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const remaining = Math.max(0, Number(inv.total) - paid);

    setSingleAmount(remaining);
    setSingleMethod("CASH");
    setSingleTxnId("");
    setIsSplitMode(false);
    setSplits([
      { method: "CASH", amount: Math.floor(remaining / 2), transactionId: "" },
      { method: "UPI", amount: Math.ceil(remaining / 2), transactionId: "" },
    ]);
    setFormError(null);
    setIsPaymentModalOpen(true);
  };

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.order?.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.order?.tableSession?.table?.tableNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Billing & Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Customer invoices, split payments, receipts generation, and settlement records
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <Input
          placeholder="Search by invoice #, order #, or table..."
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
                  const totalPaid = inv.payments
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
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{inv.order?.orderNumber}</p>
                        <span className="text-xs text-gray-500">{tableStr}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">
                        ₹{Number(inv.total).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">
                        ₹{totalPaid.toFixed(2)}
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
                          onClick={() => printMutation.mutate(inv.id)}
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
            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Total Invoice Amount</p>
                <p className="text-xl font-bold">₹{Number(paymentInvoice.total).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSplitMode(!isSplitMode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  {isSplitMode ? "Switch to Single Pay" : "Split Payment"}
                </button>
              </div>
            </div>
          )}

          {!isSplitMode ? (
            <div className="space-y-3">
              <Select
                label="Payment Method *"
                options={[
                  { value: "CASH", label: "💵 Cash" },
                  { value: "UPI", label: "📱 UPI (GooglePay / PhonePe / Paytm)" },
                  { value: "CARD", label: "💳 Credit / Debit Card" },
                  { value: "OTHER", label: "Other" },
                ]}
                value={singleMethod}
                onChange={(e) => setSingleMethod(e.target.value as PaymentMethod)}
              />

              <Input
                label="Amount (₹) *"
                type="number"
                step="0.01"
                required
                value={singleAmount}
                onChange={(e) => setSingleAmount(Number(e.target.value))}
              />

              {singleMethod !== "CASH" && (
                <Input
                  label="Transaction Ref / Auth ID"
                  placeholder="e.g. UPI-TXN-123456"
                  value={singleTxnId}
                  onChange={(e) => setSingleTxnId(e.target.value)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Split Distribution
              </p>
              {splits.map((split, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      options={[
                        { value: "CASH", label: "Cash" },
                        { value: "UPI", label: "UPI" },
                        { value: "CARD", label: "Card" },
                        { value: "OTHER", label: "Other" },
                      ]}
                      value={split.method}
                      onChange={(e) => {
                        const updated = [...splits];
                        updated[idx].method = e.target.value as PaymentMethod;
                        setSplits(updated);
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={split.amount}
                      onChange={(e) => {
                        const updated = [...splits];
                        updated[idx].amount = Number(e.target.value);
                        setSplits(updated);
                      }}
                    />
                  </div>
                  {split.method !== "CASH" && (
                    <Input
                      placeholder="Transaction Ref ID"
                      value={split.transactionId}
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

      {/* Receipt Thermal Printer Preview Modal */}
      <Modal
        isOpen={!!printPayload}
        onClose={() => setPrintPayload(null)}
        title="Thermal Receipt Print Job"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs whitespace-pre-wrap leading-tight overflow-x-auto shadow-inner">
            {printPayload}
          </pre>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sent to Thermal ESC/POS Spooler
            </span>
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              Print Physical
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
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-sm">
              <div>
                <p className="text-xs text-gray-500">Order ID</p>
                <p className="font-semibold text-gray-900">{selectedInvoice.order?.orderNumber || selectedInvoice.orderId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={selectedInvoice.isFullyPaid ? "success" : "warning"}>
                  {selectedInvoice.isFullyPaid ? "PAID" : "PARTIAL / UNPAID"}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium text-gray-800">{new Date(selectedInvoice.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden text-sm">
              <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">Financial Breakdown</div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{Number(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>₹{Number(selectedInvoice.tax).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-₹{Number(selectedInvoice.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 text-base">
                  <span>Total Amount</span>
                  <span className="text-emerald-600">₹{Number(selectedInvoice.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>Paid Amount</span>
                  <span>₹{Number(selectedInvoice.totalPaid || 0).toFixed(2)}</span>
                </div>
                {(selectedInvoice.remainingBalance || 0) > 0 && (
                  <div className="flex justify-between text-xs text-rose-500 font-semibold pt-1">
                    <span>Remaining Balance</span>
                    <span>₹{Number(selectedInvoice.remainingBalance).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
