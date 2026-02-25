import React from "react";
import SharedTable, { ColumnDef } from "./SharedTable";
import { PokeRecord } from "../store/jobsSlice";

type SectionKey =
  | "pokes-sent"
  | "pokes-received"
  | "mails-sent"
  | "mails-received";

const SECTION_META: Record<
  SectionKey,
  { icon: string; title: string; emptyMsg: string }
> = {
  "pokes-sent": {
    icon: "⚡",
    title: "Pokes Sent",
    emptyMsg: "No pokes sent yet.",
  },
  "pokes-received": {
    icon: "⚡",
    title: "Pokes Received",
    emptyMsg: "No pokes received yet.",
  },
  "mails-sent": {
    icon: "✉",
    title: "Mails Sent",
    emptyMsg: "No mails sent yet.",
  },
  "mails-received": {
    icon: "✉",
    title: "Mails Received",
    emptyMsg: "No mails received yet.",
  },
};

/** Column label for the person column — varies by user type and direction */
const PERSON_COL_LABEL: Record<
  "vendor" | "candidate",
  Record<SectionKey, string>
> = {
  vendor: {
    "pokes-sent": "To (Candidate)",
    "pokes-received": "From (Candidate)",
    "mails-sent": "To (Candidate)",
    "mails-received": "From (Candidate)",
  },
  candidate: {
    "pokes-sent": "To (Recruiter)",
    "pokes-received": "From (Vendor)",
    "mails-sent": "To (Recruiter)",
    "mails-received": "From (Vendor)",
  },
};

/** Default person type label for the Type column */
const DEFAULT_PERSON_TYPE: Record<
  "vendor" | "candidate",
  { sent: string; received: string }
> = {
  vendor: { sent: "Candidate", received: "Candidate" },
  candidate: { sent: "Recruiter", received: "Vendor" },
};

const buildColumns = (personColLabel: string): ColumnDef[] => [
  { key: "num", header: "#", width: 28, align: "center", skeletonWidth: 20 },
  { key: "person", header: personColLabel, width: "14%", skeletonWidth: 80 },
  { key: "email", header: "Email", width: "18%", skeletonWidth: 110 },
  { key: "type", header: "Type", width: "7%", skeletonWidth: 50 },
  { key: "job", header: "Job Title", width: "16%", skeletonWidth: 90 },
  { key: "subject", header: "Subject / Context", skeletonWidth: 130 },
  { key: "date", header: "Date", width: "9%", skeletonWidth: 60 },
];

export interface PokesTableProps {
  pokes: PokeRecord[];
  loading: boolean;
  section: SectionKey;
  userType: "vendor" | "candidate";
  /** Vendor-only: filter pokes to those for a specific job opening */
  jobId?: string;
  jobTitle?: string;
  onClearJob?: () => void;
}

const PokesTable: React.FC<PokesTableProps> = ({
  pokes,
  loading,
  section,
  userType,
  jobId,
  jobTitle,
  onClearJob,
}) => {
  const isSent = section === "pokes-sent" || section === "mails-sent";
  const meta = SECTION_META[section];
  const personColLabel = PERSON_COL_LABEL[userType][section];
  const defaults = DEFAULT_PERSON_TYPE[userType];

  const filtered = jobId ? pokes.filter((p) => p.job_id === jobId) : pokes;

  const titleText = jobTitle ? `${meta.title} — ${jobTitle}` : meta.title;
  const emptyMessage = jobId
    ? `No ${section.includes("mail") ? "mails" : "pokes"} for this job opening.`
    : meta.emptyMsg;

  const columns = buildColumns(personColLabel);

  const titleExtra =
    jobId && onClearJob ? (
      <button
        type="button"
        onClick={onClearJob}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,.4)",
          color: "#fff",
          fontSize: 11,
          cursor: "pointer",
          padding: "1px 8px",
          borderRadius: 2,
          marginLeft: 4,
        }}
        title="Show all — clear job filter"
      >
        ✕ Clear filter
      </button>
    ) : undefined;

  return (
    <SharedTable<PokeRecord>
      columns={columns}
      rows={filtered}
      loading={loading}
      title={titleText}
      titleIcon={meta.icon}
      titleExtra={titleExtra}
      emptyMessage={emptyMessage}
      renderRow={(p, _pageIdx, globalIdx) => {
        const personName = isSent ? p.target_name : p.sender_name;
        const personEmail = isSent ? p.target_email : p.sender_email;
        const personType = isSent
          ? defaults.sent
          : p.sender_type || defaults.received;

        return (
          <tr key={p.id}>
            <td style={{ textAlign: "center", color: "#808080", fontSize: 10 }}>
              {globalIdx}
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
      }}
    />
  );
};

export default PokesTable;
