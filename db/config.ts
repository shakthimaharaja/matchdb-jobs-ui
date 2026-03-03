/**
 * db/config.ts — Jobs UI server connection configuration
 *
 * Centralises all environment-based settings consumed by the Node BFF server.
 * Loaded once at startup; env files are resolved before this module is imported.
 *
 * Environments: local | development | qa | production
 */

export interface ServerConfig {
  env: string;
  port: number;
  useHttps: boolean;
  /** Jobs backend */
  jobsServicesUrl: string;
  /** Whitelisted CORS origins */
  corsOrigins: string[];
}

const ENV = process.env.NODE_ENV || "local";
const IS_PROD = ENV === "production";

function parseOrigins(raw: string | undefined, defaults: string[]): string[] {
  if (!raw) return defaults;
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

const config: ServerConfig = {
  env: ENV,

  port: parseInt(process.env.NODE_SERVER_PORT || "4001", 10),

  useHttps: process.env.USE_HTTPS === "true",

  jobsServicesUrl:
    process.env.JOBS_SERVICES_URL ||
    (IS_PROD ? "http://127.0.0.1:8001" : "http://localhost:8001"),

  corsOrigins: parseOrigins(process.env.CORS_ORIGINS, [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:3001",
    "https://localhost:3001",
    ...(IS_PROD ? ["https://matchingdb.com", "https://www.matchingdb.com"] : []),
  ]),
};

export default config;
