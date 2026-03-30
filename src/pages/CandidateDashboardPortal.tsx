/**
 * CandidateDashboardPortal.tsx
 *
 * Main dashboard for activated candidate users.
 * Shown after successful payment and login.
 */
import React from "react";
import { Panel, Button } from "matchdb-component-library";

interface CandidateProfile {
  fullName: string;
  email: string;
  companyName: string;
  planName: string;
  activatedAt?: string;
}

interface CandidateDashboardPortalProps {
  profile: CandidateProfile;
  onLogout: () => void;
}

export function CandidateDashboardPortal({
  profile,
  onLogout,
}: Readonly<CandidateDashboardPortalProps>) {
  const initials = profile.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1d4479" }}>
            Candidate Portal
          </h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
            Welcome back, {profile.fullName}
          </p>
        </div>
        <Button variant="default" onClick={onLogout} style={{ fontSize: 12 }}>
          Logout
        </Button>
      </div>

      {/* Profile Card */}
      <Panel>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            padding: 20,
          }}
        >
          <div style={avatarStyle}>{initials}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {profile.fullName}
            </div>
            <div style={{ color: "#666", fontSize: 13 }}>{profile.email}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <span style={badgeStyle}>{profile.companyName}</span>
              <span
                style={{
                  ...badgeStyle,
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  marginLeft: 6,
                }}
              >
                {profile.planName}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 20,
        }}
      >
        <div style={statCardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d4479" }}>
            —
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>Active Jobs</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d4479" }}>
            —
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>Submissions</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d4479" }}>
            —
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>Interviews</div>
        </div>
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: 24,
          padding: "16px 20px",
          background: "#f0f6ff",
          border: "1px solid #c8daf4",
          borderRadius: 6,
          fontSize: 13,
          color: "#555",
        }}
      >
        Your candidate portal is active. Job listings and submission features
        will appear here as they become available from{" "}
        <strong>{profile.companyName}</strong>.
      </div>
    </div>
  );
}

// ── Styles ──

const avatarStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #1d4479, #3b6fa6)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: 18,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 12,
  background: "#e3edf9",
  color: "#1d4479",
  fontSize: 11,
  fontWeight: 600,
};

const statCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  padding: "20px 16px",
  textAlign: "center",
};

export default CandidateDashboardPortal;
