/**
 * PublicLanding — shown when user is NOT logged in.
 *
 * Three views, selected by URL path:
 *   /jobs            → TwinView  : jobs ⋈ candidate_profiles JOIN visualization
 *   /jobs/candidate  → CandView  : job openings sorted by rate  (attract candidates)
 *   /jobs/vendor     → VendorView: candidate profiles sorted by exp (attract vendors)
 *
 * All tables: 25 entries per page, no in-page scrolling, pagination footer.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "./PublicLanding.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicJob {
  id: string;
  title: string;
  location: string;
  job_type: string;
  work_mode: string;
  salary_min: number | null;
  salary_max: number | null;
  pay_per_hour: number | null;
  skills_required: string[];
  experience_required: number;
  recruiter_name: string;
  vendor_email: string;
  created_at: string;
}

interface PublicProfile {
  id: string;
  name: string;
  current_role: string;
  current_company: string;
  preferred_job_type: string;
  experience_years: number;
  expected_hourly_rate: number | null;
  skills: string[];
  location: string;
}

// ── Static mock data (25 jobs + 25 profiles — always shown on page 1) ─────────

const MOCK_JOBS: PublicJob[] = [
  {
    id: "m01",
    title: "Senior React Developer",
    location: "Austin, TX",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 110000,
    salary_max: 140000,
    pay_per_hour: 65,
    skills_required: ["React", "TypeScript", "Redux", "Webpack", "Node.js"],
    experience_required: 4,
    recruiter_name: "Dan Brown",
    vendor_email: "dan@techcorp.com",
    created_at: "",
  },
  {
    id: "m02",
    title: "Blockchain / Solidity Developer",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 140000,
    salary_max: 190000,
    pay_per_hour: 100,
    skills_required: ["Solidity", "Ethereum", "Hardhat", "Web3.js", "DeFi"],
    experience_required: 3,
    recruiter_name: "Quinn Adams",
    vendor_email: "quinn@staffplus.com",
    created_at: "",
  },
  {
    id: "m03",
    title: "Machine Learning Engineer",
    location: "San Francisco, CA",
    job_type: "full_time",
    work_mode: "onsite",
    salary_min: 140000,
    salary_max: 180000,
    pay_per_hour: 95,
    skills_required: ["Python", "PyTorch", "NLP", "MLflow", "SQL"],
    experience_required: 4,
    recruiter_name: "Eve Wilson",
    vendor_email: "eve@startup.io",
    created_at: "",
  },
  {
    id: "m04",
    title: "Golang Backend Developer",
    location: "Seattle, WA",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 130000,
    salary_max: 165000,
    pay_per_hour: 80,
    skills_required: ["Go", "gRPC", "PostgreSQL", "Docker", "Redis"],
    experience_required: 4,
    recruiter_name: "Nina Chen",
    vendor_email: "nina@recruit.co",
    created_at: "",
  },
  {
    id: "m05",
    title: "Site Reliability Engineer",
    location: "Denver, CO",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 125000,
    salary_max: 155000,
    pay_per_hour: 78,
    skills_required: [
      "Linux",
      "Prometheus",
      "Grafana",
      "Kubernetes",
      "Terraform",
    ],
    experience_required: 5,
    recruiter_name: "Oscar Nguyen",
    vendor_email: "oscar@hiringlab.com",
    created_at: "",
  },
  {
    id: "m06",
    title: "DevOps / Cloud Engineer",
    location: "New York, NY",
    job_type: "contract",
    work_mode: "remote",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 90,
    skills_required: ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD"],
    experience_required: 5,
    recruiter_name: "Eve Wilson",
    vendor_email: "eve@startup.io",
    created_at: "",
  },
  {
    id: "m07",
    title: "Java Spring Boot Developer",
    location: "Dallas, TX",
    job_type: "full_time",
    work_mode: "onsite",
    salary_min: 115000,
    salary_max: 145000,
    pay_per_hour: 70,
    skills_required: [
      "Java",
      "Spring Boot",
      "Kafka",
      "Microservices",
      "PostgreSQL",
    ],
    experience_required: 5,
    recruiter_name: "Nina Chen",
    vendor_email: "nina@recruit.co",
    created_at: "",
  },
  {
    id: "m08",
    title: "Full Stack Engineer (Node+React)",
    location: "San Francisco, CA",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 120000,
    salary_max: 160000,
    pay_per_hour: 75,
    skills_required: ["Node.js", "Express", "React", "MongoDB", "TypeScript"],
    experience_required: 3,
    recruiter_name: "Eve Wilson",
    vendor_email: "eve@startup.io",
    created_at: "",
  },
  {
    id: "m09",
    title: "Salesforce Developer",
    location: "Atlanta, GA",
    job_type: "contract",
    work_mode: "remote",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 85,
    skills_required: ["Salesforce", "Apex", "LWC", "SOQL", "REST API"],
    experience_required: 3,
    recruiter_name: "Paula Kim",
    vendor_email: "paula@talentedge.io",
    created_at: "",
  },
  {
    id: "m10",
    title: "Technical Project Manager",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 120000,
    salary_max: 150000,
    pay_per_hour: 75,
    skills_required: [
      "Agile",
      "Scrum",
      "JIRA",
      "Confluence",
      "Risk Management",
    ],
    experience_required: 6,
    recruiter_name: "Paula Kim",
    vendor_email: "paula@talentedge.io",
    created_at: "",
  },
  {
    id: "m11",
    title: "Angular Frontend Developer",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 95000,
    salary_max: 125000,
    pay_per_hour: 58,
    skills_required: ["Angular", "TypeScript", "RxJS", "NgRx", "SCSS"],
    experience_required: 3,
    recruiter_name: "Nina Chen",
    vendor_email: "nina@recruit.co",
    created_at: "",
  },
  {
    id: "m12",
    title: "Data Engineer (Python + Spark)",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 105000,
    salary_max: 135000,
    pay_per_hour: 60,
    skills_required: ["Python", "Spark", "Airflow", "AWS", "SQL"],
    experience_required: 4,
    recruiter_name: "Frank Miller",
    vendor_email: "frank@agency.com",
    created_at: "",
  },
  {
    id: "m13",
    title: "Python Backend Engineer",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 100000,
    salary_max: 130000,
    pay_per_hour: 55,
    skills_required: ["Python", "Django", "PostgreSQL", "REST API", "Docker"],
    experience_required: 3,
    recruiter_name: "Dan Brown",
    vendor_email: "dan@techcorp.com",
    created_at: "",
  },
  {
    id: "m14",
    title: "Cybersecurity Analyst",
    location: "Washington, DC",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 110000,
    salary_max: 140000,
    pay_per_hour: 72,
    skills_required: ["Penetration Testing", "SIEM", "Python", "OWASP"],
    experience_required: 4,
    recruiter_name: "Oscar Nguyen",
    vendor_email: "oscar@hiringlab.com",
    created_at: "",
  },
  {
    id: "m15",
    title: "iOS Developer (Swift)",
    location: "Los Angeles, CA",
    job_type: "contract",
    work_mode: "remote",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 70,
    skills_required: ["Swift", "SwiftUI", "Combine", "Core Data", "Xcode"],
    experience_required: 3,
    recruiter_name: "Oscar Nguyen",
    vendor_email: "oscar@hiringlab.com",
    created_at: "",
  },
  {
    id: "m16",
    title: "UI/UX Designer (Figma + React)",
    location: "Chicago, IL",
    job_type: "contract",
    work_mode: "hybrid",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 55,
    skills_required: ["Figma", "React", "Tailwind CSS", "CSS", "Adobe XD"],
    experience_required: 3,
    recruiter_name: "Frank Miller",
    vendor_email: "frank@agency.com",
    created_at: "",
  },
  {
    id: "m17",
    title: "QA Automation Engineer",
    location: "Austin, TX",
    job_type: "full_time",
    work_mode: "onsite",
    salary_min: 90000,
    salary_max: 115000,
    pay_per_hour: 50,
    skills_required: [
      "Cypress",
      "Playwright",
      "JavaScript",
      "CI/CD",
      "GitHub Actions",
    ],
    experience_required: 2,
    recruiter_name: "Dan Brown",
    vendor_email: "dan@techcorp.com",
    created_at: "",
  },
  {
    id: "m18",
    title: "React Native Mobile Developer",
    location: "Chicago, IL",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 60000,
    salary_max: 80000,
    pay_per_hour: 45,
    skills_required: ["React Native", "TypeScript", "iOS", "Android", "Redux"],
    experience_required: 2,
    recruiter_name: "Frank Miller",
    vendor_email: "frank@agency.com",
    created_at: "",
  },
  {
    id: "m19",
    title: "WordPress / PHP Developer",
    location: "Miami, FL",
    job_type: "contract",
    work_mode: "remote",
    salary_min: 55000,
    salary_max: 75000,
    pay_per_hour: 40,
    skills_required: ["PHP", "WordPress", "MySQL", "WooCommerce", "JavaScript"],
    experience_required: 2,
    recruiter_name: "Quinn Adams",
    vendor_email: "quinn@staffplus.com",
    created_at: "",
  },
  {
    id: "m20",
    title: "Angular Frontend Developer",
    location: "Remote",
    job_type: "full_time",
    work_mode: "remote",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 58,
    skills_required: ["Angular", "TypeScript", "RxJS", "SCSS", "JavaScript"],
    experience_required: 3,
    recruiter_name: "Nina Chen",
    vendor_email: "nina@recruit.co",
    created_at: "",
  },
  {
    id: "m21",
    title: "Cloud Solutions Architect",
    location: "Boston, MA",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 155000,
    salary_max: 200000,
    pay_per_hour: 105,
    skills_required: ["AWS", "Azure", "GCP", "Terraform", "Microservices"],
    experience_required: 8,
    recruiter_name: "Quinn Adams",
    vendor_email: "quinn@staffplus.com",
    created_at: "",
  },
  {
    id: "m22",
    title: "Data Scientist (NLP)",
    location: "Remote",
    job_type: "full_time",
    work_mode: "remote",
    salary_min: 130000,
    salary_max: 170000,
    pay_per_hour: 88,
    skills_required: ["Python", "NLP", "BERT", "spaCy", "SQL"],
    experience_required: 4,
    recruiter_name: "Eve Wilson",
    vendor_email: "eve@startup.io",
    created_at: "",
  },
  {
    id: "m23",
    title: "Kubernetes Platform Engineer",
    location: "Austin, TX",
    job_type: "full_time",
    work_mode: "hybrid",
    salary_min: 140000,
    salary_max: 175000,
    pay_per_hour: 92,
    skills_required: ["Kubernetes", "Helm", "ArgoCD", "Go", "Prometheus"],
    experience_required: 5,
    recruiter_name: "Oscar Nguyen",
    vendor_email: "oscar@hiringlab.com",
    created_at: "",
  },
  {
    id: "m24",
    title: "Backend Engineer (Rust)",
    location: "Remote",
    job_type: "contract",
    work_mode: "remote",
    salary_min: null,
    salary_max: null,
    pay_per_hour: 97,
    skills_required: ["Rust", "Tokio", "gRPC", "PostgreSQL", "Docker"],
    experience_required: 4,
    recruiter_name: "Frank Miller",
    vendor_email: "frank@agency.com",
    created_at: "",
  },
  {
    id: "m25",
    title: "Product Manager — Fintech",
    location: "New York, NY",
    job_type: "full_time",
    work_mode: "onsite",
    salary_min: 135000,
    salary_max: 165000,
    pay_per_hour: 82,
    skills_required: ["Product Strategy", "SQL", "JIRA", "Fintech", "Agile"],
    experience_required: 6,
    recruiter_name: "Paula Kim",
    vendor_email: "paula@talentedge.io",
    created_at: "",
  },
];

const MOCK_PROFILES: PublicProfile[] = [
  {
    id: "p01",
    name: "Irene Garcia",
    current_role: "DevOps Engineer",
    current_company: "CloudScale",
    preferred_job_type: "full_time",
    experience_years: 7,
    expected_hourly_rate: 80,
    skills: [
      "AWS",
      "Kubernetes",
      "Docker",
      "Terraform",
      "CI/CD",
      "Linux",
      "Prometheus",
    ],
    location: "Denver, CO",
  },
  {
    id: "p02",
    name: "Karen White",
    current_role: "ML Engineer",
    current_company: "AIFirst Labs",
    preferred_job_type: "full_time",
    experience_years: 5,
    expected_hourly_rate: 90,
    skills: [
      "Python",
      "PyTorch",
      "TensorFlow",
      "NLP",
      "MLflow",
      "SQL",
      "Scikit-learn",
    ],
    location: "San Francisco, CA",
  },
  {
    id: "p03",
    name: "Carol Davis",
    current_role: "Full Stack Developer",
    current_company: "DevAgency",
    preferred_job_type: "contract",
    experience_years: 6,
    expected_hourly_rate: 70,
    skills: ["Node.js", "React", "MongoDB", "TypeScript", "AWS", "Express"],
    location: "San Francisco, CA",
  },
  {
    id: "p04",
    name: "Alice Johnson",
    current_role: "Frontend Engineer",
    current_company: "StartupX",
    preferred_job_type: "full_time",
    experience_years: 5,
    expected_hourly_rate: 60,
    skills: ["React", "TypeScript", "Redux", "Node.js", "CSS", "Webpack"],
    location: "Austin, TX",
  },
  {
    id: "p05",
    name: "Jack Thompson",
    current_role: "Java Developer",
    current_company: "EnterpriseSoft",
    preferred_job_type: "full_time",
    experience_years: 5,
    expected_hourly_rate: 62,
    skills: [
      "Java",
      "Spring Boot",
      "Kafka",
      "Microservices",
      "PostgreSQL",
      "Docker",
    ],
    location: "Dallas, TX",
  },
  {
    id: "p06",
    name: "Mia Robinson",
    current_role: "Blockchain Developer",
    current_company: "CryptoVentures",
    preferred_job_type: "contract",
    experience_years: 4,
    expected_hourly_rate: 95,
    skills: [
      "Solidity",
      "Ethereum",
      "Hardhat",
      "Web3.js",
      "React",
      "TypeScript",
    ],
    location: "Remote",
  },
  {
    id: "p07",
    name: "Grace Lee",
    current_role: "Data Engineer",
    current_company: "DataViz Inc.",
    preferred_job_type: "full_time",
    experience_years: 4,
    expected_hourly_rate: 65,
    skills: ["Python", "Spark", "Airflow", "SQL", "AWS", "Kafka"],
    location: "Seattle, WA",
  },
  {
    id: "p08",
    name: "Hank Patel",
    current_role: "Mobile Developer",
    current_company: "MobileLab",
    preferred_job_type: "contract",
    experience_years: 3,
    expected_hourly_rate: 55,
    skills: [
      "React Native",
      "TypeScript",
      "Swift",
      "Android",
      "Redux",
      "Firebase",
    ],
    location: "Chicago, IL",
  },
  {
    id: "p09",
    name: "Bob Smith",
    current_role: "Python Developer",
    current_company: "FreelanceOps",
    preferred_job_type: "contract",
    experience_years: 3,
    expected_hourly_rate: 50,
    skills: ["Python", "Django", "REST API", "PostgreSQL", "Docker", "Redis"],
    location: "Remote",
  },
  {
    id: "p10",
    name: "Leo Martinez",
    current_role: "Frontend Developer",
    current_company: "WebWorks",
    preferred_job_type: "contract",
    experience_years: 2,
    expected_hourly_rate: 45,
    skills: ["Angular", "TypeScript", "RxJS", "SCSS", "JavaScript", "HTML"],
    location: "Remote",
  },
  {
    id: "p11",
    name: "Priya Sharma",
    current_role: "Cloud Architect",
    current_company: "InfraCloud",
    preferred_job_type: "full_time",
    experience_years: 9,
    expected_hourly_rate: 110,
    skills: ["AWS", "Azure", "Terraform", "Kubernetes", "Go", "Security"],
    location: "Boston, MA",
  },
  {
    id: "p12",
    name: "David Kim",
    current_role: "Data Scientist",
    current_company: "AnalyticsCo",
    preferred_job_type: "full_time",
    experience_years: 6,
    expected_hourly_rate: 85,
    skills: ["Python", "R", "Spark", "TensorFlow", "SQL", "Tableau"],
    location: "New York, NY",
  },
  {
    id: "p13",
    name: "Sofia Romero",
    current_role: "QA Lead",
    current_company: "TestFirst",
    preferred_job_type: "full_time",
    experience_years: 7,
    expected_hourly_rate: 72,
    skills: ["Selenium", "Cypress", "Java", "CI/CD", "JIRA", "Appium"],
    location: "Austin, TX",
  },
  {
    id: "p14",
    name: "Marcus Williams",
    current_role: "Security Engineer",
    current_company: "SecureNet",
    preferred_job_type: "full_time",
    experience_years: 6,
    expected_hourly_rate: 90,
    skills: ["Penetration Testing", "SIEM", "Python", "OWASP", "AWS", "Docker"],
    location: "Washington, DC",
  },
  {
    id: "p15",
    name: "Emily Chen",
    current_role: "Product Manager",
    current_company: "ProductCo",
    preferred_job_type: "full_time",
    experience_years: 8,
    expected_hourly_rate: 95,
    skills: ["Product Strategy", "SQL", "JIRA", "Figma", "Agile", "OKRs"],
    location: "San Francisco, CA",
  },
  {
    id: "p16",
    name: "Ryan O'Brien",
    current_role: "Rust Developer",
    current_company: "SysSolve",
    preferred_job_type: "contract",
    experience_years: 5,
    expected_hourly_rate: 100,
    skills: ["Rust", "Tokio", "gRPC", "PostgreSQL", "Docker", "Linux"],
    location: "Remote",
  },
  {
    id: "p17",
    name: "Zara Ahmed",
    current_role: "iOS Developer",
    current_company: "AppCraft",
    preferred_job_type: "full_time",
    experience_years: 4,
    expected_hourly_rate: 68,
    skills: ["Swift", "SwiftUI", "Combine", "Core Data", "Xcode", "ARKit"],
    location: "Los Angeles, CA",
  },
  {
    id: "p18",
    name: "Tom Evans",
    current_role: "Platform Engineer",
    current_company: "PlatformIO",
    preferred_job_type: "full_time",
    experience_years: 6,
    expected_hourly_rate: 88,
    skills: ["Kubernetes", "Helm", "ArgoCD", "Go", "Prometheus", "Grafana"],
    location: "Seattle, WA",
  },
  {
    id: "p19",
    name: "Anya Patel",
    current_role: "UX Designer",
    current_company: "DesignHub",
    preferred_job_type: "contract",
    experience_years: 4,
    expected_hourly_rate: 60,
    skills: ["Figma", "React", "Tailwind CSS", "CSS", "Adobe XD", "Zeplin"],
    location: "Chicago, IL",
  },
  {
    id: "p20",
    name: "Jake Turner",
    current_role: "Salesforce Architect",
    current_company: "CRMPro",
    preferred_job_type: "contract",
    experience_years: 8,
    expected_hourly_rate: 105,
    skills: ["Salesforce", "Apex", "LWC", "SOQL", "REST API", "Flow"],
    location: "Atlanta, GA",
  },
  {
    id: "p21",
    name: "Nina Johansson",
    current_role: "Backend Developer",
    current_company: "Nordic Tech",
    preferred_job_type: "full_time",
    experience_years: 3,
    expected_hourly_rate: 55,
    skills: ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"],
    location: "Remote",
  },
  {
    id: "p22",
    name: "Chris Okafor",
    current_role: "React Native Developer",
    current_company: "MobileFirst",
    preferred_job_type: "contract",
    experience_years: 3,
    expected_hourly_rate: 52,
    skills: ["React Native", "TypeScript", "Expo", "Firebase", "Redux"],
    location: "Remote",
  },
  {
    id: "p23",
    name: "Lena Müller",
    current_role: "Scrum Master / PM",
    current_company: "AgileCo",
    preferred_job_type: "full_time",
    experience_years: 7,
    expected_hourly_rate: 78,
    skills: ["Agile", "Scrum", "JIRA", "Confluence", "Risk Management", "OKRs"],
    location: "New York, NY",
  },
  {
    id: "p24",
    name: "Rahul Singh",
    current_role: "Angular Developer",
    current_company: "WebMatrix",
    preferred_job_type: "full_time",
    experience_years: 4,
    expected_hourly_rate: 58,
    skills: ["Angular", "TypeScript", "RxJS", "NgRx", "SCSS", "Jest"],
    location: "Dallas, TX",
  },
  {
    id: "p25",
    name: "Chloe Martin",
    current_role: "Go Backend Engineer",
    current_company: "GopherWorks",
    preferred_job_type: "full_time",
    experience_years: 5,
    expected_hourly_rate: 82,
    skills: ["Go", "gRPC", "PostgreSQL", "Docker", "Redis", "Kafka"],
    location: "Denver, CO",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Jaccard-based skill overlap, scaled to 62–98 for visual appeal */
const computeMatch = (s1: string[], s2: string[]): number => {
  if (!s1.length || !s2.length) return 65;
  const a = new Set(s1.map((x) => x.toLowerCase()));
  const b = new Set(s2.map((x) => x.toLowerCase()));
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return Math.min(99, Math.round(62 + (inter / union) * 36));
};

const fmtJobRate = (j: PublicJob): string => {
  if (j.pay_per_hour) return `$${j.pay_per_hour}/hr`;
  if (j.salary_max) return `$${Math.round(j.salary_max / 1000)}k`;
  return "—";
};

/** Extract company name from vendor_email domain (e.g. "dan@techcorp.com" → "Techcorp") */
const fmtCompany = (j: PublicJob): string => {
  if (!j.vendor_email) return "—";
  const domain = j.vendor_email.split("@")[1]?.split(".")[0] || "";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
};

const fmtProfileRate = (p: PublicProfile): string => {
  if (p.expected_hourly_rate) return `$${p.expected_hourly_rate}/hr`;
  return "—";
};

const JOB_TYPE_MAP: Record<string, string> = {
  c2c: "contract",
  w2: "full_time",
  c2h: "contract",
  fulltime: "full_time",
};

// ── Page size constant — always 25 ────────────────────────────────────────────
const PAGE_SIZE = 25;

// ── MatchBar ──────────────────────────────────────────────────────────────────

const MatchBar: React.FC<{ score: number }> = ({ score }) => (
  <span className="pub-fit-track">
    <span className="pub-fit-bar">
      <span
        className={`pub-fit-fill${score >= 90 ? " pub-fit-high" : score >= 75 ? " pub-fit-good" : ""}`}
        style={{ width: `${score}%` }}
      />
    </span>
    <span className="pub-fit-pct">{score}%</span>
  </span>
);

// ── QueryStrip (shared) ───────────────────────────────────────────────────────

const QueryStrip: React.FC<{ sql: string }> = ({ sql }) => (
  <div className="pub-query-strip">
    <span className="pub-qs-label">SQL&gt;</span>
    <span className="pub-qs-text">{sql};</span>
    <span className="pub-qs-run">▶</span>
  </div>
);

// ── StatusBar (shared) ────────────────────────────────────────────────────────

const StatusBar: React.FC<{ cells: string[]; loading: boolean }> = ({
  cells,
  loading,
}) => (
  <div className="pub-statusbar">
    {loading ? (
      <span className="pub-sb-cell">Executing query…</span>
    ) : (
      cells.map((c, i) => (
        <span
          key={i}
          className={`pub-sb-cell${i === cells.length - 1 ? " pub-sb-right" : ""}`}
        >
          {c}
        </span>
      ))
    )}
  </div>
);

// ── Pagination component (shared, W97-style matching MatchDataTable) ──────────

interface PaginationProps {
  total: number;
  page: number; // 0-based
  onPage: (p: number) => void;
  label?: string;
}

const PubPagination: React.FC<PaginationProps> = ({
  total,
  page,
  onPage,
  label,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  // Show up to 5 page buttons around the current page
  const pageButtons: number[] = [];
  const half = 2;
  let lo = Math.max(0, page - half);
  let hi = Math.min(totalPages - 1, lo + 4);
  lo = Math.max(0, hi - 4);
  for (let i = lo; i <= hi; i++) pageButtons.push(i);

  return (
    <div className="pub-pagination">
      <span className="pub-page-info">
        {label ? `${label}: ` : ""}
        {start}–{end} of {total}
      </span>
      <button
        className="pub-page-btn"
        disabled={page === 0}
        onClick={() => onPage(0)}
        title="First page"
      >
        «
      </button>
      <button
        className="pub-page-btn"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        title="Previous page"
      >
        ‹
      </button>
      {pageButtons.map((p) => (
        <button
          key={p}
          className={`pub-page-btn${p === page ? " pub-page-btn-active" : ""}`}
          onClick={() => onPage(p)}
        >
          {p + 1}
        </button>
      ))}
      <button
        className="pub-page-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
        title="Next page"
      >
        ›
      </button>
      <button
        className="pub-page-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(totalPages - 1)}
        title="Last page"
      >
        »
      </button>
    </div>
  );
};

// ── TwinView — /jobs ──────────────────────────────────────────────────────────

interface TwinProps {
  jobs: PublicJob[];
  profiles: PublicProfile[];
  loading: boolean;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
}

const TwinView: React.FC<TwinProps> = ({
  jobs,
  profiles,
  loading,
  openLogin,
}) => {
  const queryTime = useMemo(
    () => (Math.random() * 0.005 + 0.002).toFixed(3),
    [],
  );
  const [twinPage, setTwinPage] = useState(0);

  // Sort jobs by rate descending
  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const rA = a.pay_per_hour ?? (a.salary_max ? a.salary_max / 2080 : 0);
        const rB = b.pay_per_hour ?? (b.salary_max ? b.salary_max / 2080 : 0);
        return rB - rA;
      }),
    [jobs],
  );

  // For each profile: best fit score = max over all jobs
  const profilesWithFit = useMemo(
    () =>
      profiles
        .map((p) => ({
          ...p,
          fitScore:
            jobs.length > 0
              ? Math.max(
                  ...jobs.map((j) => computeMatch(j.skills_required, p.skills)),
                )
              : 70,
        }))
        .sort((a, b) => b.fitScore - a.fitScore),
    [jobs, profiles],
  );

  // Candidate count for each job (fit > 75)
  const jobsWithCandCount = useMemo(
    () =>
      sortedJobs.map((j) => ({
        ...j,
        candCount: profiles.filter(
          (p) => computeMatch(j.skills_required, p.skills) > 75,
        ).length,
      })),
    [sortedJobs, profiles],
  );

  const totalMatches = useMemo(
    () => profilesWithFit.filter((p) => p.fitScore > 75).length,
    [profilesWithFit],
  );

  const pageJobs = jobsWithCandCount.slice(
    twinPage * PAGE_SIZE,
    (twinPage + 1) * PAGE_SIZE,
  );
  const pageProfiles = profilesWithFit.slice(
    twinPage * PAGE_SIZE,
    (twinPage + 1) * PAGE_SIZE,
  );

  return (
    <div className="pub-landing">
      <div className="pub-section">
        {/* ── Title bar ─────────────────────────────────────────── */}
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">🗄️</span>
          <span className="pub-section-title">
            matchdb — jobs <span className="pub-join-badge">⋈</span>{" "}
            candidate_profiles
          </span>
          <div className="pub-titlebar-auth">
            <button
              className="pub-btn pub-btn-primary"
              onClick={() => openLogin("candidate", "login")}
            >
              👤 Candidate Login
            </button>
            <button
              className="pub-btn"
              onClick={() => openLogin("vendor", "login")}
            >
              🏢 Vendor Login
            </button>
            <button
              className="pub-btn"
              onClick={() => openLogin("candidate", "register")}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* ── SQL query strip ──────────────────────────────────── */}
        <QueryStrip sql="SELECT j.*, p.*, compute_match(j.skills_required, p.skills) AS fit_score FROM jobs j CROSS JOIN candidate_profiles p WHERE j.is_active = 1 ORDER BY fit_score DESC" />

        {/* ── Twin panels ──────────────────────────────────────── */}
        <div className="pub-twin-panels">
          {/* LEFT — jobs */}
          <div className="pub-panel">
            <div className="pub-panel-head">
              <span>💼</span>
              <span className="pub-panel-title">jobs</span>
              <span className="pub-panel-meta">
                {loading ? "…" : `${jobs.length} rows`}
              </span>
            </div>
            <div className="pub-panel-body">
              {loading ? (
                <table className="pub-jobs-table" aria-busy="true">
                  <tbody>
                    {Array.from({ length: 8 }).map((_, ri) => (
                      <tr
                        key={`sk-${ri}`}
                        className="pub-skeleton-row"
                        aria-hidden="true"
                      >
                        {[20, 70, 50, 45, 40, 35, 30, 30, 35].map((w, ci) => (
                          <td key={ci}>
                            <span
                              className="w97-shimmer"
                              style={{ width: w }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="pub-jobs-table pub-table-twin">
                  <colgroup>
                    <col className="pub-col-rn" />
                    <col className="pub-col-a" />
                    <col className="pub-col-b" />
                    <col className="pub-col-c" />
                    <col className="pub-col-d" />
                    <col className="pub-col-e" />
                    <col className="pub-col-f" />
                    <col className="pub-col-g" />
                    <col className="pub-col-h" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="pub-th-rn">#</th>
                      <th>title</th>
                      <th>company</th>
                      <th>location</th>
                      <th>type</th>
                      <th>mode</th>
                      <th>
                        rate <span className="pub-sort">▼</span>
                      </th>
                      <th>exp</th>
                      <th>candidates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageJobs.map((j, i) => (
                      <tr key={j.id}>
                        <td className="pub-td-rn">
                          {twinPage * PAGE_SIZE + i + 1}
                        </td>
                        <td className="pub-job-title">{j.title}</td>
                        <td className="pub-cell-truncate">{fmtCompany(j)}</td>
                        <td className="pub-cell-truncate">{j.location}</td>
                        <td>
                          <span
                            className={`pub-type-badge pub-type-${j.job_type}`}
                          >
                            {j.job_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="pub-mode-cell">{j.work_mode}</td>
                        <td className="pub-num">{fmtJobRate(j)}</td>
                        <td className="pub-num">{j.experience_required}y</td>
                        <td className="pub-cand-count">
                          {j.candCount > 0 ? (
                            <>👥 {j.candCount}</>
                          ) : (
                            <span style={{ opacity: 0.4 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT — candidate_profiles */}
          <div className="pub-panel">
            <div className="pub-panel-head">
              <span>👥</span>
              <span className="pub-panel-title">candidate_profiles</span>
              <span className="pub-panel-meta">
                {loading ? "…" : `${profiles.length} rows`}
              </span>
            </div>
            <div className="pub-panel-body">
              {loading ? (
                <table className="pub-jobs-table" aria-busy="true">
                  <tbody>
                    {Array.from({ length: 8 }).map((_, ri) => (
                      <tr
                        key={`sk-${ri}`}
                        className="pub-skeleton-row"
                        aria-hidden="true"
                      >
                        {[20, 80, 55, 40, 45, 35, 30, 30, 35].map((w, ci) => (
                          <td key={ci}>
                            <span
                              className="w97-shimmer"
                              style={{ width: w }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="pub-jobs-table pub-table-twin">
                  <colgroup>
                    <col className="pub-col-rn" />
                    <col className="pub-col-a" />
                    <col className="pub-col-b" />
                    <col className="pub-col-c" />
                    <col className="pub-col-d" />
                    <col className="pub-col-e" />
                    <col className="pub-col-f" />
                    <col className="pub-col-g" />
                    <col className="pub-col-h" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="pub-th-rn">#</th>
                      <th>name</th>
                      <th>current_role</th>
                      <th>company</th>
                      <th>location</th>
                      <th>pref_type</th>
                      <th>rate_hr</th>
                      <th>exp</th>
                      <th>
                        fit_score <span className="pub-sort">▼</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageProfiles.map((p, i) => (
                      <tr key={p.id}>
                        <td className="pub-td-rn">
                          {twinPage * PAGE_SIZE + i + 1}
                        </td>
                        <td className="pub-job-title">{p.name}</td>
                        <td className="pub-cell-truncate">{p.current_role}</td>
                        <td className="pub-cell-truncate">
                          {p.current_company}
                        </td>
                        <td className="pub-cell-truncate">
                          {p.location || "—"}
                        </td>
                        <td>
                          <span
                            className={`pub-type-badge pub-type-${p.preferred_job_type || ""}`}
                          >
                            {p.preferred_job_type?.replace("_", " ") || "—"}
                          </span>
                        </td>
                        <td className="pub-num">{fmtProfileRate(p)}</td>
                        <td className="pub-num">{p.experience_years}y</td>
                        <td>
                          <MatchBar score={p.fitScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── Shared pagination for twin panels ───────────────── */}
        <PubPagination
          total={Math.max(jobs.length, profiles.length)}
          page={twinPage}
          onPage={setTwinPage}
        />

        {/* ── Status bar ──────────────────────────────────────── */}
        <StatusBar
          loading={loading}
          cells={[
            `${jobs.length} jobs × ${profiles.length} candidates (${queryTime} sec)`,
            `${totalMatches} strong matches (fit > 75%)`,
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── CandidateView — /jobs/candidate ──────────────────────────────────────────

interface CandViewProps {
  jobs: PublicJob[];
  loading: boolean;
  jobTypeFilter: string;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
}

const CandView: React.FC<CandViewProps> = ({
  jobs,
  loading,
  jobTypeFilter,
  openLogin,
}) => {
  const queryTime = useMemo(
    () => (Math.random() * 0.004 + 0.001).toFixed(3),
    [],
  );
  const [page, setPage] = useState(0);

  const filteredJobs = jobTypeFilter
    ? jobs.filter((j) => {
        const mapped = JOB_TYPE_MAP[jobTypeFilter];
        return mapped ? j.job_type === mapped : true;
      })
    : jobs;

  const sortedJobs = useMemo(
    () =>
      [...filteredJobs].sort((a, b) => {
        const rA = a.pay_per_hour ?? (a.salary_max ? a.salary_max / 2080 : 0);
        const rB = b.pay_per_hour ?? (b.salary_max ? b.salary_max / 2080 : 0);
        return rB - rA;
      }),
    [filteredJobs],
  );

  // Reset to page 0 when filter changes
  useEffect(() => {
    setPage(0);
  }, [jobTypeFilter]);

  // Simulated match scores (stable per position)
  const SCORES = useMemo(() => {
    const base = [
      96, 94, 92, 90, 89, 87, 85, 84, 82, 80, 79, 77, 75, 74, 72, 70, 69, 67,
      65, 63, 61, 60, 58, 56, 54,
    ];
    return base;
  }, []);

  const pageJobs = sortedJobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sqlQuery = `SELECT id, title, location, job_type, work_mode, pay_per_hour, skills_required, experience_required FROM jobs WHERE is_active = 1${jobTypeFilter ? ` AND job_subtype = '${jobTypeFilter}'` : ""} ORDER BY pay_per_hour DESC`;

  return (
    <div className="pub-landing">
      <div className="pub-section">
        {/* ── Title bar ─────────────────────────────────────────── */}
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">💼</span>
          <span className="pub-section-title">
            matchdb.jobs — {sortedJobs.length} positions waiting for you
            {jobTypeFilter && (
              <span className="pub-filter-badge">
                {jobTypeFilter.toUpperCase()}
              </span>
            )}
          </span>
          <div className="pub-titlebar-auth">
            <button
              className="pub-btn pub-btn-primary"
              onClick={() => openLogin("candidate", "login")}
            >
              👤 Candidate Sign In
            </button>
            <button
              className="pub-btn"
              onClick={() => openLogin("candidate", "register")}
            >
              Create Account
            </button>
          </div>
        </div>

        <QueryStrip sql={sqlQuery} />

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="pub-section-body">
          {loading ? (
            <table className="pub-jobs-table" aria-busy="true">
              <tbody>
                {Array.from({ length: 8 }).map((_, ri) => (
                  <tr
                    key={`sk-${ri}`}
                    className="pub-skeleton-row"
                    aria-hidden="true"
                  >
                    {[20, 90, 70, 50, 40, 35, 30, 90, 50].map((w, ci) => (
                      <td key={ci}>
                        <span className="w97-shimmer" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sortedJobs.length === 0 ? (
            <div className="pub-empty">-- 0 rows returned --</div>
          ) : (
            <table className="pub-jobs-table pub-table-cand">
              <colgroup>
                <col className="pub-col-rn" />
                <col className="pub-col-title" />
                <col className="pub-col-loc" />
                <col className="pub-col-type" />
                <col className="pub-col-mode" />
                <col className="pub-col-rate" />
                <col className="pub-col-exp" />
                <col className="pub-col-skills" />
                <col className="pub-col-score" />
              </colgroup>
              <thead>
                <tr>
                  <th className="pub-th-rn">#</th>
                  <th>title</th>
                  <th>location</th>
                  <th>type</th>
                  <th>mode</th>
                  <th>
                    rate <span className="pub-sort">▼</span>
                  </th>
                  <th>exp</th>
                  <th>skills_required</th>
                  <th>match_score</th>
                </tr>
              </thead>
              <tbody>
                {pageJobs.map((j, i) => (
                  <tr key={j.id}>
                    <td className="pub-td-rn">{page * PAGE_SIZE + i + 1}</td>
                    <td className="pub-job-title">{j.title}</td>
                    <td className="pub-cell-truncate">{j.location}</td>
                    <td>
                      <span className="pub-type-badge">
                        {j.job_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="pub-mode-cell">{j.work_mode}</td>
                    <td className="pub-num">{fmtJobRate(j)}</td>
                    <td className="pub-num">{j.experience_required}</td>
                    <td className="pub-skills-cell">
                      <div className="pub-skills">
                        {j.skills_required.slice(0, 4).map((s) => (
                          <span key={s} className="pub-skill-tag">
                            {s}
                          </span>
                        ))}
                        {j.skills_required.length > 4 && (
                          <span className="pub-skill-more">
                            +{j.skills_required.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pub-match-cell">
                      <MatchBar score={SCORES[page * PAGE_SIZE + i] ?? 60} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PubPagination total={sortedJobs.length} page={page} onPage={setPage} />

        <StatusBar
          loading={loading}
          cells={[
            `${sortedJobs.length} rows in set (${queryTime} sec)`,
            jobTypeFilter
              ? `Filter: ${jobTypeFilter.toUpperCase()}`
              : "Filter: ALL",
            "Sign in to apply →",
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── VendorView — /jobs/vendor ─────────────────────────────────────────────────

interface VendorViewProps {
  profiles: PublicProfile[];
  loading: boolean;
  openLogin: (ctx: "candidate" | "vendor", mode?: "login" | "register") => void;
}

const VendorView: React.FC<VendorViewProps> = ({
  profiles,
  loading,
  openLogin,
}) => {
  const queryTime = useMemo(
    () => (Math.random() * 0.003 + 0.001).toFixed(3),
    [],
  );
  const [page, setPage] = useState(0);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.experience_years - a.experience_years),
    [profiles],
  );

  const SCORES = useMemo(() => {
    const base = [
      97, 95, 93, 91, 90, 88, 86, 84, 82, 80, 79, 77, 75, 74, 72, 70, 69, 67,
      65, 63, 61, 60, 58, 56, 54,
    ];
    return base;
  }, []);

  const pageProfiles = sortedProfiles.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <div className="pub-landing">
      <div className="pub-section">
        {/* ── Title bar ─────────────────────────────────────────── */}
        <div className="pub-section-titlebar">
          <span className="pub-section-icon">👥</span>
          <span className="pub-section-title">
            matchdb.candidate_profiles — {sortedProfiles.length} professionals
            ready to hire
          </span>
          <div className="pub-titlebar-auth">
            <button
              className="pub-btn pub-btn-primary"
              onClick={() => openLogin("vendor", "login")}
            >
              🏢 Vendor Sign In
            </button>
            <button
              className="pub-btn"
              onClick={() => openLogin("vendor", "register")}
            >
              Create Account
            </button>
          </div>
        </div>

        <QueryStrip sql="SELECT id, name, current_role, current_company, location, expected_hourly_rate, experience_years, preferred_job_type, skills FROM candidate_profiles WHERE profileLocked = 1 ORDER BY experience_years DESC" />

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="pub-section-body">
          {loading ? (
            <table className="pub-jobs-table" aria-busy="true">
              <tbody>
                {Array.from({ length: 8 }).map((_, ri) => (
                  <tr
                    key={`sk-${ri}`}
                    className="pub-skeleton-row"
                    aria-hidden="true"
                  >
                    {[20, 70, 80, 70, 50, 35, 30, 90, 50].map((w, ci) => (
                      <td key={ci}>
                        <span className="w97-shimmer" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sortedProfiles.length === 0 ? (
            <div className="pub-empty">-- 0 rows returned --</div>
          ) : (
            <table className="pub-jobs-table pub-table-vendor">
              <colgroup>
                <col className="pub-col-rn" />
                <col className="pub-col-name" />
                <col className="pub-col-role" />
                <col className="pub-col-company" />
                <col className="pub-col-loc" />
                <col className="pub-col-rate" />
                <col className="pub-col-exp" />
                <col className="pub-col-pref" />
                <col className="pub-col-skills" />
              </colgroup>
              <thead>
                <tr>
                  <th className="pub-th-rn">#</th>
                  <th>name</th>
                  <th>current_role</th>
                  <th>company</th>
                  <th>location</th>
                  <th>rate_hr</th>
                  <th>
                    exp <span className="pub-sort">▼</span>
                  </th>
                  <th>pref_type</th>
                  <th>skills</th>
                </tr>
              </thead>
              <tbody>
                {pageProfiles.map((p, i) => (
                  <tr key={p.id}>
                    <td className="pub-td-rn">{page * PAGE_SIZE + i + 1}</td>
                    <td className="pub-job-title">{p.name}</td>
                    <td className="pub-cell-truncate">{p.current_role}</td>
                    <td className="pub-cell-truncate">{p.current_company}</td>
                    <td className="pub-cell-truncate">{p.location}</td>
                    <td className="pub-num">{fmtProfileRate(p)}</td>
                    <td className="pub-num">{p.experience_years}y</td>
                    <td>
                      <span
                        className={`pub-type-badge pub-type-${p.preferred_job_type}`}
                      >
                        {p.preferred_job_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="pub-skills-cell">
                      <div className="pub-skills">
                        {p.skills.slice(0, 4).map((s) => (
                          <span key={s} className="pub-skill-tag">
                            {s}
                          </span>
                        ))}
                        {p.skills.length > 4 && (
                          <span className="pub-skill-more">
                            +{p.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PubPagination
          total={sortedProfiles.length}
          page={page}
          onPage={setPage}
        />

        <StatusBar
          loading={loading}
          cells={[
            `${sortedProfiles.length} rows in set (${queryTime} sec)`,
            "Filter: profileLocked = 1",
            "Sign in to contact candidates →",
            "MatchDB v97.2026",
          ]}
        />
      </div>
    </div>
  );
};

// ── PublicLanding (root) ──────────────────────────────────────────────────────

const PublicLanding: React.FC = () => {
  const location = useLocation();
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTypeFilter, setJobTypeFilter] = useState("");

  // Path detection
  const isVendorView =
    location.pathname === "/jobs/vendor" ||
    location.pathname.startsWith("/jobs/vendor/");
  const isCandView =
    location.pathname === "/jobs/candidate" ||
    location.pathname.startsWith("/jobs/candidate/");

  useEffect(() => {
    axios
      .get("/api/jobs/")
      .then((res) => {
        const data: PublicJob[] = res.data;
        setJobs(data.length > 0 ? data : MOCK_JOBS);
      })
      .catch(() => setJobs(MOCK_JOBS));
  }, []);

  useEffect(() => {
    axios
      .get("/api/jobs/profiles-public")
      .then((res) => {
        const data: PublicProfile[] = res.data;
        setProfiles(data.length > 0 ? data : MOCK_PROFILES);
      })
      .catch(() => setProfiles(MOCK_PROFILES))
      .finally(() => setLoading(false));
  }, []);

  // Job-type filter from shell nav (candidate view only)
  useEffect(() => {
    const handler = (e: Event) => {
      setJobTypeFilter((e as CustomEvent).detail?.jobType || "");
    };
    window.addEventListener("matchdb:jobTypeFilter", handler);
    return () => window.removeEventListener("matchdb:jobTypeFilter", handler);
  }, []);

  const openLogin = (
    context: "candidate" | "vendor",
    mode: "login" | "register" = "login",
  ) => {
    window.dispatchEvent(
      new CustomEvent("matchdb:openLogin", { detail: { context, mode } }),
    );
  };

  if (isVendorView) {
    return (
      <VendorView profiles={profiles} loading={loading} openLogin={openLogin} />
    );
  }
  if (isCandView) {
    return (
      <CandView
        jobs={jobs}
        loading={loading}
        jobTypeFilter={jobTypeFilter}
        openLogin={openLogin}
      />
    );
  }
  return (
    <TwinView
      jobs={jobs}
      profiles={profiles}
      loading={loading}
      openLogin={openLogin}
    />
  );
};

export default PublicLanding;
