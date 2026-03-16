import { useSearchParams } from "react-router-dom";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import DBLayout, { NavGroup } from "../components/DBLayout";
import {
  DataTable,
  Button,
  Input,
  Select,
  Tabs,
  Toolbar,
  ICONS,
} from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import DetailModal from "../components/DetailModal";
import { getApiErrorMessage } from "../utils";
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
  useGetCompanySummaryQuery,
  type MarketerJob,
  type MarketerProfile,
  type MarketerCandidateItem,
  type ForwardedOpeningItem,
  type CompanySummaryCandidate,
  type CompanySummaryProject,
  useGetMarketerTimesheetsQuery,
  useApproveTimesheetMutation,
  useRejectTimesheetMutation,
  type Timesheet,
} from "../api/jobsApi";
import {
  type MarketerDashboardProps as Props,
  type ActiveView,
  type ReportContext,
  type ImmigrationRecord,
  type ImmigrationDependant,
  type MonthRow,
  fmtDate,
  fmtRate,
  fmtSalary,
  fmtC,
  fmtF,
  TYPE_LABELS,
  SUB_LABELS,
  countColor,
  countBg,
  downloadCSV,
  downloadExcel,
  downloadResumePDF,
  footerRowClass,
  balanceClass,
  balanceLabel,
  settledOrAmount,
  subtabStyle,
  buildImmigrationData,
  buildMonthlyRows,
  getBreadcrumb,
} from "./marketer/marketerHelpers";

// ─── Component ────────────────────────────────────────────────────────────────

const MarketerDashboard: React.FC<Props> = () => {
  // ── URL-driven state — view, sub-filter, selected candidate, and detail tab
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView =
    (searchParams.get("view") as ActiveView) || "company-candidates";
  const subFilter = searchParams.get("filter") || null;
  const selectedCandidateId = searchParams.get("cid") || null;
  const detailTab =
    (searchParams.get("tab") as
      | "overview"
      | "projects"
      | "vendor-activity"
      | "forwarded") || "overview";

  const [jobSearch, setJobSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [overviewSubTab, setOverviewSubTab] = useState<"financial" | "monthly">(
    "financial",
  );
  const [vendorActivitySubTab, setVendorActivitySubTab] =
    useState<string>("summary");

  /** Update multiple URL params atomically in one navigate() call */
  const navParams = (updates: Record<string, string | null>) =>
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) n.delete(k);
          else n.set(k, v);
        }
        return n;
      },
      { replace: true },
    );
  // On mount: stamp ?view=company-candidates if no view param exists yet
  // This ensures the URL always reflects the active view after login.
  useEffect(() => {
    if (!searchParams.get("view")) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("view", "company-candidates");
          return n;
        },
        { replace: true },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  // Track new-entry badge counts from WebSocket-driven flash
  const [newJobsBadge, setNewJobsBadge] = useState(0);
  const [newProfilesBadge, setNewProfilesBadge] = useState(0);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<"job" | "candidate">("job");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [finViewTab, setFinViewTab] = useState<"table" | "chart" | "graph">(
    "table",
  );
  const [kebabOpen, setKebabOpen] = useState<string | null>(null);
  const [prevView, setPrevView] = useState<ActiveView | null>(null);
  const [finSearch, setFinSearch] = useState("");
  const [finStatusFilter, setFinStatusFilter] = useState<
    "all" | "billed" | "unbilled"
  >("all");

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalTarget, setEmailModalTarget] = useState<{
    name: string;
    email: string;
    context: ReportContext;
    data: Record<string, string>;
  } | null>(null);
  const [emailFormat, setEmailFormat] = useState<"pdf" | "excel">("pdf");

  // Download modal state
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadModalTarget, setDownloadModalTarget] = useState<{
    name: string;
    context: ReportContext;
    data: Record<string, string>;
  } | null>(null);

  // Close kebab menu on outside click
  useEffect(() => {
    if (!kebabOpen) return;
    const handler = () => setKebabOpen(null);
    // Delay so the opening click doesn't immediately trigger close
    const timer = setTimeout(
      () => document.addEventListener("click", handler),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [kebabOpen]);

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
  const { data: companySummary, isFetching: summaryLoading } =
    useGetCompanySummaryQuery();
  const {
    data: candidateDetail,
    isFetching: detailLoading,
    isError: detailError,
  } = useGetMarketerCandidateDetailQuery(selectedCandidateId ?? "", {
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

  // ── Immigration state ───────────────────────────────────────────────────────
  const [immigrationSearch, setImmigrationSearch] = useState("");

  // ── Timesheet hooks ─────────────────────────────────────────────────────────
  const [tsStatusFilter, setTsStatusFilter] = useState<string>("submitted");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [tsActionId, setTsActionId] = useState<string | null>(null);
  const [tsActionType, setTsActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const {
    data: marketerTimesheetsData,
    isLoading: timesheetsLoading,
    refetch: refetchTimesheets,
  } = useGetMarketerTimesheetsQuery(
    { status: tsStatusFilter },
    { skip: activeView !== "timesheets" },
  );
  const [approveTimesheet, { isLoading: approvingTs }] =
    useApproveTimesheetMutation();
  const [rejectTimesheet, { isLoading: rejectingTs }] =
    useRejectTimesheetMutation();
  const marketerTimesheets: Timesheet[] = useMemo(
    () => marketerTimesheetsData?.data ?? [],
    [marketerTimesheetsData],
  );

  const jobs: MarketerJob[] = useMemo(
    () => jobsData?.data ?? [],
    [jobsData],
  );
  const profiles: MarketerProfile[] = useMemo(
    () => profilesData?.data ?? [],
    [profilesData],
  );
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
    navParams({ view, filter: null, cid: null, tab: null });
    if (view === "vendor-posted") setNewJobsBadge(0);
    if (view === "candidate-created") setNewProfilesBadge(0);
  };

  // ── Open detail modal ───────────────────────────────────────────────────────

  const openJobDetail = (j: MarketerJob) => {
    setDetailType("job");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDetailData(j as unknown as Record<string, any>);
    setDetailOpen(true);
  };

  const openProfileDetail = (p: MarketerProfile) => {
    setDetailType("candidate");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to register company"));
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
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to add candidate"));
    }
  };

  const handleRemoveCandidate = async (id: string) => {
    if (!globalThis.confirm("Remove this candidate from your company roster?"))
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
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to forward candidate"));
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
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to send invite"));
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
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to send job opening email"));
    }
  };

  // ── Update forwarded opening status handler ─────────────────────────────────

  const handleUpdateForwardedStatus = async (id: string, status: string) => {
    try {
      await updateForwardedStatus({ id, status }).unwrap();
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to update status"));
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
        icon: ICONS.OFFICE,
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
        ],
      },
      {
        label: "Dashboard",
        icon: ICONS.CHART,
        items: [
          {
            id: "financial-summary",
            label: "Finance",
            active: activeView === "financial-summary",
            onClick: () => navigateTo("financial-summary"),
          },
          {
            id: "project-summary",
            label: "Project",
            active: activeView === "project-summary",
            onClick: () => navigateTo("project-summary"),
          },
          {
            id: "job-positions-summary",
            label: "Positions",
            active: activeView === "job-positions-summary",
            onClick: () => navigateTo("job-positions-summary"),
          },
          {
            id: "immigration",
            label: "Immigration",
            active:
              activeView === "immigration" ||
              activeView === "immigration-detail",
            onClick: () => navigateTo("immigration"),
          },
          {
            id: "timesheets",
            label: "Timesheets",
            active: activeView === "timesheets",
            onClick: () => navigateTo("timesheets"),
          },
        ],
      },
      {
        label: "Job Openings",
        icon: ICONS.BRIEFCASE,
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
            onClick: () => navParams({ view: "vendor-posted", filter: "c2c" }),
          },
          {
            id: "sub-jobs-w2",
            label: "W2 Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "w2",
            onClick: () => navParams({ view: "vendor-posted", filter: "w2" }),
          },
          {
            id: "sub-jobs-c2h",
            label: "C2H Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "c2h",
            onClick: () => navParams({ view: "vendor-posted", filter: "c2h" }),
          },
          {
            id: "sub-jobs-ft",
            label: "Full Time Openings",
            depth: 1,
            active: activeView === "vendor-posted" && subFilter === "full_time",
            onClick: () =>
              navParams({ view: "vendor-posted", filter: "full_time" }),
          },
          {
            id: "forwarded-openings",
            label: "Sent Openings",
            count: forwardedOpenings.length,
            depth: 1,
            active: activeView === "forwarded-openings",
            onClick: () => navigateTo("forwarded-openings"),
          },
        ],
      },
      {
        label: "Candidate Profiles",
        icon: ICONS.PERSON,
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
            onClick: () =>
              navParams({ view: "candidate-created", filter: "c2c" }),
          },
          {
            id: "sub-profiles-w2",
            label: "W2 Profiles",
            depth: 1,
            active: activeView === "candidate-created" && subFilter === "w2",
            onClick: () =>
              navParams({ view: "candidate-created", filter: "w2" }),
          },
          {
            id: "sub-profiles-c2h",
            label: "C2H Profiles",
            depth: 1,
            active: activeView === "candidate-created" && subFilter === "c2h",
            onClick: () =>
              navParams({ view: "candidate-created", filter: "c2h" }),
          },
          {
            id: "sub-profiles-ft",
            label: "Full Time Profiles",
            depth: 1,
            active:
              activeView === "candidate-created" && subFilter === "full_time",
            onClick: () =>
              navParams({ view: "candidate-created", filter: "full_time" }),
          },
        ],
      },
      {
        label: "Active Sessions",
        icon: ICONS.GREEN_CIRCLE,
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

  const breadcrumb = getBreadcrumb(
    activeView,
    companyLabel,
    candidateDetail?.roster?.candidate_name,
  );

  // ── Jobs table columns ──────────────────────────────────────────────────────

  const jobColumns = useMemo<DataTableColumn<MarketerJob>[]>(
    () => [
      {
        key: "title",
        header: "Title",
        width: "13%",
        skeletonWidth: 110,
        render: (j) => (
          <button
            type="button"
            style={{
              cursor: "pointer",
              color: "var(--w97-blue)",
              textDecoration: "underline",
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
            }}
            onClick={() => openJobDetail(j)}
            title="Click to view details"
          >
            {j.title}
          </button>
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
          <div className="matchdb-skill-row">
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
          <button
            type="button"
            style={{
              cursor: "pointer",
              color: "var(--w97-blue)",
              textDecoration: "underline",
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
            }}
            onClick={() => openProfileDetail(p)}
            title="Click to view profile"
          >
            {p.name || "—"}
          </button>
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
          <div className="matchdb-skill-row">
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
              setPrevView("company-candidates");
              navParams({
                view: "candidate-detail",
                cid: c.id,
                tab: "overview",
              });
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
          const STATUS_COLORS: Record<string, string> = {
            accepted: "var(--w97-green)",
            invited: "var(--w97-yellow)",
          };
          const STATUS_BGS: Record<string, string> = {
            accepted: "#e8f5e9",
            invited: "#fffde6",
          };
          const STATUS_LABELS: Record<string, string> = {
            accepted: "✓ Accepted",
            invited: "⏳ Invited",
          };
          const color = STATUS_COLORS[s] ?? "var(--w97-text-secondary)";
          const bg = STATUS_BGS[s] ?? "var(--w97-sky)";
          const label = STATUS_LABELS[s] ?? "—";
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
          <div className="matchdb-action-row">
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
      icon: ICONS.PERSON,
      view: "candidate-created" as ActiveView,
    },
    {
      label: "Job Openings",
      value: stats?.total_jobs ?? jobsTotal,
      icon: ICONS.BRIEFCASE,
      view: "vendor-posted" as ActiveView,
    },
    {
      label: "Open Openings",
      value: stats?.total_open_jobs ?? 0,
      icon: ICONS.OPEN_FOLDER,
      view: "vendor-posted" as ActiveView,
    },
    {
      label: "Closed Openings",
      value: stats?.total_closed_jobs ?? 0,
      icon: ICONS.LOCK,
    },
    {
      label: "Candidates Placed",
      value: stats?.total_placed ?? 0,
      icon: ICONS.CHECK_MARK,
    },
  ];

  function renderActiveView() {
    if (activeView === "vendor-posted") return renderVendorPostedView();
    if (activeView === "candidate-created") return renderCandidateCreatedView();
    if (activeView === "candidate-detail" && selectedCandidateId)
      return renderCandidateDetailView();
    if (activeView === "company-candidates")
      return renderCompanyCandidatesView();
    if (activeView === "financial-summary") return renderFinancialSummaryView();
    if (activeView === "project-summary") return renderProjectSummaryView();
    if (activeView === "job-positions-summary")
      return renderJobPositionsSummaryView();
    if (activeView === "immigration") return renderImmigrationView();
    if (activeView === "immigration-detail" && selectedCandidateId)
      return renderImmigrationDetailView();
    if (activeView === "timesheets") return renderTimesheetsView();
    return renderForwardedOpeningsView();
  }

  function renderVendorPostedView() {
    const displayedJobs = subFilter ? filteredJobs : jobs;
    const jobsCountDisplay = jobsLoading
      ? "…"
      : `${displayedJobs.length} / ${jobsTotal}`;
    return (
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
                TYPE_LABELS[subFilter] ?? subFilter.toUpperCase()
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
            <span className="matchdb-title-count">{jobsCountDisplay}</span>
            <Button
              size="xs"
              className="matchdb-title-btn"
              onClick={() => refetchJobs()}
            >
              ↻ Refresh
            </Button>
            {Boolean(jobsFlash.lastSync) && (
              <span className="matchdb-title-sync">
                synced {new Date(jobsFlash.lastSync ?? 0).toLocaleTimeString()}
              </span>
            )}
          </div>
        }
      />
    );
  }

  function renderCandidateCreatedView() {
    const displayedProfiles = subFilter ? filteredProfiles : profiles;
    const profilesCountDisplay = profilesLoading
      ? "…"
      : `${displayedProfiles.length} / ${profilesTotal}`;
    return (
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
                TYPE_LABELS[subFilter] ?? subFilter.toUpperCase()
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
            <span className="matchdb-title-count">{profilesCountDisplay}</span>
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
                {new Date(profilesFlash.lastSync ?? 0).toLocaleTimeString()}
              </span>
            )}
          </div>
        }
      />
    );
  }

  function renderCompanyCandidatesView() {
    return (
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
            🏢 <strong>{myCompany.name}</strong> — {myCompany.marketer_email}
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
    );
  }

  function renderForwardedOpeningsView() {
    return (
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
    );
  }

  // ── Shared Export Helpers ───────────────────────────────────────────────────

  const fmtDollar = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const buildFinCSVRows = (rows: CompanySummaryCandidate[]) => {
    const header = [
      "Candidate",
      "Marketer %",
      "Hours",
      "Vendor Billed",
      "Margin",
      "Gross Pay",
      "Net Pay",
      "Paid",
      "Balance",
    ];
    const body = rows.map((c) => {
      const margin = c.totalBilled - c.totalPay;
      const mPct =
        c.totalBilled > 0 ? ((margin / c.totalBilled) * 100).toFixed(1) : "0";
      return [
        c.candidateName,
        `${mPct}%`,
        String(c.hoursWorked),
        c.totalBilled.toFixed(2),
        margin.toFixed(2),
        c.totalPay.toFixed(2),
        c.netPayable.toFixed(2),
        c.amountPaid.toFixed(2),
        Math.max(0, c.amountPending).toFixed(2),
      ];
    });
    return [header, ...body];
  };

  const buildProjCSVRows = (rows: CompanySummaryProject[]) => {
    const header = [
      "Candidate",
      "Project / Job",
      "Client",
      "Status",
      "Bill Rate",
      "Pay Rate",
      "Hours",
      "Billed",
      "Net Pay",
      "Paid",
      "Balance",
    ];
    const body = rows.map((p) => [
      p.candidateName,
      p.jobTitle || "Untitled",
      p.vendorEmail || "—",
      p.isActive ? "Active" : "Closed",
      p.financials ? `$${p.financials.billRate}` : "—",
      p.financials ? `$${p.financials.payRate}` : "—",
      p.financials ? String(p.financials.hoursWorked) : "0",
      p.financials ? p.financials.totalBilled.toFixed(2) : "0",
      p.financials ? p.financials.netPayable.toFixed(2) : "0",
      p.financials ? p.financials.amountPaid.toFixed(2) : "0",
      p.financials ? Math.max(0, p.financials.amountPending).toFixed(2) : "0",
    ]);
    return [header, ...body];
  };

  const downloadAsFile = (
    rows: string[][],
    filename: string,
    format: "pdf" | "excel",
  ) => {
    if (format === "excel") {
      const tsv = rows.map((r) => r.join("\t")).join("\n");
      const blob = new Blob([tsv], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const contextLabel = (c: ReportContext) => {
    const labels: Record<ReportContext, string> = {
      finance: "Finance",
      project: "Project",
      positions: "Positions",
    };
    return labels[c];
  };

  const handleDownloadAll = (
    context: ReportContext,
    format: "pdf" | "excel",
  ) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    if (context === "finance") {
      downloadAsFile(
        buildFinCSVRows(companySummary?.candidates ?? []),
        `finance-${dateStr}`,
        format,
      );
    } else if (context === "project") {
      downloadAsFile(
        buildProjCSVRows(companySummary?.projects ?? []),
        `projects-${dateStr}`,
        format,
      );
    } else {
      const domains = companySummary?.domainCounts ?? [];
      const header = ["Domain / Role", "Count", "% of Total"];
      const total = domains.reduce((a, d) => a + d.count, 0);
      const body = domains.map((d) => [
        d.domain,
        String(d.count),
        `${total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%`,
      ]);
      downloadAsFile([header, ...body], `positions-${dateStr}`, format);
    }
  };

  const openKebabEmail = (
    name: string,
    email: string,
    context: ReportContext,
    data: Record<string, string>,
  ) => {
    setKebabOpen(null);
    setEmailModalTarget({ name, email, context, data });
    setEmailFormat("pdf");
    setEmailModalOpen(true);
  };

  const openKebabDownload = (
    name: string,
    context: ReportContext,
    data: Record<string, string>,
  ) => {
    setKebabOpen(null);
    setDownloadModalTarget({ name, context, data });
    setDownloadModalOpen(true);
  };

  const handleEmailSend = () => {
    if (!emailModalTarget) return;
    const { name, data, context } = emailModalTarget;
    const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
    const body = [
      `${contextLabel(context)} Report — ${name}`,
      "",
      ...lines,
      "",
      `Format: ${emailFormat.toUpperCase()}`,
      `Generated: ${new Date().toLocaleDateString()}`,
    ].join("%0D%0A");
    const subject = encodeURIComponent(
      `${contextLabel(context)} Report — ${name}`,
    );
    window.open(
      `mailto:${encodeURIComponent(
        emailModalTarget.email,
      )}?subject=${subject}&body=${body}`,
      "_self",
    );
    setEmailModalOpen(false);
    setEmailModalTarget(null);
  };

  const handleDownloadSingle = (format: "pdf" | "excel") => {
    if (!downloadModalTarget) return;
    const { name, data, context } = downloadModalTarget;
    const header = Object.keys(data);
    const row = Object.values(data);
    const safeName = name.replaceAll(/\s+/g, "-");
    downloadAsFile([header, row], `${context}-${safeName}`, format);
    setDownloadModalOpen(false);
    setDownloadModalTarget(null);
  };

  // Build data record helpers
  const buildFinData = (c: CompanySummaryCandidate): Record<string, string> => {
    const margin = c.totalBilled - c.totalPay;
    const mPct =
      c.totalBilled > 0 ? ((margin / c.totalBilled) * 100).toFixed(1) : "0";
    return {
      Candidate: c.candidateName,
      "Marketer %": `${mPct}%`,
      "Total Hours": c.hoursWorked.toLocaleString(),
      "Vendor Billed": fmtDollar(c.totalBilled),
      Margin: fmtDollar(margin),
      "Gross Pay": fmtDollar(c.totalPay),
      "Net Pay": fmtDollar(c.netPayable),
      Paid: fmtDollar(c.amountPaid),
      Balance: fmtDollar(Math.max(0, c.amountPending)),
    };
  };

  const buildProjData = (p: CompanySummaryProject): Record<string, string> => ({
    Candidate: p.candidateName,
    Project: p.jobTitle || "Untitled",
    Client: p.vendorEmail || "—",
    Status: p.isActive ? "Active" : "Closed",
    Billed: p.financials ? fmtDollar(p.financials.totalBilled) : "—",
    "Net Pay": p.financials ? fmtDollar(p.financials.netPayable) : "—",
    Paid: p.financials ? fmtDollar(p.financials.amountPaid) : "—",
    Balance: p.financials
      ? fmtDollar(Math.max(0, p.financials.amountPending))
      : "—",
  });

  // Reusable kebab component render
  const renderKebabMenu = (
    id: string,
    name: string,
    email: string,
    context: ReportContext,
    data: Record<string, string>,
  ) => (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setKebabOpen(kebabOpen === id ? null : id);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: "0 4px",
          color: "var(--w97-text-secondary)",
          opacity: kebabOpen === id ? 1 : 0.4,
        }}
        title="Actions"
      >
        ⋮
      </button>
      {kebabOpen === id && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 100,
            background: "var(--w97-window)",
            border: "1px solid var(--w97-border)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
            minWidth: 160,
            fontSize: 11,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => openKebabEmail(name, email, context, data)}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 11,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            📧 Email Report
          </button>
          <button
            type="button"
            onClick={() => openKebabDownload(name, context, data)}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 11,
              borderTop: "1px solid var(--w97-border-light)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            ⬇ Download
          </button>
        </div>
      )}
    </div>
  );

  // ── Financial Summary View ──────────────────────────────────────────────────

  function renderFinancialSummaryView() {
    const cands = companySummary?.candidates ?? [];
    const totals = companySummary?.totals ?? {
      totalBilled: 0,
      totalPay: 0,
      netPayable: 0,
      amountPaid: 0,
      amountPending: 0,
      hoursWorked: 0,
      taxAmount: 0,
      cashAmount: 0,
    };
    const fmtC = (v: number) =>
      `$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const grandMargin = totals.totalBilled - totals.totalPay;
    const marginPct =
      totals.totalBilled > 0
        ? ((grandMargin / totals.totalBilled) * 100).toFixed(1)
        : "0";
    const paidPct =
      totals.netPayable > 0
        ? ((totals.amountPaid / totals.netPayable) * 100).toFixed(0)
        : "0";
    const paidBarW =
      totals.netPayable > 0
        ? Math.min(100, (totals.amountPaid / totals.netPayable) * 100)
        : 0;

    // bar chart: top candidates by billed
    const topCands = [...cands]
      .filter((c) => c.totalBilled > 0)
      .sort((a, b) => b.totalBilled - a.totalBilled)
      .slice(0, 10);
    const maxBilled = topCands.length ? topCands[0].totalBilled : 1;

    return (
      <div>
        {summaryLoading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              fontSize: 13,
              color: "var(--w97-text-secondary)",
            }}
          >
            Loading financial summary…
          </div>
        )}

        {!summaryLoading && (
          <>
            {/* KPI strip */}
            <div className="ov-kpi-strip" style={{ margin: "0 0 14px" }}>
              <div className="ov-kpi">
                <span className="ov-kpi-label">Total Hours</span>
                <span className="ov-kpi-value ov-kv-blue">
                  {totals.hoursWorked.toLocaleString()}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Vendor Billed</span>
                <span className="ov-kpi-value ov-kv-green">
                  {fmtC(totals.totalBilled)}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Company Margin</span>
                <span className="ov-kpi-value ov-kv-teal">
                  {fmtC(grandMargin)}{" "}
                  <span className="ov-kpi-pct">({marginPct}%)</span>
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Net Payable</span>
                <span className="ov-kpi-value ov-kv-blue">
                  {fmtC(totals.netPayable)}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Paid to Date</span>
                <span className="ov-kpi-value ov-kv-green">
                  {fmtC(totals.amountPaid)}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Outstanding</span>
                <span
                  className={`ov-kpi-value ${
                    totals.amountPending > 0 ? "ov-kv-orange" : "ov-kv-green"
                  }`}
                >
                  {fmtC(Math.max(0, totals.amountPending))}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi" style={{ flex: 1, minWidth: 120 }}>
                <span className="ov-kpi-label">
                  Payment Progress — {paidPct}%
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
                      width: `${paidBarW}%`,
                      background:
                        "linear-gradient(90deg, var(--w97-green), #2dd55b)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* View tabs: Table / Chart / Graph */}
            <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
              {(
                [
                  { key: "table", label: "📊 Table View" },
                  { key: "chart", label: "📈 Chart View" },
                  { key: "graph", label: "📉 Graph View" },
                ] as const
              ).map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFinViewTab(t.key)}
                  style={{
                    padding: "6px 16px",
                    fontSize: 12,
                    fontWeight: finViewTab === t.key ? 700 : 400,
                    background:
                      finViewTab === t.key ? "var(--w97-window)" : "#e6e6e6",
                    border: "1px solid var(--w97-border)",
                    borderBottom:
                      finViewTab === t.key
                        ? "none"
                        : "1px solid var(--w97-border)",
                    borderRadius: (() => {
                      if (i === 0) return "4px 0 0 0";
                      if (i === 2) return "0 4px 0 0";
                      return 0;
                    })(),
                    cursor: "pointer",
                    position: "relative",
                    top: finViewTab === t.key ? 1 : 0,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Table View */}
            {finViewTab === "table" && (
              <DataTable<CompanySummaryCandidate>
                title="Financial Summary — By Candidate"
                titleIcon="💰"
                className="matchdb-auto-height"
                titleExtra={
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <input
                      type="text"
                      placeholder="🔍 Search candidate…"
                      value={finSearch}
                      onChange={(e) => setFinSearch(e.target.value)}
                      style={{
                        padding: "3px 8px",
                        fontSize: 11,
                        border: "1px solid var(--w97-border)",
                        borderRadius: 3,
                        width: 150,
                      }}
                    />
                    <select
                      value={finStatusFilter}
                      onChange={(e) =>
                        setFinStatusFilter(
                          e.target.value as "all" | "billed" | "unbilled",
                        )
                      }
                      style={{
                        padding: "3px 8px",
                        fontSize: 11,
                        border: "1px solid var(--w97-border)",
                        borderRadius: 3,
                      }}
                    >
                      <option value="all">All</option>
                      <option value="billed">Billed</option>
                      <option value="unbilled">Unbilled</option>
                    </select>
                  </div>
                }
                columns={
                  [
                    {
                      key: "name",
                      header: "Candidate",
                      width: "16%",
                      render: (c) => (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              cursor: "pointer",
                              flex: 1,
                              background: "none",
                              border: "none",
                              padding: 0,
                              textAlign: "left",
                            }}
                            onClick={() => {
                              setPrevView("financial-summary");
                              navParams({
                                view: "candidate-detail",
                                cid: c.id,
                                tab: "overview",
                              });
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                color: "var(--w97-blue)",
                                textDecoration: "underline",
                              }}
                            >
                              {c.candidateName}
                            </div>
                          </button>
                          {renderKebabMenu(
                            `fin-${c.id}`,
                            c.candidateName,
                            c.candidateEmail,
                            "finance",
                            buildFinData(c),
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "mktPct",
                      header: "Marketer %",
                      align: "center" as const,
                      render: (c) => {
                        const pct =
                          c.totalBilled > 0
                            ? (
                                ((c.totalBilled - c.totalPay) / c.totalBilled) *
                                100
                              ).toFixed(1)
                            : "0.0";
                        return (
                          <span
                            className="ov-mono"
                            style={{
                              color: "var(--w97-teal)",
                              fontWeight: 600,
                            }}
                          >
                            {pct}%
                          </span>
                        );
                      },
                    },
                    {
                      key: "hours",
                      header: "Hours",
                      align: "right" as const,
                      render: (c) => (
                        <span style={{ fontFamily: "monospace" }}>
                          {c.hoursWorked.toLocaleString()}
                        </span>
                      ),
                    },
                    {
                      key: "billed",
                      header: "Vendor Billed",
                      align: "right" as const,
                      render: (c) => (
                        <span className="ov-mono ov-val-green">
                          {fmtC(c.totalBilled)}
                        </span>
                      ),
                    },
                    {
                      key: "margin",
                      header: "Margin",
                      align: "right" as const,
                      render: (c) => {
                        const m = c.totalBilled - c.totalPay;
                        return (
                          <span className="ov-mono ov-val-teal">{fmtC(m)}</span>
                        );
                      },
                    },
                    {
                      key: "gross",
                      header: "Gross Pay",
                      align: "right" as const,
                      render: (c) => (
                        <span
                          className="ov-mono"
                          style={{ color: "var(--w97-text)" }}
                        >
                          {fmtC(c.totalPay)}
                        </span>
                      ),
                    },
                    {
                      key: "net",
                      header: "Net Pay",
                      align: "right" as const,
                      render: (c) => (
                        <span className="ov-mono ov-val-blue">
                          {fmtC(c.netPayable)}
                        </span>
                      ),
                    },
                    {
                      key: "paid",
                      header: "Paid",
                      align: "right" as const,
                      render: (c) => (
                        <span className="ov-mono ov-val-green">
                          {fmtC(c.amountPaid)}
                        </span>
                      ),
                    },
                    {
                      key: "balance",
                      header: "Balance",
                      align: "right" as const,
                      render: (c) => {
                        const bal = Math.max(0, c.amountPending);
                        return (
                          <span
                            className={`ov-mono ${
                              bal > 0 ? "ov-val-orange" : "ov-val-green"
                            }`}
                          >
                            {fmtC(bal)}
                          </span>
                        );
                      },
                    },
                  ] as DataTableColumn<CompanySummaryCandidate>[]
                }
                data={cands.filter((c) => {
                  const q = finSearch.toLowerCase();
                  const matchesSearch =
                    !q ||
                    c.candidateName.toLowerCase().includes(q) ||
                    c.candidateEmail.toLowerCase().includes(q);
                  const matchesStatus =
                    finStatusFilter === "all" ||
                    (finStatusFilter === "billed"
                      ? c.totalBilled > 0
                      : c.totalBilled === 0);
                  return matchesSearch && matchesStatus;
                })}
                keyExtractor={(c) => c.id}
                showRowNumbers
                paginate
                pageSize={50}
                emptyMessage="No financial data yet. Add financials in candidate detail → Projects tab."
              />
            )}

            {/* Chart View — horizontal bar chart */}
            {finViewTab === "chart" && (
              <div
                style={{
                  background: "var(--w97-window)",
                  border: "1px solid var(--w97-border)",
                  padding: 16,
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: 13 }}>
                  💰 Revenue by Candidate (Top 10)
                </h3>
                {topCands.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--w97-text-secondary)",
                      padding: 20,
                    }}
                  >
                    No financial data available.
                  </div>
                )}
                {topCands.map((c) => {
                  const pct = (c.totalBilled / maxBilled) * 100;
                  const margin = c.totalBilled - c.totalPay;
                  return (
                    <div key={c.id} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {c.candidateName}
                        </span>
                        <span style={{ fontFamily: "monospace" }}>
                          {fmtC(c.totalBilled)}{" "}
                          <span
                            style={{ color: "var(--w97-teal)", fontSize: 10 }}
                          >
                            (margin {fmtC(margin)})
                          </span>
                        </span>
                      </div>
                      <div
                        style={{
                          height: 16,
                          background: "var(--w97-border-light)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, var(--w97-blue), var(--w97-teal))",
                            borderRadius: 3,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Graph View — margin vs billed donut */}
            {finViewTab === "graph" && (
              <div
                style={{
                  background: "var(--w97-window)",
                  border: "1px solid var(--w97-border)",
                  padding: 20,
                  display: "flex",
                  gap: 30,
                  flexWrap: "wrap",
                }}
              >
                {/* Donut: Paid vs Outstanding */}
                <div style={{ textAlign: "center" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 13 }}>
                    Payment Status
                  </h3>
                  <svg width={160} height={160} viewBox="0 0 160 160">
                    <circle
                      cx={80}
                      cy={80}
                      r={60}
                      fill="none"
                      stroke="var(--w97-border-light)"
                      strokeWidth={20}
                    />
                    <circle
                      cx={80}
                      cy={80}
                      r={60}
                      fill="none"
                      stroke="var(--w97-green)"
                      strokeWidth={20}
                      strokeDasharray={`${paidBarW * 3.77} ${
                        377 - paidBarW * 3.77
                      }`}
                      strokeDashoffset={94}
                      strokeLinecap="round"
                    />
                    <text
                      x={80}
                      y={78}
                      textAnchor="middle"
                      fontSize={18}
                      fontWeight={700}
                      fill="var(--w97-text)"
                    >
                      {paidPct}%
                    </text>
                    <text
                      x={80}
                      y={95}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--w97-text-secondary)"
                    >
                      paid
                    </text>
                  </svg>
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    <span className="matchdb-legend-green">■</span> Paid:{" "}
                    {fmtC(totals.amountPaid)} &nbsp;
                    <span style={{ color: "var(--w97-border-light)" }}>
                      ■
                    </span>{" "}
                    Outstanding: {fmtC(Math.max(0, totals.amountPending))}
                  </div>
                </div>

                {/* Donut: Margin vs Pay */}
                <div style={{ textAlign: "center" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 13 }}>
                    Margin vs Pay
                  </h3>
                  {(() => {
                    const marginPctVal =
                      totals.totalBilled > 0
                        ? (grandMargin / totals.totalBilled) * 100
                        : 0;
                    return (
                      <>
                        <svg width={160} height={160} viewBox="0 0 160 160">
                          <circle
                            cx={80}
                            cy={80}
                            r={60}
                            fill="none"
                            stroke="#e0f2f1"
                            strokeWidth={20}
                          />
                          <circle
                            cx={80}
                            cy={80}
                            r={60}
                            fill="none"
                            stroke="var(--w97-teal)"
                            strokeWidth={20}
                            strokeDasharray={`${marginPctVal * 3.77} ${
                              377 - marginPctVal * 3.77
                            }`}
                            strokeDashoffset={94}
                            strokeLinecap="round"
                          />
                          <text
                            x={80}
                            y={78}
                            textAnchor="middle"
                            fontSize={18}
                            fontWeight={700}
                            fill="var(--w97-text)"
                          >
                            {marginPctVal.toFixed(1)}%
                          </text>
                          <text
                            x={80}
                            y={95}
                            textAnchor="middle"
                            fontSize={10}
                            fill="var(--w97-text-secondary)"
                          >
                            margin
                          </text>
                        </svg>
                        <div style={{ fontSize: 11, marginTop: 6 }}>
                          <span className="matchdb-legend-teal">■</span> Margin:{" "}
                          {fmtC(grandMargin)} &nbsp;
                          <span style={{ color: "#e0f2f1" }}>■</span> Pay:{" "}
                          {fmtC(totals.totalPay)}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Summary box */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 200,
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Summary</h3>
                  {[
                    {
                      label: "Total Billed",
                      value: fmtC(totals.totalBilled),
                      color: "var(--w97-green)",
                    },
                    {
                      label: "Total Pay",
                      value: fmtC(totals.totalPay),
                      color: "var(--w97-blue)",
                    },
                    {
                      label: "Company Margin",
                      value: `${fmtC(grandMargin)} (${marginPct}%)`,
                      color: "var(--w97-teal)",
                    },
                    {
                      label: "Tax Amount",
                      value: fmtC(totals.taxAmount),
                      color: "var(--w97-text-secondary)",
                    },
                    {
                      label: "Cash Portion",
                      value: fmtC(totals.cashAmount),
                      color: "var(--w97-text-secondary)",
                    },
                    {
                      label: "Net Payable",
                      value: fmtC(totals.netPayable),
                      color: "var(--w97-blue)",
                    },
                    {
                      label: "Paid",
                      value: fmtC(totals.amountPaid),
                      color: "var(--w97-green)",
                    },
                    {
                      label: "Outstanding",
                      value: fmtC(Math.max(0, totals.amountPending)),
                      color:
                        totals.amountPending > 0
                          ? "var(--w97-orange)"
                          : "var(--w97-green)",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "3px 0",
                        borderBottom: "1px dotted var(--w97-border-light)",
                      }}
                    >
                      <span>{row.label}</span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: row.color,
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Project Summary View ────────────────────────────────────────────────────

  function renderProjectSummaryView() {
    const projects = companySummary?.projects ?? [];
    const fmtC = (v: number) =>
      `$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    const fmtD = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";

    return (
      <div>
        {summaryLoading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              fontSize: 13,
              color: "var(--w97-text-secondary)",
            }}
          >
            Loading project summary…
          </div>
        )}

        {!summaryLoading && (
          <DataTable<CompanySummaryProject>
            title="Project Summary — All Candidates"
            titleIcon="📋"
            className="matchdb-auto-height"
            titleExtra={
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  {projects.length} total ·{" "}
                  {projects.filter((p) => p.isActive).length} active
                </span>
                <Button
                  variant="download"
                  size="xs"
                  onClick={() => handleDownloadAll("project", "pdf")}
                  title="Download as CSV"
                >
                  ⬇ CSV
                </Button>
                <Button
                  variant="download"
                  size="xs"
                  onClick={() => handleDownloadAll("project", "excel")}
                  title="Download as Excel"
                >
                  ⬇ Excel
                </Button>
              </div>
            }
            showRowNumbers
            paginate
            pageSize={25}
            columns={
              [
                {
                  key: "candidate",
                  header: "Candidate",
                  width: "14%",
                  render: (p) => (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <button
                        type="button"
                        style={{
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          padding: 0,
                          textAlign: "left",
                          flex: 1,
                        }}
                        onClick={() => {
                          setPrevView("project-summary");
                          navParams({
                            view: "candidate-detail",
                            cid: p.candidateId,
                            tab: "overview",
                          });
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--w97-blue)",
                            textDecoration: "underline",
                          }}
                        >
                          {p.candidateName}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--w97-text-secondary)",
                          }}
                        >
                          {p.candidateEmail}
                        </div>
                      </button>
                      {renderKebabMenu(
                        `proj-${p.applicationId}`,
                        p.candidateName,
                        p.candidateEmail,
                        "project",
                        buildProjData(p),
                      )}
                    </div>
                  ),
                },
                {
                  key: "job",
                  header: "Project / Job",
                  width: "16%",
                  render: (p) => (
                    <>
                      <div style={{ fontWeight: 600 }}>
                        {p.jobTitle || "Untitled"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--w97-text-secondary)",
                        }}
                      >
                        {p.jobType}
                        {p.jobSubType ? ` · ${p.jobSubType.toUpperCase()}` : ""}
                        {p.financials?.stateCode
                          ? ` · ${p.financials.stateCode}`
                          : ""}
                      </div>
                    </>
                  ),
                },
                {
                  key: "client",
                  header: "Client (Vendor)",
                  width: "14%",
                  render: (p) => (
                    <span style={{ fontSize: 11 }}>{p.vendorEmail || "—"}</span>
                  ),
                },
                {
                  key: "location",
                  header: "Location",
                  width: "10%",
                  render: (p) => (
                    <span style={{ fontSize: 11 }}>{p.location || "—"}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  align: "center" as const,
                  render: (p) => (
                    <span
                      className={`ov-proj-badge ${
                        p.isActive ? "ov-proj-active" : "ov-proj-closed"
                      }`}
                    >
                      {p.isActive ? "● Active" : "✓ Closed"}
                    </span>
                  ),
                },
                {
                  key: "dates",
                  header: "Start — End",
                  width: "12%",
                  render: (p) => (
                    <span style={{ fontSize: 10, fontFamily: "monospace" }}>
                      {fmtD(p.financials?.projectStart ?? null)}
                      {" — "}
                      {fmtD(p.financials?.projectEnd ?? null)}
                    </span>
                  ),
                },
                {
                  key: "rates",
                  header: "Bill / Pay",
                  align: "right" as const,
                  render: (p) =>
                    p.financials ? (
                      <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                        <span style={{ color: "var(--pf-green)" }}>
                          ${p.financials.billRate}
                        </span>
                        {" / "}
                        <span style={{ color: "var(--pf-blue)" }}>
                          ${p.financials.payRate}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--w97-border-dark)" }}>—</span>
                    ),
                },
                {
                  key: "billed",
                  header: "Billed",
                  align: "right" as const,
                  render: (p) => (
                    <span className="ov-mono ov-val-green">
                      {p.financials ? fmtC(p.financials.totalBilled) : "—"}
                    </span>
                  ),
                },
                {
                  key: "net",
                  header: "Net Pay",
                  align: "right" as const,
                  render: (p) => (
                    <span className="ov-mono ov-val-blue">
                      {p.financials ? fmtC(p.financials.netPayable) : "—"}
                    </span>
                  ),
                },
                {
                  key: "paid",
                  header: "Paid",
                  align: "right" as const,
                  render: (p) => (
                    <span className="ov-mono ov-val-green">
                      {p.financials ? fmtC(p.financials.amountPaid) : "—"}
                    </span>
                  ),
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right" as const,
                  render: (p) => {
                    if (!p.financials)
                      return <span className="ov-mono">—</span>;
                    const bal = Math.max(0, p.financials.amountPending);
                    return (
                      <span
                        className={`ov-mono ${
                          bal > 0 ? "ov-val-orange" : "ov-val-green"
                        }`}
                      >
                        {fmtC(bal)}
                      </span>
                    );
                  },
                },
              ] as DataTableColumn<CompanySummaryProject>[]
            }
            data={projects}
            keyExtractor={(p) => p.applicationId}
            emptyMessage="No projects found."
          />
        )}
      </div>
    );
  }

  // ── Job Positions Summary View ──────────────────────────────────────────────

  function renderJobPositionsSummaryView() {
    const domains = companySummary?.domainCounts ?? [];
    const cands = companySummary?.candidates ?? [];
    const totalResources = domains.reduce((a, d) => a + d.count, 0);
    const maxCount = domains.length ? domains[0].count : 1;

    // Group by job type from projects
    const projects = companySummary?.projects ?? [];
    const typeMap: Record<string, number> = {};
    for (const p of projects) {
      const t = p.jobType || "Unknown";
      typeMap[t] = (typeMap[t] || 0) + 1;
    }
    const typeCounts = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Skills distribution from candidates
    const skillMap: Record<string, number> = {};
    for (const c of cands) {
      for (const s of c.skills) {
        skillMap[s] = (skillMap[s] || 0) + 1;
      }
    }
    const topSkills = Object.entries(skillMap)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return (
      <div>
        {summaryLoading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              fontSize: 13,
              color: "var(--w97-text-secondary)",
            }}
          >
            Loading job positions summary…
          </div>
        )}

        {!summaryLoading && (
          <>
            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Button
                variant="download"
                size="xs"
                onClick={() => handleDownloadAll("positions", "pdf")}
                title="Download as CSV"
              >
                ⬇ CSV
              </Button>
              <Button
                variant="download"
                size="xs"
                onClick={() => handleDownloadAll("positions", "excel")}
                title="Download as Excel"
              >
                ⬇ Excel
              </Button>
            </div>

            {/* KPI row */}
            <div className="ov-kpi-strip" style={{ margin: "0 0 14px" }}>
              <div className="ov-kpi">
                <span className="ov-kpi-label">Total Positions</span>
                <span className="ov-kpi-value ov-kv-blue">
                  {totalResources}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Unique Domains</span>
                <span className="ov-kpi-value ov-kv-teal">
                  {domains.length}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Active Projects</span>
                <span className="ov-kpi-value ov-kv-green">
                  {projects.filter((p) => p.isActive).length}
                </span>
              </div>
              <div className="ov-kpi-div" />
              <div className="ov-kpi">
                <span className="ov-kpi-label">Job Types</span>
                <span className="ov-kpi-value ov-kv-blue">
                  {typeCounts.length}
                </span>
              </div>
            </div>

            {/* Two columns: Domain list + Skills */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {/* Resources by Domain / Role */}
              <div
                style={{
                  flex: 2,
                  minWidth: 300,
                  background: "var(--w97-window)",
                  border: "1px solid var(--w97-border)",
                  padding: 14,
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: 13 }}>
                  👥 Resources by Domain / Role
                </h3>
                {domains.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--w97-text-secondary)",
                      padding: 12,
                    }}
                  >
                    No data available.
                  </div>
                )}
                {domains.map((d) => {
                  const pct = (d.count / maxCount) * 100;
                  const domainData: Record<string, string> = {
                    Domain: d.domain,
                    Count: String(d.count),
                    "% of Total": `${((d.count / totalResources) * 100).toFixed(
                      1,
                    )}%`,
                  };
                  return (
                    <div key={d.domain} style={{ marginBottom: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{d.domain}</span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{ fontFamily: "monospace", fontWeight: 600 }}
                          >
                            {d.count}{" "}
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--w97-text-secondary)",
                                fontWeight: 400,
                              }}
                            >
                              ({((d.count / totalResources) * 100).toFixed(0)}%)
                            </span>
                          </span>
                          {renderKebabMenu(
                            `pos-${d.domain}`,
                            d.domain,
                            "",
                            "positions",
                            domainData,
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          height: 14,
                          background: "var(--w97-border-light)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, #1976d2, #42a5f5)",
                            borderRadius: 3,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right column: Job Type breakdown + Top Skills */}
              <div
                style={{
                  flex: 1,
                  minWidth: 220,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {/* Job Type breakdown */}
                <div
                  style={{
                    background: "var(--w97-window)",
                    border: "1px solid var(--w97-border)",
                    padding: 14,
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 13 }}>
                    📊 By Job Type
                  </h3>
                  {typeCounts.map((t) => (
                    <div
                      key={t.type}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        fontSize: 11,
                        borderBottom: "1px dotted var(--w97-border-light)",
                      }}
                    >
                      <span
                        style={{ textTransform: "uppercase", fontWeight: 500 }}
                      >
                        {t.type}
                      </span>
                      <span
                        style={{ fontFamily: "monospace", fontWeight: 600 }}
                      >
                        {t.count}
                      </span>
                    </div>
                  ))}
                  {typeCounts.length === 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--w97-text-secondary)",
                      }}
                    >
                      No data.
                    </div>
                  )}
                </div>

                {/* Top Skills */}
                <div
                  style={{
                    background: "var(--w97-window)",
                    border: "1px solid var(--w97-border)",
                    padding: 14,
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 13 }}>
                    🎯 Top Skills in Roster
                  </h3>
                  <div className="u-flex-wrap u-gap-4">
                    {topSkills.map((s) => (
                      <span
                        key={s.skill}
                        style={{
                          background: "#e8f0fe",
                          color: "var(--w97-blue)",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      >
                        {s.skill}{" "}
                        <span style={{ opacity: 0.7 }}>({s.count})</span>
                      </span>
                    ))}
                    {topSkills.length === 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--w97-text-secondary)",
                        }}
                      >
                        No skills data.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Immigration View ───────────────────────────────────────────────────────

  function renderImmigrationView() {
    const immigrationData = buildImmigrationData(companyCandidates);
    const filtered = immigrationSearch
      ? immigrationData.filter(
          (r) =>
            r.candidateName
              .toLowerCase()
              .includes(immigrationSearch.toLowerCase()) ||
            r.candidateEmail
              .toLowerCase()
              .includes(immigrationSearch.toLowerCase()) ||
            r.immigrationStatus
              .toLowerCase()
              .includes(immigrationSearch.toLowerCase()),
        )
      : immigrationData;

    const columns: DataTableColumn<ImmigrationRecord>[] = [
      {
        key: "candidateName",
        header: "Candidate",
        width: "14%",
        skeletonWidth: 100,
        render: (r) => (
          <button
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
              setPrevView("immigration");
              navParams({
                view: "immigration-detail",
                cid: r.candidateId,
                tab: null,
              });
            }}
          >
            {r.candidateName}
          </button>
        ),
        tooltip: (r) => r.candidateEmail,
      },
      {
        key: "immigrationStatus",
        header: "Immigration Status",
        width: "12%",
        skeletonWidth: 80,
        render: (r) => (
          <span
            className="matchdb-type-pill"
            style={{
              color:
                r.immigrationStatus === "Green Card" ||
                r.immigrationStatus === "US Citizen"
                  ? "var(--w97-green)"
                  : "var(--w97-blue)",
              fontWeight: 600,
            }}
          >
            {r.immigrationStatus}
          </span>
        ),
      },
      {
        key: "joinedDate",
        header: "When Joined",
        width: "10%",
        skeletonWidth: 75,
        render: (r) => <>{fmtDate(r.joinedDate)}</>,
      },
      {
        key: "workAuthorization",
        header: "Current Status",
        width: "12%",
        skeletonWidth: 80,
        render: (r) => {
          let color = "var(--w97-blue)";
          if (
            r.workAuthorization === "Active" ||
            r.workAuthorization === "Valid"
          )
            color = "var(--w97-green)";
          else if (r.workAuthorization === "Expiring Soon")
            color = "var(--w97-orange)";
          return (
            <span style={{ fontSize: 11, fontWeight: 600, color }}>
              {r.workAuthorization}
            </span>
          );
        },
      },
      {
        key: "pendingApplications",
        header: "Pending Applications",
        width: "13%",
        skeletonWidth: 90,
        render: (r) => (
          <span
            style={{
              fontSize: 11,
              color:
                r.pendingApplications === "None" ? "#aaa" : "var(--w97-orange)",
            }}
          >
            {r.pendingApplications}
          </span>
        ),
      },
      {
        key: "dependants",
        header: "Dependants",
        width: "8%",
        skeletonWidth: 50,
        render: (r) => (
          <span
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: r.dependants.length > 0 ? "var(--w97-text)" : "#aaa",
            }}
          >
            {r.dependants.length}
          </span>
        ),
      },
      {
        key: "depPending",
        header: "Dep. Pending Apps",
        width: "13%",
        skeletonWidth: 80,
        render: (r) => {
          const pending = r.dependants.filter(
            (d) => d.pendingApplications !== "None",
          );
          return (
            <span
              style={{
                fontSize: 11,
                color: pending.length > 0 ? "var(--w97-orange)" : "#aaa",
              }}
            >
              {pending.length > 0
                ? pending.map((d) => d.pendingApplications).join(", ")
                : "None"}
            </span>
          );
        },
      },
      {
        key: "depWorkAuth",
        header: "Dep. Work Auth",
        width: "12%",
        skeletonWidth: 80,
        render: (r) => {
          if (r.dependants.length === 0)
            return <span style={{ color: "#aaa", fontSize: 11 }}>—</span>;
          return (
            <span style={{ fontSize: 11 }}>
              {r.dependants.map((d) => d.workAuthorization).join(", ")}
            </span>
          );
        },
      },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Search toolbar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 0 4px",
          }}
        >
          <Input
            placeholder="Search by name, email, or visa status…"
            value={immigrationSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setImmigrationSearch(e.target.value)
            }
            style={{ width: 280, fontSize: 11 }}
          />
          {immigrationSearch && (
            <Button size="sm" onClick={() => setImmigrationSearch("")}>
              Clear
            </Button>
          )}
          <span
            style={{
              fontSize: 11,
              color: "var(--w97-text-secondary)",
              marginLeft: "auto",
            }}
          >
            {filtered.length} candidate{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <DataTable<ImmigrationRecord>
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.candidateId}
          paginate
          emptyMessage="No immigration records found."
          title="Immigration Tracking"
          titleIcon="🛂"
        />
      </div>
    );
  }

  // ── Immigration Detail View ────────────────────────────────────────────────

  function renderImmigrationDetailView() {
    const immigrationData = buildImmigrationData(companyCandidates);
    const record = immigrationData.find(
      (r) => r.candidateId === selectedCandidateId,
    );

    if (!record) {
      return (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--w97-text-secondary)",
            fontSize: 13,
          }}
        >
          Candidate not found.{" "}
          <Button
            size="sm"
            onClick={() => navParams({ view: "immigration", cid: null })}
          >
            ← Back
          </Button>
        </div>
      );
    }

    const statusColor =
      record.immigrationStatus === "Green Card" ||
      record.immigrationStatus === "US Citizen"
        ? "var(--w97-green)"
        : "var(--w97-blue)";
    let authColor = "var(--w97-blue)";
    if (
      record.workAuthorization === "Active" ||
      record.workAuthorization === "Valid"
    )
      authColor = "var(--w97-green)";
    else if (record.workAuthorization === "Expiring Soon")
      authColor = "var(--w97-orange)";

    // Mock visa history timeline
    const joinDate = new Date(record.joinedDate);
    const visaHistory = [
      {
        date: fmtDate(joinDate.toISOString()),
        event: `Joined — Initial ${record.immigrationStatus} approved`,
        status: "completed" as const,
      },
      ...(record.immigrationStatus === "H-1B"
        ? [
            {
              date: fmtDate(
                new Date(joinDate.getTime() + 365 * 24 * 3600000).toISOString(),
              ),
              event: "H-1B Amendment — New worksite",
              status: "completed" as const,
            },
            {
              date: fmtDate(
                new Date(joinDate.getTime() + 730 * 24 * 3600000).toISOString(),
              ),
              event: "PERM Labor Certification filed",
              status: record.pendingApplications.includes("PERM")
                ? ("pending" as const)
                : ("completed" as const),
            },
          ]
        : []),
      ...(record.pendingApplications === "None"
        ? []
        : [
            {
              date: "Present",
              event: record.pendingApplications,
              status: "pending" as const,
            },
          ]),
    ];

    const depColumns: DataTableColumn<ImmigrationDependant>[] = [
      {
        key: "name",
        header: "Name",
        width: "25%",
        skeletonWidth: 80,
        render: (d) => (
          <span style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</span>
        ),
      },
      {
        key: "relationship",
        header: "Relationship",
        width: "18%",
        skeletonWidth: 60,
        render: (d) => <>{d.relationship}</>,
      },
      {
        key: "workAuthorization",
        header: "Work Authorization",
        width: "22%",
        skeletonWidth: 80,
        render: (d) => {
          let color = "var(--w97-orange)";
          if (d.workAuthorization === "H-4 EAD") color = "var(--w97-green)";
          else if (d.workAuthorization === "N/A") color = "#aaa";
          return (
            <span style={{ fontWeight: 600, color, fontSize: 11 }}>
              {d.workAuthorization}
            </span>
          );
        },
      },
      {
        key: "pendingApplications",
        header: "Pending Applications",
        width: "25%",
        skeletonWidth: 80,
        render: (d) => (
          <span
            style={{
              color:
                d.pendingApplications === "None" ? "#aaa" : "var(--w97-orange)",
              fontSize: 11,
            }}
          >
            {d.pendingApplications}
          </span>
        ),
      },
    ];

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 16,
        }}
      >
        {/* Top Bar */}
        <Toolbar
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button
                size="sm"
                onClick={() =>
                  navParams({
                    view: prevView ?? "immigration",
                    cid: null,
                    tab: null,
                  })
                }
              >
                ← Back
              </Button>
              <h2
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--w97-titlebar-from)",
                }}
              >
                🛂 {record.candidateName}
              </h2>
            </div>
          }
          style={{ marginBottom: 0 }}
        />

        {/* Detail Cards Grid */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          {/* Immigration Status Card */}
          <div
            style={{
              background: "var(--w97-window)",
              border: "1px solid var(--w97-border)",
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: "var(--w97-titlebar-from)",
              }}
            >
              📋 Immigration Information
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: "8px 12px",
                fontSize: 12,
              }}
            >
              <span className="matchdb-detail-label">Email:</span>
              <span>{record.candidateEmail}</span>
              <span className="matchdb-detail-label">Visa Type:</span>
              <span style={{ fontWeight: 700, color: statusColor }}>
                {record.immigrationStatus}
              </span>
              <span className="matchdb-detail-label">When Joined:</span>
              <span>{fmtDate(record.joinedDate)}</span>
              <span className="matchdb-detail-label">Work Authorization:</span>
              <span style={{ fontWeight: 700, color: authColor }}>
                {record.workAuthorization}
              </span>
              <span className="matchdb-detail-label">
                Pending Applications:
              </span>
              <span
                style={{
                  color:
                    record.pendingApplications === "None"
                      ? "#aaa"
                      : "var(--w97-orange)",
                  fontWeight: 600,
                }}
              >
                {record.pendingApplications}
              </span>
              <span
                style={{ fontWeight: 600, color: "var(--w97-text-secondary)" }}
              >
                Dependants:
              </span>
              <span>{record.dependants.length}</span>
            </div>
          </div>

          {/* Visa Timeline Card */}
          <div
            style={{
              background: "var(--w97-window)",
              border: "1px solid var(--w97-border)",
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: "var(--w97-titlebar-from)",
              }}
            >
              📅 Visa History
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visaHistory.map((entry) => (
                <div
                  key={`${entry.date}-${entry.event}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      marginTop: 3,
                      flexShrink: 0,
                      background:
                        entry.status === "completed"
                          ? "var(--w97-green)"
                          : "var(--w97-orange)",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.date}</div>
                    <div style={{ color: "var(--w97-text-secondary)" }}>
                      {entry.event}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dependants Table */}
        <div
          style={{
            background: "var(--w97-window)",
            border: "1px solid var(--w97-border)",
            padding: 16,
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              color: "var(--w97-titlebar-from)",
            }}
          >
            👨‍👩‍👧‍👦 Dependants ({record.dependants.length})
          </h3>
          {record.dependants.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--w97-text-secondary)",
                padding: "12px 0",
              }}
            >
              No dependants on record.
            </div>
          ) : (
            <DataTable<ImmigrationDependant>
              columns={depColumns}
              data={record.dependants}
              keyExtractor={(d) => d.name}
              emptyMessage="No dependants."
              title=""
            />
          )}
        </div>
      </div>
    );
  }

  // ── Timesheets View ────────────────────────────────────────────────────────

  function renderTimesheetsView() {
    const fmtWeek = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    };
    const fmtTs = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "—";

    const columns: DataTableColumn<Timesheet>[] = [
      {
        key: "candidate",
        header: "Candidate",
        width: "14%",
        skeletonWidth: 100,
        render: (r) => (
          <span title={r.candidateEmail}>
            {r.candidateName || r.candidateEmail}
          </span>
        ),
        tooltip: (r) => r.candidateEmail,
      },
      {
        key: "week",
        header: "Week",
        width: "12%",
        skeletonWidth: 90,
        render: (r) => fmtWeek(r.weekStart),
      },
      {
        key: "company",
        header: "Company",
        width: "12%",
        skeletonWidth: 90,
        render: (r) => <>{r.companyName || "—"}</>,
      },
      {
        key: "hours",
        header: "Total Hrs",
        width: "8%",
        skeletonWidth: 60,
        render: (r) => <>{Number(r.totalHours).toFixed(1)}</>,
      },
      {
        key: "status",
        header: "Status",
        width: "9%",
        skeletonWidth: 70,
        render: (r) => {
          const colors: Record<string, string> = {
            draft: "#888",
            submitted: "#1565c0",
            approved: "#2e7d32",
            rejected: "#c62828",
          };
          return (
            <span
              className="matchdb-type-pill"
              style={{
                color: colors[r.status] ?? "#555",
                textTransform: "capitalize",
              }}
            >
              {r.status}
            </span>
          );
        },
      },
      {
        key: "submitted",
        header: "Submitted",
        width: "9%",
        skeletonWidth: 70,
        render: (r) => <>{fmtTs(r.submittedAt)}</>,
      },
      {
        key: "approved",
        header: "Approved",
        width: "9%",
        skeletonWidth: 70,
        render: (r) => <>{fmtTs(r.approvedAt)}</>,
      },
      {
        key: "remarks",
        header: "Remarks",
        width: "13%",
        skeletonWidth: 90,
        render: (r) => <>{r.approverNotes || "—"}</>,
        tooltip: (r) => r.approverNotes || "",
      },
      {
        key: "actions",
        header: "Actions",
        width: "14%",
        skeletonWidth: 100,
        render: (r) => {
          if (r.status !== "submitted")
            return <span style={{ color: "#aaa", fontSize: 11 }}>—</span>;
          return (
            <div style={{ display: "flex", gap: 4 }}>
              <Button
                size="sm"
                variant="primary"
                disabled={approvingTs || rejectingTs}
                onClick={() => {
                  setTsActionId(r.id);
                  setTsActionType("approve");
                  setApproveNotes("");
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                disabled={approvingTs || rejectingTs}
                onClick={() => {
                  setTsActionId(r.id);
                  setTsActionType("reject");
                  setRejectNotes("");
                }}
              >
                Reject
              </Button>
            </div>
          );
        },
      },
    ];

    const isConfirmOpen = !!tsActionId && !!tsActionType;

    const handleConfirm = async () => {
      if (!tsActionId || !tsActionType) return;
      if (tsActionType === "approve") {
        await approveTimesheet({ id: tsActionId, notes: approveNotes });
      } else {
        await rejectTimesheet({ id: tsActionId, notes: rejectNotes });
      }
      setTsActionId(null);
      setTsActionType(null);
      setApproveNotes("");
      setRejectNotes("");
      refetchTimesheets();
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Confirm dialog */}
        {isConfirmOpen && (
          <dialog open className="matchdb-modal-overlay">
            <div
              className="rm-backdrop"
              role="none"
              onClick={() => {
                setTsActionId(null);
                setTsActionType(null);
              }}
            />
            <div
              className="matchdb-modal-window"
              style={{ maxWidth: 400, padding: 20 }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>
                {tsActionType === "approve"
                  ? "✅ Approve Timesheet"
                  : "❌ Reject Timesheet"}
              </h3>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--w97-text-secondary)",
                  marginBottom: 10,
                }}
              >
                {tsActionType === "approve"
                  ? "Optionally add a note, then confirm approval."
                  : "Provide a reason for rejection (required for the candidate)."}
              </div>
              <textarea
                className="matchdb-input"
                rows={3}
                placeholder={
                  tsActionType === "approve"
                    ? "Optional note…"
                    : "Reason for rejection…"
                }
                value={tsActionType === "approve" ? approveNotes : rejectNotes}
                onChange={(e) =>
                  tsActionType === "approve"
                    ? setApproveNotes(e.target.value)
                    : setRejectNotes(e.target.value)
                }
                style={{ width: "100%", resize: "vertical", fontSize: 12 }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <Button
                  size="sm"
                  onClick={() => {
                    setTsActionId(null);
                    setTsActionType(null);
                  }}
                  disabled={approvingTs || rejectingTs}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={approvingTs || rejectingTs}
                >
                  {approvingTs || rejectingTs ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </div>
          </dialog>
        )}

        {/* Filter toolbar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 0 4px",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>Status:</span>
          {(["submitted", "approved", "rejected", "all"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={tsStatusFilter === s ? "primary" : undefined}
              onClick={() => setTsStatusFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        <DataTable<Timesheet>
          columns={columns}
          data={marketerTimesheets}
          keyExtractor={(r) => r.id}
          loading={timesheetsLoading}
          paginate
          emptyMessage="No timesheets found for the selected status."
          title="Candidate Timesheets"
          titleIcon="🗂️"
        />
      </div>
    );
  }

  function renderCandidateDetailView() {
    return (
      /* ── Candidate Detail — Tabbed Center Content ── */
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* ── Top Bar: Back + Name + Print ── */}
        <Toolbar
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button
                size="sm"
                onClick={() =>
                  navParams({
                    view: prevView ?? "company-candidates",
                    cid: null,
                    tab: null,
                  })
                }
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
                        candidate_email: candidateDetail.roster.candidate_email,
                        candidate_name: candidateDetail.roster.candidate_name,
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
                  onClick={() => {
                    const p = candidateDetail?.profile;
                    if (!p) return;
                    downloadResumePDF({
                      name: p.name,
                      email: p.email,
                      phone: p.phone,
                      skills: p.skills,
                      experience_years: p.experience_years,
                      current_role: p.current_role,
                      current_company: p.current_company ?? "",
                      location: p.location,
                      resume_summary: p.resume_summary,
                      resume_experience: p.resume_experience,
                      resume_education: p.resume_education,
                      resume_achievements: p.resume_achievements,
                    } as MarketerProfile);
                  }}
                >
                  📥 Resume
                </Button>
              )}
            </div>
          }
          style={{ marginBottom: 12 }}
        />

        {detailLoading && (
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
        )}

        {!detailLoading && candidateDetail && (
          <>
            {/* ── Horizontal Tab Bar ── */}
            <Tabs
              activeKey={detailTab}
              onSelect={(key) => {
                navParams({ tab: key });
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
            {detailTab === "overview" && renderOverviewTab()}

            {/* ════════════ TAB: Projects ════════════ */}
            {detailTab === "projects" && renderProjectsTab()}

            {/* ════════════ TAB: Vendor Activity ════════════ */}
            {detailTab === "vendor-activity" && renderVendorActivityTab()}

            {/* ════════════ TAB: Forwarded Openings ════════════ */}
            {detailTab === "forwarded" && renderForwardedTab()}
          </>
        )}

        {!detailLoading && !candidateDetail && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "var(--w97-text-secondary)",
              fontSize: 13,
            }}
          >
            {detailError
              ? "Error loading candidate details. Please try again."
              : "Candidate not found."}
            <div style={{ marginTop: 12 }}>
              <Button
                size="sm"
                onClick={() =>
                  navParams({
                    view: prevView ?? "company-candidates",
                    cid: null,
                    tab: null,
                  })
                }
              >
                ← Go Back
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderOverviewTab() {
    if (!candidateDetail) return null;
    const allFins = candidateDetail.projects.flatMap((p) =>
      p.financials ? [{ project: p, fin: p.financials }] : [],
    );

    const totalBilled = allFins.reduce((a, x) => a + x.fin.totalBilled, 0);
    const totalMargin = allFins.reduce(
      (a, x) => a + (x.fin.totalBilled - x.fin.totalPay),
      0,
    );
    const totalNet = allFins.reduce((a, x) => a + x.fin.netPayable, 0);
    const totalPaid = allFins.reduce((a, x) => a + x.fin.amountPaid, 0);
    const totalPending = allFins.reduce(
      (a, x) => a + Math.max(0, x.fin.amountPending),
      0,
    );
    const totalHours = allFins.reduce((a, x) => a + x.fin.hoursWorked, 0);

    const monthRows = buildMonthlyRows(allFins);

    const inviteAccepted = candidateDetail.roster.invite_status === "accepted";
    const inviteBadgeBg = inviteAccepted ? "#e8f5e9" : "#fff3e0";
    const inviteBadgeColor = inviteAccepted ? "#2e7d32" : "#b8860b";
    const inviteBadgeText = inviteAccepted ? "✓ Accepted" : "⏳ Pending";
    const pendingClass = totalPending > 0 ? "ov-kv-orange" : "ov-kv-green";
    const payPct =
      totalNet > 0 ? ((totalPaid / totalNet) * 100).toFixed(0) : "0";
    const payBarWidth =
      totalNet > 0 ? Math.min(100, (totalPaid / totalNet) * 100) : 0;

    function renderProfileStrip() {
      if (!candidateDetail) return null;
      return (
        <div
          style={{
            borderBottom: "1px solid var(--w97-border)",
            background: "var(--w97-panel-bg, #f4f4f4)",
          }}
        >
          {/* Main info row */}
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
                { v: candidateDetail.profile?.current_role, bold: true },
                { v: candidateDetail.profile?.current_company },
                { v: candidateDetail.profile?.location },
                {
                  v: candidateDetail.profile?.expected_hourly_rate
                    ? `$${candidateDetail.profile.expected_hourly_rate}/hr`
                    : null,
                },
                {
                  v:
                    candidateDetail.profile?.experience_years == null
                      ? null
                      : `${candidateDetail.profile.experience_years} yrs`,
                },
                { v: candidateDetail.profile?.phone },
                { v: candidateDetail.roster.candidate_email },
              ] as { v: string | null | undefined; bold?: boolean }[]
            )
              .filter((x) => x.v)
              .map((x, i, arr) => (
                <React.Fragment key={String(x.v)}>
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
                style={{
                  padding: "2px 7px",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  background: inviteBadgeBg,
                  color: inviteBadgeColor,
                  whiteSpace: "nowrap",
                }}
              >
                {inviteBadgeText}
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {candidateDetail.projects.filter((p) => p.is_active).length}{" "}
                active
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {candidateDetail.vendor_activity.length} interactions
              </span>
              <span
                className="matchdb-type-pill"
                style={{ whiteSpace: "nowrap" }}
              >
                {candidateDetail.forwarded_openings.length} forwarded
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--w97-text-secondary)",
                  whiteSpace: "nowrap",
                  paddingLeft: 4,
                }}
              >
                Rostered {fmtDate(candidateDetail.roster.created_at)}
              </span>
            </div>
          </div>
          {/* Skills row */}
          {(candidateDetail.profile?.skills || []).length > 0 && (
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
              {(candidateDetail.profile?.skills ?? []).map((s) => (
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
      );
    }

    return (
      <div className="ov-root">
        {renderProfileStrip()}

        {/* ══ ROW 2 — Modern financial KPI strip (only when financials exist) ══ */}
        {allFins.length > 0 && (
          <div className="ov-kpi-strip" style={{ margin: "14px 16px 0" }}>
            <div className="ov-kpi">
              <span className="ov-kpi-label">Total Hours</span>
              <span className="ov-kpi-value ov-kv-blue">
                {totalHours.toLocaleString()}
              </span>
            </div>
            <div className="ov-kpi-div" />
            <div className="ov-kpi">
              <span className="ov-kpi-label">Vendor Billed</span>
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
                    ({((totalMargin / totalBilled) * 100).toFixed(1)}
                    %)
                  </span>
                )}
              </span>
            </div>
            <div className="ov-kpi-div" />
            <div className="ov-kpi">
              <span className="ov-kpi-label">Net Payable</span>
              <span className="ov-kpi-value ov-kv-blue">{fmtC(totalNet)}</span>
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
              <span className={`ov-kpi-value ${pendingClass}`}>
                {fmtC(totalPending)}
              </span>
            </div>
            <div className="ov-kpi-div" />
            {/* Inline progress bar in the KPI strip */}
            <div className="ov-kpi" style={{ flex: 1, minWidth: 120 }}>
              <span className="ov-kpi-label">
                Payment Progress — {payPct}% paid
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
                    width: `${payBarWidth}%`,
                    background:
                      "linear-gradient(90deg, var(--w97-green), #2dd55b)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══ ROW 3 — Subtabs: Financial Summary / Monthly Pay ══ */}
        {(candidateDetail.projects.length > 0 || monthRows.length > 0) && (
          <div style={{ margin: "14px 16px 16px" }}>
            {/* Subtab bar */}
            <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
              <button
                type="button"
                onClick={() => setOverviewSubTab("financial")}
                style={subtabStyle(overviewSubTab === "financial")}
              >
                💼 Financial Summary
              </button>
              <button
                type="button"
                onClick={() => setOverviewSubTab("monthly")}
                style={subtabStyle(overviewSubTab === "monthly", false)}
              >
                📅 Monthly Pay Summary
              </button>
            </div>

            {/* Financial Summary subtab */}
            {overviewSubTab === "financial" &&
              candidateDetail.projects.length > 0 && (
                <DataTable
                  title="Projects — Financial Summary"
                  titleIcon="💼"
                  className="matchdb-auto-height"
                  titleExtra={
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      {candidateDetail.projects.length} total ·{" "}
                      {
                        candidateDetail.projects.filter((p) => p.is_active)
                          .length
                      }{" "}
                      active
                    </span>
                  }
                  showRowNumbers={false}
                  columns={
                    [
                      {
                        key: "project",
                        header: "Project / Role",
                        width: "22%",
                        render: (p) => (
                          <>
                            <div style={{ fontWeight: 600 }}>
                              {p.job_title || "Untitled"}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--w97-text-secondary)",
                                marginTop: 1,
                              }}
                            >
                              {p.job_type}
                              {p.job_sub_type
                                ? ` · ${p.job_sub_type.toUpperCase()}`
                                : ""}
                              {p.vendor_email
                                ? ` · ${
                                    p.vendor_email
                                      .split("@")[1]
                                      ?.split(".")[0] || p.vendor_email
                                  }`
                                : ""}
                            </div>
                          </>
                        ),
                      },
                      {
                        key: "status",
                        header: "Status",
                        align: "right",
                        render: (p) => (
                          <span
                            className={`ov-proj-badge ${
                              p.is_active ? "ov-proj-active" : "ov-proj-closed"
                            }`}
                          >
                            {p.is_active ? "● Active" : "✓ Closed"}
                          </span>
                        ),
                      },
                      {
                        key: "rates",
                        header: "Bill / Pay Rate",
                        align: "right",
                        render: (p) => {
                          const f = p.financials;
                          return f ? (
                            <span
                              style={{ fontFamily: "monospace", fontSize: 11 }}
                            >
                              <span style={{ color: "var(--pf-green)" }}>
                                ${f.billRate}
                              </span>
                              {" / "}
                              <span style={{ color: "var(--pf-blue)" }}>
                                ${f.payRate}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--w97-border-dark)" }}>
                              Not set
                            </span>
                          );
                        },
                      },
                      {
                        key: "hours",
                        header: "Hours",
                        align: "right",
                        render: (p) => (
                          <span style={{ fontFamily: "monospace" }}>
                            {p.financials
                              ? p.financials.hoursWorked.toLocaleString()
                              : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "billed",
                        header: "Vendor Billed",
                        align: "right",
                        render: (p) => (
                          <span className="ov-mono ov-val-green">
                            {p.financials
                              ? fmtC(p.financials.totalBilled)
                              : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "margin",
                        header: "Your Margin",
                        align: "right",
                        render: (p) => {
                          const f = p.financials;
                          if (!f) return "—";
                          const m = f.totalBilled - f.totalPay;
                          return (
                            <span className="ov-mono ov-val-teal">
                              {fmtC(m)}{" "}
                              <span style={{ fontSize: 10, opacity: 0.7 }}>
                                {f.totalBilled > 0
                                  ? `(${((m / f.totalBilled) * 100).toFixed(
                                      1,
                                    )}%)`
                                  : ""}
                              </span>
                            </span>
                          );
                        },
                      },
                      {
                        key: "net",
                        header: "Net Pay",
                        align: "right",
                        render: (p) => (
                          <span className="ov-mono ov-val-blue">
                            {p.financials ? fmtC(p.financials.netPayable) : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "paid",
                        header: "Paid",
                        align: "right",
                        render: (p) => (
                          <span className="ov-mono ov-val-green">
                            {p.financials ? fmtC(p.financials.amountPaid) : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "balance",
                        header: "Balance",
                        align: "right",
                        render: (p) => {
                          if (!p.financials)
                            return <span className="ov-mono">—</span>;
                          const bal = Math.max(0, p.financials.amountPending);
                          return (
                            <span
                              className={`ov-mono ${
                                bal > 0 ? "ov-val-orange" : "ov-val-green"
                              }`}
                            >
                              {bal <= 0 ? "✓ Settled" : fmtC(bal)}
                            </span>
                          );
                        },
                      },
                    ] as DataTableColumn<
                      (typeof candidateDetail.projects)[number]
                    >[]
                  }
                  data={[
                    ...candidateDetail.projects.filter((p) => p.is_active),
                    ...candidateDetail.projects.filter((p) => !p.is_active),
                  ]}
                  keyExtractor={(p) => String(p.id)}
                  emptyMessage="No projects found."
                  footerRow={
                    allFins.length > 1 ? (
                      <tr
                        className={`ov-pt-foot ${footerRowClass(totalMargin)}`}
                      >
                        <td className="ov-pt-tf" colSpan={2}>
                          TOTAL — {allFins.length} projects with financials
                        </td>
                        <td
                          className="ov-pt-tf"
                          style={{ textAlign: "right" }}
                        />
                        <td
                          className="ov-pt-tf ov-mono"
                          style={{ textAlign: "right" }}
                        >
                          {totalHours.toLocaleString()}
                        </td>
                        <td
                          className="ov-pt-tf ov-mono ov-val-green"
                          style={{ textAlign: "right" }}
                        >
                          {fmtC(totalBilled)}
                        </td>
                        <td
                          className="ov-pt-tf ov-mono ov-val-teal"
                          style={{ textAlign: "right" }}
                        >
                          {fmtC(totalMargin)}
                        </td>
                        <td
                          className="ov-pt-tf ov-mono ov-val-blue"
                          style={{ textAlign: "right" }}
                        >
                          {fmtC(totalNet)}
                        </td>
                        <td
                          className="ov-pt-tf ov-mono ov-val-green"
                          style={{ textAlign: "right" }}
                        >
                          {fmtC(totalPaid)}
                        </td>
                        <td
                          className={`ov-pt-tf ov-mono ${
                            totalPending > 0 ? "ov-val-orange" : "ov-val-green"
                          }`}
                          style={{ textAlign: "right" }}
                        >
                          {totalPending > 0 ? fmtC(totalPending) : "✓ Settled"}
                        </td>
                      </tr>
                    ) : undefined
                  }
                />
              )}

            {/* Monthly Pay Summary subtab */}
            {overviewSubTab === "monthly" && monthRows.length > 0 && (
              <DataTable
                title="Monthly Pay Summary — All Projects Combined"
                titleIcon="📅"
                className="matchdb-auto-height"
                titleExtra={
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {monthRows.length} months
                  </span>
                }
                showRowNumbers={false}
                columns={
                  [
                    {
                      key: "month",
                      header: "Month",
                      width: "14%",
                      render: (row) => (
                        <span style={{ fontWeight: 600 }}>{row.label}</span>
                      ),
                    },
                    {
                      key: "hours",
                      header: "Hours",
                      align: "right",
                      render: (row) => (
                        <span style={{ fontFamily: "monospace" }}>
                          {row.hours.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      ),
                    },
                    {
                      key: "billed",
                      header: "Vendor Billed",
                      align: "right",
                      render: (row) => (
                        <span className="ov-mono ov-val-green">
                          {fmtF(row.billed)}
                        </span>
                      ),
                    },
                    {
                      key: "gross",
                      header: "Gross Pay",
                      align: "right",
                      render: (row) => (
                        <span style={{ fontFamily: "monospace" }}>
                          {fmtF(row.gross)}
                        </span>
                      ),
                    },
                    {
                      key: "net",
                      header: "Net Pay",
                      align: "right",
                      render: (row) => (
                        <span className="ov-mono ov-val-blue">
                          {fmtF(row.net)}
                        </span>
                      ),
                    },
                    {
                      key: "paid",
                      header: "Paid",
                      align: "right",
                      render: (row) => (
                        <span className="ov-mono ov-val-green">
                          {row.paid > 0 ? fmtF(row.paid) : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "balance",
                      header: "Balance",
                      align: "right",
                      render: (row) => (
                        <span
                          className={`ov-mono ${balanceClass(row.balance)}`}
                        >
                          {balanceLabel(row.balance, fmtF)}
                        </span>
                      ),
                    },
                    {
                      key: "progress",
                      header: "Pay Progress",
                      align: "right",
                      width: 130,
                      render: (row) => {
                        const pct =
                          row.net > 0
                            ? Math.min(100, (row.paid / row.net) * 100)
                            : 0;
                        return (
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
                        );
                      },
                    },
                  ] as DataTableColumn<MonthRow>[]
                }
                data={monthRows}
                keyExtractor={(row) => row.label}
                emptyMessage="No monthly data."
                footerRow={
                  <tr className={`ov-mt-foot ${footerRowClass(totalMargin)}`}>
                    <td className="ov-mt-tf">TOTAL</td>
                    <td
                      className="ov-mt-tf ov-mono"
                      style={{ textAlign: "right" }}
                    >
                      {monthRows
                        .reduce((a, r) => a + r.hours, 0)
                        .toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                    </td>
                    <td
                      className="ov-mt-tf ov-mono ov-val-green"
                      style={{ textAlign: "right" }}
                    >
                      {fmtF(monthRows.reduce((a, r) => a + r.billed, 0))}
                    </td>
                    <td
                      className="ov-mt-tf ov-mono"
                      style={{ textAlign: "right" }}
                    >
                      {fmtF(monthRows.reduce((a, r) => a + r.gross, 0))}
                    </td>
                    <td
                      className="ov-mt-tf ov-mono ov-val-blue"
                      style={{ textAlign: "right" }}
                    >
                      {fmtF(monthRows.reduce((a, r) => a + r.net, 0))}
                    </td>
                    <td
                      className="ov-mt-tf ov-mono ov-val-green"
                      style={{ textAlign: "right" }}
                    >
                      {fmtF(monthRows.reduce((a, r) => a + r.paid, 0))}
                    </td>
                    <td
                      className={`ov-mt-tf ov-mono ${
                        totalPending > 0 ? "ov-val-orange" : "ov-val-green"
                      }`}
                      style={{ textAlign: "right" }}
                    >
                      {totalPending > 0.01 ? fmtF(totalPending) : "✓"}
                    </td>
                    <td className="ov-mt-tf" />
                  </tr>
                }
              />
            )}
          </div>
        )}
      </div>
    );
  }

  function renderProjectsTab() {
    if (!candidateDetail) return null;
    const allProjects = candidateDetail.projects;
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

    // Active first, then closed
    const sorted = [
      ...allProjects.filter((p) => p.is_active),
      ...allProjects.filter((p) => !p.is_active),
    ];

    // Auto-select first project if none selected
    const hasSelected =
      selectedProjectId && sorted.some((p) => p.id === selectedProjectId);
    const activeProjectId = hasSelected
      ? selectedProjectId
      : sorted[0]?.id ?? null;

    const activeProject = sorted.find((p) => p.id === activeProjectId);

    // Month names & variation factors for period generation
    const MN = [
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
    ];
    const VAR = [1, 0.92, 1.08, 1.02, 0.94, 1.06, 1, 0.92, 1.08, 1, 0.94, 1.04];

    // Build pay rows for the selected project
    interface CombinedRow {
      key: string;
      payPeriod: string;
      sortKey: number;
      projectName: string;
      projectId: string;
      isActive: boolean;
      hours: number;
      billRate: number;
      payRate: number;
      billed: number;
      grossPay: number;
      stateTax: number;
      stateTaxPct: number;
      withholding: number;
      cashPct: number;
      netPay: number;
      paid: number;
      balance: number;
    }

    const buildRows = (proj: (typeof sorted)[number]): CombinedRow[] => {
      const fin = proj.financials;
      const bRate = fin?.billRate ?? 0;
      const pRate = fin?.payRate ?? 0;
      const sTaxPct = fin?.stateTaxPct ?? 0;
      const cPct = fin?.cashPct ?? 0;

      const now = new Date();
      const start = fin?.projectStart
        ? new Date(fin.projectStart)
        : new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const rawH =
        fin?.hoursWorked && fin.hoursWorked > 0 ? fin.hoursWorked / 12 : 80;

      const periods = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        return {
          label: `${MN[d.getMonth()]} ${d.getFullYear()}`,
          sortKey: d.getTime(),
          hours: Math.round(rawH * VAR[i] * 2) / 2,
          amountPaid: 0,
        };
      });

      if (fin?.hoursWorked && fin.hoursWorked > 0) {
        const sumH = periods.reduce((a, p) => a + p.hours, 0);
        const scale = fin.hoursWorked / sumH;
        periods.forEach((p) => {
          p.hours = Math.round(p.hours * scale * 2) / 2;
        });
        const diff = fin.hoursWorked - periods.reduce((a, p) => a + p.hours, 0);
        if (Math.abs(diff) > 0)
          periods[11].hours = Math.round((periods[11].hours + diff) * 2) / 2;
      }

      if (fin?.amountPaid && fin.amountPaid > 0) {
        const sumH = periods.reduce((a, p) => a + p.hours, 0);
        let allocated = 0;
        periods.forEach((p, i) => {
          if (i < 11) {
            const share =
              Math.round((p.hours / sumH) * fin.amountPaid * 100) / 100;
            p.amountPaid = share;
            allocated += share;
          } else {
            p.amountPaid = Math.round((fin.amountPaid - allocated) * 100) / 100;
          }
        });
      }

      const rows: CombinedRow[] = [];
      periods.forEach((period) => {
        const billed = bRate * period.hours;
        const gross = pRate * period.hours;
        const tax = (gross * sTaxPct) / 100;
        const withhold = (gross * cPct) / 100;
        const net = gross - tax - withhold;
        const bal = net - period.amountPaid;
        rows.push({
          key: `${proj.id}-${period.label}`,
          payPeriod: period.label,
          sortKey: period.sortKey,
          projectName: proj.job_title || "Untitled",
          projectId: proj.id,
          isActive: proj.is_active,
          hours: period.hours,
          billRate: bRate,
          payRate: pRate,
          billed,
          grossPay: gross,
          stateTax: tax,
          stateTaxPct: sTaxPct,
          withholding: withhold,
          cashPct: cPct,
          netPay: net,
          paid: period.amountPaid,
          balance: bal,
        });
      });
      rows.sort((a, b) => a.sortKey - b.sortKey);
      return rows;
    };

    const combinedRows = activeProject ? buildRows(activeProject) : [];

    const totals = combinedRows.reduce(
      (acc, r) => ({
        hours: acc.hours + r.hours,
        billed: acc.billed + r.billed,
        grossPay: acc.grossPay + r.grossPay,
        stateTax: acc.stateTax + r.stateTax,
        withholding: acc.withholding + r.withholding,
        netPay: acc.netPay + r.netPay,
        paid: acc.paid + r.paid,
        balance: acc.balance + r.balance,
      }),
      {
        hours: 0,
        billed: 0,
        grossPay: 0,
        stateTax: 0,
        withholding: 0,
        netPay: 0,
        paid: 0,
        balance: 0,
      },
    );

    const taxDisplay = totals.stateTax > 0 ? `−${fmtF(totals.stateTax)}` : "—";
    const withholdDisplay =
      totals.withholding > 0 ? `−${fmtF(totals.withholding)}` : "—";
    const balanceDisplayCls =
      totals.balance > 0.01 ? "ov-val-orange" : "ov-val-green";

    return (
      <div>
        {/* ── Candidate + Project Info Line ── */}
        {activeProject && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 16,
              padding: "8px 14px",
              margin: "0 0 4px",
              fontSize: 11.5,
              color: "var(--w97-text-secondary)",
              background: "var(--w97-window-alt)",
              borderBottom: "1px solid var(--w97-btn-shadow)",
            }}
          >
            <span>
              👤{" "}
              <strong style={{ color: "var(--w97-text)" }}>
                {candidateDetail.roster.candidate_name}
              </strong>
              {" · "}
              {candidateDetail.roster.candidate_email}
            </span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>
              💼{" "}
              <strong style={{ color: "var(--w97-titlebar-from)" }}>
                {activeProject.job_title || "Untitled"}
              </strong>
              {" · "}
              {activeProject.job_type}
              {activeProject.job_sub_type
                ? ` · ${activeProject.job_sub_type.toUpperCase()}`
                : ""}
              {activeProject.vendor_email
                ? ` · ${
                    activeProject.vendor_email.split("@")[1]?.split(".")[0] ||
                    activeProject.vendor_email
                  }`
                : ""}
            </span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span
              className={
                activeProject.is_active ? "ov-proj-active" : "ov-proj-closed"
              }
              style={{
                padding: "1px 8px",
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {activeProject.is_active ? "● Active" : "✓ Closed"}
            </span>
            {activeProject.financials && (
              <>
                <span style={{ opacity: 0.4 }}>|</span>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                  Bill{" "}
                  <span style={{ color: "var(--pf-green)" }}>
                    ${activeProject.financials.billRate}
                  </span>
                  {" / "}Pay{" "}
                  <span style={{ color: "var(--pf-blue)" }}>
                    ${activeProject.financials.payRate}
                  </span>
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Project Tabs ── */}
        <div style={{ display: "flex", gap: 0, margin: "0 14px" }}>
          {sorted.map((proj) => (
            <button
              key={proj.id}
              type="button"
              onClick={() => setSelectedProjectId(proj.id)}
              style={{
                ...subtabStyle(proj.id === activeProjectId, proj === sorted[0]),
                fontSize: 11,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {proj.is_active ? "● " : ""}
              {proj.job_title || "Untitled"}
            </button>
          ))}
        </div>

        {/* ── Pay Periods DataTable for selected project ── */}
        <DataTable
          title={`${activeProject?.job_title || "Project"} — Pay Periods`}
          titleIcon="💼"
          className="matchdb-auto-height"
          titleExtra={
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              {combinedRows.length} periods
            </span>
          }
          showRowNumbers={false}
          columns={
            [
              {
                key: "payPeriod",
                header: "Pay Period",
                width: "14%",
                render: (r) => (
                  <span style={{ fontWeight: 600 }}>{r.payPeriod}</span>
                ),
              },
              {
                key: "hours",
                header: "Hours",
                align: "right" as const,
                render: (r) => (
                  <span style={{ fontFamily: "monospace" }}>{r.hours}</span>
                ),
              },
              {
                key: "billed",
                header: "Billed",
                align: "right" as const,
                render: (r) => (
                  <span className="ov-mono ov-val-green">{fmtF(r.billed)}</span>
                ),
              },
              {
                key: "grossPay",
                header: "Gross Pay",
                align: "right" as const,
                render: (r) => (
                  <span style={{ fontFamily: "monospace" }}>
                    {fmtF(r.grossPay)}
                  </span>
                ),
              },
              {
                key: "stateTax",
                header: "State Tax",
                align: "right" as const,
                render: (r) => (
                  <span className="ov-mono" style={{ color: "var(--w97-red)" }}>
                    {r.stateTax > 0 ? `−${fmtF(r.stateTax)}` : "—"}
                  </span>
                ),
              },
              {
                key: "withholding",
                header: "Withholding",
                align: "right" as const,
                render: (r) => (
                  <span className="ov-mono" style={{ color: "var(--w97-red)" }}>
                    {r.withholding > 0 ? `−${fmtF(r.withholding)}` : "—"}
                  </span>
                ),
              },
              {
                key: "netPay",
                header: "Net Pay",
                align: "right" as const,
                render: (r) => (
                  <span className="ov-mono ov-val-blue">{fmtF(r.netPay)}</span>
                ),
              },
              {
                key: "paid",
                header: "Paid",
                align: "right" as const,
                render: (r) => (
                  <span
                    className={`ov-mono ${r.paid > 0 ? "ov-val-green" : ""}`}
                  >
                    {r.paid > 0 ? fmtF(r.paid) : "—"}
                  </span>
                ),
              },
              {
                key: "balance",
                header: "Balance",
                align: "right" as const,
                render: (r) => (
                  <span className={`ov-mono ${balanceClass(r.balance)}`}>
                    {balanceLabel(r.balance, fmtF)}
                  </span>
                ),
              },
            ] as DataTableColumn<CombinedRow>[]
          }
          data={combinedRows}
          keyExtractor={(r) => r.key}
          emptyMessage="No pay period data."
          footerRow={
            combinedRows.length > 0 ? (
              <tr
                className={`ov-pt-foot ${footerRowClass(
                  totals.billed - totals.grossPay,
                )}`}
              >
                <td className="ov-pt-tf" style={{ fontWeight: 700 }}>
                  TOTAL
                </td>
                <td className="ov-pt-tf ov-mono" style={{ textAlign: "right" }}>
                  {totals.hours.toLocaleString()}
                </td>
                <td
                  className="ov-pt-tf ov-mono ov-val-green"
                  style={{ textAlign: "right" }}
                >
                  {fmtF(totals.billed)}
                </td>
                <td className="ov-pt-tf ov-mono" style={{ textAlign: "right" }}>
                  {fmtF(totals.grossPay)}
                </td>
                <td
                  className="ov-pt-tf ov-mono"
                  style={{ textAlign: "right", color: "var(--w97-red)" }}
                >
                  {taxDisplay}
                </td>
                <td
                  className="ov-pt-tf ov-mono"
                  style={{ textAlign: "right", color: "var(--w97-red)" }}
                >
                  {withholdDisplay}
                </td>
                <td
                  className="ov-pt-tf ov-mono ov-val-blue"
                  style={{ textAlign: "right" }}
                >
                  {fmtF(totals.netPay)}
                </td>
                <td
                  className="ov-pt-tf ov-mono ov-val-green"
                  style={{ textAlign: "right" }}
                >
                  {fmtF(totals.paid)}
                </td>
                <td
                  className={`ov-pt-tf ov-mono ${balanceDisplayCls}`}
                  style={{ textAlign: "right" }}
                >
                  {settledOrAmount(totals.balance, fmtF)}
                </td>
              </tr>
            ) : undefined
          }
        />
      </div>
    );
  }

  function renderVendorActivityTab() {
    if (!candidateDetail) return null;
    const activities = candidateDetail.vendor_activity;
    const pokeCount = activities.filter((v) => !v.is_email).length;
    const emailCount = activities.filter((v) => v.is_email).length;
    const total = activities.length;

    // Aggregate by vendor for bar chart
    const vendorMap: Record<string, { pokes: number; emails: number }> = {};
    activities.forEach((v) => {
      const key = v.sender_email;
      if (!vendorMap[key]) vendorMap[key] = { pokes: 0, emails: 0 };
      if (v.is_email) vendorMap[key].emails++;
      else vendorMap[key].pokes++;
    });
    const vendorEntries = Object.entries(vendorMap).sort(
      (a, b) => b[1].pokes + b[1].emails - (a[1].pokes + a[1].emails),
    );
    const maxBar = Math.max(
      ...vendorEntries.map(([, v]) => v.pokes + v.emails),
      1,
    );

    // Pie chart math
    const pieR = 50;
    const pieC = 2 * Math.PI * pieR;
    const pokeArc = total > 0 ? (pokeCount / total) * pieC : 0;
    const emailArc = total > 0 ? (emailCount / total) * pieC : 0;

    // Year-based subtabs
    const joinDate = candidateDetail.roster.created_at
      ? new Date(candidateDetail.roster.created_at)
      : null;
    const startYear = joinDate
      ? joinDate.getFullYear()
      : new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    const yearTabs: string[] = [];
    for (let y = startYear; y <= currentYear; y++) yearTabs.push(String(y));

    // Filter activities by selected year
    const filteredActivities =
      vendorActivitySubTab === "summary"
        ? activities
        : activities.filter((v) => {
            const d = new Date(v.created_at);
            return String(d.getFullYear()) === vendorActivitySubTab;
          });

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
          style={{ marginBottom: 8 }}
        />

        {total === 0 && (
          <div
            className="matchdb-card"
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--w97-border-dark)",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            No vendor interactions recorded yet
          </div>
        )}
        {total > 0 && (
          <>
            {/* ── Subtab Bar ── */}
            <div style={{ display: "flex", gap: 0, margin: "0 0 0 14px" }}>
              <button
                type="button"
                onClick={() => setVendorActivitySubTab("summary")}
                style={subtabStyle(vendorActivitySubTab === "summary")}
              >
                📊 Summary
              </button>
              {yearTabs.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setVendorActivitySubTab(yr)}
                  style={subtabStyle(vendorActivitySubTab === yr, false)}
                >
                  📅 {yr}
                </button>
              ))}
            </div>

            {/* ── Summary subtab: Charts ── */}
            {vendorActivitySubTab === "summary" && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginBottom: 16,
                  marginTop: 12,
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
                  <svg width="120" height="120" viewBox="0 0 120 120">
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
                      strokeDasharray={`${pokeArc} ${pieC - pokeArc}`}
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
                      strokeDasharray={`${emailArc} ${pieC - emailArc}`}
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
                    {vendorEntries.slice(0, 8).map(([vendor, counts]) => (
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
                              width: `${(counts.pokes / maxBar) * 100}%`,
                              minWidth: counts.pokes > 0 ? 4 : 0,
                              transition: "width 0.3s ease",
                            }}
                          />
                          <div
                            style={{
                              height: 14,
                              borderRadius: 3,
                              background:
                                "linear-gradient(90deg, var(--w97-blue), #4ba3ff)",
                              width: `${(counts.emails / maxBar) * 100}%`,
                              minWidth: counts.emails > 0 ? 4 : 0,
                              transition: "width 0.3s ease",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--w97-text-secondary)",
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
            )}

            {/* ── Activity List (shown for both summary and year tabs) ── */}
            <DataTable
              title={
                vendorActivitySubTab === "summary"
                  ? "All Vendor Activity"
                  : `Vendor Activity — ${vendorActivitySubTab}`
              }
              titleIcon="📋"
              showRowNumbers={false}
              titleExtra={
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  {filteredActivities.length} interaction
                  {filteredActivities.length === 1 ? "" : "s"}
                </span>
              }
              columns={
                [
                  {
                    key: "vendor",
                    header: "Vendor",
                    width: "30%",
                    render: (v) => <>{v.sender_email}</>,
                  },
                  {
                    key: "type",
                    header: "Type",
                    width: "8%",
                    render: (v) => (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 600,
                          background: v.is_email ? "#e8f0fe" : "#fff8e1",
                          color: v.is_email
                            ? "var(--w97-blue)"
                            : "var(--w97-yellow)",
                        }}
                      >
                        {v.is_email ? "Email" : "Poke"}
                      </span>
                    ),
                  },
                  {
                    key: "subject",
                    header: "Subject / Job",
                    render: (v) => (
                      <span style={{ color: "var(--w97-text-secondary)" }}>
                        {v.subject || v.job_title || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "date",
                    header: "Date",
                    render: (v) => (
                      <span style={{ color: "var(--w97-text-secondary)" }}>
                        {fmtDate(v.created_at)}
                      </span>
                    ),
                  },
                ] as DataTableColumn<(typeof activities)[number]>[]
              }
              data={filteredActivities}
              keyExtractor={(v) => String(v.id)}
              emptyMessage={
                vendorActivitySubTab === "summary"
                  ? "No vendor activity."
                  : `No vendor activity in ${vendorActivitySubTab}.`
              }
              paginate
              pageSize={25}
            />
          </>
        )}
      </div>
    );
  }

  function renderForwardedTab() {
    if (!candidateDetail) return null;
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
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            No openings forwarded to this candidate yet
          </div>
        ) : (
          <DataTable
            title="Forwarded Openings"
            titleIcon="📤"
            showRowNumbers={false}
            columns={
              [
                {
                  key: "title",
                  header: "Job Title",
                  width: "20%",
                  render: (f) => (
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--w97-titlebar-from)",
                      }}
                    >
                      {f.job_title}
                    </span>
                  ),
                },
                {
                  key: "location",
                  header: "Location",
                  width: "14%",
                  render: (f) => (
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {f.job_location || "—"}
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (f) => (
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {f.job_type || "—"}
                    </span>
                  ),
                },
                {
                  key: "subType",
                  header: "Sub Type",
                  render: (f) => (
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {f.job_sub_type || "—"}
                    </span>
                  ),
                },
                {
                  key: "vendor",
                  header: "Vendor",
                  render: (f) => (
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {f.vendor_email || "—"}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (f) => (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 8px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        background:
                          { accepted: "#e8f5e9", rejected: "#ffebee" }[
                            f.status
                          ] ?? "#fff3e0",
                        color:
                          {
                            accepted: "var(--w97-green)",
                            rejected: "var(--w97-red)",
                          }[f.status] ?? "var(--w97-orange)",
                      }}
                    >
                      {f.status || "pending"}
                    </span>
                  ),
                },
                {
                  key: "sent",
                  header: "Sent",
                  render: (f) => (
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {fmtDate(f.created_at)}
                    </span>
                  ),
                },
              ] as DataTableColumn<(typeof fwd)[number]>[]
            }
            data={fwd}
            keyExtractor={(f) => String(f.id)}
            emptyMessage="No forwarded openings."
            paginate
            pageSize={25}
          />
        )}
      </div>
    );
  }
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

        {renderActiveView()}
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
        <dialog open className="matchdb-modal-overlay">
          <div
            className="rm-backdrop"
            role="none"
            onClick={() => setInviteModalOpen(false)}
          />
          <div
            className="matchdb-modal-window"
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
        </dialog>
      )}

      {/* ── Add Candidate Modal (opened from left nav) ── */}
      {addCandModalOpen && (
        <dialog open className="matchdb-modal-overlay">
          <div
            className="rm-backdrop"
            role="none"
            onClick={() => setAddCandModalOpen(false)}
          />
          <div
            className="matchdb-modal-window"
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
                  <label
                    htmlFor="add-cand-name"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Name *
                  </label>
                  <Input
                    id="add-cand-name"
                    placeholder="Candidate name"
                    value={newCandName}
                    onChange={(e) => setNewCandName(e.target.value)}
                    inputWidth={160}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <label
                    htmlFor="add-cand-email"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Email *
                  </label>
                  <Input
                    id="add-cand-email"
                    placeholder="Candidate email"
                    value={newCandEmail}
                    onChange={(e) => setNewCandEmail(e.target.value)}
                    inputWidth={200}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <label
                    htmlFor="add-cand-id"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Candidate ID
                  </label>
                  <Input
                    id="add-cand-id"
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
            <DataTable
              title={`Current Roster`}
              titleIcon="👥"
              showRowNumbers
              columns={
                [
                  {
                    key: "name",
                    header: "Name",
                    render: (c) => <>{c.candidate_name || "—"}</>,
                  },
                  {
                    key: "email",
                    header: "Email",
                    render: (c) => (
                      <span style={{ color: "var(--w97-blue)" }}>
                        {c.candidate_email}
                      </span>
                    ),
                  },
                  {
                    key: "invite",
                    header: "Invite",
                    render: (c) => {
                      const cfg: Record<
                        string,
                        { color: string; label: string }
                      > = {
                        accepted: {
                          color: "var(--w97-green)",
                          label: "✓ Accepted",
                        },
                        invited: {
                          color: "var(--w97-yellow)",
                          label: "⏳ Invited",
                        },
                      };
                      const m = cfg[c.invite_status ?? ""];
                      return m ? (
                        <span
                          style={{
                            color: m.color,
                            fontWeight: m.label.startsWith("✓")
                              ? 600
                              : undefined,
                          }}
                        >
                          {m.label}
                        </span>
                      ) : (
                        <span style={{ color: "var(--w97-text-secondary)" }}>
                          —
                        </span>
                      );
                    },
                  },
                  {
                    key: "added",
                    header: "Added",
                    render: (c) => (
                      <span style={{ color: "var(--w97-text-secondary)" }}>
                        {fmtDate(c.created_at)}
                      </span>
                    ),
                  },
                ] as DataTableColumn<(typeof companyCandidates)[number]>[]
              }
              data={companyCandidates}
              keyExtractor={(c) => String(c.id)}
              emptyMessage="No candidates yet. Add one above."
            />
          </div>
        </dialog>
      )}

      {/* ── Send Job Opening via Email Modal ── */}
      {sendJobModalOpen && sendJobCandidate && (
        <dialog open className="matchdb-modal-overlay">
          <div
            className="rm-backdrop"
            role="none"
            onClick={() => setSendJobModalOpen(false)}
          />
          <div
            className="matchdb-modal-window"
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
                  opacity: sendJobId ? 1 : 0.5,
                }}
              >
                {forwardEmailLoading ? "Sending…" : "Send via Email"}
              </Button>
            </div>
          </div>
        </dialog>
      )}

      {/* ── Email Report Modal ── */}
      {emailModalOpen && emailModalTarget && (
        <dialog open className="matchdb-modal-overlay">
          <button
            type="button"
            className="rm-backdrop"
            aria-label="Close modal"
            tabIndex={-1}
            onClick={() => {
              setEmailModalOpen(false);
              setEmailModalTarget(null);
            }}
          />
          <div
            className="matchdb-modal-window"
            style={{ maxWidth: 420, width: "90%" }}
          >
            <div className="matchdb-modal-header">
              <span>
                📧 Email {contextLabel(emailModalTarget.context)} Report
              </span>
              <button
                type="button"
                className="matchdb-modal-close"
                onClick={() => {
                  setEmailModalOpen(false);
                  setEmailModalTarget(null);
                }}
              >
                ✕
              </button>
            </div>
            <div
              className="matchdb-modal-body"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Target info */}
              <div
                style={{
                  background: "var(--w97-bg)",
                  border: "1px solid var(--w97-border-light)",
                  borderRadius: 4,
                  padding: "10px 14px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {emailModalTarget.name}
                </div>
                {emailModalTarget.email && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--w97-text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {emailModalTarget.email}
                  </div>
                )}
              </div>

              {/* Data preview */}
              <div
                style={{
                  background: "var(--w97-bg)",
                  border: "1px solid var(--w97-border-light)",
                  borderRadius: 4,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--w97-text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Report Data Preview
                </div>
                {Object.entries(emailModalTarget.data).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      padding: "2px 0",
                      borderBottom: "1px dotted var(--w97-border-light)",
                    }}
                  >
                    <span style={{ color: "var(--w97-text-secondary)" }}>
                      {k}
                    </span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Format dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  htmlFor="email-format-select"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Attachment Format:
                </label>
                <select
                  id="email-format-select"
                  value={emailFormat}
                  onChange={(e) =>
                    setEmailFormat(e.target.value as "pdf" | "excel")
                  }
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: 11,
                    border: "1px solid var(--w97-border)",
                    borderRadius: 4,
                    background: "var(--w97-window)",
                  }}
                >
                  <option value="pdf">📄 PDF / CSV</option>
                  <option value="excel">📊 Excel</option>
                </select>
              </div>
            </div>
            <div
              className="matchdb-modal-footer"
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <Button
                size="sm"
                onClick={() => {
                  setEmailModalOpen(false);
                  setEmailModalTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleEmailSend}>
                📧 Email Candidate
              </Button>
            </div>
          </div>
        </dialog>
      )}

      {/* ── Download Report Modal ── */}
      {downloadModalOpen && downloadModalTarget && (
        <dialog open className="matchdb-modal-overlay">
          <button
            type="button"
            className="rm-backdrop"
            aria-label="Close modal"
            tabIndex={-1}
            onClick={() => {
              setDownloadModalOpen(false);
              setDownloadModalTarget(null);
            }}
          />
          <div
            className="matchdb-modal-window"
            style={{ maxWidth: 340, width: "90%" }}
          >
            <div className="matchdb-modal-header">
              <span>⬇ Download Report</span>
              <button
                type="button"
                className="matchdb-modal-close"
                onClick={() => {
                  setDownloadModalOpen(false);
                  setDownloadModalTarget(null);
                }}
              >
                ✕
              </button>
            </div>
            <div
              className="matchdb-modal-body"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ fontSize: 12 }}>
                Download <strong>{downloadModalTarget.name}</strong>{" "}
                {downloadModalTarget.context} report as:
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={() => handleDownloadSingle("pdf")}
                >
                  📄 PDF / CSV
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={() => handleDownloadSingle("excel")}
                >
                  📊 Excel
                </Button>
              </div>
            </div>
            <div
              className="matchdb-modal-footer"
              style={{ display: "flex", justifyContent: "flex-end" }}
            >
              <Button
                size="sm"
                onClick={() => {
                  setDownloadModalOpen(false);
                  setDownloadModalTarget(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </DBLayout>
  );
};

export default MarketerDashboard;
