import React, { useEffect, useState } from "react";
import axios from "axios";
import "./PublicLanding.css";

interface PublicJob {
  id: string;
  title: string;
  location: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  pay_per_hour: number | null;
  skills_required: string[];
  experience_required: number;
  recruiter_name: string;
  vendor_email: string;
  created_at: string;
}

const formatType = (t: string) => t.replace(/_/g, " ");
const JOB_TYPE_MAP: Record<string, string> = {
  c2c: "contract",
  w2: "full_time",
  c2h: "contract",
  fulltime: "full_time",
};

const PublicLanding: React.FC = () => {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [loginContext, setLoginContext] = useState<"candidate" | "vendor">(
    "candidate",
  );

  // Fetch public jobs
  useEffect(() => {
    axios
      .get("/api/jobs/")
      .then((res) => setJobs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for job type filter from shell nav
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setJobTypeFilter(detail?.jobType || "");
    };
    window.addEventListener("matchdb:jobTypeFilter", handler);
    return () => window.removeEventListener("matchdb:jobTypeFilter", handler);
  }, []);

  // Listen for login context changes from shell nav
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.loginType) {
        setLoginContext(detail.loginType);
      }
    };
    window.addEventListener("matchdb:loginContext", handler);
    return () => window.removeEventListener("matchdb:loginContext", handler);
  }, []);

  const filteredJobs = jobTypeFilter
    ? jobs.filter((j) => {
        const mapped = JOB_TYPE_MAP[jobTypeFilter];
        return mapped ? j.job_type === mapped : true;
      })
    : jobs;

  const openLogin = (
    context: "candidate" | "vendor",
    mode: "login" | "register" = "login",
  ) => {
    window.dispatchEvent(
      new CustomEvent("matchdb:openLogin", { detail: { context, mode } }),
    );
  };

  const isCandidate = loginContext === "candidate";
  const icon = isCandidate ? "👤" : "🏢";
  const label = isCandidate ? "Candidate" : "Vendor";
  const sectionTitle = isCandidate ? "Job Openings" : "Candidate Profiles";

  return (
    <div className="pub-landing">
      <div className="pub-section">
        {/* Title bar with auth buttons on the right */}
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">{isCandidate ? "💼" : "👥"}</span>
          <span className="pub-section-title">
            {sectionTitle}
            {jobTypeFilter && (
              <span className="pub-filter-badge">
                {jobTypeFilter.toUpperCase()}
              </span>
            )}
          </span>
          <span className="pub-section-meta">
            {loading
              ? "Loading..."
              : `${filteredJobs.length} record${filteredJobs.length !== 1 ? "s" : ""}`}
          </span>
          <div className="pub-titlebar-auth">
            <button
              className="pub-btn pub-btn-primary"
              onClick={() => openLogin(loginContext, "login")}
            >
              {icon} {label} Sign In
            </button>
            <button
              className="pub-btn pub-btn-secondary"
              onClick={() => openLogin(loginContext, "register")}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Single non-scrollable table body */}
        <div className="pub-section-body">
          {loading ? (
            <div className="pub-loading">Loading...</div>
          ) : (
            <div className="pub-jobs-table-wrap">
              <table className="pub-jobs-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Experience</th>
                    <th>Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="pub-job-title">{job.title}</td>
                      <td>{job.location}</td>
                      <td>
                        <span className="pub-type-badge">
                          {formatType(job.job_type)}
                        </span>
                      </td>
                      <td>{job.experience_required} yrs</td>
                      <td className="pub-skills">
                        {job.skills_required.slice(0, 3).map((s) => (
                          <span key={s} className="pub-skill-tag">
                            {s}
                          </span>
                        ))}
                        {job.skills_required.length > 3 && (
                          <span className="pub-skill-more">
                            +{job.skills_required.length - 3}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicLanding;
