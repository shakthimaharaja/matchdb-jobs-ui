/**
 * CandidateRegisterPage.tsx
 *
 * Token validation + account creation form for invited candidates.
 * Flow: Validate token → Show welcome → Fill form → Submit → Redirect to payment.
 */
import React, { useState, useEffect, useMemo } from "react";
import { Button, Input } from "matchdb-component-library";
import {
  useVerifyCandidateTokenQuery,
  useRegisterCandidateMutation,
} from "../../api/jobsApi";

interface CandidateRegisterPageProps {
  token: string;
  onPaymentRedirect: (data: {
    candidateUserId: string;
    companyName: string;
    planName: string;
    plan: string;
  }) => void;
}

export function CandidateRegisterPage({
  token,
  onPaymentRedirect,
}: Readonly<CandidateRegisterPageProps>) {
  const {
    data: tokenData,
    isLoading: verifying,
    error: verifyError,
  } = useVerifyCandidateTokenQuery(token, { skip: !token });

  const [register, { isLoading: registering }] = useRegisterCandidateMutation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill from token data
  useEffect(() => {
    if (tokenData?.valid) {
      if (tokenData.candidateName) setFullName(tokenData.candidateName);
      if (tokenData.candidateEmail) setEmail(tokenData.candidateEmail);
    }
  }, [tokenData]);

  const isValid = useMemo(() => {
    return (
      fullName.trim().length > 0 &&
      email.includes("@") &&
      password.length >= 8 &&
      password === confirmPassword &&
      acceptTerms
    );
  }, [fullName, email, password, confirmPassword, acceptTerms]);

  const handleSubmit = async () => {
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the Terms & Conditions.");
      return;
    }

    try {
      const result = await register({
        token,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      }).unwrap();

      onPaymentRedirect({
        candidateUserId: result.candidateUserId,
        companyName: result.companyName,
        planName: result.planName,
        plan: result.plan,
      });
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr?.data?.error || "Registration failed. Please try again.");
    }
  };

  // ── Loading State ──
  if (verifying) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
            Validating your invitation…
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid Token ──
  if (verifyError || !tokenData?.valid) {
    const errMsg =
      (verifyError as { data?: { error?: string } })?.data?.error ||
      tokenData?.error ||
      "Invalid invitation link.";
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <h1 style={logoStyle}>
              Match<span style={{ color: "#a8cbf5" }}>DB</span>
            </h1>
          </div>
          <div style={{ padding: 32, textAlign: "center" }}>
            <h2 style={{ color: "#c62828", marginBottom: 8 }}>
              ❌ Invalid Invitation
            </h2>
            <p style={{ color: "#666", fontSize: 13 }}>{errMsg}</p>
            <p style={{ color: "#888", fontSize: 12, marginTop: 16 }}>
              Please contact the person who invited you for a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration Form ──
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
            Welcome!
          </h2>
          <p style={{ color: "#666", fontSize: 13, margin: "0 0 16px" }}>
            <strong>{tokenData.companyName}</strong> has invited you to join as
            a candidate.
          </p>

          <div
            style={{
              background: "#f9f9f9",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 12,
            }}
          >
            <strong>Your Plan:</strong> {tokenData.planName}
          </div>

          <div className="u-flex u-flex-col-dir u-gap-12">
            <div>
              <label htmlFor="reg-fullname" style={labelStyle}>
                Full Name *
              </label>
              <Input
                id="reg-fullname"
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFullName(e.target.value)
                }
                fullWidth
              />
            </div>

            <div>
              <label htmlFor="reg-email" style={labelStyle}>
                Email *
              </label>
              <Input id="reg-email" value={email} disabled fullWidth />
            </div>

            <div>
              <label htmlFor="reg-phone" style={labelStyle}>
                Phone Number
              </label>
              <Input
                id="reg-phone"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPhone(e.target.value)
                }
                placeholder="+1-555-000-0000"
                fullWidth
              />
            </div>

            <div>
              <label htmlFor="reg-password" style={labelStyle}>
                Password *
              </label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder="Min 8 characters"
                fullWidth
              />
            </div>

            <div>
              <label htmlFor="reg-confirm-password" style={labelStyle}>
                Confirm Password *
              </label>
              <Input
                id="reg-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                fullWidth
              />
            </div>

            <label
              htmlFor="reg-terms"
              className="u-flex u-gap-8 u-items-center u-fs-12 u-cursor-pointer"
            >
              <input
                id="reg-terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />{" "}
              I accept the Terms & Conditions
            </label>
          </div>

          {error && (
            <div style={{ color: "#c00", fontSize: 12, marginTop: 10 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={registering || !isValid}
              fullWidth
            >
              {registering
                ? "Creating Account…"
                : "Create Account & Continue to Payment"}
            </Button>
          </div>
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
  maxWidth: 460,
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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  display: "block",
  marginBottom: 2,
};

export default CandidateRegisterPage;
