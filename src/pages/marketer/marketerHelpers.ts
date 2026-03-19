import React from "react";
import type { MarketerCandidateItem, MarketerProfile } from "../../api/jobsApi";
import {
  TYPE_LABELS,
  SUB_LABELS,
  MONTH_NAMES,
  MONTH_VARIANCE,
} from "../../constants";

export { TYPE_LABELS, SUB_LABELS };
export const OV_MN = MONTH_NAMES;
export const OV_VAR = MONTH_VARIANCE;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketerDashboardProps {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
}

export type ActiveView =
  | "vendor-posted"
  | "candidate-created"
  | "company-candidates"
  | "candidate-detail"
  | "forwarded-openings"
  | "financial-summary"
  | "project-summary"
  | "job-positions-summary"
  | "immigration"
  | "immigration-detail"
  | "timesheets"
  | "vendor-summary"
  | "vendor-detail"
  | "client-summary"
  | "client-detail";

export interface ImmigrationDependant {
  name: string;
  relationship: string;
  workAuthorization: string;
  pendingApplications: string;
}

export interface ImmigrationRecord {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  immigrationStatus: string;
  joinedDate: string;
  workAuthorization: string;
  pendingApplications: string;
  dependants: ImmigrationDependant[];
}

export type MonthRow = {
  label: string;
  hours: number;
  billed: number;
  gross: number;
  net: number;
  paid: number;
  balance: number;
};

export type ReportContext = "finance" | "project" | "positions";

// ─── Constants (immigration-specific, not shared) ─────────────────────────────
export const VISA_TYPES = [
  "H-1B",
  "L-1A",
  "L-1B",
  "O-1",
  "OPT",
  "CPT",
  "H-4 EAD",
  "Green Card",
  "US Citizen",
  "TN",
];
export const WORK_AUTH_STATUSES = [
  "Active",
  "Pending Renewal",
  "Expiring Soon",
  "Valid",
  "Under Review",
];
export const PENDING_APPS = [
  "None",
  "I-140 Pending",
  "I-485 Pending",
  "PERM Filed",
  "H-1B Transfer",
  "None",
  "EAD Renewal",
];
export const RELATIONSHIPS = ["Spouse", "Child", "Child"];
export const DEP_NAMES_POOL = [
  "Priya",
  "Arjun",
  "Meera",
  "Ravi",
  "Ananya",
  "Kiran",
  "Neha",
  "Sanjay",
  "Lakshmi",
  "Vikram",
  "Aisha",
  "Dev",
];

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export const fmtDate = (iso: string) => {
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

export const fmtRate = (v: number | null) =>
  v ? `$${Number(v).toFixed(0)}/hr` : "—";

export const fmtSalary = (min: number | null, max: number | null) => {
  if (!min && !max) return "—";
  if (min && max)
    return `$${(min / 1000).toFixed(0)}k–$${(max / 1000).toFixed(0)}k`;
  return `$${((min ?? max ?? 0) / 1000).toFixed(0)}k`;
};

export const fmtC = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export const fmtF = (v: number) =>
  v < 0
    ? `-$${Math.abs(v).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `$${v.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export const countColor = (n: number) => {
  if (n >= 50) return "var(--w97-green)";
  if (n >= 25) return "var(--w97-yellow)";
  if (n >= 10) return "var(--w97-orange)";
  return "var(--w97-red)";
};

export const countBg = (n: number) => {
  if (n >= 50) return "#e8f5e9";
  if (n >= 25) return "#fffde6";
  if (n >= 10) return "#fff3e0";
  return "#fff5f5";
};

// ─── Download Helpers ─────────────────────────────────────────────────────────

export function downloadCSV(rows: Record<string, string>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`)
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

export function downloadExcel(
  rows: Record<string, string>[],
  filename: string,
) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const tableRows = rows.map(
    (r) =>
      `<tr>${headers
        .map((h) => `<td>${String(r[h] ?? "").replaceAll("<", "&lt;")}</td>`)
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

export function downloadResumePDF(p: MarketerProfile) {
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

  const html = `<!DOCTYPE html><html><head><title>Resume — ${p.name}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;}h1{font-size:16px;color:#235a81;border-bottom:2px solid #235a81;padding-bottom:6px;}table{border-collapse:collapse;width:100%;}@media print{button{display:none;}}</style>
</head><body><h1>Resume — ${p.name}</h1><table>${tableRows}</table><br/>
<button onclick="window.print()" style="padding:6px 14px;background:#235a81;color:#fff;border:none;cursor:pointer;font-size:12px;">Print / Save as PDF</button>
</body></html>`;
  win.document.open();
  win.document.close();
  win.document.documentElement.innerHTML = html;
}

// ─── Financial Helpers ────────────────────────────────────────────────────────

export function footerRowClass(margin: number): string {
  if (margin > 0.01) return "ov-foot-profit";
  if (margin < -0.01) return "ov-foot-loss";
  return "ov-foot-neutral";
}

export function balanceClass(val: number): string {
  if (val > 0.01) return "ov-val-orange";
  if (val < -0.01) return "ov-val-red";
  return "ov-val-green";
}

export function balanceLabel(val: number, fmt: (v: number) => string): string {
  if (Math.abs(val) < 0.01) return "\u2713";
  if (val > 0) return fmt(val);
  return `+${fmt(Math.abs(val))}`;
}

export function settledOrAmount(
  val: number,
  fmt: (v: number) => string,
): string {
  if (Math.abs(val) < 0.01) return "\u2713 Settled";
  if (val > 0) return fmt(val);
  return `Overpaid ${fmt(Math.abs(val))}`;
}

export function subtabStyle(
  active: boolean,
  first = true,
): React.CSSProperties {
  return {
    padding: "5px 14px",
    fontSize: 11.5,
    fontWeight: active ? 700 : 500,
    background: active ? "var(--w97-titlebar-from)" : "var(--w97-btn-face)",
    color: active ? "#fff" : "var(--w97-text)",
    border: "1px solid var(--w97-btn-shadow)",
    borderBottom: active ? "none" : "1px solid var(--w97-btn-shadow)",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    ...(!first && { marginLeft: -1 }),
  };
}

// ─── Immigration Mock Data Builder ────────────────────────────────────────────

export function buildImmigrationData(
  candidates: MarketerCandidateItem[],
): ImmigrationRecord[] {
  return candidates.map((c, idx) => {
    const seed = idx + c.id.length;
    const depCount = seed % 4;
    const dependants: ImmigrationDependant[] = Array.from(
      { length: depCount },
      (_, di) => {
        let wa = "N/A";
        if (di === 0) wa = seed % 3 === 0 ? "H-4 EAD" : "H-4 (No EAD)";
        return {
          name:
            DEP_NAMES_POOL[(seed + di * 3) % DEP_NAMES_POOL.length] +
            " " +
            (c.candidate_name?.split(" ")[1] || ""),
          relationship: RELATIONSHIPS[di % RELATIONSHIPS.length],
          workAuthorization: wa,
          pendingApplications:
            di === 0 && seed % 2 === 0 ? "EAD Renewal" : "None",
        };
      },
    );
    const joinedOffset = (seed % 48) + 1;
    const joinedDate = new Date();
    joinedDate.setMonth(joinedDate.getMonth() - joinedOffset);
    return {
      candidateId: c.id,
      candidateName: c.candidate_name || c.candidate_email,
      candidateEmail: c.candidate_email,
      immigrationStatus: VISA_TYPES[seed % VISA_TYPES.length],
      joinedDate: joinedDate.toISOString(),
      workAuthorization: WORK_AUTH_STATUSES[seed % WORK_AUTH_STATUSES.length],
      pendingApplications: PENDING_APPS[seed % PENDING_APPS.length],
      dependants,
    };
  });
}

// ─── Monthly Financial Rows Builder ───────────────────────────────────────────

export function buildMonthlyRows(
  allFins: {
    fin: {
      projectStart: string | null;
      hoursWorked: number;
      amountPaid: number;
      billRate: number;
      payRate: number;
      stateTaxPct: number;
      cashPct: number;
    };
  }[],
): MonthRow[] {
  const monthMap: Record<string, MonthRow> = {};

  allFins.forEach(({ fin }) => {
    const now = new Date();
    const start = fin.projectStart
      ? new Date(fin.projectStart)
      : new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const rawH = fin.hoursWorked > 0 ? fin.hoursWorked / 12 : 80;
    const periods = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
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
          const s = Math.round((p.hours / sumH) * fin.amountPaid * 100) / 100;
          paidArr[i] = s;
          alloc += s;
        } else {
          paidArr[i] = Math.round((fin.amountPaid - alloc) * 100) / 100;
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

  return Object.values(monthMap).sort(
    (a, b) => new Date(a.label).getTime() - new Date(b.label).getTime(),
  );
}

// ─── Breadcrumb Map ───────────────────────────────────────────────────────────

export function getBreadcrumb(
  activeView: ActiveView,
  companyLabel: string,
  candidateName?: string,
): string[] {
  const map: Record<string, string[]> = {
    "vendor-posted": ["Jobs", "Marketer", "Job Openings"],
    "candidate-created": ["Jobs", "Marketer", "Candidate Profiles"],
    "candidate-detail": [
      "Jobs",
      "Marketer",
      companyLabel,
      candidateName ?? "Candidate",
    ],
    "company-candidates": ["Jobs", "Marketer", companyLabel],
    "forwarded-openings": ["Jobs", "Marketer", "Job Openings", "Sent Openings"],
    "financial-summary": ["Jobs", "Marketer", "Dashboard", "Finance"],
    "project-summary": ["Jobs", "Marketer", "Dashboard", "Project"],
    "job-positions-summary": ["Jobs", "Marketer", "Dashboard", "Positions"],
    immigration: ["Jobs", "Marketer", "Dashboard", "Immigration"],
    "immigration-detail": [
      "Jobs",
      "Marketer",
      "Dashboard",
      "Immigration",
      "Detail",
    ],
    timesheets: ["Jobs", "Marketer", "Dashboard", "Timesheets"],
    "vendor-summary": ["Jobs", "Marketer", "Dashboard", "Vendors"],
    "vendor-detail": ["Jobs", "Marketer", "Dashboard", "Vendors", "Detail"],
    "client-summary": ["Jobs", "Marketer", "Dashboard", "Clients"],
    "client-detail": ["Jobs", "Marketer", "Dashboard", "Clients", "Detail"],
  };
  return map[activeView] ?? ["Jobs", "Marketer"];
}
