import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchProfile, upsertProfile, clearProfileError, CandidateProfile as IProfile } from '../store/jobsSlice';
import './LegacyForms.css';

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'remote', label: 'Remote' },
];

const EMPTY: IProfile = {
  name: '',
  email: '',
  phone: '',
  current_company: '',
  current_role: '',
  preferred_job_type: 'full_time',
  expected_hourly_rate: null,
  experience_years: 0,
  skills: [],
  location: '',
  bio: '',
};

interface Props {
  token: string | null;
  userEmail: string | undefined;
}

const CandidateProfile: React.FC<Props> = ({ token, userEmail }) => {
  const dispatch = useAppDispatch();
  const { profile, profileLoading, profileError } = useAppSelector((state) => state.jobs);

  const [form, setForm] = useState<IProfile>(EMPTY);
  const [skillInput, setSkillInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    dispatch(fetchProfile(token));
  }, [dispatch, token]);

  useEffect(() => {
    if (profile) {
      setForm({ ...profile });
    } else if (userEmail && !form.email) {
      setForm((f) => ({ ...f, email: userEmail }));
    }
  }, [profile, userEmail]);

  const setField = <K extends keyof IProfile>(key: K, value: IProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveSuccess(false);
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setField('skills', [...form.skills, skill]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setField('skills', form.skills.filter((s) => s !== skill));
  };

  const onNumberChange = (field: 'expected_hourly_rate' | 'experience_years') =>
    (e: InputNumberValueChangeEvent) => {
      if (field === 'expected_hourly_rate') {
        setField(field, e.value ?? null);
      } else {
        setField(field, e.value ?? 0);
      }
    };

  const handleSave = async () => {
    setSaveSuccess(false);
    dispatch(clearProfileError());
    const result = await dispatch(upsertProfile({ token, data: form }));
    if (upsertProfile.fulfilled.match(result)) {
      setSaveSuccess(true);
    }
  };

  return (
    <div className="legacy-form-page">
      <div className="legacy-form-shell">
        <div className="legacy-form-titlebar">
          <div className="legacy-form-title">Candidate Profile</div>
          <div className="legacy-form-subtitle">PrimeReact form with legacy phpMyAdmin style.</div>
        </div>

        {profileError && (
          <div className="legacy-prime-message">
            <Message severity="error" text={profileError} />
          </div>
        )}
        {saveSuccess && (
          <div className="legacy-prime-message">
            <Message severity="success" text="Profile saved successfully!" />
          </div>
        )}

        <div className="legacy-form-card">
          <fieldset className="legacy-fieldset">
            <legend>Personal Information</legend>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="profile-name">Full Name *</label>
                <InputText
                  id="profile-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-email">Email *</label>
                <InputText
                  id="profile-email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-phone">Phone</label>
                <InputText
                  id="profile-phone"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-location">Location</label>
                <InputText
                  id="profile-location"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Professional Details</legend>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="profile-company">Current Company</label>
                <InputText
                  id="profile-company"
                  value={form.current_company}
                  onChange={(e) => setField('current_company', e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-role">Current Role</label>
                <InputText
                  id="profile-role"
                  value={form.current_role}
                  onChange={(e) => setField('current_role', e.target.value)}
                />
              </div>
            </div>
            <div className="legacy-grid three-col">
              <div className="legacy-row">
                <label htmlFor="profile-job-type">Preferred Job Type</label>
                <Dropdown
                  id="profile-job-type"
                  value={form.preferred_job_type}
                  options={JOB_TYPES}
                  optionLabel="label"
                  optionValue="value"
                  onChange={(e) => setField('preferred_job_type', e.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-rate">Expected Hourly Rate ($)</label>
                <InputNumber
                  id="profile-rate"
                  value={form.expected_hourly_rate}
                  onValueChange={onNumberChange('expected_hourly_rate')}
                  min={0}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-exp">Experience (Years)</label>
                <InputNumber
                  id="profile-exp"
                  value={form.experience_years}
                  onValueChange={onNumberChange('experience_years')}
                  min={0}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Skills</legend>
            <div className="legacy-skill-entry">
              <InputText
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. React, Python"
              />
              <Button type="button" label="Add Skill" icon="pi pi-plus" className="legacy-btn legacy-prime-btn" onClick={addSkill} />
            </div>
            <div className="legacy-skill-list">
              {form.skills.map((skill) => (
                <span key={skill} className="legacy-tag">
                  {skill}
                  <button
                    type="button"
                    className="legacy-tag-remove"
                    onClick={() => removeSkill(skill)}
                    aria-label={`Remove ${skill}`}
                  >
                    x
                  </button>
                </span>
              ))}
              {form.skills.length === 0 && (
                <span className="legacy-muted">No skills added yet.</span>
              )}
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Bio</legend>
            <div className="legacy-row">
              <label htmlFor="profile-bio">Brief Introduction</label>
              <InputTextarea
                id="profile-bio"
                value={form.bio}
                onChange={(e) => setField('bio', e.target.value)}
                rows={4}
                autoResize={false}
                placeholder="Tell recruiters about your experience and goals"
              />
            </div>
          </fieldset>

          <div className="legacy-actions">
            <Button
              type="button"
              label={profileLoading ? 'Saving...' : 'Save Profile'}
              icon={profileLoading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
              disabled={profileLoading || !form.name || !form.email}
              className="legacy-btn legacy-btn-primary legacy-prime-btn"
              onClick={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
