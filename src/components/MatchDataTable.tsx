import React, { useMemo, useState } from "react";
import { DataTable } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";

export interface MatchRow {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
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
  rawData?: Record<string, unknown>;
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
  // Row flash animations (update = yellow, delete = red)
  flashIds?: Set<string>;
  deleteFlashIds?: Set<string>;
}

const formatType = (value: string) => value.replaceAll("_", " ");

const getMeterClass = (pct: number) => {
  if (pct >= 75) return "matchdb-meter-fill matchdb-meter-fill-high";
  if (pct >= 45) return "matchdb-meter-fill matchdb-meter-fill-mid";
  return "matchdb-meter-fill matchdb-meter-fill-low";
};

const sortValue = (row: MatchRow, key: SortKey): string | number => {
  if (key === "matchPercentage") return row.matchPercentage;
  return (row[key] || "").toLowerCase();
};

function getPokeTitle(
  pokeMatchTooLow: boolean,
  alreadyEmailed: boolean,
  alreadyPoked: boolean,
  targetName: string,
): string {
  if (pokeMatchTooLow)
    return `Match below ${POKE_MATCH_THRESHOLD}% — not eligible to poke`;
  if (alreadyEmailed) return `Already emailed ${targetName} — cannot also poke`;
  if (alreadyPoked) return `Already poked ${targetName}`;
  return `Quick poke — notify ${targetName} by email`;
}

function getMailTitle(
  mailMatchTooLow: boolean,
  alreadyEmailed: boolean,
  pokeTooRecent: boolean,
  targetName: string,
  pokeAt: string | undefined,
): string {
  if (mailMatchTooLow)
    return `Match below ${MAIL_MATCH_THRESHOLD}% — not eligible to send mail template`;
  if (alreadyEmailed) return `Already sent a mail template to ${targetName}`;
  if (pokeTooRecent)
    return `Mail unlocks 24 h after poking (poked at ${new Date(
      pokeAt!,
    ).toLocaleTimeString()})`;
  return `Compose mail template to ${targetName}`;
}

function getPokeStyle(
  pokeMatchTooLow: boolean,
  alreadyPoked: boolean,
  alreadyEmailed: boolean,
): React.CSSProperties {
  if (pokeMatchTooLow) {
    return {
      background: "var(--w97-red, #bb3333)",
      borderColor: "#fff #404040 #404040 #fff",
      cursor: "not-allowed",
    };
  }
  if (alreadyPoked || alreadyEmailed)
    return { opacity: 0.45, cursor: "not-allowed" };
  return {};
}

function getMailStyle(
  mailMatchTooLow: boolean,
  alreadyEmailed: boolean,
  pokeTooRecent: boolean,
): React.CSSProperties {
  if (mailMatchTooLow) {
    return {
      background: "var(--w97-red, #bb3333)",
      borderColor: "#fff #404040 #404040 #fff",
      cursor: "not-allowed",
    };
  }
  if (alreadyEmailed || pokeTooRecent)
    return { opacity: 0.4, cursor: "not-allowed" };
  return {};
}

function getPokeLabel(alreadyPoked: boolean, loading: boolean): string {
  if (alreadyPoked) return "✓";
  if (loading) return "…";
  return "Poke";
}

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
  flashIds,
  deleteFlashIds,
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

  function renderActions(row: MatchRow) {
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

    const pokeTitle = getPokeTitle(
      pokeMatchTooLow,
      alreadyEmailed,
      alreadyPoked,
      row.pokeTargetName,
    );
    const mailTitle = getMailTitle(
      mailMatchTooLow,
      alreadyEmailed,
      pokeTooRecent,
      row.pokeTargetName,
      pokeAt,
    );
    const pokeStyle = getPokeStyle(
      pokeMatchTooLow,
      alreadyPoked,
      alreadyEmailed,
    );
    const pokeLabel = getPokeLabel(alreadyPoked, pokeLoading);
    const mailStyle = getMailStyle(
      mailMatchTooLow,
      alreadyEmailed,
      pokeTooRecent,
    );

    return (
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
            ...pokeStyle,
          }}
        >
          {pokeLabel}
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
              ...mailStyle,
            }}
          >
            {alreadyEmailed ? "✓" : "✉"}
          </button>
        )}
        <button
          className="matchdb-btn matchdb-btn-call"
          type="button"
          disabled
          title="Call feature — coming soon"
          aria-label="Call (coming soon)"
          style={{ flex: 1, opacity: 0.5, cursor: "not-allowed" }}
        >
          📞
        </button>
      </div>
    );
  }

  // Build column definitions with sort-aware headers and per-column render
  const columns = useMemo<DataTableColumn<MatchRow>[]>(() => {
    const indicator = (key: SortKey) =>
      sortKey === key ? (
        <span className="th-sort">{sortDir === "asc" ? "▲" : "▼"}</span>
      ) : (
        <span className="th-sort" style={{ opacity: 0.3 }}>
          ⇅
        </span>
      );

    const onSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    };

    const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => {
      if (sortKey !== key) return "none";
      return sortDir === "asc" ? "ascending" : "descending";
    };

    return [
      {
        key: "expand",
        header: "⊕",
        width: "22px",
        align: "center" as const,
        skeletonWidth: 22,
        render: (row: MatchRow) =>
          onRowClick ? (
            <button
              type="button"
              className="matchdb-btn matchdb-btn-expand"
              title="View details (or double-click row)"
              onClick={() => onRowClick(row)}
            >
              ⊕
            </button>
          ) : (
            <span
              style={{ color: "var(--w97-btn-shadow, #c0c0c0)", fontSize: 13 }}
            >
              ⊕
            </span>
          ),
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
        render: (row: MatchRow) =>
          onRowClick ? (
            <button
              type="button"
              className="matchdb-link-btn"
              onClick={() => onRowClick(row)}
              title={`View details for ${row.name}`}
            >
              {row.name}
            </button>
          ) : (
            <>{row.name}</>
          ),
        tooltip: (row: MatchRow) => row.name,
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
        render: (row: MatchRow) => <>{row.company}</>,
        tooltip: (row: MatchRow) => row.company,
      },
      {
        key: "email",
        header: "Mail ID",
        width: "11%",
        className: "col-email",
        skeletonWidth: 110,
        thProps: { title: "Contact email" },
        render: (row: MatchRow) => (
          <a
            href={`mailto:${row.email}`}
            style={{
              color: "var(--w97-blue, #2a5fa0)",
              textDecoration: "none",
            }}
          >
            {row.email}
          </a>
        ),
        tooltip: (row: MatchRow) => row.email,
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
        render: (row: MatchRow) => <>{row.role}</>,
        tooltip: (row: MatchRow) => row.role,
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
        render: (row: MatchRow) => (
          <span className="matchdb-type-pill">{formatType(row.type)}</span>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        width: "6%",
        className: "col-mode",
        skeletonWidth: 50,
        thProps: { title: "Work arrangement" },
        render: (row: MatchRow) => <>{row.workMode || "-"}</>,
      },
      {
        key: "pay",
        header: "Pay/Hr",
        width: "6%",
        className: "col-pay",
        skeletonWidth: 50,
        thProps: { title: "Pay rate/hr" },
        render: (row: MatchRow) => <>{row.payPerHour}</>,
      },
      {
        key: "exp",
        header: "Exp",
        width: "5%",
        className: "col-experience",
        skeletonWidth: 40,
        thProps: { title: "Years of experience" },
        render: (row: MatchRow) => <>{row.experience}</>,
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
        render: (row: MatchRow) => {
          const safePct = Math.max(0, Math.min(100, row.matchPercentage));
          return (
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
          );
        },
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
        render: (row: MatchRow) => <>{row.location}</>,
        tooltip: (row: MatchRow) => row.location,
      },
      {
        key: "actions",
        header: "Actions",
        width: "8%",
        skeletonWidth: 70,
        thProps: {
          title: "Actions: Poke (quick notify) · Mail Template (compose)",
        },
        render: renderActions,
      },
    ];
  }, [
    sortKey,
    sortDir,
    pokeLoading,
    pokedRowIds,
    emailedRowIds,
    pokedAtMap,
    isVendor,
    onPoke,
    onPokeEmail,
    onRowClick,
  ]);

  return (
    <DataTable<MatchRow>
      columns={columns}
      data={sortedRows}
      keyExtractor={(r) => r.id}
      loading={loading}
      paginate
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
      onRowDoubleClick={onRowClick}
      flashIds={flashIds}
      deleteFlashIds={deleteFlashIds}
    />
  );
};

export default MatchDataTable;
