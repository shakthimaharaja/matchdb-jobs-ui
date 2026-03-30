/**
 * CandidateOnboardingFlow.tsx
 *
 * Orchestrator page for the candidate registration + payment flow.
 * Reads token from URL, manages step transitions:
 *   1. Token Validation & Registration (CandidateRegisterPage)
 *   2. Payment (CandidatePaymentPage)
 *   3. Success / Failed based on query params
 *
 * Route: /candidate/register/:token
 * After Stripe: /candidate/payment-success?session_id=xxx
 *               /candidate/payment-failed?candidateUserId=xxx&plan=xxx
 */
import React, { useState, useMemo } from "react";
import { CandidateRegisterPage } from "./CandidateRegisterPage";
import { CandidatePaymentPage } from "./CandidatePaymentPage";
import { CandidatePaymentSuccess } from "./CandidatePaymentSuccess";
import { CandidatePaymentFailed } from "./CandidatePaymentFailed";

type FlowStep = "register" | "payment" | "success" | "failed";

interface CandidateOnboardingFlowProps {
  /** Token from the invitation URL */
  token?: string;
  /** Override step (e.g., from route matching) */
  initialStep?: FlowStep;
  /** For payment-failed retry */
  candidateUserId?: string;
  plan?: string;
  companyName?: string;
}

export function CandidateOnboardingFlow({
  token,
  initialStep,
  candidateUserId: propCandidateUserId,
  plan: propPlan,
  companyName: propCompanyName,
}: Readonly<CandidateOnboardingFlowProps>) {
  const detectedStep = useMemo<FlowStep>(() => {
    if (initialStep) return initialStep;
    return "register";
  }, [initialStep]);

  const [step, setStep] = useState<FlowStep>(detectedStep);

  // Registration result passed to payment step
  const [registrationData, setRegistrationData] = useState<{
    candidateUserId: string;
    companyName: string;
    planName: string;
    plan: string;
  } | null>(null);

  const handlePaymentRedirect = (data: {
    candidateUserId: string;
    companyName: string;
    planName: string;
    plan: string;
  }) => {
    setRegistrationData(data);
    setStep("payment");
  };

  const handleGoToDashboard = () => {
    // Navigate to candidate login / portal
    globalThis.location.href = "/login";
  };

  switch (step) {
    case "register":
      return (
        <CandidateRegisterPage
          token={token || ""}
          onPaymentRedirect={handlePaymentRedirect}
        />
      );

    case "payment":
      return (
        <CandidatePaymentPage
          candidateUserId={
            registrationData?.candidateUserId || propCandidateUserId || ""
          }
          companyName={registrationData?.companyName || propCompanyName || ""}
          planName={registrationData?.planName || ""}
          plan={registrationData?.plan || propPlan || ""}
        />
      );

    case "success":
      return (
        <CandidatePaymentSuccess
          companyName={propCompanyName}
          onGoToDashboard={handleGoToDashboard}
        />
      );

    case "failed":
      return (
        <CandidatePaymentFailed
          candidateUserId={propCandidateUserId || ""}
          plan={propPlan || ""}
          companyName={propCompanyName}
        />
      );

    default:
      return null;
  }
}

export default CandidateOnboardingFlow;
