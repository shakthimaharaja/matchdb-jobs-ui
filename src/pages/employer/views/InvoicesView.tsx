/**
 * InvoicesView — Invoice management, AR aging, and generate-from-timesheets.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetInvoicesQuery,
  useSendInvoiceMutation,
  useRecordInvoicePaymentMutation,
  useGetInvoiceAgingQuery,
  useGenerateInvoiceFromTimesheetsMutation,
  useGetClientsQuery,
  type Invoice,
  type InvoiceStatus,
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
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

type TabId = "list" | "aging" | "generate";

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const InvoicesView: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: "ACH",
    referenceNumber: "",
    notes: "",
  });
  const [genForm, setGenForm] = useState({
    clientCompanyId: "",
    periodStart: "",
    periodEnd: "",
  });

  const { data: invoicesData, isLoading } = useGetInvoicesQuery({
    status: statusFilter || undefined,
  });
  const invoices = invoicesData?.data ?? [];

  const { data: agingData } = useGetInvoiceAgingQuery(undefined, {
    skip: activeTab !== "aging",
  });
  const buckets = agingData?.buckets ?? [];

  const { data: clientsData } = useGetClientsQuery(
    { status: "ACTIVE" },
    {
      skip: activeTab !== "generate",
    },
  );
  const clientOptions = (clientsData?.data ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const [sendInvoice] = useSendInvoiceMutation();
  const [recordPayment, { isLoading: recording }] =
    useRecordInvoicePaymentMutation();
  const [generateInvoice, { isLoading: generating }] =
    useGenerateInvoiceFromTimesheetsMutation();

  const handleSend = useCallback(
    async (id: string) => {
      try {
        await sendInvoice(id).unwrap();
      } catch (err) {
        alert(getApiErrorMessage(err, "Failed to send invoice"));
      }
    },
    [sendInvoice],
  );

  const handleRecordPayment = useCallback(async () => {
    if (!showPayment) return;
    try {
      await recordPayment({ invoiceId: showPayment, ...paymentForm }).unwrap();
      setShowPayment(null);
      setPaymentForm({
        amount: 0,
        method: "ACH",
        referenceNumber: "",
        notes: "",
      });
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to record payment"));
    }
  }, [recordPayment, showPayment, paymentForm]);

  const handleGenerate = useCallback(async () => {
    try {
      await generateInvoice(genForm).unwrap();
      setGenForm({ clientCompanyId: "", periodStart: "", periodEnd: "" });
      setActiveTab("list");
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to generate invoice"));
    }
  }, [generateInvoice, genForm]);

  const columns: DataTableColumn<Invoice>[] = useMemo(
    () => [
      { key: "invoiceNumber", header: "Invoice #" },
      {
        key: "clientName",
        header: "Client",
        render: (i) => i.clientName || "—",
      },
      {
        key: "periodStart",
        header: "Period",
        render: (i) => `${fmtDate(i.periodStart)} – ${fmtDate(i.periodEnd)}`,
      },
      {
        key: "totalAmount",
        header: "Total",
        render: (i) => fmtCurrency(i.totalAmount),
      },
      {
        key: "balanceDue",
        header: "Balance Due",
        render: (i) => fmtCurrency(i.balanceDue),
      },
      { key: "dueDate", header: "Due Date", render: (i) => fmtDate(i.dueDate) },
      {
        key: "status",
        header: "Status",
        render: (i) => (
          <span style={{ color: STATUS_COLORS[i.status], fontWeight: 600 }}>
            {i.status}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        render: (i) => (
          <div className="u-flex u-gap-4">
            {i.status === "DRAFT" && (
              <Button size="sm" onClick={() => handleSend(i._id)}>
                Send
              </Button>
            )}
            {["SENT", "PARTIAL", "OVERDUE"].includes(i.status) && (
              <Button size="sm" onClick={() => setShowPayment(i._id)}>
                Record Payment
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleSend],
  );

  const tabs = [
    { id: "list" as TabId, label: "Invoices" },
    { id: "aging" as TabId, label: "AR Aging" },
    { id: "generate" as TabId, label: "Generate" },
  ];

  return (
    <>
      <div className="u-mb-12 u-flex u-gap-8">
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
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          }
        />
      )}

      {activeTab === "aging" && (
        <div>
          <h3 style={{ margin: "0 0 12px" }}>📊 Accounts Receivable Aging</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
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
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {fmtCurrency(b.total)}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {b.count} invoice{b.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "generate" && (
        <div
          style={{
            background: "var(--rm-card-bg, #fff)",
            border: "1px solid var(--rm-border, #e5e7eb)",
            borderRadius: 8,
            padding: 24,
            maxWidth: 500,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Generate Invoice from Timesheets</h3>
          <div className="u-flex u-flex-col-dir u-gap-12">
            <label>
              <span>Client</span>
              <select
                value={genForm.clientCompanyId}
                onChange={(e) =>
                  setGenForm((p) => ({ ...p, clientCompanyId: e.target.value }))
                }
                className="u-block u-w-full"
              >
                <option value="">Select client…</option>
                {clientOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label>
                <span>Period Start</span>
                <input
                  type="date"
                  value={genForm.periodStart}
                  onChange={(e) =>
                    setGenForm((p) => ({ ...p, periodStart: e.target.value }))
                  }
                  className="u-block u-w-full"
                />
              </label>
              <label>
                <span>Period End</span>
                <input
                  type="date"
                  value={genForm.periodEnd}
                  onChange={(e) =>
                    setGenForm((p) => ({ ...p, periodEnd: e.target.value }))
                  }
                  className="u-block u-w-full"
                />
              </label>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={
                generating ||
                !genForm.clientCompanyId ||
                !genForm.periodStart ||
                !genForm.periodEnd
              }
            >
              {generating ? "Generating…" : "Generate Invoice"}
            </Button>
          </div>
        </div>
      )}

      {showPayment && (
        <dialog
          open
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            border: "none",
            padding: 0,
          }}
        >
          <button
            type="button"
            aria-label="Close record payment dialog"
            onClick={() => setShowPayment(null)}
            style={{
              position: "absolute",
              inset: 0,
              border: "none",
              background: "rgba(0,0,0,0.4)",
              padding: 0,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              background: "var(--rm-card-bg, #fff)",
              borderRadius: 8,
              padding: 24,
              minWidth: 400,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Record Payment</h3>
            <div className="u-flex u-flex-col-dir u-gap-8">
              <input
                type="number"
                placeholder="Amount"
                value={paymentForm.amount || ""}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, amount: +e.target.value }))
                }
                className="u-w-full"
              />
              <select
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, method: e.target.value }))
                }
                className="u-w-full"
              >
                <option value="ACH">ACH</option>
                <option value="WIRE">Wire</option>
                <option value="CHECK">Check</option>
                <option value="CREDIT_CARD">Credit Card</option>
              </select>
              <input
                placeholder="Reference #"
                value={paymentForm.referenceNumber}
                onChange={(e) =>
                  setPaymentForm((p) => ({
                    ...p,
                    referenceNumber: e.target.value,
                  }))
                }
                className="u-w-full"
              />
              <div
                className="u-flex u-gap-8 u-justify-end"
              >
                <Button variant="default" onClick={() => setShowPayment(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recording || !paymentForm.amount}
                >
                  {recording ? "Recording…" : "Record"}
                </Button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

export default InvoicesView;
