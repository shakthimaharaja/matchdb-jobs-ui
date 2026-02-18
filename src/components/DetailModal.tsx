import React from "react";
import "./DetailModal.css";

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  type: "job" | "candidate";
  data: Record<string, any> | null;
  matchPercentage?: number;
}

const fmtList = (arr?: string[]) =>
  arr && arr.length ? arr.join(", ") : "—";

const fmtVal = (v: any) => (v !== undefined && v !== null && v !== "" ? String(v) : "—");

const DetailModal: React.FC<DetailModalProps> = ({ open, onClose, type, data, matchPercentage }) => {
  if (!open || !data) return null;

  const handleDownloadPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const isCandidate = type === "candidate";
    const title = isCandidate
      ? `Candidate Profile – ${data.name || ""}`
      : `Job Details – ${data.title || ""}`;

    const rows = isCandidate
      ? [
          ["Name", fmtVal(data.name)],
          ["Email", fmtVal(data.email)],
          ["Phone", fmtVal(data.phone)],
          ["Location", fmtVal(data.location)],
          ["Current Role", fmtVal(data.current_role)],
          ["Current Company", fmtVal(data.current_company)],
          ["Experience", `${fmtVal(data.experience_years)} yrs`],
          ["Preferred Type", fmtVal(data.preferred_job_type)],
          ["Expected Rate", data.expected_hourly_rate ? `$${data.expected_hourly_rate}/hr` : "—"],
          ["Skills", fmtList(data.skills)],
          ["Summary", fmtVal(data.resume_summary)],
          ["Experience Detail", fmtVal(data.resume_experience)],
          ["Education", fmtVal(data.resume_education)],
          ["Achievements", fmtVal(data.resume_achievements)],
          ["Bio", fmtVal(data.bio)],
          ...(matchPercentage !== undefined ? [["Match %", `${matchPercentage}%`]] : []),
        ]
      : [
          ["Title", fmtVal(data.title)],
          ["Description", fmtVal(data.description)],
          ["Location", fmtVal(data.location)],
          ["Job Type", fmtVal(data.job_type)],
          ["Sub Type", fmtVal(data.job_sub_type)],
          ["Work Mode", fmtVal(data.work_mode)],
          ["Pay/Hr", data.pay_per_hour ? `$${data.pay_per_hour}` : "—"],
          ["Salary Range", data.salary_min || data.salary_max ? `$${data.salary_min || "?"} – $${data.salary_max || "?"}` : "—"],
          ["Experience Required", `${fmtVal(data.experience_required)} yrs`],
          ["Skills Required", fmtList(data.skills_required)],
          ["Recruiter", fmtVal(data.recruiter_name)],
          ["Recruiter Phone", fmtVal(data.recruiter_phone)],
          ["Vendor Email", fmtVal(data.vendor_email)],
          ...(matchPercentage !== undefined ? [["Match %", `${matchPercentage}%`]] : []),
        ];

    const tableRows = rows
      .map(
        ([label, value]) => `
      <tr>
        <td style="font-weight:bold;padding:5px 10px;border:1px solid #ccc;background:#f5f5f5;width:180px;vertical-align:top;">${label}</td>
        <td style="padding:5px 10px;border:1px solid #ccc;white-space:pre-wrap;">${value}</td>
      </tr>`
      )
      .join("");

    win.document.write(`<!DOCTYPE html>
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
</body></html>`);
    win.document.close();
  };

  const isCandidate = type === "candidate";

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="detail-modal-titlebar">
          <span className="detail-modal-title">
            {isCandidate ? "👤 Candidate Profile" : "💼 Job Details"}
          </span>
          {matchPercentage !== undefined && (
            <span
              className={`detail-modal-match ${matchPercentage >= 75 ? "high" : matchPercentage >= 45 ? "mid" : "low"}`}
            >
              Match: {matchPercentage}%
            </span>
          )}
          <button type="button" className="detail-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="detail-modal-body">
          {isCandidate ? (
            <>
              <section className="detail-section">
                <h3>Personal Info</h3>
                <div className="detail-grid">
                  <Row label="Name" value={data.name} />
                  <Row label="Email" value={data.email} />
                  <Row label="Phone" value={data.phone} />
                  <Row label="Location" value={data.location} />
                </div>
              </section>
              <section className="detail-section">
                <h3>Professional Details</h3>
                <div className="detail-grid">
                  <Row label="Current Role" value={data.current_role} />
                  <Row label="Company" value={data.current_company} />
                  <Row label="Experience" value={`${data.experience_years || 0} yrs`} />
                  <Row label="Preferred Type" value={data.preferred_job_type} />
                  <Row label="Expected Rate" value={data.expected_hourly_rate ? `$${data.expected_hourly_rate}/hr` : undefined} />
                </div>
              </section>
              {data.skills && data.skills.length > 0 && (
                <section className="detail-section">
                  <h3>Extracted Skills</h3>
                  <div className="detail-tags">
                    {data.skills.map((s: string) => (
                      <span key={s} className="detail-tag">{s}</span>
                    ))}
                  </div>
                </section>
              )}
              {(data.resume_summary || data.resume_experience || data.resume_education || data.resume_achievements) && (
                <section className="detail-section">
                  <h3>Resume</h3>
                  {data.resume_summary && <Block label="Summary" value={data.resume_summary} />}
                  {data.resume_experience && <Block label="Work Experience" value={data.resume_experience} />}
                  {data.resume_education && <Block label="Education" value={data.resume_education} />}
                  {data.resume_achievements && <Block label="Certifications & Achievements" value={data.resume_achievements} />}
                </section>
              )}
              {data.bio && (
                <section className="detail-section">
                  <h3>Bio</h3>
                  <p className="detail-text">{data.bio}</p>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="detail-section">
                <h3>{data.title}</h3>
                <div className="detail-grid">
                  <Row label="Job Type" value={data.job_type} />
                  <Row label="Sub Type" value={data.job_sub_type} />
                  <Row label="Work Mode" value={data.work_mode} />
                  <Row label="Location" value={data.location} />
                  <Row label="Pay/Hr" value={data.pay_per_hour ? `$${data.pay_per_hour}` : undefined} />
                  <Row label="Salary" value={(data.salary_min || data.salary_max) ? `$${data.salary_min || "?"} – $${data.salary_max || "?"}` : undefined} />
                  <Row label="Exp Required" value={`${data.experience_required || 0} yrs`} />
                  <Row label="Recruiter" value={data.recruiter_name} />
                  <Row label="Recruiter Ph" value={data.recruiter_phone} />
                  <Row label="Vendor Email" value={data.vendor_email} />
                </div>
              </section>
              {data.description && (
                <section className="detail-section">
                  <h3>Description</h3>
                  <p className="detail-text">{data.description}</p>
                </section>
              )}
              {data.skills_required && data.skills_required.length > 0 && (
                <section className="detail-section">
                  <h3>Skills Required</h3>
                  <div className="detail-tags">
                    {data.skills_required.map((s: string) => (
                      <span key={s} className="detail-tag">{s}</span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="detail-modal-footer">
          {isCandidate && (
            <button type="button" className="detail-btn detail-btn-pdf" onClick={handleDownloadPDF}>
              ⬇ Download PDF
            </button>
          )}
          <button type="button" className="detail-btn detail-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value ?? "—"}</span>
  </div>
);

const Block: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginBottom: 8 }}>
    <div className="detail-label" style={{ marginBottom: 3 }}>{label}</div>
    <pre className="detail-pre">{value}</pre>
  </div>
);

export default DetailModal;
