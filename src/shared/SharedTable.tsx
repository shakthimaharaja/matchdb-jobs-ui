import React, { useEffect, useState } from "react";
import "../components/MatchDataTable.css";

export interface ColumnDef {
  key: string;
  header: React.ReactNode;
  width?: string | number;
  className?: string;
  align?: "left" | "center" | "right";
  /** Width of the shimmer bar shown while loading */
  skeletonWidth?: number;
  /** Extra props spread onto the <th> element (e.g. onClick, aria-sort) */
  thProps?: React.ThHTMLAttributes<HTMLTableCellElement>;
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface SharedTableProps<T = Record<string, unknown>> {
  columns: ColumnDef[];
  rows: T[];
  /**
   * Returns a complete <tr> element for each data row.
   * @param row      - the data item
   * @param pageIdx  - 0-based index within the current page
   * @param globalIdx - 1-based global row number (across all pages)
   */
  renderRow: (
    row: T,
    pageIndex: number,
    globalIndex: number,
  ) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  /**
   * Pad the current page to DEFAULT_PAGE_SIZE with blank rows so the
   * table height stays consistent when fewer than 25 rows are visible.
   * Only applies when 0 < visibleRows < pageSize. Default: true.
   */
  fillEmptyRows?: boolean;
  /**
   * Changing this value resets the page to 0 (use when sort/filter
   * changes and you want to return to page 1 without remounting).
   */
  pageResetKey?: string | number;
  // ── Title bar ──
  title?: string;
  titleIcon?: string;
  /** Extra content rendered inside the title bar, between the title text and the row-count meta */
  titleExtra?: React.ReactNode;
  // ── Alerts ──
  alertSuccess?: string | null;
  alertError?: string | null;
  /** Additional error strings (shown as separate alert rows) */
  alertErrors?: (string | null | undefined)[];
  // ── Server-side pagination ──
  serverTotal?: number;
  serverPage?: number;
  serverPageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  // ── Download ──
  onDownload?: () => void;
  downloadLabel?: string;
}

function SharedTable<T>({
  columns,
  rows,
  renderRow,
  loading = false,
  emptyMessage = "MySQL returned an empty result set (i.e. zero rows).",
  fillEmptyRows = true,
  pageResetKey,
  title,
  titleIcon,
  titleExtra,
  alertSuccess,
  alertError,
  alertErrors,
  serverTotal,
  serverPage,
  serverPageSize,
  onPageChange,
  onDownload,
  downloadLabel = "Download CSV",
}: SharedTableProps<T>): React.ReactElement {
  const isServerSide = serverTotal !== undefined && onPageChange !== undefined;

  const [page, setPage] = useState(0); // 0-based
  const [pageSize, setPageSize] = useState(serverPageSize ?? DEFAULT_PAGE_SIZE);

  // Sync server page/size into local state
  useEffect(() => {
    if (isServerSide && serverPage !== undefined) setPage(serverPage - 1);
  }, [serverPage, isServerSide]);

  useEffect(() => {
    if (isServerSide && serverPageSize !== undefined)
      setPageSize(serverPageSize);
  }, [serverPageSize, isServerSide]);

  // Reset to page 0 when rows change (client-side) or when caller signals a reset
  useEffect(() => {
    if (!isServerSide) setPage(0);
  }, [rows.length, isServerSide]);

  useEffect(() => {
    if (pageResetKey !== undefined) setPage(0);
  }, [pageResetKey]);

  const totalRecords = isServerSide ? serverTotal! : rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  // In server-side mode the caller already provides the correct page slice
  const pageRows = isServerSide
    ? rows
    : rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const startRow = safePage * pageSize + 1;
  const endRow = Math.min((safePage + 1) * pageSize, totalRecords);

  // Filler rows: pad to pageSize only when there are some (but fewer than pageSize) data rows
  const fillerCount =
    fillEmptyRows && !loading && pageRows.length > 0
      ? Math.max(0, pageSize - pageRows.length)
      : 0;

  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, p));
    setPage(clamped);
    if (isServerSide) onPageChange!(clamped + 1, pageSize);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(0);
    if (isServerSide) onPageChange!(1, size);
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

  const allErrors = [alertError, ...(alertErrors ?? [])].filter(
    (e): e is string => !!e,
  );
  const showAlerts = !!(alertSuccess || allErrors.length);

  return (
    <div className="matchdb-panel">
      {/* ── Title bar ── */}
      {(title || titleIcon || titleExtra || onDownload) && (
        <div className="matchdb-panel-title">
          <div className="matchdb-panel-title-left">
            {titleIcon && (
              <span className="matchdb-panel-title-icon">{titleIcon}</span>
            )}
            {title && <span className="matchdb-panel-title-text">{title}</span>}
            <span className="matchdb-panel-title-meta">
              {loading
                ? "Loading..."
                : `${totalRecords} row${totalRecords !== 1 ? "s" : ""}`}
            </span>
            {titleExtra}
          </div>
          {onDownload && (
            <div className="matchdb-panel-title-right">
              <button
                type="button"
                className="matchdb-btn matchdb-btn-download matchdb-title-btn"
                onClick={onDownload}
                title={downloadLabel}
              >
                ⬇ {downloadLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Alerts ── */}
      {showAlerts && (
        <div className="matchdb-alerts" role="alert" aria-live="polite">
          {alertSuccess && (
            <div className="matchdb-alert matchdb-alert-success">
              <span>✓</span> {alertSuccess}
            </div>
          )}
          {allErrors.map((e, i) => (
            <div key={i} className="matchdb-alert matchdb-alert-error">
              <span>✕</span> {e}
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="matchdb-table-wrap">
        <table className="matchdb-table" aria-busy={loading}>
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.key}
                className={col.className}
                style={
                  col.width !== undefined ? { width: col.width } : undefined
                }
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.className}
                  style={col.align ? { textAlign: col.align } : undefined}
                  {...col.thProps}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {loading &&
              Array.from({ length: 5 }).map((_, ri) => (
                <tr
                  key={`sk-${ri}`}
                  className="matchdb-skeleton-row"
                  aria-hidden="true"
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      <span
                        className="w97-shimmer"
                        style={{ width: col.skeletonWidth ?? 80 }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty state */}
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="matchdb-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {/* Data rows — renderRow returns a full <tr> */}
            {!loading &&
              pageRows.map((row, pageIdx) => {
                const globalIdx = safePage * pageSize + pageIdx + 1;
                return renderRow(row, pageIdx, globalIdx);
              })}

            {/* Filler rows — keeps table height consistent at 25 rows */}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <tr
                key={`filler-${i}`}
                aria-hidden="true"
                className="matchdb-filler-row"
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
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
    </div>
  );
}

export default SharedTable;
