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
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtHours(n?: number) {
  return n != null ? n.toFixed(1) : "0.0";
}

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const FieldglassTimesheetView: React.FC<Props> = ({ navigateTo }) => {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: pendingData, isLoading } = useGetPendingApprovalsQuery({});
  const pending = pendingData?.data ?? [];

  const [approveTs, { isLoading: approving }] = useApproveFieldglassTimesheetMutation();
  const [rejectTs, { isLoading: rejecting }] = useRejectFieldglassTimesheetMutation();

  const handleApprove = useCallback(async (id: string) => {
    try { await approveTs({ id }).unwrap(); } catch (err) { alert(getApiErrorMessage(err, "Failed to approve timesheet")); }
  }, [approveTs]);

  const handleReject = useCallback(async () => {
    if (!rejectId) return;
    try {
      await rejectTs({ id: rejectId, notes: rejectNotes }).unwrap();
      setRejectId(null);
      setRejectNotes("");
    } catch (err) { alert(getApiErrorMessage(err, "Failed to reject timesheet")); }
  }, [rejectTs, rejectId, rejectNotes]);

  const columns: DataTableColumn<Timesheet>[] = useMemo(() => [
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
      render: (t) => fmtHours((t as any).regularHours ?? t.totalHours),
    },
    {
      key: "overtimeHours",
      header: "OT",
      render: (t) => fmtHours((t as any).overtimeHours ?? 0),
    },
    {
      key: "ptoHours",
      header: "PTO",
      render: (t) => fmtHours((t as any).ptoHours ?? 0),
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
        <span style={{ color: STATUS_COLORS[t.status] || "#6b7280", fontWeight: 600 }}>
          {t.status.toUpperCase()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (t) =>
        t.status === "submitted" ? (
          <div style={{ display: "flex", gap: 4 }}>
            <Button size="sm" onClick={() => handleApprove(t.id)} disabled={approving}>
              Approve
            </Button>
            <Button size="sm" variant="default" onClick={() => setRejectId(t.id)}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ], [handleApprove, approving]);

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
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setRejectId(null)}
        >
          <div
            style={{ background: "var(--rm-card-bg, #fff)", borderRadius: 8, padding: 24, minWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Reject Timesheet</h3>
            <textarea
              placeholder="Reason for rejection…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <Button variant="default" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button onClick={handleReject} disabled={rejecting}>
                {rejecting ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FieldglassTimesheetView;
