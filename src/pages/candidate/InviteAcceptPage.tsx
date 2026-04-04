/**
 * InviteAcceptPage.tsx — Public-facing invite landing page.
 *
 * URL: /invite/:token
 *
 * Flow:
 *  1. Verifies the invite token via GET /api/jobs/invite/:token
 *  2. Shows offer details (company name, marketer message)
 *  3. If user is logged in, they can Accept / Decline
 *  4. Accepting calls POST /api/jobs/invite/:token/accept
 *     → links their CandidateProfile to the company
 */

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useVerifyInviteQuery,
  useAcceptInviteMutation,
} from "../../api/jobsApi";
import { getApiErrorMessage } from "../../utils";
import { Button } from "matchdb-component-library";

const STATUS_LABELS: Record<
  string,
  { icon: string; text: string; color: string }
> = {
  valid: { icon: "✉", text: "You have been invited!", color: "#235a81" },
  already_accepted: {
    icon: "✅",
    text: "Invite already accepted",
    color: "#2e7d32",
  },
  expired: { icon: "⏰", text: "This invite has expired", color: "#bb3333" },
};

const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useVerifyInviteQuery(token || "", {
    skip: !token,
  });
  const [acceptInvite, { isLoading: accepting }] = useAcceptInviteMutation();
  const [accepted, setAccepted] = useState(false);

  if (isLoading) {
    return <div className="u-p-40 u-text-center u-fs-14">Loading invite…</div>;
  }

  if (error || !data) {
    return (
      <div className="u-p-40 u-text-center">
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--w97-red, #bb3333)",
            marginBottom: 8,
          }}
        >
          ❌ Invalid Invite Link
        </div>
        <p style={{ fontSize: 12, color: "#666" }}>
          This invite link is invalid or has expired. Please contact the sender
          for a new invite.
        </p>
      </div>
    );
  }

  const { status, invite } = data;
  const info = STATUS_LABELS[status] || STATUS_LABELS.expired;

  const handleAccept = async () => {
    if (!token) return;
    try {
      await acceptInvite({ token }).unwrap();
      setAccepted(true);
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to accept invite"));
    }
  };

  if (accepted) {
    return (
      <div className="u-p-40 u-text-center">
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 18,
            color: "var(--w97-green, #2e7d32)",
          }}
        >
          Welcome to {invite?.company_name || "the team"}!
        </h2>
        <p style={{ fontSize: 12, color: "#555" }}>
          Your profile has been linked to{" "}
          <strong>{invite?.company_name}</strong>. You can now view job openings
          forwarded by your marketer.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 20 }}>
      <div className="matchdb-card u-p-24 u-text-center">
        <div style={{ fontSize: 40, marginBottom: 12 }}>{info.icon}</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, color: info.color }}>
          {info.text}
        </h2>

        {invite && (
          <>
            <div style={{ fontSize: 13, margin: "12px 0", lineHeight: 1.6 }}>
              <strong>{invite.marketer_email}</strong> has invited you to join
              <br />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--w97-blue, #235a81)",
                }}
              >
                🏢 {invite.company_name}
              </span>
            </div>

            {invite.offer_note && (
              <div
                style={{
                  background: "#f9f9f0",
                  border: "1px solid #e0d99c",
                  borderRadius: 6,
                  padding: "10px 14px",
                  margin: "14px 0",
                  fontSize: 12,
                  lineHeight: 1.5,
                  textAlign: "left",
                  color: "#555",
                  whiteSpace: "pre-wrap",
                }}
              >
                <strong style={{ color: "#333" }}>
                  Message from {invite.marketer_email}:
                </strong>
                <br />
                {invite.offer_note}
              </div>
            )}

            {invite.expires_at && (
              <div style={{ fontSize: 10, color: "#999", marginTop: 8 }}>
                Expires:{" "}
                {new Date(invite.expires_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}

            {status === "valid" && (
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="cta"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? "Accepting…" : "✓ Accept Invite"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InviteAcceptPage;
