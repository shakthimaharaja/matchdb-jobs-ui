/**
 * CandidatePaymentPage.tsx
 *
 * Shows plan summary and redirects to Stripe Checkout.
 * Displayed after CandidateRegisterPage form submission.
 */
import React, { useState } from "react";
import { Button } from "matchdb-component-library";
import { useCreateCandidatePaymentSessionMutation } from "../../api/jobsApi";

interface CandidatePaymentPageProps {
  candidateUserId: string;
  companyName: string;
  planName: string;
  plan: string;
}

export function CandidatePaymentPage({
  candidateUserId,
  companyName,
  planName,
  plan,
}: Readonly<CandidatePaymentPageProps>) {
  const [createSession, { isLoading }] =
    useCreateCandidatePaymentSessionMutation();
  const [error, setError] = useState("");

  const handlePay = async () => {
    setError("");
    try {
      const result = await createSession({
        candidateUserId,
        planId: plan,
      }).unwrap();

      // Redirect to Stripe Checkout
      if (result.url) {
        globalThis.location.href = result.url;
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(
        apiErr?.data?.error || "Could not start payment. Please try again.",
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

        <div style={{ padding: "24px 32px" }}>
          <h2 style={{ color: "#1d4479", margin: "0 0 4px", fontSize: 18 }}>
            Complete Your Payment
          </h2>
          <p style={{ color: "#666", fontSize: 13, margin: "0 0 20px" }}>
            One last step — activate your membership with{" "}
            <strong>{companyName}</strong>.
          </p>

          <div style={planBoxStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1d4479" }}>
              {planName}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              You will be redirected to a secure Stripe Checkout page.
            </div>
          </div>

          <ul
            style={{
              padding: "0 0 0 16px",
              margin: "16px 0",
              fontSize: 12,
              color: "#444",
              lineHeight: 1.9,
            }}
          >
            <li>Payment is processed securely via Stripe</li>
            <li>Your account is activated immediately after payment</li>
            <li>You can manage your subscription from your dashboard</li>
          </ul>

          {error && (
            <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>
              {error}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handlePay}
            disabled={isLoading}
            fullWidth
          >
            {isLoading ? "Preparing Checkout…" : "Proceed to Payment →"}
          </Button>

          <p
            style={{
              fontSize: 11,
              color: "#999",
              textAlign: "center",
              marginTop: 14,
            }}
          >
            256-bit SSL encryption · Stripe PCI-DSS Level 1
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

const planBoxStyle: React.CSSProperties = {
  background: "#f0f6ff",
  border: "1px solid #c8daf4",
  borderRadius: 6,
  padding: "14px 18px",
};

export default CandidatePaymentPage;
