import { useSearchParams } from "react-router-dom";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MatchRow } from "../components/MatchDataTable";
import {
  DataTable,
  Button,
  Input,
  Select,
  Tabs,
  Panel,
} from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import DBLayout, { NavGroup } from "../components/DBLayout";
import DetailModal from "../components/DetailModal";
import PokeEmailModal from "../components/PokeEmailModal";
import CandidateProfile from "./CandidateProfile";
import { PokesTable } from "../shared";
import { useAutoRefreshFlash } from "../hooks/useAutoRefreshFlash";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import {
  useGetCandidateMatchesQuery,
  useGetProfileQuery,
  useGetPokesSentQuery,
  useGetPokesReceivedQuery,
  useSendPokeMutation,
  useGetCandidateForwardedOpeningsQuery,
  useGetCandidateMyDetailQuery,
  type Job,
  type CandidateMatchesArgs,
  type ForwardedOpeningItem,
} from "../api/jobsApi";

interface Props {
  token: string | null;
  userEmail: string | undefined;
  username: string | undefined;
  plan?: string;
  membershipConfig?: Record<string, string[]> | null;
  hasPurchasedVisibility?: boolean;
}

type ActiveView =
  | "matches"
  | "pokes-sent"
  | "pokes-received"
  | "mails-sent"
  | "mails-received"
  | "forwarded"
  | "my-detail"
  | "vendor-openings"
  | "employer-openings"
  | "employer-finance"
  | "employer-immigration";

type MyDetailTab =
  | "overview"
  | "projects"
  | "marketer-activity"
  | "forwarded-openings";

const formatRate = (value?: number | null) =>
  value ? `$${Number(value).toFixed(0)}` : "-";
const formatExperience = (value?: number | null) => `${Number(value || 0)} yrs`;

// ── Sorting helpers ──
type SortKey =
  | "name"
  | "company"
  | "role"
  | "type"
  | "matchPercentage"
  | "location";
type SortDir = "asc" | "desc";

const MAIL_MATCH_THRESHOLD = 75;
const POKE_MATCH_THRESHOLD = 25;
const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const formatType = (value: string) => value.replaceAll("_", " ");

const getMeterClass = (pct: number) => {
  if (pct >= 75) return "matchdb-meter-fill matchdb-meter-fill-high";
  if (pct >= 45) return "matchdb-meter-fill matchdb-meter-fill-mid";
  return "matchdb-meter-fill matchdb-meter-fill-low";
};

const sortValue = (row: MatchRow, key: SortKey): string | number => {
  if (key === "matchPercentage") return row.matchPercentage;
  return (row[key] || "").toLowerCase();
};

/** Color badge for count thresholds — red when < 10 */
const countColor = (n: number): string => {
  if (n >= 50) return "#2e7d32";
  if (n >= 25) return "#b8860b";
  if (n >= 10) return "#d4600a";
  return "#bb3333";
};
const fmtC = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

/** Build the array of cell display values for a single financial row */
const finCellValues = (fin: {
  billRate: number;
  payRate: number;
  hoursWorked: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  projectStart: string | null;
  projectEnd: string | null;
}): string[] => [
  `$${fin.billRate}/hr`,
  `$${fin.payRate}/hr`,
  `${fin.hoursWorked}h`,
  `$${fin.totalBilled.toLocaleString()}`,
  `$${fin.totalPay.toLocaleString()}`,
  `$${fin.taxAmount.toLocaleString()}`,
  `$${fin.cashAmount.toLocaleString()}`,
  `$${fin.netPayable.toLocaleString()}`,
  `$${fin.amountPaid.toLocaleString()}`,
  fin.amountPending > 0 ? `$${fin.amountPending.toLocaleString()}` : "—",
  [
    fin.projectStart
      ? new Date(fin.projectStart).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        })
      : "—",
    fin.projectEnd
      ? new Date(fin.projectEnd).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        })
      : "now",
  ].join(" – "),
];

const countBg = (n: number): string => {
  if (n >= 50) return "#e8f5e9";
  if (n >= 25) return "#fffde6";
  if (n >= 10) return "#fff3e0";
  return "#fff5f5";
};

const companyFromEmail = (email?: string) => {
  if (!email) return "-";
  const domain = email.split("@")[1] || "";
  return domain
    ? domain
        .split(".")[0]
        .replaceAll(/[^a-zA-Z0-9]/g, " ")
        .trim() || "-"
    : "-";
};

const JOB_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
];

const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-Site" },
  { value: "hybrid", label: "Hybrid" },
];

const CONTRACT_SUB_TYPES = [
  { value: "c2c", label: "C2C" },
  { value: "c2h", label: "C2H" },
  { value: "w2", label: "W2" },
  { value: "1099", label: "1099" },
];

const FULL_TIME_SUB_TYPES = [
  { value: "c2h", label: "C2H" },
  { value: "w2", label: "W2" },
  { value: "direct_hire", label: "Direct Hire" },
  { value: "salary", label: "Salary" },
];

const POKE_LIMIT: Record<string, number> = {
  free: 5,
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

const CandidateDashboard: React.FC<Props> = ({
  token,
  userEmail,
  username,
  plan = "free",
  membershipConfig,
  hasPurchasedVisibility = false,
}) => {
  // ── URL-driven state — all navigation, filters, and pagination live in the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = (searchParams.get("view") as ActiveView) || "matches";
  const myDetailTab = (searchParams.get("dtab") as MyDetailTab) || "overview";
  const filterType = searchParams.get("type") || "";
  const filterSubType = searchParams.get("sub") || "";
  const filterWorkMode = searchParams.get("mode") || "";
  const currentPage = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10),
  );
  const currentPageSize = Math.max(
    1,
    Number.parseInt(searchParams.get("size") || "25", 10),
  );
  const [searchText, setSearchText] = useState(
    () => searchParams.get("q") || "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("q") || "",
  );

  /** Update multiple URL params atomically in one navigate() call */
  const navParams = (
    updates: Record<string, string | null>,
    resetPage = true,
  ) =>
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) n.delete(k);
          else n.set(k, v);
        }
        if (resetPage) n.delete("page");
        return n;
      },
      { replace: true },
    );

  // On mount: stamp ?view=matches if no view param exists yet (e.g. fresh login)
  useEffect(() => {
    if (!searchParams.get("view")) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("view", "matches");
          return n;
        },
        { replace: true },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedJob, setSelectedJob] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // Sorting state (for DataTable columns)
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [pricingBlur, setPricingBlur] = useState(false);

  // Mail Template modal state
  const [pokeEmailRow, setPokeEmailRow] = useState<MatchRow | null>(null);
  const [pokeEmailSentSuccess, setPokeEmailSentSuccess] = useState(false);

  // Premium profile editing unlock ($3 payment gate)
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);

  // ── RTK Query data hooks ───────────────────────────────────────────────────
  // Seed initial query args from URL so a reload lands on the same filtered page
  const [matchFilters, setMatchFilters] = useState<CandidateMatchesArgs>({
    page: currentPage,
    limit: currentPageSize,
    filter_type: filterType || undefined,
    sub_type: filterSubType || undefined,
    work_mode: filterWorkMode || undefined,
    search: debouncedSearch || undefined,
  });
  const {
    data: matchesData,
    isLoading: matchesLoading,
    error: matchesError,
    refetch: refetchMatches,
  } = useGetCandidateMatchesQuery(matchFilters);
  const { data: profileData, isLoading: profileLoading } = useGetProfileQuery();
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

  // Forwarded openings from marketer companies
  const { data: forwardedOpenings = [] } =
    useGetCandidateForwardedOpeningsQuery();

  // My Detail — only fetched when the "my-detail" view is active
  const { data: myDetail, isLoading: myDetailLoading } =
    useGetCandidateMyDetailQuery(undefined, {
      skip:
        activeView !== "my-detail" &&
        activeView !== "employer-openings" &&
        activeView !== "employer-finance" &&
        activeView !== "employer-immigration",
    });

  // Derive flat arrays and metadata from RTK Query responses
  function parseMatchesResponse() {
    const matches: Job[] = Array.isArray(matchesData)
      ? matchesData
      : matchesData?.data ?? [];
    const total: number = Array.isArray(matchesData)
      ? matchesData.length
      : matchesData?.total ?? 0;
    const typeCounts: Record<string, number> = Array.isArray(matchesData)
      ? {}
      : matchesData?.typeCounts ?? {};
    const subTypeCounts: Record<string, Record<string, number>> = Array.isArray(
      matchesData,
    )
      ? {}
      : matchesData?.subTypeCounts ?? {};
    const err: string | null = matchesError
      ? (matchesError as any)?.data?.message ||
        (matchesError as any)?.error ||
        "Failed to load matches"
      : null;
    return { matches, total, typeCounts, subTypeCounts, err };
  }
  const {
    matches: candidateMatches,
    total: candidateMatchesTotal,
    typeCounts: candidateMatchesTypeCounts,
    subTypeCounts: candidateMatchesSubTypeCounts,
    err: error,
  } = parseMatchesResponse();

  const profile = profileData ?? null;
  const isProfileLocked = !!profile?.profile_locked;

  // Derive poke/email tracking from server-side pokesSentData data
  const pokedRowIds = useMemo(
    () =>
      new Set(pokesSentData.filter((p) => !p.is_email).map((p) => p.target_id)),
    [pokesSentData],
  );
  const emailedRowIds = useMemo(
    () =>
      new Set(pokesSentData.filter((p) => p.is_email).map((p) => p.target_id)),
    [pokesSentData],
  );
  const pokeCount = useMemo(
    () => pokesSentData.filter((p) => !p.is_email).length,
    [pokesSentData],
  );
  const emailCount = useMemo(
    () => pokesSentData.filter((p) => p.is_email).length,
    [pokesSentData],
  );

  // target_id → poke created_at (for 24h mail cooldown)
  const pokedAtMap = useMemo(
    () =>
      new Map(
        pokesSentData
          .filter((p) => !p.is_email)
          .map((p) => [p.target_id, p.created_at]),
      ),
    [pokesSentData],
  );

  // Pre-filtered lists for Pokes / Mails sections
  const pokesSentOnly = useMemo(
    () => pokesSentData.filter((p) => !p.is_email),
    [pokesSentData],
  );
  const mailsSentOnly = useMemo(
    () => pokesSentData.filter((p) => p.is_email),
    [pokesSentData],
  );
  const pokesReceivedOnly = useMemo(
    () => pokesReceivedData.filter((p) => !p.is_email),
    [pokesReceivedData],
  );
  const mailsReceivedOnly = useMemo(
    () => pokesReceivedData.filter((p) => p.is_email),
    [pokesReceivedData],
  );

  const profileUrl =
    username && profile
      ? `${globalThis.location.origin}/resume/${username}`
      : null;

  const openPricingModal = () => {
    setPricingBlur(true);
    globalThis.dispatchEvent(
      new CustomEvent("matchdb:openPricing", { detail: { tab: "candidate" } }),
    );
  };

  const onRequestPremiumUnlock = () => {
    // Trigger $3 profile-update payment via pricing modal
    setPricingBlur(true);
    globalThis.dispatchEvent(
      new CustomEvent("matchdb:openPricing", {
        detail: { tab: "candidate", package: "profile-update" },
      }),
    );
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    globalThis.addEventListener("matchdb:pricingClosed", onClose);
    return () =>
      globalThis.removeEventListener("matchdb:pricingClosed", onClose);
  }, []);

  // Listen for successful $3 profile-unlock payment
  useEffect(() => {
    const onUnlock = () => setPremiumUnlocked(true);
    globalThis.addEventListener("matchdb:profileUnlocked", onUnlock);
    return () =>
      globalThis.removeEventListener("matchdb:profileUnlocked", onUnlock);
  }, []);

  useEffect(() => {
    const onOpenProfile = () => {
      setProfileRequired(true);
      setProfileOpen(true);
    };
    globalThis.addEventListener("matchdb:openProfile", onOpenProfile);
    return () =>
      globalThis.removeEventListener("matchdb:openProfile", onOpenProfile);
  }, []);

  // Auto-close mail template success after 4s
  useEffect(() => {
    if (pokeEmailSentSuccess) {
      const t = setTimeout(() => setPokeEmailSentSuccess(false), 4000);
      return () => clearTimeout(t);
    }
  }, [pokeEmailSentSuccess]);

  const pokeLimit = POKE_LIMIT[plan] ?? 5;
  const profileChecked = useRef(false);

  const membershipTypes = useMemo(() => {
    if (!membershipConfig || Object.keys(membershipConfig).length === 0)
      return undefined;
    return Object.keys(membershipConfig);
  }, [membershipConfig]);

  // Debounce search text — also syncs ?q= in URL after 350 ms idle
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchText);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (searchText) n.set("q", searchText);
          else n.delete("q");
          n.delete("page");
          return n;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(t);
  }, [searchText]);

  // Helper: build the filter payload for RTK Query matchFilters
  const buildFilterArgs = (
    page: number,
    pageSize: number,
  ): CandidateMatchesArgs => ({
    page,
    limit: pageSize,
    types: membershipTypes ? membershipTypes.join(",") : undefined,
    filter_type: filterType || undefined,
    sub_type: filterSubType || undefined,
    work_mode: filterWorkMode || undefined,
    search: debouncedSearch.trim() || undefined,
  });

  // Re-fetch when any URL filter / page param changes
  // On first mount skip — matchFilters already seeded from URL in useState init
  const filtersInitialized = useRef(false);
  useEffect(() => {
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    setMatchFilters(buildFilterArgs(currentPage, currentPageSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterType,
    filterSubType,
    filterWorkMode,
    debouncedSearch,
    currentPage,
    currentPageSize,
  ]);

  useEffect(() => {
    if (profileChecked.current) return;
    if (profileLoading) return;
    profileChecked.current = true;
    if (hasPurchasedVisibility && profile === null) {
      setProfileOpen(true);
    }
  }, [profileLoading, profile]);

  // Send profile location to shell for the subscription-location display
  useEffect(() => {
    if (profile?.location) {
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:profileLocation", {
          detail: { location: profile.location },
        }),
      );
    }
  }, [profile?.location]);

  // Send "Visible in" text to shell (displayed above pagehead)
  useEffect(() => {
    const parts: string[] = [];

    // Show subscription country with flag
    const country = (profile as any)?.profile_country;
    if (country) {
      const flag = COUNTRY_FLAGS[country] || "";
      const name = COUNTRY_NAMES[country] || country;
      parts.push(`${flag} ${name}`);
    }

    if (membershipConfig && Object.keys(membershipConfig).length > 0) {
      const domainText = Object.entries(membershipConfig)
        .map(([domain, subs]) =>
          subs.length > 0
            ? `${domain} (${subs.map((s) => s.toUpperCase()).join(", ")})`
            : domain,
        )
        .join(" · ");
      parts.push(domainText);
    }

    if (parts.length > 0) {
      const text = `Visible in: ${parts.join(
        " — ",
      )} — expand your reach by adding more subdomains.`;
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text } }),
      );
    }
    return () => {
      // Clear on unmount
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text: "" } }),
      );
    };
  }, [membershipConfig, (profile as any)?.profile_country]);

  // Emit footer info for shell to display
  useEffect(() => {
    const countMap: Record<string, number> = {
      matches: candidateMatchesTotal,
      "pokes-sent": pokesSentOnly.length,
      "pokes-received": pokesReceivedOnly.length,
      "mails-sent": mailsSentOnly.length,
      "mails-received": mailsReceivedOnly.length,
      forwarded: forwardedOpenings.length,
      "my-detail": myDetail?.projects.length ?? 0,
    };
    const count = countMap[activeView] ?? 0;
    globalThis.dispatchEvent(
      new CustomEvent("matchdb:footerInfo", {
        detail: {
          text: `Showing ${count} row${count === 1 ? "" : "s"} | InnoDB`,
        },
      }),
    );
    return () => {
      globalThis.dispatchEvent(
        new CustomEvent("matchdb:footerInfo", { detail: { text: "" } }),
      );
    };
  }, [
    activeView,
    candidateMatchesTotal,
    pokesSentOnly.length,
    pokesReceivedOnly.length,
    mailsSentOnly.length,
    mailsReceivedOnly.length,
  ]);

  const handlePageChange = (page: number, pageSize: number) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("page", String(page));
        n.set("size", String(pageSize));
        return n;
      },
      { replace: true },
    );
  };

  const hasMembership =
    !!membershipConfig && Object.keys(membershipConfig).length > 0;
  const showType = (type: string) => !hasMembership || type in membershipConfig;
  const showSubtype = (type: string, sub: string) => {
    if (!hasMembership) return true;
    const subs = membershipConfig[type];
    return subs !== undefined && (subs.length === 0 || subs.includes(sub));
  };

  useEffect(() => {
    return () => {
      clearPokeState();
    };
  }, []);

  /* ── Auto-refresh + flash animations (30 s cycle) ── */
  const refreshAll = useCallback(() => {
    refetchMatches();
    refetchPokesSent();
    refetchPokesReceived();
  }, [refetchMatches, refetchPokesSent, refetchPokesReceived]);

  // Live push: fires refreshAll immediately when data-collection uploads new data
  useLiveRefresh({ onRefresh: refreshAll });

  useAutoRefreshFlash({
    data: candidateMatches,
    keyExtractor: (j) => j.id,
    refresh: refreshAll,
  });
  useAutoRefreshFlash({
    data: pokesSentData,
    keyExtractor: (p) => p.id,
    refresh: refreshAll,
    enabled: false,
  });
  useAutoRefreshFlash({
    data: pokesReceivedData,
    keyExtractor: (p) => p.id,
    refresh: refreshAll,
    enabled: false,
  });

  const rows = useMemo<MatchRow[]>(() => {
    return candidateMatches.map((job) => ({
      id: job.id,
      name: job.recruiter_name || "Recruiter",
      company: companyFromEmail(job.vendor_email),
      email: job.vendor_email || "-",
      role: job.title,
      type: job.job_sub_type
        ? `${job.job_type || "-"} (${job.job_sub_type.toUpperCase()})`
        : job.job_type || "-",
      payPerHour: formatRate(job.pay_per_hour),
      experience: formatExperience(job.experience_required),
      matchPercentage: job.match_percentage || 0,
      location: job.location || "-",
      workMode: job.work_mode || "-",
      pokeTargetEmail: job.vendor_email || "",
      pokeTargetName: job.recruiter_name || "Vendor",
      pokeSubjectContext: job.title || "Job opening",
      rawData: job as unknown as Record<string, unknown>,
    }));
  }, [candidateMatches]);

  // ── Poke / Mail handlers (before columns so they can be referenced) ──
  const handlePoke = useCallback(
    (row: MatchRow) => {
      if (!row.pokeTargetEmail) return;
      if (Number.isFinite(pokeLimit) && pokeCount >= pokeLimit) return;
      clearPokeState();
      sendPoke({
        to_email: row.pokeTargetEmail,
        to_name: row.pokeTargetName,
        subject_context: row.pokeSubjectContext,
        target_id: row.id,
        target_vendor_id: row.rawData?.vendor_id as string | undefined,
        is_email: false,
        sender_name: profile?.name || userEmail || "Candidate",
        sender_email: userEmail || "",
        job_id: row.id,
        job_title: row.role,
      }).then(() => {
        refetchPokesSent();
      });
    },
    [
      sendPoke,
      clearPokeState,
      refetchPokesSent,
      pokeLimit,
      pokeCount,
      profile?.name,
      userEmail,
    ],
  );

  const handlePokeEmail = useCallback(
    (row: MatchRow) => {
      clearPokeState();
      setPokeEmailSentSuccess(false);
      setPokeEmailRow(row);
    },
    [clearPokeState],
  );

  // ── Sorted rows (client-side sort on current page) ──
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  // ── Column definitions (DataTableColumn from library) ──
  const matchColumns = useMemo<DataTableColumn<MatchRow>[]>(() => {
    const indicator = (key: SortKey) =>
      sortKey === key ? (
        <span className="th-sort">{sortDir === "asc" ? "▲" : "▼"}</span>
      ) : (
        <span className="th-sort" style={{ opacity: 0.3 }}>
          ⇅
        </span>
      );

    const onSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    };

    const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => {
      if (sortKey !== key) return "none";
      return sortDir === "asc" ? "ascending" : "descending";
    };

    const onRowClick = (row: MatchRow) => setSelectedJob(row.rawData || null);

    return [
      {
        key: "expand",
        header: "⊕",
        width: "22px",
        align: "center" as const,
        skeletonWidth: 22,
        render: (row: MatchRow) => (
          <Button
            variant="expand"
            title="View details (or double-click row)"
            onClick={() => onRowClick(row)}
          >
            ⊕
          </Button>
        ),
      },
      {
        key: "name",
        header: <>Name {indicator("name")}</>,
        width: "11%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("name"),
          "aria-sort": ariaSort("name"),
        },
        skeletonWidth: 100,
        render: (row: MatchRow) => (
          <button
            type="button"
            className="matchdb-link-btn"
            onClick={() => onRowClick(row)}
            title={`View details for ${row.name}`}
          >
            {row.name}
          </button>
        ),
        tooltip: (row: MatchRow) => row.name,
      },
      {
        key: "company",
        header: <>Company {indicator("company")}</>,
        width: "10%",
        className: "col-company matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("company"),
          "aria-sort": ariaSort("company"),
        },
        skeletonWidth: 90,
        render: (row: MatchRow) => <>{row.company}</>,
        tooltip: (row: MatchRow) => row.company,
      },
      {
        key: "email",
        header: "Mail ID",
        width: "11%",
        className: "col-email",
        skeletonWidth: 110,
        thProps: { title: "Contact email" },
        render: (row: MatchRow) => (
          <a
            href={`mailto:${row.email}`}
            style={{ color: "#2a5fa0", textDecoration: "none" }}
          >
            {row.email}
          </a>
        ),
        tooltip: (row: MatchRow) => row.email,
      },
      {
        key: "role",
        header: <>Role {indicator("role")}</>,
        width: "11%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("role"),
          "aria-sort": ariaSort("role"),
        },
        skeletonWidth: 100,
        render: (row: MatchRow) => <>{row.role}</>,
        tooltip: (row: MatchRow) => row.role,
      },
      {
        key: "type",
        header: <>Type {indicator("type")}</>,
        width: "8%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("type"),
          "aria-sort": ariaSort("type"),
        },
        skeletonWidth: 60,
        render: (row: MatchRow) => (
          <span className="matchdb-type-pill">{formatType(row.type)}</span>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        className: "col-mode",
        skeletonWidth: 50,
        thProps: { title: "Work arrangement" },
        render: (row: MatchRow) => <>{row.workMode || "-"}</>,
      },
      {
        key: "pay",
        header: "Pay/Hr",
        width: "6%",
        className: "col-pay",
        skeletonWidth: 50,
        thProps: { title: "Pay rate/hr" },
        render: (row: MatchRow) => <>{row.payPerHour}</>,
      },
      {
        key: "exp",
        header: "Exp",
        width: "5%",
        className: "col-experience",
        skeletonWidth: 40,
        thProps: { title: "Years of experience" },
        render: (row: MatchRow) => <>{row.experience}</>,
      },
      {
        key: "match",
        header: <>Match {indicator("matchPercentage")}</>,
        width: "10%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("matchPercentage"),
          "aria-sort": ariaSort("matchPercentage"),
        },
        skeletonWidth: 100,
        render: (row: MatchRow) => {
          const safePct = Math.max(0, Math.min(100, row.matchPercentage));
          return (
            <div className="matchdb-meter">
              <div className="matchdb-meter-row">
                <span className="matchdb-meter-label">
                  {row.matchPercentage}%
                </span>
                <span className="matchdb-meter-track">
                  <span
                    className={getMeterClass(safePct)}
                    style={{ width: `${safePct}%` }}
                  />
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "location",
        header: <>Location {indicator("location")}</>,
        width: "7%",
        className: "col-location matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("location"),
          "aria-sort": ariaSort("location"),
        },
        skeletonWidth: 70,
        render: (row: MatchRow) => <>{row.location}</>,
        tooltip: (row: MatchRow) => row.location,
      },
      {
        key: "actions",
        header: "Actions",
        width: "8%",
        skeletonWidth: 70,
        thProps: {
          title: "Actions: Poke (quick notify) · Mail Template (compose)",
        },
        render: (row: MatchRow) => {
          const alreadyPoked = pokedRowIds?.has(row.id) ?? false;
          const alreadyEmailed = emailedRowIds?.has(row.id) ?? false;

          const mailMatchTooLow = row.matchPercentage < MAIL_MATCH_THRESHOLD;
          const pokeMatchTooLow = row.matchPercentage < POKE_MATCH_THRESHOLD;

          const pokeAt = pokedAtMap?.get(row.id);
          const pokeTooRecent =
            !!pokeAt &&
            Date.now() - new Date(pokeAt).getTime() < POKE_COOLDOWN_MS;

          const pokeDisabled =
            pokeLoading || alreadyPoked || alreadyEmailed || pokeMatchTooLow;
          const mailDisabled =
            alreadyEmailed || mailMatchTooLow || pokeTooRecent;

          let pokeTitle: string;
          if (pokeMatchTooLow) {
            pokeTitle = `Match below ${POKE_MATCH_THRESHOLD}% — not eligible to poke`;
          } else if (alreadyEmailed) {
            pokeTitle = `Already emailed ${row.pokeTargetName} — cannot also poke`;
          } else if (alreadyPoked) {
            pokeTitle = `Already poked ${row.pokeTargetName}`;
          } else {
            pokeTitle = `Quick poke — notify ${row.pokeTargetName} by email`;
          }

          let mailTitle: string;
          if (mailMatchTooLow) {
            mailTitle = `Match below ${MAIL_MATCH_THRESHOLD}% — not eligible to send mail template`;
          } else if (alreadyEmailed) {
            mailTitle = `Already sent a mail template to ${row.pokeTargetName}`;
          } else if (pokeTooRecent) {
            mailTitle = `Mail unlocks 24 h after poking (poked at ${new Date(
              pokeAt,
            ).toLocaleTimeString()})`;
          } else {
            mailTitle = `Compose mail template to ${row.pokeTargetName}`;
          }

          let pokeStyle: React.CSSProperties = {};
          if (pokeMatchTooLow) {
            pokeStyle = {
              background: "var(--w97-red, #bb3333)",
              borderColor: "#fff #404040 #404040 #fff",
              cursor: "not-allowed",
            };
          } else if (alreadyPoked || alreadyEmailed) {
            pokeStyle = { opacity: 0.45, cursor: "not-allowed" };
          }

          let mailStyle: React.CSSProperties = {};
          if (mailMatchTooLow) {
            mailStyle = {
              background: "var(--w97-red, #bb3333)",
              borderColor: "#fff #404040 #404040 #fff",
              cursor: "not-allowed",
            };
          } else if (alreadyEmailed || pokeTooRecent) {
            mailStyle = { opacity: 0.4, cursor: "not-allowed" };
          }

          return (
            <div style={{ display: "flex", gap: 2 }}>
              <Button
                variant="poke"
                disabled={pokeDisabled}
                onClick={() => !pokeDisabled && handlePoke(row)}
                title={pokeTitle}
                aria-label={pokeTitle}
                style={{ flex: 1, ...pokeStyle }}
              >
                {(() => {
                  if (alreadyPoked) return "✓";
                  if (pokeLoading) return "…";
                  return "Poke";
                })()}
              </Button>
              <Button
                variant="email"
                disabled={mailDisabled}
                onClick={() => !mailDisabled && handlePokeEmail(row)}
                title={mailTitle}
                aria-label={mailTitle}
                style={{ flex: 1, ...mailStyle }}
              >
                {alreadyEmailed ? "✓" : "✉"}
              </Button>
            </div>
          );
        },
      },
    ];
  }, [
    sortKey,
    sortDir,
    pokeLoading,
    pokedRowIds,
    emailedRowIds,
    pokedAtMap,
    handlePoke,
    handlePokeEmail,
  ]);

  const handlePokeEmailSend = async (params: {
    to_email: string;
    to_name: string;
    subject_context: string;
    email_body: string;
    pdf_data?: string;
  }) => {
    if (!pokeEmailRow) return;
    await sendPoke({
      to_email: params.to_email,
      to_name: params.to_name,
      subject_context: params.subject_context,
      email_body: params.email_body,
      target_id: pokeEmailRow.id,
      target_vendor_id: pokeEmailRow.rawData?.vendor_id as string | undefined,
      is_email: true,
      sender_name: profile?.name || userEmail || "Candidate",
      sender_email: userEmail || "",
      pdf_attachment: params.pdf_data,
      job_id: pokeEmailRow.id,
      job_title: pokeEmailRow.role,
    })
      .unwrap()
      .then(() => {
        setPokeEmailSentSuccess(true);
        refetchPokesSent();
      })
      .catch(() => {
        // pokeError state is handled by useSendPokeMutation
      });
  };

  const handleDownloadCSV = () => {
    const headers = [
      "Name",
      "Company",
      "Email",
      "Role",
      "Type",
      "Mode",
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
        r.workMode || "-",
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
    a.download = "matched-jobs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const countByType = useMemo(() => {
    // Prefer server-provided counts (full dataset); fall back to local page data
    if (Object.keys(candidateMatchesTypeCounts).length > 0)
      return candidateMatchesTypeCounts;
    const map: Record<string, number> = {};
    candidateMatches.forEach((j) => {
      const t = j.job_type || "other";
      map[t] = (map[t] || 0) + 1;
    });
    return map;
  }, [candidateMatches, candidateMatchesTypeCounts]);

  const countBySubType = useMemo(() => {
    // Prefer server-provided counts (full dataset); fall back to local page data
    if (Object.keys(candidateMatchesSubTypeCounts).length > 0)
      return candidateMatchesSubTypeCounts;
    const map: Record<string, Record<string, number>> = {};
    candidateMatches.forEach((j) => {
      const t = j.job_type || "other";
      const st = j.job_sub_type || "";
      if (st) {
        if (!map[t]) map[t] = {};
        map[t][st] = (map[t][st] || 0) + 1;
      }
    });
    return map;
  }, [candidateMatches, candidateMatchesSubTypeCounts]);

  // Grand total across all types — for the "Matched Jobs" top-level nav count
  const grandTotal = useMemo(() => {
    const tc = candidateMatchesTypeCounts;
    if (Object.keys(tc).length > 0)
      return Object.values(tc).reduce((a, b) => a + b, 0);
    return candidateMatchesTotal;
  }, [candidateMatchesTypeCounts, candidateMatchesTotal]);

  const jobTypeNavItems = useMemo(() => {
    const items: NavGroup["items"] = [
      {
        id: "matched-jobs",
        label: "Matched Jobs",
        count: grandTotal,
        active:
          activeView === "matches" && filterType === "" && filterSubType === "",
        onClick: () => navParams({ view: "matches", type: null, sub: null }),
      },
    ];
    if (showType("contract")) {
      items.push({
        id: "contract",
        label: "Contract",
        count: countByType["contract"] || 0,
        active:
          activeView === "matches" &&
          filterType === "contract" &&
          filterSubType === "",
        onClick: () =>
          navParams({ view: "matches", type: "contract", sub: null }),
      });
      CONTRACT_SUB_TYPES.filter((st) =>
        showSubtype("contract", st.value),
      ).forEach((st) =>
        items.push({
          id: `contract_${st.value}`,
          label: st.label,
          depth: 1,
          count: countBySubType["contract"]?.[st.value] || 0,
          active:
            activeView === "matches" &&
            filterType === "contract" &&
            filterSubType === st.value,
          onClick: () =>
            navParams({ view: "matches", type: "contract", sub: st.value }),
        }),
      );
    }
    if (showType("full_time")) {
      items.push({
        id: "full_time",
        label: "Full Time",
        count: countByType["full_time"] || 0,
        active:
          activeView === "matches" &&
          filterType === "full_time" &&
          filterSubType === "",
        onClick: () =>
          navParams({ view: "matches", type: "full_time", sub: null }),
      });
      FULL_TIME_SUB_TYPES.filter((st) =>
        showSubtype("full_time", st.value),
      ).forEach((st) =>
        items.push({
          id: `full_time_${st.value}`,
          label: st.label,
          depth: 1,
          count: countBySubType["full_time"]?.[st.value] || 0,
          active:
            activeView === "matches" &&
            filterType === "full_time" &&
            filterSubType === st.value,
          onClick: () =>
            navParams({ view: "matches", type: "full_time", sub: st.value }),
        }),
      );
    }
    if (showType("part_time")) {
      items.push({
        id: "part_time",
        label: "Part Time",
        count: countByType["part_time"] || 0,
        active:
          activeView === "matches" &&
          filterType === "part_time" &&
          filterSubType === "",
        onClick: () =>
          navParams({ view: "matches", type: "part_time", sub: null }),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    membershipConfig,
    candidateMatches.length,
    grandTotal,
    countByType,
    countBySubType,
    filterType,
    filterSubType,
    activeView,
  ]);

  function buildNavGroups(): NavGroup[] {
    return [
      {
        label: "Profile",
        icon: "",
        items: [
          {
            id: "my-profile",
            label: "My Profile",
            active: profileOpen,
            onClick: () => setProfileOpen(true),
          },
          {
            id: "update-profile",
            label:
              isProfileLocked && !premiumUnlocked
                ? "✏ Update Profile ($3)"
                : "✏ Update Profile",
            tooltip: (() => {
              if (isProfileLocked && !premiumUnlocked)
                return "Edit company, experience & bio — costs $3, pay at billing";
              if (isProfileLocked)
                return "Premium fields unlocked — all editable";
              return "Edit your profile details";
            })(),
            active: false,
            onClick: () => setProfileOpen(true),
          },
        ],
      },
      {
        label: "Job Type",
        icon: "",
        items: jobTypeNavItems,
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
            active: activeView === "pokes-sent",
            onClick: () => navParams({ view: "pokes-sent" }),
          },
          {
            id: "pokes-received",
            label: "Pokes Received",
            count: pokesReceivedOnly.length,
            active: activeView === "pokes-received",
            onClick: () => navParams({ view: "pokes-received" }),
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
            active: activeView === "mails-sent",
            onClick: () => navParams({ view: "mails-sent" }),
          },
          {
            id: "mails-received",
            label: "Mails Received",
            count: mailsReceivedOnly.length,
            active: activeView === "mails-received",
            onClick: () => navParams({ view: "mails-received" }),
          },
          ...(hasPurchasedVisibility && rows.length > 0
            ? [
                {
                  id: "mail-template",
                  label: "✉ Mail Template",
                  tooltip:
                    "Compose a personalised email with your resume — click ✉ next to any row",
                  onClick: () => {
                    navParams({ view: "matches" });
                    if (rows.length > 0) handlePokeEmail(rows[0]);
                  },
                },
              ]
            : []),
        ],
      },
      {
        label: "My Dashboard",
        icon: "",
        items: [
          {
            id: "my-detail",
            label: "My Dashboard",
            active: activeView === "my-detail",
            onClick: () => navParams({ view: "my-detail", dtab: "overview" }),
          },
          {
            id: "my-detail-overview",
            label: "Overview",
            depth: 1,
            active: activeView === "my-detail" && myDetailTab === "overview",
            onClick: () => navParams({ view: "my-detail", dtab: "overview" }),
          },
          {
            id: "my-detail-projects",
            label: "Projects",
            depth: 1,
            count: myDetail?.projects.length ?? 0,
            active: activeView === "my-detail" && myDetailTab === "projects",
            onClick: () => navParams({ view: "my-detail", dtab: "projects" }),
          },
          {
            id: "my-detail-activity",
            label: "Marketer Activity",
            depth: 1,
            count: myDetail?.vendor_activity.length ?? 0,
            active:
              activeView === "my-detail" && myDetailTab === "marketer-activity",
            onClick: () =>
              navParams({ view: "my-detail", dtab: "marketer-activity" }),
          },
          {
            id: "my-detail-forwarded",
            label: "Forwarded Openings",
            depth: 1,
            count: myDetail?.forwarded_openings.length ?? 0,
            active:
              activeView === "my-detail" &&
              myDetailTab === "forwarded-openings",
            onClick: () =>
              navParams({ view: "my-detail", dtab: "forwarded-openings" }),
          },
        ],
      },
      {
        label: "Actions",
        icon: "",
        items: [
          {
            id: "forwarded",
            label: `Forwarded Openings`,
            count: forwardedOpenings.length,
            active: activeView === "forwarded",
            onClick: () => navParams({ view: "forwarded" }),
          },
          {
            id: "refresh",
            label: "Refresh Data",
            onClick: () => {
              setSearchParams(
                (prev) => {
                  const n = new URLSearchParams(prev);
                  n.delete("page");
                  return n;
                },
                { replace: true },
              );
              setMatchFilters(buildFilterArgs(1, currentPageSize));
              refetchPokesSent();
              refetchPokesReceived();
            },
          },
          {
            id: "reset",
            label: "Reset Filters",
            onClick: () => {
              setSearchText("");
              navParams({ type: null, sub: null, mode: null, q: null });
            },
          },
          ...(profileUrl
            ? [
                {
                  id: "profile-url",
                  label: urlCopied ? "✓ Copied!" : "🔗 Copy Profile URL",
                  tooltip: `Click to copy: ${profileUrl}`,
                  onClick: () => {
                    navigator.clipboard.writeText(profileUrl);
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2500);
                  },
                },
              ]
            : []),
        ],
      },
      {
        label: "Vendor",
        icon: "",
        items: [
          {
            id: "vendor-openings",
            label: "Forwarded Openings",
            count: forwardedOpenings.length,
            active: activeView === "vendor-openings",
            onClick: () => navParams({ view: "vendor-openings", sub: null }),
          },
          ...["contract", "c2c", "w2c", "c2h", "full_time"].map((sub) => ({
            id: `vendor-${sub}`,
            label: sub
              .replaceAll("_", " ")
              .replaceAll(/\b\w/g, (c) => c.toUpperCase()),
            depth: 1,
            count: forwardedOpenings.filter(
              (f) => f.job_type === sub || f.job_sub_type === sub,
            ).length,
            active: activeView === "vendor-openings" && filterSubType === sub,
            onClick: () => navParams({ view: "vendor-openings", sub }),
          })),
        ],
      },
      {
        label: "Employer",
        icon: "",
        items: [
          {
            id: "employer-openings",
            label: "Forwarded Openings",
            count: forwardedOpenings.length,
            active: activeView === "employer-openings",
            onClick: () => navParams({ view: "employer-openings" }),
          },
          {
            id: "employer-finance",
            label: "Finance",
            count: myDetail?.projects.length ?? 0,
            active: activeView === "employer-finance",
            onClick: () => navParams({ view: "employer-finance" }),
          },
          {
            id: "employer-immigration",
            label: "Immigration",
            active: activeView === "employer-immigration",
            onClick: () => navParams({ view: "employer-immigration" }),
          },
        ],
      },
    ];
  }
  const navGroups = buildNavGroups();

  const filterLabel = (() => {
    if (!filterType) return "All Types";
    const typeLabel =
      JOB_TYPES.find((t) => t.value === filterType)?.label || filterType;
    if (!filterSubType) return typeLabel;
    const subTypes =
      filterType === "contract" ? CONTRACT_SUB_TYPES : FULL_TIME_SUB_TYPES;
    const subLabel =
      subTypes.find((st) => st.value === filterSubType)?.label || filterSubType;
    return `${typeLabel} › ${subLabel}`;
  })();

  const myDetailTabLabel = (() => {
    if (myDetailTab === "overview") return "Overview";
    if (myDetailTab === "projects") return "Projects";
    if (myDetailTab === "marketer-activity") return "Marketer Activity";
    return "Forwarded Openings";
  })();

  const breadcrumb: [string, string, string] = (() => {
    if (activeView === "pokes-sent")
      return ["Candidate Portal", "Pokes", "Pokes Sent"];
    if (activeView === "pokes-received")
      return ["Candidate Portal", "Pokes", "Pokes Received"];
    if (activeView === "mails-sent")
      return ["Candidate Portal", "Mails", "Mails Sent"];
    if (activeView === "mails-received")
      return ["Candidate Portal", "Mails", "Mails Received"];
    if (activeView === "forwarded")
      return ["Candidate Portal", "Actions", "Forwarded Openings"];
    if (activeView === "my-detail")
      return ["Candidate Portal", "My Dashboard", myDetailTabLabel];
    if (activeView === "vendor-openings")
      return [
        "Candidate Portal",
        "Vendor",
        filterSubType
          ? `Openings › ${filterSubType
              .replaceAll("_", " ")
              .replaceAll(/\b\w/g, (c) => c.toUpperCase())}`
          : "Forwarded Openings",
      ];
    if (activeView === "employer-openings")
      return ["Candidate Portal", "Employer", "Forwarded Openings"];
    if (activeView === "employer-finance")
      return ["Candidate Portal", "Employer", "Finance"];
    if (activeView === "employer-immigration")
      return ["Candidate Portal", "Employer", "Immigration"];
    return ["Candidate Portal", "Matched Jobs", filterLabel];
  })();

  const blurStyle: React.CSSProperties | undefined =
    profileOpen || pricingBlur
      ? { filter: "blur(2px)", pointerEvents: "none", userSelect: "none" }
      : undefined;

  function renderOverviewTab() {
    if (!myDetail) return null;
    const allFins = myDetail.projects.flatMap((p) => p.financials);
    const _totalBilled = allFins.reduce((a, f) => a + f.totalBilled, 0);
    const totalPay = allFins.reduce((a, f) => a + f.totalPay, 0);
    const totalNet = allFins.reduce((a, f) => a + f.netPayable, 0);
    const totalPaid = allFins.reduce((a, f) => a + f.amountPaid, 0);
    const totalPending = allFins.reduce(
      (a, f) => a + Math.max(0, f.amountPending),
      0,
    );
    const totalHours = allFins.reduce((a, f) => a + f.hoursWorked, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* ── Single-line profile strip ── */}
        <div
          style={{
            borderBottom: "1px solid var(--w97-border)",
            background: "var(--w97-panel-bg, #f4f4f4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "3px 0",
              padding: "8px 14px",
              fontSize: 12,
            }}
          >
            {(
              [
                { v: myDetail.profile?.current_role, bold: true },
                { v: myDetail.profile?.current_company },
                { v: myDetail.profile?.location },
                {
                  v:
                    myDetail.profile?.expected_hourly_rate == null
                      ? null
                      : `$${myDetail.profile.expected_hourly_rate}/hr`,
                },
                {
                  v:
                    myDetail.profile?.experience_years == null
                      ? null
                      : `${myDetail.profile.experience_years} yrs`,
                },
                { v: myDetail.profile?.phone },
                { v: myDetail.profile?.email },
              ] as { v: string | null | undefined; bold?: boolean }[]
            )
              .filter((x) => x.v)
              .map((x, i, arr) => (
                <React.Fragment key={x.v}>
                  <span
                    style={{
                      fontWeight: x.bold ? 700 : 400,
                      color: x.bold ? "var(--w97-titlebar-from)" : "inherit",
                    }}
                  >
                    {x.v}
                  </span>
                  {i < arr.length - 1 && (
                    <span
                      style={{
                        margin: "0 7px",
                        color: "var(--w97-text-secondary)",
                        fontWeight: 300,
                      }}
                    >
                      ·
                    </span>
                  )}
                </React.Fragment>
              ))}
            {/* Stats badges — right side */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 5,
                flexWrap: "nowrap",
                alignItems: "center",
                paddingLeft: 12,
              }}
            >
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {myDetail.projects.filter((p) => p.is_active).length} active
                projects
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {myDetail.vendor_activity.length} interactions
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {myDetail.forwarded_openings.length} forwarded
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {myDetail.marketer_info.length} marketers
              </span>
            </div>
          </div>
          {/* Skills row */}
          {(myDetail.profile?.skills || []).length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                padding: "0 14px 7px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--w97-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginRight: 4,
                }}
              >
                Skills
              </span>
              {(myDetail.profile?.skills || []).map((s) => (
                <span
                  key={s}
                  style={{
                    background: "#e8f0fe",
                    color: "var(--w97-blue)",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Financial KPI strip ── */}
        {allFins.length > 0 && (
          <div className="ov-kpi-strip" style={{ margin: "10px 14px 0" }}>
            {[
              {
                label: "Hours",
                value: totalHours.toFixed(0),
                cls: "ov-kv-blue",
              },
              { label: "Total Pay", value: fmtC(totalPay), cls: "ov-kv-green" },
              {
                label: "Net Payable",
                value: fmtC(totalNet),
                cls: "ov-kv-teal",
              },
              { label: "Paid", value: fmtC(totalPaid), cls: "ov-kv-blue" },
              {
                label: "Pending",
                value: fmtC(totalPending),
                cls: totalPending > 0 ? "ov-kv-red" : "ov-kv-blue",
              },
            ].map((k, i, arr) => (
              <React.Fragment key={k.label}>
                <div className="ov-kpi">
                  <span className="ov-kpi-label">{k.label}</span>
                  <span className={`ov-kpi-value ${k.cls}`}>{k.value}</span>
                </div>
                {i < arr.length - 1 && <div className="ov-kpi-div" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Marketer roster summary table ── */}
        {myDetail.marketer_info.length > 0 && (
          <div style={{ padding: "10px 14px 0" }}>
            <table
              style={{
                width: "100%",
                fontSize: 12,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {["Company", "Invite Status", "Forwarded", "Joined"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "1px solid var(--w97-border)",
                          color: "var(--w97-text-secondary)",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {myDetail.marketer_info.map((mc) => (
                  <tr
                    key={mc.id}
                    style={{
                      borderBottom: "1px solid var(--w97-border-light)",
                    }}
                  >
                    <td style={{ padding: "4px 8px", fontWeight: 500 }}>
                      {mc.company_name || "—"}
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <span className="matchdb-type-pill">
                        {mc.invite_status}
                      </span>
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      {mc.forwarded_count}
                    </td>
                    <td
                      style={{
                        padding: "4px 8px",
                        color: "var(--w97-text-secondary)",
                      }}
                    >
                      {new Date(mc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderProjectCard(
    proj: (typeof myDetail & object)["projects"][number],
  ) {
    return (
      <div
        key={proj.id}
        className="matchdb-card"
        style={{ marginBottom: 16, padding: 16 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: "var(--w97-titlebar-from)",
              }}
            >
              {proj.job_title}
            </h4>
            <div
              style={{
                fontSize: 11,
                color: "var(--w97-text-secondary)",
                marginTop: 2,
              }}
            >
              {proj.vendor_email} · {proj.location || "—"} · {proj.job_type}
              {proj.job_sub_type ? ` › ${proj.job_sub_type}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="matchdb-type-pill">{proj.status}</span>
            {proj.is_active ? (
              <span
                className="matchdb-type-pill"
                style={{ background: "#e8f5e9", color: "#2e7d32" }}
              >
                Active
              </span>
            ) : (
              <span
                className="matchdb-type-pill"
                style={{ background: "#fff5f5", color: "#bb3333" }}
              >
                Closed
              </span>
            )}
          </div>
        </div>

        {proj.financials.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--w97-text-secondary)",
              fontStyle: "italic",
            }}
          >
            No financial data recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 11,
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Bill Rate",
                    "Pay Rate",
                    "Hours",
                    "Total Billed",
                    "Total Pay",
                    "Tax",
                    "Cash",
                    "Net Payable",
                    "Paid",
                    "Pending",
                    "Period",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "right",
                        padding: "4px 8px",
                        borderBottom: "1px solid var(--w97-border)",
                        color: "var(--w97-text-secondary)",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proj.financials.map((fin) => (
                  <tr
                    key={fin.id}
                    style={{
                      borderBottom: "1px solid var(--w97-border-light)",
                    }}
                  >
                    {finCellValues(fin).map((v, i) => (
                      <td
                        key={`col-${i}-${v}`}
                        style={{
                          textAlign: "right",
                          padding: "5px 8px",
                          fontFamily: "monospace",
                        }}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {proj.financials[0]?.notes && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--w97-text-secondary)",
                  fontStyle: "italic",
                }}
              >
                Note: {proj.financials[0].notes}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderProjectsTab() {
    if (!myDetail) return null;
    if (myDetail.projects.length === 0) {
      return (
        <div style={{ padding: 16 }}>
          <Panel>
            <div
              style={{
                padding: 32,
                textAlign: "center",
                fontSize: 13,
                color: "var(--w97-text-secondary)",
              }}
            >
              No projects found. Apply to jobs to see them here.
            </div>
          </Panel>
        </div>
      );
    }
    return (
      <div style={{ padding: 16 }}>
        {myDetail.projects.map((proj) => renderProjectCard(proj))}
      </div>
    );
  }

  /* ── Vendor Openings ── */
  function renderVendorOpenings() {
    const filtered = filterSubType
      ? forwardedOpenings.filter(
          (f) =>
            f.job_type === filterSubType || f.job_sub_type === filterSubType,
        )
      : forwardedOpenings;

    // Group by vendor_email
    const vendorMap = new Map<string, ForwardedOpeningItem[]>();
    for (const f of filtered) {
      const key = f.vendor_email || "Unknown Vendor";
      if (!vendorMap.has(key)) vendorMap.set(key, []);
      vendorMap.get(key)!.push(f);
    }

    const subLabel = filterSubType
      ? filterSubType
          .replaceAll("_", " ")
          .replaceAll(/\b\w/g, (c) => c.toUpperCase())
      : "All Types";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <DataTable<ForwardedOpeningItem>
          columns={[
            {
              key: "vendor_email",
              header: "Vendor",
              width: "14%",
              skeletonWidth: 100,
              render: (f) => <>{f.vendor_email || "—"}</>,
            },
            {
              key: "job_title",
              header: "Job Title",
              width: "16%",
              skeletonWidth: 120,
              render: (f) => <>{f.job_title}</>,
            },
            {
              key: "company_name",
              header: "From Company",
              width: "12%",
              skeletonWidth: 100,
              render: (f) => <>{f.company_name}</>,
            },
            {
              key: "job_type",
              header: "Type",
              width: "10%",
              skeletonWidth: 70,
              render: (f) => (
                <>
                  {f.job_type}
                  {f.job_sub_type ? ` › ${f.job_sub_type}` : ""}
                </>
              ),
            },
            {
              key: "job_location",
              header: "Location",
              width: "10%",
              skeletonWidth: 70,
              render: (f) => <>{f.job_location || "—"}</>,
            },
            {
              key: "skills_required",
              header: "Skills",
              width: "14%",
              skeletonWidth: 120,
              render: (f) => (
                <>
                  {(f.skills_required || []).slice(0, 3).join(", ")}
                  {(f.skills_required || []).length > 3
                    ? ` +${f.skills_required.length - 3}`
                    : ""}
                </>
              ),
            },
            {
              key: "comp",
              header: "Comp",
              width: "8%",
              skeletonWidth: 60,
              render: (f) => (
                <>
                  {(() => {
                    if (f.pay_per_hour) return `$${f.pay_per_hour}/hr`;
                    if (f.salary_min || f.salary_max)
                      return `$${(f.salary_min || 0) / 1000}k–$${
                        (f.salary_max || 0) / 1000
                      }k`;
                    return "—";
                  })()}
                </>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "7%",
              skeletonWidth: 50,
              render: (f) => (
                <span className="matchdb-type-pill">{f.status}</span>
              ),
            },
            {
              key: "created_at",
              header: "Sent",
              width: "7%",
              skeletonWidth: 60,
              render: (f) => (
                <>
                  {new Date(f.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(f) => f.id}
          loading={false}
          paginate
          titleIcon="🏢"
          title={`Vendor Forwarded Openings — ${subLabel}`}
          emptyMessage="No vendor forwarded openings found for this category."
        />
      </div>
    );
  }

  /* ── Employer Forwarded Openings ── */
  function renderEmployerOpenings() {
    return (
      <DataTable<ForwardedOpeningItem>
        columns={[
          {
            key: "company_name",
            header: "Employer / Company",
            width: "14%",
            skeletonWidth: 100,
            render: (f) => <>{f.company_name || "—"}</>,
          },
          {
            key: "marketer_email",
            header: "Marketer",
            width: "14%",
            skeletonWidth: 100,
            render: (f) => <>{f.marketer_email || "—"}</>,
          },
          {
            key: "job_title",
            header: "Job Title",
            width: "16%",
            skeletonWidth: 120,
            render: (f) => <>{f.job_title}</>,
          },
          {
            key: "job_type",
            header: "Type",
            width: "10%",
            skeletonWidth: 70,
            render: (f) => (
              <>
                {f.job_type}
                {f.job_sub_type ? ` › ${f.job_sub_type}` : ""}
              </>
            ),
          },
          {
            key: "job_location",
            header: "Location",
            width: "10%",
            skeletonWidth: 70,
            render: (f) => <>{f.job_location || "—"}</>,
          },
          {
            key: "skills_required",
            header: "Skills",
            width: "14%",
            skeletonWidth: 120,
            render: (f) => (
              <>
                {(f.skills_required || []).slice(0, 3).join(", ")}
                {(f.skills_required || []).length > 3
                  ? ` +${f.skills_required.length - 3}`
                  : ""}
              </>
            ),
          },
          {
            key: "comp",
            header: "Comp",
            width: "8%",
            skeletonWidth: 60,
            render: (f) => (
              <>
                {(() => {
                  if (f.pay_per_hour) return `$${f.pay_per_hour}/hr`;
                  if (f.salary_min || f.salary_max)
                    return `$${(f.salary_min || 0) / 1000}k–$${
                      (f.salary_max || 0) / 1000
                    }k`;
                  return "—";
                })()}
              </>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "7%",
            skeletonWidth: 50,
            render: (f) => (
              <span className="matchdb-type-pill">{f.status}</span>
            ),
          },
          {
            key: "created_at",
            header: "Sent",
            width: "7%",
            skeletonWidth: 60,
            render: (f) => (
              <>
                {new Date(f.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </>
            ),
          },
        ]}
        data={forwardedOpenings}
        keyExtractor={(f) => f.id}
        loading={false}
        paginate
        titleIcon="🏭"
        title="Employer Forwarded Openings"
        emptyMessage="No employer forwarded openings found."
      />
    );
  }

  /* ── Employer Finance (read-only) ── */
  function renderEmployerFinance() {
    if (myDetailLoading)
      return (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            fontSize: 13,
            color: "var(--w97-text-secondary)",
          }}
        >
          Loading financial data…
        </div>
      );
    if (!myDetail || myDetail.projects.length === 0)
      return (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            fontSize: 13,
            color: "var(--w97-text-secondary)",
          }}
        >
          No financial data available. Projects with financial details will
          appear here.
        </div>
      );

    const allFins = myDetail.projects.flatMap((p) => p.financials);
    const totalBilled = allFins.reduce((a, f) => a + f.totalBilled, 0);
    const totalPay = allFins.reduce((a, f) => a + f.totalPay, 0);
    const totalNet = allFins.reduce((a, f) => a + f.netPayable, 0);
    const totalPaid = allFins.reduce((a, f) => a + f.amountPaid, 0);
    const totalPending = allFins.reduce(
      (a, f) => a + Math.max(0, f.amountPending),
      0,
    );
    const totalHours = allFins.reduce((a, f) => a + f.hoursWorked, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* ── Read-only badge ── */}
        <div
          style={{
            padding: "8px 14px",
            background: "var(--w97-panel-bg, #f4f4f4)",
            borderBottom: "1px solid var(--w97-border)",
            fontSize: 11,
            color: "var(--w97-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>🔒</span>
          <span>
            Read-only view — financial data is managed by your employer /
            marketer.
          </span>
        </div>

        {/* ── Financial KPI strip ── */}
        <div className="ov-kpi-strip" style={{ margin: "10px 14px 0" }}>
          {[
            {
              label: "Total Billed",
              value: fmtC(totalBilled),
              cls: "ov-kv-blue",
            },
            { label: "Hours", value: totalHours.toFixed(0), cls: "ov-kv-blue" },
            { label: "Total Pay", value: fmtC(totalPay), cls: "ov-kv-green" },
            { label: "Net Payable", value: fmtC(totalNet), cls: "ov-kv-teal" },
            { label: "Paid", value: fmtC(totalPaid), cls: "ov-kv-blue" },
            {
              label: "Pending",
              value: fmtC(totalPending),
              cls: totalPending > 0 ? "ov-kv-red" : "ov-kv-blue",
            },
          ].map((k, i, arr) => (
            <React.Fragment key={k.label}>
              <div className="ov-kpi">
                <span className="ov-kpi-label">{k.label}</span>
                <span className={`ov-kpi-value ${k.cls}`}>{k.value}</span>
              </div>
              {i < arr.length - 1 && <div className="ov-kpi-div" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Per-project financial breakdown ── */}
        <div style={{ padding: "10px 14px" }}>
          {myDetail.projects.map((proj) => (
            <div
              key={proj.id}
              className="matchdb-card"
              style={{ marginBottom: 16, padding: 16 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--w97-titlebar-from)",
                    }}
                  >
                    {proj.job_title}
                  </h4>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--w97-text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {proj.vendor_email} · {proj.location || "—"} ·{" "}
                    {proj.job_type}
                    {proj.job_sub_type ? ` › ${proj.job_sub_type}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="matchdb-type-pill">{proj.status}</span>
                  {proj.is_active ? (
                    <span
                      className="matchdb-type-pill"
                      style={{ background: "#e8f5e9", color: "#2e7d32" }}
                    >
                      Active
                    </span>
                  ) : (
                    <span
                      className="matchdb-type-pill"
                      style={{ background: "#fff5f5", color: "#bb3333" }}
                    >
                      Closed
                    </span>
                  )}
                </div>
              </div>

              {proj.financials.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--w97-text-secondary)",
                    fontStyle: "italic",
                  }}
                >
                  No financial data recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      fontSize: 11,
                      borderCollapse: "collapse",
                      minWidth: 700,
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "Bill Rate",
                          "Pay Rate",
                          "Hours",
                          "Total Billed",
                          "Total Pay",
                          "Tax",
                          "Cash",
                          "Net Payable",
                          "Paid",
                          "Pending",
                          "Period",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "right",
                              padding: "4px 8px",
                              borderBottom: "1px solid var(--w97-border)",
                              color: "var(--w97-text-secondary)",
                              fontWeight: 600,
                              fontSize: 10,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {proj.financials.map((fin) => (
                        <tr
                          key={fin.id}
                          style={{
                            borderBottom: "1px solid var(--w97-border-light)",
                          }}
                        >
                          {finCellValues(fin).map((v, i) => (
                            <td
                              key={`col-${i}-${v}`}
                              style={{
                                textAlign: "right",
                                padding: "5px 8px",
                                fontFamily: "monospace",
                              }}
                            >
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Employer Immigration (read-only placeholder) ── */
  function renderEmployerImmigration() {
    return (
      <div>
        <div
          style={{
            padding: "8px 14px",
            background: "var(--w97-panel-bg, #f4f4f4)",
            borderBottom: "1px solid var(--w97-border)",
            fontSize: 11,
            color: "var(--w97-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>🔒</span>
          <span>
            Read-only view — immigration data is managed by your employer /
            marketer.
          </span>
        </div>
        <div
          style={{
            background: "var(--w97-window)",
            border: "1px solid var(--w97-border)",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛂</div>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 15,
              color: "var(--w97-titlebar-from)",
            }}
          >
            Immigration Tracking
          </h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--w97-text-secondary)",
              maxWidth: 400,
              margin: "0 auto",
            }}
          >
            Visa status, sponsorship details, and immigration documents from
            your employer will appear here. This section is under development.
          </p>
        </div>
      </div>
    );
  }

  function renderMyDashboard() {
    if (myDetailLoading)
      return (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            fontSize: 13,
            color: "var(--w97-text-secondary)",
          }}
        >
          Loading your dashboard…
        </div>
      );
    if (!myDetail)
      return (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            fontSize: 13,
            color: "var(--w97-text-secondary)",
          }}
        >
          No data found. Complete your profile to see details here.
        </div>
      );
    return (
      <>
        <Tabs
          activeKey={myDetailTab}
          onSelect={(key) => navParams({ dtab: key }, false)}
          tabs={[
            { key: "overview", label: "👤 Overview" },
            {
              key: "projects",
              label: (
                <>
                  📋 Projects{" "}
                  <span className="matchdb-tab-badge">
                    {myDetail.projects.length}
                  </span>
                </>
              ),
            },
            {
              key: "marketer-activity",
              label: (
                <>
                  📊 Marketer Activity{" "}
                  <span className="matchdb-tab-badge">
                    {myDetail.vendor_activity.length}
                  </span>
                </>
              ),
            },
            {
              key: "forwarded-openings",
              label: (
                <>
                  📤 Forwarded Openings{" "}
                  <span className="matchdb-tab-badge">
                    {myDetail.forwarded_openings.length}
                  </span>
                </>
              ),
            },
          ]}
        />

        {/* ── Tab: Overview ── */}
        {myDetailTab === "overview" && renderOverviewTab()}

        {/* ── Tab: Projects ── */}
        {myDetailTab === "projects" && renderProjectsTab()}

        {/* ── Tab: Marketer Activity ── */}
        {myDetailTab === "marketer-activity" && (
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Marketer summary */}
            {myDetail.marketer_info.length > 0 && (
              <div className="matchdb-card" style={{ padding: 16 }}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--w97-titlebar-from)",
                  }}
                >
                  Marketing Companies Representing You
                </h3>
                <table
                  style={{
                    width: "100%",
                    fontSize: 12,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      {["Company", "Status", "Forwarded to You", "Added"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "4px 8px",
                              borderBottom: "1px solid var(--w97-border)",
                              color: "var(--w97-text-secondary)",
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {myDetail.marketer_info.map((mc) => (
                      <tr
                        key={mc.id}
                        style={{
                          borderBottom: "1px solid var(--w97-border-light)",
                        }}
                      >
                        <td style={{ padding: "5px 8px", fontWeight: 500 }}>
                          {mc.company_name || "—"}
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          <span className="matchdb-type-pill">
                            {mc.invite_status}
                          </span>
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>
                          {mc.forwarded_count}
                        </td>
                        <td
                          style={{
                            padding: "5px 8px",
                            color: "var(--w97-text-secondary)",
                          }}
                        >
                          {new Date(mc.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Poke / Email activity received */}
            <DataTable<(typeof myDetail.vendor_activity)[number]>
              columns={[
                {
                  key: "sender_name",
                  header: "From",
                  width: "15%",
                  skeletonWidth: 100,
                  render: (r) => <>{r.sender_name || r.sender_email}</>,
                },
                {
                  key: "sender_email",
                  header: "Email",
                  width: "18%",
                  skeletonWidth: 120,
                  render: (r) => (
                    <a
                      href={`mailto:${r.sender_email}`}
                      style={{ color: "#2a5fa0", textDecoration: "none" }}
                    >
                      {r.sender_email}
                    </a>
                  ),
                },
                {
                  key: "sender_type",
                  header: "Type",
                  width: "8%",
                  skeletonWidth: 60,
                  render: (r) => (
                    <span className="matchdb-type-pill">{r.sender_type}</span>
                  ),
                },
                {
                  key: "kind",
                  header: "Kind",
                  width: "7%",
                  skeletonWidth: 50,
                  render: (r) => <>{r.is_email ? "✉ Email" : "👋 Poke"}</>,
                },
                {
                  key: "subject",
                  header: "Subject",
                  width: "22%",
                  skeletonWidth: 140,
                  render: (r) => <>{r.subject || "—"}</>,
                },
                {
                  key: "job_title",
                  header: "Job",
                  width: "18%",
                  skeletonWidth: 110,
                  render: (r) => <>{r.job_title || "—"}</>,
                },
                {
                  key: "created_at",
                  header: "Date",
                  width: "12%",
                  skeletonWidth: 70,
                  render: (r) => (
                    <>
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </>
                  ),
                },
              ]}
              data={myDetail.vendor_activity}
              keyExtractor={(r) => r.id}
              loading={myDetailLoading}
              paginate
              titleIcon="📊"
              title="Vendor Interactions (Pokes & Emails Sent to You)"
              emptyMessage="No vendor activity recorded yet."
            />
          </div>
        )}

        {/* ── Tab: Forwarded Openings ── */}
        {myDetailTab === "forwarded-openings" && (
          <div style={{ padding: 16 }}>
            <DataTable<(typeof myDetail.forwarded_openings)[number]>
              columns={[
                {
                  key: "job_title",
                  header: "Job Title",
                  width: "18%",
                  skeletonWidth: 120,
                  render: (f) => <>{f.job_title}</>,
                },
                {
                  key: "company_name",
                  header: "From Company",
                  width: "14%",
                  skeletonWidth: 100,
                  render: (f) => <>{f.company_name || "—"}</>,
                },
                {
                  key: "marketer_email",
                  header: "Marketer",
                  width: "16%",
                  skeletonWidth: 110,
                  render: (f) => (
                    <a
                      href={`mailto:${f.marketer_email}`}
                      style={{ color: "#2a5fa0", textDecoration: "none" }}
                    >
                      {f.marketer_email}
                    </a>
                  ),
                },
                {
                  key: "job_type",
                  header: "Type",
                  width: "10%",
                  skeletonWidth: 70,
                  render: (f) => (
                    <>
                      {f.job_type}
                      {f.job_sub_type ? ` › ${f.job_sub_type}` : ""}
                    </>
                  ),
                },
                {
                  key: "job_location",
                  header: "Location",
                  width: "10%",
                  skeletonWidth: 70,
                  render: (f) => <>{f.job_location || "—"}</>,
                },
                {
                  key: "vendor_email",
                  header: "Vendor",
                  width: "14%",
                  skeletonWidth: 90,
                  render: (f) => <>{f.vendor_email || "—"}</>,
                },
                {
                  key: "note",
                  header: "Note",
                  width: "9%",
                  skeletonWidth: 60,
                  render: (f) => (
                    <span style={{ fontSize: 10 }}>{f.note || "—"}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "7%",
                  skeletonWidth: 50,
                  render: (f) => (
                    <span className="matchdb-type-pill">{f.status}</span>
                  ),
                },
                {
                  key: "created_at",
                  header: "Date",
                  width: "8%",
                  skeletonWidth: 60,
                  render: (f) => (
                    <>
                      {new Date(f.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </>
                  ),
                },
              ]}
              data={myDetail.forwarded_openings}
              keyExtractor={(f) => f.id}
              loading={myDetailLoading}
              paginate
              titleIcon="📤"
              title="Job Openings Forwarded to You by Your Marketing Company"
              emptyMessage="No openings have been forwarded to you yet."
            />
          </div>
        )}
      </>
    );
  }

  function renderUnlockedContent() {
    return (
      <>
        {/* Error banner */}
        {error && (
          <div
            className="w97-alert w97-alert-error"
            role="alert"
            aria-live="assertive"
          >
            ⚠ Failed to load matches: {error}
            <Button
              aria-label="Retry loading matches"
              onClick={() => refetchMatches()}
              size="xs"
            >
              ↺ Retry
            </Button>
          </div>
        )}

        {/* ── Dashboard stat rectangles ── */}
        <div className="matchdb-stat-bar">
          {[
            {
              label: "Matched Jobs",
              value: grandTotal,
              icon: "📌",
              view: "matches" as ActiveView,
            },
            {
              label: "Pokes Sent",
              value: pokesSentOnly.length,
              icon: "👋",
              view: "pokes-sent" as ActiveView,
            },
            {
              label: "Pokes In",
              value: pokesReceivedOnly.length,
              icon: "📥",
              view: "pokes-received" as ActiveView,
            },
            {
              label: "Mails Sent",
              value: mailsSentOnly.length,
              icon: "📤",
              view: "mails-sent" as ActiveView,
            },
            {
              label: "Mails In",
              value: mailsReceivedOnly.length,
              icon: "📬",
              view: "mails-received" as ActiveView,
            },
            {
              label: "Visibility",
              value: hasPurchasedVisibility ? 1 : 0,
              icon: hasPurchasedVisibility ? "🟢" : "🔴",
              customLabel: hasPurchasedVisibility ? "Active" : "Off",
            },
          ].map((card: any) => (
            <button
              key={card.label}
              type="button"
              className={`matchdb-stat-rect${
                card.view && activeView === card.view
                  ? " matchdb-stat-rect-active"
                  : ""
              }`}
              onClick={() => {
                if (card.view) {
                  if (card.view === "matches") {
                    navParams({ view: "matches", type: null, sub: null });
                  } else {
                    navParams({ view: card.view });
                  }
                }
              }}
              title={card.view ? `View ${card.label}` : card.label}
            >
              {card.icon && (
                <span className="matchdb-stat-icon">{card.icon}</span>
              )}
              <span>
                <span
                  className="matchdb-stat-value"
                  style={{
                    color: countColor(card.value),
                    background: countBg(card.value),
                  }}
                >
                  {card.customLabel ?? card.value}
                </span>
                <span className="matchdb-stat-label">{card.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Pokes Sent view */}
        {activeView === "pokes-sent" && (
          <PokesTable
            pokes={pokesSentOnly}
            loading={pokesSentLoading}
            section="pokes-sent"
            userType="candidate"
          />
        )}

        {/* Pokes Received view */}
        {activeView === "pokes-received" && (
          <PokesTable
            pokes={pokesReceivedOnly}
            loading={pokesSentLoading}
            section="pokes-received"
            userType="candidate"
          />
        )}

        {/* Mails Sent view */}
        {activeView === "mails-sent" && (
          <PokesTable
            pokes={mailsSentOnly}
            loading={pokesSentLoading}
            section="mails-sent"
            userType="candidate"
          />
        )}

        {/* Mails Received view */}
        {activeView === "mails-received" && (
          <PokesTable
            pokes={mailsReceivedOnly}
            loading={pokesSentLoading}
            section="mails-received"
            userType="candidate"
          />
        )}

        {/* Forwarded Openings view */}
        {activeView === "forwarded" && (
          <DataTable<ForwardedOpeningItem>
            columns={[
              {
                key: "job_title",
                header: "Job Title",
                width: "18%",
                skeletonWidth: 120,
                render: (f) => <>{f.job_title}</>,
              },
              {
                key: "company_name",
                header: "From Company",
                width: "14%",
                skeletonWidth: 100,
                render: (f) => <>{f.company_name}</>,
              },
              {
                key: "job_type",
                header: "Type",
                width: "10%",
                skeletonWidth: 70,
                render: (f) => (
                  <>
                    {f.job_type}
                    {f.job_sub_type ? ` › ${f.job_sub_type}` : ""}
                  </>
                ),
              },
              {
                key: "job_location",
                header: "Location",
                width: "10%",
                skeletonWidth: 70,
                render: (f) => <>{f.job_location || "—"}</>,
              },
              {
                key: "skills_required",
                header: "Skills",
                width: "16%",
                skeletonWidth: 120,
                render: (f) => (
                  <>
                    {(f.skills_required || []).slice(0, 3).join(", ")}
                    {(f.skills_required || []).length > 3
                      ? ` +${f.skills_required.length - 3}`
                      : ""}
                  </>
                ),
              },
              {
                key: "comp",
                header: "Comp",
                width: "8%",
                skeletonWidth: 60,
                render: (f) => (
                  <>
                    {(() => {
                      if (f.pay_per_hour) return `$${f.pay_per_hour}/hr`;
                      if (f.salary_min || f.salary_max)
                        return `$${(f.salary_min || 0) / 1000}k–$${
                          (f.salary_max || 0) / 1000
                        }k`;
                      return "—";
                    })()}
                  </>
                ),
              },
              {
                key: "note",
                header: "Note",
                width: "10%",
                skeletonWidth: 80,
                render: (f) => (
                  <span style={{ fontSize: 10 }}>{f.note || "—"}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                width: "7%",
                skeletonWidth: 50,
                render: (f) => (
                  <span className="matchdb-type-pill">{f.status}</span>
                ),
              },
              {
                key: "created_at",
                header: "Sent",
                width: "7%",
                skeletonWidth: 60,
                render: (f) => (
                  <>
                    {new Date(f.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </>
                ),
              },
            ]}
            data={forwardedOpenings}
            keyExtractor={(f) => f.id}
            loading={false}
            paginate
            titleIcon="📤"
            title="Forwarded Openings from Your Marketing Company"
            emptyMessage="No openings have been forwarded to you yet."
          />
        )}

        {/* My Dashboard view — 4 tabs */}
        {activeView === "my-detail" && (
          <div
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {renderMyDashboard()}
          </div>
        )}

        {/* Vendor Forwarded Openings */}
        {activeView === "vendor-openings" && renderVendorOpenings()}

        {/* Employer Forwarded Openings */}
        {activeView === "employer-openings" && renderEmployerOpenings()}

        {/* Employer Finance (read-only) */}
        {activeView === "employer-finance" && renderEmployerFinance()}

        {/* Employer Immigration (read-only) */}
        {activeView === "employer-immigration" && renderEmployerImmigration()}

        {/* Matched Jobs view */}
        {activeView === "matches" && (
          <DataTable<MatchRow>
            columns={matchColumns}
            data={sortedRows}
            keyExtractor={(r) => r.id}
            loading={matchesLoading}
            paginate
            emptyMessage="MySQL returned an empty result set (i.e. zero rows)."
            alertSuccess={pokeSent ? "Poke sent successfully!" : undefined}
            alertErrors={[pokeError ? "Failed to send poke." : null, error]}
            title="Related Job Openings"
            titleIcon="📌"
            titleExtra={
              <div className="matchdb-title-toolbar">
                <Input
                  id="candidate-search"
                  className="matchdb-title-search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search..."
                />
                <Select
                  id="candidate-type"
                  className="matchdb-title-select"
                  value={filterType}
                  onChange={(e) =>
                    navParams({ type: e.target.value || null, sub: null })
                  }
                >
                  <option value="">All Types</option>
                  {JOB_TYPES.filter((t) => showType(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                {(filterType === "contract" || filterType === "full_time") && (
                  <Select
                    id="candidate-subtype"
                    className="matchdb-title-select"
                    value={filterSubType}
                    onChange={(e) => navParams({ sub: e.target.value || null })}
                  >
                    <option value="">All Sub</option>
                    {(filterType === "contract"
                      ? CONTRACT_SUB_TYPES
                      : FULL_TIME_SUB_TYPES
                    )
                      .filter((st) => showSubtype(filterType, st.value))
                      .map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                  </Select>
                )}
                <Select
                  id="candidate-workmode"
                  className="matchdb-title-select"
                  value={filterWorkMode}
                  onChange={(e) => navParams({ mode: e.target.value || null })}
                >
                  <option value="">All Modes</option>
                  {WORK_MODES.map((wm) => (
                    <option key={wm.value} value={wm.value}>
                      {wm.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="xs"
                  onClick={() => {
                    setSearchText("");
                    navParams({ type: null, sub: null, mode: null, q: null });
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    setSearchParams(
                      (prev) => {
                        const n = new URLSearchParams(prev);
                        n.delete("page");
                        return n;
                      },
                      { replace: true },
                    );
                    setMatchFilters(buildFilterArgs(1, currentPageSize));
                  }}
                >
                  ↻
                </Button>
              </div>
            }
            serverTotal={candidateMatchesTotal}
            serverPage={currentPage}
            serverPageSize={currentPageSize}
            onPageChange={handlePageChange}
            onDownload={handleDownloadCSV}
            downloadLabel="Download CSV"
            pageResetKey={`${sortKey ?? ""}-${sortDir}`}
            onRowDoubleClick={(row) => setSelectedJob(row.rawData || null)}
          />
        )}
      </>
    );
  }

  function renderLockedContent() {
    return (
      <div
        className="matchdb-panel"
        style={{
          textAlign: "center",
          padding: "64px 32px",
          maxWidth: 520,
          margin: "40px auto",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>
          Purchase a Visibility Package to See Job Matches
        </h2>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 13,
            color: "#555",
            lineHeight: 1.6,
          }}
        >
          Job openings matched to your profile are hidden until you purchase a
          Visibility Package. Once purchased, your profile becomes discoverable
          by recruiters and you&apos;ll see your personalized matches here.
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "#888" }}>
          Packages start at <strong>$13</strong> — one-time payment, no
          subscription required.
        </p>
        <Button
          variant="primary"
          style={{ fontSize: 14, padding: "10px 28px" }}
          onClick={openPricingModal}
        >
          View Visibility Packages →
        </Button>
      </div>
    );
  }

  function renderProfileDialog() {
    if (!profileOpen) return null;
    return (
      <dialog open className="rm-overlay">
        {!profileRequired && (
          <div
            className="rm-backdrop"
            role="none"
            onClick={() => setProfileOpen(false)}
          />
        )}
        <div
          className="rm-window"
          style={{
            width: 860,
            maxHeight: "92vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="rm-titlebar">
            <span className="rm-titlebar-icon">👤</span>
            <span className="rm-titlebar-title">
              My Profile — Candidate Resume
            </span>
            {profileRequired ? (
              <span
                style={{
                  fontSize: 10,
                  color: "#ffcc00",
                  marginLeft: "auto",
                  marginRight: 8,
                }}
              >
                Complete &amp; save to continue
              </span>
            ) : (
              <Button
                variant="close"
                onClick={() => setProfileOpen(false)}
                title="Close"
                size="xs"
              >
                ✕
              </Button>
            )}
          </div>
          <div className="rm-statusbar">
            {profileRequired
              ? "Please complete your profile below and click Save — you'll then see your matched job openings."
              : "Complete your profile to improve job match accuracy. The more detail you provide, the better your matches."}
          </div>
          <CandidateProfile
            userEmail={userEmail}
            premiumUnlocked={premiumUnlocked}
            onRequestPremiumUnlock={onRequestPremiumUnlock}
            onSaved={
              profileRequired
                ? () => {
                    setProfileOpen(false);
                    setProfileRequired(false);
                  }
                : undefined
            }
          />
        </div>
      </dialog>
    );
  }

  return (
    <DBLayout
      userType="candidate"
      navGroups={navGroups}
      breadcrumb={breadcrumb}
    >
      <div className="matchdb-page" style={blurStyle}>
        {hasPurchasedVisibility
          ? renderUnlockedContent()
          : renderLockedContent()}
      </div>

      {renderProfileDialog()}

      {/* Mail Template modal */}
      <PokeEmailModal
        open={pokeEmailRow !== null}
        row={pokeEmailRow}
        isVendor={false}
        senderName={profile?.name || userEmail || "Candidate"}
        senderEmail={userEmail || ""}
        senderProfile={profile}
        onSend={handlePokeEmailSend}
        onClose={() => {
          setPokeEmailRow(null);
          setPokeEmailSentSuccess(false);
        }}
        sending={pokeLoading}
        sentSuccess={pokeEmailSentSuccess}
      />

      <DetailModal
        open={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
        type="job"
        data={selectedJob}
        matchPercentage={selectedJob?.match_percentage as number | undefined}
      />
    </DBLayout>
  );
};

export default CandidateDashboard;
