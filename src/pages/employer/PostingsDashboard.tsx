import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MatchDataTable, { MatchRow } from "../../components/MatchDataTable";
import DBLayout, { NavGroup } from "../../components/DBLayout";
import "./EmployerFinancial.css";
import DetailModal from "../../components/DetailModal";
import JobPostingModal from "../../components/JobPostingModal";
import PokeEmailModal from "../../components/PokeEmailModal";
import { PokesTable } from "../../shared";
import {
  DataTable,
  Button,
  Input,
  Select,
  ICONS,
} from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import { useAutoRefreshFlash } from "../../hooks/useAutoRefreshFlash";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import {
  useGetVendorJobsQuery,
  useGetVendorCandidateMatchesQuery,
  useGetPokesSentQuery,
  useGetPokesReceivedQuery,
  useSendPokeMutation,
  useCloseJobMutation,
  useReopenJobMutation,
  useSendInterviewInviteMutation,
  useGetInterviewInvitesSentQuery,
  useGetVendorFinancialSummaryQuery,
  type Job,
  type CandidateProfileMatch,
  type PokeRecord,
  type InterviewInvite,
  type VendorJobsArgs,
  type VendorCandidateMatchesArgs,
} from "../../api/jobsApi";

interface Props {
  token: string | null;
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
  | "mails-received"
  | "interviews-sent"
  | "financial-summary";

/** Color badge for count thresholds */
const COUNT_COLOR_THRESHOLDS: [number, string][] = [
  [50, "#2e7d32"],
  [25, "#b8860b"],
  [10, "#d4600a"],
];
const COUNT_BG_THRESHOLDS: [number, string][] = [
  [50, "#e8f5e9"],
  [25, "#fffde6"],
  [10, "#fff3e0"],
];
const countColor = (n: number): string =>
  COUNT_COLOR_THRESHOLDS.find(([t]) => n >= t)?.[1] ?? "#bb3333";
const countBg = (n: number): string =>
  COUNT_BG_THRESHOLDS.find(([t]) => n >= t)?.[1] ?? "#fff5f5";

/** Unwrap paginated-or-array API responses (reduces component cognitive complexity) */
function unwrapPaginated<T>(
  data: T[] | { data: T[]; total: number } | undefined,
): [T[], number] {
  if (Array.isArray(data)) return [data, data.length];
  return [data?.data ?? [], data?.total ?? 0];
}

/** Column definitions for the job postings table are built inside the component
 *  via useMemo so that render functions can close over handlers and state. */

const PostingsDashboard: React.FC<Props> = ({
  token: _token,
  userEmail,
  plan = "free",
  onPostJob,
}) => {
  // ── RTK Query data hooks ───────────────────────────────────────────────────
  const [jobsArgs] = useState<VendorJobsArgs>({});
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
  const [sendInterviewInvite, { isLoading: inviteSending }] =
    useSendInterviewInviteMutation();
  const { data: invitesSentData, refetch: refetchInvites } =
    useGetInterviewInvitesSentQuery();
  const {
    data: vendorFinData,
    isLoading: vendorFinLoading,
    refetch: refetchVendorFin,
  } = useGetVendorFinancialSummaryQuery();

  // Financial summary local state
  const [finSearch, setFinSearch] = useState("");
  const [finStatusFilter, setFinStatusFilter] = useState<
    "all" | "active" | "completed"
  >("all");
  const [finTab, setFinTab] = useState<"candidates" | "pipeline">("candidates");

  // Derive flat arrays from paginated-or-array responses
  const [vendorJobs, vendorJobsTotal] = unwrapPaginated<Job>(jobsData);
  const [vendorCandidateMatches, vendorCandidateMatchesTotal] =
    unwrapPaginated<CandidateProfileMatch>(matchesData);

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

  const navigateToViewJob = useCallback(
    (mode: ViewMode, jobId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("view", mode);
        next.set("job", jobId);
        return next;
      });
    },
    [setSearchParams],
  );
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
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("view", "postings");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const [searchText, setSearchText] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Record<
    string,
    unknown
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

  // Interview invite state
  const [inviteProposedAt, setInviteProposedAt] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSentSuccess, setInviteSentSuccess] = useState(false);
  const invitesSent: InterviewInvite[] = invitesSentData?.data ?? [];
  const selectedCandidateMatchPercentage =
    typeof selectedCandidate?.match_percentage === "number"
      ? selectedCandidate.match_percentage
      : undefined;

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
    globalThis.dispatchEvent(
      new CustomEvent("matchdb:openPricing", { detail: { tab: "vendor" } }),
    );
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    globalThis.addEventListener("matchdb:pricingClosed", onClose);
    return () =>
      globalThis.removeEventListener("matchdb:pricingClosed", onClose);
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
  const atJobLimit = Number.isFinite(jobLimit) && activeJobCount >= jobLimit;

  // Dispatch vendor's primary location to shell (derived from most-posted job location)
  useEffect(() => {
    if (vendorJobs.length > 0) {
      const loc = vendorJobs.find((j) => j.location)?.location || "";
      if (loc) {
        globalThis.dispatchEvent(
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
          .filter((j): j is typeof j & { job_country: string } =>
            Boolean(j.is_active && j.job_country),
          )
          .map((j) => j.job_country),
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
      } active opening${activeJobs.length === 1 ? "" : "s"}.`;
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text } }),
      );
    }
    return () => {
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text: "" } }),
      );
    };
  }, [vendorJobs, activeJobs.length]);

  // Emit footer info for shell to display
  useEffect(() => {
    const VIEW_COUNT: Record<ViewMode, number> = {
      "active-openings": activeJobs.length,
      postings: vendorJobs.length,
      candidates: vendorCandidateMatchesTotal,
      "pokes-sent": pokesSentOnly.length,
      "pokes-received": pokesReceivedOnly.length,
      "mails-sent": mailsSentOnly.length,
      "mails-received": mailsReceivedOnly.length,
      "interviews-sent": invitesSent.length,
      "financial-summary": vendorFinData?.totals?.totalCandidates ?? 0,
    };
    const count = VIEW_COUNT[viewMode] ?? 0;
    const suffix = count === 1 ? "" : "s";
    globalThis.dispatchEvent(
      new CustomEvent("matchdb:footerInfo", {
        detail: {
          text: `Showing ${count} row${suffix} | InnoDB`,
        },
      }),
    );
    return () => {
      globalThis.dispatchEvent(
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
    invitesSent.length,
    vendorFinData?.totals?.totalCandidates,
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
  }, [selectedJobId, viewMode, currentPageSize]);

  useEffect(() => {
    return () => {
      clearPokeState();
    };
  }, [clearPokeState]);

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
  const handleCloseJob = useCallback(
    async (jobId: string) => {
      setClosingJobId(jobId);
      await closeJobMutation(jobId).unwrap();
      setClosingJobId(null);
      setSelectedJobPosting((prev) =>
        prev?.id === jobId ? { ...prev, is_active: false } : prev,
      );
      refetchMatches();
    },
    [closeJobMutation, refetchMatches],
  );

  const handleReopenJob = useCallback(
    async (jobId: string) => {
      setClosingJobId(jobId);
      await reopenJobMutation(jobId).unwrap();
      setClosingJobId(null);
      setSelectedJobPosting((prev) =>
        prev?.id === jobId ? { ...prev, is_active: true } : prev,
      );
      refetchMatches();
    },
    [reopenJobMutation, refetchMatches],
  );

  /* ── Job postings table columns (with render functions) ── */
  const postingsColumns = useMemo<DataTableColumn<Job>[]>(
    () => [
      {
        key: "title",
        header: "Title",
        width: "15%",
        skeletonWidth: 100,
        render: (job: Job) => (
          <button
            type="button"
            className="matchdb-link-btn"
            onClick={() => setSelectedJobPosting(job)}
            title={`View details for ${job.title}`}
          >
            {job.title}
          </button>
        ),
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
        width: "10%",
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
        width: "11%",
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
            {job.experience_required == null
              ? "—"
              : `${job.experience_required}y`}
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
          const pokeSuffix = n_poke === 1 ? "" : "s";
          const pokeTitle =
            n_poke > 0
              ? `View ${n_poke} poke${pokeSuffix} sent for "${job.title}"`
              : "No pokes sent";
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
              title={pokeTitle}
              onClick={() => navigateToViewJob("pokes-sent", job.id)}
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
          const mailSuffix = n_mail === 1 ? "" : "s";
          const mailTitle =
            n_mail > 0
              ? `View ${n_mail} mail${mailSuffix} sent for "${job.title}"`
              : "No mails sent";
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
              title={mailTitle}
              onClick={() => navigateToViewJob("mails-sent", job.id)}
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
            onClick={() => navigateToViewJob("candidates", job.id)}
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
      setSelectedJobPosting,
      handleCloseJob,
      handleReopenJob,
      navigateToViewJob,
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

  // Set of candidate emails for which an invite has already been sent
  const invitedRowIds = useMemo(
    () =>
      new Set((invitesSentData?.data ?? []).map((inv) => inv.candidateEmail)),
    [invitesSentData],
  );

  const handleInviteSend = async () => {
    const target = pokeEmailRow;
    if (!target) return;
    try {
      await sendInterviewInvite({
        candidateEmail: target.pokeTargetEmail,
        candidateName: target.pokeTargetName,
        jobId: selectedJobId || undefined,
        jobTitle: selectedJobId ? selectedJobTitle : undefined,
        proposedAt: inviteProposedAt || undefined,
        message: inviteMessage,
      }).unwrap();
      setInviteSentSuccess(true);
      refetchInvites();
    } catch {
      // error surfaced via inviteSending state
    }
  };

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail) return;
    if (Number.isFinite(pokeLimit) && pokeCount >= pokeLimit) return;
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
        r.role,
        r.type,
        r.payPerHour,
        r.experience,
        r.matchPercentage,
        r.location,
      ]
        .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
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
  function buildNavGroups(): NavGroup[] {
    return [
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
        label: `Pokes (${pokeCount}/${
          Number.isFinite(pokeLimit) ? pokeLimit : "∞"
        })`,
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
          ...(Number.isFinite(pokeLimit)
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
        label: `Interviews (${invitesSent.length})`,
        icon: "",
        items: [
          {
            id: "interviews-sent",
            label: "Invites Sent",
            count: invitesSent.length,
            active: viewMode === "interviews-sent",
            onClick: () => navigateToView("interviews-sent"),
          },
        ],
      },
      {
        label: "Finance",
        icon: "",
        items: [
          {
            id: "financial-summary",
            label: "Financial Summary",
            count: vendorFinData?.totals?.totalCandidates ?? 0,
            active: viewMode === "financial-summary",
            onClick: () => navigateToView("financial-summary"),
          },
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
              refetchVendorFin();
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
  }
  const navGroups = buildNavGroups();

  const BREADCRUMB_MAP: Record<
    ViewMode,
    [string, string] | [string, string, string]
  > = {
    "pokes-sent": ["Vendor Portal", "Pokes", "Pokes Sent"],
    "pokes-received": ["Vendor Portal", "Pokes", "Pokes Received"],
    "mails-sent": ["Vendor Portal", "Mails", "Mails Sent"],
    "mails-received": ["Vendor Portal", "Mails", "Mails Received"],
    "interviews-sent": ["Vendor Portal", "Interviews", "Invites Sent"],
    "financial-summary": ["Vendor Portal", "Finance", "Financial Summary"],
    candidates: ["Vendor Portal", selectedJobTitle],
    "active-openings": ["Vendor Portal", "Active Openings"],
    postings: ["Vendor Portal", "My Job Postings"],
  };

  // ── VENDOR FINANCIAL SUMMARY VIEW ──────────────────────────────────────────
  function renderFinancialSummaryView() {
    if (vendorFinLoading)
      return (
        <div className="u-text-center u-p-60 u-fs-13 u-color-secondary">
          Loading financial data…
        </div>
      );

    const data = vendorFinData;
    if (!data || data.candidates.length === 0)
      return (
        <div className="u-text-center u-p-60 u-fs-13 u-color-secondary">
          No financial data available. Financial details will appear here when
          marketers add project financials for candidates matched to your jobs.
        </div>
      );

    const { totals, candidates, clientPipeline } = data;
    const fmtC = (v: number) =>
      `$${Math.abs(v).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;

    const filtered = candidates.filter((c) => {
      if (finSearch) {
        const q = finSearch.toLowerCase();
        if (
          !c.candidateName.toLowerCase().includes(q) &&
          !c.clientName.toLowerCase().includes(q) &&
          !c.jobTitle.toLowerCase().includes(q) &&
          !c.implementationPartner.toLowerCase().includes(q)
        )
          return false;
      }
      if (finStatusFilter === "active") return c.isActive;
      if (finStatusFilter === "completed") return !c.isActive;
      return true;
    });

    return (
      <div className="vfin-root">
        {/* ── KPI STRIP ──────────────────────────────────────────────────────── */}
        <div className="vfin-kpi-strip">
          {[
            {
              label: "Total Candidates",
              value: String(totals.totalCandidates),
              cls: "vfin-kpi-blue",
            },
            {
              label: "Total Hours",
              value: totals.totalHours.toFixed(0),
              cls: "vfin-kpi-blue",
            },
            {
              label: "Total Billed",
              value: fmtC(totals.totalBilled),
              cls: "vfin-kpi-green",
            },
            {
              label: "Total Pay",
              value: fmtC(totals.totalPay),
              cls: "vfin-kpi-teal",
            },
            {
              label: "Credited",
              value: fmtC(totals.totalCredited),
              cls: "vfin-kpi-green",
            },
            {
              label: "Pending",
              value: fmtC(totals.totalPending),
              cls: totals.totalPending > 0 ? "vfin-kpi-red" : "vfin-kpi-blue",
            },
          ].map((k, i, arr) => (
            <React.Fragment key={k.label}>
              <div className="vfin-kpi">
                <span className="vfin-kpi-label">{k.label}</span>
                <span className={`vfin-kpi-value ${k.cls}`}>{k.value}</span>
              </div>
              {i < arr.length - 1 && <div className="vfin-kpi-div" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── TAB BAR ────────────────────────────────────────────────────────── */}
        <div className="vfin-tabs">
          <button
            type="button"
            className={`vfin-tab${finTab === "candidates" ? " active" : ""}`}
            onClick={() => setFinTab("candidates")}
          >
            👤 Candidates & Employers
          </button>
          <button
            type="button"
            className={`vfin-tab${finTab === "pipeline" ? " active" : ""}`}
            onClick={() => setFinTab("pipeline")}
          >
            🏢 Client Pipeline
          </button>
          <div className="u-flex-1" />
          <Button size="xs" onClick={() => refetchVendorFin()}>
            ↻ Refresh
          </Button>
        </div>

        {/* ── CANDIDATES TAB ─────────────────────────────────────────────────── */}
        {finTab === "candidates" && (
          <div className="vfin-section">
            {/* Search & filter bar */}
            <div className="vfin-toolbar">
              <Input
                id="vfin-search"
                variant="finance-search"
                value={finSearch}
                onChange={(e) => setFinSearch(e.target.value)}
                placeholder="Search candidate, client, job…"
              />
              <Select
                id="vfin-status"
                variant="finance"
                value={finStatusFilter}
                onChange={(e) =>
                  setFinStatusFilter(
                    e.target.value as "all" | "active" | "completed",
                  )
                }
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </Select>
              <Button
                size="xs"
                onClick={() => {
                  setFinSearch("");
                  setFinStatusFilter("all");
                }}
              >
                Reset
              </Button>
              <span className="vfin-count">
                {filtered.length} / {candidates.length}
              </span>
            </div>

            {/* Table */}
            <div className="vfin-table-wrap">
              <table className="vfin-table">
                <thead>
                  <tr>
                    {[
                      "Candidate",
                      "Job Title",
                      "Client",
                      "Impl. Partner",
                      "Employer",
                      "Rate",
                      "Hours",
                      "Billed",
                      "Paid",
                      "Pending",
                      "Period",
                      "Status",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="u-text-center u-p-24 u-color-secondary"
                      >
                        No matching records.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c, i) => (
                      <tr key={`${c.candidateId}-${c.jobTitle}-${i}`}>
                        <td className="vfin-td-name">
                          <div className="vfin-name">{c.candidateName}</div>
                          <div className="vfin-sub">{c.candidateEmail}</div>
                        </td>
                        <td>
                          <div className="vfin-name">{c.jobTitle}</div>
                          <div className="vfin-sub">
                            {c.jobType}
                            {c.jobSubType ? ` › ${c.jobSubType}` : ""}
                          </div>
                        </td>
                        <td>{c.clientName}</td>
                        <td>{c.implementationPartner}</td>
                        <td>{c.marketerCompanyName}</td>
                        <td className="vfin-td-num">${c.payRate}/hr</td>
                        <td className="vfin-td-num">{c.hoursWorked}h</td>
                        <td className="vfin-td-num">{fmtC(c.totalBilled)}</td>
                        <td className="vfin-td-num vfin-green">
                          {fmtC(c.amountPaid)}
                        </td>
                        <td
                          className={`vfin-td-num${
                            c.amountPending > 0 ? " vfin-red" : ""
                          }`}
                        >
                          {c.amountPending > 0 ? fmtC(c.amountPending) : "—"}
                        </td>
                        <td className="vfin-td-period">
                          {c.projectStart
                            ? new Date(c.projectStart).toLocaleDateString(
                                "en-US",
                                { month: "short", year: "2-digit" },
                              )
                            : "—"}
                          {" – "}
                          {c.projectEnd
                            ? new Date(c.projectEnd).toLocaleDateString(
                                "en-US",
                                { month: "short", year: "2-digit" },
                              )
                            : "now"}
                        </td>
                        <td>
                          <span
                            className={`vfin-badge ${
                              c.isActive
                                ? "vfin-badge-active"
                                : "vfin-badge-closed"
                            }`}
                          >
                            {c.isActive ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLIENT PIPELINE TAB ────────────────────────────────────────────── */}
        {finTab === "pipeline" && (
          <div className="vfin-section">
            <div className="vfin-pipeline">
              {clientPipeline.length === 0 ? (
                <div className="u-text-center u-p-40 u-color-secondary u-fs-13">
                  No client pipeline data yet.
                </div>
              ) : (
                clientPipeline.map((cp) => (
                  <div key={cp.clientName} className="vfin-pipeline-card">
                    <div className="vfin-pipeline-header">
                      <span className="vfin-pipeline-name">
                        🏢 {cp.clientName}
                      </span>
                      <span className="vfin-pipeline-count">
                        {cp.candidateCount} candidate
                        {cp.candidateCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="vfin-pipeline-metrics">
                      <div className="vfin-pipeline-metric">
                        <span className="vfin-pipeline-metric-label">
                          Total Hours
                        </span>
                        <span className="vfin-pipeline-metric-value">
                          {cp.totalHours.toFixed(0)}
                        </span>
                      </div>
                      <div className="vfin-pipeline-metric">
                        <span className="vfin-pipeline-metric-label">
                          Total Billed
                        </span>
                        <span className="vfin-pipeline-metric-value vfin-green">
                          {fmtC(cp.totalBilled)}
                        </span>
                      </div>
                      <div className="vfin-pipeline-metric">
                        <span className="vfin-pipeline-metric-label">Paid</span>
                        <span className="vfin-pipeline-metric-value">
                          {fmtC(cp.totalPaid)}
                        </span>
                      </div>
                      <div className="vfin-pipeline-metric">
                        <span className="vfin-pipeline-metric-label">
                          Pending
                        </span>
                        <span
                          className={`vfin-pipeline-metric-value${
                            cp.totalPending > 0 ? " vfin-red" : ""
                          }`}
                        >
                          {cp.totalPending > 0 ? fmtC(cp.totalPending) : "—"}
                        </span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="vfin-pipeline-progress">
                      <div
                        className="vfin-pipeline-progress-bar"
                        style={{
                          width:
                            cp.totalBilled > 0
                              ? `${Math.min(
                                  100,
                                  (cp.totalPaid / cp.totalBilled) * 100,
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderInterviewsSentView() {
    const fmtProposed = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

    const statusColor: Record<string, string> = {
      pending: "#1565c0",
      accepted: "#2e7d32",
      declined: "#c62828",
      cancelled: "#888",
    };

    const columns: DataTableColumn<InterviewInvite>[] = [
      {
        key: "candidate",
        header: "Candidate",
        width: "16%",
        skeletonWidth: 110,
        render: (r) => (
          <span title={r.candidateEmail}>
            {r.candidateName || r.candidateEmail}
          </span>
        ),
        tooltip: (r) => r.candidateEmail,
      },
      {
        key: "job",
        header: "Position",
        width: "14%",
        skeletonWidth: 100,
        render: (r) => <>{r.jobTitle || "—"}</>,
      },
      {
        key: "proposed",
        header: "Proposed Time",
        width: "14%",
        skeletonWidth: 100,
        render: (r) => <>{fmtProposed(r.proposedAt)}</>,
      },
      {
        key: "meet",
        header: "Meet Link",
        width: "14%",
        skeletonWidth: 110,
        render: (r) => (
          <a
            href={r.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1a73e8", textDecoration: "none", fontSize: 12 }}
          >
            Join Meet
          </a>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "9%",
        skeletonWidth: 70,
        render: (r) => (
          <span
            className="matchdb-type-pill"
            style={{
              color: statusColor[r.status] ?? "#555",
              textTransform: "capitalize",
            }}
          >
            {r.status}
          </span>
        ),
      },
      {
        key: "note",
        header: "Candidate Note",
        width: "14%",
        skeletonWidth: 90,
        render: (r) => <>{r.candidateNote || "—"}</>,
        tooltip: (r) => r.candidateNote || "",
      },
      {
        key: "sent",
        header: "Sent",
        width: "9%",
        skeletonWidth: 70,
        render: (r) =>
          new Date(r.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
      },
    ];

    return (
      <DataTable<InterviewInvite>
        columns={columns}
        data={invitesSent}
        keyExtractor={(r) => r.id}
        loading={false}
        paginated
        emptyMessage="No interview invites sent yet. Click 📞 on any matched candidate to send one."
        title="Interview Invites Sent"
        titleIcon="📞"
      />
    );
  }

  function renderCandidatesView() {
    if (plan === "free") {
      return (
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
            Subscribe to the <strong>Basic</strong> plan ($22/mo) or higher to
            browse candidates and send pokes.
          </p>
          <Button variant="primary" onClick={openPricingModal}>
            View Subscription Plans →
          </Button>
        </div>
      );
    }
    return (
      <MatchDataTable
        title="Related Candidate Profiles"
        titleIcon="👥"
        titleExtra={
          <div className="matchdb-title-toolbar">
            <Select
              id="vendor-job-filter"
              variant="toolbar"
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
              variant="search"
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
        onRowClick={(row) => setSelectedCandidate(row.rawData || null)}
        onDownload={handleDownloadCSV}
        downloadLabel="Download CSV"
        flashIds={candidatesFlash.flashIds}
        deleteFlashIds={candidatesFlash.deleteFlashIds}
      />
    );
  }

  const breadcrumb = BREADCRUMB_MAP[viewMode];
  const pageStyle = pricingBlur
    ? {
        filter: "blur(2px)",
        pointerEvents: "none" as const,
        userSelect: "none" as const,
      }
    : undefined;

  return (
    <DBLayout userType="vendor" navGroups={navGroups} breadcrumb={breadcrumb}>
      <div className="matchdb-page" style={pageStyle}>
        {/* ── Dashboard stat cards ── */}
        <div className="matchdb-stat-bar">
          {[
            {
              label: "Active Openings",
              value: activeJobCount,
              icon: ICONS.BRIEFCASE,
              view: "active-openings" as ViewMode,
            },
            {
              label: "Total Postings",
              value: vendorJobs.length,
              icon: ICONS.DOCUMENT,
              view: "postings" as ViewMode,
            },
            {
              label: "Closed",
              value: vendorJobs.length - activeJobCount,
              icon: ICONS.LOCK,
            },
            {
              label: "Matched Candidates",
              value: vendorCandidateMatchesTotal,
              icon: ICONS.PERSONS,
              view: "candidates" as ViewMode,
            },
            {
              label: "Pokes Sent",
              value: pokesSentOnly.length,
              icon: ICONS.WAVE,
              view: "pokes-sent" as ViewMode,
            },
            {
              label: "Pokes In",
              value: pokesReceivedOnly.length,
              icon: ICONS.INBOX,
              view: "pokes-received" as ViewMode,
            },
            {
              label: "Mails Sent",
              value: mailsSentOnly.length,
              icon: ICONS.OUTBOX,
              view: "mails-sent" as ViewMode,
            },
            {
              label: "Mails In",
              value: mailsReceivedOnly.length,
              icon: ICONS.MAILBOX,
              view: "mails-received" as ViewMode,
            },
            {
              label: "Interview Invites",
              value: invitesSent.length,
              icon: ICONS.PHONE,
              view: "interviews-sent" as ViewMode,
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
              let salaryDisplay = "-";
              if (job.pay_per_hour)
                salaryDisplay = `$${Number(job.pay_per_hour).toFixed(0)}/hr`;
              else if (job.salary_max)
                salaryDisplay = `$${Number(job.salary_max).toLocaleString()}`;
              return (
                <output
                  className="w97-alert w97-alert-info"
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
                  <span>Rate: {salaryDisplay}</span>
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
                </output>
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
            let postBtnLabel = "+ Post";
            if (atJobLimit)
              postBtnLabel = plan === "free" ? "🔒 Subscribe" : "🔒 Upgrade";
            return (
              <DataTable<Job>
                key={postingSearch}
                columns={postingsColumns}
                data={tableData}
                keyExtractor={(j) => j.id}
                loading={jobsLoading}
                paginated
                titleExtra={
                  <div className="matchdb-title-toolbar">
                    <Input
                      id="posting-search"
                      variant="search"
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
                        {postBtnLabel}
                      </Button>
                    )}
                  </div>
                }
                emptyMessage={(() => {
                  if (isActiveView)
                    return "No active job openings. Post a new job or reopen a closed one.";
                  if (vendorJobs.length === 0)
                    return 'No job postings yet. Click "+ Post New Job" to get started.';
                  return "No postings match your search.";
                })()}
                title={panelLabel}
                titleIcon={isActiveView ? "🔓" : "📋"}
                flashIds={jobsFlash.flashIds}
                deleteFlashIds={jobsFlash.deleteFlashIds}
              />
            );
          })()}

        {/* ── FINANCIAL SUMMARY VIEW ── */}
        {viewMode === "financial-summary" && renderFinancialSummaryView()}

        {/* ── INTERVIEWS SENT VIEW ── */}
        {viewMode === "interviews-sent" && renderInterviewsSentView()}

        {/* ── MATCHED CANDIDATES VIEW ── */}
        {viewMode === "candidates" && renderCandidatesView()}
      </div>

      {/* Candidate detail modal */}
      <DetailModal
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
        type="candidate"
        data={selectedCandidate}
        matchPercentage={selectedCandidateMatchPercentage}
      />

      {/* Job posting detail modal */}
      <JobPostingModal
        open={selectedJobPosting !== null}
        onClose={() => setSelectedJobPosting(null)}
        job={selectedJobPosting}
        onClose_job={handleCloseJob}
        onReopen_job={handleReopenJob}
      />

      {/* Mail Template modal (with integrated screening call scheduling) */}
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
        onScheduleCall={handleInviteSend}
        schedulingCall={inviteSending}
        callScheduled={inviteSentSuccess}
        invitedRowIds={invitedRowIds}
        selectedJobTitle={selectedJobTitle}
        onInviteStateReset={() => {
          setInviteProposedAt("");
          setInviteMessage("");
          setInviteSentSuccess(false);
        }}
        inviteProposedAt={inviteProposedAt}
        setInviteProposedAt={setInviteProposedAt}
        inviteMessage={inviteMessage}
        setInviteMessage={setInviteMessage}
      />
    </DBLayout>
  );
};

export default PostingsDashboard;
