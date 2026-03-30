/**
 * CandidatePaymentSuccess.tsx
 *
 * Confirmation page shown after successful Stripe Checkout.
 * Redirected to from Stripe with session_id query param.
 */
import React from "react";
import { Button } from "matchdb-component-library";

interface CandidatePaymentSuccessProps {
  companyName?: string;
  onGoToDashboard: () => void;
}

export function CandidatePaymentSuccess({
  companyName,
  onGoToDashboard,
}: Readonly<CandidatePaymentSuccessProps>) {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h1 style={logoStyle}>
            Match<span style={{ color: "#a8cbf5" }}>DB</span>
          </h1>
        </div>

        <div style={{ padding: "32px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: "#2e7d32", margin: "0 0 8px", fontSize: 20 }}>
            Payment Successful!
          </h2>
          <p
            style={{
              color: "#666",
              fontSize: 13,
              margin: "0 0 20px",
              lineHeight: 1.6,
            }}
          >
            Your account{companyName ? ` with ${companyName}` : ""} is now
            active.
            <br />
            You can start using all the features included in your plan.
          </p>

          <div style={checklistStyle}>
            <div style={checkItemStyle}>
              <span style={{ color: "#2e7d32" }}>✔</span> Account created
            </div>
            <div style={checkItemStyle}>
              <span style={{ color: "#2e7d32" }}>✔</span> Payment confirmed
            </div>
            <div style={checkItemStyle}>
              <span style={{ color: "#2e7d32" }}>✔</span> Subscription activated
            </div>
          </div>

          <Button
            variant="primary"
            onClick={onGoToDashboard}
            style={{ width: "100%", marginTop: 20 }}
          >
            Go to Dashboard →
          </Button>

          <p style={{ fontSize: 11, color: "#999", marginTop: 16 }}>
            A confirmation email has been sent to your registered address.
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

const checklistStyle: React.CSSProperties = {
  background: "#f1f8e9",
  border: "1px solid #c5e1a5",
  borderRadius: 6,
  padding: "14px 18px",
  textAlign: "left",
};

const checkItemStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "4px 0",
  display: "flex",
  gap: 8,
  alignItems: "center",
};

export default CandidatePaymentSuccess;
