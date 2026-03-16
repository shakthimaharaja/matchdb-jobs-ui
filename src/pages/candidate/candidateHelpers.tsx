import React from "react";
import type { MatchRow } from "../../components/MatchDataTable";
import {
  MAIL_MATCH_THRESHOLD,
  POKE_MATCH_THRESHOLD,
  POKE_COOLDOWN_MS,
  JOB_TYPES,
  WORK_MODES,
  CONTRACT_SUB_TYPES,
  FULL_TIME_SUB_TYPES,
  POKE_LIMIT,
  COUNTRY_FLAGS,
  COUNTRY_NAMES,
} from "../../constants";

export {
  MAIL_MATCH_THRESHOLD,
  POKE_MATCH_THRESHOLD,
  POKE_COOLDOWN_MS,
  JOB_TYPES,
  WORK_MODES,
  CONTRACT_SUB_TYPES,
  FULL_TIME_SUB_TYPES,
  POKE_LIMIT,
  COUNTRY_FLAGS,
  COUNTRY_NAMES,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CandidateDashboardProps {
  token: string | null;
  userEmail: string | undefined;
  username: string | undefined;
  plan?: string;
  membershipConfig?: Record<string, string[]> | null;
  hasPurchasedVisibility?: boolean;
}

export type ActiveView =
  | "matches"
  | "pokes-sent"
  | "pokes-received"
  | "mails-sent"
  | "mails-received"
  | "forwarded"
  | "my-detail"
  | "vendor-openings"
  | "employer-openings"
  | "employer-finance"
  | "employer-immigration"
  | "timesheets"
  | "interviews";

export type MyDetailTab =
  | "overview"
  | "projects"
  | "marketer-activity"
  | "forwarded-openings";

export type SortKey =
  | "name"
  | "company"
  | "role"
  | "type"
  | "matchPercentage"
  | "location";

export type SortDir = "asc" | "desc";

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export const formatRate = (value?: number | null) =>
  value ? `$${Number(value).toFixed(0)}` : "-";

export const formatExperience = (value?: number | null) =>
  `${Number(value || 0)} yrs`;

export const formatType = (value: string) => value.replaceAll("_", " ");

export const getMeterClass = (pct: number) => {
  if (pct >= 75) return "matchdb-meter-fill matchdb-meter-fill-high";
  if (pct >= 45) return "matchdb-meter-fill matchdb-meter-fill-mid";
  return "matchdb-meter-fill matchdb-meter-fill-low";
};

export const sortValue = (row: MatchRow, key: SortKey): string | number => {
  if (key === "matchPercentage") return row.matchPercentage;
  return (row[key] || "").toLowerCase();
};

export const countColor = (n: number): string => {
  if (n >= 50) return "#2e7d32";
  if (n >= 25) return "#b8860b";
  if (n >= 10) return "#d4600a";
  return "#bb3333";
};

export const countBg = (n: number): string => {
  if (n >= 50) return "#e8f5e9";
  if (n >= 25) return "#fffde6";
  if (n >= 10) return "#fff3e0";
  return "#fff5f5";
};

export const fmtC = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export const companyFromEmail = (email?: string) => {
  if (!email) return "-";
  const domain = email.split("@")[1] || "";
  return domain
    ? domain
        .split(".")[0]
        .replaceAll(/[^a-zA-Z0-9]/g, " ")
        .trim() || "-"
    : "-";
};

// ─── Financial Helpers ────────────────────────────────────────────────────────

export const finCellValues = (fin: {
  billRate: number;
  payRate: number;
  hoursWorked: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  projectStart: string | null;
  projectEnd: string | null;
}): string[] => [
  `$${fin.billRate}/hr`,
  `$${fin.payRate}/hr`,
  `${fin.hoursWorked}h`,
  `$${fin.totalBilled.toLocaleString()}`,
  `$${fin.totalPay.toLocaleString()}`,
  `$${fin.taxAmount.toLocaleString()}`,
  `$${fin.cashAmount.toLocaleString()}`,
  `$${fin.netPayable.toLocaleString()}`,
  `$${fin.amountPaid.toLocaleString()}`,
  fin.amountPending > 0 ? `$${fin.amountPending.toLocaleString()}` : "—",
  [
    fin.projectStart
      ? new Date(fin.projectStart).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        })
      : "—",
    fin.projectEnd
      ? new Date(fin.projectEnd).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        })
      : "now",
  ].join(" – "),
];

export const FinancialRow: React.FC<{
  fin: Parameters<typeof finCellValues>[0] & { id: string };
}> = ({ fin }) => (
  <tr style={{ borderBottom: "1px solid var(--w97-border-light)" }}>
    {finCellValues(fin).map((v, i) => (
      <td
        key={`col-${i}-${v}`}
        style={{
          textAlign: "right",
          padding: "5px 8px",
          fontFamily: "monospace",
        }}
      >
        {v}
      </td>
    ))}
  </tr>
);
