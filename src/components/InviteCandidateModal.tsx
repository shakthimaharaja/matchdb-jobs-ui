/**
 * InviteCandidateModal.tsx
 *
 * Modal for Admin & Marketing users to invite external candidates.
 * Uses PermissionGuard — only renders for users with "invite:candidate" permission.
 */
import React, { useState } from "react";
import { Button, Input, Select } from "matchdb-component-library";
import {
  useSendCandidateInviteMutation,
  useGetCandidatePlansQuery,
} from "../api/jobsApi";

interface InviteCandidateModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteCandidateModal({
  open,
  onClose,
}: Readonly<InviteCandidateModalProps>) {
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [candidatePlan, setCandidatePlan] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: plans = [] } = useGetCandidatePlansQuery();
  const [sendInvite, { isLoading }] = useSendCandidateInviteMutation();

  const activePlans = plans.filter((p) => p.isActive);

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!candidateEmail.trim() || !candidateEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!candidatePlan) {
      setError("Please select a candidate plan.");
      return;
    }

    try {
      await sendInvite({
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        jobTitle: jobTitle.trim(),
        candidatePlan,
        personalNote: personalNote.trim(),
      }).unwrap();

      setSuccess(`Invitation sent to ${candidateEmail}`);
      setCandidateName("");
      setCandidateEmail("");
      setJobTitle("");
      setCandidatePlan("");
      setPersonalNote("");
      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr?.data?.error || "Failed to send invitation");
    }
  };

  if (!open) return null;

  return (
    <dialog open className="matchdb-modal-overlay">
      <div className="rm-backdrop" role="none" onClick={onClose} />
      <div
        className="matchdb-modal-window"
        style={{ maxWidth: 480, padding: 20 }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>
          🎯 Invite Candidate
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label
              htmlFor="invite-candidate-email"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Candidate Email *
            </label>
            <Input
              id="invite-candidate-email"
              value={candidateEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCandidateEmail(e.target.value)
              }
              placeholder="candidate@email.com"
              disabled={isLoading}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              htmlFor="invite-candidate-name"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Candidate Full Name
            </label>
            <Input
              id="invite-candidate-name"
              value={candidateName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCandidateName(e.target.value)
              }
              placeholder="Jane Smith"
              disabled={isLoading}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              htmlFor="invite-candidate-job-title"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Job Title / Role (optional)
            </label>
            <Input
              id="invite-candidate-job-title"
              value={jobTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setJobTitle(e.target.value)
              }
              placeholder="Senior Developer"
              disabled={isLoading}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              htmlFor="invite-candidate-plan"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Candidate Plan *
            </label>
            <Select
              id="invite-candidate-plan"
              value={candidatePlan}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setCandidatePlan(e.target.value)
              }
              disabled={isLoading}
              style={{ width: "100%", fontSize: 12 }}
            >
              <option value="">Select a plan…</option>
              {activePlans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.planName} — ${p.price}/{p.billingCycle} ({p.tier})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="invite-candidate-note"
              style={{
                fontSize: 11,
                fontWeight: 600,
                display: "block",
                marginBottom: 2,
              }}
            >
              Personal Note (optional, shown in email)
            </label>
            <textarea
              id="invite-candidate-note"
              className="matchdb-input"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="Looking forward to working with you…"
              disabled={isLoading}
              rows={3}
              style={{ width: "100%", resize: "vertical", fontSize: 12 }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: "#c00", fontSize: 12, marginTop: 10 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: "#2e7d32", fontSize: 12, marginTop: 10 }}>
            {success}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <Button size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Sending…" : "Send Invitation"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export default InviteCandidateModal;
