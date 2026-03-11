import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MatchDataTable, { MatchRow } from "../components/MatchDataTable";
import DBLayout, { NavGroup } from "../components/DBLayout";
import DetailModal from "../components/DetailModal";
import JobPostingModal from "../components/JobPostingModal";
import PokeEmailModal from "../components/PokeEmailModal";
import { PokesTable } from "../shared";
import { DataTable, Button, Input, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import { useAutoRefreshFlash } from "../hooks/useAutoRefreshFlash";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import {
  useGetVendorJobsQuery,
  useGetVendorCandidateMatchesQuery,
  useGetPokesSentQuery,
  useGetPokesReceivedQuery,
  useSendPokeMutation,
  useCloseJobMutation,
  useReopenJobMutation,
  type Job,
  type CandidateProfileMatch,
  type PokeRecord,
  type PaginatedResponse,
  type VendorJobsArgs,
  type VendorCandidateMatchesArgs,
  type SendPokeArgs,
} from "../api/jobsApi";

interface Props {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
  plan?: string;
  onPostJob?: () => void;
}

const formatRate = (value?: number | null) =>
  value ? `$${Number(value).toFixed(0)}` : "-";
const formatExperience = (value?: number | null) => `${Number(value || 0)} yrs`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
};
const SUB_LABELS: Record<string, string> = {
  c2c: "C2C",
  c2h: "C2H",
  w2: "W2",
  "1099": "1099",
  direct_hire: "Direct Hire",
  salary: "Salary",
};
const MODE_LABELS: Record<string, string> = {
  remote: "Remote",
  onsite: "On-Site",
  hybrid: "Hybrid",
};

const JOB_LIMIT: Record<string, number> = {
  free: 0,
  basic: 5,
  pro: 10,
  pro_plus: 20,
  enterprise: Infinity,
};
const POKE_LIMIT: Record<string, number> = {
  free: 0,
  basic: 25,
  pro: 50,
  pro_plus: Infinity,
  enterprise: Infinity,
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  IN: "🇮🇳",
  GB: "🇬🇧",
  CA: "🇨🇦",
  AU: "🇦🇺",
  DE: "🇩🇪",
  SG: "🇸🇬",
  AE: "🇦🇪",
  JP: "🇯🇵",
  NL: "🇳🇱",
  FR: "🇫🇷",
  BR: "🇧🇷",
  MX: "🇲🇽",
  PH: "🇵🇭",
  IL: "🇮🇱",
  IE: "🇮🇪",
  PL: "🇵🇱",
  SE: "🇸🇪",
  CH: "🇨🇭",
  KR: "🇰🇷",
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  SG: "Singapore",
  AE: "UAE",
  JP: "Japan",
  NL: "Netherlands",
  FR: "France",
  BR: "Brazil",
  MX: "Mexico",
  PH: "Philippines",
  IL: "Israel",
  IE: "Ireland",
  PL: "Poland",
  SE: "Sweden",
  CH: "Switzerland",
  KR: "South Korea",
};

type ViewMode =
  | "candidates"
  | "postings"
  | "active-openings"
  | "pokes-sent"
  | "pokes-received"
  | "mails-sent"
  | "mails-received";

/** Color badge for count thresholds */
const countColor = (n: number): string =>
  n >= 50 ? "#2e7d32" : n >= 25 ? "#b8860b" : n >= 10 ? "#d4600a" : "#bb3333";
const countBg = (n: number): string =>
  n >= 50 ? "#e8f5e9" : n >= 25 ? "#fffde6" : n >= 10 ? "#fff3e0" : "#fff5f5";

/** Column definitions for the job postings table are built inside the component
 *  via useMemo so that render functions can close over handlers and state. */

const VendorDashboard: React.FC<Props> = ({
  token,
  userEmail,
  plan = "free",
  onPostJob,
}) => {
  // ── RTK Query data hooks ───────────────────────────────────────────────────
  const [jobsArgs, setJobsArgs] = useState<VendorJobsArgs>({});
  const [matchArgs, setMatchArgs] = useState<VendorCandidateMatchesArgs>({});
  const {
    data: jobsData,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useGetVendorJobsQuery(jobsArgs);
  const {
    data: matchesData,
    isLoading: matchesLoading,
    refetch: refetchMatches,
  } = useGetVendorCandidateMatchesQuery(matchArgs);
  const {
    data: pokesSentData = [],
    isLoading: pokesSentLoading,
    refetch: refetchPokesSent,
  } = useGetPokesSentQuery();
  const { data: pokesReceivedData = [], refetch: refetchPokesReceived } =
    useGetPokesReceivedQuery();
  const [
    sendPoke,
    {
      isLoading: pokeLoading,
      isSuccess: pokeSent,
      isError: pokeError,
      reset: clearPokeState,
    },
  ] = useSendPokeMutation();
  const [closeJobMutation] = useCloseJobMutation();
  const [reopenJobMutation] = useReopenJobMutation();

  // Derive flat arrays from paginated-or-array responses
  const vendorJobs: Job[] = Array.isArray(jobsData)
    ? jobsData
    : (jobsData as PaginatedResponse<Job>)?.data ?? [];
  const vendorJobsTotal: number = Array.isArray(jobsData)
    ? jobsData.length
    : (jobsData as PaginatedResponse<Job>)?.total ?? 0;
  const vendorCandidateMatches: CandidateProfileMatch[] = Array.isArray(
    matchesData,
  )
    ? matchesData
    : (matchesData as PaginatedResponse<CandidateProfileMatch>)?.data ?? [];
  const vendorCandidateMatchesTotal: number = Array.isArray(matchesData)
    ? matchesData.length
    : (matchesData as PaginatedResponse<CandidateProfileMatch>)?.total ?? 0;

  const pokesSent: PokeRecord[] = pokesSentData;
  const pokesReceived: PokeRecord[] = pokesReceivedData;
  const pokesLoading = pokesSentLoading;

  // Derive a string message for MatchDataTable's pokeSuccessMessage prop
  const pokeSuccessMessage: string | null = pokeSent ? "Poke sent!" : null;

  // URL-driven navigation — browser back/forward for free
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: ViewMode =
    (searchParams.get("view") as ViewMode) || "postings";
  const selectedJobId = searchParams.get("job") || "";

  const setViewMode = (mode: ViewMode) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", mode);
      return next;
    });
  };
  const setSelectedJobId = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("job", id);
      else next.delete("job");
      return next;
    });
  };
  /** Combined setter — avoids stale-searchParams race when both change at once */
  const navigateToJob = (jobId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", "candidates");
      if (jobId) next.set("job", jobId);
      else next.delete("job");
      return next;
    });
  };
  /** Navigate to a view with an optional job filter */
  const navigateToView = (mode: ViewMode, jobId?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", mode);
      if (jobId) next.set("job", jobId);
      else next.delete("job");
      return next;
    });
  };

  // On mount: stamp ?view=postings if no view param exists yet (e.g. fresh login)
  useEffect(() => {
    if (!searchParams.get("view")) {
      setSearchParams(
        (prev) => { const next = new URLSearchParams(prev); next.set("view", "postings"); return next; },
        { replace: true },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [searchText, setSearchText] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Record<
    string,
    any
  > | null>(null);
  const [selectedJobPosting, setSelectedJobPosting] = useState<Job | null>(
    null,
  );
  const [postingSearch, setPostingSearch] = useState("");
  const [closingJobId, setClosingJobId] = useState<string | null>(null);
  const [pricingBlur, setPricingBlur] = useState(false);
  const [pokeEmailRow, setPokeEmailRow] = useState<MatchRow | null>(null);
  const [pokeEmailSentSuccess, setPokeEmailSentSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(25);

  // Derive poke/email tracking from server-side pokesSent data
  const pokedRowIds = useMemo(
    () => new Set(pokesSent.filter((p) => !p.is_email).map((p) => p.target_id)),
    [pokesSent],
  );
  const emailedRowIds = useMemo(
    () => new Set(pokesSent.filter((p) => p.is_email).map((p) => p.target_id)),
    [pokesSent],
  );
  const pokeCount = useMemo(
    () => pokesSent.filter((p) => !p.is_email).length,
    [pokesSent],
  );
  const emailCount = useMemo(
    () => pokesSent.filter((p) => p.is_email).length,
    [pokesSent],
  );

  // target_id → poke created_at (passed to MatchDataTable for 24h mail cooldown)
  const pokedAtMap = useMemo(
    () =>
      new Map(
        pokesSent
          .filter((p) => !p.is_email)
          .map((p) => [p.target_id, p.created_at]),
      ),
    [pokesSent],
  );

  // Pre-filtered lists for Pokes / Mails sections
  const pokesSentOnly = useMemo(
    () => pokesSent.filter((p) => !p.is_email),
    [pokesSent],
  );
  const mailsSentOnly = useMemo(
    () => pokesSent.filter((p) => p.is_email),
    [pokesSent],
  );

  // Per-job poke and mail counts
  const pokesPerJob = useMemo(() => {
    const map: Record<string, number> = {};
    pokesSentOnly.forEach((p) => {
      if (p.job_id) map[p.job_id] = (map[p.job_id] || 0) + 1;
    });
    return map;
  }, [pokesSentOnly]);
  const mailsPerJob = useMemo(() => {
    const map: Record<string, number> = {};
    mailsSentOnly.forEach((p) => {
      if (p.job_id) map[p.job_id] = (map[p.job_id] || 0) + 1;
    });
    return map;
  }, [mailsSentOnly]);
  const pokesReceivedOnly = useMemo(
    () => pokesReceived.filter((p) => !p.is_email),
    [pokesReceived],
  );
  const mailsReceivedOnly = useMemo(
    () => pokesReceived.filter((p) => p.is_email),
    [pokesReceived],
  );

  const openPricingModal = () => {
    setPricingBlur(true);
    window.dispatchEvent(
      new CustomEvent("matchdb:openPricing", { detail: { tab: "vendor" } }),
    );
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    window.addEventListener("matchdb:pricingClosed", onClose);
    return () => window.removeEventListener("matchdb:pricingClosed", onClose);
  }, []);

  const handlePageChange = (page: number, pageSize: number) => {
    setCurrentPage(page);
    setCurrentPageSize(pageSize);
    setMatchArgs({
      job_id: selectedJobId || undefined,
      page,
      limit: pageSize,
    });
  };

  const jobLimit = JOB_LIMIT[plan] ?? 0;
  const pokeLimit = POKE_LIMIT[plan] ?? 0;
  const activeJobs = vendorJobs.filter((j) => j.is_active);
  const activeJobCount = activeJobs.length;
  const atJobLimit = isFinite(jobLimit) && activeJobCount >= jobLimit;

  // Dispatch vendor's primary location to shell (derived from most-posted job location)
  useEffect(() => {
    if (vendorJobs.length > 0) {
      const loc = vendorJobs.find((j) => j.location)?.location || "";
      if (loc) {
        window.dispatchEvent(
          new CustomEvent("matchdb:profileLocation", {
            detail: { location: loc },
          }),
        );
      }
    }
  }, [vendorJobs]);

  // Dispatch "Visible in" banner for vendor — with country flags
  useEffect(() => {
    const postedCountries = Array.from(
      new Set(
        vendorJobs
          .filter((j) => j.is_active && j.job_country)
          .map((j) => j.job_country!),
      ),
    );
    if (postedCountries.length > 0) {
      const countryLabels = postedCountries
        .map(
          (code) =>
            `${COUNTRY_FLAGS[code] || ""} ${COUNTRY_NAMES[code] || code}`,
        )
        .join(" · ");
      const text = `Hiring in: ${countryLabels} — ${
        activeJobs.length
      } active opening${activeJobs.length !== 1 ? "s" : ""}.`;
      window.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text } }),
      );
    }
    return () => {
      window.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text: "" } }),
      );
    };
  }, [vendorJobs]);

  // Emit footer info for shell to display
  useEffect(() => {
    const count =
      viewMode === "active-openings"
        ? activeJobs.length
        : viewMode === "postings"
        ? vendorJobs.length
        : viewMode === "candidates"
        ? vendorCandidateMatchesTotal
        : viewMode === "pokes-sent"
        ? pokesSentOnly.length
        : viewMode === "pokes-received"
        ? pokesReceivedOnly.length
        : viewMode === "mails-sent"
        ? mailsSentOnly.length
        : viewMode === "mails-received"
        ? mailsReceivedOnly.length
        : 0;
    window.dispatchEvent(
      new CustomEvent("matchdb:footerInfo", {
        detail: {
          text: `Showing ${count} row${count !== 1 ? "s" : ""} | InnoDB`,
        },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("matchdb:footerInfo", { detail: { text: "" } }),
      );
    };
  }, [
    viewMode,
    vendorJobs.length,
    activeJobs.length,
    vendorCandidateMatchesTotal,
    pokesSentOnly.length,
    pokesReceivedOnly.length,
    mailsSentOnly.length,
    mailsReceivedOnly.length,
  ]);

  useEffect(() => {
    if (viewMode === "candidates") {
      setCurrentPage(1);
      setMatchArgs({
        job_id: selectedJobId || undefined,
        page: 1,
        limit: currentPageSize,
      });
    }
  }, [selectedJobId, viewMode]);

  useEffect(() => {
    return () => {
      clearPokeState();
    };
  }, []);

  /* ── Auto-refresh + flash animations (30 s cycle) ── */
  const refreshAll = useCallback(() => {
    refetchJobs();
    refetchPokesSent();
    refetchPokesReceived();
    if (viewMode === "candidates") {
      refetchMatches();
    }
  }, [
    refetchJobs,
    refetchPokesSent,
    refetchPokesReceived,
    refetchMatches,
    viewMode,
  ]);

  // Live push: fires refreshAll immediately when data-collection uploads new data
  useLiveRefresh({ onRefresh: refreshAll });

  const jobsFlash = useAutoRefreshFlash({
    data: vendorJobs,
    keyExtractor: (j: Job) => j.id,
    refresh: refreshAll,
  });
  const pokesFlash = useAutoRefreshFlash({
    data: pokesSent,
    keyExtractor: (p) => p.id,
    refresh: refreshAll,
    enabled: false, // shares interval with jobsFlash
  });
  const pokesRecvFlash = useAutoRefreshFlash({
    data: pokesReceived,
    keyExtractor: (p) => p.id,
    refresh: refreshAll,
    enabled: false,
  });
  const candidatesFlash = useAutoRefreshFlash({
    data: vendorCandidateMatches,
    keyExtractor: (c) => c.id,
    refresh: refreshAll,
    enabled: false,
  });

  /* ── Candidate matches rows ── */
  const rows = useMemo<MatchRow[]>(() => {
    return vendorCandidateMatches
      .filter((candidate) => {
        const q = searchText.trim().toLowerCase();
        if (!q) return true;
        return (
          candidate.name?.toLowerCase().includes(q) ||
          candidate.current_role?.toLowerCase().includes(q) ||
          candidate.location?.toLowerCase().includes(q) ||
          candidate.email?.toLowerCase().includes(q)
        );
      })
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name || "-",
        company: candidate.current_company || "-",
        email: candidate.email || "-",
        phone: candidate.phone || "-",
        role: candidate.current_role || "-",
        type: candidate.preferred_job_type || "-",
        payPerHour: formatRate(candidate.expected_hourly_rate),
        experience: formatExperience(candidate.experience_years),
        matchPercentage: candidate.match_percentage || 0,
        location: candidate.location || "-",
        pokeTargetEmail: candidate.email || "",
        pokeTargetName: candidate.name || "Candidate",
        pokeSubjectContext: candidate.matched_job_title || "Job opening",
        rawData: candidate as unknown as Record<string, unknown>,
      }));
  }, [searchText, vendorCandidateMatches]);

  /* ── Close / Reopen a job ── */
  const handleCloseJob = async (jobId: string) => {
    setClosingJobId(jobId);
    await closeJobMutation(jobId).unwrap();
    setClosingJobId(null);
    setSelectedJobPosting((prev) =>
      prev?.id === jobId ? { ...prev, is_active: false } : prev,
    );
  };

  const handleReopenJob = async (jobId: string) => {
    setClosingJobId(jobId);
    await reopenJobMutation(jobId).unwrap();
    setClosingJobId(null);
    setSelectedJobPosting((prev) =>
      prev?.id === jobId ? { ...prev, is_active: true } : prev,
    );
  };

  /* ── Job postings table columns (with render functions) ── */
  const postingsColumns = useMemo<DataTableColumn<Job>[]>(
    () => [
      {
        key: "expand",
        header: "⊕",
        width: "22px",
        align: "center" as const,
        skeletonWidth: 22,
        thProps: { title: "Click to view full posting" },
        render: (job: Job) => (
          <Button
            variant="expand"
            title="View full job posting"
            onClick={() => setSelectedJobPosting(job)}
          >
            ⊕
          </Button>
        ),
      },
      {
        key: "title",
        header: "Title",
        width: "14%",
        skeletonWidth: 100,
        render: (job: Job) => <>{job.title}</>,
        tooltip: (job: Job) => job.title,
      },
      {
        key: "status",
        header: "Status",
        width: "7%",
        skeletonWidth: 55,
        thProps: { title: "Whether the job is accepting applications" },
        render: (job: Job) => (
          <span
            className={`matchdb-type-pill vdp-status${
              job.is_active ? "-active" : "-closed"
            }`}
          >
            {job.is_active ? "● Active" : "● Closed"}
          </span>
        ),
      },
      {
        key: "loc",
        header: "Location",
        width: "9%",
        skeletonWidth: 70,
        thProps: { title: "Job location" },
        render: (job: Job) => (
          <>
            {job.job_country
              ? `${COUNTRY_FLAGS[job.job_country] || ""} ${
                  job.location ||
                  COUNTRY_NAMES[job.job_country] ||
                  job.job_country
                }`
              : job.location || "—"}
          </>
        ),
        tooltip: (job: Job) => job.location || "—",
      },
      {
        key: "type",
        header: "Type",
        width: "10%",
        skeletonWidth: 80,
        thProps: { title: "Employment type and sub-type" },
        render: (job: Job) => {
          const typeStr = TYPE_LABELS[job.job_type] || job.job_type || "-";
          const subStr = job.job_sub_type
            ? ` › ${
                SUB_LABELS[job.job_sub_type] || job.job_sub_type.toUpperCase()
              }`
            : "";
          return (
            <span className="matchdb-type-pill">
              {typeStr}
              {subStr}
            </span>
          );
        },
        tooltip: (job: Job) => {
          const typeStr = TYPE_LABELS[job.job_type] || job.job_type || "-";
          const subStr = job.job_sub_type
            ? ` › ${
                SUB_LABELS[job.job_sub_type] || job.job_sub_type.toUpperCase()
              }`
            : "";
          return `${typeStr}${subStr}`;
        },
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        skeletonWidth: 50,
        thProps: { title: "Work arrangement" },
        render: (job: Job) => (
          <>
            {job.work_mode ? MODE_LABELS[job.work_mode] || job.work_mode : "—"}
          </>
        ),
      },
      {
        key: "pay",
        header: "Pay/Hr",
        width: "6%",
        skeletonWidth: 50,
        thProps: { title: "Pay rate per hour" },
        render: (job: Job) => <>{formatRate(job.pay_per_hour)}</>,
      },
      {
        key: "exp",
        header: "Exp",
        width: "5%",
        skeletonWidth: 40,
        thProps: { title: "Years of experience required" },
        render: (job: Job) => (
          <>
            {job.experience_required != null
              ? `${job.experience_required}y`
              : "—"}
          </>
        ),
      },
      {
        key: "skills",
        header: "Skills",
        width: "5%",
        skeletonWidth: 40,
        thProps: { title: "Required skills count" },
        render: (job: Job) => <>{job.skills_required?.length ?? 0}</>,
      },
      {
        key: "pokes",
        header: "Pokes",
        width: "5%",
        skeletonWidth: 40,
        thProps: { title: "Pokes sent for this opening" },
        render: (job: Job) => {
          const n_poke = pokesPerJob[job.id] || 0;
          return (
            <Button
              style={{
                fontSize: 11,
                padding: "0 6px",
                height: 20,
                minWidth: 28,
                fontWeight: 700,
                color: countColor(n_poke),
                background: countBg(n_poke),
                border: `1px solid ${countColor(n_poke)}40`,
              }}
              title={
                n_poke > 0
                  ? `View ${n_poke} poke${n_poke !== 1 ? "s" : ""} sent for "${
                      job.title
                    }"`
                  : "No pokes sent"
              }
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("view", "pokes-sent");
                  next.set("job", job.id);
                  return next;
                })
              }
            >
              {n_poke}
            </Button>
          );
        },
      },
      {
        key: "mails",
        header: "Mails",
        width: "5%",
        skeletonWidth: 40,
        thProps: { title: "Mails sent for this opening" },
        render: (job: Job) => {
          const n_mail = mailsPerJob[job.id] || 0;
          return (
            <Button
              style={{
                fontSize: 11,
                padding: "0 6px",
                height: 20,
                minWidth: 28,
                fontWeight: 700,
                color: countColor(n_mail),
                background: countBg(n_mail),
                border: `1px solid ${countColor(n_mail)}40`,
              }}
              title={
                n_mail > 0
                  ? `View ${n_mail} mail${n_mail !== 1 ? "s" : ""} sent for "${
                      job.title
                    }"`
                  : "No mails sent"
              }
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("view", "mails-sent");
                  next.set("job", job.id);
                  return next;
                })
              }
            >
              {n_mail}
            </Button>
          );
        },
      },
      {
        key: "posted",
        header: "Posted",
        width: "8%",
        skeletonWidth: 70,
        thProps: { title: "Date job was posted" },
        render: (job: Job) => <>{fmtDate(job.created_at)}</>,
      },
      {
        key: "matches",
        header: "Matches",
        width: "7%",
        skeletonWidth: 60,
        thProps: { title: "View matching candidates for this job" },
        render: (job: Job) => (
          <Button
            variant="matches"
            disabled={!job.is_active}
            title={
              job.is_active
                ? `View candidates matched to "${job.title}"`
                : "Position is closed — reopen to view matches"
            }
            onClick={() =>
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("view", "candidates");
                next.set("job", job.id);
                return next;
              })
            }
          >
            👥 View
          </Button>
        ),
      },
      {
        key: "action",
        header: "Action",
        width: "8%",
        skeletonWidth: 60,
        thProps: { title: "Close or reopen this position" },
        render: (job: Job) =>
          job.is_active ? (
            <Button
              variant="close"
              disabled={closingJobId === job.id}
              onClick={() => handleCloseJob(job.id)}
              title="Close this position — stop accepting applications"
            >
              {closingJobId === job.id ? "..." : "🔒 Close"}
            </Button>
          ) : (
            <Button
              variant="reopen"
              disabled={closingJobId === job.id}
              onClick={() => handleReopenJob(job.id)}
              title="Reopen this position — resume accepting applications"
            >
              {closingJobId === job.id ? "..." : "✔ Reopen"}
            </Button>
          ),
      },
    ],
    [
      pokesPerJob,
      mailsPerJob,
      closingJobId,
      setSearchParams,
      setSelectedJobPosting,
      handleCloseJob,
      handleReopenJob,
    ],
  );

  /* ── Filtered postings ── */
  const filteredPostings = useMemo(() => {
    const q = postingSearch.trim().toLowerCase();
    if (!q) return vendorJobs;
    return vendorJobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.job_type?.toLowerCase().includes(q),
    );
  }, [vendorJobs, postingSearch]);

  /* ── Filtered active openings (search-aware) ── */
  const filteredActivePostings = useMemo(() => {
    const q = postingSearch.trim().toLowerCase();
    if (!q) return activeJobs;
    return activeJobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.job_type?.toLowerCase().includes(q),
    );
  }, [activeJobs, postingSearch]);

  const selectedJobTitle = selectedJobId
    ? vendorJobs.find((j) => j.id === selectedJobId)?.title || "Job"
    : "All Openings";

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail) return;
    if (isFinite(pokeLimit) && pokeCount >= pokeLimit) return;
    clearPokeState();
    sendPoke({
      to_email: row.pokeTargetEmail,
      to_name: row.pokeTargetName,
      subject_context: row.pokeSubjectContext,
      target_id: row.id,
      is_email: false,
      sender_name: userEmail?.split("@")[0] || "Vendor",
      sender_email: userEmail || "",
      job_id: selectedJobId || undefined,
      job_title: selectedJobId ? selectedJobTitle : undefined,
    });
  };

  const handlePokeEmail = (row: MatchRow) => {
    clearPokeState();
    setPokeEmailSentSuccess(false);
    setPokeEmailRow(row);
  };

  const handlePokeEmailSend = async (params: {
    to_email: string;
    to_name: string;
    subject_context: string;
    email_body: string;
    pdf_data?: string;
  }) => {
    if (!pokeEmailRow) return;
    try {
      await sendPoke({
        to_email: params.to_email,
        to_name: params.to_name,
        subject_context: params.subject_context,
        email_body: params.email_body,
        target_id: pokeEmailRow.id,
        is_email: true,
        sender_name: userEmail?.split("@")[0] || "Vendor",
        sender_email: userEmail || "",
        job_id: selectedJobId || undefined,
        job_title: selectedJobId ? selectedJobTitle : undefined,
      }).unwrap();
      setPokeEmailSentSuccess(true);
      refetchPokesSent();
      setTimeout(() => {
        setPokeEmailSentSuccess(false);
        setPokeEmailRow(null);
        clearPokeState();
      }, 2000);
    } catch {
      // error state handled via pokeError from useSendPokeMutation
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      "Name",
      "Company",
      "Email",
      "Phone",
      "Role",
      "Type",
      "Pay/Hr",
      "Exp",
      "Match%",
      "Location",
    ];
    const csvRows = rows.map((r) =>
      [
        r.name,
        r.company,
        r.email,
        r.phone,
        r.role,
        r.type,
        r.payPerHour,
        r.experience,
        r.matchPercentage,
        r.location,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidate-matches.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Sidebar nav groups ── */
  const navGroups: NavGroup[] = [
    {
      label: "View",
      icon: "",
      items: [
        {
          id: "view-candidates",
          label: "Matched Candidates",
          count: vendorCandidateMatchesTotal,
          active: viewMode === "candidates",
          onClick: () => navigateToView("candidates"),
        },
        {
          id: "view-postings",
          label: "My Job Postings",
          count: vendorJobsTotal,
          active: viewMode === "postings",
          onClick: () => navigateToView("postings"),
        },
      ],
    },
    {
      label: "Job Openings",
      icon: "",
      items: [
        {
          id: "active-openings",
          label: "All Active Openings",
          count: activeJobs.length,
          active: viewMode === "active-openings",
          onClick: () => navigateToView("active-openings"),
        },
        ...activeJobs.map((job) => ({
          id: job.id,
          label: job.title,
          active: viewMode === "candidates" && selectedJobId === job.id,
          onClick: () => navigateToJob(job.id),
        })),
      ],
    },
    {
      label: `Pokes (${pokeCount}/${isFinite(pokeLimit) ? pokeLimit : "∞"})`,
      icon: "",
      items: [
        {
          id: "pokes-sent",
          label: "Pokes Sent",
          count: pokesSentOnly.length,
          active: viewMode === "pokes-sent" && !selectedJobId,
          onClick: () => navigateToView("pokes-sent"),
        },
        {
          id: "pokes-received",
          label: "Pokes Received",
          count: pokesReceivedOnly.length,
          active: viewMode === "pokes-received" && !selectedJobId,
          onClick: () => navigateToView("pokes-received"),
        },
        ...(isFinite(pokeLimit)
          ? [
              {
                id: "pokes-remaining",
                label: "Remaining",
                count: Math.max(0, pokeLimit - pokeCount),
              },
            ]
          : []),
        // Per-job poke sub-items when in pokes view
        ...(viewMode === "pokes-sent" || viewMode === "pokes-received"
          ? activeJobs
              .filter(
                (job) =>
                  (pokesPerJob[job.id] || 0) > 0 ||
                  (viewMode === "pokes-received" &&
                    pokesReceivedOnly.some((p) => p.job_id === job.id)),
              )
              .map((job) => ({
                id: `poke-job-${job.id}`,
                label: job.title,
                count:
                  viewMode === "pokes-sent"
                    ? pokesPerJob[job.id] || 0
                    : pokesReceivedOnly.filter((p) => p.job_id === job.id)
                        .length,
                active: selectedJobId === job.id,
                onClick: () => navigateToView(viewMode, job.id),
              }))
          : []),
      ],
    },
    {
      label: `Mails (${emailCount})`,
      icon: "",
      items: [
        {
          id: "mails-sent",
          label: "Mails Sent",
          count: mailsSentOnly.length,
          active: viewMode === "mails-sent" && !selectedJobId,
          onClick: () => navigateToView("mails-sent"),
        },
        {
          id: "mails-received",
          label: "Mails Received",
          count: mailsReceivedOnly.length,
          active: viewMode === "mails-received" && !selectedJobId,
          onClick: () => navigateToView("mails-received"),
        },
        ...(plan !== "free" && rows.length > 0
          ? [
              {
                id: "mail-template",
                label: "✉ Mail Template",
                tooltip:
                  "Compose a personalised email to any matched candidate — click ✉ next to any row",
                onClick: () => {
                  setViewMode("candidates");
                  if (rows.length > 0) handlePokeEmail(rows[0]);
                },
              },
            ]
          : []),
        // Per-job mail sub-items when in mails view
        ...(viewMode === "mails-sent" || viewMode === "mails-received"
          ? activeJobs
              .filter(
                (job) =>
                  (mailsPerJob[job.id] || 0) > 0 ||
                  (viewMode === "mails-received" &&
                    mailsReceivedOnly.some((p) => p.job_id === job.id)),
              )
              .map((job) => ({
                id: `mail-job-${job.id}`,
                label: job.title,
                count:
                  viewMode === "mails-sent"
                    ? mailsPerJob[job.id] || 0
                    : mailsReceivedOnly.filter((p) => p.job_id === job.id)
                        .length,
                active: selectedJobId === job.id,
                onClick: () => navigateToView(viewMode, job.id),
              }))
          : []),
      ],
    },
    {
      label: "Actions",
      icon: "",
      items: [
        {
          id: "refresh",
          label: "Refresh Data",
          onClick: () => {
            refetchJobs();
            refetchPokesSent();
            refetchPokesReceived();
            if (viewMode === "candidates") {
              setCurrentPage(1);
              setMatchArgs({
                job_id: selectedJobId || undefined,
                page: 1,
                limit: currentPageSize,
              });
            }
          },
        },
        {
          id: "reset",
          label: "Reset Filters",
          onClick: () => {
            setSelectedJobId("");
            setSearchText("");
            setPostingSearch("");
          },
        },
      ],
    },
  ];

  const breadcrumb: [string, string] | [string, string, string] =
    viewMode === "pokes-sent"
      ? ["Vendor Portal", "Pokes", "Pokes Sent"]
      : viewMode === "pokes-received"
      ? ["Vendor Portal", "Pokes", "Pokes Received"]
      : viewMode === "mails-sent"
      ? ["Vendor Portal", "Mails", "Mails Sent"]
      : viewMode === "mails-received"
      ? ["Vendor Portal", "Mails", "Mails Received"]
      : viewMode === "candidates"
      ? ["Vendor Portal", selectedJobTitle]
      : viewMode === "active-openings"
      ? ["Vendor Portal", "Active Openings"]
      : ["Vendor Portal", "My Job Postings"];

  return (
    <DBLayout userType="vendor" navGroups={navGroups} breadcrumb={breadcrumb}>
      <div
        className="matchdb-page"
        style={
          pricingBlur
            ? { filter: "blur(2px)", pointerEvents: "none", userSelect: "none" }
            : undefined
        }
      >
        {/* ── Dashboard stat cards ── */}
        <div className="matchdb-stat-bar">
          {[
            {
              label: "Active Openings",
              value: activeJobCount,
              icon: "💼",
              view: "active-openings" as ViewMode,
            },
            {
              label: "Total Postings",
              value: vendorJobs.length,
              icon: "📋",
              view: "postings" as ViewMode,
            },
            {
              label: "Closed",
              value: vendorJobs.length - activeJobCount,
              icon: "🔒",
            },
            {
              label: "Matched Candidates",
              value: vendorCandidateMatchesTotal,
              icon: "👥",
              view: "candidates" as ViewMode,
            },
            {
              label: "Pokes Sent",
              value: pokesSentOnly.length,
              icon: "👋",
              view: "pokes-sent" as ViewMode,
            },
            {
              label: "Pokes In",
              value: pokesReceivedOnly.length,
              icon: "📥",
              view: "pokes-received" as ViewMode,
            },
            {
              label: "Mails Sent",
              value: mailsSentOnly.length,
              icon: "📤",
              view: "mails-sent" as ViewMode,
            },
            {
              label: "Mails In",
              value: mailsReceivedOnly.length,
              icon: "📬",
              view: "mails-received" as ViewMode,
            },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              className={`matchdb-stat-rect${
                card.view && viewMode === card.view
                  ? " matchdb-stat-rect-active"
                  : ""
              }`}
              onClick={() => card.view && navigateToView(card.view)}
              title={card.view ? `View ${card.label}` : card.label}
            >
              <span className="matchdb-stat-icon">{card.icon}</span>
              <span>
                <span
                  className="matchdb-stat-value"
                  style={{
                    color: countColor(card.value),
                    background: countBg(card.value),
                  }}
                >
                  {card.value}
                </span>
                <span className="matchdb-stat-label">{card.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Error banner */}
        {pokeError && (
          <div
            className="w97-alert w97-alert-error"
            role="alert"
            aria-live="assertive"
          >
            ⚠ Failed to load data: An error occurred
            <Button
              aria-label="Retry loading data"
              size="xs"
              onClick={() => {
                refetchJobs();
                if (viewMode === "candidates") refetchMatches();
              }}
            >
              ↺ Retry
            </Button>
          </div>
        )}

        {/* Job info bar — for candidates/pokes/mails with a specific job selected */}
        {(viewMode === "candidates" ||
          viewMode === "pokes-sent" ||
          viewMode === "pokes-received" ||
          viewMode === "mails-sent" ||
          viewMode === "mails-received") &&
        selectedJobId
          ? (() => {
              const job = vendorJobs.find((j) => j.id === selectedJobId);
              if (!job) return null;
              const typeLabel =
                TYPE_LABELS[job.job_type] || job.job_type || "-";
              const subLabel = job.job_sub_type
                ? SUB_LABELS[job.job_sub_type] || job.job_sub_type
                : "";
              const modeLabel = job.work_mode
                ? MODE_LABELS[job.work_mode] || job.work_mode
                : "-";
              const rate = job.pay_per_hour
                ? `$${Number(job.pay_per_hour).toFixed(0)}/hr`
                : job.salary_max
                ? `$${Number(job.salary_max).toLocaleString()}`
                : "-";
              return (
                <div
                  className="w97-alert w97-alert-info"
                  role="status"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px 16px",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <strong>💼 {job.title}</strong>
                  <span>Location: {job.location || "-"}</span>
                  <span>
                    Type: {typeLabel}
                    {subLabel ? ` / ${subLabel}` : ""}
                  </span>
                  <span>Mode: {modeLabel}</span>
                  <span>Rate: {rate}</span>
                  <span>Exp: {formatExperience(job.experience_required)}</span>
                  <span
                    style={{
                      color: countColor(pokesPerJob[job.id] || 0),
                      fontWeight: 700,
                    }}
                  >
                    Pokes: {pokesPerJob[job.id] || 0}
                  </span>
                  <span
                    style={{
                      color: countColor(mailsPerJob[job.id] || 0),
                      fontWeight: 700,
                    }}
                  >
                    Mails: {mailsPerJob[job.id] || 0}
                  </span>
                  <span>Posted: {fmtDate(job.created_at)}</span>
                  {job.skills_required?.length > 0 && (
                    <span>
                      Skills: {job.skills_required.slice(0, 5).join(", ")}
                      {job.skills_required.length > 5
                        ? ` +${job.skills_required.length - 5}`
                        : ""}
                    </span>
                  )}
                </div>
              );
            })()
          : null}

        {/* ── POKES SENT VIEW ── */}
        {viewMode === "pokes-sent" && (
          <PokesTable
            userType="vendor"
            pokes={pokesSentOnly}
            loading={pokesLoading}
            section="pokes-sent"
            jobId={selectedJobId || undefined}
            jobTitle={
              selectedJobId
                ? activeJobs.find((j) => j.id === selectedJobId)?.title
                : undefined
            }
            onClearJob={() => setSelectedJobId("")}
            flashIds={pokesFlash.flashIds}
            deleteFlashIds={pokesFlash.deleteFlashIds}
          />
        )}

        {/* ── POKES RECEIVED VIEW ── */}
        {viewMode === "pokes-received" && (
          <PokesTable
            userType="vendor"
            pokes={pokesReceivedOnly}
            loading={pokesLoading}
            section="pokes-received"
            jobId={selectedJobId || undefined}
            jobTitle={
              selectedJobId
                ? activeJobs.find((j) => j.id === selectedJobId)?.title
                : undefined
            }
            onClearJob={() => setSelectedJobId("")}
            flashIds={pokesRecvFlash.flashIds}
            deleteFlashIds={pokesRecvFlash.deleteFlashIds}
          />
        )}

        {/* ── MAILS SENT VIEW ── */}
        {viewMode === "mails-sent" && (
          <PokesTable
            userType="vendor"
            pokes={mailsSentOnly}
            loading={pokesLoading}
            section="mails-sent"
            jobId={selectedJobId || undefined}
            jobTitle={
              selectedJobId
                ? activeJobs.find((j) => j.id === selectedJobId)?.title
                : undefined
            }
            onClearJob={() => setSelectedJobId("")}
            flashIds={pokesFlash.flashIds}
            deleteFlashIds={pokesFlash.deleteFlashIds}
          />
        )}

        {/* ── MAILS RECEIVED VIEW ── */}
        {viewMode === "mails-received" && (
          <PokesTable
            userType="vendor"
            pokes={mailsReceivedOnly}
            loading={pokesLoading}
            section="mails-received"
            jobId={selectedJobId || undefined}
            jobTitle={
              selectedJobId
                ? activeJobs.find((j) => j.id === selectedJobId)?.title
                : undefined
            }
            onClearJob={() => setSelectedJobId("")}
            flashIds={pokesRecvFlash.flashIds}
            deleteFlashIds={pokesRecvFlash.deleteFlashIds}
          />
        )}

        {/* ── MY JOB POSTINGS VIEW / ACTIVE OPENINGS VIEW ── */}
        {(viewMode === "postings" || viewMode === "active-openings") &&
          (() => {
            const isActiveView = viewMode === "active-openings";
            const tableData = isActiveView
              ? filteredActivePostings
              : filteredPostings;
            const totalCount = isActiveView
              ? activeJobs.length
              : vendorJobs.length;
            const panelLabel = isActiveView
              ? "Active Openings"
              : "My Job Postings";
            return (
              <>
                <DataTable<Job>
                  key={postingSearch}
                  columns={postingsColumns}
                  data={tableData}
                  keyExtractor={(j) => j.id}
                  loading={jobsLoading}
                  paginate
                  titleExtra={
                    <div className="matchdb-title-toolbar">
                      <Input
                        id="posting-search"
                        className="matchdb-title-search"
                        value={postingSearch}
                        onChange={(e) => setPostingSearch(e.target.value)}
                        placeholder="Search..."
                      />
                      <Button size="xs" onClick={() => setPostingSearch("")}>
                        Reset
                      </Button>
                      <span className="matchdb-title-count">
                        {jobsLoading
                          ? "..."
                          : `${tableData.length}/${totalCount}`}
                      </span>
                      <Button size="xs" onClick={() => refetchJobs()}>
                        ↻
                      </Button>
                      {onPostJob && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={atJobLimit ? openPricingModal : onPostJob}
                        >
                          {atJobLimit
                            ? plan === "free"
                              ? "🔒 Subscribe"
                              : "🔒 Upgrade"
                            : "+ Post"}
                        </Button>
                      )}
                    </div>
                  }
                  emptyMessage={
                    isActiveView
                      ? "No active job openings. Post a new job or reopen a closed one."
                      : vendorJobs.length === 0
                      ? 'No job postings yet. Click "+ Post New Job" to get started.'
                      : "No postings match your search."
                  }
                  title={panelLabel}
                  titleIcon={isActiveView ? "🔓" : "📋"}
                  flashIds={jobsFlash.flashIds}
                  deleteFlashIds={jobsFlash.deleteFlashIds}
                />
              </>
            );
          })()}

        {/* ── MATCHED CANDIDATES VIEW ── */}
        {viewMode === "candidates" && (
          <>
            {plan === "free" && (
              <div
                className="matchdb-panel"
                style={{ textAlign: "center", padding: "48px 24px" }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "#333",
                    margin: "0 0 8px",
                  }}
                >
                  Subscription Required
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#666",
                    maxWidth: 400,
                    margin: "0 auto 20px",
                    lineHeight: 1.6,
                  }}
                >
                  Viewing matched candidates requires an active subscription.
                  Subscribe to the <strong>Basic</strong> plan ($22/mo) or
                  higher to browse candidates and send pokes.
                </p>
                <Button variant="primary" onClick={openPricingModal}>
                  View Subscription Plans →
                </Button>
              </div>
            )}

            {plan !== "free" && (
              <>
                <MatchDataTable
                  title="Related Candidate Profiles"
                  titleIcon="👥"
                  titleExtra={
                    <div className="matchdb-title-toolbar">
                      <Select
                        id="vendor-job-filter"
                        className="matchdb-title-select"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                      >
                        <option value="">All Openings</option>
                        {activeJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </Select>
                      <Input
                        id="vendor-search"
                        className="matchdb-title-search"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search..."
                      />
                      <Button
                        size="xs"
                        onClick={() => {
                          setSelectedJobId("");
                          setSearchText("");
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => {
                          setCurrentPage(1);
                          refetchJobs();
                          setMatchArgs({
                            job_id: selectedJobId || undefined,
                            page: 1,
                            limit: currentPageSize,
                          });
                        }}
                      >
                        ↻
                      </Button>
                    </div>
                  }
                  rows={rows}
                  loading={matchesLoading}
                  error={pokeError ? "An error occurred" : null}
                  serverTotal={vendorCandidateMatchesTotal}
                  serverPage={currentPage}
                  serverPageSize={currentPageSize}
                  onPageChange={handlePageChange}
                  pokeLoading={pokeLoading}
                  pokeSuccessMessage={pokeSuccessMessage}
                  pokeError={pokeError ? "Failed to send poke" : null}
                  isVendor={true}
                  pokedRowIds={pokedRowIds}
                  emailedRowIds={emailedRowIds}
                  pokedAtMap={pokedAtMap}
                  onPoke={handlePoke}
                  onPokeEmail={handlePokeEmail}
                  onRowClick={(row) =>
                    setSelectedCandidate(row.rawData || null)
                  }
                  onDownload={handleDownloadCSV}
                  downloadLabel="Download CSV"
                  flashIds={candidatesFlash.flashIds}
                  deleteFlashIds={candidatesFlash.deleteFlashIds}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Candidate detail modal */}
      <DetailModal
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
        type="candidate"
        data={selectedCandidate}
        matchPercentage={selectedCandidate?.match_percentage}
      />

      {/* Job posting detail modal */}
      <JobPostingModal
        open={selectedJobPosting !== null}
        onClose={() => setSelectedJobPosting(null)}
        job={selectedJobPosting}
        onClose_job={handleCloseJob}
        onReopen_job={handleReopenJob}
      />

      {/* Mail Template modal */}
      <PokeEmailModal
        open={pokeEmailRow !== null}
        row={pokeEmailRow}
        isVendor={true}
        senderName={userEmail?.split("@")[0] || "Vendor"}
        senderEmail={userEmail || ""}
        onSend={handlePokeEmailSend}
        onClose={() => {
          setPokeEmailRow(null);
          setPokeEmailSentSuccess(false);
          clearPokeState();
        }}
        sending={pokeLoading}
        sentSuccess={pokeEmailSentSuccess}
      />
    </DBLayout>
  );
};

export default VendorDashboard;
