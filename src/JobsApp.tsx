import React, { useEffect, useState } from "react";
import "./components/ResumeModal.css";
import { Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { setToken } from "./store/authSlice";
import CandidateDashboard from "./pages/CandidateDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import MarketerDashboard from "./pages/MarketerDashboard";
import PostJobPage from "./pages/PostJobPage";
import PublicJobsView from "./pages/PublicJobsView";
import MembershipGatePage from "./pages/MembershipGatePage";

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

  // Keep jobs-ui Redux store in sync with the token prop from shell.
  // jobsApi's prepareHeaders reads from this store so it auto-injects the JWT.
  useEffect(() => {
    store.dispatch(setToken(token ?? null));
  }, [token]);

  /* ---- Pre-login: show public live data tables ---- */
  if (!token) {
    return (
      <Provider store={store}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <PublicJobsView />
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
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Routes>
          {userType === "marketer" ? (
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
          ) : userType === "vendor" ? (
            <>
              <Route
                path="post-job"
                element={
                  <PostJobPage
                    token={token}
                    onPosted={() => setShowPostJob(false)}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <VendorDashboard
                    token={token}
                    userId={userId}
                    userEmail={userEmail}
                    plan={plan}
                    onPostJob={() => setShowPostJob(true)}
                  />
                }
              />
            </>
          ) : (
            <>
              <Route
                path="*"
                element={
                  <CandidateDashboard
                    token={token}
                    userId={userId}
                    userEmail={userEmail}
                    username={username}
                    plan={plan}
                    membershipConfig={membershipConfig}
                    hasPurchasedVisibility={hasPurchasedVisibility}
                  />
                }
              />
            </>
          )}
        </Routes>

        {/* Inline post-job overlay — W97 window chrome via rm-* classes */}
        {showPostJob && userType === "vendor" && (
          <div className="rm-overlay" onClick={() => setShowPostJob(false)}>
            <div
              className="rm-window"
              style={{ width: 780 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="rm-titlebar">
                <span className="rm-titlebar-icon">📋</span>
                <span className="rm-titlebar-title">Post a New Job</span>
                <button
                  className="rm-close"
                  onClick={() => setShowPostJob(false)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              {/* Status bar */}
              <div className="rm-statusbar">
                Fill in the job details below — fields marked * are required.
                Use Smart Paste to auto-fill from any job description.
              </div>
              {/* PostJobPage owns scroll + footer */}
              <PostJobPage
                token={token}
                onPosted={() => setShowPostJob(false)}
              />
            </div>
          </div>
        )}
      </div>
    </Provider>
  );
};

export default JobsApp;
