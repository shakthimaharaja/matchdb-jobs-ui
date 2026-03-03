/**
 * api/jobsApi.ts — Jobs UI: ALL endpoints in one place.
 *
 * Every endpoint is exposed as an auto-generated React hook:
 *   Queries  → useXxxQuery / useLazyXxxQuery
 *   Mutations → useXxxMutation
 *
 * prepareHeaders auto-injects the JWT stored in jobs-ui Redux (set by
 * JobsApp.tsx when it receives the token prop from the shell host).
 *
 * Tag-based cache invalidation keeps data in sync automatically —
 * e.g. posting a job or sending a poke auto-refetches the relevant lists.
 */

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  description: string;
  vendor_id: string;
  vendor_email: string;
  location: string;
  job_country?: string;
  job_state?: string;
  job_city?: string;
  job_type: string;
  job_sub_type?: string;
  work_mode?: string;
  salary_min: number | null;
  salary_max: number | null;
  skills_required: string[];
  is_active: boolean;
  application_count?: number;
  created_at: string;
  recruiter_name?: string;
  recruiter_phone?: string;
  pay_per_hour?: number | null;
  experience_required?: number;
  match_percentage?: number;
  match_breakdown?: {
    skills: number;
    type: number;
    experience: number;
  };
}

export interface CandidateProfile {
  id?: string;
  candidate_id?: string;
  name: string;
  email: string;
  phone: string;
  current_company: string;
  current_role: string;
  preferred_job_type: string;
  expected_hourly_rate: number | null;
  experience_years: number;
  skills: string[];
  location: string;
  profile_country?: string;
  bio: string;
  resume_summary?: string;
  resume_experience?: string;
  resume_education?: string;
  resume_achievements?: string;
  visibility_config?: Record<string, string[]>;
  profile_locked?: boolean;
}

export interface PokeRecord {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  sender_type: "vendor" | "candidate";
  target_id: string;
  target_vendor_id?: string;
  target_email: string;
  target_name: string;
  subject: string;
  is_email: boolean;
  job_id?: string;
  job_title?: string;
  created_at: string;
}

export interface CandidateProfileMatch {
  id: string;
  candidate_id: string;
  name: string;
  email: string;
  phone: string;
  current_company: string;
  current_role: string;
  preferred_job_type: string;
  expected_hourly_rate: number | null;
  experience_years: number;
  location: string;
  match_percentage: number;
  matched_job_id?: string;
  matched_job_title?: string;
  match_breakdown?: { skills: number; type: number; experience: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  typeCounts?: Record<string, number>;
  subTypeCounts?: Record<string, Record<string, number>>;
}

// Query arg types
export interface VendorJobsArgs {
  page?: number;
  limit?: number;
}

export interface CandidateMatchesArgs {
  page?: number;
  limit?: number;
  types?: string;
  filter_type?: string;
  sub_type?: string;
  work_mode?: string;
  search?: string;
}

export interface VendorCandidateMatchesArgs {
  job_id?: string;
  page?: number;
  limit?: number;
}

export type PostJobArgs = Omit<
  Job,
  | "id"
  | "vendor_id"
  | "vendor_email"
  | "is_active"
  | "application_count"
  | "created_at"
  | "match_percentage"
  | "match_breakdown"
>;

export interface SendPokeArgs {
  to_email: string;
  to_name: string;
  subject_context: string;
  target_id: string;
  is_email: boolean;
  email_body?: string;
  target_vendor_id?: string;
  sender_name?: string;
  sender_email?: string;
  pdf_attachment?: string;
  job_id?: string;
  job_title?: string;
}

// ─── RTK Query API ────────────────────────────────────────────────────────────

type StateWithAuth = { auth: { token: string | null } };

export const jobsApi = createApi({
  reducerPath: "jobsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/",
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as StateWithAuth).auth.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    "VendorJobs",
    "CandidateMatches",
    "VendorCandidateMatches",
    "Profile",
    "PokesSent",
    "PokesReceived",
  ],
  endpoints: (builder) => ({
    // ── Jobs ──────────────────────────────────────────────────────────────────

    getVendorJobs: builder.query<
      PaginatedResponse<Job> | Job[],
      VendorJobsArgs
    >({
      query: (params) => ({ url: "api/jobs/vendor", params }),
      providesTags: ["VendorJobs"],
    }),

    getCandidateMatches: builder.query<
      PaginatedResponse<Job> | Job[],
      CandidateMatchesArgs
    >({
      query: (params) => ({ url: "api/jobs/jobmatches", params }),
      providesTags: ["CandidateMatches"],
    }),

    getVendorCandidateMatches: builder.query<
      PaginatedResponse<CandidateProfileMatch> | CandidateProfileMatch[],
      VendorCandidateMatchesArgs
    >({
      query: (params) => ({ url: "api/jobs/profilematches", params }),
      providesTags: ["VendorCandidateMatches"],
    }),

    postJob: builder.mutation<Job, PostJobArgs>({
      query: (body) => ({ url: "api/jobs/create", method: "POST", body }),
      invalidatesTags: ["VendorJobs"],
    }),

    closeJob: builder.mutation<Job, string>({
      query: (jobId) => ({
        url: `api/jobs/${jobId}/close`,
        method: "PATCH",
        body: {},
      }),
      invalidatesTags: ["VendorJobs"],
    }),

    reopenJob: builder.mutation<Job, string>({
      query: (jobId) => ({
        url: `api/jobs/${jobId}/reopen`,
        method: "PATCH",
        body: {},
      }),
      invalidatesTags: ["VendorJobs"],
    }),

    // ── Profile ───────────────────────────────────────────────────────────────

    getProfile: builder.query<CandidateProfile | null, void>({
      query: () => "api/jobs/profile",
      providesTags: ["Profile"],
      transformErrorResponse: (response) => {
        if ((response as any).status === 404) return null;
        return response;
      },
    }),

    upsertProfile: builder.mutation<CandidateProfile, CandidateProfile>({
      query: (body) => ({ url: "api/jobs/profile", method: "PUT", body }),
      invalidatesTags: ["Profile"],
    }),

    deleteProfile: builder.mutation<void, void>({
      query: () => ({ url: "api/jobs/profile", method: "DELETE" }),
      invalidatesTags: ["Profile"],
    }),

    // ── Pokes ─────────────────────────────────────────────────────────────────

    sendPoke: builder.mutation<string, SendPokeArgs>({
      query: (body) => ({ url: "api/jobs/poke", method: "POST", body }),
      transformResponse: (res: any) => res?.message || "Sent",
      invalidatesTags: ["PokesSent"],
    }),

    getPokesSent: builder.query<PokeRecord[], void>({
      query: () => "api/jobs/pokes/sent",
      providesTags: ["PokesSent"],
    }),

    getPokesReceived: builder.query<PokeRecord[], void>({
      query: () => "api/jobs/pokes/received",
      providesTags: ["PokesReceived"],
    }),
  }),
});

// ─── Export hooks ─────────────────────────────────────────────────────────────

export const {
  // Jobs
  useGetVendorJobsQuery,
  useGetCandidateMatchesQuery,
  useGetVendorCandidateMatchesQuery,
  usePostJobMutation,
  useCloseJobMutation,
  useReopenJobMutation,
  // Profile
  useGetProfileQuery,
  useUpsertProfileMutation,
  useDeleteProfileMutation,
  // Pokes
  useSendPokeMutation,
  useGetPokesSentQuery,
  useGetPokesReceivedQuery,
} = jobsApi;
