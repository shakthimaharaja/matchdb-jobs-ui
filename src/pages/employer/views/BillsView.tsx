/**
 * BillsView — Vendor bill management with AP aging.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetBillsQuery,
  useCreateBillMutation,
  useApproveBillMutation,
  usePayBillMutation,
  useGetBillAgingQuery,
  type VendorBill,
  type BillStatus,
  type BillAgingBucket,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" },
];

const STATUS_COLORS: Record<BillStatus, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  SCHEDULED: "#8b5cf6",
  PAID: "#10b981",
  OVERDUE: "#ef4444",
  VOID: "#6b7280",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type TabId = "list" | "aging";

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const BillsView: React.FC<Props> = ({ navigateTo }) => {
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showPay, setShowPay] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: "ACH", referenceNumber: "", notes: "" });

  const { data: billsData, isLoading } = useGetBillsQuery({
    status: statusFilter || undefined,
  });
  const bills = billsData?.data ?? [];

  const { data: agingData } = useGetBillAgingQuery(undefined, { skip: activeTab !== "aging" });
  const buckets = agingData?.buckets ?? [];

  const [approveBill] = useApproveBillMutation();
  const [payBill, { isLoading: paying }] = usePayBillMutation();

  const handleApprove = useCallback(async (id: string) => {
    try { await approveBill(id).unwrap(); } catch (err) { alert(getApiErrorMessage(err, "Failed to approve bill")); }
  }, [approveBill]);

  const handlePay = useCallback(async () => {
    if (!showPay) return;
    try {
      await payBill({ id: showPay, ...payForm }).unwrap();
      setShowPay(null);
      setPayForm({ amount: 0, method: "ACH", referenceNumber: "", notes: "" });
    } catch (err) { alert(getApiErrorMessage(err, "Failed to pay bill")); }
  }, [payBill, showPay, payForm]);

  const columns: DataTableColumn<VendorBill>[] = useMemo(() => [
    { key: "billNumber", header: "Bill #" },
    { key: "vendorName", header: "Vendor", render: (b) => b.vendorName || "—" },
    { key: "description", header: "Description", render: (b) => b.description || "—" },
    { key: "totalAmount", header: "Total", render: (b) => fmtCurrency(b.totalAmount) },
    { key: "balanceDue", header: "Balance", render: (b) => fmtCurrency(b.balanceDue) },
    { key: "dueDate", header: "Due Date", render: (b) => fmtDate(b.dueDate) },
    {
      key: "status", header: "Status",
      render: (b) => <span style={{ color: STATUS_COLORS[b.status], fontWeight: 600 }}>{b.status}</span>,
    },
    {
      key: "actions", header: "Actions",
      render: (b) => (
        <div style={{ display: "flex", gap: 4 }}>
          {b.status === "PENDING" && <Button size="sm" onClick={() => handleApprove(b._id)}>Approve</Button>}
          {["APPROVED", "SCHEDULED", "OVERDUE"].includes(b.status) && (
            <Button size="sm" onClick={() => setShowPay(b._id)}>Pay</Button>
          )}
        </div>
      ),
    },
  ], [handleApprove]);

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <Button variant={activeTab === "list" ? "primary" : "default"} size="sm" onClick={() => setActiveTab("list")}>Bills</Button>
        <Button variant={activeTab === "aging" ? "primary" : "default"} size="sm" onClick={() => setActiveTab("aging")}>AP Aging</Button>
      </div>

      {activeTab === "list" && (
        <DataTable<VendorBill>
          columns={columns}
          data={bills}
          keyExtractor={(b) => b._id}
          loading={isLoading}
          paginated
          pageSize={PAGE_SIZE}
          titleIcon="📑"
          title="Vendor Bills"
          titleExtra={
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140, marginLeft: 12 }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          }
        />
      )}

      {activeTab === "aging" && (
        <div>
          <h3 style={{ margin: "0 0 12px" }}>📊 Accounts Payable Aging</h3>
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
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{b.count} bill{b.count !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPay && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowPay(null)}
        >
          <div
            style={{ background: "var(--rm-card-bg, #fff)", borderRadius: 8, padding: 24, minWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Record Bill Payment</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="number" placeholder="Amount" value={payForm.amount || ""} onChange={(e) => setPayForm((p) => ({ ...p, amount: +e.target.value }))} style={{ width: "100%" }} />
              <select value={payForm.method} onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))} style={{ width: "100%" }}>
                <option value="ACH">ACH</option>
                <option value="WIRE">Wire</option>
                <option value="CHECK">Check</option>
              </select>
              <input placeholder="Reference #" value={payForm.referenceNumber} onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="default" onClick={() => setShowPay(null)}>Cancel</Button>
                <Button onClick={handlePay} disabled={paying || !payForm.amount}>{paying ? "Paying…" : "Pay"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BillsView;
