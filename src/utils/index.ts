/**
 * Jobs-UI Shared Utilities
 * Common helper functions used across Jobs-UI components and pages.
 */

// ─── Formatting Helpers ─────────────────────────────────────────────────────

/** Format a number as currency (e.g. $50). Returns "—" for null/undefined. */
export const fmtCurrency = (v: number | null | undefined, prefix = "$") =>
  v != null ? `${prefix}${Number(v).toLocaleString()}` : "—";

/** Format an ISO date string to a short readable form. */
export const fmtDate = (iso: string): string => {
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

/** Format an array to a comma-separated string, or "—" if empty. */
export const fmtList = (arr?: string[]) =>
  arr && arr.length ? arr.join(", ") : "—";

/** Format any value to a string, or "—" if empty/null/undefined. */
export const fmtVal = (v: any) =>
  v !== undefined && v !== null && v !== "" ? String(v) : "—";

/** Format experience years as "N yrs". */
export const formatExperience = (value?: number | null) =>
  `${Number(value || 0)} yrs`;

// ─── Label Maps ─────────────────────────────────────────────────────────────

/** Human-readable job type labels. */
export const TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
};

/** Human-readable subtype labels. */
export const SUB_LABELS: Record<string, string> = {
  c2c: "C2C",
  c2h: "C2H",
  w2: "W2",
  "1099": "1099",
  direct_hire: "Direct Hire",
  salary: "Salary",
};

// ─── API Helpers ────────────────────────────────────────────────────────────

/** Build an Authorization header object for axios requests. */
export const authHeader = (token: string | null) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

/**
 * Trigger a file download from a Blob response.
 * @param blob       The Blob data to download.
 * @param fallback   Fallback filename if content-disposition is missing.
 * @param disposition The Content-Disposition header value (optional).
 */
export function downloadBlob(
  blob: Blob,
  fallback: string,
  disposition?: string,
): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  a.download = match?.[1] || fallback;
  a.click();
  URL.revokeObjectURL(url);
}
