/**
 * InvoicesView — Invoice management, AR aging, and generate-from-timesheets.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetInvoicesQuery,
  useCreateInvoiceMutation,
  useSendInvoiceMutation,
  useRecordInvoicePaymentMutation,
  useGetInvoiceAgingQuery,
  useGenerateInvoiceFromTimesheetsMutation,
  useGetClientsQuery,
  type Invoice,
  type InvoiceStatus,
  type InvoiceAgingBucket,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" },
];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "#6b7280",
  SENT: "#3b82f6",
  VIEWED: "#8b5cf6",
  PARTIAL: "#f59e0b",
  PAID: "#10b981",
  OVERDUE: "#ef4444",
  VOID: "#6b7280",
  WRITE_OFF: "#991b1b",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type TabId = "list" | "aging" | "generate";

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const InvoicesView: React.FC<Props> = ({ navigateTo }) => {
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: "ACH", referenceNumber: "", notes: "" });
  const [genForm, setGenForm] = useState({ clientCompanyId: "", periodStart: "", periodEnd: "" });

  const { data: invoicesData, isLoading } = useGetInvoicesQuery({
    status: statusFilter || undefined,
  });
  const invoices = invoicesData?.data ?? [];

  const { data: agingData } = useGetInvoiceAgingQuery(undefined, {
    skip: activeTab !== "aging",
  });
  const buckets = agingData?.buckets ?? [];

  const { data: clientsData } = useGetClientsQuery({ status: "ACTIVE" }, {
    skip: activeTab !== "generate",
  });
  const clientOptions = (clientsData?.data ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const [sendInvoice] = useSendInvoiceMutation();
  const [recordPayment, { isLoading: recording }] = useRecordInvoicePaymentMutation();
  const [generateInvoice, { isLoading: generating }] = useGenerateInvoiceFromTimesheetsMutation();

  const handleSend = useCallback(async (id: string) => {
    try { await sendInvoice(id).unwrap(); } catch (err) { alert(getApiErrorMessage(err, "Failed to send invoice")); }
  }, [sendInvoice]);

  const handleRecordPayment = useCallback(async () => {
    if (!showPayment) return;
    try {
      await recordPayment({ invoiceId: showPayment, ...paymentForm }).unwrap();
      setShowPayment(null);
      setPaymentForm({ amount: 0, method: "ACH", referenceNumber: "", notes: "" });
    } catch (err) { alert(getApiErrorMessage(err, "Failed to record payment")); }
  }, [recordPayment, showPayment, paymentForm]);

  const handleGenerate = useCallback(async () => {
    try {
      await generateInvoice(genForm).unwrap();
      setGenForm({ clientCompanyId: "", periodStart: "", periodEnd: "" });
      setActiveTab("list");
    } catch (err) { alert(getApiErrorMessage(err, "Failed to generate invoice")); }
  }, [generateInvoice, genForm]);

  const columns: DataTableColumn<Invoice>[] = useMemo(() => [
    { key: "invoiceNumber", header: "Invoice #" },
    { key: "clientName", header: "Client", render: (i) => i.clientName || "—" },
    { key: "periodStart", header: "Period", render: (i) => `${fmtDate(i.periodStart)} – ${fmtDate(i.periodEnd)}` },
    { key: "totalAmount", header: "Total", render: (i) => fmtCurrency(i.totalAmount) },
    { key: "balanceDue", header: "Balance Due", render: (i) => fmtCurrency(i.balanceDue) },
    { key: "dueDate", header: "Due Date", render: (i) => fmtDate(i.dueDate) },
    {
      key: "status", header: "Status",
      render: (i) => <span style={{ color: STATUS_COLORS[i.status], fontWeight: 600 }}>{i.status}</span>,
    },
    {
      key: "actions", header: "Actions",
      render: (i) => (
        <div style={{ display: "flex", gap: 4 }}>
          {i.status === "DRAFT" && <Button size="sm" onClick={() => handleSend(i._id)}>Send</Button>}
          {["SENT", "PARTIAL", "OVERDUE"].includes(i.status) && (
            <Button size="sm" onClick={() => setShowPayment(i._id)}>Record Payment</Button>
          )}
        </div>
      ),
    },
  ], [handleSend]);

  const tabs = [
    { id: "list" as TabId, label: "Invoices" },
    { id: "aging" as TabId, label: "AR Aging" },
    { id: "generate" as TabId, label: "Generate" },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? "primary" : "default"}
            size="sm"
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === "list" && (
        <DataTable<Invoice>
          columns={columns}
          data={invoices}
          keyExtractor={(i) => i._id}
          loading={isLoading}
          paginated
          pageSize={PAGE_SIZE}
          titleIcon="📄"
          title="Invoices"
          titleExtra={
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 140, marginLeft: 12 }}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          }
        />
      )}

      {activeTab === "aging" && (
        <div>
          <h3 style={{ margin: "0 0 12px" }}>📊 Accounts Receivable Aging</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {buckets.map((b) => (
              <div
                key={b.label}
                style={{
                  background: "var(--rm-card-bg, #fff)",
                  border: "1px solid var(--rm-border, #e5e7eb)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 13, color: "#6b7280" }}>{b.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtCurrency(b.total)}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{b.count} invoice{b.count !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "generate" && (
        <div style={{
          background: "var(--rm-card-bg, #fff)",
          border: "1px solid var(--rm-border, #e5e7eb)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 500,
        }}>
          <h3 style={{ marginTop: 0 }}>Generate Invoice from Timesheets</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Client
              <select
                value={genForm.clientCompanyId}
                onChange={(e) => setGenForm((p) => ({ ...p, clientCompanyId: e.target.value }))}
                style={{ display: "block", width: "100%" }}
              >
                <option value="">Select client…</option>
                {clientOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>
                Period Start
                <input
                  type="date"
                  value={genForm.periodStart}
                  onChange={(e) => setGenForm((p) => ({ ...p, periodStart: e.target.value }))}
                  style={{ display: "block", width: "100%" }}
                />
              </label>
              <label>
                Period End
                <input
                  type="date"
                  value={genForm.periodEnd}
                  onChange={(e) => setGenForm((p) => ({ ...p, periodEnd: e.target.value }))}
                  style={{ display: "block", width: "100%" }}
                />
              </label>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !genForm.clientCompanyId || !genForm.periodStart || !genForm.periodEnd}
            >
              {generating ? "Generating…" : "Generate Invoice"}
            </Button>
          </div>
        </div>
      )}

      {showPayment && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowPayment(null)}
        >
          <div
            style={{ background: "var(--rm-card-bg, #fff)", borderRadius: 8, padding: 24, minWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Record Payment</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="number"
                placeholder="Amount"
                value={paymentForm.amount || ""}
                onChange={(e) => setPaymentForm((p) => ({ ...p, amount: +e.target.value }))}
                style={{ width: "100%" }}
              />
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="ACH">ACH</option>
                <option value="WIRE">Wire</option>
                <option value="CHECK">Check</option>
                <option value="CREDIT_CARD">Credit Card</option>
              </select>
              <input
                placeholder="Reference #"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: e.target.value }))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="default" onClick={() => setShowPayment(null)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={recording || !paymentForm.amount}>
                  {recording ? "Recording…" : "Record"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoicesView;
