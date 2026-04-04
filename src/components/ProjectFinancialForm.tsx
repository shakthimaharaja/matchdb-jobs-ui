import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "matchdb-component-library";
import { getApiErrorMessage } from "../utils";
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
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtPct = (v: number) =>
  `${v.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

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

function pendingColor(amount: number): string {
  if (amount > 0) return "orange";
  if (amount < 0) return "red";
  return "green";
}

const PreviewStrip: React.FC<PreviewProps> = ({
  totalBilled,
  totalPay,
  marginAmount,
  marginPct,
  taxAmount,
  taxPct,
  cashAmount,
  cashPct,
  netPayable,
  amountPaid: _amountPaid,
  amountPending,
}) => (
  <div className="pf-preview-strip">
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Vendor Billed</span>
      <span className="pf-preview-value green">{fmt(totalBilled)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Gross Pay</span>
      <span className="pf-preview-value blue">{fmt(totalPay)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Your Margin</span>
      <span className="pf-preview-value teal">
        {fmt(marginAmount)} ({fmtPct(marginPct)})
      </span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">State Tax ({fmtPct(taxPct)})</span>
      <span className="pf-preview-value red">-{fmt(taxAmount)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Withholding ({fmtPct(cashPct)})</span>
      <span className="pf-preview-value red">-{fmt(cashAmount)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Net Payable</span>
      <span className="pf-preview-value blue">{fmt(netPayable)}</span>
    </div>
    <div className="pf-preview-divider" />
    <div className="pf-preview-metric">
      <span className="pf-preview-label">Outstanding</span>
      <span className={`pf-preview-value ${pendingColor(amountPending)}`}>
        {fmt(Math.abs(amountPending))}
      </span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ProjectFinancialForm: React.FC<Props> = ({
  project,
  candidateId,
  candidateEmail,
  onSaved,
}) => {
  const { data: states = [] } = useGetStateTaxRatesQuery();
  const [upsert, { isLoading: saving }] = useUpsertProjectFinancialMutation();

  const fin = project.financials;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [billRate, setBillRate] = useState(fin?.billRate ?? 0);
  const [payRate, setPayRate] = useState(fin?.payRate ?? 0);
  const [hoursWorked, setHoursWorked] = useState(fin?.hoursWorked ?? 0);
  const [projectStart, setProjectStart] = useState(
    toDateInput(fin?.projectStart ?? null),
  );
  const [projectEnd, setProjectEnd] = useState(
    toDateInput(fin?.projectEnd ?? null),
  );
  const [stateCode, setStateCode] = useState(fin?.stateCode ?? "");
  const [cashPct, setCashPct] = useState(fin?.cashPct ?? 0);
  const [amountPaid, setAmountPaid] = useState(fin?.amountPaid ?? 0);
  const [notes, setNotes] = useState(fin?.notes ?? "");
  const [clientName, setClientName] = useState(fin?.clientName ?? "");
  const [vendorCompanyName, setVendorCompanyName] = useState(
    fin?.vendorCompanyName ?? "",
  );
  const [implementationPartner, setImplementationPartner] = useState(
    fin?.implementationPartner ?? "",
  );
  const [pocName, setPocName] = useState(fin?.pocName ?? "");
  const [pocEmail, setPocEmail] = useState(fin?.pocEmail ?? "");

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
      setClientName(fin.clientName ?? "");
      setVendorCompanyName(fin.vendorCompanyName ?? "");
      setImplementationPartner(fin.implementationPartner ?? "");
      setPocName(fin.pocName ?? "");
      setPocEmail(fin.pocEmail ?? "");
    }
  }, [fin]);

  // ── Computed values ─────────────────────────────────────────────────────────
  const stateTaxPct = useMemo(() => {
    const s = states.find((st) => st.code === stateCode);
    return s?.taxPct ?? 0;
  }, [states, stateCode]);

  const computed = useMemo(() => {
    const totalBilled = billRate * hoursWorked;
    const totalPay = payRate * hoursWorked;
    const marginAmount = totalBilled - totalPay;
    const marginPct = totalBilled > 0 ? (marginAmount / totalBilled) * 100 : 0;
    const taxAmount = (totalPay * stateTaxPct) / 100;
    const cashAmount = (totalPay * cashPct) / 100;
    const netPayable = totalPay - taxAmount - cashAmount;
    const amountPending = netPayable - amountPaid;
    const paidPct =
      netPayable > 0 ? clamp((amountPaid / netPayable) * 100, 0, 100) : 0;
    return {
      totalBilled,
      totalPay,
      marginAmount,
      marginPct,
      taxAmount,
      cashAmount,
      netPayable,
      amountPending,
      paidPct,
    };
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
        projectEnd: projectEnd || undefined,
        stateCode,
        cashPct,
        amountPaid,
        notes,
        clientName: clientName || undefined,
        vendorCompanyName: vendorCompanyName || undefined,
        implementationPartner: implementationPartner || undefined,
        pocName: pocName || undefined,
        pocEmail: pocEmail || undefined,
      }).unwrap();
      setEditing(false);
      onSaved?.();
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, "Failed to save financial data"));
    }
  }, [
    upsert,
    project.id,
    candidateId,
    candidateEmail,
    billRate,
    payRate,
    hoursWorked,
    projectStart,
    projectEnd,
    stateCode,
    cashPct,
    amountPaid,
    notes,
    clientName,
    vendorCompanyName,
    implementationPartner,
    pocName,
    pocEmail,
    onSaved,
  ]);

  // ── Read-only values (from saved fin or computed) ────────────────────────────
  const display = fin
    ? {
        totalBilled: fin.totalBilled,
        totalPay: fin.totalPay,
        marginAmount: fin.totalBilled - fin.totalPay,
        marginPct:
          fin.totalBilled > 0
            ? ((fin.totalBilled - fin.totalPay) / fin.totalBilled) * 100
            : 0,
        taxAmount: fin.taxAmount,
        taxPct: fin.stateTaxPct,
        cashAmount: fin.cashAmount,
        cashPct: fin.cashPct,
        netPayable: fin.netPayable,
        amountPaid: fin.amountPaid,
        amountPending: fin.amountPending,
        paidPct:
          fin.netPayable > 0
            ? clamp((fin.amountPaid / fin.netPayable) * 100, 0, 100)
            : 0,
        billRate: fin.billRate,
        payRate: fin.payRate,
        hoursWorked: fin.hoursWorked,
        stateCode: fin.stateCode,
        stateName:
          states.find((s) => s.code === fin.stateCode)?.name ?? fin.stateCode,
      }
    : null;

  const isActive = project.is_active;
  const closedCls = isActive ? "" : " pf-card-closed";
  const statusCls = isActive ? "pf-status-active" : "pf-status-closed";
  const statusText = isActive ? "Active" : "Closed";

  // ── Card header (shared structure) ──────────────────────────────────────────
  function renderCardMeta() {
    return (
      <div className="pf-card-meta">
        <span className={`pf-status-badge ${statusCls}`}>{statusText}</span>
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
              {project.job_type}
              {project.job_sub_type ? ` › ${project.job_sub_type}` : ""}
            </span>
          </>
        )}
      </div>
    );
  }

  // ── EDIT mode ────────────────────────────────────────────────────────────────
  function renderEditMode() {
    const editStateTaxPct = stateTaxPct;
    const editMarginAmount = computed.totalBilled - computed.totalPay;
    const editMarginPct =
      computed.totalBilled > 0
        ? (editMarginAmount / computed.totalBilled) * 100
        : 0;

    return (
      <div className={`pf-root pf-card pf-card-editing${closedCls}`}>
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-job-title">{project.job_title}</span>
            {renderCardMeta()}
          </div>
          <div className="pf-card-header-right">
            {fin && (
              <Button size="xs" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              size="xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

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

        <div className="pf-edit-form">
          <div className="pf-edit-section-title">Vendor &amp; Client</div>
          <div className="pf-edit-grid u-mb-6" >
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-vendor-company-${project.id}`}
              >
                Vendor Company Name
              </label>
              <input
                id={`pf-vendor-company-${project.id}`}
                type="text"
                className="pf-field-input"
                value={vendorCompanyName}
                onChange={(e) => setVendorCompanyName(e.target.value)}
                placeholder="e.g. Acme Staffing"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-client-name-${project.id}`}
              >
                Client Name
              </label>
              <input
                id={`pf-client-name-${project.id}`}
                type="text"
                className="pf-field-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Google, Amazon"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-impl-partner-${project.id}`}
              >
                Implementation Partner
              </label>
              <input
                id={`pf-impl-partner-${project.id}`}
                type="text"
                className="pf-field-input"
                value={implementationPartner}
                onChange={(e) => setImplementationPartner(e.target.value)}
                placeholder="e.g. Intermediary vendor"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-poc-name-${project.id}`}
              >
                POC Name
              </label>
              <input
                id={`pf-poc-name-${project.id}`}
                type="text"
                className="pf-field-input"
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-poc-email-${project.id}`}
              >
                POC Email
              </label>
              <input
                id={`pf-poc-email-${project.id}`}
                type="email"
                className="pf-field-input"
                value={pocEmail}
                onChange={(e) => setPocEmail(e.target.value)}
                placeholder="e.g. john@client.com"
              />
            </div>
          </div>

          <div className="pf-edit-section-title">Billing &amp; Hours</div>
          <div className="pf-edit-grid u-mb-6" >
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-bill-${project.id}`}
              >
                Bill Rate ($/hr)
              </label>
              <input
                id={`pf-bill-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={billRate || ""}
                onChange={(e) => setBillRate(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                placeholder="0.00"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-pay-${project.id}`}
              >
                Pay Rate ($/hr)
              </label>
              <input
                id={`pf-pay-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={payRate || ""}
                onChange={(e) => setPayRate(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                placeholder="0.00"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-hours-${project.id}`}
              >
                Hours Worked
              </label>
              <input
                id={`pf-hours-${project.id}`}
                type="number"
                className="pf-field-input"
                value={hoursWorked || ""}
                onChange={(e) => setHoursWorked(Number(e.target.value) || 0)}
                min={0}
                step={0.5}
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

          <div className="pf-edit-section-title" style={{ marginTop: 14 }}>
            Deductions &amp; Tax
          </div>
          <div
            className="pf-edit-grid pf-edit-grid-3 u-mb-6"
            
          >
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-state-${project.id}`}
              >
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
              <label
                className="pf-field-label"
                htmlFor={`pf-cash-${project.id}`}
              >
                Additional Withholding %
              </label>
              <input
                id={`pf-cash-${project.id}`}
                type="number"
                className="pf-field-input"
                value={cashPct || ""}
                onChange={(e) => setCashPct(Number(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.1}
                placeholder="0.0"
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-paid-${project.id}`}
              >
                Amount Paid to Date ($)
              </label>
              <input
                id={`pf-paid-${project.id}`}
                type="number"
                className="pf-field-input pf-input-rate"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="pf-edit-section-title" style={{ marginTop: 14 }}>
            Project Timeline
          </div>
          <div
            className="pf-edit-grid pf-edit-grid-3 u-mb-6"
            
          >
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-start-${project.id}`}
              >
                Start Date
              </label>
              <input
                id={`pf-start-${project.id}`}
                type="date"
                className="pf-field-input"
                value={projectStart}
                onChange={(e) => setProjectStart(e.target.value)}
              />
            </div>
            <div className="pf-field">
              <label
                className="pf-field-label"
                htmlFor={`pf-end-${project.id}`}
              >
                End Date
              </label>
              <input
                id={`pf-end-${project.id}`}
                type="date"
                className="pf-field-input"
                value={projectEnd}
                onChange={(e) => setProjectEnd(e.target.value)}
              />
            </div>
            <div
              className="pf-field pf-edit-grid-full"
              style={{ gridColumn: "auto" }}
            >
              <label
                className="pf-field-label"
                htmlFor={`pf-notes-${project.id}`}
              >
                Notes
              </label>
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

        <div className="pf-edit-context">
          {project.vendor_email && (
            <span className="pf-edit-context-item">
              Vendor: {project.vendor_email}
            </span>
          )}
          {project.location && (
            <span className="pf-edit-context-item">
              Location: {project.location}
            </span>
          )}
          <span className="pf-edit-context-item">
            Applied: {fmtDate(project.applied_at)}
          </span>
        </div>
      </div>
    );
  }

  if (editing || !fin) return renderEditMode();

  // ── READ mode ────────────────────────────────────────────────────────────────
  function renderReadMode() {
    const d = display;
    if (!d) return null;
    const isOverpaid = d.amountPending < 0;

    return (
      <div className={`pf-root pf-card${closedCls}`}>
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-job-title">{project.job_title}</span>
            {renderCardMeta()}
          </div>
          <div className="pf-card-header-right">
            <Button size="xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>

        <div className="pf-financial-body">
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
              <span className="pf-rate-value">
                {d.hoursWorked.toLocaleString()}
              </span>
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

            <div className="pf-margin-box">
              <span className="pf-margin-label">Your Margin</span>
              <div className="pf-margin-values">
                <span className="pf-margin-amount">{fmt(d.marginAmount)}</span>
                <span className="pf-margin-pct">
                  {fmtPct(d.marginPct)} of billed
                </span>
              </div>
            </div>
          </div>

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
                <span className="pf-comp-label">
                  Withholding ({fmtPct(d.cashPct)})
                </span>
                <span className="pf-value-deduction">−{fmt(d.cashAmount)}</span>
              </div>
            )}

            <div className="pf-net-box">
              <span className="pf-net-label">Net Payable</span>
              <span className="pf-net-amount">{fmt(d.netPayable)}</span>
            </div>

            <div className="pf-payment-tracker">
              <div className="pf-payment-row">
                <span className="pf-payment-label">Paid to Date</span>
                <span className="pf-value-paid">{fmt(d.amountPaid)}</span>
              </div>
              <div className="pf-payment-row">
                <span className="pf-payment-label">
                  {isOverpaid ? "Overpaid" : "Outstanding"}
                </span>
                <span
                  className={
                    isOverpaid ? "pf-value-pending-neg" : "pf-value-pending-pos"
                  }
                >
                  {isOverpaid
                    ? `+${fmt(Math.abs(d.amountPending))}`
                    : fmt(d.amountPending)}
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

        <div className="pf-card-footer">
          {(fin?.projectStart || fin?.projectEnd) && (
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
                {d.taxPct > 0
                  ? ` (${fmtPct(d.taxPct)} tax)`
                  : " (no income tax)"}
              </span>
            </>
          )}
          {fin?.notes && <span className="pf-footer-notes">{fin.notes}</span>}
        </div>
      </div>
    );
  }

  return renderReadMode();
};

export default ProjectFinancialForm;
