import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chip, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import { useAppDispatch, useAppSelector } from '../store';
import MatchDataTable, { MatchRow } from '../components/MatchDataTable';
import DBLayout, { NavGroup } from '../components/DBLayout';
import DetailModal from '../components/DetailModal';
import JobPostingModal from '../components/JobPostingModal';
import { Job } from '../store/jobsSlice';
import {
  clearPokeState,
  closeJob,
  fetchVendorCandidateMatches,
  fetchVendorJobs,
  reopenJob,
  sendPoke,
} from '../store/jobsSlice';

interface Props {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
  plan?: string;
  onPostJob?: () => void;
}

const formatRate = (value?: number | null) => (value ? `$${Number(value).toFixed(0)}` : '-');
const formatExperience = (value?: number | null) => `${Number(value || 0)} yrs`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
};

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
};
const SUB_LABELS: Record<string, string> = {
  c2c: 'C2C', c2h: 'C2H', w2: 'W2', '1099': '1099',
  direct_hire: 'Direct Hire', salary: 'Salary',
};
const MODE_LABELS: Record<string, string> = {
  remote: 'Remote', onsite: 'On-Site', hybrid: 'Hybrid',
};

const JOB_LIMIT: Record<string, number> = { free: 1, pro: 10, enterprise: Infinity };
const POKE_LIMIT: Record<string, number> = { free: 0, pro: 50, enterprise: Infinity };

type ViewMode = 'candidates' | 'postings';

const VendorDashboard: React.FC<Props> = ({ token, plan = 'free', onPostJob }) => {
  const dispatch = useAppDispatch();
  const {
    vendorJobs,
    vendorCandidateMatches,
    loading,
    error,
    pokeLoading,
    pokeSuccessMessage,
    pokeError,
  } = useAppSelector((state) => state.jobs);

  // URL-driven navigation state — gives browser back/forward for free
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'candidates';
  const selectedJobId = searchParams.get('job') || '';

  const setViewMode = (mode: ViewMode) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      return next;
    });
  };
  const setSelectedJobId = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('job', id);
      else next.delete('job');
      return next;
    });
  };

  const [searchText, setSearchText] = useState('');
  const [pokeCount, setPokeCount] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<Record<string, any> | null>(null);
  const [selectedJobPosting, setSelectedJobPosting] = useState<Job | null>(null);
  const [postingSearch, setPostingSearch] = useState('');
  const [closingJobId, setClosingJobId] = useState<string | null>(null);

  const jobLimit = JOB_LIMIT[plan] ?? 1;
  const pokeLimit = POKE_LIMIT[plan] ?? 0;
  const atJobLimit = isFinite(jobLimit) && vendorJobs.length >= jobLimit;

  useEffect(() => {
    dispatch(fetchVendorJobs(token));
  }, [dispatch, token]);

  useEffect(() => {
    if (viewMode === 'candidates') {
      dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
    }
  }, [dispatch, token, selectedJobId, viewMode]);

  useEffect(() => {
    return () => { dispatch(clearPokeState()); };
  }, [dispatch]);

  /* ── Candidate matches rows ── */
  const rows = useMemo<MatchRow[]>(() => {
    return vendorCandidateMatches
      .filter((candidate) => {
        const q = searchText.trim().toLowerCase();
        if (!q) return true;
        return candidate.name?.toLowerCase().includes(q)
          || candidate.current_role?.toLowerCase().includes(q)
          || candidate.location?.toLowerCase().includes(q)
          || candidate.email?.toLowerCase().includes(q);
      })
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name || '-',
        company: candidate.current_company || '-',
        email: candidate.email || '-',
        phone: candidate.phone || '-',
        role: candidate.current_role || '-',
        type: candidate.preferred_job_type || '-',
        payPerHour: formatRate(candidate.expected_hourly_rate),
        experience: formatExperience(candidate.experience_years),
        matchPercentage: candidate.match_percentage || 0,
        location: candidate.location || '-',
        pokeTargetEmail: candidate.email || '',
        pokeTargetName: candidate.name || 'Candidate',
        pokeSubjectContext: candidate.matched_job_title || 'Job opening',
        rawData: candidate as Record<string, any>,
      }));
  }, [searchText, vendorCandidateMatches]);

  /* ── Close / Reopen a job ── */
  const handleCloseJob = async (jobId: string) => {
    setClosingJobId(jobId);
    await dispatch(closeJob({ token, jobId }));
    setClosingJobId(null);
    // Sync the modal's job reference with updated state
    setSelectedJobPosting((prev) =>
      prev?.id === jobId ? { ...prev, is_active: false } : prev,
    );
  };

  const handleReopenJob = async (jobId: string) => {
    setClosingJobId(jobId);
    await dispatch(reopenJob({ token, jobId }));
    setClosingJobId(null);
    setSelectedJobPosting((prev) =>
      prev?.id === jobId ? { ...prev, is_active: true } : prev,
    );
  };

  /* ── Filtered postings ── */
  const filteredPostings = useMemo(() => {
    const q = postingSearch.trim().toLowerCase();
    if (!q) return vendorJobs;
    return vendorJobs.filter((j) =>
      j.title?.toLowerCase().includes(q) ||
      j.location?.toLowerCase().includes(q) ||
      j.job_type?.toLowerCase().includes(q),
    );
  }, [vendorJobs, postingSearch]);

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail || pokeCount >= pokeLimit) return;
    dispatch(clearPokeState());
    dispatch(sendPoke({
      token,
      to_email: row.pokeTargetEmail,
      to_name: row.pokeTargetName,
      subject_context: row.pokeSubjectContext,
    }));
    setPokeCount((c) => c + 1);
  };

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Role', 'Type', 'Pay/Hr', 'Exp', 'Match%', 'Location'];
    const csvRows = rows.map((r) =>
      [r.name, r.company, r.email, r.phone, r.role, r.type, r.payPerHour, r.experience, r.matchPercentage, r.location]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate-matches.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Sidebar nav groups ── */
  const activeJobs = vendorJobs.filter((j) => j.is_active);
  const navGroups: NavGroup[] = [
    {
      label: 'View',
      icon: '',
      items: [
        {
          id: 'view-candidates',
          label: 'Matched Candidates',
          count: vendorCandidateMatches.length,
          active: viewMode === 'candidates',
          onClick: () => setViewMode('candidates'),
        },
        {
          id: 'view-postings',
          label: 'My Job Postings',
          count: vendorJobs.length,
          active: viewMode === 'postings',
          onClick: () => setViewMode('postings'),
        },
      ],
    },
    ...(viewMode === 'candidates' ? [{
      label: 'Job Openings',
      icon: '',
      items: [
        {
          id: '',
          label: 'All Active Openings',
          count: activeJobs.length,
          active: selectedJobId === '',
          onClick: () => setSelectedJobId(''),
        },
        ...activeJobs.map((job) => ({
          id: job.id,
          label: job.title,
          active: selectedJobId === job.id,
          onClick: () => setSelectedJobId(job.id),
        })),
      ],
    }] : []),
    {
      label: 'Actions',
      icon: '',
      items: [
        {
          id: 'refresh',
          label: 'Refresh Data',
          onClick: () => {
            dispatch(fetchVendorJobs(token));
            if (viewMode === 'candidates') {
              dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
            }
          },
        },
        {
          id: 'reset',
          label: 'Reset Filters',
          onClick: () => { setSelectedJobId(''); setSearchText(''); setPostingSearch(''); },
        },
      ],
    },
  ];

  const selectedJobTitle = selectedJobId
    ? (activeJobs.find((j) => j.id === selectedJobId)?.title || 'Job')
    : 'All Openings';

  return (
    <DBLayout
      userType="vendor"
      navGroups={navGroups}
      breadcrumb={[
        'Vendor Portal',
        viewMode === 'postings' ? 'My Job Postings' : selectedJobTitle,
      ]}
    >
      <div className="matchdb-page">

        {/* Plan / limit badges + Post Job button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <Tooltip title={`Your current plan: ${plan}`}>
            <Chip
              label={plan.toUpperCase()}
              size="small"
              icon={<StarIcon style={{ fontSize: 13 }} />}
              color={plan === 'pro' ? 'primary' : plan === 'enterprise' ? 'success' : 'default'}
              variant="outlined"
              style={{ fontWeight: 700, fontSize: 11 }}
            />
          </Tooltip>
          {isFinite(jobLimit) && (
            <Tooltip title={atJobLimit ? 'Upgrade to post more jobs' : ''}>
              <Chip
                label={`Jobs: ${vendorJobs.length}/${jobLimit}`}
                size="small"
                icon={atJobLimit ? <LockIcon style={{ fontSize: 13 }} /> : undefined}
                color={atJobLimit ? 'warning' : 'default'}
                variant="outlined"
                style={{ fontSize: 11 }}
              />
            </Tooltip>
          )}
          {isFinite(pokeLimit) && (
            <Chip
              label={`Pokes: ${pokeCount}/${pokeLimit}`}
              size="small"
              color={pokeCount >= pokeLimit ? 'error' : 'default'}
              variant="outlined"
              style={{ fontSize: 11 }}
            />
          )}
          {onPostJob && (
            <button
              type="button"
              className="matchdb-btn matchdb-btn-primary"
              onClick={onPostJob}
              disabled={atJobLimit}
              style={{ marginLeft: 'auto', opacity: atJobLimit ? 0.5 : 1 }}
            >
              {atJobLimit ? '🔒 Upgrade to Post More' : '+ Post New Job'}
            </button>
          )}
        </div>

        {/* ── MY JOB POSTINGS VIEW ── */}
        {viewMode === 'postings' && (
          <>
            {/* Toolbar */}
            <div className="matchdb-toolbar">
              <div className="matchdb-toolbar-left">
                <label className="matchdb-label" htmlFor="posting-search">Search</label>
                <input
                  id="posting-search"
                  className="matchdb-input"
                  value={postingSearch}
                  onChange={(e) => setPostingSearch(e.target.value)}
                  placeholder="Title, location, type..."
                />
                <button
                  type="button"
                  className="matchdb-btn"
                  onClick={() => setPostingSearch('')}
                >
                  Reset
                </button>
              </div>
              <div className="matchdb-toolbar-right">
                <button
                  type="button"
                  className="matchdb-btn matchdb-btn-primary"
                  onClick={() => dispatch(fetchVendorJobs(token))}
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {/* Postings table */}
            <div className="matchdb-panel">
              <div className="matchdb-panel-title">
                <span className="matchdb-panel-title-icon">📋</span>
                <span className="matchdb-panel-title-text">My Job Postings</span>
                <span className="matchdb-panel-title-meta">
                  {loading ? 'Loading...' : `${filteredPostings.length} record${filteredPostings.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              <div className="matchdb-table-wrap">
                <table className="matchdb-table">
                  <colgroup>
                    <col style={{ width: 28 }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th title="Click to view full posting">⊕</th>
                      <th>Title</th>
                      <th title="Whether the job is accepting applications">Status</th>
                      <th title="Job location">Location</th>
                      <th title="Employment type and sub-type">Type</th>
                      <th title="Work arrangement">Mode</th>
                      <th title="Pay rate per hour">Pay/Hr</th>
                      <th title="Years of experience required">Exp</th>
                      <th title="Required skills count">Skills</th>
                      <th title="Number of applications received">Apps</th>
                      <th title="Date job was posted">Posted</th>
                      <th title="View matching candidates for this job">Matches</th>
                      <th title="Close or reopen this position">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={13} className="matchdb-loading">
                          Loading records
                          <span className="matchdb-loading-dot">.</span>
                          <span className="matchdb-loading-dot" style={{ animationDelay: '0.2s' }}>.</span>
                          <span className="matchdb-loading-dot" style={{ animationDelay: '0.4s' }}>.</span>
                        </td>
                      </tr>
                    )}
                    {!loading && filteredPostings.length === 0 && (
                      <tr>
                        <td colSpan={13} className="matchdb-empty">
                          {vendorJobs.length === 0
                            ? 'No job postings yet. Click "+ Post New Job" to get started.'
                            : 'No postings match your search.'}
                        </td>
                      </tr>
                    )}
                    {!loading && filteredPostings.map((job) => {
                      const typeStr = TYPE_LABELS[job.job_type] || job.job_type || '-';
                      const subStr = job.job_sub_type ? ` › ${SUB_LABELS[job.job_sub_type] || job.job_sub_type.toUpperCase()}` : '';
                      return (
                        <tr key={job.id} title={`Click ⊕ to view full posting for "${job.title}"`}>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="matchdb-btn matchdb-btn-expand"
                              title="View full job posting"
                              onClick={() => setSelectedJobPosting(job)}
                            >
                              ⊕
                            </button>
                          </td>
                          <td title={job.title}>{job.title}</td>
                          <td>
                            <span className={`matchdb-type-pill vdp-status${job.is_active ? '-active' : '-closed'}`}>
                              {job.is_active ? '● Active' : '● Closed'}
                            </span>
                          </td>
                          <td title={job.location}>{job.location || '—'}</td>
                          <td title={`${typeStr}${subStr}`}>
                            <span className="matchdb-type-pill">{typeStr}{subStr}</span>
                          </td>
                          <td>{job.work_mode ? (MODE_LABELS[job.work_mode] || job.work_mode) : '—'}</td>
                          <td>{formatRate(job.pay_per_hour)}</td>
                          <td>{job.experience_required != null ? `${job.experience_required}y` : '—'}</td>
                          <td>{job.skills_required?.length ?? 0}</td>
                          <td>{job.application_count ?? 0}</td>
                          <td>{fmtDate(job.created_at)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="matchdb-btn vdp-btn-matches"
                              disabled={!job.is_active}
                              title={job.is_active ? `View candidates matched to "${job.title}"` : 'Position is closed — reopen to view matches'}
                              onClick={() => {
                                setSearchParams((prev) => {
                                  const next = new URLSearchParams(prev);
                                  next.set('view', 'candidates');
                                  next.set('job', job.id);
                                  return next;
                                });
                              }}
                            >
                              👥 View
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {job.is_active ? (
                              <button
                                type="button"
                                className="matchdb-btn vdp-btn-close"
                                disabled={closingJobId === job.id}
                                onClick={() => handleCloseJob(job.id)}
                                title="Close this position — stop accepting applications"
                              >
                                {closingJobId === job.id ? '...' : '🔒 Close'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="matchdb-btn vdp-btn-reopen"
                                disabled={closingJobId === job.id}
                                onClick={() => handleReopenJob(job.id)}
                                title="Reopen this position — resume accepting applications"
                              >
                                {closingJobId === job.id ? '...' : '✔ Reopen'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="matchdb-footnote">
                <span>Showing {filteredPostings.length} of {vendorJobs.length} posting{vendorJobs.length !== 1 ? 's' : ''}</span>
                <span className="matchdb-footnote-sep">|</span>
                <span>Active: {activeJobs.length}</span>
                <span className="matchdb-footnote-sep">|</span>
                <span>InnoDB</span>
              </div>
            </div>
          </>
        )}

        {/* ── MATCHED CANDIDATES VIEW ── */}
        {viewMode === 'candidates' && (
          <>
            {/* Toolbar */}
            <div className="matchdb-toolbar">
              <div className="matchdb-toolbar-left">
                <label className="matchdb-label" htmlFor="vendor-job-filter">Opening</label>
                <select
                  id="vendor-job-filter"
                  className="matchdb-select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  <option value="">All Active Openings</option>
                  {activeJobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
                <label className="matchdb-label" htmlFor="vendor-search">Search</label>
                <input
                  id="vendor-search"
                  className="matchdb-input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Name, role, location..."
                />
                <button
                  type="button"
                  className="matchdb-btn"
                  onClick={() => { setSelectedJobId(''); setSearchText(''); }}
                >
                  Reset
                </button>
              </div>
              <div className="matchdb-toolbar-right">
                <button
                  type="button"
                  className="matchdb-btn matchdb-btn-primary"
                  onClick={() => {
                    dispatch(fetchVendorJobs(token));
                    dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
                  }}
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <MatchDataTable
              title="Related Candidate Profiles"
              titleIcon="👥"
              rows={rows}
              loading={loading}
              error={error}
              pokeLoading={pokeLoading}
              pokeSuccessMessage={pokeSuccessMessage}
              pokeError={pokeError}
              onPoke={handlePoke}
              onRowClick={(row) => setSelectedCandidate(row.rawData || null)}
              onDownload={handleDownloadCSV}
              downloadLabel="Download CSV"
            />
          </>
        )}

      </div>

      {/* Candidate detail modal */}
      <DetailModal
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
        type="candidate"
        data={selectedCandidate}
        matchPercentage={selectedCandidate?.match_percentage}
      />

      {/* Job posting detail modal */}
      <JobPostingModal
        open={selectedJobPosting !== null}
        onClose={() => setSelectedJobPosting(null)}
        job={selectedJobPosting}
        onClose_job={handleCloseJob}
        onReopen_job={handleReopenJob}
      />
    </DBLayout>
  );
};

export default VendorDashboard;
