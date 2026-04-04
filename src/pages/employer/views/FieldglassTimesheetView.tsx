/**
 * FieldglassTimesheetView — Enhanced daily time entry with pending approvals.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetPendingApprovalsQuery,
  useApproveFieldglassTimesheetMutation,
  useRejectFieldglassTimesheetMutation,
  type Timesheet,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  submitted: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
  recalled: "#8b5cf6",
  processed: "#3b82f6",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtHours(n?: number) {
  return n == null ? "0.0" : n.toFixed(1);
}

function getOptionalHours(
  timesheet: Timesheet,
  key: "regularHours" | "overtimeHours" | "ptoHours",
) {
  const extendedTimesheet = timesheet as unknown as Partial<
    Record<"regularHours" | "overtimeHours" | "ptoHours", number>
  >;
  return extendedTimesheet[key] ?? 0;
}

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const FieldglassTimesheetView: React.FC<Props> = () => {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: pendingData, isLoading } = useGetPendingApprovalsQuery({});
  const pending = pendingData?.data ?? [];

  const [approveTs, { isLoading: approving }] =
    useApproveFieldglassTimesheetMutation();
  const [rejectTs, { isLoading: rejecting }] =
    useRejectFieldglassTimesheetMutation();

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await approveTs({ id }).unwrap();
      } catch (err) {
        alert(getApiErrorMessage(err, "Failed to approve timesheet"));
      }
    },
    [approveTs],
  );

  const handleReject = useCallback(async () => {
    if (!rejectId) return;
    try {
      await rejectTs({ id: rejectId, notes: rejectNotes }).unwrap();
      setRejectId(null);
      setRejectNotes("");
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to reject timesheet"));
    }
  }, [rejectTs, rejectId, rejectNotes]);

  const columns: DataTableColumn<Timesheet>[] = useMemo(
    () => [
      {
        key: "weekStart",
        header: "Week",
        render: (t) => `${fmtDate(t.weekStart)} – ${fmtDate(t.weekEnd)}`,
      },
      {
        key: "candidateName",
        header: "Worker",
        render: (t) => t.candidateName || "—",
      },
      {
        key: "regularHours",
        header: "Regular",
        render: (t) =>
          fmtHours(getOptionalHours(t, "regularHours") || t.totalHours),
      },
      {
        key: "overtimeHours",
        header: "OT",
        render: (t) => fmtHours(getOptionalHours(t, "overtimeHours")),
      },
      {
        key: "ptoHours",
        header: "PTO",
        render: (t) => fmtHours(getOptionalHours(t, "ptoHours")),
      },
      {
        key: "totalHours",
        header: "Total",
        render: (t) => fmtHours(t.totalHours),
      },
      {
        key: "status",
        header: "Status",
        render: (t) => (
          <span
            style={{
              color: STATUS_COLORS[t.status] || "#6b7280",
              fontWeight: 600,
            }}
          >
            {t.status.toUpperCase()}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        render: (t) =>
          t.status === "submitted" ? (
            <div className="u-flex u-gap-4">
              <Button
                size="sm"
                onClick={() => handleApprove(t.id)}
                disabled={approving}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => setRejectId(t.id)}
              >
                Reject
              </Button>
            </div>
          ) : null,
      },
    ],
    [handleApprove, approving],
  );

  return (
    <>
      <DataTable<Timesheet>
        columns={columns}
        data={pending}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        paginated
        pageSize={PAGE_SIZE}
        titleIcon="⏱️"
        title="Pending Timesheet Approvals"
      />

      {rejectId && (
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
            aria-label="Close reject timesheet dialog"
            onClick={() => setRejectId(null)}
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
            <h3 style={{ marginTop: 0 }}>Reject Timesheet</h3>
            <textarea
              placeholder="Reason for rejection…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              className="u-w-full"
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Button variant="default" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button onClick={handleReject} disabled={rejecting}>
                {rejecting ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

export default FieldglassTimesheetView;
