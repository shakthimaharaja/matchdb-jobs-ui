import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export interface Job {
  id: string;
  title: string;
  description: string;
  vendor_id: string;
  vendor_email: string;
  location: string;
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
  bio: string;
  // Resume sections
  resume_summary?: string;
  resume_experience?: string;
  resume_education?: string;
  resume_achievements?: string;
  // Visibility: which job types/sub-types this profile is visible under
  visibility_config?: Record<string, string[]>;
  // Lock flag — set by backend after first save
  profile_locked?: boolean;
}

export interface PokeRecord {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  sender_type: 'vendor' | 'candidate';
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
  match_breakdown?: {
    skills: number;
    type: number;
    experience: number;
  };
}

interface JobsState {
  jobs: Job[];
  vendorJobs: Job[];
  candidateMatches: Job[];
  vendorCandidateMatches: CandidateProfileMatch[];
  profile: CandidateProfile | null;
  pokesSent: PokeRecord[];
  pokesReceived: PokeRecord[];
  loading: boolean;
  profileLoading: boolean;
  pokeLoading: boolean;
  pokesLoading: boolean;
  error: string | null;
  profileError: string | null;
  pokeError: string | null;
  pokeSuccessMessage: string | null;
}

const initialState: JobsState = {
  jobs: [],
  vendorJobs: [],
  candidateMatches: [],
  vendorCandidateMatches: [],
  profile: null,
  pokesSent: [],
  pokesReceived: [],
  loading: false,
  profileLoading: false,
  pokeLoading: false,
  pokesLoading: false,
  error: null,
  profileError: null,
  pokeError: null,
  pokeSuccessMessage: null,
};

const getAxiosConfig = (token: string | null) => ({
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

export const fetchVendorJobs = createAsyncThunk(
  "jobs/fetchVendor",
  async (token: string | null, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/jobs/vendor", getAxiosConfig(token));
      return res.data as Job[];
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to fetch vendor jobs",
      );
    }
  },
);

export const fetchCandidateMatches = createAsyncThunk(
  "jobs/fetchCandidateMatches",
  async (token: string | null, { rejectWithValue }) => {
    try {
      const res = await axios.get(
        "/api/jobs/jobmatches",
        getAxiosConfig(token),
      );
      return res.data as Job[];
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to fetch candidate matches",
      );
    }
  },
);

export const fetchVendorCandidateMatches = createAsyncThunk(
  "jobs/fetchVendorCandidateMatches",
  async (
    payload: { token: string | null; jobId?: string | null },
    { rejectWithValue },
  ) => {
    try {
      const { token, jobId } = payload;
      const res = await axios.get("/api/jobs/profilematches", {
        ...getAxiosConfig(token),
        params: jobId ? { job_id: jobId } : {},
      });
      return res.data as CandidateProfileMatch[];
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to fetch vendor candidate matches",
      );
    }
  },
);

export const sendPoke = createAsyncThunk(
  "jobs/sendPoke",
  async (
    payload: {
      token: string | null;
      to_email: string;
      to_name: string;
      subject_context: string;
      target_id: string;            // candidateProfileId | jobId
      is_email: boolean;            // false=quick poke, true=mail template
      email_body?: string;
      target_vendor_id?: string;    // vendor ID of job (candidate sends)
      sender_name?: string;
      sender_email?: string;
      pdf_attachment?: string;      // base64 PDF for candidate resume
      job_id?: string;
      job_title?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const { token, ...body } = payload;
      const res = await axios.post("/api/jobs/poke", body, getAxiosConfig(token));
      return res.data?.message || "Sent";
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to send");
    }
  },
);

export const fetchPokesSent = createAsyncThunk(
  "jobs/fetchPokesSent",
  async (token: string | null, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/jobs/pokes/sent", getAxiosConfig(token));
      return res.data as PokeRecord[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch pokes sent");
    }
  },
);

export const fetchPokesReceived = createAsyncThunk(
  "jobs/fetchPokesReceived",
  async (token: string | null, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/jobs/pokes/received", getAxiosConfig(token));
      return res.data as PokeRecord[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch pokes received");
    }
  },
);

export const postJob = createAsyncThunk(
  "jobs/postJob",
  async (
    payload: {
      token: string | null;
      data: Omit<
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
    },
    { rejectWithValue },
  ) => {
    try {
      const { token, data } = payload;
      const res = await axios.post(
        "/api/jobs/create",
        data,
        getAxiosConfig(token),
      );
      return res.data as Job;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to post job");
    }
  },
);

export const closeJob = createAsyncThunk(
  "jobs/closeJob",
  async (
    payload: { token: string | null; jobId: string },
    { rejectWithValue },
  ) => {
    try {
      const { token, jobId } = payload;
      const res = await axios.patch(
        `/api/jobs/${jobId}/close`,
        {},
        getAxiosConfig(token),
      );
      return res.data as Job;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to close job",
      );
    }
  },
);

export const reopenJob = createAsyncThunk(
  "jobs/reopenJob",
  async (
    payload: { token: string | null; jobId: string },
    { rejectWithValue },
  ) => {
    try {
      const { token, jobId } = payload;
      const res = await axios.patch(
        `/api/jobs/${jobId}/reopen`,
        {},
        getAxiosConfig(token),
      );
      return res.data as Job;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to reopen job",
      );
    }
  },
);

export const deleteProfile = createAsyncThunk(
  "jobs/deleteProfile",
  async (token: string | null, { rejectWithValue }) => {
    try {
      await axios.delete("/api/jobs/profile", getAxiosConfig(token));
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to delete profile",
      );
    }
  },
);

export const fetchProfile = createAsyncThunk(
  "jobs/fetchProfile",
  async (token: string | null, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/jobs/profile", getAxiosConfig(token));
      return res.data as CandidateProfile;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      return rejectWithValue(
        err.response?.data?.error || "Failed to fetch profile",
      );
    }
  },
);

export const upsertProfile = createAsyncThunk(
  "jobs/upsertProfile",
  async (
    payload: { token: string | null; data: CandidateProfile },
    { rejectWithValue },
  ) => {
    try {
      const { token, data } = payload;
      const res = await axios.put(
        "/api/jobs/profile",
        data,
        getAxiosConfig(token),
      );
      return res.data as CandidateProfile;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to save profile",
      );
    }
  },
);

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    clearPokeState: (state) => {
      state.pokeError = null;
      state.pokeSuccessMessage = null;
    },
    clearProfileError: (state) => {
      state.profileError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.vendorJobs = action.payload;
      })
      .addCase(fetchVendorJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchCandidateMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidateMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.candidateMatches = action.payload;
      })
      .addCase(fetchCandidateMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchVendorCandidateMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorCandidateMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.vendorCandidateMatches = action.payload;
      })
      .addCase(fetchVendorCandidateMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(sendPoke.pending, (state) => {
        state.pokeLoading = true;
        state.pokeError = null;
        state.pokeSuccessMessage = null;
      })
      .addCase(sendPoke.fulfilled, (state, action) => {
        state.pokeLoading = false;
        state.pokeSuccessMessage = action.payload;
      })
      .addCase(sendPoke.rejected, (state, action) => {
        state.pokeLoading = false;
        state.pokeError = action.payload as string;
      })

      .addCase(postJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(postJob.fulfilled, (state, action) => {
        state.loading = false;
        state.vendorJobs.unshift(action.payload);
      })
      .addCase(postJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // closeJob / reopenJob — update the matching entry in vendorJobs
      .addCase(closeJob.fulfilled, (state, action) => {
        const idx = state.vendorJobs.findIndex(
          (j) => j.id === action.payload.id,
        );
        if (idx !== -1) state.vendorJobs[idx] = action.payload;
      })
      .addCase(reopenJob.fulfilled, (state, action) => {
        const idx = state.vendorJobs.findIndex(
          (j) => j.id === action.payload.id,
        );
        if (idx !== -1) state.vendorJobs[idx] = action.payload;
      })

      .addCase(fetchProfile.pending, (state) => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload as string;
      })

      .addCase(upsertProfile.pending, (state) => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(upsertProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.profile = action.payload;
      })
      .addCase(upsertProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload as string;
      })

      .addCase(deleteProfile.pending, (state) => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(deleteProfile.fulfilled, (state) => {
        state.profileLoading = false;
        state.profile = null;
      })
      .addCase(deleteProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload as string;
      })

      .addCase(fetchPokesSent.pending, (state) => { state.pokesLoading = true; })
      .addCase(fetchPokesSent.fulfilled, (state, action) => {
        state.pokesLoading = false;
        state.pokesSent = action.payload;
      })
      .addCase(fetchPokesSent.rejected, (state) => { state.pokesLoading = false; })

      .addCase(fetchPokesReceived.pending, (state) => { state.pokesLoading = true; })
      .addCase(fetchPokesReceived.fulfilled, (state, action) => {
        state.pokesLoading = false;
        state.pokesReceived = action.payload;
      })
      .addCase(fetchPokesReceived.rejected, (state) => { state.pokesLoading = false; });
  },
});

export const { clearPokeState, clearProfileError } = jobsSlice.actions;
export default jobsSlice.reducer;
