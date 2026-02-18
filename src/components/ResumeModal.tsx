import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchProfile,
  upsertProfile,
  clearProfileError,
  CandidateProfile as IProfile,
} from '../store/jobsSlice';
import './ResumeModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  token: string | null;
  userEmail: string | undefined;
}

const EMPTY: Partial<IProfile> = {
  name: '',
  email: '',
  phone: '',
  location: '',
  current_company: '',
  current_role: '',
  resume_summary: '',
  resume_experience: '',
  resume_education: '',
  resume_achievements: '',
  bio: '',
};

const ResumeModal: React.FC<Props> = ({ open, onClose, token, userEmail }) => {
  const dispatch = useAppDispatch();
  const { profile, profileLoading, profileError } = useAppSelector((s) => s.jobs);

  const [form, setForm] = useState<Partial<IProfile>>(EMPTY);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      dispatch(fetchProfile(token));
      setSaveSuccess(false);
    }
  }, [open, token, dispatch]);

  useEffect(() => {
    if (profile) {
      setForm({ ...profile });
    } else if (userEmail) {
      setForm((f) => ({ ...f, email: userEmail }));
    }
  }, [profile, userEmail]);

  if (!open) return null;

  const isLocked = !!profile?.profile_locked;

  const set = <K extends keyof IProfile>(key: K, value: IProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaveSuccess(false);
    dispatch(clearProfileError());
    const result = await dispatch(upsertProfile({ token, data: form as IProfile }));
    if (upsertProfile.fulfilled.match(result)) {
      setSaveSuccess(true);
    }
  };

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-window" onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="rm-titlebar">
          <span className="rm-titlebar-icon">📄</span>
          <span className="rm-titlebar-title">
            {isLocked ? 'My Resume (Read-Only)' : 'Fill In Your Resume'}
          </span>
          <button className="rm-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Status bar below titlebar */}
        <div className="rm-statusbar">
          {isLocked
            ? '🔒 Resume is locked after first save. You may still update contact info and preferences.'
            : 'Fill in your details below — skills will be auto-extracted on save. Copy-paste from your existing resume.'}
        </div>

        {/* Scrollable body */}
        <div className="rm-body">
          {profileError && (
            <div className="rm-alert rm-alert-error">{profileError}</div>
          )}
          {saveSuccess && (
            <div className="rm-alert rm-alert-success">
              {isLocked
                ? '✓ Preferences updated successfully!'
                : '✓ Resume saved! Skills have been extracted automatically.'}
            </div>
          )}

          {/* Contact info — always editable */}
          <fieldset className="rm-fieldset">
            <legend>Contact &amp; Basic Info</legend>
            <div className="rm-grid-2">
              <div className="rm-field">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.name || ''}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="rm-field">
                <label>Email *</label>
                <input
                  type="email"
                  className="rm-input"
                  value={form.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div className="rm-field">
                <label>Phone</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.phone || ''}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+1-555-0100"
                />
              </div>
              <div className="rm-field">
                <label>Location</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.location || ''}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>
          </fieldset>

          {/* Current role */}
          <fieldset className="rm-fieldset">
            <legend>Current Role</legend>
            <div className="rm-grid-2">
              <div className="rm-field">
                <label>Current Company</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.current_company || ''}
                  onChange={(e) => set('current_company', e.target.value)}
                  disabled={isLocked}
                  placeholder="Acme Inc"
                />
              </div>
              <div className="rm-field">
                <label>Current Role / Title</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.current_role || ''}
                  onChange={(e) => set('current_role', e.target.value)}
                  disabled={isLocked}
                  placeholder="Senior React Developer"
                />
              </div>
            </div>
          </fieldset>

          {/* Resume sections */}
          <fieldset className="rm-fieldset">
            <legend>
              Resume Sections
              {isLocked && <span className="rm-locked-badge">🔒 Read-only</span>}
            </legend>

            <div className="rm-field">
              <label>Professional Summary / Objective</label>
              {isLocked ? (
                <div className="rm-readonly">{form.resume_summary || '—'}</div>
              ) : (
                <textarea
                  className="rm-textarea"
                  rows={3}
                  value={form.resume_summary || ''}
                  onChange={(e) => set('resume_summary', e.target.value)}
                  placeholder="Brief overview of your career goals and key strengths..."
                />
              )}
            </div>

            <div className="rm-field rm-field-mt">
              <label>Work Experience</label>
              {isLocked ? (
                <div className="rm-readonly">{form.resume_experience || '—'}</div>
              ) : (
                <textarea
                  className="rm-textarea"
                  rows={6}
                  value={form.resume_experience || ''}
                  onChange={(e) => set('resume_experience', e.target.value)}
                  placeholder={`Sr. React Developer @ Acme Inc (2021–2024)\n- Built scalable dashboards using React, TypeScript, Redux\n- Led team of 4 engineers\n\nReact Developer @ Startup LLC (2019–2021)\n- Developed customer-facing web apps`}
                />
              )}
            </div>

            <div className="rm-field rm-field-mt">
              <label>Education</label>
              {isLocked ? (
                <div className="rm-readonly">{form.resume_education || '—'}</div>
              ) : (
                <textarea
                  className="rm-textarea"
                  rows={3}
                  value={form.resume_education || ''}
                  onChange={(e) => set('resume_education', e.target.value)}
                  placeholder={`B.S. Computer Science, State University (2018)\nRelevant coursework: Algorithms, Databases, Networks`}
                />
              )}
            </div>

            <div className="rm-field rm-field-mt">
              <label>Certifications &amp; Achievements</label>
              {isLocked ? (
                <div className="rm-readonly">{form.resume_achievements || '—'}</div>
              ) : (
                <textarea
                  className="rm-textarea"
                  rows={3}
                  value={form.resume_achievements || ''}
                  onChange={(e) => set('resume_achievements', e.target.value)}
                  placeholder={`AWS Certified Solutions Architect (2023)\nGoogle Cloud Professional Data Engineer`}
                />
              )}
            </div>

            <div className="rm-field rm-field-mt">
              <label>Brief Introduction / Bio</label>
              {isLocked ? (
                <div className="rm-readonly">{form.bio || '—'}</div>
              ) : (
                <textarea
                  className="rm-textarea"
                  rows={3}
                  value={form.bio || ''}
                  onChange={(e) => set('bio', e.target.value)}
                  placeholder="Tell recruiters about your experience and goals..."
                />
              )}
            </div>
          </fieldset>

          {/* Extracted skills read-only preview */}
          {profile?.skills && profile.skills.length > 0 && (
            <fieldset className="rm-fieldset">
              <legend>Extracted Skills <span className="rm-skill-note">auto-detected from your resume</span></legend>
              <div className="rm-skill-list">
                {profile.skills.map((s) => (
                  <span key={s} className="rm-skill-tag">{s}</span>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {/* Footer buttons */}
        <div className="rm-footer">
          {!isLocked && (
            <button
              className="rm-btn rm-btn-primary"
              onClick={handleSave}
              disabled={profileLoading || !form.name || !form.email}
              title="Save your resume — skills will be extracted automatically"
            >
              {profileLoading ? 'Saving...' : 'Save & Extract Skills'}
            </button>
          )}
          {isLocked && (
            <button
              className="rm-btn rm-btn-primary"
              onClick={handleSave}
              disabled={profileLoading}
              title="Update your contact information and preferences"
            >
              {profileLoading ? 'Saving...' : 'Update Preferences'}
            </button>
          )}
          <button className="rm-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeModal;
