/**
 * PayrollView — Payroll period management with wizard-style workflow.
 *
 * Steps: Create Period → Submit (pull approved timesheets) → Approve → Process (generate pay stubs)
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetPayPeriodsQuery,
  useCreatePayPeriodMutation,
  useSubmitPayPeriodMutation,
  useApprovePayPeriodMutation,
  useProcessPayPeriodMutation,
  useVoidPayPeriodMutation,
  type PayPeriod,
  type PayPeriodStatus,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "PROCESSED", label: "Processed" },
  { value: "VOIDED", label: "Voided" },
];

const STATUS_COLORS: Record<PayPeriodStatus, string> = {
  DRAFT: "#6b7280",
  IN_REVIEW: "#f59e0b",
  APPROVED: "#3b82f6",
  PROCESSED: "#10b981",
  VOIDED: "#ef4444",
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

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const PayrollView: React.FC<Props> = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    periodStart: "",
    periodEnd: "",
    frequency: "BI_WEEKLY" as const,
    notes: "",
  });
  const { data: periodsData, isLoading } = useGetPayPeriodsQuery({
    status: statusFilter || undefined,
  });
  const periods = periodsData?.data ?? [];

  const [createPayPeriod, { isLoading: creating }] =
    useCreatePayPeriodMutation();
  const [submitPayPeriod, { isLoading: submitting }] =
    useSubmitPayPeriodMutation();
  const [approvePayPeriod, { isLoading: approving }] =
    useApprovePayPeriodMutation();
  const [processPayPeriod, { isLoading: processing }] =
    useProcessPayPeriodMutation();
  const [voidPayPeriod] = useVoidPayPeriodMutation();

  const handleCreate = useCallback(async () => {
    try {
      await createPayPeriod(newPeriod).unwrap();
      setShowCreate(false);
      setNewPeriod({
        periodStart: "",
        periodEnd: "",
        frequency: "BI_WEEKLY",
        notes: "",
      });
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to create pay period"));
    }
  }, [createPayPeriod, newPeriod]);

  const handleAction = useCallback(
    async (action: string, id: string) => {
      try {
        if (action === "submit") await submitPayPeriod(id).unwrap();
        if (action === "approve") await approvePayPeriod(id).unwrap();
        if (action === "process") await processPayPeriod(id).unwrap();
        if (action === "void") await voidPayPeriod(id).unwrap();
      } catch (err) {
        alert(getApiErrorMessage(err, "Action failed"));
      }
    },
    [submitPayPeriod, approvePayPeriod, processPayPeriod, voidPayPeriod],
  );

  const columns: DataTableColumn<PayPeriod>[] = useMemo(
    () => [
      {
        key: "periodStart",
        header: "Period",
        render: (p) => `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`,
      },
      { key: "frequency", header: "Frequency" },
      {
        key: "status",
        header: "Status",
        render: (p) => (
          <span
            style={{
              color: STATUS_COLORS[p.status],
              fontWeight: 600,
            }}
          >
            {p.status.replace("_", " ")}
          </span>
        ),
      },
      {
        key: "employeeCount",
        header: "Employees",
        render: (p) => p.employeeCount ?? 0,
      },
      {
        key: "totalGrossPay",
        header: "Gross Pay",
        render: (p) => fmtCurrency(p.totalGrossPay),
      },
      {
        key: "totalNetPay",
        header: "Net Pay",
        render: (p) => fmtCurrency(p.totalNetPay),
      },
      {
        key: "totalEmployerCost",
        header: "Employer Cost",
        render: (p) => fmtCurrency(p.totalEmployerCost),
      },
      {
        key: "actions",
        header: "Actions",
        render: (p) => (
          <div className="u-flex u-gap-4">
            {p.status === "DRAFT" && (
              <Button
                size="sm"
                onClick={() => handleAction("submit", p._id)}
                disabled={submitting}
              >
                Submit
              </Button>
            )}
            {p.status === "IN_REVIEW" && (
              <Button
                size="sm"
                onClick={() => handleAction("approve", p._id)}
                disabled={approving}
              >
                Approve
              </Button>
            )}
            {p.status === "APPROVED" && (
              <Button
                size="sm"
                onClick={() => handleAction("process", p._id)}
                disabled={processing}
              >
                Process
              </Button>
            )}
            {(p.status === "DRAFT" || p.status === "IN_REVIEW") && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleAction("void", p._id)}
              >
                Void
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleAction, submitting, approving, processing],
  );

  return (
    <>
      <DataTable<PayPeriod>
        columns={columns}
        data={periods}
        keyExtractor={(p) => p._id}
        loading={isLoading}
        paginated
        pageSize={PAGE_SIZE}
        titleIcon="💰"
        title="Payroll Periods"
        titleExtra={
          <div className="u-flex u-gap-8 u-ml-12">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 160 }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button onClick={() => setShowCreate(true)}>+ New Period</Button>
          </div>
        }
      />

      {showCreate && (
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
            aria-label="Close create pay period dialog"
            onClick={() => setShowCreate(false)}
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
              maxWidth: 500,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Create Pay Period</h3>
            <div className="u-flex u-flex-col-dir u-gap-12">
              <label>
                <span>Period Start</span>
                <input
                  type="date"
                  value={newPeriod.periodStart}
                  onChange={(e) =>
                    setNewPeriod((p) => ({
                      ...p,
                      periodStart: e.target.value,
                    }))
                  }
                  className="u-block u-w-full"
                />
              </label>
              <label>
                <span>Period End</span>
                <input
                  type="date"
                  value={newPeriod.periodEnd}
                  onChange={(e) =>
                    setNewPeriod((p) => ({ ...p, periodEnd: e.target.value }))
                  }
                  className="u-block u-w-full"
                />
              </label>
              <label>
                <span>Frequency</span>
                <select
                  value={newPeriod.frequency}
                  onChange={(e) =>
                    setNewPeriod((p) => ({
                      ...p,
                      frequency: e.target.value as "BI_WEEKLY",
                    }))
                  }
                  className="u-block u-w-full"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BI_WEEKLY">Bi-Weekly</option>
                  <option value="SEMI_MONTHLY">Semi-Monthly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  value={newPeriod.notes}
                  onChange={(e) =>
                    setNewPeriod((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="u-block u-w-full"
                  rows={2}
                />
              </label>
              <div
                className="u-flex u-gap-8 u-justify-end"
              >
                <Button variant="default" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={
                    creating || !newPeriod.periodStart || !newPeriod.periodEnd
                  }
                >
                  {creating ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

export default PayrollView;
