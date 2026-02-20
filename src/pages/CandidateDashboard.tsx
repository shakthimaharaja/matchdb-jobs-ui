import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Tooltip } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useAppDispatch, useAppSelector } from "../store";
import MatchDataTable, { MatchRow } from "../components/MatchDataTable";
import DBLayout, { NavGroup } from "../components/DBLayout";
import DetailModal from "../components/DetailModal";
import CandidateProfile from "./CandidateProfile";
import {
  clearPokeState,
  fetchCandidateMatches,
  fetchProfile,
  sendPoke,
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
    loading,
    error,
    pokeLoading,
    pokeSuccessMessage,
    pokeError,
    profile,
    profileLoading,
  } = useAppSelector((state) => state.jobs);

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSubType, setFilterSubType] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("");
  const [pokeCount, setPokeCount] = useState(0);
  const [selectedJob, setSelectedJob] = useState<Record<string, any> | null>(
    null,
  );
  const [urlCopied, setUrlCopied] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [pricingBlur, setPricingBlur] = useState(false);

  const openPricingModal = () => {
    setPricingBlur(true);
    window.dispatchEvent(
      new CustomEvent("matchdb:openPricing", { detail: { tab: "candidate" } }),
    );
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    window.addEventListener("matchdb:pricingClosed", onClose);
    return () => window.removeEventListener("matchdb:pricingClosed", onClose);
  }, []);

  // Shell fires this after candidate payment completes + pricing modal closes (required flow)
  useEffect(() => {
    const onOpenProfile = () => {
      setProfileRequired(true);
      setProfileOpen(true);
    };
    window.addEventListener("matchdb:openProfile", onOpenProfile);
    return () =>
      window.removeEventListener("matchdb:openProfile", onOpenProfile);
  }, []);

  const pokeLimit = POKE_LIMIT[plan] ?? 5;
  const profileChecked = useRef(false);

  useEffect(() => {
    dispatch(fetchCandidateMatches(token));
    dispatch(fetchProfile(token));
  }, [dispatch, token]);

  // Auto-open profile modal for paid candidates who haven't created a profile yet.
  // Unpaid candidates are handled by the pricing → matchdb:openProfile event flow.
  useEffect(() => {
    if (profileChecked.current) return;
    if (profileLoading) return;
    profileChecked.current = true;
    // Only auto-open for candidates who have already paid — otherwise the post-payment
    // event chain (ShellLayout → matchdb:openProfile) handles this as a required modal.
    if (hasPurchasedVisibility && profile === null) {
      setProfileOpen(true);
    }
  }, [profileLoading, profile]);

  // membership helpers — null/empty config means unrestricted
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
        // membership gate
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
    if (pokeCount >= pokeLimit) return;
    dispatch(clearPokeState());
    dispatch(
      sendPoke({
        token,
        to_email: row.pokeTargetEmail,
        to_name: row.pokeTargetName,
        subject_context: row.pokeSubjectContext,
      }),
    );
    setPokeCount((c) => c + 1);
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

  // Count per type for sidebar
  const countByType = useMemo(() => {
    const map: Record<string, number> = {};
    candidateMatches.forEach((j) => {
      const t = j.job_type || "other";
      map[t] = (map[t] || 0) + 1;
    });
    return map;
  }, [candidateMatches]);

  // Count per sub-type for sidebar
  const countBySubType = useMemo(() => {
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
  }, [candidateMatches]);

  // Build Job Type nav items filtered by candidate's membership
  const jobTypeNavItems = useMemo(() => {
    const items: NavGroup["items"] = [
      {
        id: "",
        label: "All Types",
        count: candidateMatches.length,
        active: filterType === "" && filterSubType === "",
        onClick: () => {
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
        active: filterType === "contract" && filterSubType === "",
        onClick: () => {
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
          active: filterType === "contract" && filterSubType === st.value,
          onClick: () => {
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
        active: filterType === "full_time" && filterSubType === "",
        onClick: () => {
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
          active: filterType === "full_time" && filterSubType === st.value,
          onClick: () => {
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
        active: filterType === "part_time" && filterSubType === "",
        onClick: () => {
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
          id: "matches",
          label: "Matched Jobs",
          count: candidateMatches.length,
          active: !profileOpen,
          onClick: () => setProfileOpen(false),
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
          onClick: () => dispatch(fetchCandidateMatches(token)),
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
      ],
    },
    {
      label: "Job Type",
      icon: "",
      items: jobTypeNavItems,
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

  return (
    <DBLayout
      userType="candidate"
      navGroups={navGroups}
      breadcrumb={["Candidate Portal", "Matched Jobs", filterLabel]}
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
          /* ── LOCKED STATE — no visibility package purchased yet ── */
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
          /* ── UNLOCKED STATE — visibility purchased, show matches ── */
          <>
            {/* Visibility coverage info */}
            {membershipConfig && (
              <Alert
                severity="success"
                icon={<VisibilityIcon fontSize="small" />}
                action={
                  <Button
                    color="success"
                    size="small"
                    variant="outlined"
                    onClick={openPricingModal}
                    sx={{ fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}
                  >
                    Add More
                  </Button>
                }
                sx={{ mb: 1.5, py: 0.5, fontSize: 13, alignItems: "center" }}
              >
                Visible in:{" "}
                {Object.entries(membershipConfig)
                  .map(([domain, subs]) =>
                    subs.length > 0
                      ? `${domain} (${subs.map((s) => s.toUpperCase()).join(", ")})`
                      : domain,
                  )
                  .join(" · ")}
                {" — "}expand your reach by adding more subdomains.
              </Alert>
            )}

            {/* Shareable profile URL */}
            {username && profile && (
              <div
                className="matchdb-panel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  🔗 Your Profile URL:
                </span>
                <code
                  style={{
                    flex: 1,
                    background: "#fff",
                    border: "1px solid #a0a0a0",
                    padding: "3px 6px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {`${window.location.origin}/resume/${username}`}
                </code>
                <button
                  type="button"
                  className="matchdb-btn"
                  style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/resume/${username}`,
                    );
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                >
                  {urlCopied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            )}

            {/* Plan badge + poke counter */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Tooltip title={`Your current plan: ${plan}`}>
                <Chip
                  label={plan === "pro_plus" ? "PRO PLUS" : plan.toUpperCase()}
                  size="small"
                  icon={<StarIcon style={{ fontSize: 13 }} />}
                  color={
                    plan === "pro_plus"
                      ? "success"
                      : plan === "pro"
                        ? "primary"
                        : plan === "basic"
                          ? "info"
                          : plan === "enterprise"
                            ? "success"
                            : "default"
                  }
                  variant="outlined"
                  style={{ fontWeight: 700, fontSize: 11 }}
                />
              </Tooltip>
              {isFinite(pokeLimit) && (
                <Chip
                  label={`Pokes: ${pokeCount}/${pokeLimit}`}
                  size="small"
                  color={pokeCount >= pokeLimit ? "error" : "default"}
                  variant="outlined"
                  style={{ fontSize: 11 }}
                />
              )}
            </Box>

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
                {(filterType === "contract" || filterType === "full_time") && (
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
                <label className="matchdb-label" htmlFor="candidate-workmode">
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
                  onClick={() => dispatch(fetchCandidateMatches(token))}
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
              pokeLoading={pokeLoading}
              pokeSuccessMessage={pokeSuccessMessage}
              pokeError={pokeError}
              onPoke={handlePoke}
              onRowClick={(row) => setSelectedJob(row.rawData || null)}
              onDownload={handleDownloadCSV}
              downloadLabel="Download CSV"
            />
          </>
        )}
      </div>

      {/* Profile edit modal — rm-overlay blurs the table behind it */}
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
