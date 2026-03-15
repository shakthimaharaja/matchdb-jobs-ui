/**
 * TimesheetView — Candidate timesheet entry, history and download.
 *
 * Layout:
 *   [Current Week Form]   — save draft / submit
 *   [Previous Timesheets] — DataTable with download + status badges
 */

import React, { useEffect, useMemo, useState } from "react";
import { DataTable, Button } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetTimesheetsQuery,
  useUpsertTimesheetMutation,
  useSubmitTimesheetMutation,
  type Timesheet,
  type TimesheetEntry,
} from "../api/jobsApi";

// ── Date helpers ───────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

/** Monday 00:00 UTC of the week containing `date` */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Array of 5 {date "YYYY-MM-DD", day "Monday"...} for Mon-Fri of weekStart */
function buildWeekDates(weekStart: Date): { date: string; day: string }[] {
  return DAYS.map((day, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), day };
  });
}

/** Saturday of the week >= weekStart → can submit */
function canSubmitWeek(weekStart: Date): boolean {
  const sat = new Date(weekStart);
  sat.setUTCDate(weekStart.getUTCDate() + 5);
  sat.setUTCHours(0, 0, 0, 0);
  return new Date() >= sat;
}

function fmtWeek(weekStart: string): string {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 4);
  const fmt = (x: Date) =>
    x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${fmt(d)} – ${fmt(end)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

// ── Download helpers ───────────────────────────────────────────────────────────

function downloadTimesheetCSV(ts: Timesheet): void {
  const entries = ts.entries as TimesheetEntry[];
  const header = ["Day", "Date", "Hours", "Notes"].join(",");
  const rows = entries.map((e) =>
    [e.day, e.date, e.hoursWorked, `"${(e.notes || "").replaceAll('"', '""')}"`].join(","),
  );
  const meta = [
    `"Timesheet — Week of ${fmtWeek(ts.weekStart)}"`,
    `"Candidate:","${ts.candidateName || ts.candidateEmail}"`,
    `"Company:","${ts.companyName || "—"}"`,
    `"Status:","${ts.status}"`,
    ts.approvedAt ? `"Approved:","${fmtDate(ts.approvedAt)}"` : "",
    "",
    header,
    ...rows,
    "",
    `"Total Hours:",${ts.totalHours}`,
  ].filter((l) => l !== undefined).join("\n");

  const blob = new Blob([meta], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet-${ts.weekStart.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status pill ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:     { background: "#f5f5f5", color: "#666" },
  submitted: { background: "#fff3cd", color: "#856404" },
  approved:  { background: "#d4edda", color: "#155724" },
  rejected:  { background: "#f8d7da", color: "#721c24" },
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="matchdb-type-pill"
      style={{ ...STATUS_STYLE[status], textTransform: "uppercase", width: "auto", padding: "1px 8px" }}
    >
      {status}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  candidateName?: string;
  userEmail?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const TimesheetView: React.FC<Props> = ({ candidateName = "", userEmail = "" }) => {
  // Current week
  const currentWeekStart = useMemo(() => getWeekStart(), []);
  const weekDates = useMemo(() => buildWeekDates(currentWeekStart), [currentWeekStart]);
  const submittable = canSubmitWeek(currentWeekStart);

  // Entry state — keyed by date
  const [entries, setEntries] = useState<Record<string, { hoursWorked: string; notes: string }>>(() =>
    Object.fromEntries(weekDates.map((wd) => [wd.date, { hoursWorked: "8", notes: "" }])),
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [approverNotesModal, setApproverNotesModal] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // API
  const { data: timesheetsResp, isFetching, refetch } = useGetTimesheetsQuery({ page, limit: 25 });
  const [upsertTimesheet, { isLoading: saving }] = useUpsertTimesheetMutation();
  const [submitTimesheet, { isLoading: submitting }] = useSubmitTimesheetMutation();

  const timesheets = timesheetsResp?.data ?? [];
  const total = timesheetsResp?.total ?? 0;

  // Pre-fill form if a draft exists for the current week
  const existingDraft = useMemo(
    () =>
      timesheets.find(
        (t) =>
          t.weekStart.slice(0, 10) === currentWeekStart.toISOString().slice(0, 10) &&
          t.status === "draft",
      ),
    [timesheets, currentWeekStart],
  );
  const currentWeekSheet = useMemo(
    () => timesheets.find((t) => t.weekStart.slice(0, 10) === currentWeekStart.toISOString().slice(0, 10)),
    [timesheets, currentWeekStart],
  );

  useEffect(() => {
    if (existingDraft) {
      const map: Record<string, { hoursWorked: string; notes: string }> = {};
      (existingDraft.entries as TimesheetEntry[]).forEach((e) => {
        map[e.date] = { hoursWorked: String(e.hoursWorked), notes: e.notes || "" };
      });
      setEntries((prev) => ({ ...prev, ...map }));
    }
  }, [existingDraft?.id]);

  function buildEntries(): TimesheetEntry[] {
    return weekDates.map((wd) => ({
      date: wd.date,
      day: wd.day,
      hoursWorked: parseFloat(entries[wd.date]?.hoursWorked || "0") || 0,
      notes: entries[wd.date]?.notes || "",
    }));
  }

  async function handleSaveDraft() {
    setSaveMsg(null); setSaveErr(null);
    try {
      await upsertTimesheet({
        weekStart: currentWeekStart.toISOString(),
        entries: buildEntries(),
        candidateName,
      }).unwrap();
      setSaveMsg("Draft saved.");
      refetch();
    } catch {
      setSaveErr("Failed to save draft.");
    }
  }

  async function handleSubmit() {
    setSaveMsg(null); setSaveErr(null);
    // First save, then submit
    try {
      const saved = await upsertTimesheet({
        weekStart: currentWeekStart.toISOString(),
        entries: buildEntries(),
        candidateName,
      }).unwrap();
      await submitTimesheet(saved.id).unwrap();
      setSaveMsg("Timesheet submitted successfully.");
      setSubmitConfirm(false);
      refetch();
    } catch (err: any) {
      setSaveErr(err?.data?.error || "Failed to submit timesheet.");
      setSubmitConfirm(false);
    }
  }

  const totalHours = buildEntries().reduce((s, e) => s + e.hoursWorked, 0);

  // Previous timesheets table
  const prevTimesheets = timesheets.filter(
    (t) => t.weekStart.slice(0, 10) !== currentWeekStart.toISOString().slice(0, 10),
  );

  const columns: DataTableColumn<Timesheet>[] = [
    {
      key: "week",
      header: "Week",
      width: "22%",
      render: (t) => <span style={{ fontWeight: 600 }}>{fmtWeek(t.weekStart)}</span>,
    },
    {
      key: "company",
      header: "Company",
      width: "18%",
      render: (t) => t.companyName || "—",
    },
    {
      key: "hours",
      header: "Total Hrs",
      width: "9%",
      align: "center",
      render: (t) => <strong>{Number(t.totalHours).toFixed(1)}</strong>,
    },
    {
      key: "status",
      header: "Status",
      width: "11%",
      render: (t) => <StatusPill status={t.status} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      width: "12%",
      render: (t) => (t.submittedAt ? fmtDate(t.submittedAt) : "—"),
    },
    {
      key: "approved",
      header: "Approved",
      width: "12%",
      render: (t) => (t.approvedAt ? fmtDate(t.approvedAt) : "—"),
    },
    {
      key: "notes",
      header: "Remarks",
      width: "10%",
      render: (t) =>
        t.approverNotes ? (
          <button
            type="button"
            className="matchdb-link-btn"
            onClick={() => setApproverNotesModal(t.approverNotes)}
          >
            View
          </button>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Download",
      width: "6%",
      align: "center",
      render: (t) =>
        t.status === "submitted" || t.status === "approved" ? (
          <Button
            size="xs"
            title="Download CSV"
            onClick={() => downloadTimesheetCSV(t)}
            style={{ fontSize: 11 }}
          >
            ⬇ CSV
          </Button>
        ) : (
          "—"
        ),
    },
  ];

  const isCurrentWeekAlreadySubmitted =
    currentWeekSheet && currentWeekSheet.status !== "draft";

  return (
    <div className="matchdb-page">
      {/* ── Current / New Timesheet ── */}
      <div className="matchdb-panel" style={{ flex: "0 0 auto", marginBottom: 4 }}>
        <div className="matchdb-panel-title">
          <div className="matchdb-panel-title-left">
            <span className="matchdb-panel-title-icon">🗓</span>
            <span className="matchdb-panel-title-text">
              Current Timesheet — {fmtWeek(currentWeekStart.toISOString())}
            </span>
            {currentWeekSheet && (
              <span className="matchdb-panel-title-meta" style={{ marginLeft: 8 }}>
                <StatusPill status={currentWeekSheet.status} />
              </span>
            )}
          </div>
          <div className="matchdb-panel-title-right" style={{ fontSize: 11, opacity: 0.85 }}>
            {submittable
              ? "Week ended — ready to submit"
              : "In progress — save draft anytime"}
          </div>
        </div>

        {/* Alert */}
        {(saveMsg || saveErr) && (
          <div className="matchdb-alerts">
            {saveMsg && <div className="matchdb-alert matchdb-alert-success">✓ {saveMsg}</div>}
            {saveErr && <div className="matchdb-alert matchdb-alert-error">✕ {saveErr}</div>}
          </div>
        )}

        {isCurrentWeekAlreadySubmitted ? (
          <div style={{ padding: "16px 12px", fontSize: 13, color: "var(--w97-text-secondary)" }}>
            This week's timesheet is <strong>{currentWeekSheet.status}</strong>
            {currentWeekSheet.approvedAt && ` on ${fmtDate(currentWeekSheet.approvedAt)}`}.
            {(currentWeekSheet.status === "submitted" || currentWeekSheet.status === "approved") && (
              <Button
                size="xs"
                style={{ marginLeft: 12 }}
                onClick={() => downloadTimesheetCSV(currentWeekSheet)}
              >
                ⬇ Download CSV
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Entry grid */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        background: "#c0c0c0", padding: "4px 8px", textAlign: "left",
                        borderBottom: "1px solid #808080", fontWeight: 700, width: "14%",
                      }}
                    >
                      Day
                    </th>
                    <th style={{ background: "#c0c0c0", padding: "4px 8px", textAlign: "left", borderBottom: "1px solid #808080", fontWeight: 700, width: "13%" }}>
                      Date
                    </th>
                    <th style={{ background: "#c0c0c0", padding: "4px 8px", textAlign: "center", borderBottom: "1px solid #808080", fontWeight: 700, width: "14%" }}>
                      Hours Worked
                    </th>
                    <th style={{ background: "#c0c0c0", padding: "4px 8px", textAlign: "left", borderBottom: "1px solid #808080", fontWeight: 700 }}>
                      Notes / Task Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map((wd, i) => (
                    <tr
                      key={wd.date}
                      style={{ background: i % 2 === 0 ? "#fff" : "#f0f0f0" }}
                    >
                      <td style={{ padding: "5px 8px", fontWeight: 600, borderBottom: "1px solid #d0d0d0" }}>
                        {wd.day}
                      </td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #d0d0d0", color: "#555" }}>
                        {new Date(wd.date + "T00:00:00Z").toLocaleDateString("en-US", {
                          month: "short", day: "numeric", timeZone: "UTC",
                        })}
                      </td>
                      <td style={{ padding: "3px 8px", borderBottom: "1px solid #d0d0d0", textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          className="matchdb-input"
                          style={{ width: 72, textAlign: "center" }}
                          value={entries[wd.date]?.hoursWorked ?? "8"}
                          onChange={(e) =>
                            setEntries((prev) => ({
                              ...prev,
                              [wd.date]: { ...prev[wd.date], hoursWorked: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "3px 8px", borderBottom: "1px solid #d0d0d0" }}>
                        <input
                          type="text"
                          className="matchdb-input"
                          style={{ width: "100%" }}
                          placeholder="Optional task notes..."
                          value={entries[wd.date]?.notes ?? ""}
                          onChange={(e) =>
                            setEntries((prev) => ({
                              ...prev,
                              [wd.date]: { ...prev[wd.date], notes: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#e8e8e8" }}>
                    <td colSpan={2} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 12 }}>
                      Total
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>
                      {totalHours.toFixed(1)} hrs
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Action bar */}
            <div
              style={{
                padding: "6px 10px",
                background: "#c0c0c0",
                borderTop: "1px solid #808080",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Button onClick={handleSaveDraft} disabled={saving || submitting}>
                {saving ? "Saving…" : "💾 Save Draft"}
              </Button>
              {submittable && (
                <Button
                  variant="primary"
                  onClick={() => setSubmitConfirm(true)}
                  disabled={saving || submitting}
                >
                  {submitting ? "Submitting…" : "✔ Submit Timesheet"}
                </Button>
              )}
              {!submittable && (
                <span style={{ fontSize: 11.5, color: "#666", marginLeft: 4 }}>
                  Submit available from Saturday onwards
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Previous Timesheets ── */}
      <DataTable<Timesheet>
        title="Previous Timesheets"
        titleIcon="📋"
        columns={columns}
        data={prevTimesheets}
        keyExtractor={(t) => t.id}
        loading={isFetching}
        paginate
        serverTotal={Math.max(0, total - (currentWeekSheet ? 1 : 0))}
        serverPage={page}
        serverPageSize={25}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No previous timesheets. Create your first timesheet above."
        showRowNumbers={false}
      />

      {/* ── Submit confirm dialog ── */}
      {submitConfirm && (
        <dialog
          open
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "transparent", border: "none", padding: 0, margin: 0, width: "100%", height: "100%" }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
            role="none"
            onClick={() => setSubmitConfirm(false)}
          />
          <div
            style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              background: "#c0c0c0",
              border: "2px solid",
              borderColor: "#fff #808080 #808080 #fff",
              padding: 0, minWidth: 340,
            }}
          >
            <div className="matchdb-panel-title">
              <span className="matchdb-panel-title-text">⚠ Confirm Submission</span>
            </div>
            <div style={{ padding: "14px 16px", fontSize: 13 }}>
              <p style={{ margin: "0 0 10px" }}>
                Submit timesheet for <strong>{fmtWeek(currentWeekStart.toISOString())}</strong>?
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#555" }}>
                Total: <strong>{totalHours.toFixed(1)} hours</strong>. Once submitted, your employer
                will review and approve it. You won't be able to edit it after submission.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button onClick={() => setSubmitConfirm(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Confirm Submit"}
                </Button>
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* ── Approver notes modal ── */}
      {approverNotesModal !== null && (
        <dialog
          open
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "transparent", border: "none", padding: 0, margin: 0, width: "100%", height: "100%" }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
            role="none"
            onClick={() => setApproverNotesModal(null)}
          />
          <div
            style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              background: "#c0c0c0",
              border: "2px solid",
              borderColor: "#fff #808080 #808080 #fff",
              padding: 0, minWidth: 300, maxWidth: 420,
            }}
          >
            <div className="matchdb-panel-title">
              <span className="matchdb-panel-title-text">Employer Remarks</span>
              <div className="matchdb-panel-title-right">
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 13 }}
                  onClick={() => setApproverNotesModal(null)}
                >✕</button>
              </div>
            </div>
            <div style={{ padding: "14px 16px", fontSize: 13, whiteSpace: "pre-wrap" }}>
              {approverNotesModal || "No remarks."}
            </div>
            <div style={{ padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => setApproverNotesModal(null)}>Close</Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default TimesheetView;
