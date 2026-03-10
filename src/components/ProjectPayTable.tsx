import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useGetStateTaxRatesQuery,
  useUpsertProjectFinancialMutation,
  type CandidateDetailProject,
  type ProjectFinancialData,
} from "../api/jobsApi";
import "./ProjectFinancialForm.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v < 0
    ? `-$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtC = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
};

const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toISOString().split("T")[0]; } catch { return ""; }
};

// ─── Pay period type ──────────────────────────────────────────────────────────

interface PayPeriod {
  label: string;
  hours: number;
  amountPaid: number;
}

// ─── Generate 12 monthly periods from project financials ─────────────────────

function generatePeriods(fin: ProjectFinancialData | null): PayPeriod[] {
  const now = new Date();
  const start = fin?.projectStart
    ? new Date(fin.projectStart)
    : new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const rawH = fin?.hoursWorked && fin.hoursWorked > 0 ? fin.hoursWorked / 12 : 80;
  // Slight realistic variation across months
  const variationPct = [1.0, 0.92, 1.08, 1.02, 0.94, 1.06, 1.0, 0.92, 1.08, 1.0, 0.94, 1.04];

  const periods: PayPeriod[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const rawHours = rawH * variationPct[i];
    return {
      label: `${MN[d.getMonth()]} ${d.getFullYear()}`,
      hours: Math.round(rawHours * 2) / 2, // round to nearest 0.5
      amountPaid: 0,
    };
  });

  if (fin?.hoursWorked && fin.hoursWorked > 0) {
    // Normalize hours to exactly match stored total
    const sumH = periods.reduce((a, p) => a + p.hours, 0);
    const scale = fin.hoursWorked / sumH;
    periods.forEach((p) => { p.hours = Math.round(p.hours * scale * 2) / 2; });
    const diff = fin.hoursWorked - periods.reduce((a, p) => a + p.hours, 0);
    if (Math.abs(diff) > 0) periods[11].hours = Math.round((periods[11].hours + diff) * 2) / 2;
  }

  if (fin?.amountPaid && fin.amountPaid > 0) {
    // Distribute paid proportionally by hours (front-loaded)
    const sumH = periods.reduce((a, p) => a + p.hours, 0);
    let allocated = 0;
    periods.forEach((p, i) => {
      if (i < 11) {
        const share = Math.round((p.hours / sumH) * fin.amountPaid * 100) / 100;
        p.amountPaid = share;
        allocated += share;
      } else {
        p.amountPaid = Math.round((fin.amountPaid - allocated) * 100) / 100;
      }
    });
  }

  return periods;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  project: CandidateDetailProject;
  candidateId: string;
  candidateEmail: string;
  onSaved?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const ProjectPayTable: React.FC<Props> = ({ project, candidateId, candidateEmail, onSaved }) => {
  const { data: states = [] } = useGetStateTaxRatesQuery();
  const [upsert, { isLoading: saving }] = useUpsertProjectFinancialMutation();
  const fin = project.financials;

  // ── Project-level settings ────────────────────────────────────────────────
  const [billRate, setBillRate]   = useState(fin?.billRate ?? 0);
  const [payRate, setPayRate]     = useState(fin?.payRate ?? 0);
  const [stateCode, setStateCode] = useState(fin?.stateCode ?? "");
  const [cashPct, setCashPct]     = useState(fin?.cashPct ?? 0);
  const [projectStart, setProjectStart] = useState(toDateInput(fin?.projectStart ?? null));
  const [projectEnd, setProjectEnd]     = useState(toDateInput(fin?.projectEnd ?? null));
  const [notes, setNotes]         = useState(fin?.notes ?? "");

  const [editingSettings, setEditingSettings] = useState(!fin);
  const [editingRows, setEditingRows]         = useState(!fin);

  // ── Pay period rows ───────────────────────────────────────────────────────
  const [periods, setPeriods] = useState<PayPeriod[]>(() => generatePeriods(fin));

  // Re-generate periods if fin changes (after save)
  const finRef = useRef(fin);
  useEffect(() => {
    if (fin && fin !== finRef.current) {
      finRef.current = fin;
      setBillRate(fin.billRate);
      setPayRate(fin.payRate);
      setStateCode(fin.stateCode);
      setCashPct(fin.cashPct);
      setProjectStart(toDateInput(fin.projectStart));
      setProjectEnd(toDateInput(fin.projectEnd));
      setNotes(fin.notes);
      setPeriods(generatePeriods(fin));
    }
  }, [fin]);

  // ── State tax lookup ──────────────────────────────────────────────────────
  const stateTaxPct = useMemo(
    () => states.find((s) => s.code === stateCode)?.taxPct ?? 0,
    [states, stateCode],
  );
  const stateName = useMemo(
    () => states.find((s) => s.code === stateCode)?.name ?? stateCode,
    [states, stateCode],
  );

  // ── Per-row computation ───────────────────────────────────────────────────
  const computeRow = useCallback(
    (period: PayPeriod) => {
      const billed     = billRate * period.hours;
      const gross      = payRate  * period.hours;
      const tax        = (gross * stateTaxPct) / 100;
      const withhold   = (gross * cashPct) / 100;
      const net        = gross - tax - withhold;
      const margin     = billed - gross;
      const balance    = net - period.amountPaid;
      return { billed, gross, tax, withhold, net, margin, balance };
    },
    [billRate, payRate, stateTaxPct, cashPct],
  );

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return periods.reduce(
      (acc, p) => {
        const r = computeRow(p);
        return {
          hours:       acc.hours       + p.hours,
          billed:      acc.billed      + r.billed,
          gross:       acc.gross       + r.gross,
          tax:         acc.tax         + r.tax,
          withhold:    acc.withhold    + r.withhold,
          net:         acc.net         + r.net,
          margin:      acc.margin      + r.margin,
          amountPaid:  acc.amountPaid  + p.amountPaid,
          balance:     acc.balance     + r.balance,
        };
      },
      { hours: 0, billed: 0, gross: 0, tax: 0, withhold: 0, net: 0, margin: 0, amountPaid: 0, balance: 0 },
    );
  }, [periods, computeRow]);

  // ── Row field updater ─────────────────────────────────────────────────────
  const setHours = (idx: number, v: number) =>
    setPeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, hours: v } : p)));
  const setPaid = (idx: number, v: number) =>
    setPeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, amountPaid: v } : p)));

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      await upsert({
        applicationId:  project.id,
        candidateId,
        candidateEmail,
        billRate,
        payRate,
        hoursWorked:    totals.hours,
        projectStart:   projectStart || undefined,
        projectEnd:     projectEnd   || undefined,
        stateCode,
        cashPct,
        amountPaid:     totals.amountPaid,
        notes,
      }).unwrap();
      setEditingSettings(false);
      setEditingRows(false);
      onSaved?.();
    } catch (e: any) {
      alert(e?.data?.error || "Failed to save");
    }
  }, [upsert, project.id, candidateId, candidateEmail, billRate, payRate, totals, projectStart, projectEnd, stateCode, cashPct, notes, onSaved]);

  const isActive = project.is_active;
  const paidPct  = totals.net > 0 ? Math.min(100, (totals.amountPaid / totals.net) * 100) : 0;

  return (
    <div className="ppt-root">
      {/* ── Settings bar ─────────────────────────────────────────────────── */}
      <div className="ppt-settings-bar">
        <div className="ppt-settings-left">
          {editingSettings ? (
            <>
              <div className="ppt-sfield">
                <label className="ppt-slabel">Bill Rate ($/hr)</label>
                <input
                  type="number" className="ppt-sinput ppt-sinput-rate"
                  value={billRate || ""} onChange={(e) => setBillRate(Number(e.target.value) || 0)}
                  min={0} step={0.01} placeholder="0.00"
                />
              </div>
              <div className="ppt-sfield">
                <label className="ppt-slabel">Pay Rate ($/hr)</label>
                <input
                  type="number" className="ppt-sinput ppt-sinput-rate"
                  value={payRate || ""} onChange={(e) => setPayRate(Number(e.target.value) || 0)}
                  min={0} step={0.01} placeholder="0.00"
                />
              </div>
              <div className="ppt-sfield ppt-sfield-wide">
                <label className="ppt-slabel">State (Work Location)</label>
                <select
                  className="ppt-sinput"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name} ({s.taxPct}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="ppt-sfield">
                <label className="ppt-slabel">Withholding %</label>
                <input
                  type="number" className="ppt-sinput"
                  value={cashPct || ""} onChange={(e) => setCashPct(Number(e.target.value) || 0)}
                  min={0} max={100} step={0.1} placeholder="0.0"
                />
              </div>
              <div className="ppt-sfield">
                <label className="ppt-slabel">Project Start</label>
                <input type="date" className="ppt-sinput" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} />
              </div>
              <div className="ppt-sfield">
                <label className="ppt-slabel">Project End</label>
                <input type="date" className="ppt-sinput" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="ppt-sval-group">
                <span className="ppt-sval-label">Bill Rate</span>
                <span className="ppt-sval ppt-sval-billed">${billRate}/hr</span>
              </div>
              <div className="ppt-sdivider" />
              <div className="ppt-sval-group">
                <span className="ppt-sval-label">Pay Rate</span>
                <span className="ppt-sval ppt-sval-pay">${payRate}/hr</span>
              </div>
              <div className="ppt-sdivider" />
              <div className="ppt-sval-group">
                <span className="ppt-sval-label">Margin</span>
                <span className="ppt-sval ppt-sval-margin">
                  ${billRate - payRate}/hr
                  {billRate > 0 ? ` (${(((billRate - payRate) / billRate) * 100).toFixed(1)}%)` : ""}
                </span>
              </div>
              <div className="ppt-sdivider" />
              <div className="ppt-sval-group">
                <span className="ppt-sval-label">State Tax</span>
                <span className="ppt-sval ppt-sval-tax">
                  {stateCode ? `${stateCode} ${stateTaxPct}%` : "—"}
                </span>
              </div>
              <div className="ppt-sdivider" />
              <div className="ppt-sval-group">
                <span className="ppt-sval-label">Withholding</span>
                <span className="ppt-sval ppt-sval-tax">{cashPct}%</span>
              </div>
              {(fin?.projectStart || fin?.projectEnd) && (
                <>
                  <div className="ppt-sdivider" />
                  <div className="ppt-sval-group">
                    <span className="ppt-sval-label">Period</span>
                    <span className="ppt-sval" style={{ color: "#374151", fontSize: 11 }}>
                      {fmtDate(fin?.projectStart ?? null)} — {fin?.projectEnd ? fmtDate(fin.projectEnd) : "ongoing"}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="ppt-settings-right">
          {editingSettings || editingRows ? (
            <>
              {fin && (
                <button type="button" className="pf-btn pf-btn-cancel"
                  onClick={() => { setEditingSettings(false); setEditingRows(false); setPeriods(generatePeriods(fin)); setBillRate(fin.billRate); setPayRate(fin.payRate); setStateCode(fin.stateCode); setCashPct(fin.cashPct); }}>
                  Cancel
                </button>
              )}
              <button type="button" className="pf-btn pf-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save All"}
              </button>
            </>
          ) : (
            <button type="button" className="pf-btn pf-btn-edit"
              onClick={() => { setEditingSettings(true); setEditingRows(true); }}>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Notes (only in edit mode) ─────────────────────────────────────── */}
      {editingSettings && (
        <div className="ppt-notes-bar">
          <label className="ppt-slabel">Notes</label>
          <input
            type="text" className="ppt-notes-input"
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Engagement notes…"
          />
        </div>
      )}

      {/* ── Totals summary strip ──────────────────────────────────────────── */}
      <div className="ppt-totals-strip">
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Total Hours</span>
          <span className="ppt-ts-value">{totals.hours.toLocaleString()}</span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Vendor Billed</span>
          <span className="ppt-ts-value ppt-ts-green">{fmtC(totals.billed)}</span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Your Margin</span>
          <span className="ppt-ts-value ppt-ts-teal">
            {fmtC(totals.margin)}
            {totals.billed > 0 ? ` (${((totals.margin / totals.billed) * 100).toFixed(1)}%)` : ""}
          </span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Gross Pay</span>
          <span className="ppt-ts-value ppt-ts-blue">{fmtC(totals.gross)}</span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Net Payable</span>
          <span className="ppt-ts-value ppt-ts-blue">{fmtC(totals.net)}</span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Paid to Date</span>
          <span className="ppt-ts-value ppt-ts-green">{fmtC(totals.amountPaid)}</span>
        </div>
        <div className="ppt-ts-divider" />
        <div className="ppt-ts-tile">
          <span className="ppt-ts-label">Outstanding</span>
          <span className={`ppt-ts-value ${totals.balance > 0 ? "ppt-ts-orange" : totals.balance < 0 ? "ppt-ts-red" : "ppt-ts-green"}`}>
            {totals.balance > 0 ? fmtC(totals.balance) : totals.balance < 0 ? `+${fmtC(Math.abs(totals.balance))}` : "$0"}
          </span>
        </div>
        <div className="ppt-ts-divider" />
        {/* Payment progress bar */}
        <div className="ppt-ts-tile ppt-ts-progress-tile">
          <span className="ppt-ts-label">{paidPct.toFixed(0)}% Paid</span>
          <div className="ppt-ts-progress-wrap">
            <div className="ppt-ts-progress-fill" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Pay Period Table ──────────────────────────────────────────────── */}
      <div className="ppt-table-wrap">
        <table className="ppt-table">
          <thead>
            <tr className="ppt-thead-row">
              <th className="ppt-th ppt-th-period">Pay Period</th>
              <th className="ppt-th ppt-th-num">Hours</th>
              <th className="ppt-th ppt-th-money">
                <span>Billed</span>
                {billRate > 0 && <span className="ppt-th-sub">@${billRate}/hr</span>}
              </th>
              <th className="ppt-th ppt-th-money">
                <span>Gross Pay</span>
                {payRate > 0 && <span className="ppt-th-sub">@${payRate}/hr</span>}
              </th>
              <th className="ppt-th ppt-th-money">
                <span>State Tax</span>
                {stateTaxPct > 0 && <span className="ppt-th-sub">{stateTaxPct}%</span>}
              </th>
              <th className="ppt-th ppt-th-money">
                <span>Withholding</span>
                {cashPct > 0 && <span className="ppt-th-sub">{cashPct}%</span>}
              </th>
              <th className="ppt-th ppt-th-money ppt-th-net">Net Pay</th>
              <th className="ppt-th ppt-th-money">Paid</th>
              <th className="ppt-th ppt-th-balance">Balance</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period, idx) => {
              const r = computeRow(period);
              const isFuture = r.net === 0 && period.hours === 0;
              return (
                <tr key={period.label} className={`ppt-row ${idx % 2 === 1 ? "ppt-row-alt" : ""}`}>
                  <td className="ppt-td ppt-td-period">{period.label}</td>

                  {/* Hours — editable */}
                  <td className="ppt-td ppt-td-num">
                    {editingRows ? (
                      <input
                        type="number"
                        className="ppt-cell-input ppt-cell-input-sm"
                        value={period.hours || ""}
                        onChange={(e) => setHours(idx, Number(e.target.value) || 0)}
                        min={0} step={0.5}
                      />
                    ) : (
                      <span>{period.hours}</span>
                    )}
                  </td>

                  <td className="ppt-td ppt-td-money ppt-val-billed">{fmt(r.billed)}</td>
                  <td className="ppt-td ppt-td-money ppt-val-gross">{fmt(r.gross)}</td>
                  <td className="ppt-td ppt-td-money ppt-val-deduct">
                    {r.tax > 0 ? `−${fmt(r.tax)}` : "—"}
                  </td>
                  <td className="ppt-td ppt-td-money ppt-val-deduct">
                    {r.withhold > 0 ? `−${fmt(r.withhold)}` : "—"}
                  </td>
                  <td className="ppt-td ppt-td-money ppt-val-net">{fmt(r.net)}</td>

                  {/* Paid — editable */}
                  <td className="ppt-td ppt-td-money">
                    {editingRows ? (
                      <input
                        type="number"
                        className="ppt-cell-input ppt-cell-input-sm ppt-cell-paid"
                        value={period.amountPaid || ""}
                        onChange={(e) => setPaid(idx, Number(e.target.value) || 0)}
                        min={0} step={0.01}
                      />
                    ) : (
                      <span className={period.amountPaid > 0 ? "ppt-val-paid" : "ppt-val-zero"}>
                        {period.amountPaid > 0 ? fmt(period.amountPaid) : "—"}
                      </span>
                    )}
                  </td>

                  {/* Balance */}
                  <td className={`ppt-td ppt-td-balance ${r.balance > 0.01 ? "ppt-bal-pos" : r.balance < -0.01 ? "ppt-bal-neg" : "ppt-bal-zero"}`}>
                    {Math.abs(r.balance) < 0.01 ? "✓" : r.balance > 0 ? fmt(r.balance) : `+${fmt(Math.abs(r.balance))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="ppt-tfoot-row">
              <td className="ppt-tf ppt-tf-label">TOTAL</td>
              <td className="ppt-tf ppt-tf-num">{totals.hours.toLocaleString()}</td>
              <td className="ppt-tf ppt-tf-money ppt-val-billed">{fmt(totals.billed)}</td>
              <td className="ppt-tf ppt-tf-money ppt-val-gross">{fmt(totals.gross)}</td>
              <td className="ppt-tf ppt-tf-money ppt-val-deduct">
                {totals.tax > 0 ? `−${fmt(totals.tax)}` : "—"}
              </td>
              <td className="ppt-tf ppt-tf-money ppt-val-deduct">
                {totals.withhold > 0 ? `−${fmt(totals.withhold)}` : "—"}
              </td>
              <td className="ppt-tf ppt-tf-money ppt-val-net">{fmt(totals.net)}</td>
              <td className="ppt-tf ppt-tf-money ppt-val-paid">{fmt(totals.amountPaid)}</td>
              <td className={`ppt-tf ppt-tf-balance ${totals.balance > 0.01 ? "ppt-bal-pos" : totals.balance < -0.01 ? "ppt-bal-neg" : "ppt-bal-zero"}`}>
                {Math.abs(totals.balance) < 0.01 ? "✓ Settled" : totals.balance > 0 ? fmt(totals.balance) : `Overpaid ${fmt(Math.abs(totals.balance))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Footer notes (read-only) ──────────────────────────────────────── */}
      {notes && !editingSettings && (
        <div className="ppt-notes-footer">
          {notes}
        </div>
      )}
    </div>
  );
};

export default ProjectPayTable;
