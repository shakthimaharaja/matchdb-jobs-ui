import React from "react";
import { DataTable, Button } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import { PokeRecord } from "../api/jobsApi";

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

const buildColumns = (
  personColLabel: string,
  isSent: boolean,
  defaults: { sent: string; received: string },
): DataTableColumn<PokeRecord>[] => [
  {
    key: "person",
    header: personColLabel,
    width: "14%",
    skeletonWidth: 80,
    render: (p: PokeRecord) => {
      const personName = isSent ? p.target_name : p.sender_name;
      return <>{personName}</>;
    },
    tooltip: (p: PokeRecord) => (isSent ? p.target_name : p.sender_name),
  },
  {
    key: "email",
    header: "Email",
    width: "18%",
    skeletonWidth: 110,
    render: (p: PokeRecord) => {
      const personEmail = isSent ? p.target_email : p.sender_email;
      return (
        <a
          href={`mailto:${personEmail}`}
          style={{ color: "var(--w97-blue, #2a5fa0)", textDecoration: "none" }}
        >
          {personEmail}
        </a>
      );
    },
  },
  {
    key: "type",
    header: "Type",
    width: "7%",
    skeletonWidth: 50,
    render: (p: PokeRecord) => {
      const personType = isSent
        ? defaults.sent
        : p.sender_type || defaults.received;
      return (
        <span
          className="matchdb-type-pill"
          style={{ textTransform: "capitalize" }}
        >
          {personType}
        </span>
      );
    },
  },
  {
    key: "job",
    header: "Job Title",
    width: "16%",
    skeletonWidth: 90,
    render: (p: PokeRecord) => <>{p.job_title || "—"}</>,
    tooltip: (p: PokeRecord) => p.job_title || "—",
  },
  {
    key: "subject",
    header: "Subject / Context",
    skeletonWidth: 130,
    render: (p: PokeRecord) => <>{p.subject}</>,
    tooltip: (p: PokeRecord) => p.subject,
  },
  {
    key: "date",
    header: "Date",
    width: "9%",
    skeletonWidth: 60,
    render: (p: PokeRecord) => (
      <span style={{ fontSize: 11 }}>
        {new Date(p.created_at).toLocaleDateString()}
      </span>
    ),
  },
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
  // Row flash animations (update = yellow, delete = red)
  flashIds?: Set<string>;
  deleteFlashIds?: Set<string>;
}

const PokesTable: React.FC<PokesTableProps> = ({
  pokes,
  loading,
  section,
  userType,
  jobId,
  jobTitle,
  onClearJob,
  flashIds,
  deleteFlashIds,
}) => {
  const isSent = section === "pokes-sent" || section === "mails-sent";
  const meta = SECTION_META[section];
  const personColLabel = PERSON_COL_LABEL[userType][section];
  const defaults = DEFAULT_PERSON_TYPE[userType];

  const filtered = jobId ? pokes.filter((p) => p.job_id === jobId) : pokes;

  const titleText = jobTitle ? `${meta.title} — ${jobTitle}` : meta.title;
  const sectionLabel = section.includes("mail") ? "mails" : "pokes";
  const emptyMessage = jobId
    ? `No ${sectionLabel} for this job opening.`
    : meta.emptyMsg;

  const columns = buildColumns(personColLabel, isSent, defaults);

  const titleExtra =
    jobId && onClearJob ? (
      <Button
        size="xs"
        onClick={onClearJob}
        title="Show all — clear job filter"
      >
        ✕ Clear filter
      </Button>
    ) : undefined;

  return (
    <DataTable<PokeRecord>
      columns={columns}
      data={filtered}
      keyExtractor={(p) => p.id}
      loading={loading}
      paginated
      title={titleText}
      titleIcon={meta.icon}
      titleExtra={titleExtra}
      emptyMessage={emptyMessage}
      flashIds={flashIds}
      deleteFlashIds={deleteFlashIds}
    />
  );
};

export default PokesTable;
