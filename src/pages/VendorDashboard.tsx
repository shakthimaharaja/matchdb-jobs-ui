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
import PokeEmailModal from '../components/PokeEmailModal';
import { Job, PokeRecord } from '../store/jobsSlice';
import {
  clearPokeState,
  closeJob,
  fetchPokesSent,
  fetchPokesReceived,
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
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
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

const JOB_LIMIT: Record<string, number> = {
  free: 0,
  basic: 5,
  pro: 10,
  pro_plus: 20,
  enterprise: Infinity,
};
const POKE_LIMIT: Record<string, number> = {
  free: 0,
  basic: 25,
  pro: 50,
  pro_plus: Infinity,
  enterprise: Infinity,
};

type ViewMode = 'candidates' | 'postings' | 'pokes-sent' | 'pokes-received' | 'mails-sent' | 'mails-received';

/* ── Inline activity table (pokes or mails, sent or received) ── */
const SECTION_META: Record<
  'pokes-sent' | 'pokes-received' | 'mails-sent' | 'mails-received',
  { icon: string; title: string; toCol: string; emptyMsg: string }
> = {
  'pokes-sent':     { icon: '⚡', title: 'Pokes Sent',     toCol: 'To (Candidate)',   emptyMsg: 'No pokes sent yet.' },
  'pokes-received': { icon: '⚡', title: 'Pokes Received',  toCol: 'From (Candidate)', emptyMsg: 'No pokes received yet.' },
  'mails-sent':     { icon: '✉', title: 'Mails Sent',      toCol: 'To (Candidate)',   emptyMsg: 'No mails sent yet.' },
  'mails-received': { icon: '✉', title: 'Mails Received',   toCol: 'From (Candidate)', emptyMsg: 'No mails received yet.' },
};

const PokesTable: React.FC<{
  pokes: PokeRecord[];
  loading: boolean;
  section: 'pokes-sent' | 'pokes-received' | 'mails-sent' | 'mails-received';
}> = ({ pokes, loading, section }) => {
  const isSent = section === 'pokes-sent' || section === 'mails-sent';
  const meta = SECTION_META[section];
  return (
    <div className="matchdb-panel">
      <div className="matchdb-panel-title">
        <span className="matchdb-panel-title-icon">{meta.icon}</span>
        <span className="matchdb-panel-title-text">{meta.title}</span>
        <span className="matchdb-panel-title-meta">
          {loading ? 'Loading...' : `${pokes.length} record${pokes.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="matchdb-table-wrap">
        <table className="matchdb-table">
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '16%' }} />
            <col />
            <col style={{ width: '9%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>{meta.toCol}</th>
              <th>Email</th>
              <th>Type</th>
              <th>Job Title</th>
              <th>Subject / Context</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="matchdb-loading">
                  Loading records
                  <span className="matchdb-loading-dot">.</span>
                  <span className="matchdb-loading-dot" style={{ animationDelay: '0.2s' }}>.</span>
                  <span className="matchdb-loading-dot" style={{ animationDelay: '0.4s' }}>.</span>
                </td>
              </tr>
            )}
            {!loading && pokes.length === 0 && (
              <tr>
                <td colSpan={7} className="matchdb-empty">{meta.emptyMsg}</td>
              </tr>
            )}
            {!loading && pokes.map((p, i) => {
              const personName = isSent ? p.target_name : p.sender_name;
              const personEmail = isSent ? p.target_email : p.sender_email;
              const personType = isSent ? 'Candidate' : (p.sender_type || 'Candidate');
              return (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center', color: '#808080', fontSize: 10 }}>{i + 1}</td>
                  <td title={personName}>{personName}</td>
                  <td>
                    <a href={`mailto:${personEmail}`} style={{ color: '#2a5fa0', textDecoration: 'none' }}>
                      {personEmail}
                    </a>
                  </td>
                  <td>
                    <span className="matchdb-type-pill" style={{ textTransform: 'capitalize' }}>
                      {personType}
                    </span>
                  </td>
                  <td title={p.job_title || '—'}>{p.job_title || '—'}</td>
                  <td title={p.subject}>{p.subject}</td>
                  <td style={{ fontSize: 11 }}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="matchdb-footnote">
        <span>Showing {pokes.length} record{pokes.length !== 1 ? 's' : ''}</span>
        <span className="matchdb-footnote-sep">|</span>
        <span>InnoDB</span>
      </div>
    </div>
  );
};

const VendorDashboard: React.FC<Props> = ({ token, userEmail, plan = 'free', onPostJob }) => {
  const dispatch = useAppDispatch();
  const {
    vendorJobs,
    vendorCandidateMatches,
    loading,
    error,
    pokeLoading,
    pokeSuccessMessage,
    pokeError,
    pokesSent,
    pokesReceived,
    pokesLoading,
  } = useAppSelector((state) => state.jobs);

  // URL-driven navigation — browser back/forward for free
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'postings';
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
  const [selectedCandidate, setSelectedCandidate] = useState<Record<string, any> | null>(null);
  const [selectedJobPosting, setSelectedJobPosting] = useState<Job | null>(null);
  const [postingSearch, setPostingSearch] = useState('');
  const [closingJobId, setClosingJobId] = useState<string | null>(null);
  const [pricingBlur, setPricingBlur] = useState(false);
  const [pokeEmailRow, setPokeEmailRow] = useState<MatchRow | null>(null);
  const [pokeEmailSentSuccess, setPokeEmailSentSuccess] = useState(false);

  // Derive poke/email tracking from server-side pokesSent data
  const pokedRowIds = useMemo(
    () => new Set(pokesSent.filter((p) => !p.is_email).map((p) => p.target_id)),
    [pokesSent],
  );
  const emailedRowIds = useMemo(
    () => new Set(pokesSent.filter((p) => p.is_email).map((p) => p.target_id)),
    [pokesSent],
  );
  const pokeCount = useMemo(
    () => pokesSent.filter((p) => !p.is_email).length,
    [pokesSent],
  );
  const emailCount = useMemo(
    () => pokesSent.filter((p) => p.is_email).length,
    [pokesSent],
  );

  // target_id → poke created_at (passed to MatchDataTable for 24h mail cooldown)
  const pokedAtMap = useMemo(
    () => new Map(pokesSent.filter((p) => !p.is_email).map((p) => [p.target_id, p.created_at])),
    [pokesSent],
  );

  // Pre-filtered lists for Pokes / Mails sections
  const pokesSentOnly = useMemo(() => pokesSent.filter((p) => !p.is_email), [pokesSent]);
  const mailsSentOnly = useMemo(() => pokesSent.filter((p) => p.is_email), [pokesSent]);
  const pokesReceivedOnly = useMemo(() => pokesReceived.filter((p) => !p.is_email), [pokesReceived]);
  const mailsReceivedOnly = useMemo(() => pokesReceived.filter((p) => p.is_email), [pokesReceived]);

  const openPricingModal = () => {
    setPricingBlur(true);
    window.dispatchEvent(new CustomEvent('matchdb:openPricing', { detail: { tab: 'vendor' } }));
  };

  useEffect(() => {
    const onClose = () => setPricingBlur(false);
    window.addEventListener('matchdb:pricingClosed', onClose);
    return () => window.removeEventListener('matchdb:pricingClosed', onClose);
  }, []);

  const jobLimit = JOB_LIMIT[plan] ?? 0;
  const pokeLimit = POKE_LIMIT[plan] ?? 0;
  const activeJobs = vendorJobs.filter((j) => j.is_active);
  const activeJobCount = activeJobs.length;
  const atJobLimit = isFinite(jobLimit) && activeJobCount >= jobLimit;

  useEffect(() => {
    dispatch(fetchVendorJobs(token));
    dispatch(fetchPokesSent(token));
    dispatch(fetchPokesReceived(token));
  }, [dispatch, token]);

  useEffect(() => {
    if (viewMode === 'candidates') {
      dispatch(fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }));
    }
  }, [dispatch, token, selectedJobId, viewMode]);

  useEffect(() => {
    return () => {
      dispatch(clearPokeState());
    };
  }, [dispatch]);

  /* ── Candidate matches rows ── */
  const rows = useMemo<MatchRow[]>(() => {
    return vendorCandidateMatches
      .filter((candidate) => {
        const q = searchText.trim().toLowerCase();
        if (!q) return true;
        return (
          candidate.name?.toLowerCase().includes(q) ||
          candidate.current_role?.toLowerCase().includes(q) ||
          candidate.location?.toLowerCase().includes(q) ||
          candidate.email?.toLowerCase().includes(q)
        );
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
    return vendorJobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.job_type?.toLowerCase().includes(q),
    );
  }, [vendorJobs, postingSearch]);

  const selectedJobTitle = selectedJobId
    ? activeJobs.find((j) => j.id === selectedJobId)?.title || 'Job'
    : 'All Openings';

  const handlePoke = (row: MatchRow) => {
    if (!row.pokeTargetEmail) return;
    if (isFinite(pokeLimit) && pokeCount >= pokeLimit) return;
    dispatch(clearPokeState());
    dispatch(
      sendPoke({
        token,
        to_email: row.pokeTargetEmail,
        to_name: row.pokeTargetName,
        subject_context: row.pokeSubjectContext,
        target_id: row.id,
        is_email: false,
        sender_name: userEmail?.split('@')[0] || 'Vendor',
        sender_email: userEmail || '',
        job_id: selectedJobId || undefined,
        job_title: selectedJobId ? selectedJobTitle : undefined,
      }),
    ).then((result) => {
      if (sendPoke.fulfilled.match(result)) {
        dispatch(fetchPokesSent(token));
      }
    });
  };

  const handlePokeEmail = (row: MatchRow) => {
    dispatch(clearPokeState());
    setPokeEmailSentSuccess(false);
    setPokeEmailRow(row);
  };

  const handlePokeEmailSend = async (params: {
    to_email: string;
    to_name: string;
    subject_context: string;
    email_body: string;
    pdf_data?: string;
  }) => {
    if (!pokeEmailRow) return;
    const result = await dispatch(
      sendPoke({
        token,
        to_email: params.to_email,
        to_name: params.to_name,
        subject_context: params.subject_context,
        email_body: params.email_body,
        target_id: pokeEmailRow.id,
        is_email: true,
        sender_name: userEmail?.split('@')[0] || 'Vendor',
        sender_email: userEmail || '',
        job_id: selectedJobId || undefined,
        job_title: selectedJobId ? selectedJobTitle : undefined,
      }),
    );
    if (sendPoke.fulfilled.match(result)) {
      setPokeEmailSentSuccess(true);
      dispatch(fetchPokesSent(token));
      setTimeout(() => {
        setPokeEmailSentSuccess(false);
        setPokeEmailRow(null);
        dispatch(clearPokeState());
      }, 2000);
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Name', 'Company', 'Email', 'Phone', 'Role', 'Type',
      'Pay/Hr', 'Exp', 'Match%', 'Location',
    ];
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
    {
      label: 'Job Openings',
      icon: '',
      items: [
        {
          id: '',
          label: 'All Active Openings',
          count: activeJobs.length,
          active: viewMode === 'candidates' && selectedJobId === '',
          onClick: () => { setViewMode('candidates'); setSelectedJobId(''); },
        },
        ...activeJobs.map((job) => ({
          id: job.id,
          label: job.title,
          active: viewMode === 'candidates' && selectedJobId === job.id,
          onClick: () => { setViewMode('candidates'); setSelectedJobId(job.id); },
        })),
      ],
    },
    {
      label: 'Pokes',
      icon: '',
      items: [
        {
          id: 'pokes-sent',
          label: 'Pokes Sent',
          count: pokesSentOnly.length,
          active: viewMode === 'pokes-sent',
          onClick: () => setViewMode('pokes-sent'),
        },
        {
          id: 'pokes-received',
          label: 'Pokes Received',
          count: pokesReceivedOnly.length,
          active: viewMode === 'pokes-received',
          onClick: () => setViewMode('pokes-received'),
        },
      ],
    },
    {
      label: 'Mails',
      icon: '',
      items: [
        {
          id: 'mails-sent',
          label: 'Mails Sent',
          count: mailsSentOnly.length,
          active: viewMode === 'mails-sent',
          onClick: () => setViewMode('mails-sent'),
        },
        {
          id: 'mails-received',
          label: 'Mails Received',
          count: mailsReceivedOnly.length,
          active: viewMode === 'mails-received',
          onClick: () => setViewMode('mails-received'),
        },
        ...(plan !== 'free' && rows.length > 0
          ? [
              {
                id: 'mail-template',
                label: '✉ Mail Template',
                tooltip: 'Compose a personalised email to any matched candidate — click ✉ next to any row',
                onClick: () => {
                  setViewMode('candidates');
                  if (rows.length > 0) handlePokeEmail(rows[0]);
                },
              },
            ]
          : []),
      ],
    },
    {
      label: 'Actions',
      icon: '',
      items: [
        {
          id: 'refresh',
          label: 'Refresh Data',
          onClick: () => {
            dispatch(fetchVendorJobs(token));
            dispatch(fetchPokesSent(token));
            dispatch(fetchPokesReceived(token));
            if (viewMode === 'candidates') {
              dispatch(
                fetchVendorCandidateMatches({ token, jobId: selectedJobId || null }),
              );
            }
          },
        },
        {
          id: 'reset',
          label: 'Reset Filters',
          onClick: () => {
            setSelectedJobId('');
            setSearchText('');
            setPostingSearch('');
          },
        },
      ],
    },
  ];

  const breadcrumb: [string, string] | [string, string, string] =
    viewMode === 'pokes-sent'      ? ['Vendor Portal', 'Pokes', 'Pokes Sent']
    : viewMode === 'pokes-received'  ? ['Vendor Portal', 'Pokes', 'Pokes Received']
    : viewMode === 'mails-sent'      ? ['Vendor Portal', 'Mails', 'Mails Sent']
    : viewMode === 'mails-received'  ? ['Vendor Portal', 'Mails', 'Mails Received']
    : viewMode === 'candidates'      ? ['Vendor Portal', selectedJobTitle]
    : ['Vendor Portal', 'My Job Postings'];

  return (
    <DBLayout userType="vendor" navGroups={navGroups} breadcrumb={breadcrumb}>
      <div
        className="matchdb-page"
        style={
          pricingBlur
            ? { filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }
            : undefined
        }
      >
        {/* Plan / limit badges + Post Job button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <Tooltip title={`Your current plan: ${plan}`}>
            <Chip
              label={plan === 'pro_plus' ? 'PRO PLUS' : plan.toUpperCase()}
              size="small"
              icon={<StarIcon style={{ fontSize: 13 }} />}
              color={
                plan === 'pro_plus' || plan === 'enterprise'
                  ? 'success'
                  : plan === 'pro'
                    ? 'primary'
                    : plan === 'basic'
                      ? 'info'
                      : 'default'
              }
              variant="outlined"
              style={{ fontWeight: 700, fontSize: 11 }}
            />
          </Tooltip>
          {isFinite(jobLimit) && (
            <Tooltip
              title={
                atJobLimit
                  ? jobLimit === 0
                    ? 'Subscribe to post jobs'
                    : 'Upgrade to post more jobs'
                  : ''
              }
            >
              <Chip
                label={
                  jobLimit === 0
                    ? 'No job postings on free plan'
                    : `Active Jobs: ${activeJobCount}/${jobLimit}`
                }
                size="small"
                icon={atJobLimit ? <LockIcon style={{ fontSize: 13 }} /> : undefined}
                color={atJobLimit ? 'warning' : 'default'}
                variant="outlined"
                style={{ fontSize: 11 }}
              />
            </Tooltip>
          )}
          <Tooltip title={`Quick pokes sent (limit: ${isFinite(pokeLimit) ? pokeLimit : '∞'}/month)`}>
            <Chip
              label={
                isFinite(pokeLimit)
                  ? `Pokes: ${pokeCount}/${pokeLimit}`
                  : `Pokes: ${pokeCount}`
              }
              size="small"
              color={isFinite(pokeLimit) && pokeCount >= pokeLimit ? 'error' : 'default'}
              variant="outlined"
              style={{ fontSize: 11 }}
            />
          </Tooltip>
          <Tooltip title="Mail templates sent (each candidate can be emailed once)">
            <Chip
              label={`Emails: ${emailCount}`}
              size="small"
              color="default"
              variant="outlined"
              style={{ fontSize: 11 }}
            />
          </Tooltip>
          {onPostJob && (
            <button
              type="button"
              className="matchdb-btn matchdb-btn-primary"
              onClick={atJobLimit ? openPricingModal : onPostJob}
              style={{ marginLeft: 'auto' }}
            >
              {atJobLimit
                ? plan === 'free'
                  ? '🔒 Subscribe to Post Jobs'
                  : '🔒 Upgrade to Post More'
                : '+ Post New Job'}
            </button>
          )}
        </div>

        {/* ── POKES SENT VIEW ── */}
        {viewMode === 'pokes-sent' && (
          <PokesTable pokes={pokesSentOnly} loading={pokesLoading} section="pokes-sent" />
        )}

        {/* ── POKES RECEIVED VIEW ── */}
        {viewMode === 'pokes-received' && (
          <PokesTable pokes={pokesReceivedOnly} loading={pokesLoading} section="pokes-received" />
        )}

        {/* ── MAILS SENT VIEW ── */}
        {viewMode === 'mails-sent' && (
          <PokesTable pokes={mailsSentOnly} loading={pokesLoading} section="mails-sent" />
        )}

        {/* ── MAILS RECEIVED VIEW ── */}
        {viewMode === 'mails-received' && (
          <PokesTable pokes={mailsReceivedOnly} loading={pokesLoading} section="mails-received" />
        )}

        {/* ── MY JOB POSTINGS VIEW ── */}
        {viewMode === 'postings' && (
          <>
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

            <div className="matchdb-panel">
              <div className="matchdb-panel-title">
                <span className="matchdb-panel-title-icon">📋</span>
                <span className="matchdb-panel-title-text">My Job Postings</span>
                <span className="matchdb-panel-title-meta">
                  {loading
                    ? 'Loading...'
                    : `${filteredPostings.length} record${filteredPostings.length !== 1 ? 's' : ''}`}
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
                          <span
                            className="matchdb-loading-dot"
                            style={{ animationDelay: '0.2s' }}
                          >
                            .
                          </span>
                          <span
                            className="matchdb-loading-dot"
                            style={{ animationDelay: '0.4s' }}
                          >
                            .
                          </span>
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
                    {!loading &&
                      filteredPostings.map((job) => {
                        const typeStr =
                          TYPE_LABELS[job.job_type] || job.job_type || '-';
                        const subStr = job.job_sub_type
                          ? ` › ${SUB_LABELS[job.job_sub_type] || job.job_sub_type.toUpperCase()}`
                          : '';
                        return (
                          <tr
                            key={job.id}
                            title={`Click ⊕ to view full posting for "${job.title}"`}
                          >
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
                              <span
                                className={`matchdb-type-pill vdp-status${job.is_active ? '-active' : '-closed'}`}
                              >
                                {job.is_active ? '● Active' : '● Closed'}
                              </span>
                            </td>
                            <td title={job.location}>{job.location || '—'}</td>
                            <td title={`${typeStr}${subStr}`}>
                              <span className="matchdb-type-pill">
                                {typeStr}
                                {subStr}
                              </span>
                            </td>
                            <td>
                              {job.work_mode
                                ? MODE_LABELS[job.work_mode] || job.work_mode
                                : '—'}
                            </td>
                            <td>{formatRate(job.pay_per_hour)}</td>
                            <td>
                              {job.experience_required != null
                                ? `${job.experience_required}y`
                                : '—'}
                            </td>
                            <td>{job.skills_required?.length ?? 0}</td>
                            <td>{job.application_count ?? 0}</td>
                            <td>{fmtDate(job.created_at)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="matchdb-btn vdp-btn-matches"
                                disabled={!job.is_active}
                                title={
                                  job.is_active
                                    ? `View candidates matched to "${job.title}"`
                                    : 'Position is closed — reopen to view matches'
                                }
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
                <span>
                  Showing {filteredPostings.length} of {vendorJobs.length} posting
                  {vendorJobs.length !== 1 ? 's' : ''}
                </span>
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
            {plan === 'free' && (
              <div
                className="matchdb-panel"
                style={{ textAlign: 'center', padding: '48px 24px' }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: '#333',
                    margin: '0 0 8px',
                  }}
                >
                  Subscription Required
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: '#666',
                    maxWidth: 400,
                    margin: '0 auto 20px',
                    lineHeight: 1.6,
                  }}
                >
                  Viewing matched candidates requires an active subscription. Subscribe to the{' '}
                  <strong>Basic</strong> plan ($22/mo) or higher to browse candidates and send pokes.
                </p>
                <button
                  type="button"
                  className="matchdb-btn matchdb-btn-primary"
                  onClick={openPricingModal}
                >
                  View Subscription Plans →
                </button>
              </div>
            )}

            {plan !== 'free' && (
              <>
                <div className="matchdb-toolbar">
                  <div className="matchdb-toolbar-left">
                    <label className="matchdb-label" htmlFor="vendor-job-filter">
                      Opening
                    </label>
                    <select
                      id="vendor-job-filter"
                      className="matchdb-select"
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                    >
                      <option value="">All Active Openings</option>
                      {activeJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                    <label className="matchdb-label" htmlFor="vendor-search">
                      Search
                    </label>
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
                      onClick={() => {
                        setSelectedJobId('');
                        setSearchText('');
                      }}
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
                        dispatch(
                          fetchVendorCandidateMatches({
                            token,
                            jobId: selectedJobId || null,
                          }),
                        );
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
                  isVendor={true}
                  pokedRowIds={pokedRowIds}
                  emailedRowIds={emailedRowIds}
                  pokedAtMap={pokedAtMap}
                  onPoke={handlePoke}
                  onPokeEmail={handlePokeEmail}
                  onRowClick={(row) => setSelectedCandidate(row.rawData || null)}
                  onDownload={handleDownloadCSV}
                  downloadLabel="Download CSV"
                />
              </>
            )}
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

      {/* Mail Template modal */}
      <PokeEmailModal
        open={pokeEmailRow !== null}
        row={pokeEmailRow}
        isVendor={true}
        senderName={userEmail?.split('@')[0] || 'Vendor'}
        senderEmail={userEmail || ''}
        onSend={handlePokeEmailSend}
        onClose={() => {
          setPokeEmailRow(null);
          setPokeEmailSentSuccess(false);
          dispatch(clearPokeState());
        }}
        sending={pokeLoading}
        sentSuccess={pokeEmailSentSuccess}
      />
    </DBLayout>
  );
};

export default VendorDashboard;
