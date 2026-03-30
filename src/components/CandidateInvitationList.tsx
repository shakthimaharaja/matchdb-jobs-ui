/**
 * CandidateInvitationList.tsx
 *
 * Tracking table for Admin/Marketing to view all invited candidates,
 * with status badges, payment status, and admin actions.
 */
import React, { useState } from "react";
import {
  DataTable,
  Button,
  type DataTableColumn,
} from "matchdb-component-library";
import {
  useGetAllCandidatesQuery,
  useRevokeCandidateInviteMutation,
  useResendCandidateInviteMutation,
  type CandidateInvitationItem,
} from "../api/jobsApi";

const STATUS_MAP: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  pending: { icon: "🟡", color: "#e68a00", label: "Pending" },
  payment_pending: { icon: "🔵", color: "#1565c0", label: "Payment Pending" },
  active: { icon: "🟢", color: "#2e7d32", label: "Active" },
  expired: { icon: "🔴", color: "#c62828", label: "Expired" },
  revoked: { icon: "⛔", color: "#888", label: "Revoked" },
};

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "#888",
  paid: "#2e7d32",
  failed: "#c62828",
  refunded: "#e68a00",
};

export function CandidateInvitationList() {
  const { data, isLoading, refetch } = useGetAllCandidatesQuery();
  const [revoke, { isLoading: revoking }] = useRevokeCandidateInviteMutation();
  const [resend, { isLoading: resending }] = useResendCandidateInviteMutation();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const counts = data?.counts;
  const allCandidates = data?.candidates || [];
  const filtered =
    statusFilter === "all"
      ? allCandidates
      : allCandidates.filter((c) => c.status === statusFilter);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const columns: DataTableColumn<CandidateInvitationItem>[] = [
    {
      key: "name",
      header: "Name",
      width: "13%",
      skeletonWidth: 100,
      render: (r) => <>{r.candidateName || "—"}</>,
    },
    {
      key: "email",
      header: "Email",
      width: "16%",
      skeletonWidth: 130,
      render: (r) => <>{r.candidateEmail}</>,
    },
    {
      key: "plan",
      header: "Plan",
      width: "9%",
      skeletonWidth: 70,
      render: (r) => <>{r.plan}</>,
    },
    {
      key: "invitedBy",
      header: "Invited By",
      width: "11%",
      skeletonWidth: 80,
      render: (r) => (
        <span title={r.invitedByRole}>
          {r.invitedBy}{" "}
          <span
            style={{ fontSize: 9, color: "#888", textTransform: "capitalize" }}
          >
            ({r.invitedByRole})
          </span>
        </span>
      ),
    },
    {
      key: "invitedOn",
      header: "Invited On",
      width: "10%",
      skeletonWidth: 80,
      render: (r) => <>{fmtDate(r.createdAt)}</>,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      width: "9%",
      skeletonWidth: 60,
      render: (r) => (
        <span
          className="matchdb-type-pill"
          style={{
            color: PAYMENT_COLORS[r.paymentStatus] || "#555",
            textTransform: "capitalize",
          }}
        >
          {r.paymentStatus}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      skeletonWidth: 80,
      render: (r) => {
        const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
        return (
          <span className="matchdb-type-pill" style={{ color: st.color }}>
            {st.icon} {st.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "20%",
      skeletonWidth: 120,
      render: (r) => {
        const canRevoke =
          r.status === "pending" || r.status === "payment_pending";
        const canResend = r.status === "pending" || r.status === "expired";
        if (!canRevoke && !canResend) {
          return <span style={{ color: "#aaa", fontSize: 11 }}>—</span>;
        }
        return (
          <div style={{ display: "flex", gap: 4 }}>
            {canResend && (
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  await resend(r.id);
                  refetch();
                }}
                disabled={resending}
              >
                Resend
              </Button>
            )}
            {canRevoke && (
              <Button
                size="sm"
                onClick={async () => {
                  await revoke(r.id);
                  refetch();
                }}
                disabled={revoking}
              >
                Revoke
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Summary cards */}
      {counts && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 0",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Total Invited", value: counts.total, color: "#1d4479" },
            {
              label: "Payment Pending",
              value: counts.paymentPending,
              color: "#1565c0",
            },
            { label: "Active", value: counts.active, color: "#2e7d32" },
            { label: "Expired", value: counts.expired, color: "#c62828" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                padding: "8px 16px",
                background: "#f5f7fa",
                border: "1px solid #e0e0e0",
                borderRadius: 6,
                textAlign: "center",
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>
                {card.value}
              </div>
              <div style={{ fontSize: 10, color: "#666" }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          padding: "4px 0",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600 }}>Filter:</span>
        {[
          "all",
          "pending",
          "payment_pending",
          "active",
          "expired",
          "revoked",
        ].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "primary" : undefined}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all"
              ? "All"
              : s === "payment_pending"
              ? "Payment Pending"
              : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <DataTable<CandidateInvitationItem>
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        paginate
        emptyMessage="No candidate invitations found."
        title="Invited Candidates"
        titleIcon="🎯"
      />
    </div>
  );
}

export default CandidateInvitationList;
