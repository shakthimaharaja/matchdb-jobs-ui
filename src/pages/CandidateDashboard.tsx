import React, { useEffect, useMemo, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { useAppDispatch, useAppSelector } from '../store';
import MatchDataTable, { MatchRow } from '../components/MatchDataTable';
import DBLayout, { NavGroup } from '../components/DBLayout';
import {
  clearPokeState,
  fetchCandidateMatches,
  sendPoke,
} from '../store/jobsSlice';

interface Props {
  token: string | null;
  userId: string | undefined;
  userEmail: string | undefined;
  plan?: string;
}

const formatRate = (value?: number | null) => (value ? `$${Number(value).toFixed(0)}` : '-');
const formatExperience = (value?: number | null) => `${Number(value || 0)} yrs`;
const companyFromEmail = (email?: string) => {
  if (!email) return '-';
  const domain = email.split('@')[1] || '';
  return domain ? domain.split('.')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || '-' : '-';
};

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'remote', label: 'Remote' },
];

const POKE_LIMIT: Record<string, number> = { free: 5, pro: 20, enterprise: Infinity };

const CandidateDashboard: React.FC<Props> = ({ token, plan = 'free' }) => {
  const dispatch = useAppDispatch();
  const {
    candidateMatches,
    loading,
    error,
    pokeLoading,
    pokeSuccessMessage,
    pokeError,
  } = useAppSelector((state) => state.jobs);

  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [pokeCount, setPokeCount] = useState(0);

  const pokeLimit = POKE_LIMIT[plan] ?? 5;

  useEffect(() => {
    dispatch(fetchCandidateMatches(token));
  }, [dispatch, token]);

  useEffect(() => {
    return () => { dispatch(clearPokeState()); };
  }, [dispatch]);

  const rows = useMemo<MatchRow[]>(() => {
    return candidateMatches
      .filter((job) => {
        const typePass = filterType ? job.job_type === filterType : true;
        const q = searchText.trim().toLowerCase();
        const textPass = !q
          || job.title?.toLowerCase().includes(q)
          || job.location?.toLowerCase().includes(q)
          || job.vendor_email?.toLowerCase().includes(q);
        return typePass && textPass;
      })
      .map((job) => ({
        id: job.id,
        name: job.recruiter_name || 'Recruiter',
        company: companyFromEmail(job.vendor_email),
        email: job.vendor_email || '-',
        phone: job.recruiter_phone || '-',
        role: job.title,
        type: job.job_type || '-',
        payPerHour: formatRate(job.pay_per_hour),
        experience: formatExperience(job.experience_required),
        matchPercentage: job.match_percentage || 0,
        location: job.location || '-',
        pokeTargetEmail: job.vendor_email || '',
        pokeTargetName: job.recruiter_name || 'Vendor',
        pokeSubjectContext: job.title || 'Job opening',
      }));
  }, [candidateMatches, filterType, searchText]);

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

  // Count per type for sidebar
  const countByType = useMemo(() => {
    const map: Record<string, number> = {};
    candidateMatches.forEach((j) => {
      const t = j.job_type || 'other';
      map[t] = (map[t] || 0) + 1;
    });
    return map;
  }, [candidateMatches]);

  const navGroups: NavGroup[] = [
    {
      label: 'Job Type',
      icon: '🔍',
      items: [
        {
          id: '',
          label: 'All Types',
          count: candidateMatches.length,
          active: filterType === '',
          onClick: () => setFilterType(''),
        },
        ...JOB_TYPES.map((t) => ({
          id: t.value,
          label: t.label,
          count: countByType[t.value] || 0,
          active: filterType === t.value,
          onClick: () => setFilterType(t.value),
        })),
      ],
    },
    {
      label: 'Profile',
      icon: '👤',
      items: [
        {
          id: 'my-profile',
          label: 'My Profile',
        },
        {
          id: 'matches',
          label: 'Matched Jobs',
          count: candidateMatches.length,
          active: true,
        },
      ],
    },
    {
      label: 'Actions',
      icon: '⚙️',
      items: [
        {
          id: 'refresh',
          label: 'Refresh Data',
          onClick: () => dispatch(fetchCandidateMatches(token)),
        },
        {
          id: 'reset',
          label: 'Reset Filters',
          onClick: () => { setSearchText(''); setFilterType(''); },
        },
      ],
    },
  ];

  const filterLabel = filterType
    ? (JOB_TYPES.find((t) => t.value === filterType)?.label || filterType)
    : 'All Types';

  return (
    <DBLayout
      userType="candidate"
      navGroups={navGroups}
      breadcrumb={['Candidate Portal', 'Matched Jobs', filterLabel]}
    >
      <div className="matchdb-page">
        {/* Plan badge + poke counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
          {isFinite(pokeLimit) && (
            <Chip
              label={`Pokes: ${pokeCount}/${pokeLimit}`}
              size="small"
              color={pokeCount >= pokeLimit ? 'error' : 'default'}
              variant="outlined"
              style={{ fontSize: 11 }}
            />
          )}
        </div>

        {/* Toolbar */}
        <div className="matchdb-toolbar">
          <div className="matchdb-toolbar-left">
            <label className="matchdb-label" htmlFor="candidate-search">Search</label>
            <input
              id="candidate-search"
              className="matchdb-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Title, company, location..."
            />
            <label className="matchdb-label" htmlFor="candidate-type">Type</label>
            <select
              id="candidate-type"
              className="matchdb-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All</option>
              {JOB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="matchdb-btn"
              onClick={() => { setSearchText(''); setFilterType(''); }}
            >
              Reset
            </button>
          </div>
          <div className="matchdb-toolbar-right">
            <button
              type="button"
              className="matchdb-btn matchdb-btn-primary"
              onClick={() => dispatch(fetchCandidateMatches(token))}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <MatchDataTable
          title="Related Job Openings"
          titleIcon="📌"
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

export default CandidateDashboard;
