import React, { useMemo, useState } from "react";
import SharedTable, { ColumnDef } from "../shared/SharedTable";
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

const MAIL_MATCH_THRESHOLD = 75;
const POKE_MATCH_THRESHOLD = 25;
const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface MatchDataTableProps {
  title: string;
  titleIcon?: string;
  titleExtra?: React.ReactNode;
  rows: MatchRow[];
  loading: boolean;
  error: string | null;
  pokeLoading: boolean;
  pokeSuccessMessage: string | null;
  pokeError: string | null;
  isVendor?: boolean;
  pokedRowIds?: Set<string>;
  emailedRowIds?: Set<string>;
  pokedAtMap?: Map<string, string>;
  onPoke: (row: MatchRow) => void;
  onPokeEmail?: (row: MatchRow) => void;
  onRowClick?: (row: MatchRow) => void;
  onDownload?: () => void;
  downloadLabel?: string;
  // Server-side pagination
  serverTotal?: number;
  serverPage?: number;
  serverPageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
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
  titleExtra,
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  // Build column definitions with sort-aware headers
  const columns = useMemo<ColumnDef[]>(() => {
    const indicator = (key: SortKey) =>
      sortKey !== key ? (
        <span className="th-sort" style={{ opacity: 0.3 }}>
          ⇅
        </span>
      ) : (
        <span className="th-sort">{sortDir === "asc" ? "▲" : "▼"}</span>
      );

    const onSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    };

    const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
      sortKey === key
        ? sortDir === "asc"
          ? "ascending"
          : "descending"
        : "none";

    return [
      {
        key: "row",
        header: "#",
        width: "28px",
        align: "center",
        skeletonWidth: 22,
      },
      {
        key: "expand",
        header: "⊕",
        width: "22px",
        align: "center",
        skeletonWidth: 22,
      },
      {
        key: "name",
        header: <>Name {indicator("name")}</>,
        width: "11%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("name"),
          "aria-sort": ariaSort("name"),
        },
        skeletonWidth: 100,
      },
      {
        key: "company",
        header: <>Company {indicator("company")}</>,
        width: "10%",
        className: "col-company matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("company"),
          "aria-sort": ariaSort("company"),
        },
        skeletonWidth: 90,
      },
      {
        key: "email",
        header: "Mail ID",
        width: "11%",
        className: "col-email",
        skeletonWidth: 110,
        thProps: { title: "Contact email" },
      },
      {
        key: "phone",
        header: "Ph No",
        width: "9%",
        className: "col-phone",
        skeletonWidth: 80,
        thProps: { title: "Contact phone" },
      },
      {
        key: "role",
        header: <>Role {indicator("role")}</>,
        width: "11%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("role"),
          "aria-sort": ariaSort("role"),
        },
        skeletonWidth: 100,
      },
      {
        key: "type",
        header: <>Type {indicator("type")}</>,
        width: "8%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("type"),
          "aria-sort": ariaSort("type"),
        },
        skeletonWidth: 60,
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        className: "col-mode",
        skeletonWidth: 50,
        thProps: { title: "Work arrangement" },
      },
      {
        key: "pay",
        header: "Pay/Hr",
        width: "6%",
        className: "col-pay",
        skeletonWidth: 50,
        thProps: { title: "Pay rate/hr" },
      },
      {
        key: "exp",
        header: "Exp",
        width: "5%",
        className: "col-experience",
        skeletonWidth: 40,
        thProps: { title: "Years of experience" },
      },
      {
        key: "match",
        header: <>Match {indicator("matchPercentage")}</>,
        width: "10%",
        className: "matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("matchPercentage"),
          "aria-sort": ariaSort("matchPercentage"),
        },
        skeletonWidth: 100,
      },
      {
        key: "location",
        header: <>Location {indicator("location")}</>,
        width: "7%",
        className: "col-location matchdb-th-sortable",
        thProps: {
          onClick: () => onSort("location"),
          "aria-sort": ariaSort("location"),
        },
        skeletonWidth: 70,
      },
      {
        key: "actions",
        header: "Actions",
        width: "8%",
        skeletonWidth: 70,
        thProps: {
          title: "Actions: Poke (quick notify) · Mail Template (compose)",
        },
      },
    ];
  }, [sortKey, sortDir]);

  const renderRow = (row: MatchRow, _pageIdx: number, globalIdx: number) => {
    const safePct = Math.max(0, Math.min(100, row.matchPercentage));
    const alreadyPoked = pokedRowIds?.has(row.id) ?? false;
    const alreadyEmailed = emailedRowIds?.has(row.id) ?? false;

    const mailMatchTooLow =
      !isVendor && row.matchPercentage < MAIL_MATCH_THRESHOLD;
    const pokeMatchTooLow =
      !isVendor && row.matchPercentage < POKE_MATCH_THRESHOLD;

    const pokeAt = pokedAtMap?.get(row.id);
    const pokeTooRecent =
      !!pokeAt && Date.now() - new Date(pokeAt).getTime() < POKE_COOLDOWN_MS;

    const pokeDisabled =
      pokeLoading || alreadyPoked || alreadyEmailed || pokeMatchTooLow;
    const mailDisabled = alreadyEmailed || mailMatchTooLow || pokeTooRecent;

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
            <span style={{ color: "#c0c0c0", fontSize: 13 }}>⊕</span>
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
          <span className="matchdb-type-pill">{formatType(row.type)}</span>
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
  };

  return (
    <SharedTable<MatchRow>
      columns={columns}
      rows={sortedRows}
      renderRow={renderRow}
      loading={loading}
      emptyMessage="MySQL returned an empty result set (i.e. zero rows)."
      alertSuccess={pokeSuccessMessage}
      alertErrors={[pokeError, error]}
      title={title}
      titleIcon={titleIcon}
      titleExtra={titleExtra}
      serverTotal={serverTotal}
      serverPage={serverPage}
      serverPageSize={serverPageSize}
      onPageChange={onPageChange}
      onDownload={onDownload}
      downloadLabel={downloadLabel}
      pageResetKey={`${sortKey ?? ""}-${sortDir}`}
    />
  );
};

export default MatchDataTable;
