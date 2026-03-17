import React, { useEffect, useState } from "react";
import { MatchRow } from "./MatchDataTable";
import { CandidateProfile } from "../api/jobsApi";
import { generateResumePDF } from "../utils/generateResumePDF";
import { Button, Input } from "matchdb-component-library";
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
    pdf_data?: string; // base64 PDF (candidate resume)
  }) => void;
  onClose: () => void;
  sending: boolean;
  sentSuccess: boolean;
  /* ── Screening call scheduling (vendor-only) ── */
  onScheduleCall?: () => void;
  schedulingCall?: boolean;
  callScheduled?: boolean;
  invitedRowIds?: Set<string>;
  selectedJobTitle?: string;
  onInviteStateReset?: () => void;
  inviteProposedAt?: string;
  setInviteProposedAt?: (v: string) => void;
  inviteMessage?: string;
  setInviteMessage?: (v: string) => void;
}

/* ── Build a vendor→candidate email template ── */
function buildVendorTemplate(
  row: MatchRow,
  senderName: string,
  senderEmail: string,
): { subject: string; body: string } {
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
}

/* ── Build a candidate→vendor email template ── */
function buildCandidateTemplate(
  row: MatchRow,
  senderName: string,
  senderEmail: string,
  profile?: CandidateProfile | null,
): { subject: string; body: string } {
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

I am writing to express my strong interest in the ${
      row.pokeSubjectContext
    } position at your company.
My resume is attached as a PDF for your reference.

━━━ ABOUT ME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:         ${name}
Email:        ${profile?.email || senderEmail}
Phone:        ${profile?.phone || "—"}
Location:     ${location}
Current Role: ${role}
Experience:   ${exp} year${Number(exp) === 1 ? "" : "s"}
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
  onScheduleCall,
  schedulingCall,
  callScheduled,
  invitedRowIds,
  selectedJobTitle,
  onInviteStateReset,
  inviteProposedAt,
  setInviteProposedAt,
  inviteMessage,
  setInviteMessage,
}) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showCallPanel, setShowCallPanel] = useState(false);

  // Whether this candidate already has an invite
  const alreadyInvited = row ? invitedRowIds?.has(row.pokeTargetEmail) : false;

  useEffect(() => {
    if (open && row) {
      const tpl = isVendor
        ? buildVendorTemplate(row, senderName, senderEmail)
        : buildCandidateTemplate(row, senderName, senderEmail, senderProfile);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setShowCallPanel(false);
      onInviteStateReset?.();
    }
    // Only rebuild template when the modal opens with a new row
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const tpl = isVendor
      ? buildVendorTemplate(row, senderName, senderEmail)
      : buildCandidateTemplate(row, senderName, senderEmail, senderProfile);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const isBusy = sending || generatingPdf;

  return (
    <dialog open className="rm-overlay">
      <div className="rm-backdrop" role="none" onClick={onClose} />
      <div
        className="rm-window"
        style={{
          width: 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title bar */}
        <div className="rm-titlebar">
          <span className="rm-titlebar-icon">✉</span>
          <span className="rm-titlebar-title">
            Mail Template — {row.pokeTargetName}
          </span>
          <Button variant="close" size="xs" onClick={onClose} title="Close">
            ✕
          </Button>
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr",
                gap: 4,
                alignItems: "center",
                fontSize: 12,
              }}
            >
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
                  <span style={{ fontWeight: 700, color: "#555" }}>
                    Attach:
                  </span>
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
            <Input
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
              Email Body{" "}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  color: "#888",
                  fontWeight: 400,
                }}
              >
                {isVendor
                  ? "— 3-part template: edit the [bracketed] sections · Part 1 intro · Part 2 job · Part 3 contact"
                  : "— resume details · a PDF copy will be attached · editable before sending"}
              </span>
            </legend>
            <textarea
              className="rm-textarea"
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 340,
                fontFamily: "monospace",
                fontSize: 11,
                resize: "vertical",
              }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email here..."
            />
          </fieldset>

          {/* Character count */}
          <div style={{ fontSize: 10, color: "#888", textAlign: "right" }}>
            {body.length} characters · {body.split("\n").length} lines
          </div>

          {/* ── Screening Call Panel (collapsible, vendor-only) ── */}
          {isVendor && onScheduleCall && showCallPanel && (
            <div
              style={{
                border: "1px solid var(--w97-border-dark, #999)",
                borderRadius: 2,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: "#f9fafb",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12 }}>
                📞 Schedule Screening Call
                {selectedJobTitle && selectedJobTitle !== "All Openings" && (
                  <span style={{ fontWeight: 400, color: "#555" }}>
                    {" "}
                    — {selectedJobTitle}
                  </span>
                )}
              </div>

              {callScheduled ? (
                <div
                  style={{ color: "#2e7d32", fontWeight: 600, fontSize: 12 }}
                >
                  ✓ Screening call invite sent! A Google Meet link has been
                  emailed.
                </div>
              ) : (
                <>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label
                      htmlFor="modal-invite-proposed-at"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      Proposed Date & Time
                    </label>
                    <input
                      id="modal-invite-proposed-at"
                      type="datetime-local"
                      value={inviteProposedAt || ""}
                      onChange={(e) => setInviteProposedAt?.(e.target.value)}
                      style={{
                        fontSize: 11,
                        padding: "3px 6px",
                        border: "1px solid var(--w97-border-dark)",
                        fontFamily: "inherit",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#888" }}>
                      Leave blank if TBD
                    </span>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label
                      htmlFor="modal-invite-message"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      Message (optional)
                    </label>
                    <textarea
                      id="modal-invite-message"
                      rows={2}
                      value={inviteMessage || ""}
                      onChange={(e) => setInviteMessage?.(e.target.value)}
                      placeholder="e.g. Looking forward to connecting about the role…"
                      style={{
                        fontSize: 11,
                        padding: "3px 6px",
                        resize: "vertical",
                        border: "1px solid var(--w97-border-dark)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      background: "#e8f0fe",
                      border: "1px solid #c5d5f5",
                      borderRadius: 2,
                      padding: "6px 10px",
                      fontSize: 11,
                      color: "#1a3e7a",
                    }}
                  >
                    🔗 A unique Google Meet link will be auto-generated and
                    included in the email.
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="rm-footer">
          <button
            type="button"
            className="rm-btn rm-btn-primary"
            onClick={handleSend}
            disabled={isBusy || !subject.trim() || !body.trim() || sentSuccess}
            title={
              isVendor
                ? "Send mail template"
                : "Send email with resume PDF attached"
            }
          >
            {(() => {
              if (generatingPdf) return "⏳ Generating PDF...";
              if (isBusy) return "⏳ Sending...";
              if (sentSuccess) return "✓ Sent";
              return "📤 Send Mail Template";
            })()}
          </button>

          {/* Schedule Screening Call button (vendor-only) */}
          {isVendor &&
            onScheduleCall &&
            (() => {
              if (alreadyInvited) {
                return (
                  <button
                    type="button"
                    className="rm-btn"
                    disabled
                    title="Screening call already scheduled"
                    style={{ marginLeft: 4, opacity: 0.5 }}
                  >
                    ✓ Call Scheduled
                  </button>
                );
              }
              if (callScheduled) {
                return (
                  <button
                    type="button"
                    className="rm-btn"
                    disabled
                    style={{ marginLeft: 4, opacity: 0.5 }}
                  >
                    ✓ Invite Sent
                  </button>
                );
              }
              if (showCallPanel) {
                return (
                  <button
                    type="button"
                    className="rm-btn rm-btn-primary"
                    onClick={onScheduleCall}
                    disabled={schedulingCall}
                    title="Send screening call invite with Google Meet link"
                    style={{ marginLeft: 4 }}
                  >
                    {schedulingCall ? "⏳ Sending…" : "📞 Send Call Invite"}
                  </button>
                );
              }
              return (
                <button
                  type="button"
                  className="rm-btn"
                  onClick={() => setShowCallPanel(true)}
                  title="Schedule a screening call with this candidate"
                  style={{ marginLeft: 4 }}
                >
                  📞 Schedule Call
                </button>
              );
            })()}

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
    </dialog>
  );
};

export default PokeEmailModal;
