/**
 * CandidatePaymentFailed.tsx
 *
 * Shown when Stripe payment fails. Allows retry.
 */
import React, { useState } from "react";
import { Button } from "matchdb-component-library";
import { useCreateCandidatePaymentSessionMutation } from "../api/jobsApi";

interface CandidatePaymentFailedProps {
  candidateUserId: string;
  plan: string;
  companyName?: string;
}

export function CandidatePaymentFailed({
  candidateUserId,
  plan,
  companyName,
}: Readonly<CandidatePaymentFailedProps>) {
  const [createSession, { isLoading }] =
    useCreateCandidatePaymentSessionMutation();
  const [error, setError] = useState("");

  const handleRetry = async () => {
    setError("");
    try {
      const result = await createSession({
        candidateUserId,
        planId: plan,
      }).unwrap();
      if (result.url) {
        globalThis.location.href = result.url;
      }
    } catch (err: any) {
      setError(
        err?.data?.error ||
          "Could not restart payment. Please try again later.",
      );
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h1 style={logoStyle}>
            Match<span style={{ color: "#a8cbf5" }}>DB</span>
          </h1>
        </div>

        <div style={{ padding: "32px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: "#c62828", margin: "0 0 8px", fontSize: 20 }}>
            Payment Failed
          </h2>
          <p
            style={{
              color: "#666",
              fontSize: 13,
              margin: "0 0 20px",
              lineHeight: 1.6,
            }}
          >
            We couldn&apos;t process your payment
            {companyName ? ` for ${companyName}` : ""}.
            <br />
            Your account has been created but will remain inactive until payment
            is completed.
          </p>

          <div style={infoBoxStyle}>
            <strong style={{ fontSize: 12 }}>What happened?</strong>
            <ul
              style={{
                margin: "8px 0 0",
                padding: "0 0 0 16px",
                fontSize: 12,
                lineHeight: 1.8,
                color: "#555",
              }}
            >
              <li>Your card may have been declined</li>
              <li>Insufficient funds</li>
              <li>The session may have expired</li>
            </ul>
          </div>

          {error && (
            <div style={{ color: "#c00", fontSize: 12, marginTop: 10 }}>
              {error}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleRetry}
            disabled={isLoading}
            style={{ width: "100%", marginTop: 20 }}
          >
            {isLoading ? "Preparing Checkout…" : "Retry Payment →"}
          </Button>

          <p style={{ fontSize: 11, color: "#999", marginTop: 14 }}>
            If the issue persists, contact the person who invited you.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f0f2f5",
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 440,
  width: "100%",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%)",
  padding: "20px 32px",
  textAlign: "center",
};

const logoStyle: React.CSSProperties = {
  color: "#fff",
  margin: 0,
  fontSize: 28,
};

const infoBoxStyle: React.CSSProperties = {
  background: "#fff3e0",
  border: "1px solid #ffe0b2",
  borderRadius: 6,
  padding: "14px 18px",
  textAlign: "left",
};

export default CandidatePaymentFailed;
