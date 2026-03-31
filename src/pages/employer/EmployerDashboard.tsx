/**
 * EmployerDashboard — unified role-based employer portal.
 *
 * Uses CompanyContext (fetched from GET /admin/me) to determine which
 * sections are visible. All employers see a single dashboard; the sidebar
 * and available views are filtered by RBAC permissions.
 *
 * Role → visible sections:
 *   admin    → everything (postings + operations + admin)
 *   manager  → postings + operations (no admin/subscription)
 *   vendor   → postings only (jobs, matches, pokes, interviews, vendor financials)
 *   marketer → operations scoped to their department
 */
import React, { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PostingsDashboard from "./PostingsDashboard";
import OperationsDashboard from "./OperationsDashboard";
import {
  CompanyContextProvider,
  useCompanyContext,
} from "../../hooks/useCompanyContext";
import "./EmployerDashboard.css";

type Mode = "postings" | "operations";

interface Props {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
  plan?: string;
  onPostJob?: () => void;
}

/** Mode tabs shown to users with access to both sections */
const MODE_CONFIG: {
  id: Mode;
  label: string;
  icon: string;
  desc: string;
  perm: string;
}[] = [
  {
    id: "postings",
    label: "Job Postings",
    icon: "📋",
    desc: "Post jobs, candidate matches, pokes, interviews",
    perm: "job_postings",
  },
  {
    id: "operations",
    label: "Staffing Operations",
    icon: "📊",
    desc: "Company, candidates, financials, immigration, timesheets",
    perm: "candidates",
  },
];

/** Inner component that reads CompanyContext */
const DashboardInner: React.FC<Props> = ({
  token,
  userId,
  userEmail,
  plan,
  onPostJob,
}) => {
  const { role, hasPermission, isLoading, isUnsetup } = useCompanyContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine which modes the user can see
  const canSeePostings = hasPermission("job_postings");
  const canSeeOperations = hasPermission("candidates");

  const mode: Mode = useMemo(() => {
    const param = searchParams.get("mode") as Mode;
    if (param === "operations" && canSeeOperations) return "operations";
    if (param === "postings" && canSeePostings) return "postings";
    // Default: vendor role → postings, marketer → operations, else postings
    if (role === "marketer" && canSeeOperations) return "operations";
    return canSeePostings ? "postings" : "operations";
  }, [searchParams, canSeePostings, canSeeOperations, role]);

  const setMode = useCallback(
    (m: Mode) => {
      setSearchParams({ mode: m }, { replace: true });
    },
    [setSearchParams],
  );

  // Show both tabs only if user has access to both sections
  const showModeTabs = canSeePostings && canSeeOperations;

  const tabs = useMemo(
    () =>
      showModeTabs
        ? MODE_CONFIG.filter((cfg) => hasPermission(cfg.perm)).map((cfg) => (
            <button
              key={cfg.id}
              type="button"
              className={`employer-mode-tab${mode === cfg.id ? " active" : ""}`}
              onClick={() => setMode(cfg.id)}
              title={cfg.desc}
            >
              <span className="employer-mode-icon">{cfg.icon}</span>
              <span className="employer-mode-label">{cfg.label}</span>
            </button>
          ))
        : null,
    [mode, setMode, showModeTabs, hasPermission],
  );

  if (isLoading) {
    return (
      <div
        className="employer-dashboard"
        style={{ padding: 32, textAlign: "center" }}
      >
        Loading company context…
      </div>
    );
  }

  if (isUnsetup) {
    // User has no company set up — the OperationsDashboard's admin section
    // handles the setup wizard. Show operations mode to trigger it.
    return (
      <div className="employer-dashboard">
        <OperationsDashboard
          token={token}
          userId={userId}
          userEmail={userEmail}
        />
      </div>
    );
  }

  return (
    <div className="employer-dashboard">
      {tabs && <div className="employer-mode-bar">{tabs}</div>}
      {mode === "postings" ? (
        <PostingsDashboard
          token={token}
          userEmail={userEmail}
          plan={plan}
          onPostJob={onPostJob}
        />
      ) : (
        <OperationsDashboard
          token={token}
          userId={userId}
          userEmail={userEmail}
        />
      )}
    </div>
  );
};

/** Wraps DashboardInner in the CompanyContextProvider */
const EmployerDashboard: React.FC<Props> = (props) => (
  <CompanyContextProvider>
    <DashboardInner {...props} />
  </CompanyContextProvider>
);

export default EmployerDashboard;
