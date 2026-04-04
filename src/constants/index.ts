/* =============================================================================
 * matchdb-jobs-ui — Centralized constants
 * Single source of truth for job types, countries, thresholds, and UI config.
 * ============================================================================= */

// ─── Job Classification ────────────────────────────────────────────────────────

export const JOB_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

/** Extended job types used in candidate profile (includes "remote" legacy option) */
export const JOB_TYPES_EXTENDED = [
  ...JOB_TYPES,
  { value: "remote", label: "Remote" },
];

export const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-Site" },
  { value: "hybrid", label: "Hybrid" },
];

/** Work modes with a blank "not specified" option for forms */
export const WORK_MODES_WITH_EMPTY = [
  { value: "", label: "— Not Specified —" },
  ...WORK_MODES,
];

export const CONTRACT_SUB_TYPES = [
  { value: "c2c", label: "C2C" },
  { value: "c2h", label: "C2H" },
  { value: "w2", label: "W2" },
  { value: "1099", label: "1099" },
];

/** Contract sub-types with a blank option for forms */
export const CONTRACT_SUB_TYPES_WITH_EMPTY = [
  { value: "", label: "— None —" },
  { value: "c2c", label: "C2C (Corp-to-Corp)" },
  { value: "c2h", label: "C2H (Contract-to-Hire)" },
  { value: "w2", label: "W2" },
  { value: "1099", label: "1099" },
];

export const FULL_TIME_SUB_TYPES = [
  { value: "c2h", label: "C2H" },
  { value: "w2", label: "W2" },
  { value: "direct_hire", label: "Direct Hire" },
  { value: "salary", label: "Salary" },
];

/** Full-time sub-types with a blank option for forms */
export const FULL_TIME_SUB_TYPES_WITH_EMPTY = [
  { value: "", label: "— None —" },
  { value: "c2h", label: "C2H (Contract-to-Hire)" },
  { value: "w2", label: "W2" },
  { value: "direct_hire", label: "Direct Hire" },
  { value: "salary", label: "Salary" },
];

/** Candidate profile visibility configuration structure */
export const VISIBILITY_TYPES = [
  {
    key: "contract",
    label: "Contract",
    subTypes: [
      { value: "c2c", label: "C2C" },
      { value: "c2h", label: "C2H" },
      { value: "w2", label: "W2" },
      { value: "1099", label: "1099" },
    ],
  },
  {
    key: "full_time",
    label: "Full Time",
    subTypes: [
      { value: "c2h", label: "C2H" },
      { value: "w2", label: "W2" },
      { value: "direct_hire", label: "Direct Hire" },
      { value: "salary", label: "Salary" },
    ],
  },
  {
    key: "part_time",
    label: "Part Time",
    subTypes: [],
  },
];

export const TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  internship: "Internship",
};

export const SUB_LABELS: Record<string, string> = {
  c2c: "C2C",
  c2h: "C2H",
  w2: "W2",
  "1099": "1099",
  direct_hire: "Direct",
  salary: "Salary",
};

// ─── Countries ─────────────────────────────────────────────────────────────────

export const COUNTRIES = [
  { value: "", label: "— Select Country —", flag: "" },
  { value: "US", label: "🇺🇸 United States", flag: "🇺🇸" },
  { value: "IN", label: "🇮🇳 India", flag: "🇮🇳" },
  { value: "GB", label: "🇬🇧 United Kingdom", flag: "🇬🇧" },
  { value: "CA", label: "🇨🇦 Canada", flag: "🇨🇦" },
  { value: "AU", label: "🇦🇺 Australia", flag: "🇦🇺" },
  { value: "DE", label: "🇩🇪 Germany", flag: "🇩🇪" },
  { value: "SG", label: "🇸🇬 Singapore", flag: "🇸🇬" },
  { value: "AE", label: "🇦🇪 UAE", flag: "🇦🇪" },
  { value: "JP", label: "🇯🇵 Japan", flag: "🇯🇵" },
  { value: "NL", label: "🇳🇱 Netherlands", flag: "🇳🇱" },
  { value: "FR", label: "🇫🇷 France", flag: "🇫🇷" },
  { value: "BR", label: "🇧🇷 Brazil", flag: "🇧🇷" },
  { value: "MX", label: "🇲🇽 Mexico", flag: "🇲🇽" },
  { value: "PH", label: "🇵🇭 Philippines", flag: "🇵🇭" },
  { value: "IL", label: "🇮🇱 Israel", flag: "🇮🇱" },
  { value: "IE", label: "🇮🇪 Ireland", flag: "🇮🇪" },
  { value: "PL", label: "🇵🇱 Poland", flag: "🇵🇱" },
  { value: "SE", label: "🇸🇪 Sweden", flag: "🇸🇪" },
  { value: "CH", label: "🇨🇭 Switzerland", flag: "🇨🇭" },
  { value: "KR", label: "🇰🇷 South Korea", flag: "🇰🇷" },
];

export const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  IN: "🇮🇳",
  GB: "🇬🇧",
  CA: "🇨🇦",
  AU: "🇦🇺",
  DE: "🇩🇪",
  SG: "🇸🇬",
  AE: "🇦🇪",
  JP: "🇯🇵",
  NL: "🇳🇱",
  FR: "🇫🇷",
  BR: "🇧🇷",
  MX: "🇲🇽",
  PH: "🇵🇭",
  IL: "🇮🇱",
  IE: "🇮🇪",
  PL: "🇵🇱",
  SE: "🇸🇪",
  CH: "🇨🇭",
  KR: "🇰🇷",
};

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  SG: "Singapore",
  AE: "UAE",
  JP: "Japan",
  NL: "Netherlands",
  FR: "France",
  BR: "Brazil",
  MX: "Mexico",
  PH: "Philippines",
  IL: "Israel",
  IE: "Ireland",
  PL: "Poland",
  SE: "Sweden",
  CH: "Switzerland",
  KR: "South Korea",
};

// ─── Match & Interaction Thresholds ────────────────────────────────────────────

export const MAIL_MATCH_THRESHOLD = 75;
export const POKE_MATCH_THRESHOLD = 25;
export const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const POKE_LIMIT: Record<string, number> = {
  free: 5,
  basic: 25,
  pro: 50,
  pro_plus: Infinity,
  enterprise: Infinity,
};

// ─── Pagination & Timing ───────────────────────────────────────────────────────

export const PAGE_SIZE = 25;
export const FLASH_DURATION_MS = 2500;
export const POLL_INTERVAL_MS = 30_000;

/** RTK Query cache durations (seconds) */
export const CACHE_SHORT = 300; // 5 min
export const CACHE_LONG = 600; // 10 min

// ─── Calendar ──────────────────────────────────────────────────────────────────

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

/** Monthly simulation variance multipliers */
export const MONTH_VARIANCE = [
  1, 0.92, 1.08, 1.02, 0.94, 1.06, 1, 0.92, 1.08, 1, 0.94, 1.04,
];
