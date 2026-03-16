/* =============================================================================
 * matchdb-jobs-ui — API endpoint paths
 * Single source of truth for all API URLs used by the Jobs MFE.
 * ============================================================================= */

/** SSE endpoint for live data updates */
export const SSE_EVENTS = "/api/jobs/events";

/** WebSocket endpoints (used in PublicJobsView) */
export const WS_COUNTS = "/ws/counts";
export const WS_PUBLIC_DATA = "/ws/public-data";

/** Invite endpoints */
export const INVITE_VERIFY = (token: string) => `/api/jobs/invite/${token}`;
export const INVITE_ACCEPT = (token: string) => `/api/jobs/invite/${token}`;

/** Resume endpoints */
export const RESUME_VIEW = (username: string) => `/api/jobs/resume/${username}`;
export const RESUME_DOWNLOAD = (username: string) =>
  `/api/jobs/resume/${username}/download`;

/** Account management (shell-services, used from jobs-ui) */
export const DELETE_ACCOUNT = "/api/auth/account";
