/**
 * UserManagementTable.tsx
 *
 * Admin-only table showing all company users with inline role change,
 * status toggle, and search/filter capabilities.
 */
import React, { useState } from "react";
import {
  DataTable,
  Button,
  Input,
  Select,
  type DataTableColumn,
} from "matchdb-component-library";
import { RoleAssignmentDropdown } from "./RoleAssignmentDropdown";
import {
  useGetCompanyUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  type CompanyUserItem,
  type UserRole,
  type MarketerDepartment,
} from "../api/jobsApi";

const STATUS_COLORS: Record<string, string> = {
  active: "#2e7d32",
  invited: "#1565c0",
  deactivated: "#888",
};

const ONLINE_INDICATORS: Record<string, string> = {
  online: "🟢",
  away: "🟡",
  offline: "⚫",
};

export function UserManagementTable() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const {
    data: users = [],
    isLoading,
    refetch,
  } = useGetCompanyUsersQuery({
    role: roleFilter !== "all" ? roleFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const [updateRole, { isLoading: updatingRole }] = useUpdateUserRoleMutation();
  const [updateStatus, { isLoading: updatingStatus }] =
    useUpdateUserStatusMutation();

  const handleRoleChange = async (
    id: string,
    role: UserRole,
    department?: MarketerDepartment | null,
  ) => {
    await updateRole({ id, role, department });
    refetch();
  };

  const handleStatusToggle = async (user: CompanyUserItem) => {
    const newStatus = user.status === "active" ? "deactivated" : "active";
    await updateStatus({ id: user.id, status: newStatus });
    refetch();
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "—";

  const columns: DataTableColumn<CompanyUserItem>[] = [
    {
      key: "status-indicator",
      header: "",
      width: "3%",
      skeletonWidth: 20,
      render: (r) => (
        <span title={r.onlineStatus}>
          {ONLINE_INDICATORS[r.onlineStatus] || "⚫"}
        </span>
      ),
    },
    {
      key: "fullName",
      header: "Name",
      width: "17%",
      skeletonWidth: 100,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {r.fullName || "—"}
          </div>
          <div style={{ fontSize: 10, color: "#888" }}>{r.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "16%",
      skeletonWidth: 110,
      render: (r) => (
        <RoleAssignmentDropdown
          value={r.role}
          department={r.department}
          onChange={(role, dept) => handleRoleChange(r.id, role, dept)}
          disabled={updatingRole}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      skeletonWidth: 70,
      render: (r) => (
        <span
          className="matchdb-type-pill"
          style={{
            color: STATUS_COLORS[r.status] || "#555",
            textTransform: "capitalize",
          }}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last Login",
      width: "11%",
      skeletonWidth: 80,
      render: (r) => <>{fmtDate(r.lastLoginAt)}</>,
    },
    {
      key: "joined",
      header: "Joined",
      width: "11%",
      skeletonWidth: 80,
      render: (r) => <>{fmtDate(r.joinedAt)}</>,
    },
    {
      key: "permissions",
      header: "Permissions",
      width: "16%",
      skeletonWidth: 90,
      render: (r) => (
        <span style={{ fontSize: 10, color: "#666" }}>
          {r.permissions.length} permissions
        </span>
      ),
      tooltip: (r) => r.permissions.join(", "),
    },
    {
      key: "actions",
      header: "Actions",
      width: "16%",
      skeletonWidth: 100,
      render: (r) => {
        if (r.role === "admin")
          return <span style={{ color: "#aaa", fontSize: 11 }}>Admin</span>;
        return (
          <Button
            size="sm"
            variant={r.status === "active" ? undefined : "primary"}
            onClick={() => handleStatusToggle(r)}
            disabled={updatingStatus}
          >
            {r.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filter toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 0 4px",
          flexWrap: "wrap",
        }}
      >
        <Input
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          placeholder="Search name or email…"
          style={{ fontSize: 11, width: 180 }}
        />
        <span style={{ fontSize: 11, fontWeight: 600 }}>Role:</span>
        <Select
          value={roleFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setRoleFilter(e.target.value)
          }
          style={{ fontSize: 11, minWidth: 100 }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="vendor">Vendor</option>
          <option value="marketer">Marketer</option>
        </Select>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Status:</span>
        <Select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setStatusFilter(e.target.value)
          }
          style={{ fontSize: 11, minWidth: 100 }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="deactivated">Deactivated</option>
        </Select>
      </div>

      <DataTable<CompanyUserItem>
        columns={columns}
        data={users}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        paginated
        emptyMessage="No users found."
        title="Company Users"
        titleIcon="👥"
      />
    </div>
  );
}

export default UserManagementTable;
