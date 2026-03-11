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

// ─── Marketer-specific types ──────────────────────────────────────────────────

export interface MarketerJob {
  id: string;
  title: string;
  description: string;
  vendor_email: string;
  recruiter_name: string;
  recruiter_phone: string;
  location: string;
  job_country: string;
  job_type: string;
  job_sub_type: string;
  work_mode: string;
  skills_required: string[];
  salary_min: number | null;
  salary_max: number | null;
  pay_per_hour: number | null;
  experience_required: number;
  application_count: number;
  poke_count: number;
  email_count: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  current_role: string;
  current_company: string;
  preferred_job_type: string;
  experience_years: number;
  expected_hourly_rate: number | null;
  skills: string[];
  location: string;
  resume_summary: string;
  resume_experience: string;
  resume_education: string;
  resume_achievements: string;
  bio: string;
  poke_count: number;
  email_count: number;
  created_at: string;
}

export interface PaginatedMarketer<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketerQueryArgs {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MarketerStats {
  total_profiles: number;
  total_jobs: number;
  total_open_jobs: number;
  total_closed_jobs: number;
  total_placed: number;
}

// ─── Company / Forwarding types ───────────────────────────────────────────────

export interface CompanyInfo {
  id: string;
  name: string;
  marketer_id?: string;
  marketer_email?: string;
  created_at?: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
}

export interface MarketerCandidateItem {
  id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  invite_status: string; // "none" | "invited" | "accepted"
  invite_sent_at: string | null;
  poke_count: number;
  email_count: number;
  current_role: string;
  skills: string[];
  experience_years: number;
  location: string;
  created_at: string;
}

export interface ProjectFinancialData {
  id: string;
  billRate: number;
  payRate: number;
  hoursWorked: number;
  projectStart: string | null;
  projectEnd: string | null;
  stateCode: string;
  stateTaxPct: number;
  cashPct: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  notes: string;
}

export interface CandidateDetailProject {
  id: string;
  job_id: string;
  job_title: string;
  vendor_email: string;
  location: string;
  job_type: string;
  job_sub_type: string;
  pay_per_hour: number | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  is_active: boolean;
  applied_at: string;
  financials: ProjectFinancialData | null;
}

// Same as CandidateDetailProject but financials is always an array (all marketers)
export interface CandidateMyDetailProject {
  id: string;
  job_id: string;
  job_title: string;
  vendor_email: string;
  location: string;
  job_type: string;
  job_sub_type: string;
  pay_per_hour: number | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  is_active: boolean;
  applied_at: string;
  financials: (ProjectFinancialData & { marketer_id: string })[];
}

export interface USStateTax {
  code: string;
  name: string;
  taxPct: number;
}

export interface FinancialSummary {
  count: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  hoursWorked: number;
}

export interface CandidateDetailVendorActivity {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_type: string;
  is_email: boolean;
  subject: string;
  job_title: string;
  created_at: string;
}

export interface CandidateDetailResponse {
  roster: {
    id: string;
    candidate_name: string;
    candidate_email: string;
    invite_status: string;
    invite_sent_at: string | null;
    created_at: string;
  };
  profile: {
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
    skills: string[];
    location: string;
    bio: string;
    resume_summary: string;
    resume_experience: string;
    resume_education: string;
    resume_achievements: string;
  } | null;
  projects: CandidateDetailProject[];
  forwarded_openings: {
    id: string;
    job_id: string;
    job_title: string;
    job_location: string;
    job_type: string;
    job_sub_type: string;
    vendor_email: string;
    status: string;
    note: string;
    created_at: string;
  }[];
  vendor_activity: CandidateDetailVendorActivity[];
}

export interface CandidateMyDetailResponse {
  profile: {
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
    skills: string[];
    location: string;
    bio: string;
    resume_summary: string;
    resume_experience: string;
    resume_education: string;
    resume_achievements: string;
  } | null;
  projects: CandidateMyDetailProject[];
  forwarded_openings: {
    id: string;
    job_id: string;
    job_title: string;
    job_location: string;
    job_type: string;
    job_sub_type: string;
    vendor_email: string;
    marketer_email: string;
    company_name: string;
    status: string;
    note: string;
    created_at: string;
  }[];
  vendor_activity: CandidateDetailVendorActivity[];
  marketer_info: {
    id: string;
    marketer_id: string;
    company_id: string;
    company_name: string;
    invite_status: string;
    invite_sent_at: string | null;
    forwarded_count: number;
    created_at: string;
  }[];
}

export interface CompanyInviteInfo {
  id: string;
  company_id: string;
  company_name: string;
  marketer_email: string;
  candidate_email: string;
  candidate_name: string;
  offer_note: string;
  status: string; // "pending" | "accepted" | "declined" | "expired"
  token: string;
  expires_at: string;
  created_at: string;
}

export interface CompanySearchResult {
  id: string;
  name: string;
}

export interface InviteVerifyResponse {
  status: "valid" | "already_accepted" | "expired";
  invite?: CompanyInviteInfo;
}

export interface ForwardedOpeningItem {
  id: string;
  candidate_email: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  job_location: string;
  job_type: string;
  job_sub_type: string;
  vendor_email: string;
  skills_required: string[];
  pay_per_hour: number | null;
  salary_min: number | null;
  salary_max: number | null;
  note: string;
  company_name: string;
  status: string;
  created_at: string;
  marketer_email?: string;
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
  keepUnusedDataFor: 300, // 5 min cache — marketer data persists across navigations
  tagTypes: [
    "VendorJobs",
    "CandidateMatches",
    "VendorCandidateMatches",
    "Profile",
    "PokesSent",
    "PokesReceived",
    "MarketerStats",
    "MarketerCompany",
    "MarketerCandidates",
    "ForwardedOpenings",
    "CandidateForwarded",
    "CompanyInvites",
    "ProjectFinancials",
    "CandidateMyDetail",
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

    // ── Marketer ──────────────────────────────────────────────────────────────

    getMarketerStats: builder.query<MarketerStats, void>({
      query: () => "api/jobs/marketer/stats",
      providesTags: ["MarketerStats"],
      keepUnusedDataFor: 600, // 10 min extra cache for stats
    }),

    getMarketerJobs: builder.query<
      PaginatedMarketer<MarketerJob>,
      MarketerQueryArgs
    >({
      query: (params) => ({ url: "api/jobs/marketer/jobs", params }),
      keepUnusedDataFor: 300,
    }),

    getMarketerProfiles: builder.query<
      PaginatedMarketer<MarketerProfile>,
      MarketerQueryArgs
    >({
      query: (params) => ({ url: "api/jobs/marketer/profiles", params }),
      keepUnusedDataFor: 300,
    }),

    // ── Marketer Company ──────────────────────────────────────────────────────

    registerCompany: builder.mutation<CompanyInfo, { name: string }>({
      query: (body) => ({
        url: "api/jobs/marketer/company",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MarketerCompany"],
    }),

    getMyCompany: builder.query<CompanyInfo | null, void>({
      query: () => "api/jobs/marketer/company",
      providesTags: ["MarketerCompany"],
    }),

    listCompanies: builder.query<CompanyListItem[], void>({
      query: () => "api/jobs/companies",
    }),

    // ── Marketer Candidates (company roster) ──────────────────────────────────

    addMarketerCandidate: builder.mutation<
      MarketerCandidateItem,
      { candidateName: string; candidateEmail: string }
    >({
      query: (body) => ({
        url: "api/jobs/marketer/candidates",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MarketerCandidates"],
    }),

    getMarketerCandidates: builder.query<MarketerCandidateItem[], void>({
      query: () => "api/jobs/marketer/candidates",
      providesTags: ["MarketerCandidates"],
    }),

    getMarketerCandidateDetail: builder.query<CandidateDetailResponse, string>({
      query: (id) => `api/jobs/marketer/candidates/${id}/detail`,
      providesTags: ["MarketerCandidates"],
    }),

    removeMarketerCandidate: builder.mutation<{ ok: boolean }, string>({
      query: (id) => ({
        url: `api/jobs/marketer/candidates/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["MarketerCandidates"],
    }),

    // ── Forward Openings ──────────────────────────────────────────────────────

    forwardOpening: builder.mutation<
      any,
      { candidateEmail: string; jobId: string; note?: string }
    >({
      query: (body) => ({
        url: "api/jobs/marketer/forward",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ForwardedOpenings"],
    }),

    getForwardedOpenings: builder.query<ForwardedOpeningItem[], void>({
      query: () => "api/jobs/marketer/forwarded",
      providesTags: ["ForwardedOpenings"],
    }),

    // ── Candidate Forwarded Openings ──────────────────────────────────────────

    getCandidateForwardedOpenings: builder.query<ForwardedOpeningItem[], void>({
      query: () => "api/jobs/candidate/forwarded",
      providesTags: ["CandidateForwarded"],
    }),

    // ── Candidate My Detail (self-view: overview/projects/marketer/forwarded) ──

    getCandidateMyDetail: builder.query<CandidateMyDetailResponse, void>({
      query: () => "api/jobs/candidate/my-detail",
      providesTags: ["CandidateMyDetail"],
    }),

    // ── Invite Candidate (marketer sends invite email) ────────────────────────

    inviteCandidate: builder.mutation<
      { ok: boolean; token: string },
      { candidateId: string; offerNote?: string }
    >({
      query: ({ candidateId, offerNote }) => ({
        url: `api/jobs/marketer/candidates/${candidateId}/invite`,
        method: "POST",
        body: { offerNote },
      }),
      invalidatesTags: ["MarketerCandidates", "CompanyInvites"],
    }),

    // ── Forward Opening with Email ────────────────────────────────────────────

    forwardOpeningWithEmail: builder.mutation<
      any,
      { candidateEmail: string; jobId: string; note?: string }
    >({
      query: (body) => ({
        url: "api/jobs/marketer/forward-with-email",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ForwardedOpenings"],
    }),

    // ── Update Forwarded Opening Status ───────────────────────────────────────

    updateForwardedStatus: builder.mutation<
      any,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `api/jobs/marketer/forwarded/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["ForwardedOpenings"],
    }),

    // ── Verify Invite (public — candidate landing page) ──────────────────────

    verifyInvite: builder.query<InviteVerifyResponse, string>({
      query: (token) => `api/jobs/invite/${token}`,
    }),

    // ── Accept Invite ─────────────────────────────────────────────────────────

    acceptInvite: builder.mutation<
      { ok: boolean },
      { token: string; candidateId?: string }
    >({
      query: ({ token }) => ({
        url: `api/jobs/invite/${token}/accept`,
        method: "POST",
      }),
      invalidatesTags: ["Profile"],
    }),

    // ── Company Search (fuzzy dropdown) ───────────────────────────────────────

    searchCompanies: builder.query<CompanySearchResult[], string>({
      query: (q) => ({
        url: "api/jobs/companies/search",
        params: { q },
      }),
    }),

    // ── Project Financials ────────────────────────────────────────────────────

    getStateTaxRates: builder.query<USStateTax[], void>({
      query: () => "api/jobs/marketer/financials/states",
    }),

    getFinancialSummary: builder.query<FinancialSummary, void>({
      query: () => "api/jobs/marketer/financials/summary",
      providesTags: ["ProjectFinancials"],
    }),

    upsertProjectFinancial: builder.mutation<
      ProjectFinancialData,
      {
        applicationId: string;
        candidateId?: string;
        candidateEmail?: string;
        billRate: number;
        payRate: number;
        hoursWorked: number;
        projectStart?: string;
        projectEnd?: string;
        stateCode: string;
        cashPct: number;
        amountPaid: number;
        notes?: string;
      }
    >({
      query: (body) => ({
        url: "api/jobs/marketer/financials",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ProjectFinancials", "MarketerCandidates"],
    }),

    deleteProjectFinancial: builder.mutation<{ ok: boolean }, string>({
      query: (applicationId) => ({
        url: `api/jobs/marketer/financials/${applicationId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ProjectFinancials", "MarketerCandidates"],
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
  // Marketer
  useGetMarketerStatsQuery,
  useGetMarketerJobsQuery,
  useGetMarketerProfilesQuery,
  // Marketer Company
  useRegisterCompanyMutation,
  useGetMyCompanyQuery,
  useListCompaniesQuery,
  // Marketer Candidates (company roster)
  useAddMarketerCandidateMutation,
  useGetMarketerCandidatesQuery,
  useGetMarketerCandidateDetailQuery,
  useRemoveMarketerCandidateMutation,
  // Forward Openings
  useForwardOpeningMutation,
  useGetForwardedOpeningsQuery,
  // Candidate Forwarded Openings
  useGetCandidateForwardedOpeningsQuery,
  // Candidate My Detail
  useGetCandidateMyDetailQuery,
  // Invite / Accept / Search
  useInviteCandidateMutation,
  useForwardOpeningWithEmailMutation,
  useUpdateForwardedStatusMutation,
  useVerifyInviteQuery,
  useAcceptInviteMutation,
  useSearchCompaniesQuery,
  useLazySearchCompaniesQuery,
  // Project Financials
  useGetStateTaxRatesQuery,
  useGetFinancialSummaryQuery,
  useUpsertProjectFinancialMutation,
  useDeleteProjectFinancialMutation,
} = jobsApi;
