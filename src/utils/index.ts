export { generateResumePDF } from "./generateResumePDF";

/** Extract an error message from an RTK Query or catch-block error object. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.data && typeof e.data === "object") {
      const data = e.data as Record<string, unknown>;
      if (typeof data.error === "string") return data.error;
      if (typeof data.message === "string") return data.message;
    }
    if (typeof e.error === "string") return e.error;
  }
  return fallback;
}
