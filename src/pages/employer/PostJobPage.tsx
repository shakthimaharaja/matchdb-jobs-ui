import React, { useEffect, useState } from "react";
import { usePostJobMutation } from "../../api/jobsApi";
import useDraftCache from "../../hooks/useDraftCache";
import { getApiErrorMessage } from "../../utils";
import { Button } from "matchdb-component-library";
import {
  JOB_TYPES,
  WORK_MODES_WITH_EMPTY as WORK_MODES,
  CONTRACT_SUB_TYPES_WITH_EMPTY as CONTRACT_SUB_TYPES,
  FULL_TIME_SUB_TYPES_WITH_EMPTY as FULL_TIME_SUB_TYPES,
  COUNTRIES,
} from "../../constants";
import "../../components/ResumeModal.css";
import "./PostJobPage.css";

/* ── Known skills dictionary for extraction ─────────────────── */
const KNOWN_SKILLS = [
  "Java",
  "Spring Boot",
  "Spring",
  "Kafka",
  "RabbitMQ",
  "ActiveMQ",
  "Docker",
  "Kubernetes",
  "Helm",
  "Terraform",
  "Jenkins",
  "GitLab",
  "GitHub Actions",
  "GitHub",
  "Bitbucket",
  "CI/CD",
  "AWS",
  "GCP",
  "Azure",
  "REST",
  "RESTful",
  "GraphQL",
  "gRPC",
  "Microservices",
  "SQL",
  "NoSQL",
  "PostgreSQL",
  "MySQL",
  "Oracle",
  "MongoDB",
  "Redis",
  "Cassandra",
  "Elasticsearch",
  "Agile",
  "Scrum",
  "Kanban",
  "Jira",
  "Confluence",
  "React",
  "Angular",
  "Vue",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Python",
  "Go",
  "Golang",
  "Rust",
  "C++",
  "C#",
  ".NET",
  "Scala",
  "Linux",
  "Git",
  "Maven",
  "Gradle",
  "JUnit",
  "Mockito",
  "Hibernate",
  "JPA",
  "Selenium",
  "Pytest",
  "Cucumber",
  "Hadoop",
  "Spark",
  "Flink",
  "Airflow",
  "OAuth",
  "JWT",
  "OpenID",
  "SAML",
  "TM Forum",
  "OSS",
  "BSS",
  "Telecom",
  "Visio",
  "PowerPoint",
  "Excel",
  "Microsoft Office",
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

function parsePayRate(text: string): number | undefined {
  const payRe = /\$\s*(\d+(?:\.\d+)?)\s*(?:\/\s*hr|\/\s*hour|per\s+hour)/i;
  const m = payRe.exec(text);
  return m ? Number.parseFloat(m[1]) : undefined;
}

function parseSalaryRange(
  text: string,
): { min: number; max: number } | undefined {
  const salRe = /\$\s*(\d[\d,]*)\s*[kK]?\s*[-–]\s*\$?\s*(\d[\d,]*)\s*[kK]?/;
  const m = salRe.exec(text);
  if (!m) return undefined;
  let lo = Number.parseFloat(m[1].replaceAll(",", ""));
  let hi = Number.parseFloat(m[2].replaceAll(",", ""));
  if (lo < 2000) {
    lo *= 1000;
    hi *= 1000;
  }
  return { min: lo, max: hi };
}

function parseJobType(lc: string): {
  job_type?: string;
  job_sub_type?: string;
} {
  if (/\bc2c\b/.test(lc) || /corp[- ]to[- ]corp/.test(lc)) {
    return { job_type: "contract", job_sub_type: "c2c" };
  } else if (/\bc2h\b/.test(lc) || /contract[- ]to[- ]hire/.test(lc)) {
    return { job_type: "contract", job_sub_type: "c2h" };
  } else if (/\b1099\b/.test(lc)) {
    return { job_type: "contract", job_sub_type: "1099" };
  } else if (/\bw2\b/.test(lc) && /\bcontract\b/.test(lc)) {
    return { job_type: "contract", job_sub_type: "w2" };
  } else if (/\bcontract\b/.test(lc) || /\bcontractor\b/.test(lc)) {
    return { job_type: "contract" };
  } else if (/\bfull[- ]time\b/.test(lc)) {
    let job_sub_type: string | undefined;
    if (/\bdirect hire\b/.test(lc)) job_sub_type = "direct_hire";
    else if (/\bsalary\b/.test(lc)) job_sub_type = "salary";
    else if (/\bw2\b/.test(lc)) job_sub_type = "w2";
    return { job_type: "full_time", job_sub_type };
  } else if (/\bpart[- ]time\b/.test(lc)) {
    return { job_type: "part_time" };
  }
  return {};
}

function parseWorkMode(lc: string): string | undefined {
  if (/\bremote\b/.test(lc)) return "remote";
  if (/\bhybrid\b/.test(lc)) return "hybrid";
  if (/\b(on[- ]?site|onsite|in[- ]office)\b/.test(lc)) return "onsite";
  return undefined;
}

function parseLocation(
  text: string,
  nonEmpty: string[],
  workMode: string | undefined,
): string | undefined {
  const locRe = /^(?:location|city|work\s+location)\s*:\s*(.+)/im;
  const locLabel = locRe.exec(text);
  if (locLabel) return locLabel[1].trim();
  for (let i = 1; i < Math.min(4, nonEmpty.length); i++) {
    const ln = nonEmpty[i];
    if (
      /^(remote|hybrid|on-?site|onsite)/i.test(ln) ||
      (/,/.test(ln) &&
        ln.length < 40 &&
        !ln.includes("$") &&
        !/years?/i.test(ln))
    ) {
      return ln;
    }
  }
  if (workMode === "remote") return "Remote";
  return undefined;
}

function parseExperience(text: string): number | undefined {
  const expRe =
    /(\d+)\s*\+?\s*years?\s*(of\s+)?(hands-on\s+)?(experience|exp)/i;
  const m = expRe.exec(text);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

function parseSkills(text: string): string[] {
  const skills: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const re = skill.includes(" ")
      ? new RegExp(escaped, "i")
      : new RegExp(String.raw`\b` + escaped + String.raw`\b`, "i");
    if (re.test(text)) skills.push(skill);
  }
  return skills;
}

function parseJobText(raw: string): ParsedJob {
  const text = raw.replaceAll("\r", "");
  const lines = text.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const lc = text.toLowerCase();
  const result: ParsedJob = {};

  if (nonEmpty.length > 0) result.title = nonEmpty[0];

  const payRate = parsePayRate(text);
  if (payRate !== undefined) result.pay_per_hour = payRate;

  if (payRate === undefined) {
    const salary = parseSalaryRange(text);
    if (salary) {
      result.salary_min = salary.min;
      result.salary_max = salary.max;
    }
  }

  const jt = parseJobType(lc);
  if (jt.job_type) result.job_type = jt.job_type;
  if (jt.job_sub_type) result.job_sub_type = jt.job_sub_type;

  result.work_mode = parseWorkMode(lc);
  result.location = parseLocation(text, nonEmpty, result.work_mode);
  const exp = parseExperience(text);
  if (exp !== undefined) result.experience_required = exp;
  result.skills_required = parseSkills(text);
  result.description = raw.trim();

  return result;
}

/* ── Helpers for summary display ───────────────────────────── */
function typeLabel(jt: string, st: string): string {
  if (!jt) return "—";
  const base = JOB_TYPES.find((t) => t.value === jt)?.label || jt;
  if (!st) return base;
  const sub = [...CONTRACT_SUB_TYPES, ...FULL_TIME_SUB_TYPES].find(
    (t) => t.value === st,
  );
  return `${base} › ${sub?.label.split(" ")[0] || st.toUpperCase()}`;
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
  title: "",
  description: "",
  location: "",
  job_country: "",
  job_state: "",
  job_city: "",
  job_type: "full_time",
  job_sub_type: "",
  work_mode: "",
  salary_min: null,
  salary_max: null,
  pay_per_hour: null,
  skills_required: [],
  experience_required: null,
  recruiter_name: "",
  recruiter_phone: "",
};

interface Props {
  onPosted?: () => void;
}

/* ── Component ──────────────────────────────────────────────── */
const PostJobPage: React.FC<Props> = ({ onPosted }) => {
  const [postJob, { isLoading: loading, error: rawError }] =
    usePostJobMutation();
  const error = rawError
    ? getApiErrorMessage(rawError, "Failed to post job.")
    : null;
  const { saveDraft, getDraft, clearDraft, hasDraft } =
    useDraftCache<FormState>("matchdb_draft_post_job");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [success, setSuccess] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Show restore banner on mount if a draft exists
  useEffect(() => {
    if (hasDraft()) setShowDraftBanner(true);
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft as user fills in the form
  useEffect(() => {
    if (form.title || form.description) saveDraft(form);
    // saveDraft is stable (from useDraftCache)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Smart-paste state
  const [pasteText, setPasteText] = useState("");
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
      ...(parsed.title === undefined ? {} : { title: parsed.title }),
      ...(parsed.description === undefined
        ? {}
        : { description: parsed.description }),
      ...(parsed.location === undefined ? {} : { location: parsed.location }),
      ...(parsed.job_type === undefined ? {} : { job_type: parsed.job_type }),
      ...(parsed.job_sub_type === undefined
        ? {}
        : { job_sub_type: parsed.job_sub_type }),
      ...(parsed.work_mode === undefined
        ? {}
        : { work_mode: parsed.work_mode }),
      ...(parsed.pay_per_hour === undefined
        ? {}
        : { pay_per_hour: parsed.pay_per_hour }),
      ...(parsed.salary_min === undefined
        ? {}
        : { salary_min: parsed.salary_min }),
      ...(parsed.salary_max === undefined
        ? {}
        : { salary_max: parsed.salary_max }),
      ...(parsed.experience_required === undefined
        ? {}
        : { experience_required: parsed.experience_required }),
      ...(parsed.skills_required === undefined
        ? {}
        : { skills_required: parsed.skills_required }),
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
      setPasteText("");
      setParseResult(null);
      setShowDraftBanner(false);
      if (onPosted) onPosted();
    } catch {
      // error is read from rawError via the hook
    }
  };

  const showSubType =
    form.job_type === "contract" || form.job_type === "full_time";
  const subTypes =
    form.job_type === "contract" ? CONTRACT_SUB_TYPES : FULL_TIME_SUB_TYPES;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div className="rm-body pjp-body" style={{ flex: 1, minHeight: 0 }}>
        {/* ── Draft restore banner ── */}
        {showDraftBanner && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 8px",
              background: "#fffbe6",
              border: "1px solid #ffe066",
              borderRadius: 2,
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <span>
              📋 You have an unsaved job draft from a previous session.
            </span>
            <Button
              size="xs"
              onClick={() => {
                const draft = getDraft();
                if (draft) {
                  setForm(draft);
                }
                setShowDraftBanner(false);
              }}
            >
              ↩ Restore Draft
            </Button>
            <Button
              size="xs"
              style={{ color: "#888" }}
              onClick={() => {
                clearDraft();
                setShowDraftBanner(false);
              }}
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
          <legend>
            ⚡ Smart Paste{" "}
            <span className="pjp-legend-hint">
              — paste any job posting to auto-fill the form
            </span>
          </legend>
          <textarea
            className="rm-textarea pjp-paste-area"
            rows={6}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setParseResult(null);
            }}
            placeholder={
              'Paste a job description here and click "Parse & Fill"\n\n' +
              "Example:\n" +
              "Java Developer\n" +
              "Remote\n" +
              "$60/hr C2C only\n\n" +
              "Required Qualifications:\n" +
              "8+ years of Java with Spring Boot, Kafka, Docker, Kubernetes..."
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
                onClick={() => {
                  setPasteText("");
                  setParseResult(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Parse summary */}
          {parseResult && (
            <div className="pjp-parse-summary">
              <span className="pjp-summary-ok">
                ✓ Fields filled — review below before posting
              </span>
              <div className="pjp-summary-chips">
                {parseResult.title && (
                  <span className="pjp-chip">📌 {parseResult.title}</span>
                )}
                {parseResult.location && (
                  <span className="pjp-chip">📍 {parseResult.location}</span>
                )}
                {parseResult.job_type && (
                  <span className="pjp-chip">
                    💼{" "}
                    {typeLabel(
                      parseResult.job_type,
                      parseResult.job_sub_type || "",
                    )}
                  </span>
                )}
                {parseResult.pay_per_hour != null && (
                  <span className="pjp-chip">
                    💲 ${parseResult.pay_per_hour}/hr
                  </span>
                )}
                {parseResult.salary_min != null && (
                  <span className="pjp-chip">
                    💲 ${(parseResult.salary_min / 1000).toFixed(0)}k–$
                    {((parseResult.salary_max ?? 0) / 1000).toFixed(0)}k/yr
                  </span>
                )}
                {parseResult.experience_required != null && (
                  <span className="pjp-chip">
                    ⏱ {parseResult.experience_required} yrs exp
                  </span>
                )}
                {parseResult.work_mode && (
                  <span className="pjp-chip">🌐 {parseResult.work_mode}</span>
                )}
                {(parseResult.skills_required?.length ?? 0) > 0 && (
                  <span className="pjp-chip">
                    🔧 {parseResult.skills_required?.length} skills detected
                  </span>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {/* ── Job Details ── */}
        <fieldset className="rm-fieldset">
          <legend>Job Details</legend>
          <div className="rm-field">
            <label htmlFor="pjp-title">Job Title *</label>
            <input
              id="pjp-title"
              type="text"
              className="rm-input"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Senior React Developer"
            />
          </div>
          <div className="rm-field rm-field-mt">
            <label htmlFor="pjp-description">Job Description *</label>
            <textarea
              id="pjp-description"
              className="rm-textarea pjp-desc-area"
              rows={6}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Describe responsibilities and expectations"
            />
          </div>
          <div className="rm-grid-2" style={{ marginTop: 6 }}>
            <div className="rm-field">
              <label htmlFor="pjp-location">Location</label>
              <input
                id="pjp-location"
                type="text"
                className="rm-input"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="City, State or Remote"
              />
            </div>
            <div className="rm-field">
              <label htmlFor="pjp-job-type">Job Type *</label>
              <select
                id="pjp-job-type"
                className="rm-input"
                value={form.job_type}
                onChange={(e) => {
                  setField("job_type", e.target.value);
                  setField("job_sub_type", "");
                }}
              >
                {JOB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Candidate Location (Country / State / City) ── */}
          <div style={{ marginTop: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#444",
                marginBottom: 2,
                display: "block",
              }}
            >
              🌍 Where do you need a candidate?
            </span>
            <div className="rm-grid-2" style={{ marginTop: 2 }}>
              <div className="rm-field">
                <label htmlFor="pjp-country">Country *</label>
                <select
                  id="pjp-country"
                  className="rm-input"
                  value={form.job_country}
                  onChange={(e) => {
                    setField("job_country", e.target.value);
                    setField("job_state", "");
                    setField("job_city", "");
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rm-field">
                <label htmlFor="pjp-state">State / Province</label>
                <input
                  id="pjp-state"
                  type="text"
                  className="rm-input"
                  value={form.job_state}
                  onChange={(e) => setField("job_state", e.target.value)}
                  placeholder="e.g. California, Maharashtra"
                />
              </div>
            </div>
            <div className="rm-grid-2" style={{ marginTop: 4 }}>
              <div className="rm-field">
                <label htmlFor="pjp-city">City</label>
                <input
                  id="pjp-city"
                  type="text"
                  className="rm-input"
                  value={form.job_city}
                  onChange={(e) => setField("job_city", e.target.value)}
                  placeholder="e.g. San Francisco, Mumbai"
                />
              </div>
              <div />
            </div>
          </div>
          <div className="rm-grid-2" style={{ marginTop: 6 }}>
            {showSubType && (
              <div className="rm-field">
                <label htmlFor="pjp-sub-type">Sub Type</label>
                <select
                  id="pjp-sub-type"
                  className="rm-input"
                  value={form.job_sub_type}
                  onChange={(e) => setField("job_sub_type", e.target.value)}
                >
                  {subTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="rm-field">
              <label htmlFor="pjp-work-mode">Work Mode</label>
              <select
                id="pjp-work-mode"
                className="rm-input"
                value={form.work_mode}
                onChange={(e) => setField("work_mode", e.target.value)}
              >
                {WORK_MODES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
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
              <label htmlFor="pjp-salary-min">Salary Min ($/yr)</label>
              <input
                id="pjp-salary-min"
                type="number"
                className="rm-input"
                min={0}
                value={form.salary_min ?? ""}
                onChange={(e) =>
                  setField(
                    "salary_min",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="e.g. 80000"
              />
            </div>
            <div className="rm-field">
              <label htmlFor="pjp-salary-max">Salary Max ($/yr)</label>
              <input
                id="pjp-salary-max"
                type="number"
                className="rm-input"
                min={0}
                value={form.salary_max ?? ""}
                onChange={(e) =>
                  setField(
                    "salary_max",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="e.g. 120000"
              />
            </div>
            <div className="rm-field">
              <label htmlFor="pjp-pay-hr">Pay Per Hour ($)</label>
              <input
                id="pjp-pay-hr"
                type="number"
                className="rm-input"
                min={0}
                value={form.pay_per_hour ?? ""}
                onChange={(e) =>
                  setField(
                    "pay_per_hour",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="e.g. 60"
              />
            </div>
          </div>
        </fieldset>

        {/* ── Requirements ── */}
        <fieldset className="rm-fieldset">
          <legend>Requirements</legend>
          <p className="pjp-hint">
            Skills are automatically extracted from the job title and
            description when the job is saved.
          </p>
          <div className="rm-field rm-field-mt pjp-exp-field">
            <label htmlFor="pjp-exp">Experience Required (Years)</label>
            <input
              id="pjp-exp"
              type="number"
              className="rm-input"
              min={0}
              value={form.experience_required ?? ""}
              onChange={(e) =>
                setField(
                  "experience_required",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              placeholder="e.g. 5"
            />
          </div>
        </fieldset>

        {/* ── Recruiter Contact ── */}
        <fieldset className="rm-fieldset">
          <legend>Recruiter Contact</legend>
          <div className="rm-grid-2">
            <div className="rm-field">
              <label htmlFor="pjp-rec-name">Recruiter Name</label>
              <input
                id="pjp-rec-name"
                type="text"
                className="rm-input"
                value={form.recruiter_name}
                onChange={(e) => setField("recruiter_name", e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="rm-field">
              <label htmlFor="pjp-rec-phone">Recruiter Phone</label>
              <input
                id="pjp-rec-phone"
                type="text"
                className="rm-input"
                value={form.recruiter_phone}
                onChange={(e) => setField("recruiter_phone", e.target.value)}
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
          disabled={
            loading || !form.title || !form.description || !form.job_country
          }
          title="Post this job — skills will be auto-extracted from the description"
        >
          {loading ? "Posting..." : "📤 Post Job"}
        </Button>
        <span
          className="pjp-hint"
          style={{ alignSelf: "center", marginLeft: 4 }}
        >
          * Title, Description & Country are required
        </span>
      </div>
    </form>
  );
};

export default PostJobPage;
