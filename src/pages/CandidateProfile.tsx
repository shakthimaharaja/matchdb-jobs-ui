import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import {
  InputNumber,
  InputNumberValueChangeEvent,
} from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchProfile,
  upsertProfile,
  deleteProfile,
  clearProfileError,
  CandidateProfile as IProfile,
} from "../store/jobsSlice";
import "./LegacyForms.css";
import "../components/ResumeModal.css";

const JOB_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "remote", label: "Remote" },
];

const VISIBILITY_TYPES = [
  {
    key: "contract",
    label: "Contract",
    subTypes: [
      { value: "c2c", label: "C2C" },
      { value: "c2h", label: "C2H" },
      { value: "w2", label: "W2" },
      { value: "1099", label: "1099" },
    ],
  },
  {
    key: "full_time",
    label: "Full Time",
    subTypes: [
      { value: "c2h", label: "C2H" },
      { value: "w2", label: "W2" },
      { value: "direct_hire", label: "Direct Hire" },
      { value: "salary", label: "Salary" },
    ],
  },
  {
    key: "part_time",
    label: "Part Time",
    subTypes: [],
  },
];

const EMPTY: IProfile = {
  name: "",
  email: "",
  phone: "",
  current_company: "",
  current_role: "",
  preferred_job_type: "full_time",
  expected_hourly_rate: null,
  experience_years: 0,
  skills: [],
  location: "",
  bio: "",
  resume_summary: "",
  resume_experience: "",
  resume_education: "",
  resume_achievements: "",
  visibility_config: {},
  profile_locked: false,
};

interface Props {
  token: string | null;
  userEmail: string | undefined;
}

const CandidateProfile: React.FC<Props> = ({ token, userEmail }) => {
  const dispatch = useAppDispatch();
  const { profile, profileLoading, profileError } = useAppSelector(
    (state) => state.jobs,
  );

  const [form, setForm] = useState<IProfile>(EMPTY);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [confirmText, setConfirmText] = useState("");
  const [additions, setAdditions] = useState({
    resume_summary: "",
    resume_experience: "",
    resume_education: "",
    resume_achievements: "",
  });

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

  const isLocked = !!profile?.profile_locked;

  const setField = <K extends keyof IProfile>(key: K, value: IProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveSuccess(false);
  };

  const onNumberChange =
    (field: "expected_hourly_rate" | "experience_years") =>
    (e: InputNumberValueChangeEvent) => {
      if (field === "expected_hourly_rate") {
        setField(field, e.value ?? null);
      } else {
        setField(field, e.value ?? 0);
      }
    };

  const handleSave = async () => {
    setSaveSuccess(false);
    dispatch(clearProfileError());
    // For locked profiles, merge appended text into the resume fields
    let saveData = { ...form };
    if (isLocked) {
      const appendFields = [
        "resume_summary",
        "resume_experience",
        "resume_education",
        "resume_achievements",
      ] as const;
      for (const field of appendFields) {
        const extra = additions[field].trim();
        if (extra) {
          saveData = {
            ...saveData,
            [field]: ((saveData[field] || "") + "\n\n" + extra).trim(),
          };
        }
      }
    }
    const result = await dispatch(upsertProfile({ token, data: saveData }));
    if (upsertProfile.fulfilled.match(result)) {
      setSaveSuccess(true);
      // Clear additions after successful save
      setAdditions({
        resume_summary: "",
        resume_experience: "",
        resume_education: "",
        resume_achievements: "",
      });
    }
  };

  const handleDelete = async () => {
    const result = await dispatch(deleteProfile(token));
    if (deleteProfile.fulfilled.match(result)) {
      setShowDeleteModal(false);
      setForm(EMPTY);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    setDeleteAccountLoading(true);
    setDeleteAccountError(null);
    try {
      // 1. Delete Jobs profile first (if exists)
      if (profile) {
        await dispatch(deleteProfile(token));
      }
      // 2. Delete the shell account (User + Subscription + RefreshTokens)
      await axios.delete("/api/auth/account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // 3. Clear local auth state and redirect
      localStorage.removeItem("matchdb_token");
      localStorage.removeItem("matchdb_refresh");
      localStorage.removeItem("matchdb_user");
      setShowDeleteAccountModal(false);
      window.location.href = "/";
    } catch (err: any) {
      setDeleteAccountError(
        err.response?.data?.error ||
          "Failed to delete account. Please try again.",
      );
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  return (
    <>
      <div className="matchdb-page">
        {/* Panel title bar — matches the data table panel */}
        <div className="matchdb-panel-title">
          <span className="matchdb-panel-title-icon">📋</span>
          <span className="matchdb-panel-title-text">Candidate Profile</span>
          <span className="matchdb-panel-title-meta">
            {isLocked
              ? "🔒 Resume locked — contact & preferences editable"
              : "New profile — fill in details, skills auto-extracted on save"}
          </span>
        </div>

        {/* Status messages */}
        {profileError && (
          <div
            style={{
              padding: "4px 6px",
              background: "#fdeaea",
              borderBottom: "1px solid #d6a5a5",
              fontSize: 11,
              color: "#7a2222",
            }}
          >
            ✕ {profileError}
          </div>
        )}
        {saveSuccess && (
          <div
            style={{
              padding: "4px 6px",
              background: "#e9f8e8",
              borderBottom: "1px solid #9fc5a0",
              fontSize: 11,
              color: "#1f5e2d",
            }}
          >
            ✓{" "}
            {isLocked
              ? "Preferences updated successfully!"
              : "Profile created! Skills have been extracted from your resume."}
          </div>
        )}

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 8,
            background: "var(--w97-window, #fff)",
          }}
        >
          {/* Personal Information */}
          <fieldset className="legacy-fieldset">
            <legend>Personal Information</legend>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="profile-name">Full Name *</label>
                <InputText
                  id="profile-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-email">Email *</label>
                <InputText
                  id="profile-email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-phone">Phone</label>
                <InputText
                  id="profile-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-location">Location</label>
                <InputText
                  id="profile-location"
                  value={form.location}
                  onChange={(e) => setField("location", e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>
          </fieldset>

          {/* Professional Details */}
          <fieldset className="legacy-fieldset">
            <legend>Professional Details</legend>
            <div className="legacy-grid two-col">
              <div className="legacy-row">
                <label htmlFor="profile-company">Current Company</label>
                <InputText
                  id="profile-company"
                  value={form.current_company}
                  onChange={(e) => setField("current_company", e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-role">Current Role</label>
                <InputText
                  id="profile-role"
                  value={form.current_role}
                  onChange={(e) => setField("current_role", e.target.value)}
                  disabled={isLocked}
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
                  onChange={(e) => setField("preferred_job_type", e.value)}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-rate">Expected Hourly Rate ($)</label>
                <InputNumber
                  id="profile-rate"
                  value={form.expected_hourly_rate}
                  onValueChange={onNumberChange("expected_hourly_rate")}
                  min={0}
                />
              </div>
              <div className="legacy-row">
                <label htmlFor="profile-exp">Experience (Years)</label>
                <InputNumber
                  id="profile-exp"
                  value={form.experience_years}
                  onValueChange={onNumberChange("experience_years")}
                  min={isLocked ? profile?.experience_years || 0 : 0}
                />
              </div>
            </div>
          </fieldset>

          {/* Profile Visibility — which job types the candidate is visible under */}
          <fieldset className="legacy-fieldset">
            <legend>
              Profile Visibility
              {isLocked && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 400,
                  }}
                >
                  🔒 Existing types locked — you can add more
                </span>
              )}
            </legend>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>
              Select the job types your profile should be visible under to
              vendors.
              {!isLocked && " Checking a type auto-selects all sub-types."}
            </div>
            {VISIBILITY_TYPES.map((vt) => {
              const vis = form.visibility_config || {};
              const isTypeChecked = vt.key in vis;
              const lockedType =
                isLocked && profile?.visibility_config?.[vt.key] !== undefined;
              const lockedSubs = new Set(
                isLocked ? profile?.visibility_config?.[vt.key] || [] : [],
              );

              const toggleType = (checked: boolean) => {
                const next = { ...vis };
                if (checked) {
                  next[vt.key] =
                    vt.subTypes.length > 0
                      ? vt.subTypes.map((s) => s.value)
                      : [];
                } else {
                  delete next[vt.key];
                }
                setField("visibility_config", next);
              };

              const toggleSub = (subValue: string, checked: boolean) => {
                const next = { ...vis };
                const subs = [...(next[vt.key] || [])];
                if (checked && !subs.includes(subValue)) subs.push(subValue);
                if (!checked) {
                  const idx = subs.indexOf(subValue);
                  if (idx >= 0) subs.splice(idx, 1);
                }
                // If all sub-types unchecked and not locked, remove the type entirely
                if (subs.length === 0 && !lockedType) {
                  delete next[vt.key];
                } else {
                  next[vt.key] = subs;
                }
                setField("visibility_config", next);
              };

              return (
                <div key={vt.key} style={{ marginBottom: 6 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: lockedType ? "default" : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isTypeChecked}
                      disabled={lockedType}
                      onChange={(e) => toggleType(e.target.checked)}
                    />
                    <strong>{vt.label}</strong>
                    {lockedType && (
                      <span style={{ fontSize: 10, color: "#888" }}>🔒</span>
                    )}
                  </label>
                  {isTypeChecked && vt.subTypes.length > 0 && (
                    <div
                      style={{
                        marginLeft: 24,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      {vt.subTypes.map((st) => {
                        const subChecked =
                          vis[vt.key]?.includes(st.value) || false;
                        const subLocked = lockedSubs.has(st.value);
                        return (
                          <label
                            key={st.value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              cursor: subLocked ? "default" : "pointer",
                              fontSize: 12,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={subChecked}
                              disabled={subLocked}
                              onChange={(e) =>
                                toggleSub(st.value, e.target.checked)
                              }
                            />
                            {st.label}
                            {subLocked && (
                              <span style={{ fontSize: 9, color: "#888" }}>
                                🔒
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          {/* Resume — locked after first save, can append */}
          <fieldset className="legacy-fieldset">
            <legend>
              Resume
              {isLocked && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 400,
                  }}
                >
                  🔒 Original content locked — use "Add more" to append
                </span>
              )}
            </legend>

            <div className="legacy-row">
              <label htmlFor="profile-summary">
                Professional Summary / Objective
              </label>
              {isLocked ? (
                <>
                  <div className="legacy-readonly-text">
                    {form.resume_summary || "—"}
                  </div>
                  <label
                    htmlFor="profile-summary-add"
                    style={{ marginTop: 6, fontSize: 11, color: "#555" }}
                  >
                    ＋ Add more to summary:
                  </label>
                  <InputTextarea
                    id="profile-summary-add"
                    value={additions.resume_summary}
                    onChange={(e) =>
                      setAdditions((a) => ({
                        ...a,
                        resume_summary: e.target.value,
                      }))
                    }
                    rows={2}
                    autoResize={false}
                    placeholder="Append additional summary points..."
                  />
                </>
              ) : (
                <InputTextarea
                  id="profile-summary"
                  value={form.resume_summary || ""}
                  onChange={(e) => setField("resume_summary", e.target.value)}
                  rows={3}
                  autoResize={false}
                  placeholder="Brief overview of your career goals and strengths"
                />
              )}
            </div>

            <div className="legacy-row" style={{ marginTop: 10 }}>
              <label htmlFor="profile-experience">Work Experience</label>
              {isLocked ? (
                <>
                  <div className="legacy-readonly-text">
                    {form.resume_experience || "—"}
                  </div>
                  <label
                    htmlFor="profile-experience-add"
                    style={{ marginTop: 6, fontSize: 11, color: "#555" }}
                  >
                    ＋ Add more experience:
                  </label>
                  <InputTextarea
                    id="profile-experience-add"
                    value={additions.resume_experience}
                    onChange={(e) =>
                      setAdditions((a) => ({
                        ...a,
                        resume_experience: e.target.value,
                      }))
                    }
                    rows={3}
                    autoResize={false}
                    placeholder="Append additional work experience..."
                  />
                </>
              ) : (
                <InputTextarea
                  id="profile-experience"
                  value={form.resume_experience || ""}
                  onChange={(e) =>
                    setField("resume_experience", e.target.value)
                  }
                  rows={5}
                  autoResize={false}
                  placeholder={`List your roles, companies, and responsibilities.\nExample:\nSr. React Developer @ Acme Inc (2021–2024)\n- Built scalable dashboards using React, TypeScript, Redux\n- Led team of 4 engineers`}
                />
              )}
            </div>

            <div className="legacy-row" style={{ marginTop: 10 }}>
              <label htmlFor="profile-education">Education</label>
              {isLocked ? (
                <>
                  <div className="legacy-readonly-text">
                    {form.resume_education || "—"}
                  </div>
                  <label
                    htmlFor="profile-education-add"
                    style={{ marginTop: 6, fontSize: 11, color: "#555" }}
                  >
                    ＋ Add more education:
                  </label>
                  <InputTextarea
                    id="profile-education-add"
                    value={additions.resume_education}
                    onChange={(e) =>
                      setAdditions((a) => ({
                        ...a,
                        resume_education: e.target.value,
                      }))
                    }
                    rows={2}
                    autoResize={false}
                    placeholder="Append additional education or courses..."
                  />
                </>
              ) : (
                <InputTextarea
                  id="profile-education"
                  value={form.resume_education || ""}
                  onChange={(e) => setField("resume_education", e.target.value)}
                  rows={3}
                  autoResize={false}
                  placeholder={`B.S. Computer Science, State University (2018)\nRelevant coursework: Algorithms, Databases, Networks`}
                />
              )}
            </div>

            <div className="legacy-row" style={{ marginTop: 10 }}>
              <label htmlFor="profile-achievements">
                Certifications &amp; Achievements
              </label>
              {isLocked ? (
                <>
                  <div className="legacy-readonly-text">
                    {form.resume_achievements || "—"}
                  </div>
                  <label
                    htmlFor="profile-achievements-add"
                    style={{ marginTop: 6, fontSize: 11, color: "#555" }}
                  >
                    ＋ Add more certifications/achievements:
                  </label>
                  <InputTextarea
                    id="profile-achievements-add"
                    value={additions.resume_achievements}
                    onChange={(e) =>
                      setAdditions((a) => ({
                        ...a,
                        resume_achievements: e.target.value,
                      }))
                    }
                    rows={2}
                    autoResize={false}
                    placeholder="Append additional certifications..."
                  />
                </>
              ) : (
                <InputTextarea
                  id="profile-achievements"
                  value={form.resume_achievements || ""}
                  onChange={(e) =>
                    setField("resume_achievements", e.target.value)
                  }
                  rows={3}
                  autoResize={false}
                  placeholder={`AWS Certified Solutions Architect (2023)\nGoogle Cloud Professional Data Engineer\nOpen-source contributor to React ecosystem`}
                />
              )}
            </div>

            <div className="legacy-row" style={{ marginTop: 10 }}>
              <label htmlFor="profile-bio">Brief Introduction</label>
              {isLocked ? (
                <div className="legacy-readonly-text">{form.bio || "—"}</div>
              ) : (
                <InputTextarea
                  id="profile-bio"
                  value={form.bio}
                  onChange={(e) => setField("bio", e.target.value)}
                  rows={3}
                  autoResize={false}
                  placeholder="Tell recruiters about your experience and goals"
                />
              )}
            </div>
          </fieldset>

          {/* Extracted Skills — always read-only */}
          {(isLocked || form.skills.length > 0) && (
            <fieldset className="legacy-fieldset">
              <legend>
                Extracted Skills
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 400,
                  }}
                >
                  Auto-detected from your resume
                </span>
              </legend>
              <div className="legacy-skill-list">
                {form.skills.length > 0 ? (
                  form.skills.map((skill) => (
                    <span
                      key={skill}
                      className="legacy-tag legacy-tag-readonly"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="legacy-muted">
                    Skills will appear here after your profile is saved.
                  </span>
                )}
              </div>
            </fieldset>
          )}

          {/* ── Danger Zone: Delete Entire Account ── */}
          <fieldset
            className="legacy-fieldset"
            style={{ borderColor: "#cc3333", marginTop: 16 }}
          >
            <legend style={{ color: "#880000", fontWeight: 700 }}>
              ⚠ Danger Zone
            </legend>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "4px 0",
              }}
            >
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                <strong style={{ color: "#880000" }}>
                  Permanently delete your account.
                </strong>
                <br />
                This removes your login, profile, subscription, and all data.
                You will need to <strong>
                  register again and pay again
                </strong>{" "}
                to use MatchDB.
              </div>
              <Button
                type="button"
                label="Delete Account"
                icon="pi pi-ban"
                className="legacy-btn legacy-prime-btn"
                style={{
                  color: "#fff",
                  background: "#880000",
                  borderColor: "#660000",
                  whiteSpace: "nowrap",
                  minWidth: 160,
                }}
                onClick={() => {
                  setShowDeleteAccountModal(true);
                  setConfirmText("");
                  setDeleteAccountError(null);
                }}
              />
            </div>
          </fieldset>
        </div>

        {/* Footer bar — matches matchdb style */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            background: "var(--w97-btn-face, #e5e5e5)",
            borderTop: "1px solid var(--w97-btn-shadow, #808080)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="matchdb-btn matchdb-btn-primary"
            onClick={handleSave}
            disabled={profileLoading || !form.name || !form.email}
          >
            {profileLoading
              ? "⏳ Saving..."
              : isLocked
                ? "✓ Update Profile"
                : "💾 Save & Extract Skills"}
          </button>
          {!isLocked && (
            <span
              style={{ fontSize: 10, color: "var(--w97-text-secondary, #555)" }}
            >
              Skills will be auto-extracted from your resume on save.
            </span>
          )}
          {isLocked && (
            <span
              style={{ fontSize: 10, color: "var(--w97-text-secondary, #555)" }}
            >
              Appended experience &amp; new visibility types will be saved.
            </span>
          )}
          <span style={{ flex: 1 }} />
          {profile && (
            <button
              type="button"
              className="matchdb-btn"
              style={{ color: "#880000" }}
              onClick={() => setShowDeleteModal(true)}
              disabled={profileLoading}
            >
              🗑 Delete Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Delete Account Confirmation Modal (W97 style) ── */}
      {showDeleteAccountModal && (
        <div
          className="rm-overlay"
          onClick={() => setShowDeleteAccountModal(false)}
        >
          <div
            className="rm-window"
            style={{ width: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div
              className="rm-titlebar"
              style={{
                background: "linear-gradient(to right, #660000, #330000)",
              }}
            >
              <span className="rm-titlebar-icon">🛑</span>
              <span className="rm-titlebar-title">
                Delete Account — Permanent
              </span>
              <button
                className="rm-close"
                onClick={() => setShowDeleteAccountModal(false)}
                title="Cancel"
              >
                ✕
              </button>
            </div>

            {/* Status bar */}
            <div
              className="rm-statusbar"
              style={{
                color: "#fff",
                background: "#880000",
                fontWeight: "bold",
              }}
            >
              🚨 WARNING: This action is irreversible. Your account will be
              permanently deleted.
            </div>

            {/* Body */}
            <div className="rm-body" style={{ gap: 10 }}>
              <fieldset
                className="rm-fieldset"
                style={{ borderColor: "#cc3333" }}
              >
                <legend style={{ color: "#880000" }}>
                  Everything below will be permanently deleted
                </legend>
                <div style={{ fontSize: 11, lineHeight: 1.8, color: "#333" }}>
                  <div>
                    🗑 Your <strong>login credentials</strong> — you will not be
                    able to sign in
                  </div>
                  <div>
                    🗑 Your <strong>candidate profile</strong>, resume, and all
                    extracted skills
                  </div>
                  <div>
                    🗑 Your <strong>subscription &amp; payment history</strong>
                  </div>
                  <div>
                    🗑 All <strong>job match history</strong> and vendor
                    visibility
                  </div>
                  <div>
                    🗑 All <strong>refresh tokens</strong> and active sessions
                  </div>
                </div>
              </fieldset>

              <fieldset
                className="rm-fieldset"
                style={{ borderColor: "#e0a000" }}
              >
                <legend style={{ color: "#7a4a00" }}>
                  To use MatchDB again, you must:
                </legend>
                <div style={{ fontSize: 11, lineHeight: 1.8, color: "#555" }}>
                  <div>
                    1. <strong>Create a brand new account</strong> (register
                    again)
                  </div>
                  <div>
                    2. <strong>Re-subscribe and pay again</strong> — your
                    current plan will NOT carry over
                  </div>
                  <div>
                    3. <strong>Rebuild your profile from scratch</strong> —
                    nothing is recoverable
                  </div>
                </div>
              </fieldset>

              <fieldset className="rm-fieldset" style={{ borderColor: "#888" }}>
                <legend style={{ color: "#333" }}>
                  Type <strong>DELETE</strong> to confirm
                </legend>
                <InputText
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  style={{
                    width: "100%",
                    fontFamily: "monospace",
                    fontSize: 13,
                  }}
                />
              </fieldset>

              {deleteAccountError && (
                <div className="rm-alert rm-alert-error">
                  ✕ {deleteAccountError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="rm-footer">
              <button
                type="button"
                className="rm-btn"
                style={{
                  color: "#fff",
                  background: confirmText === "DELETE" ? "#880000" : "#999",
                  border: "2px solid #660000",
                  cursor: confirmText === "DELETE" ? "pointer" : "not-allowed",
                  opacity: confirmText === "DELETE" ? 1 : 0.5,
                }}
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE" || deleteAccountLoading}
              >
                {deleteAccountLoading
                  ? "⏳ Deleting Account..."
                  : "🛑 Permanently Delete My Account"}
              </button>
              <button
                type="button"
                className="rm-btn"
                onClick={() => setShowDeleteAccountModal(false)}
                style={{ marginLeft: "auto" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Profile Confirmation Modal (W97 style) ── */}
      {showDeleteModal && (
        <div className="rm-overlay" onClick={() => setShowDeleteModal(false)}>
          <div
            className="rm-window"
            style={{ width: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div
              className="rm-titlebar"
              style={{
                background: "linear-gradient(to right, #880000, #5a0000)",
              }}
            >
              <span className="rm-titlebar-icon">⚠️</span>
              <span className="rm-titlebar-title">
                Delete Candidate Profile
              </span>
              <button
                className="rm-close"
                onClick={() => setShowDeleteModal(false)}
                title="Cancel"
              >
                ✕
              </button>
            </div>

            {/* Status bar */}
            <div
              className="rm-statusbar"
              style={{ color: "#880000", fontWeight: "bold" }}
            >
              ⛔ This action is permanent and cannot be undone.
            </div>

            {/* Body */}
            <div className="rm-body" style={{ gap: 10 }}>
              <fieldset className="rm-fieldset" style={{ borderColor: "#c88" }}>
                <legend style={{ color: "#880000" }}>
                  What will be deleted
                </legend>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: "#333" }}>
                  <div>
                    • Your full candidate profile (name, resume, contact
                    details)
                  </div>
                  <div>• All auto-extracted skills and match history</div>
                  <div>
                    • Your visibility to vendors — you will no longer appear in
                    searches
                  </div>
                </div>
              </fieldset>

              <fieldset
                className="rm-fieldset"
                style={{ borderColor: "#e0a000" }}
              >
                <legend style={{ color: "#7a4a00" }}>What happens next</legend>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: "#555" }}>
                  <div>
                    • You will need to <strong>create a new profile</strong> to
                    be visible again
                  </div>
                  <div>
                    • Your subscription plan is separate — contact support if
                    you need a refund
                  </div>
                  <div>• Your account login is not affected</div>
                </div>
              </fieldset>

              {profileError && (
                <div className="rm-alert rm-alert-error">✕ {profileError}</div>
              )}
            </div>

            {/* Footer */}
            <div className="rm-footer">
              <button
                type="button"
                className="rm-btn"
                style={{
                  color: "#880000",
                  borderTopColor: "#ffaaaa",
                  borderLeftColor: "#ffaaaa",
                  borderRightColor: "#880000",
                  borderBottomColor: "#880000",
                }}
                onClick={handleDelete}
                disabled={profileLoading}
              >
                {profileLoading ? "Deleting..." : "🗑 Yes, Delete My Profile"}
              </button>
              <button
                type="button"
                className="rm-btn"
                onClick={() => setShowDeleteModal(false)}
                style={{ marginLeft: "auto" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CandidateProfile;
