import React, { useState } from 'react';
import { Job } from '../api/jobsApi';
import './ResumeModal.css';
import './JobPostingModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  job: Job | null;
  onClose_job?: (jobId: string) => Promise<void>;   // close (deactivate)
  onReopen_job?: (jobId: string) => Promise<void>;  // reopen (activate)
}

const fmt = (v: number | null | undefined, prefix = '$') =>
  v == null ? '—' : `${prefix}${Number(v).toLocaleString()}`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
};

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
};

const SUB_LABELS: Record<string, string> = {
  c2c: 'C2C (Corp-to-Corp)',
  c2h: 'C2H (Contract-to-Hire)',
  w2: 'W2',
  '1099': '1099',
  direct_hire: 'Direct Hire',
  salary: 'Salary',
};

const MODE_LABELS: Record<string, string> = {
  remote: 'Remote',
  onsite: 'On-Site',
  hybrid: 'Hybrid',
};

const JobPostingModal: React.FC<Props> = ({
  open, onClose, job, onClose_job, onReopen_job,
}) => {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false); // shows confirmation bar

  if (!open || !job) return null;

  const typeStr = TYPE_LABELS[job.job_type] || job.job_type || '—';
  const subStr = job.job_sub_type ? ` › ${SUB_LABELS[job.job_sub_type] || job.job_sub_type.toUpperCase()}` : '';
  const modeStr = job.work_mode ? (MODE_LABELS[job.work_mode] || job.work_mode) : '—';

  const handleClose_job = async () => {
    if (!onClose_job) return;
    setBusy(true);
    setConfirm(false);
    await onClose_job(job.id);
    setBusy(false);
  };

  const handleReopen = async () => {
    if (!onReopen_job) return;
    setBusy(true);
    await onReopen_job(job.id);
    setBusy(false);
  };

  return (
    <dialog open className="rm-overlay">
      <div className="rm-backdrop" role="none" onClick={onClose} />
      <div className="rm-window jpm-window">

        {/* Title bar */}
        <div className="rm-titlebar">
          <span className="rm-titlebar-icon">📋</span>
          <span className="rm-titlebar-title">{job.title}</span>
          {job.is_active
            ? <span className="jpm-badge jpm-badge-active">● Active</span>
            : <span className="jpm-badge jpm-badge-closed">● Closed</span>
          }
          <button className="rm-close" onClick={onClose} title="Close window">✕</button>
        </div>

        {/* Status bar */}
          <div className="rm-statusbar">
          Posted {fmtDate(job.created_at)}
          {job.application_count != null && ` · ${job.application_count} application${job.application_count === 1 ? '' : 's'}`}
          {job.vendor_email && ` · ${job.vendor_email}`}
        </div>

        {/* Inline confirmation bar */}
        {confirm && (
          <div className="jpm-confirm-bar">
            <span>Close this position? Candidates will no longer see it.</span>
            <button
              className="rm-btn jpm-btn-danger"
              onClick={handleClose_job}
              disabled={busy}
            >
              {busy ? 'Closing...' : 'Yes, Close Position'}
            </button>
            <button className="rm-btn" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="rm-body">

          {/* Job Details */}
          <fieldset className="rm-fieldset">
            <legend>Job Details</legend>
            <div className="rm-grid-2">
              <div className="rm-field">
                <span>Location</span>
                <div className="rm-readonly">{job.location || '—'}</div>
              </div>
              <div className="rm-field">
                <span>Job Type</span>
                <div className="rm-readonly">{typeStr}{subStr}</div>
              </div>
              <div className="rm-field">
                <span>Work Mode</span>
                <div className="rm-readonly">{modeStr}</div>
              </div>
              <div className="rm-field">
                <span>Experience Required</span>
                <div className="rm-readonly">
                  {(() => {
                    if (job.experience_required == null) return '—';
                    const suffix = job.experience_required === 1 ? '' : 's';
                    return `${job.experience_required} year${suffix}`;
                  })()}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Compensation */}
          <fieldset className="rm-fieldset">
            <legend>Compensation</legend>
            <div className="rm-grid-2">
              <div className="rm-field">
                <span>Pay Per Hour</span>
                <div className="rm-readonly">{fmt(job.pay_per_hour)}/hr</div>
              </div>
              <div className="rm-field">
                <span>Salary Range</span>
                <div className="rm-readonly jpm-description">
                  {job.salary_min == null && job.salary_max == null
                    ? '—'
                    : `${fmt(job.salary_min)} – ${fmt(job.salary_max)} /yr`}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Skills */}
          {job.skills_required?.length > 0 && (
            <fieldset className="rm-fieldset">
              <legend>Required Skills</legend>
              <div className="rm-skill-list">
                {job.skills_required.map((s) => (
                  <span key={s} className="rm-skill-tag">{s}</span>
                ))}
              </div>
            </fieldset>
          )}

          {/* Description */}
          <fieldset className="rm-fieldset">
            <legend>Job Description</legend>
            <div className="rm-readonly jpm-description">{job.description || '—'}</div>
          </fieldset>

          {/* Recruiter contact */}
          {(job.recruiter_name || job.recruiter_phone) && (
            <fieldset className="rm-fieldset">
              <legend>Recruiter Contact</legend>
              <div className="rm-grid-2">
                {job.recruiter_name && (
                  <div className="rm-field">
                    <span>Name</span>
                    <div className="rm-readonly">{job.recruiter_name}</div>
                  </div>
                )}
                {job.recruiter_phone && (
                  <div className="rm-field">
                    <span>Phone</span>
                    <div className="rm-readonly">{job.recruiter_phone}</div>
                  </div>
                )}
              </div>
            </fieldset>
          )}

        </div>

        {/* Footer */}
        <div className="rm-footer">
          {/* Close Position button — only when active */}
          {job.is_active && onClose_job && !confirm && (
            <button
              className="rm-btn jpm-btn-danger"
              onClick={() => setConfirm(true)}
              disabled={busy}
              title="Stop accepting applications for this position"
            >
              🔒 Close Position
            </button>
          )}

          {/* Reopen button — only when closed */}
          {!job.is_active && onReopen_job && (
            <button
              className="rm-btn jpm-btn-reopen"
              onClick={handleReopen}
              disabled={busy}
              title="Re-activate this job posting"
            >
              {busy ? 'Reopening...' : '✔ Reopen Position'}
            </button>
          )}

          <button className="rm-btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Close
          </button>
        </div>

      </div>
    </dialog>
  );
};

export default JobPostingModal;
