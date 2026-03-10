import React, { useCallback, useMemo, useState } from "react";
import DBLayout, { NavGroup } from "../components/DBLayout";
import {
  DataTable,
  Button,
  Input,
  Select,
  Tabs,
  Panel,
  Toolbar,
} from "matchdb-component-library";
import type { DataTableColumn, Tab } from "matchdb-component-library";
import DetailModal from "../components/DetailModal";
import ProjectPayTable from "../components/ProjectPayTable";
import "../components/ProjectFinancialForm.css";
import { useAutoRefreshFlash } from "../hooks/useAutoRefreshFlash";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import {
  useGetMarketerJobsQuery,
  useGetMarketerProfilesQuery,
  useGetMarketerStatsQuery,
  useGetMyCompanyQuery,
  useRegisterCompanyMutation,
  useGetMarketerCandidatesQuery,
  useGetMarketerCandidateDetailQuery,
  useAddMarketerCandidateMutation,
  useRemoveMarketerCandidateMutation,
  useForwardOpeningMutation,
  useGetForwardedOpeningsQuery,
  useInviteCandidateMutation,
  useForwardOpeningWithEmailMutation,
  useUpdateForwardedStatusMutation,
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
  | "candidate-detail"
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
  n >= 50
    ? "var(--w97-green)"
    : n >= 25
    ? "var(--w97-yellow)"
    : n >= 10
    ? "var(--w97-orange)"
    : "var(--w97-red)";
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
  const [activeView, setActiveView] =
    useState<ActiveView>("company-candidates");
  const [jobSearch, setJobSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [detailTab, setDetailTab] = useState<
    "overview" | "projects" | "vendor-activity" | "forwarded"
  >("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

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
  const [newCandId, setNewCandId] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Add Candidate modal (opened from left nav)
  const [addCandModalOpen, setAddCandModalOpen] = useState(false);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteTarget, setInviteTarget] =
    useState<MarketerCandidateItem | null>(null);
  const [inviteOfferNote, setInviteOfferNote] = useState("");

  // Send Job Opening email modal state
  const [sendJobModalOpen, setSendJobModalOpen] = useState(false);
  const [sendJobCandidate, setSendJobCandidate] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [sendJobId, setSendJobId] = useState("");
  const [sendJobNote, setSendJobNote] = useState("");

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
  const { data: candidateDetail, isFetching: detailLoading } =
    useGetMarketerCandidateDetailQuery(selectedCandidateId!, {
      skip: !selectedCandidateId,
    });
  const [addCandidate] = useAddMarketerCandidateMutation();
  const [removeCandidate] = useRemoveMarketerCandidateMutation();
  const [forwardOpening, { isLoading: forwardLoading }] =
    useForwardOpeningMutation();
  const { data: forwardedOpenings = [] } = useGetForwardedOpeningsQuery();
  const [inviteCandidate, { isLoading: inviteLoading }] =
    useInviteCandidateMutation();
  const [forwardWithEmail, { isLoading: forwardEmailLoading }] =
    useForwardOpeningWithEmailMutation();
  const [updateForwardedStatus] = useUpdateForwardedStatusMutation();

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

  // ── Invite candidate handler ────────────────────────────────────────────────

  const openInviteModal = (c: MarketerCandidateItem) => {
    setInviteTarget(c);
    setInviteOfferNote("");
    setInviteModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteTarget) return;
    try {
      await inviteCandidate({
        candidateId: inviteTarget.id,
        offerNote: inviteOfferNote.trim() || undefined,
      }).unwrap();
      alert(`Invite sent to ${inviteTarget.candidate_email}!`);
      setInviteModalOpen(false);
      setInviteTarget(null);
    } catch (e: any) {
      alert(e?.data?.error || "Failed to send invite");
    }
  };

  // ── Send Job Opening via email handler ──────────────────────────────────────

  const openSendJobModal = (candidateEmail: string, candidateName: string) => {
    setSendJobCandidate({ email: candidateEmail, name: candidateName });
    setSendJobId("");
    setSendJobNote("");
    setSendJobModalOpen(true);
  };

  const handleSendJobEmail = async () => {
    if (!sendJobCandidate || !sendJobId) return;
    try {
      await forwardWithEmail({
        candidateEmail: sendJobCandidate.email,
        jobId: sendJobId,
        note: sendJobNote.trim() || undefined,
      }).unwrap();
      alert(`Job opening sent to ${sendJobCandidate.email} via email!`);
      setSendJobModalOpen(false);
      setSendJobCandidate(null);
    } catch (e: any) {
      alert(e?.data?.error || "Failed to send job opening email");
    }
  };

  // ── Update forwarded opening status handler ─────────────────────────────────

  const handleUpdateForwardedStatus = async (id: string, status: string) => {
    try {
      await updateForwardedStatus({ id, status }).unwrap();
    } catch (e: any) {
      alert(e?.data?.error || "Failed to update status");
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

  const companyLabel = myCompany?.name ?? "My Company";

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: companyLabel,
        icon: "🏢",
        items: [
          {
            id: "company-candidates",
            label: "My Candidates",
            count: companyCandidates.length,
            active:
              activeView === "company-candidates" ||
              activeView === "candidate-detail",
            onClick: () => navigateTo("company-candidates"),
          },
          {
            id: "add-candidate",
            label: "+ Add Candidate",
            depth: 1,
            onClick: () => setAddCandModalOpen(true),
          },
          {
            id: "forwarded-openings",
            label: "Sent Openings",
            count: forwardedOpenings.length,
            active: activeView === "forwarded-openings",
            onClick: () => navigateTo("forwarded-openings"),
          },
        ],
      },
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
      companyLabel,
    ],
  );

  const breadcrumb =
    activeView === "vendor-posted"
      ? ["Jobs", "Marketer", "Job Openings"]
      : activeView === "candidate-created"
      ? ["Jobs", "Marketer", "Candidate Profiles"]
      : activeView === "candidate-detail"
      ? [
          "Jobs",
          "Marketer",
          companyLabel,
          candidateDetail?.roster?.candidate_name ?? "Candidate",
        ]
      : activeView === "company-candidates"
      ? ["Jobs", "Marketer", companyLabel]
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
              color: "var(--w97-blue)",
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
              color: "var(--w97-blue)",
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
        width: "18%",
        skeletonWidth: 120,
        render: (c) => (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--w97-blue)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              padding: 0,
              textDecoration: "underline",
            }}
            onClick={() => {
              setSelectedCandidateId(c.id);
              setDetailTab("overview");
              setActiveView("candidate-detail");
            }}
          >
            {c.candidate_name || "—"}
          </button>
        ),
      },
      {
        key: "candidate_email",
        header: "Email",
        width: "18%",
        skeletonWidth: 150,
        render: (c) => (
          <span style={{ fontSize: 10 }}>{c.candidate_email}</span>
        ),
      },
      {
        key: "current_role",
        header: "Role",
        width: "14%",
        skeletonWidth: 100,
        render: (c) => (
          <span style={{ fontSize: 10 }}>{c.current_role || "—"}</span>
        ),
      },
      {
        key: "invite_status",
        header: "Invite",
        width: "10%",
        skeletonWidth: 60,
        render: (c) => {
          const s = c.invite_status || "none";
          const color =
            s === "accepted"
              ? "var(--w97-green)"
              : s === "invited"
              ? "var(--w97-yellow)"
              : "var(--w97-text-secondary)";
          const bg =
            s === "accepted"
              ? "#e8f5e9"
              : s === "invited"
              ? "#fffde6"
              : "var(--w97-sky)";
          const label =
            s === "accepted"
              ? "✓ Accepted"
              : s === "invited"
              ? "⏳ Invited"
              : "—";
          return (
            <span
              style={{
                color,
                background: bg,
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          );
        },
      },
      {
        key: "poke_count",
        header: "Pokes",
        width: "8%",
        skeletonWidth: 40,
        render: (c) => (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color:
                (c.poke_count ?? 0) > 0
                  ? "var(--w97-yellow)"
                  : "var(--w97-text-secondary)",
            }}
          >
            {c.poke_count ?? 0}
          </span>
        ),
      },
      {
        key: "email_count",
        header: "Emails",
        width: "8%",
        skeletonWidth: 40,
        render: (c) => (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color:
                (c.email_count ?? 0) > 0
                  ? "var(--w97-blue)"
                  : "var(--w97-text-secondary)",
            }}
          >
            {c.email_count ?? 0}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Added",
        width: "10%",
        skeletonWidth: 80,
        render: (c) => <>{fmtDate(c.created_at)}</>,
      },
      {
        key: "actions",
        header: "",
        width: "14%",
        render: (c) => (
          <div style={{ display: "flex", gap: 4 }}>
            {(c.invite_status || "none") !== "accepted" && (
              <Button
                variant="email"
                size="xs"
                onClick={() => openInviteModal(c)}
                title="Invite"
              >
                ✉
              </Button>
            )}
            <Button
              variant="email"
              size="xs"
              style={{ color: "var(--w97-teal)" }}
              onClick={() =>
                openSendJobModal(c.candidate_email, c.candidate_name)
              }
              title="Send Job"
            >
              📧
            </Button>
            <Button
              variant="close"
              size="xs"
              onClick={() => handleRemoveCandidate(c.id)}
              title="Remove"
            >
              ✕
            </Button>
          </div>
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
        width: "10%",
        skeletonWidth: 50,
        render: (f) => {
          const statusColors: Record<string, string> = {
            pending: "var(--w97-yellow)",
            applied: "var(--w97-blue)",
            hired: "var(--w97-green)",
            declined: "var(--w97-red)",
            rejected: "var(--w97-text-secondary)",
          };
          const statusBgs: Record<string, string> = {
            pending: "#fffde6",
            applied: "#e3f2fd",
            hired: "#e8f5e9",
            declined: "#fff5f5",
            rejected: "var(--w97-sky)",
          };
          return (
            <Select
              value={f.status}
              onChange={(e) =>
                handleUpdateForwardedStatus(f.id, e.target.value)
              }
              style={{
                fontSize: 10,
                padding: "1px 4px",
                color: statusColors[f.status] || "var(--w97-text-secondary)",
                background: statusBgs[f.status] || "var(--w97-window)",
                fontWeight: 600,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              <option value="pending">⏳ Pending</option>
              <option value="applied">📝 Applied</option>
              <option value="hired">✅ Hired</option>
              <option value="declined">❌ Declined</option>
              <option value="rejected">🚫 Rejected</option>
            </Select>
          );
        },
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
              <Button
                variant="download"
                size="xs"
                onClick={handleDownloadJobsCSV}
                title="Download all job openings as CSV"
              >
                ⬇ CSV
              </Button>
            }
            titleExtra={
              <div className="matchdb-title-toolbar">
                <Input
                  className="matchdb-title-search"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search title, skills, location…"
                />
                <Button
                  size="xs"
                  className="matchdb-title-btn"
                  onClick={() => setJobSearch("")}
                >
                  Reset
                </Button>
                <span className="matchdb-title-count">
                  {jobsLoading
                    ? "…"
                    : subFilter
                    ? `${filteredJobs.length} / ${jobsTotal}`
                    : `${jobs.length} / ${jobsTotal}`}
                </span>
                <Button
                  size="xs"
                  className="matchdb-title-btn"
                  onClick={() => refetchJobs()}
                >
                  ↻ Refresh
                </Button>
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
              <Button
                variant="download"
                size="xs"
                onClick={handleDownloadProfilesExcel}
                title="Download all candidate profiles as Excel"
              >
                ⬇ Excel
              </Button>
            }
            titleExtra={
              <div className="matchdb-title-toolbar">
                <Input
                  className="matchdb-title-search"
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  placeholder="Search name, role, skills, location…"
                />
                <Button
                  size="xs"
                  className="matchdb-title-btn"
                  onClick={() => setProfileSearch("")}
                >
                  Reset
                </Button>
                <span className="matchdb-title-count">
                  {profilesLoading
                    ? "…"
                    : subFilter
                    ? `${filteredProfiles.length} / ${profilesTotal}`
                    : `${profiles.length} / ${profilesTotal}`}
                </span>
                <Button
                  size="xs"
                  className="matchdb-title-btn"
                  onClick={() => refetchProfiles()}
                >
                  ↻ Refresh
                </Button>
                {Boolean(profilesFlash.lastSync) && (
                  <span className="matchdb-title-sync">
                    synced{" "}
                    {new Date(profilesFlash.lastSync!).toLocaleTimeString()}
                  </span>
                )}
              </div>
            }
          />
        ) : activeView === "candidate-detail" && selectedCandidateId ? (
          /* ── Candidate Detail — Tabbed Center Content ── */
          <div
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {/* ── Top Bar: Back + Name + Print ── */}
            <Toolbar
              left={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveView("company-candidates");
                      setSelectedCandidateId(null);
                    }}
                  >
                    ← Back
                  </Button>
                  {candidateDetail?.roster && (
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 17,
                        fontWeight: 700,
                        color: "var(--w97-titlebar-from)",
                      }}
                    >
                      {candidateDetail.roster.candidate_name}
                    </h2>
                  )}
                </div>
              }
              right={
                <div style={{ display: "flex", gap: 6 }}>
                  {candidateDetail?.roster &&
                    (candidateDetail.roster.invite_status || "none") !==
                      "accepted" && (
                      <Button
                        variant="email"
                        size="xs"
                        onClick={() =>
                          openInviteModal({
                            id: candidateDetail.roster.id,
                            candidate_email:
                              candidateDetail.roster.candidate_email,
                            candidate_name:
                              candidateDetail.roster.candidate_name,
                            invite_status:
                              candidateDetail.roster.invite_status || "none",
                            created_at: candidateDetail.roster.created_at,
                          } as MarketerCandidateItem)
                        }
                      >
                        ✉ Invite
                      </Button>
                    )}
                  {candidateDetail?.roster && (
                    <Button
                      variant="email"
                      size="xs"
                      style={{ color: "var(--w97-teal)" }}
                      onClick={() =>
                        openSendJobModal(
                          candidateDetail.roster.candidate_email,
                          candidateDetail.roster.candidate_name,
                        )
                      }
                    >
                      📧 Send Job
                    </Button>
                  )}
                  {candidateDetail?.profile && (
                    <Button
                      variant="download"
                      size="xs"
                      onClick={() =>
                        downloadResumePDF({
                          name: candidateDetail.profile!.name,
                          email: candidateDetail.profile!.email,
                          phone: candidateDetail.profile!.phone,
                          skills: candidateDetail.profile!.skills,
                          experience_years:
                            candidateDetail.profile!.experience_years,
                          current_role: candidateDetail.profile!.current_role,
                          current_company:
                            candidateDetail.profile!.current_company ?? "",
                          location: candidateDetail.profile!.location,
                          resume_summary:
                            candidateDetail.profile!.resume_summary,
                          resume_experience:
                            candidateDetail.profile!.resume_experience,
                          resume_education:
                            candidateDetail.profile!.resume_education,
                          resume_achievements:
                            candidateDetail.profile!.resume_achievements,
                        } as MarketerProfile)
                      }
                    >
                      📥 Resume
                    </Button>
                  )}
                </div>
              }
              style={{ marginBottom: 12 }}
            />

            {detailLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: "var(--w97-text-secondary)",
                  fontSize: 13,
                }}
              >
                Loading candidate details…
              </div>
            ) : !candidateDetail ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: "var(--w97-text-secondary)",
                  fontSize: 13,
                }}
              >
                Candidate not found.
              </div>
            ) : (
              <>
                {/* ── Horizontal Tab Bar ── */}
                <Tabs
                  activeKey={detailTab}
                  onSelect={(key) => {
                    setDetailTab(key as typeof detailTab);
                    if (key !== "projects") setSelectedProjectId(null);
                  }}
                  tabs={[
                    { key: "overview", label: "👤 Overview" },
                    {
                      key: "projects",
                      label: (
                        <>
                          📋 Projects{" "}
                          <span className="matchdb-tab-badge">
                            {candidateDetail.projects.length}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "vendor-activity",
                      label: (
                        <>
                          📊 Vendor Activity{" "}
                          <span className="matchdb-tab-badge">
                            {candidateDetail.vendor_activity.length}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "forwarded",
                      label: (
                        <>
                          📤 Forwarded Openings{" "}
                          <span className="matchdb-tab-badge">
                            {candidateDetail.forwarded_openings.length}
                          </span>
                        </>
                      ),
                    },
                  ]}
                />

                {/* ════════════ TAB: Overview ════════════ */}
                {detailTab === "overview" &&
                  (() => {
                    const allFins = candidateDetail.projects
                      .filter((p) => p.financials != null)
                      .map((p) => ({ project: p, fin: p.financials! }));

                    const totalBilled = allFins.reduce(
                      (a, x) => a + x.fin.totalBilled,
                      0,
                    );
                    const totalMargin = allFins.reduce(
                      (a, x) => a + (x.fin.totalBilled - x.fin.totalPay),
                      0,
                    );
                    const totalNet = allFins.reduce(
                      (a, x) => a + x.fin.netPayable,
                      0,
                    );
                    const totalPaid = allFins.reduce(
                      (a, x) => a + x.fin.amountPaid,
                      0,
                    );
                    const totalPending = allFins.reduce(
                      (a, x) => a + Math.max(0, x.fin.amountPending),
                      0,
                    );
                    const totalHours = allFins.reduce(
                      (a, x) => a + x.fin.hoursWorked,
                      0,
                    );

                    // Generate aggregated monthly pay rows across all projects
                    const OV_MN = [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ] as const;
                    const OV_VAR = [
                      1.0, 0.92, 1.08, 1.02, 0.94, 1.06, 1.0, 0.92, 1.08, 1.0,
                      0.94, 1.04,
                    ];
                    type MonthRow = {
                      label: string;
                      hours: number;
                      billed: number;
                      gross: number;
                      net: number;
                      paid: number;
                      balance: number;
                    };
                    const monthMap: Record<string, MonthRow> = {};

                    allFins.forEach(({ fin }) => {
                      const now = new Date();
                      const start = fin.projectStart
                        ? new Date(fin.projectStart)
                        : new Date(now.getFullYear() - 1, now.getMonth(), 1);
                      const rawH =
                        fin.hoursWorked > 0 ? fin.hoursWorked / 12 : 80;
                      const periods = Array.from({ length: 12 }, (_, i) => {
                        const d = new Date(
                          start.getFullYear(),
                          start.getMonth() + i,
                          1,
                        );
                        return {
                          label: `${OV_MN[d.getMonth()]} ${d.getFullYear()}`,
                          hours: Math.round(rawH * OV_VAR[i] * 2) / 2,
                        };
                      });
                      if (fin.hoursWorked > 0) {
                        const sumH = periods.reduce((a, p) => a + p.hours, 0);
                        const scale = fin.hoursWorked / sumH;
                        periods.forEach((p) => {
                          p.hours = Math.round(p.hours * scale * 2) / 2;
                        });
                      }
                      const paidArr: number[] = new Array(12).fill(0);
                      if (fin.amountPaid > 0) {
                        const sumH = periods.reduce((a, p) => a + p.hours, 0);
                        let alloc = 0;
                        periods.forEach((p, i) => {
                          if (i < 11) {
                            const s =
                              Math.round(
                                (p.hours / sumH) * fin.amountPaid * 100,
                              ) / 100;
                            paidArr[i] = s;
                            alloc += s;
                          } else {
                            paidArr[i] =
                              Math.round((fin.amountPaid - alloc) * 100) / 100;
                          }
                        });
                      }
                      periods.forEach((p, i) => {
                        const billed = fin.billRate * p.hours;
                        const gross = fin.payRate * p.hours;
                        const tax = (gross * fin.stateTaxPct) / 100;
                        const withhold = (gross * fin.cashPct) / 100;
                        const net = gross - tax - withhold;
                        const paid = paidArr[i];
                        if (!monthMap[p.label])
                          monthMap[p.label] = {
                            label: p.label,
                            hours: 0,
                            billed: 0,
                            gross: 0,
                            net: 0,
                            paid: 0,
                            balance: 0,
                          };
                        monthMap[p.label].hours += p.hours;
                        monthMap[p.label].billed += billed;
                        monthMap[p.label].gross += gross;
                        monthMap[p.label].net += net;
                        monthMap[p.label].paid += paid;
                        monthMap[p.label].balance += net - paid;
                      });
                    });

                    const monthRows = Object.values(monthMap).sort(
                      (a, b) =>
                        new Date(a.label).getTime() -
                        new Date(b.label).getTime(),
                    );
                    const fmtC = (v: number) =>
                      `$${Math.abs(v).toLocaleString("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}`;
                    const fmtF = (v: number) =>
                      v < 0
                        ? `-$${Math.abs(v).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : `$${v.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`;

                    return (
                      <div className="ov-root">
                        {/* ══ ROW 1 — Legacy profile card + legacy quick-stats sidebar ══ */}
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            flexWrap: "wrap",
                            padding: "16px 16px 0",
                          }}
                        >
                          {/* ── LEFT: Profile Information card (unchanged from legacy) ── */}
                          <div
                            className="matchdb-card"
                            style={{
                              flex: "1 1 380px",
                              padding: 20,
                              borderLeft: "4px solid var(--w97-blue)",
                            }}
                          >
                            <h3
                              style={{
                                margin: "0 0 14px",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--w97-titlebar-from)",
                              }}
                            >
                              Profile Information
                            </h3>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "10px 20px",
                                fontSize: 12,
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Email
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.roster.candidate_email}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Candidate ID
                                </span>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    marginTop: 2,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {candidateDetail.profile?.candidate_id || "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Role
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.current_role || "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Experience
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.experience_years !=
                                  null
                                    ? `${candidateDetail.profile.experience_years} years`
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Rate
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.expected_hourly_rate
                                    ? `$${candidateDetail.profile.expected_hourly_rate}/hr`
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Location
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.location || "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Phone
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.phone || "—"}
                                </div>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Company
                                </span>
                                <div style={{ fontWeight: 500, marginTop: 2 }}>
                                  {candidateDetail.profile?.current_company ||
                                    "—"}
                                </div>
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <span
                                  style={{
                                    color: "var(--w97-text-secondary)",
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Skills
                                </span>
                                <div
                                  style={{
                                    marginTop: 4,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 4,
                                  }}
                                >
                                  {Array.isArray(
                                    candidateDetail.profile?.skills,
                                  ) &&
                                  candidateDetail.profile!.skills.length > 0 ? (
                                    candidateDetail.profile!.skills.map((s) => (
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
                                    ))
                                  ) : (
                                    <span
                                      style={{
                                        color: "var(--w97-text-secondary)",
                                        fontSize: 11,
                                      }}
                                    >
                                      —
                                    </span>
                                  )}
                                </div>
                              </div>
                              {candidateDetail.profile?.bio && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <span
                                    style={{
                                      color: "var(--w97-text-secondary)",
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Bio
                                  </span>
                                  <div
                                    style={{
                                      fontWeight: 400,
                                      marginTop: 2,
                                      fontSize: 11,
                                      color: "var(--w97-text-secondary)",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {candidateDetail.profile.bio}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ── RIGHT: Quick stats sidebar (unchanged from legacy) ── */}
                          <div
                            style={{
                              flex: "0 0 220px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            <div
                              className="matchdb-card"
                              style={{
                                padding: 14,
                                textAlign: "center",
                                borderLeft:
                                  (candidateDetail.roster.invite_status ||
                                    "none") === "accepted"
                                    ? "4px solid var(--w97-green)"
                                    : "4px solid var(--w97-yellow)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--w97-text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Invite Status
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color:
                                    (candidateDetail.roster.invite_status ||
                                      "none") === "accepted"
                                      ? "var(--w97-green)"
                                      : "var(--w97-yellow)",
                                }}
                              >
                                {(candidateDetail.roster.invite_status ||
                                  "none") === "accepted"
                                  ? "✓ Accepted"
                                  : "⏳ Pending"}
                              </div>
                            </div>
                            <div
                              className="matchdb-card"
                              style={{
                                padding: 14,
                                textAlign: "center",
                                borderLeft: "4px solid var(--w97-blue)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--w97-text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Active Projects
                              </div>
                              <div
                                style={{
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: "var(--w97-blue)",
                                }}
                              >
                                {
                                  candidateDetail.projects.filter(
                                    (p) => p.is_active,
                                  ).length
                                }
                              </div>
                            </div>
                            <div
                              className="matchdb-card"
                              style={{
                                padding: 14,
                                textAlign: "center",
                                borderLeft: "4px solid var(--w97-orange)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--w97-text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Vendor Interactions
                              </div>
                              <div
                                style={{
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: "var(--w97-orange)",
                                }}
                              >
                                {candidateDetail.vendor_activity.length}
                              </div>
                            </div>
                            <div
                              className="matchdb-card"
                              style={{
                                padding: 14,
                                textAlign: "center",
                                borderLeft: "4px solid var(--w97-red)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--w97-text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Forwarded Openings
                              </div>
                              <div
                                style={{
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: "var(--w97-red)",
                                }}
                              >
                                {candidateDetail.forwarded_openings.length}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--w97-text-secondary)",
                                textAlign: "center",
                                marginTop: 4,
                              }}
                            >
                              Rostered{" "}
                              {fmtDate(candidateDetail.roster.created_at)}
                            </div>
                          </div>
                        </div>

                        {/* ══ ROW 2 — Modern financial KPI strip (only when financials exist) ══ */}
                        {allFins.length > 0 && (
                          <div
                            className="ov-kpi-strip"
                            style={{ margin: "14px 16px 0" }}
                          >
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">Total Hours</span>
                              <span className="ov-kpi-value ov-kv-blue">
                                {totalHours.toLocaleString()}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">
                                Vendor Billed
                              </span>
                              <span className="ov-kpi-value ov-kv-green">
                                {fmtC(totalBilled)}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">Your Margin</span>
                              <span className="ov-kpi-value ov-kv-teal">
                                {fmtC(totalMargin)}
                                {totalBilled > 0 && (
                                  <span className="ov-kpi-pct">
                                    {" "}
                                    (
                                    {(
                                      (totalMargin / totalBilled) *
                                      100
                                    ).toFixed(1)}
                                    %)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">Net Payable</span>
                              <span className="ov-kpi-value ov-kv-blue">
                                {fmtC(totalNet)}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">Paid to Date</span>
                              <span className="ov-kpi-value ov-kv-green">
                                {fmtC(totalPaid)}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            <div className="ov-kpi">
                              <span className="ov-kpi-label">Outstanding</span>
                              <span
                                className={`ov-kpi-value ${
                                  totalPending > 0
                                    ? "ov-kv-orange"
                                    : "ov-kv-green"
                                }`}
                              >
                                {fmtC(totalPending)}
                              </span>
                            </div>
                            <div className="ov-kpi-div" />
                            {/* Inline progress bar in the KPI strip */}
                            <div
                              className="ov-kpi"
                              style={{ flex: 1, minWidth: 120 }}
                            >
                              <span className="ov-kpi-label">
                                Payment Progress —{" "}
                                {totalNet > 0
                                  ? ((totalPaid / totalNet) * 100).toFixed(0)
                                  : 0}
                                % paid
                              </span>
                              <div
                                style={{
                                  marginTop: 4,
                                  height: 8,
                                  background: "var(--w97-border-light)",
                                  borderRadius: 8,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    borderRadius: 8,
                                    width: `${
                                      totalNet > 0
                                        ? Math.min(
                                            100,
                                            (totalPaid / totalNet) * 100,
                                          )
                                        : 0
                                    }%`,
                                    background:
                                      "linear-gradient(90deg, var(--w97-green), #2dd55b)",
                                    transition: "width 0.4s ease",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ══ ROW 3 — Projects financial summary table ══ */}
                        {candidateDetail.projects.length > 0 && (
                          <div
                            className="ov-projects-card"
                            style={{ margin: "14px 16px 0" }}
                          >
                            <div className="ov-section-hdr">
                              Projects — Financial Summary
                              <span className="ov-hdr-badge">
                                {candidateDetail.projects.length} total ·{" "}
                                {
                                  candidateDetail.projects.filter(
                                    (p) => p.is_active,
                                  ).length
                                }{" "}
                                active
                              </span>
                            </div>
                            <div className="ov-proj-wrap">
                              <table className="ov-proj-table">
                                <thead>
                                  <tr className="ov-pt-head">
                                    <th className="ov-pt-th">Project / Role</th>
                                    <th className="ov-pt-th ov-pt-r">Status</th>
                                    <th className="ov-pt-th ov-pt-r">
                                      Bill / Pay Rate
                                    </th>
                                    <th className="ov-pt-th ov-pt-r">Hours</th>
                                    <th className="ov-pt-th ov-pt-r">
                                      Vendor Billed
                                    </th>
                                    <th className="ov-pt-th ov-pt-r">
                                      Your Margin
                                    </th>
                                    <th className="ov-pt-th ov-pt-r">
                                      Net Pay
                                    </th>
                                    <th className="ov-pt-th ov-pt-r">Paid</th>
                                    <th className="ov-pt-th ov-pt-r">
                                      Balance
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    ...candidateDetail.projects.filter(
                                      (p) => p.is_active,
                                    ),
                                    ...candidateDetail.projects.filter(
                                      (p) => !p.is_active,
                                    ),
                                  ].map((p, idx) => {
                                    const f = p.financials;
                                    const margin = f
                                      ? f.totalBilled - f.totalPay
                                      : 0;
                                    const balance = f
                                      ? Math.max(0, f.amountPending)
                                      : 0;
                                    return (
                                      <tr
                                        key={p.id}
                                        className={`ov-pt-row ${
                                          idx % 2 === 1 ? "ov-pt-alt" : ""
                                        }`}
                                      >
                                        <td className="ov-pt-td">
                                          <div className="ov-proj-title">
                                            {p.job_title || "Untitled"}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: 10,
                                              color:
                                                "var(--w97-text-secondary)",
                                              marginTop: 1,
                                            }}
                                          >
                                            {p.job_type}
                                            {p.job_sub_type
                                              ? ` · ${p.job_sub_type.toUpperCase()}`
                                              : ""}
                                            {f?.stateCode
                                              ? ` · ${f.stateCode}`
                                              : ""}
                                          </div>
                                        </td>
                                        <td className="ov-pt-td ov-pt-r">
                                          <span
                                            className={`ov-proj-badge ${
                                              p.is_active
                                                ? "ov-proj-active"
                                                : "ov-proj-closed"
                                            }`}
                                          >
                                            {p.is_active
                                              ? "● Active"
                                              : "✓ Closed"}
                                          </span>
                                        </td>
                                        <td
                                          className="ov-pt-td ov-pt-r ov-mono"
                                          style={{ fontSize: 11 }}
                                        >
                                          {f ? (
                                            <>
                                              <span
                                                style={{
                                                  color: "var(--pf-green)",
                                                }}
                                              >
                                                ${f.billRate}
                                              </span>
                                              {" / "}
                                              <span
                                                style={{
                                                  color: "var(--pf-blue)",
                                                }}
                                              >
                                                ${f.payRate}
                                              </span>
                                            </>
                                          ) : (
                                            <span
                                              style={{
                                                color: "var(--w97-border-dark)",
                                              }}
                                            >
                                              Not set
                                            </span>
                                          )}
                                        </td>
                                        <td className="ov-pt-td ov-pt-r ov-mono">
                                          {f
                                            ? f.hoursWorked.toLocaleString()
                                            : "—"}
                                        </td>
                                        <td className="ov-pt-td ov-pt-r ov-mono ov-val-green">
                                          {f ? fmtC(f.totalBilled) : "—"}
                                        </td>
                                        <td className="ov-pt-td ov-pt-r ov-mono ov-val-teal">
                                          {f ? (
                                            <>
                                              {fmtC(margin)}{" "}
                                              <span
                                                style={{
                                                  fontSize: 10,
                                                  opacity: 0.7,
                                                }}
                                              >
                                                {f.totalBilled > 0
                                                  ? `(${(
                                                      (margin / f.totalBilled) *
                                                      100
                                                    ).toFixed(1)}%)`
                                                  : ""}
                                              </span>
                                            </>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td className="ov-pt-td ov-pt-r ov-mono ov-val-blue">
                                          {f ? fmtC(f.netPayable) : "—"}
                                        </td>
                                        <td className="ov-pt-td ov-pt-r ov-mono ov-val-green">
                                          {f ? fmtC(f.amountPaid) : "—"}
                                        </td>
                                        <td
                                          className={`ov-pt-td ov-pt-r ov-mono ${
                                            balance > 0
                                              ? "ov-val-orange"
                                              : "ov-val-green"
                                          }`}
                                        >
                                          {f
                                            ? balance <= 0
                                              ? "✓ Settled"
                                              : fmtC(balance)
                                            : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                {allFins.length > 1 && (
                                  <tfoot>
                                    <tr className="ov-pt-foot">
                                      <td className="ov-pt-tf" colSpan={2}>
                                        TOTAL — {allFins.length} projects with
                                        financials
                                      </td>
                                      <td className="ov-pt-tf ov-pt-r" />
                                      <td className="ov-pt-tf ov-pt-r ov-mono">
                                        {totalHours.toLocaleString()}
                                      </td>
                                      <td className="ov-pt-tf ov-pt-r ov-mono ov-val-green">
                                        {fmtC(totalBilled)}
                                      </td>
                                      <td className="ov-pt-tf ov-pt-r ov-mono ov-val-teal">
                                        {fmtC(totalMargin)}
                                      </td>
                                      <td className="ov-pt-tf ov-pt-r ov-mono ov-val-blue">
                                        {fmtC(totalNet)}
                                      </td>
                                      <td className="ov-pt-tf ov-pt-r ov-mono ov-val-green">
                                        {fmtC(totalPaid)}
                                      </td>
                                      <td
                                        className={`ov-pt-tf ov-pt-r ov-mono ${
                                          totalPending > 0
                                            ? "ov-val-orange"
                                            : "ov-val-green"
                                        }`}
                                      >
                                        {totalPending > 0
                                          ? fmtC(totalPending)
                                          : "✓ Settled"}
                                      </td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </div>
                        )}

                        {/* ══ ROW 4 — Monthly aggregate pay table ══ */}
                        {monthRows.length > 0 && (
                          <div
                            className="ov-monthly-card"
                            style={{ margin: "14px 16px 16px" }}
                          >
                            <div className="ov-section-hdr">
                              Monthly Pay Summary — All Projects Combined
                              <span className="ov-hdr-badge">
                                {monthRows.length} months
                              </span>
                            </div>
                            <div className="ov-monthly-wrap">
                              <table className="ov-monthly-table">
                                <thead>
                                  <tr className="ov-mt-head">
                                    <th className="ov-mt-th">Month</th>
                                    <th className="ov-mt-th ov-mt-r">Hours</th>
                                    <th className="ov-mt-th ov-mt-r">
                                      Vendor Billed
                                    </th>
                                    <th className="ov-mt-th ov-mt-r">
                                      Gross Pay
                                    </th>
                                    <th className="ov-mt-th ov-mt-r">
                                      Net Pay
                                    </th>
                                    <th className="ov-mt-th ov-mt-r">Paid</th>
                                    <th className="ov-mt-th ov-mt-r">
                                      Balance
                                    </th>
                                    <th
                                      className="ov-mt-th ov-mt-r"
                                      style={{ width: 130 }}
                                    >
                                      Pay Progress
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {monthRows.map((row, i) => {
                                    const pct =
                                      row.net > 0
                                        ? Math.min(
                                            100,
                                            (row.paid / row.net) * 100,
                                          )
                                        : 0;
                                    return (
                                      <tr
                                        key={row.label}
                                        className={`ov-mt-row ${
                                          i % 2 === 1 ? "ov-mt-alt" : ""
                                        }`}
                                      >
                                        <td className="ov-mt-td ov-mt-period">
                                          {row.label}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r ov-mono">
                                          {row.hours.toLocaleString(undefined, {
                                            maximumFractionDigits: 1,
                                          })}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r ov-mono ov-val-green">
                                          {fmtF(row.billed)}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r ov-mono">
                                          {fmtF(row.gross)}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r ov-mono ov-val-blue">
                                          {fmtF(row.net)}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r ov-mono ov-val-green">
                                          {row.paid > 0 ? fmtF(row.paid) : "—"}
                                        </td>
                                        <td
                                          className={`ov-mt-td ov-mt-r ov-mono ${
                                            row.balance > 0.01
                                              ? "ov-val-orange"
                                              : row.balance < -0.01
                                              ? "ov-val-red"
                                              : "ov-val-green"
                                          }`}
                                        >
                                          {Math.abs(row.balance) < 0.01
                                            ? "✓"
                                            : row.balance > 0
                                            ? fmtF(row.balance)
                                            : `+${fmtF(Math.abs(row.balance))}`}
                                        </td>
                                        <td className="ov-mt-td ov-mt-r">
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 5,
                                              justifyContent: "flex-end",
                                            }}
                                          >
                                            <div className="ov-mt-bar-wrap">
                                              <div
                                                className="ov-mt-bar-fill"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="ov-mt-bar-pct">
                                              {pct.toFixed(0)}%
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="ov-mt-foot">
                                    <td className="ov-mt-tf">TOTAL</td>
                                    <td className="ov-mt-tf ov-mt-r ov-mono">
                                      {monthRows
                                        .reduce((a, r) => a + r.hours, 0)
                                        .toLocaleString(undefined, {
                                          maximumFractionDigits: 1,
                                        })}
                                    </td>
                                    <td className="ov-mt-tf ov-mt-r ov-mono ov-val-green">
                                      {fmtF(
                                        monthRows.reduce(
                                          (a, r) => a + r.billed,
                                          0,
                                        ),
                                      )}
                                    </td>
                                    <td className="ov-mt-tf ov-mt-r ov-mono">
                                      {fmtF(
                                        monthRows.reduce(
                                          (a, r) => a + r.gross,
                                          0,
                                        ),
                                      )}
                                    </td>
                                    <td className="ov-mt-tf ov-mt-r ov-mono ov-val-blue">
                                      {fmtF(
                                        monthRows.reduce(
                                          (a, r) => a + r.net,
                                          0,
                                        ),
                                      )}
                                    </td>
                                    <td className="ov-mt-tf ov-mt-r ov-mono ov-val-green">
                                      {fmtF(
                                        monthRows.reduce(
                                          (a, r) => a + r.paid,
                                          0,
                                        ),
                                      )}
                                    </td>
                                    <td
                                      className={`ov-mt-tf ov-mt-r ov-mono ${
                                        totalPending > 0
                                          ? "ov-val-orange"
                                          : "ov-val-green"
                                      }`}
                                    >
                                      {totalPending > 0.01
                                        ? fmtF(totalPending)
                                        : "✓"}
                                    </td>
                                    <td className="ov-mt-tf" />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* ════════════ TAB: Projects ════════════ */}
                {detailTab === "projects" &&
                  (() => {
                    const allProjects = candidateDetail.projects;
                    // Active first, then closed
                    const sorted = [
                      ...allProjects.filter((p) => p.is_active),
                      ...allProjects.filter((p) => !p.is_active),
                    ];
                    // Auto-select first project if none selected
                    const effectiveId =
                      selectedProjectId ?? sorted[0]?.id ?? null;
                    const selectedProject =
                      sorted.find((p) => p.id === effectiveId) ?? null;

                    if (allProjects.length === 0) {
                      return (
                        <div className="pf-empty">
                          <div className="pf-empty-icon">📋</div>
                          <div className="pf-empty-text">
                            No projects on record for this candidate
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="ppt-projects-layout">
                        {/* ── Project pill sub-tabs ── */}
                        <div className="ppt-pill-bar">
                          {sorted.map((p) => {
                            const isActive = p.is_active;
                            const isSelected = p.id === effectiveId;
                            const title = p.job_title || "Untitled";
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={`ppt-pill ${
                                  isSelected
                                    ? "ppt-pill-active"
                                    : isActive
                                    ? ""
                                    : "ppt-pill-closed"
                                }`}
                                onClick={() => setSelectedProjectId(p.id)}
                              >
                                <span className="ppt-pill-dot" />
                                {title}
                                {!isActive && (
                                  <span style={{ fontSize: 9, opacity: 0.75 }}>
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* ── Selected project pay table ── */}
                        <div className="ppt-projects-content">
                          {selectedProject ? (
                            <ProjectPayTable
                              project={selectedProject}
                              candidateId={
                                candidateDetail.profile?.candidate_id ?? ""
                              }
                              candidateEmail={
                                candidateDetail.roster.candidate_email
                              }
                            />
                          ) : (
                            <div className="pf-empty">
                              <div className="pf-empty-icon">📋</div>
                              <div className="pf-empty-text">
                                Select a project above
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {/* ════════════ TAB: Vendor Activity ════════════ */}
                {detailTab === "vendor-activity" &&
                  (() => {
                    const activities = candidateDetail.vendor_activity;
                    const pokeCount = activities.filter(
                      (v) => !v.is_email,
                    ).length;
                    const emailCount = activities.filter(
                      (v) => v.is_email,
                    ).length;
                    const total = activities.length;

                    // Aggregate by vendor for bar chart
                    const vendorMap: Record<
                      string,
                      { pokes: number; emails: number }
                    > = {};
                    activities.forEach((v) => {
                      const key = v.sender_email;
                      if (!vendorMap[key])
                        vendorMap[key] = { pokes: 0, emails: 0 };
                      if (v.is_email) vendorMap[key].emails++;
                      else vendorMap[key].pokes++;
                    });
                    const vendorEntries = Object.entries(vendorMap).sort(
                      (a, b) =>
                        b[1].pokes + b[1].emails - (a[1].pokes + a[1].emails),
                    );
                    const maxBar = Math.max(
                      ...vendorEntries.map(([, v]) => v.pokes + v.emails),
                      1,
                    );

                    // Pie chart math
                    const pieR = 50;
                    const pieC = 2 * Math.PI * pieR;
                    const pokeArc = total > 0 ? (pokeCount / total) * pieC : 0;
                    const emailArc =
                      total > 0 ? (emailCount / total) * pieC : 0;

                    return (
                      <div>
                        <Toolbar
                          left={
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--w97-titlebar-from)",
                              }}
                            >
                              📊 Vendor Activity
                            </h3>
                          }
                          right={
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--w97-text-secondary)",
                              }}
                            >
                              {total} interactions
                            </span>
                          }
                          style={{ marginBottom: 12 }}
                        />

                        {total === 0 ? (
                          <div
                            className="matchdb-card"
                            style={{
                              padding: 40,
                              textAlign: "center",
                              color: "var(--w97-border-dark)",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>
                              📊
                            </div>
                            No vendor interactions recorded yet
                          </div>
                        ) : (
                          <>
                            {/* ── Charts Row ── */}
                            <div
                              style={{
                                display: "flex",
                                gap: 16,
                                marginBottom: 16,
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Pie Chart */}
                              <div
                                className="matchdb-card"
                                style={{
                                  flex: "0 0 220px",
                                  padding: 20,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--w97-text-secondary)",
                                    marginBottom: 12,
                                  }}
                                >
                                  Pokes vs Emails
                                </div>
                                <svg
                                  width="120"
                                  height="120"
                                  viewBox="0 0 120 120"
                                >
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r={pieR}
                                    fill="none"
                                    stroke="var(--w97-border-light)"
                                    strokeWidth="18"
                                  />
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r={pieR}
                                    fill="none"
                                    stroke="var(--w97-yellow)"
                                    strokeWidth="18"
                                    strokeDasharray={`${pokeArc} ${
                                      pieC - pokeArc
                                    }`}
                                    strokeDashoffset={pieC / 4}
                                    strokeLinecap="round"
                                  />
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r={pieR}
                                    fill="none"
                                    stroke="var(--w97-blue)"
                                    strokeWidth="18"
                                    strokeDasharray={`${emailArc} ${
                                      pieC - emailArc
                                    }`}
                                    strokeDashoffset={pieC / 4 - pokeArc}
                                    strokeLinecap="round"
                                  />
                                  <text
                                    x="60"
                                    y="58"
                                    textAnchor="middle"
                                    fontSize="18"
                                    fontWeight="700"
                                    fill="var(--w97-text)"
                                  >
                                    {total}
                                  </text>
                                  <text
                                    x="60"
                                    y="72"
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="var(--w97-text-secondary)"
                                  >
                                    total
                                  </text>
                                </svg>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 16,
                                    marginTop: 12,
                                    fontSize: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: "var(--w97-yellow)",
                                        display: "inline-block",
                                      }}
                                    />
                                    Pokes ({pokeCount})
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: "var(--w97-blue)",
                                        display: "inline-block",
                                      }}
                                    />
                                    Emails ({emailCount})
                                  </div>
                                </div>
                              </div>

                              {/* Bar Chart: By Vendor */}
                              <div
                                className="matchdb-card"
                                style={{ flex: 1, padding: 20, minWidth: 280 }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--w97-text-secondary)",
                                    marginBottom: 12,
                                  }}
                                >
                                  Interactions by Vendor
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  }}
                                >
                                  {vendorEntries
                                    .slice(0, 8)
                                    .map(([vendor, counts]) => (
                                      <div key={vendor}>
                                        <div
                                          style={{
                                            fontSize: 10,
                                            color: "var(--w97-text-secondary)",
                                            marginBottom: 3,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {vendor}
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            height: 16,
                                          }}
                                        >
                                          <div
                                            style={{
                                              height: 14,
                                              borderRadius: 3,
                                              background:
                                                "linear-gradient(90deg, var(--w97-yellow), #d4a017)",
                                              width: `${
                                                (counts.pokes / maxBar) * 100
                                              }%`,
                                              minWidth:
                                                counts.pokes > 0 ? 4 : 0,
                                              transition: "width 0.3s ease",
                                            }}
                                          />
                                          <div
                                            style={{
                                              height: 14,
                                              borderRadius: 3,
                                              background:
                                                "linear-gradient(90deg, var(--w97-blue), #4ba3ff)",
                                              width: `${
                                                (counts.emails / maxBar) * 100
                                              }%`,
                                              minWidth:
                                                counts.emails > 0 ? 4 : 0,
                                              transition: "width 0.3s ease",
                                            }}
                                          />
                                          <span
                                            style={{
                                              fontSize: 10,
                                              color:
                                                "var(--w97-text-secondary)",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {counts.pokes + counts.emails}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>

                            {/* ── Activity List ── */}
                            <div
                              className="matchdb-card"
                              style={{ padding: 0, overflow: "hidden" }}
                            >
                              <table
                                style={{
                                  width: "100%",
                                  fontSize: 11,
                                  borderCollapse: "collapse",
                                }}
                              >
                                <thead>
                                  <tr
                                    style={{
                                      background: "var(--w97-window-alt)",
                                      borderBottom:
                                        "1px solid var(--w97-border-light)",
                                      textAlign: "left",
                                    }}
                                  >
                                    <th
                                      style={{
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        fontSize: 10,
                                        textTransform: "uppercase",
                                        color: "var(--w97-text-secondary)",
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      Vendor
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        fontSize: 10,
                                        textTransform: "uppercase",
                                        color: "var(--w97-text-secondary)",
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      Type
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        fontSize: 10,
                                        textTransform: "uppercase",
                                        color: "var(--w97-text-secondary)",
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      Subject / Job
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        fontSize: 10,
                                        textTransform: "uppercase",
                                        color: "var(--w97-text-secondary)",
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      Date
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activities.map((v) => (
                                    <tr
                                      key={v.id}
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                      }}
                                    >
                                      <td style={{ padding: "8px 12px" }}>
                                        {v.sender_email}
                                      </td>
                                      <td style={{ padding: "8px 12px" }}>
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "1px 8px",
                                            borderRadius: 10,
                                            fontSize: 10,
                                            fontWeight: 600,
                                            background: v.is_email
                                              ? "#e8f0fe"
                                              : "#fff8e1",
                                            color: v.is_email
                                              ? "var(--w97-blue)"
                                              : "var(--w97-yellow)",
                                          }}
                                        >
                                          {v.is_email ? "Email" : "Poke"}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 12px",
                                          color: "var(--w97-text-secondary)",
                                        }}
                                      >
                                        {v.subject || v.job_title || "—"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 12px",
                                          color: "var(--w97-text-secondary)",
                                        }}
                                      >
                                        {fmtDate(v.created_at)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                {/* ════════════ TAB: Forwarded Openings ════════════ */}
                {detailTab === "forwarded" &&
                  (() => {
                    const fwd = candidateDetail.forwarded_openings;
                    return (
                      <div>
                        <Toolbar
                          left={
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--w97-titlebar-from)",
                              }}
                            >
                              📤 Forwarded Openings
                            </h3>
                          }
                          right={
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--w97-text-secondary)",
                                }}
                              >
                                {fwd.length} sent
                              </span>
                              <Button
                                size="xs"
                                onClick={() =>
                                  openSendJobModal(
                                    candidateDetail.roster.candidate_email,
                                    candidateDetail.roster.candidate_name,
                                  )
                                }
                              >
                                + Send New
                              </Button>
                            </div>
                          }
                          style={{ marginBottom: 12 }}
                        />
                        {fwd.length === 0 ? (
                          <div
                            className="matchdb-card"
                            style={{
                              padding: 40,
                              textAlign: "center",
                              color: "var(--w97-border-dark)",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>
                              📤
                            </div>
                            No openings forwarded to this candidate yet
                          </div>
                        ) : (
                          <div
                            className="matchdb-card"
                            style={{ padding: 0, overflow: "hidden" }}
                          >
                            <table
                              style={{
                                width: "100%",
                                fontSize: 11,
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    background: "var(--w97-window-alt)",
                                    borderBottom:
                                      "1px solid var(--w97-border-light)",
                                    textAlign: "left",
                                  }}
                                >
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Job Title
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Location
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Type
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Sub Type
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Vendor
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Status
                                  </th>
                                  <th
                                    style={{
                                      padding: "8px 12px",
                                      fontWeight: 600,
                                      fontSize: 10,
                                      textTransform: "uppercase",
                                      color: "var(--w97-text-secondary)",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    Sent
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {fwd.map((f) => (
                                  <tr
                                    key={f.id}
                                    style={{
                                      borderBottom:
                                        "1px solid var(--w97-border-light)",
                                    }}
                                  >
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        color: "var(--w97-titlebar-from)",
                                      }}
                                    >
                                      {f.job_title}
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        color: "var(--w97-text-secondary)",
                                      }}
                                    >
                                      {f.job_location || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        color: "var(--w97-text-secondary)",
                                      }}
                                    >
                                      {f.job_type || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        color: "var(--w97-text-secondary)",
                                      }}
                                    >
                                      {f.job_sub_type || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        color: "var(--w97-text-secondary)",
                                      }}
                                    >
                                      {f.vendor_email || "—"}
                                    </td>
                                    <td style={{ padding: "8px 12px" }}>
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "1px 8px",
                                          borderRadius: 10,
                                          fontSize: 10,
                                          fontWeight: 600,
                                          background:
                                            f.status === "accepted"
                                              ? "#e8f5e9"
                                              : f.status === "rejected"
                                              ? "#ffebee"
                                              : "#fff3e0",
                                          color:
                                            f.status === "accepted"
                                              ? "var(--w97-green)"
                                              : f.status === "rejected"
                                              ? "var(--w97-red)"
                                              : "var(--w97-orange)",
                                        }}
                                      >
                                        {f.status || "pending"}
                                      </span>
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px 12px",
                                        color: "var(--w97-text-secondary)",
                                      }}
                                    >
                                      {fmtDate(f.created_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </>
            )}
          </div>
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
                  <Input
                    placeholder="Company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{ flex: 1, maxWidth: 300 }}
                  />
                  <Button variant="primary" onClick={handleRegisterCompany}>
                    Register
                  </Button>
                </div>
              </div>
            )}

            {myCompany && (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  color: "var(--w97-text-secondary)",
                }}
              >
                🏢 <strong>{myCompany.name}</strong> —{" "}
                {myCompany.marketer_email}
              </div>
            )}

            {/* Candidates table */}
            <DataTable<MarketerCandidateItem>
              columns={candidateColumns}
              data={companyCandidates}
              keyExtractor={(c) => c.id}
              loading={false}
              paginate
              pageSize={25}
              titleIcon="🏢"
              title={
                myCompany?.name
                  ? `${myCompany.name} — Candidates`
                  : "Company Candidates"
              }
              titleExtra={
                <Button
                  size="xs"
                  className="matchdb-title-btn"
                  onClick={() => setAddCandModalOpen(true)}
                >
                  + Add Candidate
                </Button>
              }
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

      {/* ── Invite Candidate Modal ── */}
      {inviteModalOpen && inviteTarget && (
        <div
          className="matchdb-modal-overlay"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="matchdb-modal-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, padding: 20 }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>
              ✉ Invite Candidate
            </h3>
            <div
              style={{
                fontSize: 12,
                marginBottom: 8,
                color: "var(--w97-text-secondary)",
              }}
            >
              Send an invite to <strong>{inviteTarget.candidate_name}</strong> (
              {inviteTarget.candidate_email}) to join your company on MatchDB.
            </div>
            <label
              htmlFor="invite-offer-note"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 4,
              }}
            >
              Offer Note (optional):
            </label>
            <textarea
              id="invite-offer-note"
              className="matchdb-input"
              rows={4}
              value={inviteOfferNote}
              onChange={(e) => setInviteOfferNote(e.target.value)}
              placeholder="Add a personal message or offer details…"
              style={{ width: "100%", resize: "vertical", fontSize: 11 }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Button size="sm" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSendInvite}
                disabled={inviteLoading}
                style={{
                  cursor: inviteLoading ? "wait" : "pointer",
                }}
              >
                {inviteLoading ? "Sending…" : "Send Invite"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Candidate Modal (opened from left nav) ── */}
      {addCandModalOpen && (
        <div
          className="matchdb-modal-overlay"
          onClick={() => setAddCandModalOpen(false)}
        >
          <div
            className="matchdb-modal-window"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 620,
              padding: 20,
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14 }}>
                🏢 {myCompany?.name ?? "Company"} — Add Candidate
              </h3>
              <Button
                variant="close"
                size="xs"
                onClick={() => setAddCandModalOpen(false)}
              >
                ✕
              </Button>
            </div>

            {/* Add candidate form */}
            <div
              className="matchdb-card"
              style={{ marginBottom: 14, padding: 10 }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <label style={{ fontSize: 10, fontWeight: 600 }}>
                    Name *
                  </label>
                  <Input
                    placeholder="Candidate name"
                    value={newCandName}
                    onChange={(e) => setNewCandName(e.target.value)}
                    inputWidth={160}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <label style={{ fontSize: 10, fontWeight: 600 }}>
                    Email *
                  </label>
                  <Input
                    placeholder="Candidate email"
                    value={newCandEmail}
                    onChange={(e) => setNewCandEmail(e.target.value)}
                    inputWidth={200}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <label style={{ fontSize: 10, fontWeight: 600 }}>
                    Candidate ID
                  </label>
                  <Input
                    placeholder="Optional"
                    value={newCandId}
                    onChange={(e) => setNewCandId(e.target.value)}
                    inputWidth={140}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={async () => {
                    if (!newCandName.trim() || !newCandEmail.trim()) {
                      alert("Name and Email are required.");
                      return;
                    }
                    await handleAddCandidate();
                    setNewCandId("");
                  }}
                >
                  + Add
                </Button>
              </div>
            </div>

            {/* Current candidate list */}
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              Current Roster ({companyCandidates.length})
            </div>
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--w97-window-alt)",
                      textAlign: "left",
                    }}
                  >
                    <th
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Email
                    </th>
                    <th
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Invite
                    </th>
                    <th
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companyCandidates.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td
                        style={{
                          padding: "3px 8px",
                          color: "var(--w97-text-secondary)",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ padding: "3px 8px" }}>
                        {c.candidate_name || "—"}
                      </td>
                      <td
                        style={{ padding: "3px 8px", color: "var(--w97-blue)" }}
                      >
                        {c.candidate_email}
                      </td>
                      <td style={{ padding: "3px 8px" }}>
                        {c.invite_status === "accepted" ? (
                          <span
                            style={{
                              color: "var(--w97-green)",
                              fontWeight: 600,
                            }}
                          >
                            ✓ Accepted
                          </span>
                        ) : c.invite_status === "invited" ? (
                          <span style={{ color: "var(--w97-yellow)" }}>
                            ⏳ Invited
                          </span>
                        ) : (
                          <span style={{ color: "var(--w97-text-secondary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "3px 8px",
                          color: "var(--w97-text-secondary)",
                        }}
                      >
                        {fmtDate(c.created_at)}
                      </td>
                    </tr>
                  ))}
                  {companyCandidates.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: 12,
                          textAlign: "center",
                          color: "var(--w97-text-secondary)",
                        }}
                      >
                        No candidates yet. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Job Opening via Email Modal ── */}
      {sendJobModalOpen && sendJobCandidate && (
        <div
          className="matchdb-modal-overlay"
          onClick={() => setSendJobModalOpen(false)}
        >
          <div
            className="matchdb-modal-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, padding: 20 }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>
              📧 Send Job Opening to Candidate
            </h3>
            <div
              style={{
                fontSize: 12,
                marginBottom: 10,
                color: "var(--w97-text-secondary)",
              }}
            >
              Send a job opening to{" "}
              <strong>{sendJobCandidate.name || sendJobCandidate.email}</strong>{" "}
              via email.
            </div>
            <label
              htmlFor="send-job-select"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 4,
              }}
            >
              Select Job Opening:
            </label>
            <Select
              id="send-job-select"
              value={sendJobId}
              onChange={(e) => setSendJobId(e.target.value)}
              style={{ width: "100%", fontSize: 11, marginBottom: 10 }}
            >
              <option value="">— Select a job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.location} (
                  {TYPE_LABELS[j.job_type] || j.job_type}
                  {j.job_sub_type
                    ? ` › ${SUB_LABELS[j.job_sub_type] || j.job_sub_type}`
                    : ""}
                  )
                </option>
              ))}
            </Select>
            <label
              htmlFor="send-job-note"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 4,
              }}
            >
              Note (optional):
            </label>
            <textarea
              id="send-job-note"
              className="matchdb-input"
              rows={3}
              value={sendJobNote}
              onChange={(e) => setSendJobNote(e.target.value)}
              placeholder="Add a note (e.g., 'Great match for your skills!')…"
              style={{ width: "100%", resize: "vertical", fontSize: 11 }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Button size="sm" onClick={() => setSendJobModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSendJobEmail}
                disabled={forwardEmailLoading || !sendJobId}
                style={{
                  cursor:
                    forwardEmailLoading || !sendJobId
                      ? "not-allowed"
                      : "pointer",
                  opacity: !sendJobId ? 0.5 : 1,
                }}
              >
                {forwardEmailLoading ? "Sending…" : "Send via Email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DBLayout>
  );
};

export default MarketerDashboard;
