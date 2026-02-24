import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import MatchDataTable, { MatchRow } from "../components/MatchDataTable";
import DBLayout, { NavGroup } from "../components/DBLayout";
import DetailModal from "../components/DetailModal";
import PokeEmailModal from "../components/PokeEmailModal";
import CandidateProfile from "./CandidateProfile";
import {
  clearPokeState,
  fetchCandidateMatches,
  fetchPokesSent,
  fetchPokesReceived,
  fetchProfile,
  sendPoke,
  PokeRecord,
} from "../store/jobsSlice";

interface Props {
  token: string | null;
  userId: string | undefined;
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
  | "mails-received";

const formatRate = (value?: number | null) =>
  value ? `$${Number(value).toFixed(0)}` : "-";
const formatExperience = (value?: number | null) => `${Number(value || 0)} yrs`;
const companyFromEmail = (email?: string) => {
  if (!email) return "-";
  const domain = email.split("@")[1] || "";
  return domain
    ? domain
        .split(".")[0]
        .replace(/[^a-zA-Z0-9]/g, " ")
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
  US: '🇺🇸', IN: '🇮🇳', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
  DE: '🇩🇪', SG: '🇸🇬', AE: '🇦🇪', JP: '🇯🇵', NL: '🇳🇱',
  FR: '🇫🇷', BR: '🇧🇷', MX: '🇲🇽', PH: '🇵🇭', IL: '🇮🇱',
  IE: '🇮🇪', PL: '🇵🇱', SE: '🇸🇪', CH: '🇨🇭', KR: '🇰🇷',
};

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', IN: 'India', GB: 'United Kingdom', CA: 'Canada',
  AU: 'Australia', DE: 'Germany', SG: 'Singapore', AE: 'UAE',
  JP: 'Japan', NL: 'Netherlands', FR: 'France', BR: 'Brazil',
  MX: 'Mexico', PH: 'Philippines', IL: 'Israel', IE: 'Ireland',
  PL: 'Poland', SE: 'Sweden', CH: 'Switzerland', KR: 'South Korea',
};

/* ── Inline activity table (pokes or mails, sent or received) ── */
const SECTION_META: Record<
  "pokes-sent" | "pokes-received" | "mails-sent" | "mails-received",
  { icon: string; title: string; toCol: string; emptyMsg: string }
> = {
  "pokes-sent": {
    icon: "⚡",
    title: "Pokes Sent",
    toCol: "To (Recruiter)",
    emptyMsg: "No pokes sent yet.",
  },
  "pokes-received": {
    icon: "⚡",
    title: "Pokes Received",
    toCol: "From (Vendor)",
    emptyMsg: "No pokes received yet.",
  },
  "mails-sent": {
    icon: "✉",
    title: "Mails Sent",
    toCol: "To (Recruiter)",
    emptyMsg: "No mails sent yet.",
  },
  "mails-received": {
    icon: "✉",
    title: "Mails Received",
    toCol: "From (Vendor)",
    emptyMsg: "No mails received yet.",
  },
};

const PokesTable: React.FC<{
  pokes: PokeRecord[];
  loading: boolean;
  section: "pokes-sent" | "pokes-received" | "mails-sent" | "mails-received";
}> = ({ pokes, loading, section }) => {
  const isSent = section === "pokes-sent" || section === "mails-sent";
  const meta = SECTION_META[section];
  return (
    <div className="matchdb-panel">
      <div className="matchdb-panel-title">
        <span className="matchdb-panel-title-icon">{meta.icon}</span>
        <span className="matchdb-panel-title-text">{meta.title}</span>
        <span className="matchdb-panel-title-meta">
          {loading
            ? "Loading..."
            : `${pokes.length} record${pokes.length !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="matchdb-table-wrap">
        <table className="matchdb-table">
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "16%" }} />
            <col />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>{meta.toCol}</th>
              <th>Email</th>
              <th>Type</th>
              <th>Job Title</th>
              <th>Subject / Context</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, ri) => (
                <tr key={`sk-${ri}`} className="matchdb-skeleton-row" aria-hidden="true">
                  {[20, 80, 110, 50, 90, 130, 60].map((w, ci) => (
                    <td key={ci}><span className="w97-shimmer" style={{ width: w }} /></td>
                  ))}
                </tr>
              ))}
            {!loading && pokes.length === 0 && (
              <tr>
                <td colSpan={7} className="matchdb-empty">
                  {meta.emptyMsg}
                </td>
              </tr>
            )}
            {!loading &&
              pokes.map((p, i) => {
                const personName = isSent ? p.target_name : p.sender_name;
                const personEmail = isSent ? p.target_email : p.sender_email;
                const personType = isSent
                  ? "Recruiter"
                  : p.sender_type || "Vendor";
                return (
                  <tr key={p.id}>
                    <td
                      style={{
                        textAlign: "center",
                        color: "#808080",
                        fontSize: 10,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td title={personName}>{personName}</td>
                    <td>
                      <a
                        href={`mailto:${personEmail}`}
                        style={{ color: "#2a5fa0", textDecoration: "none" }}
                      >
                        {personEmail}
                      </a>
                    </td>
                    <td>
                      <span
                        className="matchdb-type-pill"
                        style={{ textTransform: "capitalize" }}
                      >
                        {personType}
                      </span>
                    </td>
                    <td title={p.job_title || "—"}>{p.job_title || "—"}</td>
                    <td title={p.subject}>{p.subject}</td>
                    <td style={{ fontSize: 11 }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="matchdb-footnote">
        <span>
          Showing {pokes.length} record{pokes.length !== 1 ? "s" : ""}
        </span>
        <span className="matchdb-footnote-sep">|</span>
        <span>InnoDB</span>
      </div>
    </div>
  );
};

const CandidateDashboard: React.FC<Props> = ({
  token,
  userEmail,
  username,
  plan = "free",
  membershipConfig,
  hasPurchasedVisibility = false,
}) => {
  const dispatch = useAppDispatch();
  const {
    candidateMatches,
    candidateMatchesTotal,
    candidateMatchesTypeCounts,
    candidateMatchesSubTypeCounts,
    loading,
    error,
    pokeLoading,
    pokeSuccessMessage,
    pokeError,
    profile,
    profileLoading,
    pokesSent,
    pokesReceived,
    pokesLoading,
  } = useAppSelector((state) => state.jobs);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(25);

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSubType, setFilterSubType] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("matches");
  const [selectedJob, setSelectedJob] = useState<Record<string, any> | null>(
    null,
  );
  const [urlCopied, setUrlCopied] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [pricingBlur, setPricingBlur] = useState(false);

  // Mail Template modal state
  const [pokeEmailRow, setPokeEmailRow] = useState<MatchRow | null>(null);
  const [pokeEmailSentSuccess, setPokeEmailSentSuccess] = useState(false);

  // Premium profile editing unlock ($3 payment gate)
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const isProfileLocked = !!profile?.profile_locked;

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

  // target_id → poke created_at (for 24h mail cooldown in MatchDataTable)
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
  const pokesReceivedOnly = useMemo(
    () => pokesReceived.filter((p) => !p.is_email),
    [pokesReceived],
  );
  const mailsReceivedOnly = useMemo(
    () => pokesReceived.filter((p) => p.is_email),
    [pokesReceived],
  );

  const profileUrl =
    username && profile ? `${window.location.origin}/resume/${username}` : null;

  const openPricingModal = () => {
    setPricingBlur(true);
    window.dispatchEvent(
      new CustomEvent("matchdb:openPricing", { detail: { tab: "candidate" } }),
    );
  };

  const onRequestPremiumUnlock = () => {
    // Trigger $3 profile-update payment via pricing modal
    setPricingBlur(true);
    window.dispatchEvent(
      new CustomEvent("matchdb:openPricing", {
        detail: { tab: "candidate", package: "profile-update" },
      }),
    );
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    window.addEventListener("matchdb:pricingClosed", onClose);
    return () => window.removeEventListener("matchdb:pricingClosed", onClose);
  }, []);

  // Listen for successful $3 profile-unlock payment
  useEffect(() => {
    const onUnlock = () => setPremiumUnlocked(true);
    window.addEventListener("matchdb:profileUnlocked", onUnlock);
    return () =>
      window.removeEventListener("matchdb:profileUnlocked", onUnlock);
  }, []);

  useEffect(() => {
    const onOpenProfile = () => {
      setProfileRequired(true);
      setProfileOpen(true);
    };
    window.addEventListener("matchdb:openProfile", onOpenProfile);
    return () =>
      window.removeEventListener("matchdb:openProfile", onOpenProfile);
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

  useEffect(() => {
    dispatch(
      fetchCandidateMatches({
        token,
        page: currentPage,
        limit: currentPageSize,
        types: membershipTypes,
      }),
    );
    dispatch(fetchProfile(token));
    dispatch(fetchPokesSent(token));
    dispatch(fetchPokesReceived(token));
  }, [dispatch, token]);

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
      window.dispatchEvent(
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
    const country = profile?.profile_country;
    if (country) {
      const flag = COUNTRY_FLAGS[country] || '';
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
      const text = `Visible in: ${parts.join(" — ")} — expand your reach by adding more subdomains.`;
      window.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text } }),
      );
    }
    return () => {
      // Clear on unmount
      window.dispatchEvent(
        new CustomEvent("matchdb:visibleIn", { detail: { text: "" } }),
      );
    };
  }, [membershipConfig, profile?.profile_country]);

  const handlePageChange = (page: number, pageSize: number) => {
    setCurrentPage(page);
    setCurrentPageSize(pageSize);
    dispatch(
      fetchCandidateMatches({
        token,
        page,
        limit: pageSize,
        types: membershipTypes,
      }),
    );
  };

  const hasMembership =
    !!membershipConfig && Object.keys(membershipConfig).length > 0;
  const showType = (type: string) =>
    !hasMembership || type in membershipConfig!;
  const showSubtype = (type: string, sub: string) => {
    if (!hasMembership) return true;
    const subs = membershipConfig![type];
    return subs !== undefined && (subs.length === 0 || subs.includes(sub));
  };

  useEffect(() => {
    return () => {
      dispatch(clearPokeState());
    };
  }, [dispatch]);

  const rows = useMemo<MatchRow[]>(() => {
    return candidateMatches
      .filter((job) => {
        if (hasMembership) {
          const type = job.job_type || "";
          if (!showType(type)) return false;
          const sub = job.job_sub_type || "";
          if (sub && !showSubtype(type, sub)) return false;
        }
        const typePass = filterType ? job.job_type === filterType : true;
        const subTypePass = filterSubType
          ? (job.job_sub_type || "") === filterSubType
          : true;
        const workModePass = filterWorkMode
          ? (job.work_mode || "") === filterWorkMode
          : true;
        const q = searchText.trim().toLowerCase();
        const textPass =
          !q ||
          job.title?.toLowerCase().includes(q) ||
          job.location?.toLowerCase().includes(q) ||
          job.vendor_email?.toLowerCase().includes(q);
        return typePass && subTypePass && workModePass && textPass;
      })
      .map((job) => ({
        id: job.id,
        name: job.recruiter_name || "Recruiter",
        company: companyFromEmail(job.vendor_email),
        email: job.vendor_email || "-",
        phone: job.recruiter_phone || "-",
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
        rawData: job as Record<string, any>,
      }));
  }, [candidateMatches, filterType, filterSubType, filterWorkMode, searchText]);

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail) return;
    if (isFinite(pokeLimit) && pokeCount >= pokeLimit) return;
    dispatch(clearPokeState());
    dispatch(
      sendPoke({
        token,
        to_email: row.pokeTargetEmail,
        to_name: row.pokeTargetName,
        subject_context: row.pokeSubjectContext,
        target_id: row.id,
        target_vendor_id: row.rawData?.vendor_id,
        is_email: false,
        sender_name: profile?.name || userEmail || "Candidate",
        sender_email: userEmail || "",
        job_id: row.id,
        job_title: row.role,
      }),
    ).then((result) => {
      if (sendPoke.fulfilled.match(result)) {
        dispatch(fetchPokesSent(token));
      }
    });
  };

  const handlePokeEmail = (row: MatchRow) => {
    dispatch(clearPokeState());
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
    const result = await dispatch(
      sendPoke({
        token,
        to_email: params.to_email,
        to_name: params.to_name,
        subject_context: params.subject_context,
        email_body: params.email_body,
        target_id: pokeEmailRow.id,
        target_vendor_id: pokeEmailRow.rawData?.vendor_id,
        is_email: true,
        sender_name: profile?.name || userEmail || "Candidate",
        sender_email: userEmail || "",
        pdf_attachment: params.pdf_data,
        job_id: pokeEmailRow.id,
        job_title: pokeEmailRow.role,
      }),
    );
    if (sendPoke.fulfilled.match(result)) {
      setPokeEmailSentSuccess(true);
      dispatch(fetchPokesSent(token));
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
        r.phone,
        r.role,
        r.type,
        r.workMode || "-",
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

  const jobTypeNavItems = useMemo(() => {
    const items: NavGroup["items"] = [
      {
        id: "matched-jobs",
        label: "Matched Jobs",
        count: candidateMatchesTotal,
        active:
          activeView === "matches" && filterType === "" && filterSubType === "",
        onClick: () => {
          setActiveView("matches");
          setFilterType("");
          setFilterSubType("");
        },
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
        onClick: () => {
          setActiveView("matches");
          setFilterType("contract");
          setFilterSubType("");
        },
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
          onClick: () => {
            setActiveView("matches");
            setFilterType("contract");
            setFilterSubType(st.value);
          },
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
        onClick: () => {
          setActiveView("matches");
          setFilterType("full_time");
          setFilterSubType("");
        },
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
          onClick: () => {
            setActiveView("matches");
            setFilterType("full_time");
            setFilterSubType(st.value);
          },
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
        onClick: () => {
          setActiveView("matches");
          setFilterType("part_time");
          setFilterSubType("");
        },
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    membershipConfig,
    candidateMatches.length,
    countByType,
    countBySubType,
    filterType,
    filterSubType,
    activeView,
  ]);

  const navGroups: NavGroup[] = [
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
          tooltip:
            isProfileLocked && !premiumUnlocked
              ? "Edit company, experience & bio — costs $3, pay at billing"
              : isProfileLocked
                ? "Premium fields unlocked — all editable"
                : "Edit your profile details",
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
      label: `Pokes (${pokeCount}/${isFinite(pokeLimit) ? pokeLimit : "∞"})`,
      icon: "",
      items: [
        {
          id: "pokes-sent",
          label: "Pokes Sent",
          count: pokesSentOnly.length,
          active: activeView === "pokes-sent",
          onClick: () => setActiveView("pokes-sent"),
        },
        {
          id: "pokes-received",
          label: "Pokes Received",
          count: pokesReceivedOnly.length,
          active: activeView === "pokes-received",
          onClick: () => setActiveView("pokes-received"),
        },
        ...(isFinite(pokeLimit) ? [{
          id: "pokes-remaining",
          label: "Remaining",
          count: Math.max(0, pokeLimit - pokeCount),
        }] : []),
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
          onClick: () => setActiveView("mails-sent"),
        },
        {
          id: "mails-received",
          label: "Mails Received",
          count: mailsReceivedOnly.length,
          active: activeView === "mails-received",
          onClick: () => setActiveView("mails-received"),
        },
        ...(hasPurchasedVisibility && rows.length > 0
          ? [
              {
                id: "mail-template",
                label: "✉ Mail Template",
                tooltip:
                  "Compose a personalised email with your resume — click ✉ next to any row",
                onClick: () => {
                  setActiveView("matches");
                  if (rows.length > 0) handlePokeEmail(rows[0]);
                },
              },
            ]
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
            setCurrentPage(1);
            dispatch(
              fetchCandidateMatches({ token, page: 1, limit: currentPageSize }),
            );
            dispatch(fetchPokesSent(token));
            dispatch(fetchPokesReceived(token));
          },
        },
        {
          id: "reset",
          label: "Reset Filters",
          onClick: () => {
            setSearchText("");
            setFilterType("");
            setFilterSubType("");
            setFilterWorkMode("");
          },
        },
        ...(profileUrl
          ? [
              {
                id: "profile-url",
                label: urlCopied ? "✓ Copied!" : "🔗 Copy Profile URL",
                tooltip: `Click to copy: ${profileUrl}`,
                onClick: () => {
                  navigator.clipboard.writeText(profileUrl!);
                  setUrlCopied(true);
                  setTimeout(() => setUrlCopied(false), 2500);
                },
              },
            ]
          : []),
      ],
    },
  ];

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

  const breadcrumb: [string, string, string] =
    activeView === "pokes-sent"
      ? ["Candidate Portal", "Pokes", "Pokes Sent"]
      : activeView === "pokes-received"
        ? ["Candidate Portal", "Pokes", "Pokes Received"]
        : activeView === "mails-sent"
          ? ["Candidate Portal", "Mails", "Mails Sent"]
          : activeView === "mails-received"
            ? ["Candidate Portal", "Mails", "Mails Received"]
            : ["Candidate Portal", "Matched Jobs", filterLabel];

  return (
    <DBLayout
      userType="candidate"
      navGroups={navGroups}
      breadcrumb={breadcrumb}
    >
      {/* Main content — blurred when profile modal or pricing modal is open */}
      <div
        className="matchdb-page"
        style={
          profileOpen || pricingBlur
            ? { filter: "blur(2px)", pointerEvents: "none", userSelect: "none" }
            : undefined
        }
      >
        {!hasPurchasedVisibility ? (
          /* ── LOCKED STATE ── */
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
              Job openings matched to your profile are hidden until you purchase
              a Visibility Package. Once purchased, your profile becomes
              discoverable by recruiters and you'll see your personalized
              matches here.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 12, color: "#888" }}>
              Packages start at <strong>$13</strong> — one-time payment, no
              subscription required.
            </p>
            <button
              type="button"
              className="matchdb-btn matchdb-btn-primary"
              style={{ fontSize: 14, padding: "10px 28px" }}
              onClick={openPricingModal}
            >
              View Visibility Packages →
            </button>
          </div>
        ) : (
          /* ── UNLOCKED STATE ── */
          <>

            {/* Error banner */}
            {error && (
              <div className="w97-alert w97-alert-error" role="alert" aria-live="assertive">
                ⚠ Failed to load matches: {error}
                <button
                  aria-label="Retry loading matches"
                  onClick={() => dispatch(fetchCandidateMatches({ token, page: currentPage, limit: currentPageSize }))}
                >
                  ↺ Retry
                </button>
              </div>
            )}

            {/* Pokes Sent view */}
            {activeView === "pokes-sent" && (
              <PokesTable
                pokes={pokesSentOnly}
                loading={pokesLoading}
                section="pokes-sent"
              />
            )}

            {/* Pokes Received view */}
            {activeView === "pokes-received" && (
              <PokesTable
                pokes={pokesReceivedOnly}
                loading={pokesLoading}
                section="pokes-received"
              />
            )}

            {/* Mails Sent view */}
            {activeView === "mails-sent" && (
              <PokesTable
                pokes={mailsSentOnly}
                loading={pokesLoading}
                section="mails-sent"
              />
            )}

            {/* Mails Received view */}
            {activeView === "mails-received" && (
              <PokesTable
                pokes={mailsReceivedOnly}
                loading={pokesLoading}
                section="mails-received"
              />
            )}

            {/* Matched Jobs view */}
            {activeView === "matches" && (
              <>
                {/* Toolbar */}
                <div className="matchdb-toolbar">
                  <div className="matchdb-toolbar-left">
                    <label className="matchdb-label" htmlFor="candidate-search">
                      Search
                    </label>
                    <input
                      id="candidate-search"
                      className="matchdb-input"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Title, company, location..."
                    />
                    <label className="matchdb-label" htmlFor="candidate-type">
                      Type
                    </label>
                    <select
                      id="candidate-type"
                      className="matchdb-select"
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value);
                        setFilterSubType("");
                      }}
                    >
                      <option value="">All</option>
                      {JOB_TYPES.filter((t) => showType(t.value)).map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {(filterType === "contract" ||
                      filterType === "full_time") && (
                      <>
                        <label
                          className="matchdb-label"
                          htmlFor="candidate-subtype"
                        >
                          Sub
                        </label>
                        <select
                          id="candidate-subtype"
                          className="matchdb-select"
                          value={filterSubType}
                          onChange={(e) => setFilterSubType(e.target.value)}
                        >
                          <option value="">All</option>
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
                        </select>
                      </>
                    )}
                    <label
                      className="matchdb-label"
                      htmlFor="candidate-workmode"
                    >
                      Mode
                    </label>
                    <select
                      id="candidate-workmode"
                      className="matchdb-select"
                      value={filterWorkMode}
                      onChange={(e) => setFilterWorkMode(e.target.value)}
                    >
                      <option value="">All</option>
                      {WORK_MODES.map((wm) => (
                        <option key={wm.value} value={wm.value}>
                          {wm.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="matchdb-btn"
                      onClick={() => {
                        setSearchText("");
                        setFilterType("");
                        setFilterSubType("");
                        setFilterWorkMode("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="matchdb-toolbar-right">
                    <button
                      type="button"
                      className="matchdb-btn matchdb-btn-primary"
                      onClick={() => {
                        setCurrentPage(1);
                        dispatch(
                          fetchCandidateMatches({
                            token,
                            page: 1,
                            limit: currentPageSize,
                          }),
                        );
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                <MatchDataTable
                  title="Related Job Openings"
                  titleIcon="📌"
                  rows={rows}
                  loading={loading}
                  error={error}
                  serverTotal={candidateMatchesTotal}
                  serverPage={currentPage}
                  serverPageSize={currentPageSize}
                  onPageChange={handlePageChange}
                  pokeLoading={pokeLoading}
                  pokeSuccessMessage={pokeSuccessMessage}
                  pokeError={pokeError}
                  isVendor={false}
                  pokedRowIds={pokedRowIds}
                  emailedRowIds={emailedRowIds}
                  pokedAtMap={pokedAtMap}
                  onPoke={handlePoke}
                  onPokeEmail={handlePokeEmail}
                  onRowClick={(row) => setSelectedJob(row.rawData || null)}
                  onDownload={handleDownloadCSV}
                  downloadLabel="Download CSV"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Profile edit modal */}
      {profileOpen && (
        <div
          className="rm-overlay"
          onClick={profileRequired ? undefined : () => setProfileOpen(false)}
          style={profileRequired ? { cursor: "default" } : undefined}
        >
          <div
            className="rm-window"
            style={{
              width: 860,
              maxHeight: "92vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
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
                <button
                  className="rm-close"
                  onClick={() => setProfileOpen(false)}
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="rm-statusbar">
              {profileRequired
                ? "Please complete your profile below and click Save — you'll then see your matched job openings."
                : "Complete your profile to improve job match accuracy. The more detail you provide, the better your matches."}
            </div>
            <CandidateProfile
              token={token}
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
        </div>
      )}

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
        matchPercentage={selectedJob?.match_percentage}
      />
    </DBLayout>
  );
};

export default CandidateDashboard;
