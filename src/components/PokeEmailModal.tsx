import React, { useEffect, useState } from "react";
import { MatchRow } from "./MatchDataTable";
import { CandidateProfile } from "../store/jobsSlice";
import { generateResumePDF } from "../utils/generateResumePDF";
import "./ResumeModal.css";

interface PokeEmailModalProps {
  open: boolean;
  row: MatchRow | null;
  /** Whether the logged-in user is a vendor (true) or candidate (false) */
  isVendor: boolean;
  senderName: string;
  senderEmail: string;
  /** Candidate's own profile — used to pre-fill resume content when sender is a candidate */
  senderProfile?: CandidateProfile | null;
  onSend: (params: {
    to_email: string;
    to_name: string;
    subject_context: string;
    email_body: string;
    pdf_data?: string;   // base64 PDF (candidate resume)
  }) => void;
  onClose: () => void;
  sending: boolean;
  sentSuccess: boolean;
}

/* ── Build a default email template depending on context ── */
function buildTemplate(
  row: MatchRow,
  isVendor: boolean,
  senderName: string,
  senderEmail: string,
  profile?: CandidateProfile | null,
): { subject: string; body: string } {
  if (isVendor) {
    // Vendor → Candidate — 3-part template
    return {
      subject: `${row.pokeSubjectContext} — Opportunity for ${row.pokeTargetName}`,
      body: `Dear ${row.pokeTargetName},

━━━ PART 1 — INTRODUCTION ━━━━━━━━━━━━━━━━━━━━━━━━━
I am reaching out after reviewing your profile on MatchDB. We believe your
background is an excellent match for the position described below.

[Edit this section — add your personal introduction, company background, or
 any context that would help the candidate understand why you are contacting them.]

━━━ PART 2 — JOB OPENING ━━━━━━━━━━━━━━━━━━━━━━━━━
Position:  ${row.role}
Type:      ${row.type}
Mode:      ${row.workMode || "—"}
Pay Rate:  ${row.payPerHour}/hr
Location:  ${row.location}

About this role:
[Edit this section — describe the specific responsibilities, requirements,
 team, tech stack, or any other details about the opening that you want to share.]

━━━ PART 3 — OUR CONTACT DETAILS ━━━━━━━━━━━━━━━━━
Contact:   ${senderName}
Email:     ${senderEmail}
Company:   [Add your company name]
Website:   [Add your company website]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We would love to hear from you. Please reply to this email or reach out directly.

Best regards,
${senderName}
${senderEmail}`,
    };
  } else {
    // Candidate → Vendor (recruiter)
    const skills = profile?.skills?.slice(0, 10).join(", ") || "—";
    const summary = profile?.resume_summary || "—";
    const experience = profile?.resume_experience || "—";
    const education = profile?.resume_education || "—";
    const achievements = profile?.resume_achievements || "—";
    const name = profile?.name || senderName;
    const location = profile?.location || "—";
    const role = profile?.current_role || "—";
    const exp = profile?.experience_years ?? "—";

    return {
      subject: `${name} — Interested in ${row.pokeSubjectContext}`,
      body: `Dear ${row.pokeTargetName},

I am writing to express my strong interest in the ${row.pokeSubjectContext} position at your company.
My resume is attached as a PDF for your reference.

━━━ ABOUT ME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:         ${name}
Email:        ${profile?.email || senderEmail}
Phone:        ${profile?.phone || "—"}
Location:     ${location}
Current Role: ${role}
Experience:   ${exp} year${Number(exp) !== 1 ? "s" : ""}
Top Skills:   ${skills}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Professional Summary:
${summary}

Work Experience:
${experience}

Education:
${education}

Certifications & Achievements:
${achievements}

I believe my background is an excellent match and I look forward to discussing how
I can contribute to your team.

Best regards,
${name}
${profile?.email || senderEmail}
${profile?.phone || ""}`,
    };
  }
}

const PokeEmailModal: React.FC<PokeEmailModalProps> = ({
  open,
  row,
  isVendor,
  senderName,
  senderEmail,
  senderProfile,
  onSend,
  onClose,
  sending,
  sentSuccess,
}) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (open && row) {
      const tpl = buildTemplate(row, isVendor, senderName, senderEmail, senderProfile);
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }, [open, row]);

  if (!open || !row) return null;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    // For candidate→vendor: generate resume PDF and attach
    let pdfData: string | undefined;
    if (!isVendor && senderProfile) {
      setGeneratingPdf(true);
      try {
        pdfData = (await generateResumePDF(senderProfile)) ?? undefined;
      } finally {
        setGeneratingPdf(false);
      }
    }

    onSend({
      to_email: row.pokeTargetEmail,
      to_name: row.pokeTargetName,
      subject_context: subject.trim(),
      email_body: body.trim(),
      pdf_data: pdfData,
    });
  };

  const handleReset = () => {
    if (!row) return;
    const tpl = buildTemplate(row, isVendor, senderName, senderEmail, senderProfile);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const isBusy = sending || generatingPdf;

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div
        className="rm-window"
        style={{ width: 720, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="rm-titlebar">
          <span className="rm-titlebar-icon">✉</span>
          <span className="rm-titlebar-title">
            Mail Template — {row.pokeTargetName}
          </span>
          <button className="rm-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Status bar */}
        <div className="rm-statusbar">
          {isVendor
            ? "Review the 3-part template (Introduction · Job Opening · Contact Details) and edit before sending."
            : "Your resume is pre-filled below. A PDF copy will be attached to the email automatically."}
        </div>

        {/* Body */}
        <div className="rm-body" style={{ flex: 1, overflow: "auto", gap: 8 }}>
          {sentSuccess && (
            <div className="rm-alert rm-alert-success">
              ✓ Mail template sent to {row.pokeTargetName} successfully!
              {!isVendor && " Resume PDF was attached."}
            </div>
          )}

          {/* To / From */}
          <fieldset className="rm-fieldset">
            <legend>Recipient</legend>
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 4, alignItems: "center", fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "#555" }}>To:</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                {row.pokeTargetName} &lt;{row.pokeTargetEmail}&gt;
              </span>
              <span style={{ fontWeight: 700, color: "#555" }}>From:</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                {senderName} &lt;{senderEmail}&gt; (via MatchDB)
              </span>
              {!isVendor && (
                <>
                  <span style={{ fontWeight: 700, color: "#555" }}>Attach:</span>
                  <span style={{ fontSize: 11, color: "#2a5fa0" }}>
                    📎 resume.pdf (generated from your profile)
                  </span>
                </>
              )}
            </div>
          </fieldset>

          {/* Subject */}
          <fieldset className="rm-fieldset">
            <legend>Subject</legend>
            <input
              type="text"
              className="rm-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </fieldset>

          {/* Body */}
          <fieldset className="rm-fieldset" style={{ flex: 1 }}>
            <legend>
              Email Body
              <span style={{ marginLeft: 8, fontSize: 10, color: "#888", fontWeight: 400 }}>
                {isVendor
                  ? "— 3-part template: edit the [bracketed] sections · Part 1 intro · Part 2 job · Part 3 contact"
                  : "— resume details · a PDF copy will be attached · editable before sending"}
              </span>
            </legend>
            <textarea
              className="rm-textarea"
              style={{ width: "100%", boxSizing: "border-box", minHeight: 340, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email here..."
            />
          </fieldset>

          {/* Character count */}
          <div style={{ fontSize: 10, color: "#888", textAlign: "right" }}>
            {body.length} characters · {body.split("\n").length} lines
          </div>
        </div>

        {/* Footer */}
        <div className="rm-footer">
          <button
            type="button"
            className="rm-btn rm-btn-primary"
            onClick={handleSend}
            disabled={isBusy || !subject.trim() || !body.trim() || sentSuccess}
            title={!isVendor ? "Send email with resume PDF attached" : "Send mail template"}
          >
            {generatingPdf ? "⏳ Generating PDF..." : isBusy ? "⏳ Sending..." : sentSuccess ? "✓ Sent" : "📤 Send Mail Template"}
          </button>
          <button
            type="button"
            className="rm-btn"
            onClick={handleReset}
            title="Restore the default template"
            style={{ marginLeft: 4 }}
          >
            ↺ Reset Template
          </button>
          <button
            type="button"
            className="rm-btn"
            onClick={onClose}
            style={{ marginLeft: "auto" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PokeEmailModal;
