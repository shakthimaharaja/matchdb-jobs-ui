import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./ProjectFinancialForm.css";
import {
  useGetStateTaxRatesQuery,
  useUpsertProjectFinancialMutation,
  type CandidateDetailProject,
} from "../api/jobsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  project: CandidateDetailProject;
  candidateId: string;
  candidateEmail: string;
  onSaved?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
};

const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toISOString().split("T")[0]; } catch { return ""; }
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Preview strip (used in edit mode) ───────────────────────────────────────

interface PreviewProps {
  totalBilled: number;
  totalPay: number;
  marginAmount: number;
  marginPct: number;
  taxAmount: number;
  taxPct: number;
  cashAmount: number;
  cashPct: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
}

const PreviewStrip: React.FC<PreviewProps> = (p) => (
  <div className="pf-preview-strip">
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Vendor Billed</span>
      <span className="pf-preview-value green">{fmt(p.totalBilled)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Gross Pay</span>
      <span className="pf-preview-value blue">{fmt(p.totalPay)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Your Margin</span>
      <span className="pf-preview-value teal">{fmt(p.marginAmount)} ({fmtPct(p.marginPct)})</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">State Tax ({fmtPct(p.taxPct)})</span>
      <span className="pf-preview-value red">-{fmt(p.taxAmount)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Withholding ({fmtPct(p.cashPct)})</span>
      <span className="pf-preview-value red">-{fmt(p.cashAmount)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Net Payable</span>
      <span className="pf-preview-value blue">{fmt(p.netPayable)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Outstanding</span>
      <span className={`pf-preview-value ${p.amountPending > 0 ? "orange" : p.amountPending < 0 ? "red" : "green"}`}>
        {fmt(Math.abs(p.amountPending))}
      </span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ProjectFinancialForm: React.FC<Props> = ({ project, candidateId, candidateEmail, onSaved }) => {
  const { data: states = [] } = useGetStateTaxRatesQuery();
  const [upsert, { isLoading: saving }] = useUpsertProjectFinancialMutation();

  const fin = project.financials;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [editing, setEditing]         = useState(false);
  const [billRate, setBillRate]       = useState(fin?.billRate ?? 0);
  const [payRate, setPayRate]         = useState(fin?.payRate ?? 0);
  const [hoursWorked, setHoursWorked] = useState(fin?.hoursWorked ?? 0);
  const [projectStart, setProjectStart] = useState(toDateInput(fin?.projectStart ?? null));
  const [projectEnd, setProjectEnd]     = useState(toDateInput(fin?.projectEnd ?? null));
  const [stateCode, setStateCode]     = useState(fin?.stateCode ?? "");
  const [cashPct, setCashPct]         = useState(fin?.cashPct ?? 0);
  const [amountPaid, setAmountPaid]   = useState(fin?.amountPaid ?? 0);
  const [notes, setNotes]             = useState(fin?.notes ?? "");

  useEffect(() => {
    if (fin) {
      setBillRate(fin.billRate);
      setPayRate(fin.payRate);
      setHoursWorked(fin.hoursWorked);
      setProjectStart(toDateInput(fin.projectStart));
      setProjectEnd(toDateInput(fin.projectEnd));
      setStateCode(fin.stateCode);
      setCashPct(fin.cashPct);
      setAmountPaid(fin.amountPaid);
      setNotes(fin.notes);
    }
  }, [fin]);

  // ── Computed values ─────────────────────────────────────────────────────────
  const stateTaxPct = useMemo(() => {
    const s = states.find((st) => st.code === stateCode);
    return s?.taxPct ?? 0;
  }, [states, stateCode]);

  const computed = useMemo(() => {
    const totalBilled  = billRate * hoursWorked;
    const totalPay     = payRate * hoursWorked;
    const marginAmount = totalBilled - totalPay;
    const marginPct    = totalBilled > 0 ? (marginAmount / totalBilled) * 100 : 0;
    const taxAmount    = (totalPay * stateTaxPct) / 100;
    const cashAmount   = (totalPay * cashPct) / 100;
    const netPayable   = totalPay - taxAmount - cashAmount;
    const amountPending = netPayable - amountPaid;
    const paidPct      = netPayable > 0 ? clamp((amountPaid / netPayable) * 100, 0, 100) : 0;
    return { totalBilled, totalPay, marginAmount, marginPct, taxAmount, cashAmount, netPayable, amountPending, paidPct };
  }, [billRate, payRate, hoursWorked, stateTaxPct, cashPct, amountPaid]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      await upsert({
        applicationId: project.id,
        candidateId,
        candidateEmail,
        billRate,
        payRate,
        hoursWorked,
        projectStart: projectStart || undefined,
        projectEnd:   projectEnd   || undefined,
        stateCode,
        cashPct,
        amountPaid,
        notes,
      }).unwrap();
      setEditing(false);
      onSaved?.();
    } catch (e: any) {
      alert(e?.data?.error || "Failed to save financial data");
    }
  }, [upsert, project.id, candidateId, candidateEmail, billRate, payRate, hoursWorked, projectStart, projectEnd, stateCode, cashPct, amountPaid, notes, onSaved]);

  // ── Read-only values (from saved fin or computed) ────────────────────────────
  const display = fin
    ? {
        totalBilled:    fin.totalBilled,
        totalPay:       fin.totalPay,
        marginAmount:   fin.totalBilled - fin.totalPay,
        marginPct:      fin.totalBilled > 0 ? ((fin.totalBilled - fin.totalPay) / fin.totalBilled) * 100 : 0,
        taxAmount:      fin.taxAmount,
        taxPct:         fin.stateTaxPct,
        cashAmount:     fin.cashAmount,
        cashPct:        fin.cashPct,
        netPayable:     fin.netPayable,
        amountPaid:     fin.amountPaid,
        amountPending:  fin.amountPending,
        paidPct:        fin.netPayable > 0 ? clamp((fin.amountPaid / fin.netPayable) * 100, 0, 100) : 0,
        billRate:       fin.billRate,
        payRate:        fin.payRate,
        hoursWorked:    fin.hoursWorked,
        stateCode:      fin.stateCode,
        stateName:      states.find((s) => s.code === fin.stateCode)?.name ?? fin.stateCode,
      }
    : null;

  const isActive = project.is_active;

  // ── EDIT mode ────────────────────────────────────────────────────────────────
  if (editing || !fin) {
    const editStateTaxPct = stateTaxPct;
    const editMarginAmount = computed.totalBilled - computed.totalPay;
    const editMarginPct = computed.totalBilled > 0 ? (editMarginAmount / computed.totalBilled) * 100 : 0;

    return (
      <div className={`pf-root pf-card pf-card-editing${!isActive ? " pf-card-closed" : ""}`}>
        {/* Card header */}
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-job-title">{project.job_title}</span>
            <div className="pf-card-meta">
              <span className={`pf-status-badge ${isActive ? "pf-status-active" : "pf-status-closed"}`}>
                {isActive ? "Active" : "Closed"}
              </span>
              {project.vendor_email && (
                <span className="pf-meta-item">{project.vendor_email}</span>
              )}
              {project.location && (
                <>
                  <span className="pf-meta-sep">·</span>
                  <span className="pf-meta-item">{project.location}</span>
                </>
              )}
              {project.job_type && (
                <>
                  <span className="pf-meta-sep">·</span>
                  <span className="pf-meta-item">
                    {project.job_type}{project.job_sub_type ? ` › ${project.job_sub_type}` : ""}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="pf-card-header-right">
            {fin && (
              <button type="button" className="pf-btn pf-btn-cancel" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
            <button type="button" className="pf-btn pf-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Live preview strip */}
        <PreviewStrip
          totalBilled={computed.totalBilled}
          totalPay={computed.totalPay}
          marginAmount={editMarginAmount}
          marginPct={editMarginPct}
          taxAmount={computed.taxAmount}
          taxPct={editStateTaxPct}
          cashAmount={computed.cashAmount}
          cashPct={cashPct}
          netPayable={computed.netPayable}
          amountPaid={amountPaid}
          amountPending={computed.amountPending}
        />

        {/* Edit form */}
        <div className="pf-edit-form">
          {/* Section 1: Rates & Hours */}
          <div className="pf-edit-section-title">Billing &amp; Hours</div>
          <div className="pf-edit-grid" style={{ marginBottom: 6 }}>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-bill-${project.id}`}>
                Bill Rate ($/hr)
              </label>
              <input
                id={`pf-bill-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={billRate || ""}
                onChange={(e) => setBillRate(Number(e.target.value) || 0)}
                min={0} step={0.01}
                placeholder="0.00"
              />
            </div>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-pay-${project.id}`}>
                Pay Rate ($/hr)
              </label>
              <input
                id={`pf-pay-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={payRate || ""}
                onChange={(e) => setPayRate(Number(e.target.value) || 0)}
                min={0} step={0.01}
                placeholder="0.00"
              />
            </div>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-hours-${project.id}`}>
                Hours Worked
              </label>
              <input
                id={`pf-hours-${project.id}`}
                type="number"
                className="pf-field-input"
                value={hoursWorked || ""}
                onChange={(e) => setHoursWorked(Number(e.target.value) || 0)}
                min={0} step={0.5}
                placeholder="0"
              />
            </div>
            <div className="pf-field">
              <span className="pf-field-label">Your Margin</span>
              <span className="pf-margin-hint">
                {fmt(editMarginAmount)} &nbsp;({fmtPct(editMarginPct)})
              </span>
            </div>
          </div>

          {/* Section 2: Deductions */}
          <div className="pf-edit-section-title" style={{ marginTop: 14 }}>Deductions &amp; Tax</div>
          <div className="pf-edit-grid pf-edit-grid-3" style={{ marginBottom: 6 }}>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-state-${project.id}`}>
                Work State (USA)
                {stateCode && (
                  <span className="pf-field-hint">Tax: {editStateTaxPct}%</span>
                )}
              </label>
              <select
                id={`pf-state-${project.id}`}
                className="pf-field-select"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
              >
                <option value="">— Select State —</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name} ({s.taxPct}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-cash-${project.id}`}>
                Additional Withholding %
              </label>
              <input
                id={`pf-cash-${project.id}`}
                type="number"
                className="pf-field-input"
                value={cashPct || ""}
                onChange={(e) => setCashPct(Number(e.target.value) || 0)}
                min={0} max={100} step={0.1}
                placeholder="0.0"
              />
            </div>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-paid-${project.id}`}>
                Amount Paid to Date ($)
              </label>
              <input
                id={`pf-paid-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                min={0} step={0.01}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Section 3: Dates */}
          <div className="pf-edit-section-title" style={{ marginTop: 14 }}>Project Timeline</div>
          <div className="pf-edit-grid pf-edit-grid-3" style={{ marginBottom: 6 }}>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-start-${project.id}`}>Start Date</label>
              <input
                id={`pf-start-${project.id}`}
                type="date"
                className="pf-field-input"
                value={projectStart}
                onChange={(e) => setProjectStart(e.target.value)}
              />
            </div>
            <div className="pf-field">
              <label className="pf-field-label" htmlFor={`pf-end-${project.id}`}>End Date</label>
              <input
                id={`pf-end-${project.id}`}
                type="date"
                className="pf-field-input"
                value={projectEnd}
                onChange={(e) => setProjectEnd(e.target.value)}
              />
            </div>
            <div className="pf-field pf-edit-grid-full" style={{ gridColumn: "auto" }}>
              <label className="pf-field-label" htmlFor={`pf-notes-${project.id}`}>Notes</label>
              <textarea
                id={`pf-notes-${project.id}`}
                className="pf-field-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes about this engagement…"
              />
            </div>
          </div>
        </div>

        {/* Context footer */}
        <div className="pf-edit-context">
          {project.vendor_email && (
            <span className="pf-edit-context-item">Vendor: {project.vendor_email}</span>
          )}
          {project.location && (
            <span className="pf-edit-context-item">Location: {project.location}</span>
          )}
          <span className="pf-edit-context-item">
            Applied: {fmtDate(project.applied_at)}
          </span>
        </div>
      </div>
    );
  }

  // ── READ mode ────────────────────────────────────────────────────────────────
  const d = display!;
  const isOverpaid = d.amountPending < 0;

  return (
    <div className={`pf-root pf-card${!isActive ? " pf-card-closed" : ""}`}>
      {/* Card header */}
      <div className="pf-card-header">
        <div className="pf-card-header-left">
          <span className="pf-job-title">{project.job_title}</span>
          <div className="pf-card-meta">
            <span className={`pf-status-badge ${isActive ? "pf-status-active" : "pf-status-closed"}`}>
              {isActive ? "Active" : "Closed"}
            </span>
            {project.vendor_email && (
              <span className="pf-meta-item">{project.vendor_email}</span>
            )}
            {project.location && (
              <>
                <span className="pf-meta-sep">·</span>
                <span className="pf-meta-item">{project.location}</span>
              </>
            )}
            {project.job_type && (
              <>
                <span className="pf-meta-sep">·</span>
                <span className="pf-meta-item">
                  {project.job_type}{project.job_sub_type ? ` › ${project.job_sub_type}` : ""}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="pf-card-header-right">
          <button type="button" className="pf-btn pf-btn-edit" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </div>

      {/* Two-column financial body */}
      <div className="pf-financial-body">
        {/* LEFT: Billing Summary */}
        <div className="pf-billing-panel">
          <div className="pf-panel-title">Billing Summary</div>

          <div className="pf-rate-row">
            <span className="pf-rate-label">Bill Rate</span>
            <span className="pf-rate-value">${d.billRate}/hr</span>
          </div>
          <div className="pf-rate-row">
            <span className="pf-rate-label">Pay Rate</span>
            <span className="pf-rate-value">${d.payRate}/hr</span>
          </div>
          <div className="pf-rate-row">
            <span className="pf-rate-label">Hours Worked</span>
            <span className="pf-rate-value">{d.hoursWorked.toLocaleString()}</span>
          </div>

          <hr className="pf-divider" />

          <div className="pf-total-row">
            <span className="pf-total-row-label">Vendor Credited</span>
            <span className="pf-value-billed">{fmt(d.totalBilled)}</span>
          </div>
          <div className="pf-total-row">
            <span className="pf-total-row-label">Candidate Gross Pay</span>
            <span className="pf-value-pay">{fmt(d.totalPay)}</span>
          </div>

          {/* Marketer margin highlight box */}
          <div className="pf-margin-box">
            <span className="pf-margin-label">Your Margin</span>
            <div className="pf-margin-values">
              <span className="pf-margin-amount">{fmt(d.marginAmount)}</span>
              <span className="pf-margin-pct">{fmtPct(d.marginPct)} of billed</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Candidate Compensation */}
        <div className="pf-compensation-panel">
          <div className="pf-panel-title">Candidate Compensation</div>

          <div className="pf-comp-row">
            <span className="pf-comp-label">Gross Pay</span>
            <span className="pf-value-gross">{fmt(d.totalPay)}</span>
          </div>
          {d.taxAmount > 0 && (
            <div className="pf-comp-row">
              <span className="pf-comp-label">
                State Tax ({d.stateName || d.stateCode} {fmtPct(d.taxPct)})
              </span>
              <span className="pf-value-deduction">−{fmt(d.taxAmount)}</span>
            </div>
          )}
          {d.cashAmount > 0 && (
            <div className="pf-comp-row">
              <span className="pf-comp-label">Withholding ({fmtPct(d.cashPct)})</span>
              <span className="pf-value-deduction">−{fmt(d.cashAmount)}</span>
            </div>
          )}

          {/* Net payable highlight box */}
          <div className="pf-net-box">
            <span className="pf-net-label">Net Payable</span>
            <span className="pf-net-amount">{fmt(d.netPayable)}</span>
          </div>

          {/* Payment tracker */}
          <div className="pf-payment-tracker">
            <div className="pf-payment-row">
              <span className="pf-payment-label">Paid to Date</span>
              <span className="pf-value-paid">{fmt(d.amountPaid)}</span>
            </div>
            <div className="pf-payment-row">
              <span className="pf-payment-label">
                {isOverpaid ? "Overpaid" : "Outstanding"}
              </span>
              <span className={isOverpaid ? "pf-value-pending-neg" : "pf-value-pending-pos"}>
                {isOverpaid ? `+${fmt(Math.abs(d.amountPending))}` : fmt(d.amountPending)}
              </span>
            </div>
            <div className="pf-progress-wrap">
              <div
                className={`pf-progress-fill${isOverpaid ? " overpaid" : ""}`}
                style={{ width: `${d.paidPct}%` }}
              />
            </div>
            <div className="pf-progress-footer">
              <span>{fmtPct(d.paidPct)} paid</span>
              {d.hoursWorked > 0 && (
                <span>{d.hoursWorked.toLocaleString()} hrs</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="pf-card-footer">
        {(fin.projectStart || fin.projectEnd) && (
          <span className="pf-footer-item">
            Project: {fmtDate(fin.projectStart)}
            {fin.projectEnd ? ` — ${fmtDate(fin.projectEnd)}` : " — ongoing"}
          </span>
        )}
        {d.stateCode && (
          <>
            <span className="pf-meta-sep">·</span>
            <span className="pf-footer-item">
              {d.stateName || d.stateCode}
              {d.taxPct > 0 ? ` (${fmtPct(d.taxPct)} tax)` : " (no income tax)"}
            </span>
          </>
        )}
        {fin.notes && (
          <span className="pf-footer-notes">{fin.notes}</span>
        )}
      </div>
    </div>
  );
};

export default ProjectFinancialForm;
