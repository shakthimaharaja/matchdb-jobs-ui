import React, { useEffect, useMemo, useRef, useState } from "react";
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
  workMode?: string;
  pokeTargetEmail: string;
  pokeTargetName: string;
  pokeSubjectContext: string;
  rawData?: Record<string, any>;
}

type SortKey =
  | "name"
  | "company"
  | "role"
  | "type"
  | "matchPercentage"
  | "location";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const MAIL_MATCH_THRESHOLD = 75; // candidate match % required to send a mail template
const POKE_MATCH_THRESHOLD = 25; // candidate match % required to poke
const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in ms before mail is allowed after poke

interface MatchDataTableProps {
  title: string;
  titleIcon?: string;
  rows: MatchRow[];
  loading: boolean;
  error: string | null;
  pokeLoading: boolean;
  pokeSuccessMessage: string | null;
  pokeError: string | null;
  isVendor?: boolean; // vendors have no match-meter restriction
  pokedRowIds?: Set<string>; // rows already poked (is_email: false)
  emailedRowIds?: Set<string>; // rows already emailed (is_email: true)
  pokedAtMap?: Map<string, string>; // target_id → poke created_at ISO (for 24h cooldown)
  onPoke: (row: MatchRow) => void;
  onPokeEmail?: (row: MatchRow) => void;
  onRowClick?: (row: MatchRow) => void;
  onDownload?: () => void;
  downloadLabel?: string;
  // Server-side pagination props
  serverTotal?: number; // total records on server (enables server-side mode)
  serverPage?: number; // current page (1-based)
  serverPageSize?: number; // current page size
  onPageChange?: (page: number, pageSize: number) => void; // callback for page/size change
}

const formatType = (value: string) => value.replace(/_/g, " ");

const getMeterClass = (pct: number) => {
  if (pct >= 75) return "matchdb-meter-fill matchdb-meter-fill-high";
  if (pct >= 45) return "matchdb-meter-fill matchdb-meter-fill-mid";
  return "matchdb-meter-fill matchdb-meter-fill-low";
};

const sortValue = (row: MatchRow, key: SortKey): string | number => {
  if (key === "matchPercentage") return row.matchPercentage;
  return (row[key] || "").toLowerCase();
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
  isVendor = false,
  pokedRowIds,
  emailedRowIds,
  pokedAtMap,
  onPoke,
  onPokeEmail,
  onRowClick,
  onDownload,
  downloadLabel = "Download CSV",
  serverTotal,
  serverPage,
  serverPageSize,
  onPageChange,
}) => {
  // Server-side pagination mode when serverTotal is provided
  const isServerSide = serverTotal !== undefined && onPageChange !== undefined;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(serverPageSize || DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [queryMs, setQueryMs] = useState<number | null>(null);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    if (loading) {
      startTime.current = Date.now();
      setQueryMs(null);
    } else {
      setQueryMs(Date.now() - startTime.current);
    }
  }, [loading]);

  useEffect(() => {
    setPage(0);
  }, [rows.length, sortKey, sortDir]);

  // In server-side mode, sync page from props
  useEffect(() => {
    if (isServerSide && serverPage !== undefined) {
      setPage(serverPage - 1); // serverPage is 1-based, internal is 0-based
    }
  }, [serverPage, isServerSide]);

  useEffect(() => {
    if (isServerSide && serverPageSize !== undefined) {
      setPageSize(serverPageSize);
    }
  }, [serverPageSize, isServerSide]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const totalRecords = isServerSide ? serverTotal! : sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  // In server-side mode, rows ARE the page slice already; in client mode, slice locally
  const pageRows = isServerSide
    ? sortedRows
    : sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const startRow = safePage * pageSize + 1;
  const endRow = Math.min((safePage + 1) * pageSize, totalRecords);

  // Page navigation helpers — in server mode, trigger callback
  const goToPage = (newPage: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, newPage));
    setPage(clamped);
    if (isServerSide) onPageChange!(clamped + 1, pageSize); // 1-based
  };
  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(0);
    if (isServerSide) onPageChange!(1, newSize);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key)
      return (
        <span className="th-sort" style={{ opacity: 0.3 }}>
          ⇅
        </span>
      );
    return <span className="th-sort">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = [];
    const maxVisible = 5;
    let start = Math.max(0, safePage - 2);
    let end = Math.min(totalPages - 1, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(0, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      const pg = i;
      buttons.push(
        <button
          key={pg}
          type="button"
          className={`matchdb-page-btn${safePage === pg ? " matchdb-page-btn-active" : ""}`}
          onClick={() => goToPage(pg)}
        >
          {pg + 1}
        </button>,
      );
    }
    return buttons;
  };

  return (
    <div className="matchdb-panel">
      {/* Panel Title Bar */}
      <div className="matchdb-panel-title">
        <span className="matchdb-panel-title-icon">{titleIcon}</span>
        <span className="matchdb-panel-title-text">{title}</span>
        <span className="matchdb-panel-title-meta">
          {loading
            ? "Loading..."
            : `${totalRecords} row${totalRecords !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Alerts */}
      {(pokeSuccessMessage || pokeError || error) && (
        <div className="matchdb-alerts" role="alert" aria-live="polite">
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

      {/* Table */}
      <div className="matchdb-table-wrap">
        <table className="matchdb-table" aria-busy={loading}>
          <colgroup>
            <col style={{ width: "28px" }} />
            <col style={{ width: "22px" }} />
            <col style={{ width: "11%" }} />
            <col className="col-company" style={{ width: "10%" }} />
            <col className="col-email" style={{ width: "11%" }} />
            <col className="col-phone" style={{ width: "9%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "8%" }} />
            <col className="col-mode" style={{ width: "6%" }} />
            <col className="col-pay" style={{ width: "6%" }} />
            <col className="col-experience" style={{ width: "5%" }} />
            <col style={{ width: "10%" }} />
            <col className="col-location" style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr>
              <th title="Row number">#</th>
              <th title="Expand row">⊕</th>
              <th
                className="matchdb-th-sortable"
                onClick={() => handleSort("name")}
                aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Name {sortIndicator("name")}
              </th>
              <th
                className="col-company matchdb-th-sortable"
                onClick={() => handleSort("company")}
                aria-sort={sortKey === "company" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Company {sortIndicator("company")}
              </th>
              <th className="col-email" title="Contact email">
                Mail ID
              </th>
              <th className="col-phone" title="Contact phone">
                Ph No
              </th>
              <th
                className="matchdb-th-sortable"
                onClick={() => handleSort("role")}
                aria-sort={sortKey === "role" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Role {sortIndicator("role")}
              </th>
              <th
                className="matchdb-th-sortable"
                onClick={() => handleSort("type")}
                aria-sort={sortKey === "type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Type {sortIndicator("type")}
              </th>
              <th className="col-mode" title="Work arrangement">
                Mode
              </th>
              <th className="col-pay" title="Pay rate/hr">
                Pay/Hr
              </th>
              <th className="col-experience" title="Years of experience">
                Exp
              </th>
              <th
                className="matchdb-th-sortable"
                onClick={() => handleSort("matchPercentage")}
                aria-sort={sortKey === "matchPercentage" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Match {sortIndicator("matchPercentage")}
              </th>
              <th
                className="col-location matchdb-th-sortable"
                onClick={() => handleSort("location")}
                aria-sort={sortKey === "location" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Location {sortIndicator("location")}
              </th>
              <th title="Actions: Poke (quick notify) · Mail Template (compose)">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, ri) => (
                <tr key={`sk-${ri}`} className="matchdb-skeleton-row" aria-hidden="true">
                  {[22, 60, 100, 90, 110, 80, 100, 60, 50, 50, 40, 100, 70, 70].map((w, ci) => (
                    <td key={ci}><span className="w97-shimmer" style={{ width: w }} /></td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={14} className="matchdb-empty">
                  MySQL returned an empty result set (i.e. zero rows).
                </td>
              </tr>
            )}
            {!loading &&
              pageRows.map((row, pageIdx) => {
                const globalIdx = safePage * pageSize + pageIdx + 1;
                const safePct = Math.max(0, Math.min(100, row.matchPercentage));

                const alreadyPoked = pokedRowIds?.has(row.id) ?? false;
                const alreadyEmailed = emailedRowIds?.has(row.id) ?? false;

                // Threshold restrictions (candidates only)
                const mailMatchTooLow =
                  !isVendor && row.matchPercentage < MAIL_MATCH_THRESHOLD;
                const pokeMatchTooLow =
                  !isVendor && row.matchPercentage < POKE_MATCH_THRESHOLD;

                // 24-hour cooldown: after a poke, mail is locked for 24 hours
                const pokeAt = pokedAtMap?.get(row.id);
                const pokeTooRecent =
                  !!pokeAt &&
                  Date.now() - new Date(pokeAt).getTime() < POKE_COOLDOWN_MS;

                // Final disabled states
                const pokeDisabled =
                  pokeLoading ||
                  alreadyPoked ||
                  alreadyEmailed ||
                  pokeMatchTooLow;
                const mailDisabled =
                  alreadyEmailed || mailMatchTooLow || pokeTooRecent;

                const pokeTitle = pokeMatchTooLow
                  ? `Match below ${POKE_MATCH_THRESHOLD}% — not eligible to poke`
                  : alreadyEmailed
                    ? `Already emailed ${row.pokeTargetName} — cannot also poke`
                    : alreadyPoked
                      ? `Already poked ${row.pokeTargetName}`
                      : `Quick poke — notify ${row.pokeTargetName} by email`;
                const mailTitle = mailMatchTooLow
                  ? `Match below ${MAIL_MATCH_THRESHOLD}% — not eligible to send mail template`
                  : alreadyEmailed
                    ? `Already sent a mail template to ${row.pokeTargetName}`
                    : pokeTooRecent
                      ? `Mail unlocks 24 h after poking (poked at ${new Date(pokeAt!).toLocaleTimeString()})`
                      : `Compose mail template to ${row.pokeTargetName}`;

                return (
                  <tr key={row.id} onDoubleClick={() => onRowClick?.(row)}>
                    <td
                      style={{
                        textAlign: "center",
                        color: "#808080",
                        fontSize: 10,
                        cursor: "default",
                      }}
                      title={`Row ${globalIdx}`}
                    >
                      {globalIdx}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {onRowClick ? (
                        <button
                          type="button"
                          className="matchdb-btn matchdb-btn-expand"
                          title="View details (or double-click row)"
                          onClick={() => onRowClick(row)}
                        >
                          ⊕
                        </button>
                      ) : (
                        <span style={{ color: "#c0c0c0", fontSize: 13 }}>
                          ⊕
                        </span>
                      )}
                    </td>
                    <td title={row.name}>{row.name}</td>
                    <td className="col-company" title={row.company}>
                      {row.company}
                    </td>
                    <td className="col-email" title={row.email}>
                      <a
                        href={`mailto:${row.email}`}
                        style={{ color: "#2a5fa0", textDecoration: "none" }}
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
                    <td className="col-mode">{row.workMode || "-"}</td>
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
                      <div style={{ display: "flex", gap: 2 }}>
                        {/* Poke button: red if match < 25%, grey+dim if emailed/already poked */}
                        <button
                          className="matchdb-btn matchdb-btn-poke"
                          type="button"
                          disabled={pokeDisabled}
                          onClick={() => !pokeDisabled && onPoke(row)}
                          title={pokeTitle}
                          aria-label={pokeTitle}
                          style={{
                            flex: 1,
                            ...(pokeMatchTooLow
                              ? {
                                  background: "var(--w97-red, #bb3333)",
                                  borderColor: "#fff #404040 #404040 #fff",
                                  cursor: "not-allowed",
                                }
                              : alreadyPoked || alreadyEmailed
                                ? { opacity: 0.45, cursor: "not-allowed" }
                                : {}),
                          }}
                        >
                          {alreadyPoked ? "✓" : pokeLoading ? "…" : "Poke"}
                        </button>
                        {/* Mail button: red if match < 75%, grey+dim if emailed or poke cooldown */}
                        {onPokeEmail && (
                          <button
                            className="matchdb-btn matchdb-btn-email"
                            type="button"
                            disabled={mailDisabled}
                            onClick={() => !mailDisabled && onPokeEmail(row)}
                            title={mailTitle}
                            aria-label={mailTitle}
                            style={{
                              flex: 1,
                              ...(mailMatchTooLow
                                ? {
                                    background: "var(--w97-red, #bb3333)",
                                    borderColor: "#fff #404040 #404040 #fff",
                                    cursor: "not-allowed",
                                  }
                                : alreadyEmailed || pokeTooRecent
                                  ? { opacity: 0.4, cursor: "not-allowed" }
                                  : {}),
                            }}
                          >
                            {alreadyEmailed ? "✓" : "✉"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalRecords > 0 && (
        <div className="matchdb-pagination">
          <button
            type="button"
            className="matchdb-page-btn"
            onClick={() => goToPage(0)}
            disabled={safePage === 0}
            title="First page"
          >
            «
          </button>
          <button
            type="button"
            className="matchdb-page-btn"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 0}
            title="Previous page"
          >
            ‹
          </button>
          {renderPageButtons()}
          <button
            type="button"
            className="matchdb-page-btn"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages - 1}
            title="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="matchdb-page-btn"
            onClick={() => goToPage(totalPages - 1)}
            disabled={safePage >= totalPages - 1}
            title="Last page"
          >
            »
          </button>
          <span className="matchdb-page-label" style={{ marginLeft: 4 }}>
            Rows {startRow}–{endRow} of {totalRecords}
          </span>
          <span className="matchdb-footnote-sep">|</span>
          <span className="matchdb-page-label">Per page:</span>
          <select
            className="matchdb-select"
            style={{ height: 20, fontSize: 10, maxWidth: 60 }}
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Footnote */}
      <div className="matchdb-footnote">
        <span>
          Showing{" "}
          {loading
            ? "—"
            : `${totalRecords} row${totalRecords !== 1 ? "s" : ""}`}
          {sortKey &&
            ` · sorted by ${sortKey} ${sortDir === "asc" ? "▲" : "▼"}`}
        </span>
        <span className="matchdb-footnote-sep">|</span>
        <span>{queryMs !== null ? `${queryMs}ms` : "—"}</span>
        <span className="matchdb-footnote-sep">|</span>
        <span>InnoDB</span>
        {onDownload && (
          <span style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="matchdb-btn matchdb-btn-download"
              onClick={onDownload}
              title={downloadLabel}
            >
              ⬇ {downloadLabel}
            </button>
          </span>
        )}
      </div>
    </div>
  );
};

export default MatchDataTable;
