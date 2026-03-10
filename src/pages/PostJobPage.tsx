import React, { useEffect, useState } from 'react';
import { usePostJobMutation } from '../api/jobsApi';
import useDraftCache from '../hooks/useDraftCache';
import { Button } from 'matchdb-component-library';
import '../components/ResumeModal.css';
import './PostJobPage.css';

/* ── Constants ──────────────────────────────────────────────── */

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
];

const WORK_MODES = [
  { value: '', label: '— Not Specified —' },
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-Site' },
  { value: 'hybrid', label: 'Hybrid' },
];

const CONTRACT_SUB_TYPES = [
  { value: '', label: '— None —' },
  { value: 'c2c', label: 'C2C (Corp-to-Corp)' },
  { value: 'c2h', label: 'C2H (Contract-to-Hire)' },
  { value: 'w2', label: 'W2' },
  { value: '1099', label: '1099' },
];

const FULL_TIME_SUB_TYPES = [
  { value: '', label: '— None —' },
  { value: 'c2h', label: 'C2H (Contract-to-Hire)' },
  { value: 'w2', label: 'W2' },
  { value: 'direct_hire', label: 'Direct Hire' },
  { value: 'salary', label: 'Salary' },
];

/* ── Country list with flags ───────────────────────────────── */
const COUNTRIES = [
  { value: '', label: '— Select Country —', flag: '' },
  { value: 'US', label: '🇺🇸 United States', flag: '🇺🇸' },
  { value: 'IN', label: '🇮🇳 India', flag: '🇮🇳' },
  { value: 'GB', label: '🇬🇧 United Kingdom', flag: '🇬🇧' },
  { value: 'CA', label: '🇨🇦 Canada', flag: '🇨🇦' },
  { value: 'AU', label: '🇦🇺 Australia', flag: '🇦🇺' },
  { value: 'DE', label: '🇩🇪 Germany', flag: '🇩🇪' },
  { value: 'SG', label: '🇸🇬 Singapore', flag: '🇸🇬' },
  { value: 'AE', label: '🇦🇪 UAE', flag: '🇦🇪' },
  { value: 'JP', label: '🇯🇵 Japan', flag: '🇯🇵' },
  { value: 'NL', label: '🇳🇱 Netherlands', flag: '🇳🇱' },
  { value: 'FR', label: '🇫🇷 France', flag: '🇫🇷' },
  { value: 'BR', label: '🇧🇷 Brazil', flag: '🇧🇷' },
  { value: 'MX', label: '🇲🇽 Mexico', flag: '🇲🇽' },
  { value: 'PH', label: '🇵🇭 Philippines', flag: '🇵🇭' },
  { value: 'IL', label: '🇮🇱 Israel', flag: '🇮🇱' },
  { value: 'IE', label: '🇮🇪 Ireland', flag: '🇮🇪' },
  { value: 'PL', label: '🇵🇱 Poland', flag: '🇵🇱' },
  { value: 'SE', label: '🇸🇪 Sweden', flag: '🇸🇪' },
  { value: 'CH', label: '🇨🇭 Switzerland', flag: '🇨🇭' },
  { value: 'KR', label: '🇰🇷 South Korea', flag: '🇰🇷' },
];

/* ── Known skills dictionary for extraction ─────────────────── */
const SKILL_DICT = [
  'Java', 'Spring Boot', 'Spring', 'Kafka', 'RabbitMQ', 'ActiveMQ',
  'Docker', 'Kubernetes', 'Helm', 'Terraform', 'Jenkins', 'GitLab',
  'GitHub Actions', 'GitHub', 'Bitbucket', 'CI/CD',
  'AWS', 'GCP', 'Azure',
  'REST', 'RESTful', 'GraphQL', 'gRPC', 'Microservices',
  'SQL', 'NoSQL', 'PostgreSQL', 'MySQL', 'Oracle', 'MongoDB',
  'Redis', 'Cassandra', 'Elasticsearch',
  'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence',
  'React', 'Angular', 'Vue', 'TypeScript', 'JavaScript', 'Node.js',
  'Python', 'Go', 'Golang', 'Rust', 'C++', 'C#', '.NET', 'Scala',
  'Linux', 'Git', 'Maven', 'Gradle', 'JUnit', 'Mockito',
  'Hibernate', 'JPA', 'Selenium', 'Pytest', 'Cucumber',
  'Hadoop', 'Spark', 'Flink', 'Airflow',
  'OAuth', 'JWT', 'OpenID', 'SAML',
  'TM Forum', 'OSS', 'BSS', 'Telecom',
  'Visio', 'PowerPoint', 'Excel', 'Microsoft Office',
];

/* ── Smart parser ───────────────────────────────────────────── */
interface ParsedJob {
  title?: string;
  location?: string;
  job_type?: string;
  job_sub_type?: string;
  work_mode?: string;
  pay_per_hour?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  description?: string;
  skills_required?: string[];
  experience_required?: number | null;
}

function parseJobText(raw: string): ParsedJob {
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const lc = text.toLowerCase();
  const result: ParsedJob = {};

  // ── Title: first non-empty line ──
  if (nonEmpty.length > 0) result.title = nonEmpty[0];

  // ── Pay rate: $60/hr, $60/hour, 60 per hour ──
  const payMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:\/\s*hr|\/\s*hour|per\s+hour)/i);
  if (payMatch) result.pay_per_hour = parseFloat(payMatch[1]);

  // ── Salary range: $80k-$120k, $80,000-$120,000 ──
  const salMatch = text.match(/\$\s*(\d[\d,]*)\s*[kK]?\s*[-–]\s*\$?\s*(\d[\d,]*)\s*[kK]?/);
  if (salMatch && !payMatch) {
    let lo = parseFloat(salMatch[1].replace(/,/g, ''));
    let hi = parseFloat(salMatch[2].replace(/,/g, ''));
    if (lo < 2000) { lo *= 1000; hi *= 1000; }
    result.salary_min = lo;
    result.salary_max = hi;
  }

  // ── Job type + sub-type ──
  if (/\bc2c\b/.test(lc) || /corp[- ]to[- ]corp/.test(lc)) {
    result.job_type = 'contract';
    result.job_sub_type = 'c2c';
  } else if (/\bc2h\b/.test(lc) || /contract[- ]to[- ]hire/.test(lc)) {
    result.job_type = 'contract';
    result.job_sub_type = 'c2h';
  } else if (/\b1099\b/.test(lc)) {
    result.job_type = 'contract';
    result.job_sub_type = '1099';
  } else if (/\bw2\b/.test(lc) && /\bcontract\b/.test(lc)) {
    result.job_type = 'contract';
    result.job_sub_type = 'w2';
  } else if (/\bcontract\b/.test(lc) || /\bcontractor\b/.test(lc)) {
    result.job_type = 'contract';
  } else if (/\bfull[- ]time\b/.test(lc)) {
    result.job_type = 'full_time';
    if (/\bdirect hire\b/.test(lc)) result.job_sub_type = 'direct_hire';
    else if (/\bsalary\b/.test(lc)) result.job_sub_type = 'salary';
    else if (/\bw2\b/.test(lc)) result.job_sub_type = 'w2';
  } else if (/\bpart[- ]time\b/.test(lc)) {
    result.job_type = 'part_time';
  }

  // ── Work mode ──
  if (/\bremote\b/.test(lc)) {
    result.work_mode = 'remote';
  } else if (/\bhybrid\b/.test(lc)) {
    result.work_mode = 'hybrid';
  } else if (/\b(on[- ]?site|onsite|in[- ]office)\b/.test(lc)) {
    result.work_mode = 'onsite';
  }

  // ── Location ──
  // Look for explicit "Location:" label first
  const locLabel = text.match(/^(?:location|city|work\s+location)\s*:\s*(.+)/im);
  if (locLabel) {
    result.location = locLabel[1].trim();
  } else {
    // Check 2nd/3rd non-empty lines for short location strings
    for (let i = 1; i < Math.min(4, nonEmpty.length); i++) {
      const ln = nonEmpty[i];
      if (
        /^(remote|hybrid|on-?site|onsite)/i.test(ln) ||
        (/,/.test(ln) && ln.length < 40 && !/\$/.test(ln) && !/years?/i.test(ln))
      ) {
        result.location = ln;
        break;
      }
    }
    if (!result.location && result.work_mode === 'remote') result.location = 'Remote';
  }

  // ── Experience ──
  const expMatch = text.match(/(\d+)\s*\+?\s*years?\s*(of\s+)?(hands-on\s+)?(experience|exp)/i);
  if (expMatch) result.experience_required = parseInt(expMatch[1]);

  // ── Skills — match against known dictionary ──
  const skills: string[] = [];
  for (const skill of SKILL_DICT) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = skill.includes(' ')
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(text)) skills.push(skill);
  }
  result.skills_required = skills;

  // ── Full description = raw paste ──
  result.description = raw.trim();

  return result;
}

/* ── Helpers for summary display ───────────────────────────── */
function typeLabel(jt: string, st: string): string {
  if (!jt) return '—';
  const base = JOB_TYPES.find((t) => t.value === jt)?.label || jt;
  if (!st) return base;
  const sub = [...CONTRACT_SUB_TYPES, ...FULL_TIME_SUB_TYPES].find((t) => t.value === st);
  return `${base} › ${sub?.label.split(' ')[0] || st.toUpperCase()}`;
}

/* ── Types ──────────────────────────────────────────────────── */
interface FormState {
  title: string;
  description: string;
  location: string;
  job_country: string;
  job_state: string;
  job_city: string;
  job_type: string;
  job_sub_type: string;
  work_mode: string;
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
  job_country: '',
  job_state: '',
  job_city: '',
  job_type: 'full_time',
  job_sub_type: '',
  work_mode: '',
  salary_min: null,
  salary_max: null,
  pay_per_hour: null,
  skills_required: [],
  experience_required: null,
  recruiter_name: '',
  recruiter_phone: '',
};

interface Props {
  token?: string | null;
  onPosted?: () => void;
}

/* ── Component ──────────────────────────────────────────────── */
const PostJobPage: React.FC<Props> = ({ onPosted }) => {
  const [postJob, { isLoading: loading, error: rawError }] = usePostJobMutation();
  const error = rawError ? ((rawError as any).data?.error ?? 'Failed to post job.') : null;
  const { saveDraft, getDraft, clearDraft, hasDraft } = useDraftCache<FormState>('matchdb_draft_post_job');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [success, setSuccess] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Show restore banner on mount if a draft exists
  useEffect(() => {
    if (hasDraft()) setShowDraftBanner(true);
  }, []);

  // Auto-save draft as user fills in the form
  useEffect(() => {
    if (form.title || form.description) saveDraft(form);
  }, [form]);

  // Smart-paste state
  const [pasteText, setPasteText] = useState('');
  const [parseResult, setParseResult] = useState<ParsedJob | null>(null);

  /* ── Field helpers ── */
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  };

  /* ── Smart parse ── */
  const handleParse = () => {
    const parsed = parseJobText(pasteText);
    setParseResult(parsed);
    setForm((f) => ({
      ...f,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.location !== undefined ? { location: parsed.location } : {}),
      ...(parsed.job_type !== undefined ? { job_type: parsed.job_type } : {}),
      ...(parsed.job_sub_type !== undefined ? { job_sub_type: parsed.job_sub_type } : {}),
      ...(parsed.work_mode !== undefined ? { work_mode: parsed.work_mode } : {}),
      ...(parsed.pay_per_hour !== undefined ? { pay_per_hour: parsed.pay_per_hour } : {}),
      ...(parsed.salary_min !== undefined ? { salary_min: parsed.salary_min } : {}),
      ...(parsed.salary_max !== undefined ? { salary_max: parsed.salary_max } : {}),
      ...(parsed.experience_required !== undefined ? { experience_required: parsed.experience_required } : {}),
      ...(parsed.skills_required !== undefined ? { skills_required: parsed.skills_required } : {}),
    }));
    setSuccess(false);
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    try {
      await postJob({
        title: form.title,
        description: form.description,
        location: form.location,
        job_country: form.job_country,
        job_state: form.job_state || undefined,
        job_city: form.job_city || undefined,
        job_type: form.job_type,
        job_sub_type: form.job_sub_type || undefined,
        work_mode: form.work_mode || undefined,
        salary_min: form.salary_min,
        salary_max: form.salary_max,
        pay_per_hour: form.pay_per_hour,
        skills_required: form.skills_required,
        experience_required: form.experience_required ?? undefined,
        recruiter_name: form.recruiter_name || undefined,
        recruiter_phone: form.recruiter_phone || undefined,
      }).unwrap();
      clearDraft();
      setSuccess(true);
      setForm(EMPTY);
      setPasteText('');
      setParseResult(null);
      setShowDraftBanner(false);
      if (onPosted) onPosted();
    } catch {
      // error is read from rawError via the hook
    }
  };

  const showSubType = form.job_type === 'contract' || form.job_type === 'full_time';
  const subTypes = form.job_type === 'contract' ? CONTRACT_SUB_TYPES : FULL_TIME_SUB_TYPES;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="rm-body pjp-body" style={{ flex: 1, minHeight: 0 }}>

        {/* ── Draft restore banner ── */}
        {showDraftBanner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 8px', background: '#fffbe6',
            border: '1px solid #ffe066', borderRadius: 2,
            fontSize: 11, marginBottom: 6,
          }}>
            <span>📋 You have an unsaved job draft from a previous session.</span>
            <Button
              size="xs"
              onClick={() => {
                const draft = getDraft();
                if (draft) { setForm(draft); }
                setShowDraftBanner(false);
              }}
            >
              ↩ Restore Draft
            </Button>
            <Button
              size="xs"
              style={{ color: '#888' }}
              onClick={() => { clearDraft(); setShowDraftBanner(false); }}
            >
              ✕ Discard
            </Button>
          </div>
        )}

        {/* ── Alerts ── */}
        {error && <div className="rm-alert rm-alert-error">✕ {error}</div>}
        {success && (
          <div className="rm-alert rm-alert-success">
            ✓ Job posted successfully! Candidates will be matched shortly.
          </div>
        )}

        {/* ── Smart Paste Panel ── */}
        <fieldset className="rm-fieldset pjp-paste-panel">
          <legend>⚡ Smart Paste <span className="pjp-legend-hint">— paste any job posting to auto-fill the form</span></legend>
          <textarea
            className="rm-textarea pjp-paste-area"
            rows={6}
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setParseResult(null); }}
            placeholder={
              'Paste a job description here and click "Parse & Fill"\n\n' +
              'Example:\n' +
              'Java Developer\n' +
              'Remote\n' +
              '$60/hr C2C only\n\n' +
              'Required Qualifications:\n' +
              '8+ years of Java with Spring Boot, Kafka, Docker, Kubernetes...'
            }
          />
          <div className="pjp-paste-actions">
            <Button
              variant="primary"
              onClick={handleParse}
              disabled={!pasteText.trim()}
              title="Detect title, location, pay, job type, skills, and experience from the pasted text"
            >
              ⚡ Parse &amp; Fill Form
            </Button>
            {pasteText && (
              <Button
                size="xs"
                onClick={() => { setPasteText(''); setParseResult(null); }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Parse summary */}
          {parseResult && (
            <div className="pjp-parse-summary">
              <span className="pjp-summary-ok">✓ Fields filled — review below before posting</span>
              <div className="pjp-summary-chips">
                {parseResult.title && <span className="pjp-chip">📌 {parseResult.title}</span>}
                {parseResult.location && <span className="pjp-chip">📍 {parseResult.location}</span>}
                {parseResult.job_type && (
                  <span className="pjp-chip">💼 {typeLabel(parseResult.job_type, parseResult.job_sub_type || '')}</span>
                )}
                {parseResult.pay_per_hour != null && (
                  <span className="pjp-chip">💲 ${parseResult.pay_per_hour}/hr</span>
                )}
                {parseResult.salary_min != null && (
                  <span className="pjp-chip">💲 ${(parseResult.salary_min! / 1000).toFixed(0)}k–${(parseResult.salary_max! / 1000).toFixed(0)}k/yr</span>
                )}
                {parseResult.experience_required != null && (
                  <span className="pjp-chip">⏱ {parseResult.experience_required} yrs exp</span>
                )}
                {parseResult.work_mode && (
                  <span className="pjp-chip">🌐 {parseResult.work_mode}</span>
                )}
                {(parseResult.skills_required?.length ?? 0) > 0 && (
                  <span className="pjp-chip">🔧 {parseResult.skills_required!.length} skills detected</span>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {/* ── Job Details ── */}
        <fieldset className="rm-fieldset">
          <legend>Job Details</legend>
          <div className="rm-field">
            <label>Job Title *</label>
            <input
              type="text"
              className="rm-input"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Senior React Developer"
            />
          </div>
          <div className="rm-field rm-field-mt">
            <label>Job Description *</label>
            <textarea
              className="rm-textarea pjp-desc-area"
              rows={6}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Describe responsibilities and expectations"
            />
          </div>
          <div className="rm-grid-2" style={{ marginTop: 6 }}>
            <div className="rm-field">
              <label>Location</label>
              <input
                type="text"
                className="rm-input"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="City, State or Remote"
              />
            </div>
            <div className="rm-field">
              <label>Job Type *</label>
              <select
                className="rm-input"
                value={form.job_type}
                onChange={(e) => { setField('job_type', e.target.value); setField('job_sub_type', ''); }}
              >
                {JOB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Candidate Location (Country / State / City) ── */}
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#444', marginBottom: 2, display: 'block' }}>
              🌍 Where do you need a candidate?
            </label>
            <div className="rm-grid-2" style={{ marginTop: 2 }}>
              <div className="rm-field">
                <label>Country *</label>
                <select
                  className="rm-input"
                  value={form.job_country}
                  onChange={(e) => { setField('job_country', e.target.value); setField('job_state', ''); setField('job_city', ''); }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="rm-field">
                <label>State / Province</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.job_state}
                  onChange={(e) => setField('job_state', e.target.value)}
                  placeholder="e.g. California, Maharashtra"
                />
              </div>
            </div>
            <div className="rm-grid-2" style={{ marginTop: 4 }}>
              <div className="rm-field">
                <label>City</label>
                <input
                  type="text"
                  className="rm-input"
                  value={form.job_city}
                  onChange={(e) => setField('job_city', e.target.value)}
                  placeholder="e.g. San Francisco, Mumbai"
                />
              </div>
              <div />
            </div>
          </div>
          <div className="rm-grid-2" style={{ marginTop: 6 }}>
            {showSubType && (
              <div className="rm-field">
                <label>Sub Type</label>
                <select
                  className="rm-input"
                  value={form.job_sub_type}
                  onChange={(e) => setField('job_sub_type', e.target.value)}
                >
                  {subTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="rm-field">
              <label>Work Mode</label>
              <select
                className="rm-input"
                value={form.work_mode}
                onChange={(e) => setField('work_mode', e.target.value)}
              >
                {WORK_MODES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── Compensation ── */}
        <fieldset className="rm-fieldset">
          <legend>Compensation</legend>
          <div className="pjp-three-col">
            <div className="rm-field">
              <label>Salary Min ($/yr)</label>
              <input
                type="number"
                className="rm-input"
                min={0}
                value={form.salary_min ?? ''}
                onChange={(e) => setField('salary_min', e.target.value ? Number(e.target.value) : null)}
                placeholder="e.g. 80000"
              />
            </div>
            <div className="rm-field">
              <label>Salary Max ($/yr)</label>
              <input
                type="number"
                className="rm-input"
                min={0}
                value={form.salary_max ?? ''}
                onChange={(e) => setField('salary_max', e.target.value ? Number(e.target.value) : null)}
                placeholder="e.g. 120000"
              />
            </div>
            <div className="rm-field">
              <label>Pay Per Hour ($)</label>
              <input
                type="number"
                className="rm-input"
                min={0}
                value={form.pay_per_hour ?? ''}
                onChange={(e) => setField('pay_per_hour', e.target.value ? Number(e.target.value) : null)}
                placeholder="e.g. 60"
              />
            </div>
          </div>
        </fieldset>

        {/* ── Requirements ── */}
        <fieldset className="rm-fieldset">
          <legend>Requirements</legend>
          <p className="pjp-hint">
            Skills are automatically extracted from the job title and description when the job is saved.
          </p>
          <div className="rm-field rm-field-mt pjp-exp-field">
            <label>Experience Required (Years)</label>
            <input
              type="number"
              className="rm-input"
              min={0}
              value={form.experience_required ?? ''}
              onChange={(e) => setField('experience_required', e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 5"
            />
          </div>
        </fieldset>

        {/* ── Recruiter Contact ── */}
        <fieldset className="rm-fieldset">
          <legend>Recruiter Contact</legend>
          <div className="rm-grid-2">
            <div className="rm-field">
              <label>Recruiter Name</label>
              <input
                type="text"
                className="rm-input"
                value={form.recruiter_name}
                onChange={(e) => setField('recruiter_name', e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="rm-field">
              <label>Recruiter Phone</label>
              <input
                type="text"
                className="rm-input"
                value={form.recruiter_phone}
                onChange={(e) => setField('recruiter_phone', e.target.value)}
                placeholder="+1-555-0100"
              />
            </div>
          </div>
        </fieldset>


      </div>

      {/* ── Footer — pinned below scrollable body ── */}
      <div className="rm-footer">
        <Button
          variant="primary"
          type="submit"
          disabled={loading || !form.title || !form.description || !form.job_country}
          title="Post this job — skills will be auto-extracted from the description"
        >
          {loading ? 'Posting...' : '📤 Post Job'}
        </Button>
        <span className="pjp-hint" style={{ alignSelf: 'center', marginLeft: 4 }}>
          * Title, Description & Country are required
        </span>
      </div>
    </form>
  );
};

export default PostJobPage;
