import React from "react";
import "./MatchDataTable.css";

export interface MatchRow {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  type: string;
  payPerHour: string;
  experience: string;
  matchPercentage: number;
  location: string;
  pokeTargetEmail: string;
  pokeTargetName: string;
  pokeSubjectContext: string;
}

interface MatchDataTableProps {
  title: string;
  titleIcon?: string;
  rows: MatchRow[];
  loading: boolean;
  error: string | null;
  pokeLoading: boolean;
  pokeSuccessMessage: string | null;
  pokeError: string | null;
  onPoke: (row: MatchRow) => void;
}

const formatType = (value: string) => value.replace(/_/g, " ");

const getMeterClass = (pct: number) => {
  if (pct >= 75) return "matchdb-meter-fill matchdb-meter-fill-high";
  if (pct >= 45) return "matchdb-meter-fill matchdb-meter-fill-mid";
  return "matchdb-meter-fill matchdb-meter-fill-low";
};

const MatchDataTable: React.FC<MatchDataTableProps> = ({
  title,
  titleIcon = "📋",
  rows,
  loading,
  error,
  pokeLoading,
  pokeSuccessMessage,
  pokeError,
  onPoke,
}) => {
  return (
    <div className="matchdb-panel">
      {/* Panel Title Bar */}
      <div className="matchdb-panel-title">
        <span className="matchdb-panel-title-icon">{titleIcon}</span>
        <span className="matchdb-panel-title-text">{title}</span>
        <span className="matchdb-panel-title-meta">
          {loading
            ? "Loading..."
            : `${rows.length} record${rows.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Alerts */}
      {(pokeSuccessMessage || pokeError || error) && (
        <div className="matchdb-alerts">
          {pokeSuccessMessage && (
            <div className="matchdb-alert matchdb-alert-success">
              <span>✓</span> {pokeSuccessMessage}
            </div>
          )}
          {pokeError && (
            <div className="matchdb-alert matchdb-alert-error">
              <span>✕</span> {pokeError}
            </div>
          )}
          {error && (
            <div className="matchdb-alert matchdb-alert-error">
              <span>✕</span> {error}
            </div>
          )}
        </div>
      )}

      {/* Scrollable Table */}
      <div className="matchdb-table-wrap">
        <table className="matchdb-table">
          <colgroup>
            {/* Checkbox */}
            <col style={{ width: "22px" }} />
            {/* Name */}
            <col style={{ width: "11%" }} />
            {/* Company */}
            <col className="col-company" style={{ width: "10%" }} />
            {/* Email */}
            <col className="col-email" style={{ width: "11%" }} />
            {/* Phone */}
            <col className="col-phone" style={{ width: "9%" }} />
            {/* Role */}
            <col style={{ width: "12%" }} />
            {/* Type */}
            <col style={{ width: "8%" }} />
            {/* Pay/Hr */}
            <col className="col-pay" style={{ width: "7%" }} />
            {/* Exp */}
            <col className="col-experience" style={{ width: "6%" }} />
            {/* Match */}
            <col style={{ width: "12%" }} />
            {/* Location */}
            <col className="col-location" style={{ width: "8%" }} />
            {/* Poke */}
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  style={{ margin: 0 }}
                  aria-label="Select all"
                />
              </th>
              <th>
                Name <span className="th-sort">▲</span>
              </th>
              <th className="col-company">Company</th>
              <th className="col-email">Mail ID</th>
              <th className="col-phone">Ph No</th>
              <th>Role</th>
              <th>Type</th>
              <th className="col-pay">Pay/Hr</th>
              <th className="col-experience">Exp</th>
              <th>Match Meter</th>
              <th className="col-location">Location</th>
              <th>Poke</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="matchdb-loading">
                  Loading records
                  <span className="matchdb-loading-dot">.</span>
                  <span
                    className="matchdb-loading-dot"
                    style={{ animationDelay: "0.2s" }}
                  >
                    .
                  </span>
                  <span
                    className="matchdb-loading-dot"
                    style={{ animationDelay: "0.4s" }}
                  >
                    .
                  </span>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="matchdb-empty">
                  MySQL returned an empty result set (i.e. zero rows).
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const safePct = Math.max(0, Math.min(100, row.matchPercentage));
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        style={{ margin: 0 }}
                        aria-label="Select row"
                      />
                    </td>
                    <td title={row.name}>{row.name}</td>
                    <td className="col-company" title={row.company}>
                      {row.company}
                    </td>
                    <td className="col-email" title={row.email}>
                      <a
                        href={`mailto:${row.email}`}
                        style={{ color: "#2a5fa0", textDecoration: "none" }}
                        title={row.email}
                      >
                        {row.email}
                      </a>
                    </td>
                    <td className="col-phone" title={row.phone}>
                      {row.phone}
                    </td>
                    <td title={row.role}>{row.role}</td>
                    <td>
                      <span className="matchdb-type-pill">
                        {formatType(row.type)}
                      </span>
                    </td>
                    <td className="col-pay">{row.payPerHour}</td>
                    <td className="col-experience">{row.experience}</td>
                    <td>
                      <div className="matchdb-meter">
                        <div className="matchdb-meter-row">
                          <span className="matchdb-meter-label">
                            {row.matchPercentage}%
                          </span>
                          <span className="matchdb-meter-track">
                            <span
                              className={getMeterClass(safePct)}
                              style={{ width: `${safePct}%` }}
                            />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="col-location" title={row.location}>
                      {row.location}
                    </td>
                    <td>
                      <button
                        className="matchdb-btn matchdb-btn-poke"
                        type="button"
                        disabled={pokeLoading}
                        onClick={() => onPoke(row)}
                        title={`Poke ${row.pokeTargetName}`}
                      >
                        {pokeLoading ? "..." : "Poke"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <div className="matchdb-footnote">
        <span>
          Showing {rows.length} record{rows.length !== 1 ? "s" : ""}
        </span>
        <span className="matchdb-footnote-sep">|</span>
        <span>Query time: —</span>
        <span className="matchdb-footnote-sep">|</span>
        <span>InnoDB</span>
      </div>
    </div>
  );
};

export default MatchDataTable;
