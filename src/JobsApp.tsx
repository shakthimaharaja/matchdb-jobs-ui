import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import CandidateDashboard from "./pages/CandidateDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import CandidateProfile from "./pages/CandidateProfile";
import PostJobPage from "./pages/PostJobPage";
import PublicLanding from "./pages/PublicLanding";

export interface JobsAppProps {
  token: string | null;
  userType: string | undefined;
  userId: string | undefined;
  userEmail: string | undefined;
  plan?: string;
  visibility?: "all" | "c2c" | "w2" | "c2h" | "fulltime";
}

// This component is exposed via Module Federation as 'matchdbJobs/JobsApp'
// It receives auth context as props from the shell host
const JobsApp: React.FC<JobsAppProps> = ({
  token,
  userType,
  userId,
  userEmail,
  plan = "free",
  visibility = "all",
}) => {
  const [showPostJob, setShowPostJob] = useState(false);

  /* ---- Not logged in  →  Public split view ---- */
  if (!token) {
    return (
      <Provider store={store}>
        <PublicLanding />
      </Provider>
    );
  }

  /* ---- Authenticated view ---- */
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
          {userType === "vendor" ? (
            <>
              <Route
                path="/post-job"
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
                path="/profile"
                element={
                  <CandidateProfile token={token} userEmail={userEmail} />
                }
              />
              <Route
                path="*"
                element={
                  <CandidateDashboard
                    token={token}
                    userId={userId}
                    userEmail={userEmail}
                    plan={plan}
                  />
                }
              />
            </>
          )}
        </Routes>

        {/* Inline post-job overlay for vendor (avoids full route change) */}
        {showPostJob && userType === "vendor" && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 1300,
              overflowY: "auto",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: 32,
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                maxWidth: 860,
                width: "100%",
                margin: "32px auto",
                position: "relative",
              }}
            >
              <button
                onClick={() => setShowPostJob(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#666",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
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
