import React, { useRef, useState } from "react";
import { Button } from "matchdb-component-library";
import "./components/ResumeModal.css";
import {
  Routes,
  Route,
  useParams,
  useSearchParams as useSearchParamsRouter,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { setToken } from "./store/authSlice";
import CandidateDashboard from "./pages/CandidateDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import MarketerDashboard from "./pages/MarketerDashboard";
import PostJobPage from "./pages/PostJobPage";
import PublicJobsView from "./pages/PublicJobsView";
import MembershipGatePage from "./pages/MembershipGatePage";
import InviteAcceptPage from "./pages/InviteAcceptPage";
import { CandidateOnboardingFlow } from "./pages/CandidateOnboardingFlow";

export interface JobsAppProps {
  token: string | null;
  userType: string | undefined;
  userId: string | undefined;
  userEmail: string | undefined;
  username: string | undefined;
  plan?: string;
  membershipConfig?: Record<string, string[]> | null;
  hasPurchasedVisibility?: boolean;
}

// This component is exposed via Module Federation as 'matchdbJobs/JobsApp'
// It receives auth context as props from the shell host
const JobsApp: React.FC<JobsAppProps> = ({
  token,
  userType,
  userId,
  userEmail,
  username,
  plan = "free",
  membershipConfig,
  hasPurchasedVisibility = false,
}) => {
  const [showPostJob, setShowPostJob] = useState(false);

  // Synchronously update the jobs-ui Redux store with the token prop BEFORE
  // children render.  RTK Query's prepareHeaders reads from this store, so
  // if we used useEffect (which fires child-first), MarketerDashboard's
  // query hooks would fire before the token is available → 401 errors.
  const prevToken = useRef<string | null>(null);
  if (token !== prevToken.current) {
    prevToken.current = token;
    store.dispatch(setToken(token ?? null));
  }

  /* ---- Pre-login: show public live data tables ---- */
  if (!token) {
    return (
      <Provider store={store}>
        <div className="matchdb-page-transition matchdb-flex-col">
          <Routes>
            {/* Candidate onboarding (public — no auth required) */}
            <Route
              path="candidate/register/:token"
              element={<CandidateOnboardingRouteWrapper step="register" />}
            />
            <Route
              path="candidate/payment-success"
              element={<CandidateOnboardingFlow initialStep="success" />}
            />
            <Route
              path="candidate/payment-failed"
              element={<CandidateOnboardingRouteWrapper step="failed" />}
            />
            <Route path="*" element={<PublicJobsView />} />
          </Routes>
        </div>
      </Provider>
    );
  }

  /* ---- Marketer without active subscription → membership gate ---- */
  if (userType === "marketer" && plan !== "marketer") {
    return (
      <Provider store={store}>
        <MembershipGatePage userType="marketer" />
      </Provider>
    );
  }

  /* ---- Vendor without subscription → membership gate ---- */
  if (userType === "vendor" && plan === "free") {
    return (
      <Provider store={store}>
        <MembershipGatePage userType="vendor" />
      </Provider>
    );
  }

  /* ---- Candidate without visibility purchase → membership gate ---- */
  if (userType === "candidate" && !hasPurchasedVisibility) {
    return (
      <Provider store={store}>
        <MembershipGatePage userType="candidate" />
      </Provider>
    );
  }

  /* ---- Authenticated view (membership active) ---- */
  return (
    <Provider store={store}>
      <div className="matchdb-page-transition matchdb-flex-col">
        <Routes>
          {/* Invite acceptance — available to all logged-in users */}
          <Route path="invite/:token" element={<InviteAcceptPage />} />

          {(() => {
            if (userType === "marketer")
              return (
                <Route
                  path="*"
                  element={
                    <MarketerDashboard
                      token={token}
                      userId={userId}
                      userEmail={userEmail}
                    />
                  }
                />
              );
            if (userType === "vendor")
              return (
                <>
                  <Route
                    path="post-job"
                    element={
                      <PostJobPage onPosted={() => setShowPostJob(false)} />
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <VendorDashboard
                        token={token}
                        userEmail={userEmail}
                        plan={plan}
                        onPostJob={() => setShowPostJob(true)}
                      />
                    }
                  />
                </>
              );
            return (
              <Route
                path="*"
                element={
                  <CandidateDashboard
                    token={token}
                    userEmail={userEmail}
                    username={username}
                    plan={plan}
                    membershipConfig={membershipConfig}
                    hasPurchasedVisibility={hasPurchasedVisibility}
                  />
                }
              />
            );
          })()}
        </Routes>

        {/* Inline post-job overlay — W97 window chrome via rm-* classes */}
        {showPostJob && userType === "vendor" && (
          <dialog open className="rm-overlay">
            <div
              className="rm-backdrop"
              role="none"
              onClick={() => setShowPostJob(false)}
            />
            <div className="rm-window matchdb-postjob-window">
              {/* Title bar */}
              <div className="rm-titlebar">
                <span className="rm-titlebar-icon">📋</span>
                <span className="rm-titlebar-title">Post a New Job</span>
                <Button
                  variant="close"
                  size="xs"
                  onClick={() => setShowPostJob(false)}
                  title="Close"
                >
                  ✕
                </Button>
              </div>
              {/* Status bar */}
              <div className="rm-statusbar">
                Fill in the job details below — fields marked * are required.
                Use Smart Paste to auto-fill from any job description.
              </div>
              {/* PostJobPage owns scroll + footer */}
              <PostJobPage onPosted={() => setShowPostJob(false)} />
            </div>
          </dialog>
        )}
      </div>
    </Provider>
  );
};

/**
 * Wrapper that pulls route params from react-router and passes them
 * to the CandidateOnboardingFlow component.
 */
function CandidateOnboardingRouteWrapper({
  step,
}: Readonly<{ step: "register" | "failed" }>) {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParamsRouter();

  if (step === "register") {
    return <CandidateOnboardingFlow token={token} initialStep="register" />;
  }
  return (
    <CandidateOnboardingFlow
      initialStep="failed"
      candidateUserId={searchParams.get("candidateUserId") ?? ""}
      plan={searchParams.get("plan") ?? ""}
      companyName={searchParams.get("companyName") ?? ""}
    />
  );
}

export default JobsApp;
