/**
 * InvitationList.tsx
 *
 * Displays all employee invitations with status badges and admin actions.
 * Used in the Admin dashboard User Management section.
 */
import React from "react";
import {
  DataTable,
  Button,
  type DataTableColumn,
} from "matchdb-component-library";
import {
  useGetEmployeeInvitationsQuery,
  useRevokeEmployeeInvitationMutation,
  type EmployeeInvitationItem,
} from "../api/jobsApi";

const STATUS_COLORS: Record<string, string> = {
  pending: "#e68a00",
  accepted: "#2e7d32",
  expired: "#c62828",
  revoked: "#888",
};

const STATUS_ICONS: Record<string, string> = {
  pending: "🟡",
  accepted: "🟢",
  expired: "🔴",
  revoked: "⛔",
};

export function InvitationList() {
  const {
    data: invitations = [],
    isLoading,
    refetch,
  } = useGetEmployeeInvitationsQuery();
  const [revoke, { isLoading: revoking }] =
    useRevokeEmployeeInvitationMutation();

  const handleRevoke = async (id: string) => {
    await revoke(id);
    refetch();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const columns: DataTableColumn<EmployeeInvitationItem>[] = [
    {
      key: "name",
      header: "Name",
      width: "18%",
      skeletonWidth: 100,
      render: (r) => <>{r.name || "—"}</>,
    },
    {
      key: "email",
      header: "Email",
      width: "22%",
      skeletonWidth: 140,
      render: (r) => <>{r.email}</>,
    },
    {
      key: "role",
      header: "Role",
      width: "12%",
      skeletonWidth: 80,
      render: (r) => (
        <span style={{ textTransform: "capitalize" }}>{r.role}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      skeletonWidth: 70,
      render: (r) => (
        <span
          className="matchdb-type-pill"
          style={{ color: STATUS_COLORS[r.status] || "#555" }}
        >
          {STATUS_ICONS[r.status] || ""} {r.status}
        </span>
      ),
    },
    {
      key: "sentOn",
      header: "Sent On",
      width: "14%",
      skeletonWidth: 90,
      render: (r) => <>{fmtDate(r.createdAt)}</>,
    },
    {
      key: "expiresAt",
      header: "Expires",
      width: "14%",
      skeletonWidth: 90,
      render: (r) => <>{fmtDate(r.expiresAt)}</>,
    },
    {
      key: "actions",
      header: "Actions",
      width: "8%",
      skeletonWidth: 60,
      render: (r) => {
        if (r.status !== "pending")
          return <span style={{ color: "#aaa" }}>—</span>;
        return (
          <Button
            size="sm"
            onClick={() => handleRevoke(r.id)}
            disabled={revoking}
          >
            Revoke
          </Button>
        );
      },
    },
  ];

  return (
    <DataTable<EmployeeInvitationItem>
      columns={columns}
      data={invitations}
      keyExtractor={(r) => r.id}
      loading={isLoading}
      paginated
      serialNumberColumnWidth={50}
      emptyMessage="No invitations sent yet."
      title="Employee Invitations"
      titleIcon="📧"
    />
  );
}

export default InvitationList;
