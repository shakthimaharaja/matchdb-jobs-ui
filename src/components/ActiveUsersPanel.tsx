/**
 * ActiveUsersPanel.tsx
 *
 * Real-time (polling-based) active users panel for Admin.
 * Shows online/away/offline status, role, and last activity.
 * Polls every 30 seconds for status updates.
 */
import React from "react";
import { Button } from "matchdb-component-library";
import {
  useGetActiveUsersQuery,
  useUpdateUserStatusMutation,
  type CompanyUserItem,
} from "../api/jobsApi";

const ONLINE_INDICATORS: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  online: { icon: "🟢", label: "Online", color: "#2e7d32" },
  away: { icon: "🟡", label: "Away", color: "#e68a00" },
  offline: { icon: "⚫", label: "Offline", color: "#888" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ActiveUsersPanel() {
  const { data, isLoading } = useGetActiveUsersQuery(undefined, {
    pollingInterval: 30_000, // 30s polling
  });

  const [updateStatus] = useUpdateUserStatusMutation();

  const handleRevoke = async (id: string) => {
    await updateStatus({ id, status: "suspended" });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "#888" }}>
        Loading active users…
      </div>
    );
  }

  const users = data?.users || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "10px 14px",
          background: "#f5f7fa",
          borderRadius: 6,
          fontSize: 12,
          border: "1px solid #e0e0e0",
        }}
      >
        <div>
          <strong>{data?.totalActive ?? 0}</strong>{" "}
          <span style={{ color: "#666" }}>Total</span>
        </div>
        <div>
          🟢 <strong>{data?.totalOnline ?? 0}</strong>{" "}
          <span style={{ color: "#666" }}>Online</span>
        </div>
        <div>
          🟡 <strong>{data?.totalAway ?? 0}</strong>{" "}
          <span style={{ color: "#666" }}>Away</span>
        </div>
      </div>

      {/* User list */}
      {users.length === 0 && (
        <div style={{ fontSize: 12, color: "#888", padding: 12 }}>
          No active users at the moment.
        </div>
      )}

      {users.map((user: CompanyUserItem) => {
        const indicator =
          ONLINE_INDICATORS[user.onlineStatus] || ONLINE_INDICATORS.offline;
        return (
          <div
            key={user.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {/* Avatar / initials */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1d4479, #3b6fa6)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {getInitials(user.fullName || user.email)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.fullName || user.email}
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>
                {user.email} ·{" "}
                <span style={{ textTransform: "capitalize" }}>{user.role}</span>
              </div>
            </div>

            {/* Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span>{indicator.icon}</span>
              <span style={{ color: indicator.color, fontSize: 11 }}>
                {indicator.label}
              </span>
            </div>

            {/* Last active */}
            {user.onlineStatus === "offline" && user.lastLoginAt && (
              <div style={{ fontSize: 10, color: "#aaa", flexShrink: 0 }}>
                Last:{" "}
                {new Date(user.lastLoginAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}

            {/* Revoke button */}
            <Button
              size="sm"
              onClick={() => handleRevoke(user.id)}
              style={{ flexShrink: 0 }}
            >
              Revoke
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default ActiveUsersPanel;
