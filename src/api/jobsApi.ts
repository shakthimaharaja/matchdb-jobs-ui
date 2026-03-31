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
import { CACHE_SHORT, CACHE_LONG } from "../constants";

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
  client_company_id: string;
  client_company_name: string;
  vendor_company_id: string;
  vendor_company_name: string;
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
  uid?: string;
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
  clientName: string;
  vendorCompanyName: string;
  implementationPartner: string;
  pocName: string;
  pocEmail: string;
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
  financials: (ProjectFinancialData & { uid: string })[];
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

// ─── Company Summary (aggregated across all candidates) ───────────────────────

export interface CompanySummaryCandidate {
  id: string;
  candidateName: string;
  candidateEmail: string;
  inviteStatus: string;
  currentRole: string;
  location: string;
  currentCompany: string;
  skills: string[];
  experienceYears: number;
  projectCount: number;
  activeProjects: number;
  totalBilled: number;
  totalPay: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  hoursWorked: number;
}

export interface CompanySummaryProject {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  vendorEmail: string;
  vendorCompanyName: string;
  clientName: string;
  implementationPartner: string;
  pocName: string;
  pocEmail: string;
  location: string;
  jobType: string;
  jobSubType: string;
  isActive: boolean;
  appliedAt: string;
  financials: {
    billRate: number;
    payRate: number;
    hoursWorked: number;
    projectStart: string | null;
    projectEnd: string | null;
    stateCode: string;
    totalBilled: number;
    totalPay: number;
    netPayable: number;
    amountPaid: number;
    amountPending: number;
  } | null;
}

export interface CompanySummaryDomainCount {
  domain: string;
  count: number;
}

export interface CompanySummaryResponse {
  candidates: CompanySummaryCandidate[];
  projects: CompanySummaryProject[];
  domainCounts: CompanySummaryDomainCount[];
  totals: {
    totalBilled: number;
    totalPay: number;
    netPayable: number;
    amountPaid: number;
    amountPending: number;
    hoursWorked: number;
    taxAmount: number;
    cashAmount: number;
  };
}

// ─── Vendor Financial Summary ─────────────────────────────────────────────────

export interface VendorFinancialCandidate {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  currentRole: string;
  location: string;
  jobTitle: string;
  jobType: string;
  jobSubType: string;
  isActive: boolean;
  clientName: string;
  implementationPartner: string;
  marketerCompanyName: string;
  billRate: number;
  payRate: number;
  hoursWorked: number;
  totalBilled: number;
  totalPay: number;
  taxAmount: number;
  cashAmount: number;
  netPayable: number;
  amountPaid: number;
  amountPending: number;
  projectStart: string | null;
  projectEnd: string | null;
  status: string;
}

export interface VendorClientPipeline {
  clientName: string;
  candidateCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  totalHours: number;
}

export interface VendorFinancialSummaryResponse {
  candidates: VendorFinancialCandidate[];
  clientPipeline: VendorClientPipeline[];
  totals: {
    totalCandidates: number;
    totalBilled: number;
    totalPay: number;
    totalHours: number;
    totalCredited: number;
    totalPending: number;
  };
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
    uid: string;
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

// ─── Timesheet types ──────────────────────────────────────────────────────────

export interface TimesheetEntry {
  date: string; // "YYYY-MM-DD"
  day: string; // "Monday" | "Tuesday" | ...
  hoursWorked: number;
  notes: string;
}

export interface Timesheet {
  id: string;
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  marketerId: string;
  marketerEmail: string;
  companyId: string;
  companyName: string;
  weekStart: string; // ISO
  weekEnd: string; // ISO
  entries: TimesheetEntry[];
  totalHours: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submittedAt: string | null;
  approvedAt: string | null;
  approverNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetListResponse {
  data: Timesheet[];
  total: number;
  page: number;
  limit: number;
}

export interface UpsertTimesheetArgs {
  weekStart: string;
  entries: TimesheetEntry[];
  candidateName?: string;
}

export interface MarketerTimesheetListResponse {
  data: Timesheet[];
  total: number;
}

export interface InviteVerifyResponse {
  status: "valid" | "already_accepted" | "expired";
  invite?: CompanyInviteInfo;
}

// ─── Interview Invite types ───────────────────────────────────────────────────

export interface InterviewInvite {
  id: string;
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
  candidateEmail: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  meetLink: string;
  proposedAt: string | null;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  respondedAt: string | null;
  candidateNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewInviteListResponse {
  data: InterviewInvite[];
  total: number;
}

export interface SendInterviewInviteArgs {
  candidateEmail: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
  proposedAt?: string;
  message?: string;
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

// ─── Company Admin & RBAC Types ───────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "vendor" | "marketer";
export type MarketerDepartment = "accounts" | "immigration" | "placement";
export type UserStatus = "active" | "invited" | "deactivated";

/** Returned by GET /admin/me — the current user's company context */
export interface CompanyContext {
  companyId: string;
  companyName: string;
  role: UserRole;
  department: MarketerDepartment | null;
  permissions: string[];
}

export interface SubscriptionPlanItem {
  _id: string;
  name: string;
  slug: string;
  maxJobPostings: number | null;
  maxCandidates: number | null;
  maxWorkers: number | null;
  priceMonthly: number;
  priceYearly: number;
  extraAdminFee: number;
  isActive: boolean;
}

export interface SubscriptionUsage {
  plan: SubscriptionPlanItem | null;
  usage: {
    jobPostings: number;
    maxJobPostings: number | null;
    candidates: number;
    maxCandidates: number | null;
    workers: number;
    maxWorkers: number | null;
    adminCount: number;
    extraAdminCount: number;
    extraAdminFee: number;
  };
}

export interface CompanyDetails {
  _id: string;
  name: string;
  legalName?: string;
  ein?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  logoUrl?: string;
}

export interface CompanyAdminDashboard {
  companyId: string;
  companyName: string;
  company: CompanyDetails;
  plan: SubscriptionPlanItem | null;
  role: UserRole;
  department: MarketerDepartment | null;
  permissions: string[];
  seatLimit: number;
  seatsUsed: number;
  activeUsers: number;
  pendingInvites: number;
}

export interface CompanySetupArgs {
  adminName: string;
  adminPhone?: string;
  adminDesignation?: string;
  companyName: string;
  companyLegalName?: string;
  companyEin?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyIndustry?: string;
  companySize?: string;
  subscriptionPlanSlug?: string;
}

export interface EmployeeInviteArgs {
  email: string;
  name?: string;
  role?: UserRole;
  department?: MarketerDepartment | null;
}

export interface EmployeeInvitationItem {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
}

export interface CompanyUserItem {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: MarketerDepartment | null;
  permissions: string[];
  status: UserStatus;
  onlineStatus: "online" | "away" | "offline";
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  joinedAt: string;
}

export interface ActiveUsersResponse {
  totalActive: number;
  totalOnline: number;
  totalAway: number;
  users: CompanyUserItem[];
}

// ─── Candidate Invitation Types ───────────────────────────────────────────────

export interface CandidatePlanItem {
  _id: string;
  companyId: string;
  planName: string;
  tier: "basic" | "standard" | "premium";
  price: number;
  currency: string;
  billingCycle: "monthly" | "yearly" | "one-time";
  features: string[];
  stripePriceId: string;
  isActive: boolean;
}

export interface CandidateInviteArgs {
  candidateName: string;
  candidateEmail: string;
  jobTitle?: string;
  candidatePlan: string;
  personalNote?: string;
}

export interface CandidateInvitationItem {
  id: string;
  candidateName: string;
  candidateEmail: string;
  plan: string;
  planTier: string;
  jobTitle: string;
  invitedBy: string;
  invitedByRole: string;
  status: "pending" | "payment_pending" | "active" | "expired" | "revoked";
  paymentStatus: "unpaid" | "paid" | "failed" | "refunded";
  createdAt: string;
  registeredAt: string | null;
  paidAt: string | null;
  tokenExpiresAt: string;
  candidateUserId: string | null;
  candidateStatus: string | null;
}

export interface CandidateAllResponse {
  counts: {
    total: number;
    pending: number;
    paymentPending: number;
    active: number;
    expired: number;
    revoked: number;
  };
  candidates: CandidateInvitationItem[];
}

export interface TokenVerifyResponse {
  valid: boolean;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  planName: string;
  plan: string;
  status: string;
  error?: string;
}

export interface CandidateRegisterArgs {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface CandidateRegisterResponse {
  candidateUserId: string;
  companyId: string;
  companyName: string;
  plan: string;
  planName: string;
  status: string;
  message: string;
}

export interface CreatePaymentSessionArgs {
  candidateUserId: string;
  planId: string;
}

export interface PaymentSessionResponse {
  sessionId: string;
  url: string;
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
  keepUnusedDataFor: CACHE_SHORT, // 5 min cache — marketer data persists across navigations
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
    "Timesheets",
    "MarketerTimesheets",
    "InterviewInvites",
    "VendorFinancials",
    "AdminDashboard",
    "EmployeeInvitations",
    "CompanyUsers",
    "ActiveUsers",
    "CompanyContext",
    "SubscriptionPlans",
    "SubscriptionUsage",
    "CompanyDetails",
    "CandidateInvitations",
    "CandidatePlans",
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

    getVendorFinancialSummary: builder.query<
      VendorFinancialSummaryResponse,
      void
    >({
      query: () => "api/jobs/vendor/financials/summary",
      providesTags: ["VendorFinancials"],
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
        if ((response as { status: number }).status === 404) return null;
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
      transformResponse: (res: { message?: string }) => res?.message || "Sent",
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
      keepUnusedDataFor: CACHE_LONG, // 10 min extra cache for stats
    }),

    getMarketerJobs: builder.query<
      PaginatedMarketer<MarketerJob>,
      MarketerQueryArgs
    >({
      query: (params) => ({ url: "api/jobs/marketer/jobs", params }),
      keepUnusedDataFor: CACHE_SHORT,
    }),

    getMarketerProfiles: builder.query<
      PaginatedMarketer<MarketerProfile>,
      MarketerQueryArgs
    >({
      query: (params) => ({ url: "api/jobs/marketer/profiles", params }),
      keepUnusedDataFor: CACHE_SHORT,
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

    getCompanySummary: builder.query<CompanySummaryResponse, void>({
      query: () => "api/jobs/marketer/company-summary",
      providesTags: ["MarketerCandidates", "ProjectFinancials"],
    }),

    getClientCompanies: builder.query<{ id: string; name: string }[], void>({
      query: () => "api/jobs/marketer/client-companies",
    }),

    getVendorCompanies: builder.query<{ id: string; name: string }[], void>({
      query: () => "api/jobs/marketer/vendor-companies",
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
      { ok: boolean },
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
      { ok: boolean },
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
      { ok: boolean },
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
        clientName?: string;
        vendorCompanyName?: string;
        implementationPartner?: string;
        pocName?: string;
        pocEmail?: string;
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

    // ── Timesheets (candidate) ─────────────────────────────────────────────────

    getTimesheets: builder.query<
      TimesheetListResponse,
      { page?: number; limit?: number }
    >({
      query: (params) => ({ url: "api/jobs/timesheets", params }),
      providesTags: ["Timesheets"],
    }),

    upsertTimesheet: builder.mutation<Timesheet, UpsertTimesheetArgs>({
      query: (body) => ({ url: "api/jobs/timesheets", method: "POST", body }),
      invalidatesTags: ["Timesheets"],
    }),

    submitTimesheet: builder.mutation<Timesheet, string>({
      query: (id) => ({
        url: `api/jobs/timesheets/${id}/submit`,
        method: "PATCH",
        body: {},
      }),
      invalidatesTags: ["Timesheets"],
    }),

    // ── Timesheets (marketer) ──────────────────────────────────────────────────

    getMarketerTimesheets: builder.query<
      MarketerTimesheetListResponse,
      { status?: string }
    >({
      query: (params) => ({ url: "api/jobs/timesheets/pending", params }),
      providesTags: ["MarketerTimesheets"],
    }),

    approveTimesheet: builder.mutation<
      Timesheet,
      { id: string; notes?: string }
    >({
      query: ({ id, notes }) => ({
        url: `api/jobs/timesheets/${id}/approve`,
        method: "PATCH",
        body: { notes },
      }),
      invalidatesTags: ["MarketerTimesheets"],
    }),

    rejectTimesheet: builder.mutation<
      Timesheet,
      { id: string; notes?: string }
    >({
      query: ({ id, notes }) => ({
        url: `api/jobs/timesheets/${id}/reject`,
        method: "PATCH",
        body: { notes },
      }),
      invalidatesTags: ["MarketerTimesheets"],
    }),

    // ── Interview Invites ─────────────────────────────────────────────────────

    sendInterviewInvite: builder.mutation<
      InterviewInvite,
      SendInterviewInviteArgs
    >({
      query: (body) => ({ url: "api/jobs/interviews", method: "POST", body }),
      invalidatesTags: ["InterviewInvites"],
    }),

    getInterviewInvitesSent: builder.query<InterviewInviteListResponse, void>({
      query: () => "api/jobs/interviews/sent",
      providesTags: ["InterviewInvites"],
    }),

    getInterviewInvitesReceived: builder.query<
      InterviewInviteListResponse,
      void
    >({
      query: () => "api/jobs/interviews/received",
      providesTags: ["InterviewInvites"],
    }),

    respondToInterviewInvite: builder.mutation<
      InterviewInvite,
      { id: string; action: "accept" | "decline"; note?: string }
    >({
      query: ({ id, action, note }) => ({
        url: `api/jobs/interviews/${id}/respond`,
        method: "PATCH",
        body: { action, note },
      }),
      invalidatesTags: ["InterviewInvites"],
    }),

    // ── Company Admin ─────────────────────────────────────────────────────────

    /** GET /admin/me — current user's company context (role, permissions) */
    getCompanyContext: builder.query<CompanyContext, void>({
      query: () => "api/jobs/admin/me",
      providesTags: ["CompanyContext"],
    }),

    /** GET /admin/plans — list subscription plans */
    getSubscriptionPlans: builder.query<SubscriptionPlanItem[], void>({
      query: () => "api/jobs/admin/plans",
      providesTags: ["SubscriptionPlans"],
    }),

    /** GET /admin/subscription/usage — current usage vs plan limits */
    getSubscriptionUsage: builder.query<SubscriptionUsage, void>({
      query: () => "api/jobs/admin/subscription/usage",
      providesTags: ["SubscriptionUsage"],
    }),

    /** PUT /admin/subscription/select — select or upgrade plan */
    selectSubscriptionPlan: builder.mutation<
      { message: string },
      { planSlug: string }
    >({
      query: (body) => ({
        url: "api/jobs/admin/subscription/select",
        method: "PUT",
        body,
      }),
      invalidatesTags: [
        "SubscriptionUsage",
        "SubscriptionPlans",
        "AdminDashboard",
        "CompanyContext",
      ],
    }),

    /** GET /admin/company — company details */
    getCompanyDetails: builder.query<CompanyDetails, void>({
      query: () => "api/jobs/admin/company",
      providesTags: ["CompanyDetails"],
    }),

    /** PUT /admin/company — update company details */
    updateCompanyDetails: builder.mutation<
      CompanyDetails,
      Partial<CompanyDetails>
    >({
      query: (body) => ({
        url: "api/jobs/admin/company",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["CompanyDetails", "AdminDashboard"],
    }),

    setupCompanyAdmin: builder.mutation<
      CompanyAdminDashboard,
      CompanySetupArgs
    >({
      query: (body) => ({ url: "api/jobs/admin/setup", method: "POST", body }),
      invalidatesTags: ["AdminDashboard"],
    }),

    getAdminDashboard: builder.query<CompanyAdminDashboard, void>({
      query: () => "api/jobs/admin/dashboard",
      providesTags: ["AdminDashboard"],
    }),

    // ── Employee Invitations ──────────────────────────────────────────────────

    sendEmployeeInvite: builder.mutation<
      EmployeeInvitationItem,
      EmployeeInviteArgs
    >({
      query: (body) => ({ url: "api/jobs/admin/invite", method: "POST", body }),
      invalidatesTags: ["EmployeeInvitations", "AdminDashboard"],
    }),

    getEmployeeInvitations: builder.query<EmployeeInvitationItem[], void>({
      query: () => "api/jobs/admin/invitations",
      providesTags: ["EmployeeInvitations"],
    }),

    revokeEmployeeInvitation: builder.mutation<
      { id: string; status: string },
      string
    >({
      query: (id) => ({
        url: `api/jobs/admin/invitations/${id}/revoke`,
        method: "PUT",
      }),
      invalidatesTags: ["EmployeeInvitations"],
    }),

    registerEmployee: builder.mutation<
      { message: string; companyId: string; role: string },
      { token: string; fullName: string; userId: string; email: string }
    >({
      query: ({ token, ...body }) => ({
        url: `api/jobs/admin/register/${token}`,
        method: "POST",
        body,
      }),
    }),

    // ── Company Users (RBAC) ──────────────────────────────────────────────────

    getCompanyUsers: builder.query<
      CompanyUserItem[],
      { role?: string; status?: string; search?: string }
    >({
      query: (params) => ({ url: "api/jobs/admin/users", params }),
      providesTags: ["CompanyUsers"],
    }),

    updateUserRole: builder.mutation<
      { id: string; role: string; permissions: string[] },
      { id: string; role: UserRole; department?: MarketerDepartment | null }
    >({
      query: ({ id, role, department }) => ({
        url: `api/jobs/admin/users/${id}/role`,
        method: "PUT",
        body: { role, department },
      }),
      invalidatesTags: ["CompanyUsers"],
    }),

    updateUserStatus: builder.mutation<
      { id: string; status: string },
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `api/jobs/admin/users/${id}/status`,
        method: "PUT",
        body: { status },
      }),
      invalidatesTags: ["CompanyUsers", "ActiveUsers", "AdminDashboard"],
    }),

    getActiveUsers: builder.query<ActiveUsersResponse, void>({
      query: () => "api/jobs/admin/users/active",
      providesTags: ["ActiveUsers"],
    }),

    sendHeartbeat: builder.mutation<{ ok: boolean }, void>({
      query: () => ({ url: "api/jobs/admin/heartbeat", method: "POST" }),
    }),

    // ── Candidate Invitations ─────────────────────────────────────────────────

    sendCandidateInvite: builder.mutation<
      CandidateInvitationItem,
      CandidateInviteArgs
    >({
      query: (body) => ({
        url: "api/jobs/candidate/invite",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CandidateInvitations"],
    }),

    verifyCandidateToken: builder.query<TokenVerifyResponse, string>({
      query: (token) => `api/jobs/candidate/invite/verify/${token}`,
    }),

    registerCandidate: builder.mutation<
      CandidateRegisterResponse,
      { token: string } & CandidateRegisterArgs
    >({
      query: ({ token, ...body }) => ({
        url: `api/jobs/candidate/register/${token}`,
        method: "POST",
        body,
      }),
    }),

    createCandidatePaymentSession: builder.mutation<
      PaymentSessionResponse,
      CreatePaymentSessionArgs
    >({
      query: (body) => ({
        url: "api/jobs/candidate/payment/session",
        method: "POST",
        body,
      }),
    }),

    getAllCandidates: builder.query<CandidateAllResponse, void>({
      query: () => "api/jobs/candidate/all",
      providesTags: ["CandidateInvitations"],
    }),

    getCandidateProfile: builder.query<any, string>({
      query: (id) => `api/jobs/candidate/${id}`,
      providesTags: ["CandidateInvitations"],
    }),

    revokeCandidateInvite: builder.mutation<
      { id: string; status: string },
      string
    >({
      query: (id) => ({
        url: `api/jobs/candidate/invite/${id}/revoke`,
        method: "PUT",
      }),
      invalidatesTags: ["CandidateInvitations"],
    }),

    resendCandidateInvite: builder.mutation<CandidateInvitationItem, string>({
      query: (id) => ({
        url: `api/jobs/candidate/invite/${id}/resend`,
        method: "POST",
      }),
      invalidatesTags: ["CandidateInvitations"],
    }),

    // ── Candidate Plans ───────────────────────────────────────────────────────

    getCandidatePlans: builder.query<CandidatePlanItem[], void>({
      query: () => "api/jobs/candidate/plans",
      providesTags: ["CandidatePlans"],
    }),

    createCandidatePlan: builder.mutation<
      CandidatePlanItem,
      Omit<CandidatePlanItem, "_id" | "companyId">
    >({
      query: (body) => ({
        url: "api/jobs/candidate/plans",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CandidatePlans"],
    }),

    updateCandidatePlan: builder.mutation<
      CandidatePlanItem,
      { id: string } & Partial<CandidatePlanItem>
    >({
      query: ({ id, ...body }) => ({
        url: `api/jobs/candidate/plans/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["CandidatePlans"],
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
  useGetCompanySummaryQuery,
  useGetClientCompaniesQuery,
  useGetVendorCompaniesQuery,
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
  // Timesheets
  useGetTimesheetsQuery,
  useUpsertTimesheetMutation,
  useSubmitTimesheetMutation,
  useGetMarketerTimesheetsQuery,
  useApproveTimesheetMutation,
  useRejectTimesheetMutation,
  // Interview Invites
  useSendInterviewInviteMutation,
  useGetInterviewInvitesSentQuery,
  useGetInterviewInvitesReceivedQuery,
  useRespondToInterviewInviteMutation,
  // Vendor Financials
  useGetVendorFinancialSummaryQuery,
  // Company Admin
  useGetCompanyContextQuery,
  useGetSubscriptionPlansQuery,
  useGetSubscriptionUsageQuery,
  useSelectSubscriptionPlanMutation,
  useGetCompanyDetailsQuery,
  useUpdateCompanyDetailsMutation,
  useSetupCompanyAdminMutation,
  useGetAdminDashboardQuery,
  // Employee Invitations
  useSendEmployeeInviteMutation,
  useGetEmployeeInvitationsQuery,
  useRevokeEmployeeInvitationMutation,
  useRegisterEmployeeMutation,
  // Company Users (RBAC)
  useGetCompanyUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  useGetActiveUsersQuery,
  useSendHeartbeatMutation,
  // Candidate Invitations
  useSendCandidateInviteMutation,
  useVerifyCandidateTokenQuery,
  useRegisterCandidateMutation,
  useCreateCandidatePaymentSessionMutation,
  useGetAllCandidatesQuery,
  useGetCandidateProfileQuery,
  useRevokeCandidateInviteMutation,
  useResendCandidateInviteMutation,
  // Candidate Plans
  useGetCandidatePlansQuery,
  useCreateCandidatePlanMutation,
  useUpdateCandidatePlanMutation,
} = jobsApi;
