/**
 * InviteEmployeeModal.tsx
 *
 * Modal dialog for Admin to invite employees by email.
 * Shows seat usage, validates input, and sends the invitation.
 */
import React, { useState } from "react";
import { Button, Input } from "matchdb-component-library";
import { RoleAssignmentDropdown } from "./RoleAssignmentDropdown";
import {
  useSendEmployeeInviteMutation,
  useGetAdminDashboardQuery,
  type UserRole,
  type MarketerDepartment,
} from "../api/jobsApi";

interface InviteEmployeeModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteEmployeeModal({
  open,
  onClose,
}: InviteEmployeeModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("vendor");
  const [department, setDepartment] = useState<MarketerDepartment | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: dashboard } = useGetAdminDashboardQuery();
  const [sendInvite, { isLoading }] = useSendEmployeeInviteMutation();

  const seatsFull = dashboard
    ? dashboard.seatsUsed >= dashboard.seatLimit
    : false;

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      await sendInvite({
        email: email.trim(),
        name: name.trim(),
        role,
        department: role === "marketer" ? department : null,
      }).unwrap();
      setSuccess(`Invitation sent to ${email}`);
      setEmail("");
      setName("");
      setRole("vendor");
      setDepartment(null);
      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(
        err?.data?.error || err?.data?.message || "Failed to send invitation",
      );
    }
  };

  if (!open) return null;

  return (
    <dialog open className="matchdb-modal-overlay">
      <div className="rm-backdrop" role="none" onClick={onClose} />
      <div
        className="matchdb-modal-window"
        style={{ maxWidth: 440, padding: 20 }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>📧 Invite Employee</h3>

        {dashboard && (
          <div
            style={{
              fontSize: 12,
              color: "var(--w97-text-secondary)",
              marginBottom: 12,
              padding: "8px 12px",
              background: seatsFull ? "#fff3f3" : "#f5f7fa",
              borderRadius: 4,
              border: `1px solid ${seatsFull ? "#fca5a5" : "#e0e0e0"}`,
            }}
          >
            Seats:{" "}
            <strong>
              {dashboard.seatsUsed} / {dashboard.seatLimit}
            </strong>{" "}
            ({dashboard.plan?.name ?? "free"} plan)
            {seatsFull && (
              <span style={{ color: "#c00", marginLeft: 8, fontWeight: 600 }}>
                — Limit reached. Upgrade to add more.
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Email *
            </label>
            <Input
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              placeholder="employee@company.com"
              disabled={isLoading || seatsFull}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Full Name
            </label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="John Doe"
              disabled={isLoading || seatsFull}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Role
            </label>
            <RoleAssignmentDropdown
              value={role}
              department={department}
              onChange={(r, d) => {
                setRole(r);
                setDepartment(d ?? null);
              }}
              disabled={isLoading || seatsFull}
              excludeAdmin
            />
          </div>
        </div>

        {error && (
          <div style={{ color: "#c00", fontSize: 12, marginTop: 10 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: "#2e7d32", fontSize: 12, marginTop: 10 }}>
            {success}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <Button size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || seatsFull}
          >
            {isLoading ? "Sending…" : "Send Invitation"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export default InviteEmployeeModal;
