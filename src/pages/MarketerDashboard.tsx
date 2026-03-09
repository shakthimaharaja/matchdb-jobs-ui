import React, { useCallback, useMemo, useState } from "react";
import DBLayout, { NavGroup } from "../components/DBLayout";
import { DataTable } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import DetailModal from "../components/DetailModal";
import { useAutoRefreshFlash } from "../hooks/useAutoRefreshFlash";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import {
  useGetMarketerJobsQuery,
  useGetMarketerProfilesQuery,
  useGetMarketerStatsQuery,
  useGetMyCompanyQuery,
  useRegisterCompanyMutation,
  useGetMarketerCandidatesQuery,
  useAddMarketerCandidateMutation,
  useRemoveMarketerCandidateMutation,
  useForwardOpeningMutation,
  useGetForwardedOpeningsQuery,
  type MarketerJob,
  type MarketerProfile,
  type MarketerCandidateItem,
  type ForwardedOpeningItem,
} from "../api/jobsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
}

type ActiveView =
  | "vendor-posted"
  | "candidate-created"
  | "company-candidates"
  | "forwarded-openings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const fmtRate = (v: number | null) => (v ? `$${Number(v).toFixed(0)}/hr` : "—");
const fmtSalary = (min: number | null, max: number | null) => {
  if (!min && !max) return "—";
  if (min && max)
    return `$${(min / 1000).toFixed(0)}k–$${(max / 1000).toFixed(0)}k`;
  return `$${((min || max)! / 1000).toFixed(0)}k`;
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  internship: "Internship",
};
const SUB_LABELS: Record<string, string> = {
  c2c: "C2C",
  c2h: "C2H",
  w2: "W2",
  "1099": "1099",
  direct_hire: "Direct",
  salary: "Salary",
};

const countColor = (n: number) =>
  n >= 50 ? "#2e7d32" : n >= 25 ? "#b8860b" : n >= 10 ? "#d4600a" : "#bb3333";
const countBg = (n: number) =>
  n >= 50 ? "#e8f5e9" : n >= 25 ? "#fffde6" : n >= 10 ? "#fff3e0" : "#fff5f5";

// ─── CSV / Excel download helpers ─────────────────────────────────────────────

function downloadCSV(rows: Record<string, string>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadExcel(rows: Record<string, string>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const tableRows = rows.map(
    (r) =>
      `<tr>${headers
        .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;")}</td>`)
        .join("")}</tr>`,
  );
  const html = `<html><head><meta charset="UTF-8"></head><body>
    <table><thead><tr>${headers
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr></thead>
    <tbody>${tableRows.join("")}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadResumePDF(p: MarketerProfile) {
  const win = window.open("", "_blank");
  if (!win) return;
  const sections = [
    ["Name", p.name],
    ["Email", p.email],
    ["Phone", p.phone],
    ["Location", p.location],
    ["Current Role", p.current_role],
    ["Company", p.current_company],
    ["Experience", `${p.experience_years} yrs`],
    [
      "Expected Rate",
      p.expected_hourly_rate ? `$${p.expected_hourly_rate}/hr` : "—",
    ],
    ["Skills", (p.skills || []).join(", ")],
    ["Summary", p.resume_summary],
    ["Work Experience", p.resume_experience],
    ["Education", p.resume_education],
    ["Achievements", p.resume_achievements],
    ["Bio", p.bio],
  ].filter(([, v]) => v);

  const tableRows = sections
    .map(
      ([label, value]) => `<tr>
        <td style="font-weight:bold;padding:5px 10px;border:1px solid #ccc;background:#f5f5f5;width:180px;vertical-align:top;">${label}</td>
        <td style="padding:5px 10px;border:1px solid #ccc;white-space:pre-wrap;">${value}</td>
      </tr>`,
    )
    .join("");

  win.document
    .write(`<!DOCTYPE html><html><head><title>Resume — ${p.name}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;}h1{font-size:16px;color:#235a81;border-bottom:2px solid #235a81;padding-bottom:6px;}table{border-collapse:collapse;width:100%;}@media print{button{display:none;}}</style>
</head><body><h1>Resume — ${p.name}</h1><table>${tableRows}</table><br/>
<button onclick="window.print()" style="padding:6px 14px;background:#235a81;color:#fff;border:none;cursor:pointer;font-size:12px;">Print / Save as PDF</button>
</body></html>`);
  win.document.close();
}

// ─── Component ────────────────────────────────────────────────────────────────

const MarketerDashboard: React.FC<Props> = () => {
  const [activeView, setActiveView] = useState<ActiveView>("vendor-posted");
  const [jobSearch, setJobSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string | null>(null);

  // Track new-entry badge counts from WebSocket-driven flash
  const [newJobsBadge, setNewJobsBadge] = useState(0);
  const [newProfilesBadge, setNewProfilesBadge] = useState(0);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<"job" | "candidate">("job");
  const [detailData, setDetailData] = useState<Record<string, any> | null>(
    null,
  );

  // Company candidates form
  const [newCandName, setNewCandName] = useState("");
  const [newCandEmail, setNewCandEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  // ── RTK Query ───────────────────────────────────────────────────────────────

  const { data: statsData } = useGetMarketerStatsQuery();

  const {
    data: jobsData,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useGetMarketerJobsQuery({ search: jobSearch, limit: 100, page: 1 });

  const {
    data: profilesData,
    isLoading: profilesLoading,
    refetch: refetchProfiles,
  } = useGetMarketerProfilesQuery({
    search: profileSearch,
    limit: 100,
    page: 1,
  });

  // Company & candidate hooks
  const { data: myCompany } = useGetMyCompanyQuery();
  const [registerCompany] = useRegisterCompanyMutation();
  const { data: companyCandidates = [] } = useGetMarketerCandidatesQuery();
  const [addCandidate] = useAddMarketerCandidateMutation();
  const [removeCandidate] = useRemoveMarketerCandidateMutation();
  const [forwardOpening, { isLoading: forwardLoading }] =
    useForwardOpeningMutation();
  const { data: forwardedOpenings = [] } = useGetForwardedOpeningsQuery();

  const jobs: MarketerJob[] = jobsData?.data ?? [];
  const profiles: MarketerProfile[] = profilesData?.data ?? [];
  const jobsTotal = jobsData?.total ?? 0;
  const profilesTotal = profilesData?.total ?? 0;

  // ── Auto-refresh flash ──────────────────────────────────────────────────────

  const refreshAll = useCallback(() => {
    refetchJobs();
    refetchProfiles();
  }, [refetchJobs, refetchProfiles]);

  // Live push: fires refreshAll immediately when data-collection uploads new data
  useLiveRefresh({ onRefresh: refreshAll });

  const jobsFlash = useAutoRefreshFlash({
    data: jobs,
    keyExtractor: (j) => j.id,
    refresh: refreshAll,
    intervalMs: 30_000,
  });

  const profilesFlash = useAutoRefreshFlash({
    data: profiles,
    keyExtractor: (p) => p.id,
    refresh: refreshAll,
    enabled: false, // shares interval with jobsFlash
  });

  // Increment badges whenever the flash hook detects new entries
  const prevJobFlashSize = React.useRef(0);
  const prevProfileFlashSize = React.useRef(0);
  React.useEffect(() => {
    const n = jobsFlash.flashIds.size;
    if (
      n > 0 &&
      n !== prevJobFlashSize.current &&
      activeView !== "vendor-posted"
    ) {
      setNewJobsBadge((c) => c + n);
    }
    prevJobFlashSize.current = n;
  }, [jobsFlash.flashIds.size, activeView]);

  React.useEffect(() => {
    const n = profilesFlash.flashIds.size;
    if (
      n > 0 &&
      n !== prevProfileFlashSize.current &&
      activeView !== "candidate-created"
    ) {
      setNewProfilesBadge((c) => c + n);
    }
    prevProfileFlashSize.current = n;
  }, [profilesFlash.flashIds.size, activeView]);

  // ── Nav helpers ─────────────────────────────────────────────────────────────

  const navigateTo = (view: ActiveView) => {
    setActiveView(view);
    setSubFilter(null);
    if (view === "vendor-posted") setNewJobsBadge(0);
    if (view === "candidate-created") setNewProfilesBadge(0);
  };

  // ── Open detail modal ───────────────────────────────────────────────────────

  const openJobDetail = (j: MarketerJob) => {
    setDetailType("job");
    setDetailData(j as unknown as Record<string, any>);
    setDetailOpen(true);
  };

  const openProfileDetail = (p: MarketerProfile) => {
    setDetailType("candidate");
    setDetailData(p as unknown as Record<string, any>);
    setDetailOpen(true);
  };

  // ── Download helpers ────────────────────────────────────────────────────────

  const handleDownloadJobsCSV = () => {
    const rows = jobs.map((j) => ({
      Title: j.title,
      Vendor_Email: j.vendor_email,
      Recruiter: j.recruiter_name,
      Phone: j.recruiter_phone,
      Location: j.location,
      Type: `${TYPE_LABELS[j.job_type] || j.job_type} ${
        j.job_sub_type
          ? `› ${SUB_LABELS[j.job_sub_type] || j.job_sub_type}`
          : ""
      }`.trim(),
      Skills: (j.skills_required || []).join("; "),
      Pay_Per_Hour: j.pay_per_hour ? `$${j.pay_per_hour}` : "",
      Salary_Min: j.salary_min ? `$${j.salary_min}` : "",
      Salary_Max: j.salary_max ? `$${j.salary_max}` : "",
      Experience: String(j.experience_required),
      Applications: String(j.application_count),
      Status: j.is_active ? "Active" : "Closed",
      Posted: fmtDate(j.created_at),
    }));
    downloadCSV(rows, "job_openings.csv");
  };

  const handleDownloadProfilesExcel = () => {
    const rows = profiles.map((p) => ({
      Name: p.name,
      Email: p.email,
      Phone: p.phone,
      Role: p.current_role,
      Company: p.current_company,
      Type: TYPE_LABELS[p.preferred_job_type] || p.preferred_job_type,
      Skills: (p.skills || []).join("; "),
      Experience: `${p.experience_years}y`,
      Rate: p.expected_hourly_rate ? `$${p.expected_hourly_rate}/hr` : "",
      Location: p.location,
      Joined: fmtDate(p.created_at),
    }));
    downloadExcel(rows, "candidate_profiles.xls");
  };

  // ── Filtered data based on sub-nav selection ────────────────────────────────

  const filteredJobs = useMemo(() => {
    if (!subFilter) return jobs;
    if (subFilter === "full_time")
      return jobs.filter((j) => j.job_type === "full_time");
    return jobs.filter((j) => j.job_sub_type === subFilter);
  }, [jobs, subFilter]);

  const filteredProfiles = useMemo(() => {
    if (!subFilter) return profiles;
    if (subFilter === "full_time")
      return profiles.filter((p) => p.preferred_job_type === "full_time");
    if (subFilter === "c2c" || subFilter === "w2" || subFilter === "c2h")
      return profiles.filter((p) => p.preferred_job_type === "contract");
    return profiles;
  }, [profiles, subFilter]);

  // ── Company / candidate / forwarding handlers ───────────────────────────────

  const handleRegisterCompany = async () => {
    if (!companyName.trim()) return;
    try {
      await registerCompany({ name: companyName.trim() }).unwrap();
      setCompanyName("");
    } catch (e: any) {
      alert(e?.data?.error || "Failed to register company");
    }
  };

  const handleAddCandidate = async () => {
    if (!newCandEmail.trim()) return;
    try {
      await addCandidate({
        candidateName: newCandName.trim(),
        candidateEmail: newCandEmail.trim(),
      }).unwrap();
      setNewCandName("");
      setNewCandEmail("");
    } catch (e: any) {
      alert(e?.data?.error || "Failed to add candidate");
    }
  };

  const handleRemoveCandidate = async (id: string) => {
    if (!window.confirm("Remove this candidate from your company roster?"))
      return;
    try {
      await removeCandidate(id).unwrap();
    } catch {
      alert("Failed to remove candidate");
    }
  };

  const handleForwardOpening = async (
    candidateEmail: string,
    jobId: string,
    note: string,
  ) => {
    try {
      await forwardOpening({ candidateEmail, jobId, note }).unwrap();
      alert("Candidate forwarded to vendor successfully!");
      setDetailOpen(false);
    } catch (e: any) {
      alert(e?.data?.error || "Failed to forward candidate");
    }
  };

  // Build forwardable jobs list for the candidate profile modal
  const forwardableJobs = useMemo(
    () =>
      jobs.map((j) => ({
        id: j.id,
        title: j.title,
        vendor_email: j.vendor_email,
      })),
    [jobs],
  );

  // ── DBLayout nav groups ─────────────────────────────────────────────────────

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: "Job Openings",
        icon: "💼",
        items: [
          {
            id: "vendor-posted",
            label:
              newJobsBadge > 0
                ? `Job Openings (+${newJobsBadge} new)`
                : "Job Openings",
            count: jobsTotal,
            active: activeView === "vendor-posted" && !subFilter,
            onClick: () => navigateTo("vendor-posted"),
          },
          {
            id: "sub-jobs-c2c",
            label: "C2C Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "c2c",
            onClick: () => {
              setActiveView("vendor-posted");
              setSubFilter("c2c");
            },
          },
          {
            id: "sub-jobs-w2",
            label: "W2 Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "w2",
            onClick: () => {
              setActiveView("vendor-posted");
              setSubFilter("w2");
            },
          },
          {
            id: "sub-jobs-c2h",
            label: "C2H Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "c2h",
            onClick: () => {
              setActiveView("vendor-posted");
              setSubFilter("c2h");
            },
          },
          {
            id: "sub-jobs-ft",
            label: "Full Time Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "full_time",
            onClick: () => {
              setActiveView("vendor-posted");
              setSubFilter("full_time");
            },
          },
        ],
      },
      {
        label: "Candidate Profiles",
        icon: "👤",
        items: [
          {
            id: "candidate-created",
            label:
              newProfilesBadge > 0
                ? `Candidate Profiles (+${newProfilesBadge} new)`
                : "Candidate Profiles",
            count: profilesTotal,
            active: activeView === "candidate-created" && !subFilter,
            onClick: () => navigateTo("candidate-created"),
          },
          {
            id: "sub-profiles-c2c",
            label: "C2C Profiles",
            depth: 1,
            active: activeView === "candidate-created" && subFilter === "c2c",
            onClick: () => {
              setActiveView("candidate-created");
              setSubFilter("c2c");
            },
          },
          {
            id: "sub-profiles-w2",
            label: "W2 Profiles",
            depth: 1,
            active: activeView === "candidate-created" && subFilter === "w2",
            onClick: () => {
              setActiveView("candidate-created");
              setSubFilter("w2");
            },
          },
          {
            id: "sub-profiles-c2h",
            label: "C2H Profiles",
            depth: 1,
            active: activeView === "candidate-created" && subFilter === "c2h",
            onClick: () => {
              setActiveView("candidate-created");
              setSubFilter("c2h");
            },
          },
          {
            id: "sub-profiles-ft",
            label: "Full Time Profiles",
            depth: 1,
            active:
              activeView === "candidate-created" && subFilter === "full_time",
            onClick: () => {
              setActiveView("candidate-created");
              setSubFilter("full_time");
            },
          },
        ],
      },
      {
        label: "Active Sessions",
        icon: "🟢",
        items: [
          { id: "session-1", label: "Profile 1 — Local" },
          { id: "session-2", label: "Profile 2 — (available)" },
        ],
      },
      {
        label: "Company Candidates",
        icon: "🏢",
        items: [
          {
            id: "company-candidates",
            label: "My Candidates",
            count: companyCandidates.length,
            active: activeView === "company-candidates",
            onClick: () => navigateTo("company-candidates"),
          },
        ],
      },
      {
        label: "Forwarded Openings",
        icon: "📤",
        items: [
          {
            id: "forwarded-openings",
            label: "Sent Openings",
            count: forwardedOpenings.length,
            active: activeView === "forwarded-openings",
            onClick: () => navigateTo("forwarded-openings"),
          },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeView,
      subFilter,
      jobsTotal,
      profilesTotal,
      newJobsBadge,
      newProfilesBadge,
      companyCandidates.length,
      forwardedOpenings.length,
    ],
  );

  const breadcrumb =
    activeView === "vendor-posted"
      ? ["Jobs", "Marketer", "Job Openings"]
      : activeView === "candidate-created"
      ? ["Jobs", "Marketer", "Candidate Profiles"]
      : activeView === "company-candidates"
      ? ["Jobs", "Marketer", "Company Candidates"]
      : ["Jobs", "Marketer", "Forwarded Openings"];

  // ── Jobs table columns ──────────────────────────────────────────────────────

  const jobColumns = useMemo<DataTableColumn<MarketerJob>[]>(
    () => [
      {
        key: "title",
        header: "Title",
        width: "13%",
        skeletonWidth: 110,
        render: (j) => (
          <span
            style={{
              cursor: "pointer",
              color: "#235a81",
              textDecoration: "underline",
            }}
            onClick={() => openJobDetail(j)}
            title="Click to view details"
          >
            {j.title}
          </span>
        ),
        tooltip: (j) => j.title,
      },
      {
        key: "vendor",
        header: "Vendor",
        width: "10%",
        skeletonWidth: 90,
        render: (j) => {
          const company = j.vendor_email
            ? j.vendor_email.split("@")[1]?.split(".")[0] || j.vendor_email
            : j.recruiter_name || "—";
          return <span title={j.vendor_email}>{company}</span>;
        },
        tooltip: (j) => j.vendor_email || j.recruiter_name || "—",
      },
      {
        key: "email",
        header: "Email",
        width: "12%",
        skeletonWidth: 90,
        render: (j) => (
          <span style={{ fontSize: 10 }} title={j.vendor_email}>
            {j.vendor_email || "—"}
          </span>
        ),
        tooltip: (j) => j.vendor_email || "—",
      },
      {
        key: "phone",
        header: "Phone",
        width: "8%",
        skeletonWidth: 65,
        render: (j) => (
          <span style={{ fontSize: 10 }} title={j.recruiter_phone}>
            {j.recruiter_phone || "—"}
          </span>
        ),
      },
      {
        key: "location",
        header: "Location",
        width: "8%",
        skeletonWidth: 70,
        render: (j) => <>{j.location || j.job_country || "—"}</>,
        tooltip: (j) => j.location || "—",
      },
      {
        key: "type",
        header: "Type",
        width: "10%",
        skeletonWidth: 85,
        render: (j) => {
          const t = TYPE_LABELS[j.job_type] || j.job_type || "—";
          const s = j.job_sub_type
            ? ` › ${SUB_LABELS[j.job_sub_type] || j.job_sub_type.toUpperCase()}`
            : "";
          return (
            <span className="matchdb-type-pill">
              {t}
              {s}
            </span>
          );
        },
      },
      {
        key: "skills",
        header: "Skills",
        width: "16%",
        skeletonWidth: 140,
        render: (j) => (
          <div style={{ display: "flex", gap: 2, overflow: "hidden" }}>
            {(j.skills_required || []).slice(0, 3).map((s) => (
              <span key={s} className="matchdb-skill-pill">
                {s}
              </span>
            ))}
            {(j.skills_required || []).length > 3 && (
              <span
                className="matchdb-skill-pill"
                title={(j.skills_required || []).slice(3).join(", ")}
              >
                +{(j.skills_required || []).length - 3}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "comp",
        header: "Comp",
        width: "7%",
        skeletonWidth: 65,
        render: (j) =>
          j.pay_per_hour ? (
            <>{fmtRate(j.pay_per_hour)}</>
          ) : (
            <>{fmtSalary(j.salary_min, j.salary_max)}</>
          ),
      },
      {
        key: "apps",
        header: "Apps",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 35,
        render: (j) => (
          <span
            style={{
              color: countColor(j.application_count),
              background: countBg(j.application_count),
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {j.application_count}
          </span>
        ),
      },
      {
        key: "pokes",
        header: "Pokes",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 30,
        render: (j) => (
          <span
            style={{
              color: countColor(j.poke_count),
              background: countBg(j.poke_count),
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {j.poke_count}
          </span>
        ),
      },
      {
        key: "emails",
        header: "Emails",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 30,
        render: (j) => (
          <span
            style={{
              color: countColor(j.email_count),
              background: countBg(j.email_count),
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {j.email_count}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "6%",
        skeletonWidth: 50,
        render: (j) => (
          <span
            className={`matchdb-type-pill vdp-status${
              j.is_active ? "-active" : "-closed"
            }`}
          >
            {j.is_active ? "● ACTIVE" : "● Closed"}
          </span>
        ),
      },
      {
        key: "date",
        header: "Posted",
        width: "6%",
        skeletonWidth: 60,
        render: (j) => <>{fmtDate(j.created_at)}</>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Profiles table columns ──────────────────────────────────────────────────

  const profileColumns = useMemo<DataTableColumn<MarketerProfile>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        width: "10%",
        skeletonWidth: 90,
        render: (p) => (
          <span
            style={{
              cursor: "pointer",
              color: "#235a81",
              textDecoration: "underline",
            }}
            onClick={() => openProfileDetail(p)}
            title="Click to view profile"
          >
            {p.name || "—"}
          </span>
        ),
        tooltip: (p) => p.name || "—",
      },
      {
        key: "email",
        header: "Email",
        width: "12%",
        skeletonWidth: 90,
        render: (p) => (
          <span style={{ fontSize: 10 }} title={p.email}>
            {p.email || "—"}
          </span>
        ),
        tooltip: (p) => p.email || "—",
      },
      {
        key: "phone",
        header: "Phone",
        width: "8%",
        skeletonWidth: 65,
        render: (p) => (
          <span style={{ fontSize: 10 }} title={p.phone}>
            {p.phone || "—"}
          </span>
        ),
      },
      {
        key: "role",
        header: "Role",
        width: "10%",
        skeletonWidth: 100,
        render: (p) => <>{p.current_role || "—"}</>,
        tooltip: (p) => p.current_role || "—",
      },
      {
        key: "company",
        header: "Company",
        width: "9%",
        skeletonWidth: 90,
        render: (p) => <>{p.current_company || "—"}</>,
        tooltip: (p) => p.current_company || "—",
      },
      {
        key: "type",
        header: "Type",
        width: "7%",
        skeletonWidth: 70,
        render: (p) => (
          <span className="matchdb-type-pill">
            {TYPE_LABELS[p.preferred_job_type] || p.preferred_job_type || "—"}
          </span>
        ),
      },
      {
        key: "skills",
        header: "Skills",
        width: "15%",
        skeletonWidth: 140,
        render: (p) => (
          <div style={{ display: "flex", gap: 2, overflow: "hidden" }}>
            {(p.skills || []).slice(0, 3).map((s) => (
              <span key={s} className="matchdb-skill-pill">
                {s}
              </span>
            ))}
            {(p.skills || []).length > 3 && (
              <span
                className="matchdb-skill-pill"
                title={(p.skills || []).slice(3).join(", ")}
              >
                +{(p.skills || []).length - 3}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "location",
        header: "Location",
        width: "7%",
        skeletonWidth: 70,
        render: (p) => <>{p.location || "—"}</>,
        tooltip: (p) => p.location || "—",
      },
      {
        key: "exp",
        header: "Exp",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 35,
        render: (p) => (
          <>{p.experience_years ? `${p.experience_years}y` : "—"}</>
        ),
      },
      {
        key: "rate",
        header: "Rate",
        width: "5%",
        skeletonWidth: 50,
        render: (p) => <>{fmtRate(p.expected_hourly_rate)}</>,
      },
      {
        key: "date",
        header: "Joined",
        width: "6%",
        skeletonWidth: 60,
        render: (p) => <>{fmtDate(p.created_at)}</>,
      },
      {
        key: "pokes",
        header: "Pokes",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 30,
        render: (p) => (
          <span
            style={{
              color: countColor(p.poke_count),
              background: countBg(p.poke_count),
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {p.poke_count}
          </span>
        ),
      },
      {
        key: "emails",
        header: "Emails",
        width: "4%",
        align: "center" as const,
        skeletonWidth: 30,
        render: (p) => (
          <span
            style={{
              color: countColor(p.email_count),
              background: countBg(p.email_count),
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {p.email_count}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Company Candidates table columns ────────────────────────────────────────

  const candidateColumns = useMemo<DataTableColumn<MarketerCandidateItem>[]>(
    () => [
      {
        key: "candidate_name",
        header: "Name",
        width: "25%",
        skeletonWidth: 120,
        render: (c) => <>{c.candidate_name || "—"}</>,
      },
      {
        key: "candidate_email",
        header: "Email",
        width: "30%",
        skeletonWidth: 150,
        render: (c) => <>{c.candidate_email}</>,
      },
      {
        key: "created_at",
        header: "Added",
        width: "20%",
        skeletonWidth: 80,
        render: (c) => <>{fmtDate(c.created_at)}</>,
      },
      {
        key: "actions",
        header: "",
        width: "10%",
        render: (c) => (
          <button
            type="button"
            className="matchdb-btn"
            style={{ fontSize: 10, padding: "1px 6px", color: "#bb3333" }}
            onClick={() => handleRemoveCandidate(c.id)}
          >
            ✕ Remove
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Forwarded Openings table columns ────────────────────────────────────────

  const forwardedColumns = useMemo<DataTableColumn<ForwardedOpeningItem>[]>(
    () => [
      {
        key: "job_title",
        header: "Job Title",
        width: "18%",
        skeletonWidth: 120,
        render: (f) => <>{f.job_title}</>,
      },
      {
        key: "candidate_name",
        header: "Candidate",
        width: "14%",
        skeletonWidth: 100,
        render: (f) => <>{f.candidate_name || f.candidate_email}</>,
      },
      {
        key: "candidate_email",
        header: "Email",
        width: "16%",
        skeletonWidth: 120,
        render: (f) => (
          <span style={{ fontSize: 10 }}>{f.candidate_email}</span>
        ),
      },
      {
        key: "job_type",
        header: "Type",
        width: "10%",
        skeletonWidth: 70,
        render: (f) => (
          <>
            {TYPE_LABELS[f.job_type] || f.job_type}
            {f.job_sub_type
              ? ` › ${SUB_LABELS[f.job_sub_type] || f.job_sub_type}`
              : ""}
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
        key: "status",
        header: "Status",
        width: "8%",
        skeletonWidth: 50,
        render: (f) => <span className="matchdb-type-pill">{f.status}</span>,
      },
      {
        key: "note",
        header: "Note",
        width: "12%",
        skeletonWidth: 80,
        render: (f) => <span style={{ fontSize: 10 }}>{f.note || "—"}</span>,
      },
      {
        key: "created_at",
        header: "Sent",
        width: "8%",
        skeletonWidth: 60,
        render: (f) => <>{fmtDate(f.created_at)}</>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  // Stat chips data
  const stats = statsData;
  const statChips = [
    {
      label: "Candidate Records",
      value: stats?.total_profiles ?? profilesTotal,
      icon: "👤",
      view: "candidate-created" as ActiveView,
    },
    {
      label: "Job Openings",
      value: stats?.total_jobs ?? jobsTotal,
      icon: "💼",
      view: "vendor-posted" as ActiveView,
    },
    {
      label: "Open Openings",
      value: stats?.total_open_jobs ?? 0,
      icon: "📂",
      view: "vendor-posted" as ActiveView,
    },
    {
      label: "Closed Openings",
      value: stats?.total_closed_jobs ?? 0,
      icon: "🔒",
    },
    { label: "Candidates Placed", value: stats?.total_placed ?? 0, icon: "✅" },
  ];

  return (
    <DBLayout userType="vendor" navGroups={navGroups} breadcrumb={breadcrumb}>
      <div className="matchdb-page">
        {/* ── Dashboard stat chips (same as vendor / candidate) ── */}
        <div className="matchdb-stat-bar">
          {statChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`matchdb-stat-rect${
                chip.view && activeView === chip.view
                  ? " matchdb-stat-rect-active"
                  : ""
              }`}
              onClick={() => chip.view && navigateTo(chip.view)}
              title={chip.view ? `View ${chip.label}` : chip.label}
            >
              <span className="matchdb-stat-icon">{chip.icon}</span>
              <span>
                <span
                  className="matchdb-stat-value"
                  style={{
                    color: countColor(chip.value),
                    background: countBg(chip.value),
                  }}
                >
                  {chip.value}
                </span>
                <span className="matchdb-stat-label">{chip.label}</span>
              </span>
            </button>
          ))}
        </div>

        {activeView === "vendor-posted" ? (
          <DataTable<MarketerJob>
            columns={jobColumns}
            data={filteredJobs}
            keyExtractor={(j) => j.id}
            loading={jobsLoading}
            paginate
            flashIds={jobsFlash.flashIds}
            deleteFlashIds={jobsFlash.deleteFlashIds}
            titleIcon="💼"
            title={
              subFilter
                ? `Job Openings — ${
                    subFilter === "full_time"
                      ? "Full Time"
                      : subFilter.toUpperCase()
                  }`
                : "Job Openings"
            }
            paginationExtra={
              <button
                type="button"
                className="matchdb-btn matchdb-title-btn"
                onClick={handleDownloadJobsCSV}
                title="Download all job openings as CSV"
                style={{ fontSize: 10, padding: "2px 8px" }}
              >
                ⬇ CSV
              </button>
            }
            titleExtra={
              <div className="matchdb-title-toolbar">
                <input
                  className="matchdb-input matchdb-title-search"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search title, skills, location…"
                />
                <button
                  type="button"
                  className="matchdb-btn matchdb-title-btn"
                  onClick={() => setJobSearch("")}
                >
                  Reset
                </button>
                <span className="matchdb-title-count">
                  {jobsLoading
                    ? "…"
                    : subFilter
                    ? `${filteredJobs.length} / ${jobsTotal}`
                    : `${jobs.length} / ${jobsTotal}`}
                </span>
                <button
                  type="button"
                  className="matchdb-btn matchdb-title-btn"
                  onClick={() => refetchJobs()}
                >
                  ↻ Refresh
                </button>
                {Boolean(jobsFlash.lastSync) && (
                  <span className="matchdb-title-sync">
                    synced {new Date(jobsFlash.lastSync!).toLocaleTimeString()}
                  </span>
                )}
              </div>
            }
          />
        ) : activeView === "candidate-created" ? (
          <DataTable<MarketerProfile>
            columns={profileColumns}
            data={filteredProfiles}
            keyExtractor={(p) => p.id}
            loading={profilesLoading}
            paginate
            flashIds={profilesFlash.flashIds}
            deleteFlashIds={profilesFlash.deleteFlashIds}
            titleIcon="👤"
            title={
              subFilter
                ? `Candidate Profiles — ${
                    subFilter === "full_time"
                      ? "Full Time"
                      : subFilter.toUpperCase()
                  }`
                : "Candidate Profiles"
            }
            paginationExtra={
              <button
                type="button"
                className="matchdb-btn matchdb-title-btn"
                onClick={handleDownloadProfilesExcel}
                title="Download all candidate profiles as Excel"
                style={{ fontSize: 10, padding: "2px 8px" }}
              >
                ⬇ Excel
              </button>
            }
            titleExtra={
              <div className="matchdb-title-toolbar">
                <input
                  className="matchdb-input matchdb-title-search"
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  placeholder="Search name, role, skills, location…"
                />
                <button
                  type="button"
                  className="matchdb-btn matchdb-title-btn"
                  onClick={() => setProfileSearch("")}
                >
                  Reset
                </button>
                <span className="matchdb-title-count">
                  {profilesLoading
                    ? "…"
                    : subFilter
                    ? `${filteredProfiles.length} / ${profilesTotal}`
                    : `${profiles.length} / ${profilesTotal}`}
                </span>
                <button
                  type="button"
                  className="matchdb-btn matchdb-title-btn"
                  onClick={() => refetchProfiles()}
                >
                  ↻ Refresh
                </button>
                {Boolean(profilesFlash.lastSync) && (
                  <span className="matchdb-title-sync">
                    synced{" "}
                    {new Date(profilesFlash.lastSync!).toLocaleTimeString()}
                  </span>
                )}
              </div>
            }
          />
        ) : activeView === "company-candidates" ? (
          <div>
            {/* Company registration (one-time) */}
            {!myCompany && (
              <div
                className="matchdb-card"
                style={{ marginBottom: 12, padding: 12 }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>
                  🏢 Register Your Company
                </h3>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    className="matchdb-input"
                    placeholder="Company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{ flex: 1, maxWidth: 300 }}
                  />
                  <button
                    type="button"
                    className="matchdb-btn"
                    onClick={handleRegisterCompany}
                  >
                    Register
                  </button>
                </div>
              </div>
            )}

            {myCompany && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
                🏢 <strong>{myCompany.name}</strong> —{" "}
                {myCompany.marketer_email}
              </div>
            )}

            {/* Add candidate form */}
            {myCompany && (
              <div
                className="matchdb-card"
                style={{ marginBottom: 12, padding: 10 }}
              >
                <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>
                  Add Candidate to Roster
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    className="matchdb-input"
                    placeholder="Candidate name"
                    value={newCandName}
                    onChange={(e) => setNewCandName(e.target.value)}
                    style={{ width: 180 }}
                  />
                  <input
                    className="matchdb-input"
                    placeholder="Candidate email"
                    value={newCandEmail}
                    onChange={(e) => setNewCandEmail(e.target.value)}
                    style={{ width: 240 }}
                  />
                  <button
                    type="button"
                    className="matchdb-btn"
                    onClick={handleAddCandidate}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Candidates table */}
            <DataTable<MarketerCandidateItem>
              columns={candidateColumns}
              data={companyCandidates}
              keyExtractor={(c) => c.id}
              loading={false}
              paginate
              titleIcon="🏢"
              title="Company Candidates"
            />
          </div>
        ) : (
          /* activeView === "forwarded-openings" */
          <DataTable<ForwardedOpeningItem>
            columns={forwardedColumns}
            data={forwardedOpenings}
            keyExtractor={(f) => f.id}
            loading={false}
            paginate
            titleIcon="📤"
            title="Forwarded Openings"
          />
        )}
      </div>

      {/* ── Detail modal for job / candidate ── */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        data={detailData}
        companyCandidates={companyCandidates.map((c) => ({
          candidate_email: c.candidate_email,
          candidate_name: c.candidate_name,
        }))}
        forwardableJobs={forwardableJobs}
        onForwardToCandidate={handleForwardOpening}
        onForwardCandidateToJob={handleForwardOpening}
        forwardLoading={forwardLoading}
      />
    </DBLayout>
  );
};

export default MarketerDashboard;
