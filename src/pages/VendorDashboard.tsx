import React, { useEffect, useMemo, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import { useAppDispatch, useAppSelector } from '../store';
import MatchDataTable, { MatchRow } from '../components/MatchDataTable';
import DBLayout, { NavGroup } from '../components/DBLayout';
import {
  clearPokeState,
  fetchVendorCandidateMatches,
  fetchVendorJobs,
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

const JOB_LIMIT: Record<string, number> = { free: 1, pro: 10, enterprise: Infinity };
const POKE_LIMIT: Record<string, number> = { free: 0, pro: 50, enterprise: Infinity };

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

  const [searchText, setSearchText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [pokeCount, setPokeCount] = useState(0);

  const jobLimit = JOB_LIMIT[plan] ?? 1;
  const pokeLimit = POKE_LIMIT[plan] ?? 0;
  const atJobLimit = isFinite(jobLimit) && vendorJobs.length >= jobLimit;

  useEffect(() => {
    dispatch(fetchVendorJobs(token));
  }, [dispatch, token]);

  useEffect(() => {
    dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
  }, [dispatch, token, selectedJobId]);

  useEffect(() => {
    return () => { dispatch(clearPokeState()); };
  }, [dispatch]);

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
      }));
  }, [searchText, vendorCandidateMatches]);

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail) return;
    if (pokeCount >= pokeLimit) return;
    dispatch(clearPokeState());
    dispatch(sendPoke({
      token,
      to_email: row.pokeTargetEmail,
      to_name: row.pokeTargetName,
      subject_context: row.pokeSubjectContext,
    }));
    setPokeCount((c) => c + 1);
  };

  // Build sidebar nav groups
  const activeJobs = vendorJobs.filter((j) => j.is_active);
  const navGroups: NavGroup[] = [
    {
      label: 'Job Openings',
      icon: '💼',
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
    },
    {
      label: 'Actions',
      icon: '⚙️',
      items: [
        {
          id: 'refresh',
          label: 'Refresh Data',
          onClick: () => {
            dispatch(fetchVendorJobs(token));
            dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
          },
        },
        {
          id: 'reset',
          label: 'Reset Filters',
          onClick: () => { setSelectedJobId(''); setSearchText(''); },
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
      breadcrumb={['Vendor Portal', selectedJobTitle]}
    >
      <div className="matchdb-page">
        {/* Plan badge + limits */}
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
        />
      </div>
    </DBLayout>
  );
};

export default VendorDashboard;
