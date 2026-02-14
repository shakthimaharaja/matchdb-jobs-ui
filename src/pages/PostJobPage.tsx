import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { useAppDispatch, useAppSelector } from '../store';
import { postJob } from '../store/jobsSlice';
import './LegacyForms.css';

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'remote', label: 'Remote' },
];

interface FormState {
  title: string;
  description: string;
  location: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  pay_per_hour: number | null;
  skills_required: string[];
  experience_required: number | null;
  recruiter_name: string;
  recruiter_phone: string;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  location: '',
  job_type: 'full_time',
  salary_min: null,
  salary_max: null,
  pay_per_hour: null,
  skills_required: [],
  experience_required: null,
  recruiter_name: '',
  recruiter_phone: '',
};

interface Props {
  token: string | null;
  onPosted?: () => void;
}

const PostJobPage: React.FC<Props> = ({ token, onPosted }) => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.jobs);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [skillInput, setSkillInput] = useState('');
  const [success, setSuccess] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skills_required.includes(skill)) {
      setField('skills_required', [...form.skills_required, skill]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setField('skills_required', form.skills_required.filter((s) => s !== skill));
  };

  const onNumberChange = (field: 'salary_min' | 'salary_max' | 'pay_per_hour' | 'experience_required') =>
    (e: InputNumberValueChangeEvent) => {
      setField(field, e.value ?? null);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const result = await dispatch(postJob({
      token,
      data: {
        title: form.title,
        description: form.description,
        location: form.location,
        job_type: form.job_type,
        salary_min: form.salary_min,
        salary_max: form.salary_max,
        pay_per_hour: form.pay_per_hour,
        skills_required: form.skills_required,
        experience_required: form.experience_required ?? undefined,
        recruiter_name: form.recruiter_name || undefined,
        recruiter_phone: form.recruiter_phone || undefined,
      },
    }));

    if (postJob.fulfilled.match(result)) {
      setSuccess(true);
      setForm(EMPTY);
      if (onPosted) onPosted();
    }
  };

  return (
    <div className="legacy-form-page">
      <div className="legacy-form-shell">
        <div className="legacy-form-titlebar">
          <div className="legacy-form-title">Post A New Job</div>
          <div className="legacy-form-subtitle">PrimeReact form with legacy phpMyAdmin style.</div>
        </div>

        {error && (
          <div className="legacy-prime-message">
            <Message severity="error" text={error} />
          </div>
        )}
        {success && (
          <div className="legacy-prime-message">
            <Message severity="success" text="Job posted successfully! Candidates will be matched shortly." />
          </div>
        )}

        <form onSubmit={handleSubmit} className="legacy-form-card">
          <fieldset className="legacy-fieldset">
            <legend>Job Details</legend>
            <div className="legacy-row">
              <label htmlFor="job-title">Job Title *</label>
              <InputText
                id="job-title"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. Senior React Developer"
              />
            </div>
            <div className="legacy-row">
              <label htmlFor="job-description">Job Description *</label>
              <InputTextarea
                id="job-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={4}
                autoResize={false}
                placeholder="Describe responsibilities and expectations"
              />
            </div>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="job-location">Location</label>
                <InputText
                  id="job-location"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="City, State or Remote"
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="job-type">Job Type *</label>
                <Dropdown
                  id="job-type"
                  value={form.job_type}
                  options={JOB_TYPES}
                  optionLabel="label"
                  optionValue="value"
                  onChange={(e) => setField('job_type', e.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Compensation</legend>
            <div className="legacy-grid three-col">
              <div className="legacy-row">
                <label htmlFor="salary-min">Salary Min ($/yr)</label>
                <InputNumber id="salary-min" value={form.salary_min} onValueChange={onNumberChange('salary_min')} min={0} />
              </div>
              <div className="legacy-row">
                <label htmlFor="salary-max">Salary Max ($/yr)</label>
                <InputNumber id="salary-max" value={form.salary_max} onValueChange={onNumberChange('salary_max')} min={0} />
              </div>
              <div className="legacy-row">
                <label htmlFor="pay-hour">Pay Per Hour ($)</label>
                <InputNumber id="pay-hour" value={form.pay_per_hour} onValueChange={onNumberChange('pay_per_hour')} min={0} />
              </div>
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Requirements</legend>
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
                placeholder="e.g. React, Python, AWS"
              />
              <Button type="button" label="Add Skill" icon="pi pi-plus" className="legacy-btn legacy-prime-btn" onClick={addSkill} />
            </div>
            <div className="legacy-skill-list">
              {form.skills_required.map((skill) => (
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
              {form.skills_required.length === 0 && (
                <span className="legacy-muted">No skills added yet.</span>
              )}
            </div>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="experience-required">Experience Required (Years)</label>
                <InputNumber
                  id="experience-required"
                  value={form.experience_required}
                  onValueChange={onNumberChange('experience_required')}
                  min={0}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="legacy-fieldset">
            <legend>Recruiter Contact</legend>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="recruiter-name">Recruiter Name</label>
                <InputText
                  id="recruiter-name"
                  value={form.recruiter_name}
                  onChange={(e) => setField('recruiter_name', e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="recruiter-phone">Recruiter Phone</label>
                <InputText
                  id="recruiter-phone"
                  value={form.recruiter_phone}
                  onChange={(e) => setField('recruiter_phone', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className="legacy-actions">
            <Button
              type="submit"
              label={loading ? 'Posting...' : 'Post Job'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-send'}
              disabled={loading || !form.title || !form.description}
              className="legacy-btn legacy-btn-primary legacy-prime-btn"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostJobPage;
