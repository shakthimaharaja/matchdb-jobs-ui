import React, { useState } from "react";
import { Button, Input, Select } from "matchdb-component-library";
import "./DetailModal.css";

export interface SendToCandidateOption {
  candidate_email: string;
  candidate_name: string;
}

export interface ForwardableJob {
  id: string;
  title: string;
  vendor_email: string;
}

type DetailData = Record<string, unknown>;

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  type: "job" | "candidate";
  data: Record<string, unknown> | null;
  matchPercentage?: number;
  /** Company roster candidates (for job modals — pick candidate to forward) */
  companyCandidates?: SendToCandidateOption[];
  /** Active job list (for candidate modals — pick job to forward candidate to) */
  forwardableJobs?: ForwardableJob[];
  /** Called when forwarding from job modal: (candidateEmail, jobId, note) */
  onForwardToCandidate?: (
    candidateEmail: string,
    jobId: string,
    note: string,
  ) => void;
  /** Called when forwarding from candidate modal: (candidateEmail, jobId, note) */
  onForwardCandidateToJob?: (
    candidateEmail: string,
    jobId: string,
    note: string,
  ) => void;
  forwardLoading?: boolean;
}

const toPlainString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => toPlainString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length ? items.join(", ") : undefined;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return undefined;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toPlainString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const fmtList = (arr: string[]) => (arr.length ? arr.join(", ") : "—");

const fmtVal = (value: unknown) => toPlainString(value) ?? "—";

const formatMoney = (value: unknown, suffix = "") => {
  const amount = toPlainString(value);
  return amount ? `$${amount}${suffix}` : "—";
};

const formatSalaryRange = (minValue: unknown, maxValue: unknown) => {
  const min = toPlainString(minValue);
  const max = toPlainString(maxValue);
  if (!min && !max) return "—";
  return `$${min ?? "?"} – $${max ?? "?"}`;
};

const formatYears = (value: unknown) => `${toPlainString(value) ?? "0"} yrs`;

function openPdfPreview(
  type: "job" | "candidate",
  data: DetailData,
  matchPercentage?: number,
) {
  const isCandidate = type === "candidate";
  const candidateName = toPlainString(data.name) ?? "";
  const jobTitle = toPlainString(data.title) ?? "";
  const title = isCandidate
    ? `Candidate Profile – ${candidateName}`
    : `Job Details – ${jobTitle}`;
  const matchRows: Array<[string, string]> =
    matchPercentage === undefined ? [] : [["Match %", `${matchPercentage}%`]];

  const rows: Array<[string, string]> = isCandidate
    ? [
        ["Name", fmtVal(data.name)],
        ["Email", fmtVal(data.email)],
        ["Phone", fmtVal(data.phone)],
        ["Location", fmtVal(data.location)],
        ["Current Role", fmtVal(data.current_role)],
        ["Current Company", fmtVal(data.current_company)],
        ["Experience", formatYears(data.experience_years)],
        ["Preferred Type", fmtVal(data.preferred_job_type)],
        ["Expected Rate", formatMoney(data.expected_hourly_rate, "/hr")],
        ["Skills", fmtList(toStringList(data.skills))],
        ["Summary", fmtVal(data.resume_summary)],
        ["Experience Detail", fmtVal(data.resume_experience)],
        ["Education", fmtVal(data.resume_education)],
        ["Achievements", fmtVal(data.resume_achievements)],
        ["Bio", fmtVal(data.bio)],
        ...matchRows,
      ]
    : [
        ["Title", fmtVal(data.title)],
        ["Description", fmtVal(data.description)],
        ["Location", fmtVal(data.location)],
        ["Job Type", fmtVal(data.job_type)],
        ["Sub Type", fmtVal(data.job_sub_type)],
        ["Work Mode", fmtVal(data.work_mode)],
        ["Pay/Hr", formatMoney(data.pay_per_hour)],
        ["Salary Range", formatSalaryRange(data.salary_min, data.salary_max)],
        ["Experience Required", formatYears(data.experience_required)],
        ["Skills Required", fmtList(toStringList(data.skills_required))],
        ["Recruiter", fmtVal(data.recruiter_name)],
        ["Recruiter Phone", fmtVal(data.recruiter_phone)],
        ["Vendor Email", fmtVal(data.vendor_email)],
        ...matchRows,
      ];

  const tableRows = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="font-weight:bold;padding:5px 10px;border:1px solid #ccc;background:#f5f5f5;width:180px;vertical-align:top;">${label}</td>
      <td style="padding:5px 10px;border:1px solid #ccc;white-space:pre-wrap;">${value}</td>
    </tr>`,
    )
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html>
<head><title>${title}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
h1 { font-size: 16px; color: #235a81; border-bottom: 2px solid #235a81; padding-bottom: 6px; }
table { border-collapse: collapse; width: 100%; }
@media print { button { display: none; } }
</style>
</head>
<body>
<h1>${title}</h1>
<table>${tableRows}</table>
<br/>
<button onclick="window.print()" style="padding:6px 14px;background:#235a81;color:#fff;border:none;cursor:pointer;font-size:12px;">Print / Save as PDF</button>
</body></html>`;
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  globalThis.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const DetailModal: React.FC<DetailModalProps> = ({
  open,
  onClose,
  type,
  data,
  matchPercentage,
  companyCandidates,
  forwardableJobs,
  onForwardToCandidate,
  onForwardCandidateToJob,
  forwardLoading,
}) => {
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [forwardNote, setForwardNote] = useState("");

  if (!open || !data) return null;

  const isJobType = type === "job";
  const isCandidate = type === "candidate";
  const detailData = data as DetailData;
  const candidateOptions = companyCandidates ?? [];
  const jobOptions = forwardableJobs ?? [];
  const dataId = toPlainString(detailData.id);
  const candidateEmail = toPlainString(detailData.email);
  const hasCandidates = candidateOptions.length > 0;
  const hasJobs = jobOptions.length > 0;

  // Job modal: forward a company candidate to this job's vendor
  const canForwardCandidate = Boolean(isJobType && onForwardToCandidate);
  // Candidate modal: forward this candidate to a job/vendor (only if candidate is in company roster)
  const isInRoster = Boolean(
    isCandidate &&
      candidateEmail &&
      candidateOptions.some((c) => c.candidate_email === candidateEmail),
  );
  const canForwardToJob = Boolean(
    isCandidate && onForwardCandidateToJob && isInRoster,
  );

  const handleForwardCandidate = () => {
    if (!selectedCandidate || !dataId) return;
    onForwardToCandidate?.(selectedCandidate, dataId, forwardNote);
    closeSendPanel();
  };

  const handleForwardToJob = () => {
    if (!selectedJob || !candidateEmail) return;
    onForwardCandidateToJob?.(candidateEmail, selectedJob, forwardNote);
    closeSendPanel();
  };

  const closeSendPanel = () => {
    setShowSendPanel(false);
    setSelectedCandidate("");
    setSelectedJob("");
    setForwardNote("");
  };

  let matchTier = "low";
  if (matchPercentage !== undefined) {
    if (matchPercentage >= 75) matchTier = "high";
    else if (matchPercentage >= 45) matchTier = "mid";
  }

  function renderCandidateBody() {
    const skills = toStringList(detailData.skills);
    const resumeSummary = toPlainString(detailData.resume_summary);
    const resumeExperience = toPlainString(detailData.resume_experience);
    const resumeEducation = toPlainString(detailData.resume_education);
    const resumeAchievements = toPlainString(detailData.resume_achievements);
    const bio = toPlainString(detailData.bio);

    return (
      <>
        <section className="detail-section">
          <h3>Personal Info</h3>
          <div className="detail-grid">
            <Row label="Name" value={toPlainString(detailData.name)} />
            <Row label="Email" value={candidateEmail} />
            <Row label="Phone" value={toPlainString(detailData.phone)} />
            <Row label="Location" value={toPlainString(detailData.location)} />
          </div>
        </section>
        <section className="detail-section">
          <h3>Professional Details</h3>
          <div className="detail-grid">
            <Row
              label="Current Role"
              value={toPlainString(detailData.current_role)}
            />
            <Row
              label="Company"
              value={toPlainString(detailData.current_company)}
            />
            <Row
              label="Experience"
              value={formatYears(detailData.experience_years)}
            />
            <Row
              label="Preferred Type"
              value={toPlainString(detailData.preferred_job_type)}
            />
            <Row
              label="Expected Rate"
              value={formatMoney(detailData.expected_hourly_rate, "/hr")}
            />
          </div>
        </section>
        {skills.length > 0 && (
          <section className="detail-section">
            <h3>Extracted Skills</h3>
            <div className="detail-tags">
              {skills.map((skill) => (
                <span key={skill} className="detail-tag">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
        {(resumeSummary ||
          resumeExperience ||
          resumeEducation ||
          resumeAchievements) && (
          <section className="detail-section">
            <h3>Resume</h3>
            {resumeSummary && <Block label="Summary" value={resumeSummary} />}
            {resumeExperience && (
              <Block label="Work Experience" value={resumeExperience} />
            )}
            {resumeEducation && (
              <Block label="Education" value={resumeEducation} />
            )}
            {resumeAchievements && (
              <Block
                label="Certifications & Achievements"
                value={resumeAchievements}
              />
            )}
          </section>
        )}
        {bio && (
          <section className="detail-section">
            <h3>Bio</h3>
            <p className="detail-text">{bio}</p>
          </section>
        )}
      </>
    );
  }

  function renderJobBody() {
    const jobTitle = toPlainString(detailData.title) ?? "Job Details";
    const description = toPlainString(detailData.description);
    const skillsRequired = toStringList(detailData.skills_required);

    return (
      <>
        <section className="detail-section">
          <h3>{jobTitle}</h3>
          <div className="detail-grid">
            <Row label="Job Type" value={toPlainString(detailData.job_type)} />
            <Row
              label="Sub Type"
              value={toPlainString(detailData.job_sub_type)}
            />
            <Row
              label="Work Mode"
              value={toPlainString(detailData.work_mode)}
            />
            <Row label="Location" value={toPlainString(detailData.location)} />
            <Row label="Pay/Hr" value={formatMoney(detailData.pay_per_hour)} />
            <Row
              label="Salary"
              value={formatSalaryRange(
                detailData.salary_min,
                detailData.salary_max,
              )}
            />
            <Row
              label="Exp Required"
              value={formatYears(detailData.experience_required)}
            />
            <Row
              label="Recruiter"
              value={toPlainString(detailData.recruiter_name)}
            />
            <Row
              label="Recruiter Ph"
              value={toPlainString(detailData.recruiter_phone)}
            />
            <Row
              label="Vendor Email"
              value={toPlainString(detailData.vendor_email)}
            />
          </div>
        </section>
        {description && (
          <section className="detail-section">
            <h3>Description</h3>
            <p className="detail-text">{description}</p>
          </section>
        )}
        {skillsRequired.length > 0 && (
          <section className="detail-section">
            <h3>Skills Required</h3>
            <div className="detail-tags">
              {skillsRequired.map((skill) => (
                <span key={skill} className="detail-tag">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderFooter() {
    return (
      <div className="detail-modal-footer">
        {isCandidate && (
          <Button
            variant="download"
            className="detail-btn detail-btn-pdf"
            onClick={() => openPdfPreview(type, detailData, matchPercentage)}
          >
            ⬇ Download PDF
          </Button>
        )}

        {/* ── Job modal: "Forward Candidate to Vendor" ── */}
        {canForwardCandidate && !showSendPanel && (
          <Button
            variant="primary"
            className="detail-btn detail-btn-send"
            onClick={() => setShowSendPanel(true)}
            title="Select one of your company candidates to forward to this job's vendor"
          >
            📤 Forward Candidate
          </Button>
        )}

        {canForwardCandidate && showSendPanel && (
          <div className="detail-send-panel">
            {hasCandidates ? (
              <>
                <Select
                  className="detail-send-select"
                  value={selectedCandidate}
                  onChange={(e) => setSelectedCandidate(e.target.value)}
                >
                  <option value="">— Pick your candidate —</option>
                  {candidateOptions.map((c) => (
                    <option key={c.candidate_email} value={c.candidate_email}>
                      {c.candidate_name
                        ? `${c.candidate_name} (${c.candidate_email})`
                        : c.candidate_email}
                    </option>
                  ))}
                </Select>
                <Input
                  className="detail-send-note"
                  placeholder="Note to vendor…"
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="detail-btn detail-btn-pdf"
                  disabled={!selectedCandidate || forwardLoading}
                  onClick={handleForwardCandidate}
                >
                  {forwardLoading ? "Sending…" : "→ Forward"}
                </Button>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "#bb3333", fontWeight: 600 }}>
                No candidates in your roster yet — add them in &quot;Company
                Candidates&quot; first.
              </span>
            )}
            <Button
              variant="close"
              className="detail-btn detail-btn-close"
              onClick={closeSendPanel}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* ── Candidate modal: "Forward to Job Opening" ── */}
        {canForwardToJob && !showSendPanel && (
          <Button
            variant="primary"
            className="detail-btn detail-btn-send"
            onClick={() => setShowSendPanel(true)}
            title="Forward this candidate to a job opening's vendor"
          >
            📤 Forward to Job
          </Button>
        )}

        {canForwardToJob && showSendPanel && (
          <div className="detail-send-panel">
            {hasJobs ? (
              <>
                <Select
                  className="detail-send-select"
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  <option value="">— Pick a job opening —</option>
                  {jobOptions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.vendor_email})
                    </option>
                  ))}
                </Select>
                <Input
                  className="detail-send-note"
                  placeholder="Note to vendor…"
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="detail-btn detail-btn-pdf"
                  disabled={!selectedJob || forwardLoading}
                  onClick={handleForwardToJob}
                >
                  {forwardLoading ? "Sending…" : "→ Forward"}
                </Button>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "#bb3333", fontWeight: 600 }}>
                No job openings loaded to forward to.
              </span>
            )}
            <Button
              variant="close"
              className="detail-btn detail-btn-close"
              onClick={closeSendPanel}
            >
              Cancel
            </Button>
          </div>
        )}

        <Button className="detail-btn detail-btn-close" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <dialog open className="detail-modal-overlay">
      <div className="rm-backdrop" role="none" onClick={onClose} />
      <div className="detail-modal">
        <div className="detail-modal-titlebar">
          <span className="detail-modal-title">
            {isCandidate ? "👤 Candidate Profile" : "💼 Job Details"}
          </span>
          {matchPercentage !== undefined && (
            <span className={`detail-modal-match ${matchTier}`}>
              Match: {matchPercentage}%
            </span>
          )}
          <Button
            variant="close"
            size="xs"
            className="detail-modal-close"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        <div className="detail-modal-body">
          {isCandidate ? renderCandidateBody() : renderJobBody()}
        </div>
        {renderFooter()}
      </div>
    </dialog>
  );
};

const Row: React.FC<{ label: string; value?: string | number | null }> = ({
  label,
  value,
}) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value ?? "—"}</span>
  </div>
);

const Block: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div style={{ marginBottom: 8 }}>
    <div className="detail-label" style={{ marginBottom: 3 }}>
      {label}
    </div>
    <pre className="detail-pre">{value}</pre>
  </div>
);

export default DetailModal;
