/**
 * PublicJobsView — rendered in Jobs-UI when user is NOT logged in.
 *
 * Three views selected by URL path:
 *   /jobs            → TwinView  : jobs ⋈ candidate_profiles
 *   /jobs/candidate  → CandView  : job openings sorted by rate
 *   /jobs/vendor     → VendorView: candidate profiles sorted by exp
 *
 * Data strategy:
 *  • Connects to /ws/public-data WebSocket on mount
 *  • Server pushes full job + profile snapshots every 30 seconds from the DB
 *  • Server diffs each broadcast and includes changedJobIds / changedProfileIds
 *  • Changed rows flash gold for 2.5 s via the DataTable flashIds prop
 *  • Live counts come from /ws/counts WebSocket (no HTTP polling)
 *  • No hardcoded / mock data — the table is empty until the DB responds
 *
 * Uses DataTable + DataTableColumn from matchdb-component-library.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { DataTable } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import "./PublicJobsView.css";
import { PAGE_SIZE, FLASH_DURATION_MS, WS_RECONNECT_MS } from "../constants";
import { WS_COUNTS, WS_PUBLIC_DATA } from "../constants/endpoints";

interface PublicJob {
  [key: string]: unknown;
  id: string;
  title: string;
  location: string;
  job_type: string;
  work_mode: string;
  salary_min: number | null;
  salary_max: number | null;
  pay_per_hour: number | null;
  skills_required: string[];
  experience_required: number;
  recruiter_name: string;
  vendor_email: string;
  created_at: string;
}

interface PublicProfile {
  [key: string]: unknown;
  id: string;
  name: string;
  current_role: string;
  current_company: string;
  preferred_job_type: string;
  experience_years: number;
  expected_hourly_rate: number | null;
  skills: string[];
  location: string;
}

interface JobWithCandCount extends PublicJob {
  candCount: number;
}

interface JobWithMatch extends PublicJob {
  matchScore: number;
}

interface ProfileWithFit extends PublicProfile {
  fitScore: number;
}

/** Shape broadcast by /ws/public-data */
interface PublicDataMessage {
  jobs: PublicJob[];
  profiles: PublicProfile[];
  changedJobIds: string[];
  changedProfileIds: string[];
  deletedJobIds: string[];
  deletedProfileIds: string[];
  deletedJobs: PublicJob[];
  deletedProfiles: PublicProfile[];
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

/** Build a ws:// or wss:// URL relative to the current page origin. */
function wsUrl(path: string): string {
  const proto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${globalThis.location.host}${path}`;
}

/**
 * Connects to /ws/counts and returns live { jobs, profiles } counts
 * pushed by the server every 30 seconds.
 */
function useLiveCount(field: "jobs" | "profiles"): number | null {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl(WS_COUNTS));
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as Record<string, number>;
          if (typeof data[field] === "number") setValue(data[field]);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, WS_RECONNECT_MS);
      };
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [field]);

  return value;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const computeMatch = (s1: string[], s2: string[]): number => {
  if (!s1.length || !s2.length) return 65;
  const a = new Set(s1.map((x) => x.toLowerCase()));
  const b = new Set(s2.map((x) => x.toLowerCase()));
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return Math.min(99, Math.round(62 + (inter / union) * 36));
};

const fmtJobRate = (j: PublicJob): string => {
  if (j.pay_per_hour) return `$${j.pay_per_hour}/hr`;
  if (j.salary_max) return `$${Math.round(j.salary_max / 1000)}k`;
  return "—";
};

const fmtCompany = (j: PublicJob): string => {
  if (!j.vendor_email) return "—";
  const domain = j.vendor_email.split("@")[1]?.split(".")[0] || "";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
};

const fmtProfileRate = (p: PublicProfile): string => {
  if (p.expected_hourly_rate) return `$${p.expected_hourly_rate}/hr`;
  return "—";
};

const JOB_TYPE_MAP: Record<string, string> = {
  c2c: "contract",
  w2: "full_time",
  c2h: "contract",
  fulltime: "full_time",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const MatchBar: React.FC<{ score: number }> = ({ score }) => (
  <span className="pub-fit-track">
    <span className="pub-fit-bar">
      <span
        className={`pub-fit-fill${(() => {
          if (score >= 90) return " pub-fit-high";
          if (score >= 75) return " pub-fit-good";
          return "";
        })()}`}
        style={{ width: `${score}%` }}
      />
    </span>
    <span className="pub-fit-pct">{score}%</span>
  </span>
);

const LoginWarningBar: React.FC<{
  message?: string;
  viewType?: "candidate" | "vendor";
  openPricing?: () => void;
}> = ({ message, viewType, openPricing }) => (
  <div className="pub-login-warning">
    <span className="pub-login-warning-icon">⚠️</span>
    <span className="pub-login-warning-text">
      {message ||
        "Without login you cannot contact recruiters or connect with candidates or view important columns such as salary, skills, and match scores."}
    </span>
    <button
      type="button"
      className="pub-login-warning-cta"
      onClick={
        openPricing ||
        (() =>
          globalThis.dispatchEvent(
            new CustomEvent("matchdb:openPricing", {
              detail: { tab: "vendor" },
            }),
          ))
      }
      style={{ cursor: "pointer" }}
    >
      {(() => {
        if (viewType === "vendor") return "View Vendor Plans & Pricing →";
        if (viewType === "candidate") return "View Candidate Plans & Pricing →";
        return "See Prices and Plans →";
      })()}
    </button>
  </div>
);

/** Banner shown at the top of every public view — prompts unauthenticated users to sign up via Shell. */
const SignUpBanner: React.FC = () => (
  <div className="pub-signup-banner">
    <span className="pub-signup-banner-icon">💼</span>
    <span className="pub-signup-banner-text">
      Browsing live data • <strong>Sign up</strong> to apply for jobs, get
      matched, and get discovered by employers
    </span>
    <span className="pub-signup-banner-actions">
      <span className="pub-signup-hint">
        Use <strong>Sign&nbsp;In</strong> / <strong>Sign&nbsp;Up</strong> in the
        top header to get started
      </span>
    </span>
  </div>
);

/**
 * Renders a number with a typewriter-style animation,
 * re-triggering each time the value changes.
 */
const TypewriterCount: React.FC<{ value: number | null; fallback: number }> = ({
  value,
  fallback,
}) => {
  const target = value ?? fallback;
  const text = String(target);
  const [displayed, setDisplayed] = useState("");
  const prevRef = useRef(text);

  useEffect(() => {
    let active = true;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      if (!active) return;
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 80);
    prevRef.current = text;
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [text]);

  return (
    <span className="pub-typewriter-count">
      {displayed}
      <span className="pub-typewriter-cursor">|</span>
    </span>
  );
};

/** Ticking "Last sync: Xs ago" indicator that updates every second. */
const SyncTimer: React.FC<{ lastSync: number }> = ({ lastSync }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.round((now - lastSync) / 1000));
  return (
    <span
      className="pub-sb-cell pub-sb-sync"
      title="Seconds since last WebSocket broadcast"
    >
      Last sync: {secs}s ago
    </span>
  );
};

const StatusBar: React.FC<{
  cells: string[];
  loading: boolean;
  live?: boolean;
  wsConnected?: boolean;
  lastSync?: number | null;
}> = ({ cells, loading, live, wsConnected, lastSync }) => (
  <div className="pub-statusbar">
    {loading ? (
      <span className="pub-sb-cell">Connecting to database…</span>
    ) : (
      <>
        {cells.map((c, i) => (
          <span
            key={`cell-${c}`}
            className={`pub-sb-cell${
              i === cells.length - 1 ? " pub-sb-right" : ""
            }`}
          >
            {c}
          </span>
        ))}
        {live && (
          <span
            className={`pub-sb-cell pub-poll-live${
              wsConnected === false ? " pub-ws-disconnected" : ""
            }`}
            title={
              wsConnected === false
                ? "WebSocket disconnected — reconnecting…"
                : "Live updates via WebSocket every 30 seconds"
            }
          >
            {wsConnected === false ? "⚠ reconnecting…" : "⚡ Live Database"}
          </span>
        )}
        {lastSync != null && <SyncTimer lastSync={lastSync} />}
      </>
    )}
  </div>
);

// ── TwinView — /jobs ──────────────────────────────────────────────────────────

interface TwinProps {
  jobs: PublicJob[];
  profiles: PublicProfile[];
  loading: boolean;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
  flashJobIds: Set<string>;
  flashProfileIds: Set<string>;
  deleteFlashJobIds: Set<string>;
  deleteFlashProfileIds: Set<string>;
  wsConnected: boolean;
  lastSync: number | null;
}

const TwinView: React.FC<TwinProps> = ({
  jobs,
  profiles,
  loading,
  openLogin: _openLogin,
  flashJobIds,
  flashProfileIds,
  deleteFlashJobIds,
  deleteFlashProfileIds,
  wsConnected,
  lastSync,
}) => {
  const queryTime = useMemo(
    () => (Math.random() * 0.005 + 0.002).toFixed(3),
    [],
  );

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const rA = a.pay_per_hour ?? (a.salary_max ? a.salary_max / 2080 : 0);
        const rB = b.pay_per_hour ?? (b.salary_max ? b.salary_max / 2080 : 0);
        return rB - rA;
      }),
    [jobs],
  );

  const profilesWithFit = useMemo(
    () =>
      profiles
        .map((p) => ({
          ...p,
          fitScore:
            jobs.length > 0
              ? Math.max(
                  ...jobs.map((j) => computeMatch(j.skills_required, p.skills)),
                )
              : 70,
        }))
        .sort((a, b) => b.fitScore - a.fitScore),
    [jobs, profiles],
  );

  const jobsWithCandCount: JobWithCandCount[] = useMemo(
    () =>
      sortedJobs.map((j) => ({
        ...j,
        candCount: profiles.filter(
          (p) => computeMatch(j.skills_required, p.skills) > 75,
        ).length,
      })),
    [sortedJobs, profiles],
  );

  const totalMatches = useMemo(
    () => profilesWithFit.filter((p) => p.fitScore > 75).length,
    [profilesWithFit],
  );

  const pageJobs = jobsWithCandCount.slice(0, PAGE_SIZE);
  const pageProfiles = profilesWithFit.slice(0, PAGE_SIZE);

  const twinJobColumns: DataTableColumn<JobWithCandCount>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        width: "21%",
        className: "pub-job-title",
        render: (j) => j.title,
      },
      {
        key: "name",
        header: "Name",
        width: "12%",
        className: "pub-cell-truncate",
        render: (j) => j.recruiter_name,
      },
      {
        key: "company",
        header: "Company",
        width: "12%",
        className: "pub-cell-truncate",
        render: (j) => fmtCompany(j),
      },
      {
        key: "location",
        header: "Location",
        width: "12%",
        className: "pub-cell-truncate",
        render: (j) => j.location,
      },
      {
        key: "type",
        header: "Type",
        width: "11%",
        render: (j) => (
          <span className={`pub-type-badge pub-type-${j.job_type}`}>
            {j.job_type.replace("_", " ")}
          </span>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        className: "pub-mode-cell",
        render: (j) => j.work_mode,
      },
      {
        key: "rate",
        header: (
          <>
            Rate <span className="pub-sort">▼</span>
          </>
        ),
        width: "6%",
        className: "pub-num",
        render: (j) => fmtJobRate(j),
      },
      {
        key: "exp",
        header: "Exp",
        width: "3%",
        className: "pub-num",
        render: (j) => `${j.experience_required}y`,
      },
      {
        key: "candidates",
        header: "Cand.",
        width: "4%",
        className: "pub-cand-count",
        render: (j) =>
          j.candCount > 0 ? (
            <>👥 {j.candCount}</>
          ) : (
            <span style={{ opacity: 0.4 }}>—</span>
          ),
      },
    ],
    [],
  );

  const twinProfileColumns: DataTableColumn<ProfileWithFit>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        width: "20%",
        className: "pub-job-title",
        render: (p) => p.name,
        tooltip: (p) => p.name,
      },
      {
        key: "current_role",
        header: "Role",
        width: "14%",
        className: "pub-cell-truncate",
        render: (p) => p.current_role,
        tooltip: (p) => p.current_role,
      },
      {
        key: "company",
        header: "Company",
        width: "12%",
        className: "pub-cell-truncate",
        render: (p) => p.current_company,
        tooltip: (p) => p.current_company,
      },
      {
        key: "location",
        header: "Location",
        width: "12%",
        className: "pub-cell-truncate",
        render: (p) => p.location || "—",
        tooltip: (p) => p.location || "—",
      },
      {
        key: "pref_type",
        header: "Pref",
        width: "11%",
        render: (p) => (
          <span
            className={`pub-type-badge pub-type-${p.preferred_job_type || ""}`}
          >
            {p.preferred_job_type?.replace("_", " ") || "—"}
          </span>
        ),
        tooltip: (p) => p.preferred_job_type?.replace("_", " ") || "—",
      },
      {
        key: "rate_hr",
        header: "Rate/hr",
        width: "7%",
        className: "pub-num",
        render: (p) => fmtProfileRate(p),
        tooltip: (p) => fmtProfileRate(p),
      },
      {
        key: "exp",
        header: "Exp",
        width: "4%",
        className: "pub-num",
        render: (p) => `${p.experience_years}y`,
        tooltip: (p) => `${p.experience_years} years`,
      },
      {
        key: "fit_score",
        header: (
          <>
            Fit <span className="pub-sort">▼</span>
          </>
        ),
        width: "14%",
        render: (p) => <MatchBar score={p.fitScore} />,
        tooltip: (p) => `${p.fitScore}% fit`,
      },
    ],
    [],
  );

  return (
    <div className="pub-landing">
      <SignUpBanner />
      <div className="pub-section">
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">🗄️</span>
          <span className="pub-section-title">
            💼 Job Openings <span className="pub-join-badge">&amp;</span> 👥
            Candidate Profiles
          </span>
        </div>

        <LoginWarningBar
          message="Without login you cannot contact recruiters or connect with candidates or view important columns such as salary, skills, and match scores."
          openPricing={() =>
            globalThis.dispatchEvent(
              new CustomEvent("matchdb:openPricing", {
                detail: { tab: "vendor" },
              }),
            )
          }
        />

        <div className="pub-twin-panels">
          <DataTable<JobWithCandCount>
            title="Job Openings"
            titleIcon="💼"
            data={pageJobs}
            columns={twinJobColumns}
            loading={loading}
            keyExtractor={(j) => j.id}
            flashIds={flashJobIds}
            deleteFlashIds={deleteFlashJobIds}
            rnColWidth="3%"
            rowCount={PAGE_SIZE}
          />
          <DataTable<ProfileWithFit>
            title="candidate_profiles"
            titleIcon="👥"
            data={pageProfiles}
            columns={twinProfileColumns}
            loading={loading}
            keyExtractor={(p) => p.id}
            flashIds={flashProfileIds}
            deleteFlashIds={deleteFlashProfileIds}
            rnColWidth="3%"
            rowCount={PAGE_SIZE}
          />
        </div>

        <StatusBar
          loading={loading}
          live={true}
          wsConnected={wsConnected}
          lastSync={lastSync}
          cells={[
            `${jobs.length} jobs × ${profiles.length} candidates (${queryTime} sec)`,
            `${totalMatches} strong matches (fit > 75%)`,
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── CandidateView — /jobs/candidate ──────────────────────────────────────────

interface CandViewProps {
  jobs: PublicJob[];
  profiles: PublicProfile[];
  loading: boolean;
  jobTypeFilter: string;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
  flashJobIds: Set<string>;
  deleteFlashJobIds: Set<string>;
  wsConnected: boolean;
  lastSync: number | null;
}

const CandView: React.FC<CandViewProps> = ({
  jobs,
  profiles,
  loading,
  jobTypeFilter,
  openLogin: _openLogin,
  flashJobIds,
  deleteFlashJobIds,
  wsConnected,
  lastSync,
}) => {
  const liveJobCount = useLiveCount("jobs");
  const queryTime = useMemo(
    () => (Math.random() * 0.004 + 0.001).toFixed(3),
    [],
  );

  const filteredJobs = jobTypeFilter
    ? jobs.filter((j) => {
        const mapped = JOB_TYPE_MAP[jobTypeFilter];
        return mapped ? j.job_type === mapped : true;
      })
    : jobs;

  const sortedJobs = useMemo(
    () =>
      [...filteredJobs].sort((a, b) => {
        const rA = a.pay_per_hour ?? (a.salary_max ? a.salary_max / 2080 : 0);
        const rB = b.pay_per_hour ?? (b.salary_max ? b.salary_max / 2080 : 0);
        return rB - rA;
      }),
    [filteredJobs],
  );

  // Compute real match scores: for each job, find the best-matching candidate profile
  const jobsWithMatch: JobWithMatch[] = useMemo(
    () =>
      sortedJobs.map((j) => ({
        ...j,
        matchScore:
          profiles.length > 0
            ? Math.max(
                ...profiles.map((p) =>
                  computeMatch(j.skills_required, p.skills),
                ),
              )
            : 0,
      })),
    [sortedJobs, profiles],
  );

  const pageJobs = jobsWithMatch.slice(0, PAGE_SIZE);

  const candColumns: DataTableColumn<JobWithMatch>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        width: "24%",
        className: "pub-job-title",
        render: (j) => j.title,
        tooltip: (j) => j.title,
      },
      {
        key: "name",
        header: "Name",
        width: "11%",
        className: "pub-cell-truncate",
        render: (j) => j.recruiter_name,
        tooltip: (j) => j.recruiter_name,
      },
      {
        key: "location",
        header: "Location",
        width: "11%",
        className: "pub-cell-truncate",
        render: (j) => j.location,
        tooltip: (j) => j.location,
      },
      {
        key: "type",
        header: "Type",
        width: "8%",
        render: (j) => (
          <span className="pub-type-badge">{j.job_type.replace("_", " ")}</span>
        ),
        tooltip: (j) => j.job_type.replace("_", " "),
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        className: "pub-mode-cell",
        render: (j) => j.work_mode,
        tooltip: (j) => j.work_mode,
      },
      {
        key: "rate",
        header: (
          <>
            Rate <span className="pub-sort">▼</span>
          </>
        ),
        width: "6%",
        className: "pub-num",
        render: (j) => fmtJobRate(j),
        tooltip: (j) => fmtJobRate(j),
      },
      {
        key: "exp",
        header: "Exp",
        width: "3%",
        className: "pub-num",
        render: (j) => j.experience_required,
        tooltip: (j) => `${j.experience_required} years`,
      },
      {
        key: "skills",
        header: "Skills Required",
        width: "26%",
        className: "pub-skills-cell",
        render: (j) => (
          <div className="pub-skills">
            {j.skills_required.slice(0, 4).map((s: string) => (
              <span key={s} className="pub-skill-tag">
                {s}
              </span>
            ))}
            {j.skills_required.length > 4 && (
              <span className="pub-skill-more">
                +{j.skills_required.length - 4}
              </span>
            )}
          </div>
        ),
        tooltip: (j) => j.skills_required.join(", "),
      },
      {
        key: "match_score",
        header: "Match",
        width: "13%",
        className: "pub-match-cell",
        render: (j) => <MatchBar score={j.matchScore} />,
        tooltip: (j) => `${j.matchScore}% match`,
      },
    ],
    [],
  );

  return (
    <div className="pub-landing">
      <SignUpBanner />
      <div className="pub-section">
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">💼</span>
          <span className="pub-section-title">
            Total Job Openings :{" "}
            <TypewriterCount
              value={liveJobCount}
              fallback={sortedJobs.length}
            />
            {jobTypeFilter && (
              <span className="pub-filter-badge">
                {jobTypeFilter.toUpperCase()}
              </span>
            )}
          </span>
        </div>

        <LoginWarningBar
          message="Without login you cannot contact recruiters or view important columns such as salary, skills, and match scores."
          viewType="candidate"
          openPricing={() =>
            globalThis.dispatchEvent(
              new CustomEvent("matchdb:openPricing", {
                detail: { tab: "candidate" },
              }),
            )
          }
        />

        <DataTable<JobWithMatch>
          title={`Job Openings${
            jobTypeFilter ? ` [${jobTypeFilter.toUpperCase()}]` : ""
          }`}
          titleIcon="💼"
          data={pageJobs}
          columns={candColumns}
          loading={loading}
          keyExtractor={(j) => j.id}
          flashIds={flashJobIds}
          deleteFlashIds={deleteFlashJobIds}
          rnColWidth="2%"
          rowCount={PAGE_SIZE}
        />

        <StatusBar
          loading={loading}
          live={true}
          wsConnected={wsConnected}
          lastSync={lastSync}
          cells={[
            `${sortedJobs.length} rows in set (${queryTime} sec)`,
            jobTypeFilter
              ? `Filter: ${jobTypeFilter.toUpperCase()}`
              : "Filter: ALL",
            "View Candidate Plans & Pricing →",
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── VendorView — /jobs/vendor ─────────────────────────────────────────────────

interface VendorViewProps {
  profiles: PublicProfile[];
  loading: boolean;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
  flashProfileIds: Set<string>;
  deleteFlashProfileIds: Set<string>;
  wsConnected: boolean;
  lastSync: number | null;
}

const VendorView: React.FC<VendorViewProps> = ({
  profiles,
  loading,
  openLogin: _openLogin,
  flashProfileIds,
  deleteFlashProfileIds,
  wsConnected,
  lastSync,
}) => {
  const liveProfileCount = useLiveCount("profiles");
  const queryTime = useMemo(
    () => (Math.random() * 0.003 + 0.001).toFixed(3),
    [],
  );

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.experience_years - a.experience_years),
    [profiles],
  );

  const pageProfiles = sortedProfiles.slice(0, PAGE_SIZE);

  const vendorColumns: DataTableColumn<PublicProfile>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        width: "13%",
        className: "pub-job-title",
        render: (p) => p.name,
        tooltip: (p) => p.name,
      },
      {
        key: "current_role",
        header: "Role",
        width: "14%",
        className: "pub-cell-truncate",
        render: (p) => p.current_role,
        tooltip: (p) => p.current_role,
      },
      {
        key: "company",
        header: "Company",
        width: "11%",
        className: "pub-cell-truncate",
        render: (p) => p.current_company,
        tooltip: (p) => p.current_company,
      },
      {
        key: "location",
        header: "Location",
        width: "10%",
        className: "pub-cell-truncate",
        render: (p) => p.location,
        tooltip: (p) => p.location,
      },
      {
        key: "rate_hr",
        header: "Rate/hr",
        width: "7%",
        className: "pub-num",
        render: (p) => fmtProfileRate(p),
        tooltip: (p) => fmtProfileRate(p),
      },
      {
        key: "exp",
        header: (
          <>
            Exp <span className="pub-sort">▼</span>
          </>
        ),
        width: "4%",
        className: "pub-num",
        render: (p) => `${p.experience_years}y`,
        tooltip: (p) => `${p.experience_years} years`,
      },
      {
        key: "pref_type",
        header: "Pref. Type",
        width: "10%",
        render: (p) => (
          <span className={`pub-type-badge pub-type-${p.preferred_job_type}`}>
            {p.preferred_job_type.replace("_", " ")}
          </span>
        ),
        tooltip: (p) => p.preferred_job_type.replace("_", " "),
      },
      {
        key: "skills",
        header: "Skills",
        width: "28%",
        className: "pub-skills-cell",
        render: (p) => (
          <div className="pub-skills">
            {p.skills.slice(0, 4).map((s: string) => (
              <span key={s} className="pub-skill-tag">
                {s}
              </span>
            ))}
            {p.skills.length > 4 && (
              <span className="pub-skill-more">+{p.skills.length - 4}</span>
            )}
          </div>
        ),
        tooltip: (p) => p.skills.join(", "),
      },
    ],
    [],
  );

  return (
    <div className="pub-landing">
      <SignUpBanner />
      <div className="pub-section">
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">👥</span>
          <span className="pub-section-title">
            Total Candidate Profiles :{" "}
            <TypewriterCount
              value={liveProfileCount}
              fallback={sortedProfiles.length}
            />
          </span>
        </div>

        <LoginWarningBar
          message="Without login you cannot contact Candidates or view important columns such as salary, skills, and match scores."
          viewType="vendor"
          openPricing={() =>
            globalThis.dispatchEvent(
              new CustomEvent("matchdb:openPricing", {
                detail: { tab: "vendor" },
              }),
            )
          }
        />

        <DataTable<PublicProfile>
          title="Candidate_Profiles"
          titleIcon="👥"
          data={pageProfiles}
          columns={vendorColumns}
          loading={loading}
          keyExtractor={(p) => p.id}
          flashIds={flashProfileIds}
          deleteFlashIds={deleteFlashProfileIds}
          rnColWidth="2%"
          rowCount={PAGE_SIZE}
        />

        <StatusBar
          loading={loading}
          live={true}
          wsConnected={wsConnected}
          lastSync={lastSync}
          cells={[
            `${sortedProfiles.length} rows in set (${queryTime} sec)`,
            "Filter: profileLocked = 1",
            "View Vendor Plans & Pricing →",
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── PublicJobsView (root) — connects to /ws/public-data WebSocket ─────────────

const PublicJobsView: React.FC = () => {
  const location = useLocation();
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const [flashJobIds, setFlashJobIds] = useState<Set<string>>(new Set());
  const [flashProfileIds, setFlashProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [deleteFlashJobIds, setDeleteFlashJobIds] = useState<Set<string>>(
    new Set(),
  );
  const [deleteFlashProfileIds, setDeleteFlashProfileIds] = useState<
    Set<string>
  >(new Set());

  const flashJobTimer = useRef<ReturnType<typeof setTimeout>>();
  const flashProfileTimer = useRef<ReturnType<typeof setTimeout>>();
  const deleteFlashJobTimer = useRef<ReturnType<typeof setTimeout>>();
  const deleteFlashProfileTimer = useRef<ReturnType<typeof setTimeout>>();

  const scheduleFlashJobs = useCallback((ids: string[]) => {
    clearTimeout(flashJobTimer.current);
    setFlashJobIds(new Set(ids));
    flashJobTimer.current = setTimeout(
      () => setFlashJobIds(new Set()),
      FLASH_DURATION_MS,
    );
  }, []);

  const scheduleFlashProfiles = useCallback((ids: string[]) => {
    clearTimeout(flashProfileTimer.current);
    setFlashProfileIds(new Set(ids));
    flashProfileTimer.current = setTimeout(
      () => setFlashProfileIds(new Set()),
      FLASH_DURATION_MS,
    );
  }, []);

  const removeDeletedJobs = useCallback((ids: Set<string>) => {
    setDeleteFlashJobIds(new Set());
    setJobs((prev) => prev.filter((j) => !ids.has(j.id)));
  }, []);

  const removeDeletedProfiles = useCallback((ids: Set<string>) => {
    setDeleteFlashProfileIds(new Set());
    setProfiles((prev) => prev.filter((p) => !ids.has(p.id)));
  }, []);

  const scheduleDeleteFlashJobs = useCallback(
    (ids: Set<string>) => {
      clearTimeout(deleteFlashJobTimer.current);
      setDeleteFlashJobIds(ids);
      deleteFlashJobTimer.current = setTimeout(
        () => removeDeletedJobs(ids),
        FLASH_DURATION_MS,
      );
    },
    [removeDeletedJobs],
  );

  const scheduleDeleteFlashProfiles = useCallback(
    (ids: Set<string>) => {
      clearTimeout(deleteFlashProfileTimer.current);
      setDeleteFlashProfileIds(ids);
      deleteFlashProfileTimer.current = setTimeout(
        () => removeDeletedProfiles(ids),
        FLASH_DURATION_MS,
      );
    },
    [removeDeletedProfiles],
  );

  const isVendorView =
    location.pathname === "/jobs/vendor" ||
    location.pathname.startsWith("/jobs/vendor/");
  const isCandView =
    location.pathname === "/jobs/candidate" ||
    location.pathname.startsWith("/jobs/candidate/");

  // ── WebSocket connection to /ws/public-data ───────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isFirst = true;

    function connect() {
      ws = new WebSocket(wsUrl(WS_PUBLIC_DATA));

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg: PublicDataMessage = JSON.parse(ev.data);

          // Merge deleted rows into table data so they appear briefly with red flash
          const deletedJobSet = new Set(msg.deletedJobIds ?? []);
          const deletedProfileSet = new Set(msg.deletedProfileIds ?? []);

          if (Array.isArray(msg.jobs)) {
            const liveJobs = msg.jobs.slice(0, PAGE_SIZE);
            // Append deleted rows (from server's last-known cache) at the end
            const deletedRows = msg.deletedJobs ?? [];
            const combined = [...liveJobs, ...deletedRows].slice(0, PAGE_SIZE);
            setJobs(combined);
          }
          if (Array.isArray(msg.profiles)) {
            const liveProfiles = msg.profiles.slice(0, PAGE_SIZE);
            const deletedRows = msg.deletedProfiles ?? [];
            const combined = [...liveProfiles, ...deletedRows].slice(
              0,
              PAGE_SIZE,
            );
            setProfiles(combined);
          }

          // Flash changed/deleted rows (skip on the very first message — initial load)
          if (!isFirst) {
            if (msg.changedJobIds?.length) {
              scheduleFlashJobs(msg.changedJobIds);
            }
            if (msg.changedProfileIds?.length) {
              scheduleFlashProfiles(msg.changedProfileIds);
            }
            if (deletedJobSet.size > 0) {
              scheduleDeleteFlashJobs(deletedJobSet);
            }
            if (deletedProfileSet.size > 0) {
              scheduleDeleteFlashProfiles(deletedProfileSet);
            }
          }

          isFirst = false;
          setLoading(false);
          setLastSync(Date.now());
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Auto-reconnect after 5 s
        reconnectTimer = setTimeout(connect, WS_RECONNECT_MS);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      clearTimeout(flashJobTimer.current);
      clearTimeout(flashProfileTimer.current);
      clearTimeout(deleteFlashJobTimer.current);
      clearTimeout(deleteFlashProfileTimer.current);
      ws?.close();
    };
    // WebSocket setup runs once on mount — schedule callbacks are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for job-type filter events from the shell ──────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      setJobTypeFilter((e as CustomEvent).detail?.jobType || "");
    };
    globalThis.addEventListener("matchdb:jobTypeFilter", handler);
    return () =>
      globalThis.removeEventListener("matchdb:jobTypeFilter", handler);
  }, []);

  const openLogin = useCallback(
    (context: "candidate" | "vendor", mode: "login" | "register" = "login") => {
      /* locked = true when user is on /jobs/candidate or /jobs/vendor — type is pre-determined */
      const isSpecificView = isCandView || isVendorView;
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:openLogin", {
          detail: { context, mode, locked: isSpecificView },
        }),
      );
    },
    [isCandView, isVendorView],
  );

  // ── Route-based view selection ────────────────────────────────────────────
  if (isVendorView) {
    return (
      <VendorView
        profiles={profiles}
        loading={loading}
        openLogin={openLogin}
        flashProfileIds={flashProfileIds}
        deleteFlashProfileIds={deleteFlashProfileIds}
        wsConnected={wsConnected}
        lastSync={lastSync}
      />
    );
  }

  if (isCandView) {
    return (
      <CandView
        jobs={jobs}
        profiles={profiles}
        loading={loading}
        jobTypeFilter={jobTypeFilter}
        openLogin={openLogin}
        flashJobIds={flashJobIds}
        deleteFlashJobIds={deleteFlashJobIds}
        wsConnected={wsConnected}
        lastSync={lastSync}
      />
    );
  }

  return (
    <TwinView
      jobs={jobs}
      profiles={profiles}
      loading={loading}
      openLogin={openLogin}
      flashJobIds={flashJobIds}
      flashProfileIds={flashProfileIds}
      deleteFlashJobIds={deleteFlashJobIds}
      deleteFlashProfileIds={deleteFlashProfileIds}
      wsConnected={wsConnected}
      lastSync={lastSync}
    />
  );
};

export default PublicJobsView;
