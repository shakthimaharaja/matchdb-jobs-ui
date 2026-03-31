# matchdb-jobs-ui

Remote microfrontend for the MatchDB staffing platform. Exposes the Jobs application module (`./JobsApp`) via Webpack 5 Module Federation and is consumed by the shell host at runtime.

---

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Runtime      | React 18 + TypeScript                                 |
| Bundler      | Webpack 5 (Module Federation — remote: `matchdbJobs`) |
| State        | Redux Toolkit (`jobsSlice`)                           |
| Routing      | React Router v6                                       |
| UI Libraries | MUI 5, PrimeReact 10, Tailwind CSS 3                  |
| UI Shared    | matchdb-component-library (local npm link)            |
| HTTP         | Axios                                                 |
| Realtime     | Polling (fetch + setInterval) — live data feeds       |
| PDF          | jsPDF                                                 |
| Theme        | Inherits Windows 97 theme from the shell              |

---

## Project Structure

```
matchdb-jobs-ui/
├── public/
│   └── index.html               # HTML template (standalone fallback)
├── src/
│   ├── index.ts                 # Webpack entry point
│   ├── bootstrap.tsx            # React root render (standalone mode)
│   ├── JobsApp.tsx              # Exposed MFE component — routing entry
│   ├── api/
│   │   └── jobsApi.ts           # RTK Query API — all HTTP endpoints + types
│   ├── components/
│   │   ├── index.ts             # Barrel export (all components + types)
│   │   ├── DBLayout.tsx         # phpMyAdmin-style panel with subnav + breadcrumb events
│   │   ├── MatchDataTable.tsx   # DataTable wrapper with flash animations & server-side pagination
│   │   ├── DetailModal.tsx      # Job/profile detail viewer with PDF download
│   │   ├── DetailModal.css
│   │   ├── ResumeModal.tsx      # Candidate profile create/edit modal
│   │   ├── ResumeModal.css
│   │   ├── JobPostingModal.tsx  # Employer job detail viewer with close/reopen
│   │   ├── JobPostingModal.css
│   │   ├── PokeEmailModal.tsx   # Poke email composer modal
│   │   ├── InviteEmployeeModal.tsx    # Invite employer team members
│   │   ├── InviteCandidateModal.tsx   # Invite candidates to company
│   │   ├── InvitationList.tsx         # Employee invitation list
│   │   ├── CandidateInvitationList.tsx # Candidate invitation list
│   │   ├── UserManagementTable.tsx    # Company user RBAC management
│   │   ├── ActiveUsersPanel.tsx       # Active users overview
│   │   ├── PermissionGuard.tsx        # RBAC conditional renderer
│   │   └── RoleAssignmentDropdown.tsx # Role + department picker
│   ├── pages/
│   │   ├── index.ts                # Barrel export — all pages
│   │   ├── candidate/             # ── Candidate login pages ──
│   │   │   ├── candidateHelpers.tsx       # Types & utilities for candidate views
│   │   │   ├── CandidateDashboard.tsx     # Main candidate portal — matches, pokes, interviews
│   │   │   ├── CandidateProfile.tsx       # Profile editor — personal info, work history, resume
│   │   │   ├── CandidateOnboardingFlow.tsx # Registration orchestrator (register → payment → success)
│   │   │   ├── CandidateRegisterPage.tsx  # Token validation + account creation form
│   │   │   ├── CandidatePaymentPage.tsx   # Plan summary + Stripe Checkout redirect
│   │   │   ├── CandidatePaymentSuccess.tsx # Payment success confirmation
│   │   │   ├── CandidatePaymentFailed.tsx  # Payment failure + retry
│   │   │   ├── TimesheetView.tsx          # Timesheet entry, drafts, submission & history
│   │   │   ├── InviteAcceptPage.tsx       # Invite token verification + acceptance
│   │   │   └── LegacyForms.css            # Legacy form styling (CandidateProfile)
│   │   ├── employer/              # ── Employer login pages ──
│   │   │   ├── employerHelpers.ts         # Types & utilities for employer views
│   │   │   ├── EmployerDashboard.tsx      # Unified employer hub — switches Postings/Operations
│   │   │   ├── EmployerDashboard.css
│   │   │   ├── PostingsDashboard.tsx      # Job postings, candidate matching, pokes, interviews
│   │   │   ├── OperationsDashboard.tsx    # Staffing ops — roster, financials, immigration, admin
│   │   │   ├── PostJobPage.tsx            # Job posting form with Smart Paste parser
│   │   │   ├── PostJobPage.css
│   │   │   └── VendorFinancial.css        # Financial summary styling
│   │   └── shared/                # ── No login / both types ──
│   │       ├── PublicJobsView.tsx         # Pre-login live data tables (jobs ⋈ profiles)
│   │       ├── PublicJobsView.css
│   │       ├── MembershipGatePage.tsx     # Paywall — employer subscription / candidate visibility
│   │       └── MembershipGatePage.css
│   ├── store/
│   │   ├── index.ts             # Redux store config
│   │   ├── authSlice.ts         # Auth token state
│   │   └── jobsSlice.ts         # Jobs state, CRUD thunks, poke thunks
│   ├── hooks/
│   │   ├── index.ts             # Barrel export — hooks + CompanyContext
│   │   ├── useDraftCache.ts     # Draft form persistence hook
│   │   ├── useAutoRefreshFlash.ts # Auto-refresh + row flash animation hook
│   │   ├── useLiveRefresh.ts    # Polling-based live data refresh hook
│   │   └── useCompanyContext.tsx # RBAC CompanyContext — role, permissions, hasPermission()
│   ├── shared/
│   │   ├── index.ts             # Re-exports DataTable & types from component library
│   │   └── PokesTable.tsx       # Poke interactions table
│   ├── styles/
│   │   └── index.css            # Barrel — imports theme, base & component styles from library
│   ├── constants/
│   │   ├── index.ts             # Shared constants (job types, countries, thresholds)
│   │   └── endpoints.ts         # API endpoint URLs
│   └── utils/
│       └── index.ts             # Shared utilities (error formatting, PDF generation)
├── env/
│   └── .env.development         # Local env vars
├── webpack.config.js            # Webpack + Module Federation config
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── tsconfig.json
```

---

## Module Federation

This app is configured as a **remote** with the name `matchdbJobs`:

```js
// webpack.config.js
new ModuleFederationPlugin({
  name: 'matchdbJobs',
  filename: 'remoteEntry.js',
  exposes: {
    './JobsApp': './src/JobsApp',   // ← consumed by the shell
  },
  shared: { react, 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit' },
});
```

The shell host loads this remote entry at `http://localhost:3001/remoteEntry.js`.

---

## Props from Shell (JobsAppProps)

| Prop                     | Type                              | Description                    |
| ------------------------ | --------------------------------- | ------------------------------ |
| `token`                  | `string \| null`                  | JWT access token               |
| `userType`               | `string \| undefined`             | `candidate` or `employer`      |
| `userId`                 | `string \| undefined`             | User ID                        |
| `userEmail`              | `string \| undefined`             | User email                     |
| `username`               | `string \| undefined`             | Username slug for profile URLs |
| `plan`                   | `string \| undefined`             | Subscription plan              |
| `membershipConfig`       | `Record<string,string[]> \| null` | Purchased visibility domains   |
| `hasPurchasedVisibility` | `boolean \| undefined`            | Unlocks matched jobs view      |

---

## Routing (JobsApp.tsx)

| Condition                                   | Component Rendered        | URL Paths                                                  |
| ------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| Not logged in                               | `PublicJobsView`          | `/jobs`, `/jobs/candidate`, `/jobs/vendor`                 |
| Not logged in — candidate onboarding        | `CandidateOnboardingFlow` | `/candidate/register/:token`, `/candidate/payment-*`       |
| Employer, no subscription (plan === "free") | `MembershipGatePage`      | —                                                          |
| Candidate, no visibility                    | `MembershipGatePage`      | —                                                          |
| Logged in as **employer**                   | `EmployerDashboard`       | `/*` (with PostingsDashboard / OperationsDashboard inside) |
| Employer — post a job                       | `PostJobPage`             | `/post-job`                                                |
| Logged in as **candidate**                  | `CandidateDashboard`      | `/*`                                                       |
| Invite token in URL                         | `InviteAcceptPage`        | `/invite/:token`                                           |

### Employer Dashboard Mode Switching

`EmployerDashboard` uses RBAC (`CompanyContext` from `/admin/me`) to render:

| RBAC Role  | Default Mode | Available Dashboards                           |
| ---------- | ------------ | ---------------------------------------------- |
| `admin`    | postings     | `PostingsDashboard` + `OperationsDashboard`    |
| `manager`  | postings     | `PostingsDashboard` + `OperationsDashboard`    |
| `vendor`   | postings     | `PostingsDashboard` only                       |
| `marketer` | operations   | `OperationsDashboard` only (department-scoped) |

---

## Candidate Dashboard Features

- **Locked state (🔒):** When `hasPurchasedVisibility` is `false`, shows a blurred/locked panel prompting the candidate to purchase a Visibility Package (starting at $13, one-time). CTA button opens the shell's Pricing modal.
- **Unlocked state:** When visibility is purchased, shows:
  - **Visibility coverage alert** — displays purchased domains/subdomains (e.g., "contract (C2C, C2H) · full_time (W2)") with an "Add More" button
  - **Matched jobs table** — ranked job matches with auto-refresh flash animations (yellow for new/changed, red for removed)
  - **Shareable profile URL** — displays `{origin}/resume/{username}` with a "Copy" button (clipboard integration)
  - Plan badge + poke counter

### Candidate Portal — Jobs Section

- **Matched Jobs** — ranked job matches with auto-refresh flash animations
- **Forwarded Openings** — job openings forwarded by the candidate's employer, grouped by sub-category (C2C, C2H, W2, 1099, Direct Hire, Salary) in collapsible panels with count badges
- **Pokes Sent / Received** — poke interaction history
- **Mail Sent / Received** — email interaction history

### Candidate Portal — Employer Section

- **Financial (read-only)** — view project financial data (bill rate, pay rate, margins) computed by the employer
- **Immigration** — immigration status placeholder section

---

## Employer Dashboard Features

### PostingsDashboard (employer/PostingsDashboard.tsx)

Job postings, candidate matching, and hiring interface. Available to employer users with `job_postings` permission (admin, manager, vendor roles):

- **Job Postings Table** — list/close/reopen posted jobs with status indicators
- **Candidate Matches** — ranked candidate matches per job with match scoring
- **Pokes Sent/Received** — track poke interactions between employers and candidates
- **Interview Invites** — send and track interview invitations
- **Financial Summary** — employer-side financial overview (bill rates, margins)

### OperationsDashboard (employer/OperationsDashboard.tsx)

Comprehensive staffing operations interface. Available to employer users with `candidates` permission (admin, manager, marketer roles). Sidebar navigation filtered by RBAC permissions:

- **Admin** — company setup, user management, employee invitations (requires `manage_roles`)
- **Roster** — manage rostered candidates (add, remove, invite via email link)
- **Forwarded Openings** — forward jobs to candidates, track status, send email notifications
- **Financial Summary** — company-wide financial metrics (total revenue, margins, tax withholdings)
- **Project Summary** — per-project breakdown with bill rates, pay rates, and margin calculations
- **Job Positions Summary** — candidates grouped by job position with financial details
- **Immigration Summary** — candidate immigration status overview (requires `immigration`)
- **Timesheets** — timesheet approval workflow (requires `workers`)
- **Client/Vendor Companies** — company relationship management

---

## PublicJobsView (Pre-login)

Replaces the previous `PublicLanding` component. Three sub-views by URL path (`/jobs`, `/jobs/candidate`, `/jobs/vendor`). Uses two polling endpoints:

- `/api/jobs/poll/public-data` — fetches full job + profile snapshots every 30 s with diff tracking (changedIds, deletedIds). Drives row flash animations (yellow for changed, red for deleted).
- `/api/jobs/poll/counts` — fetches live job and profile counts for the status bar.

All data is fetched via `fetch` + `setInterval` polling (30 s interval).

---

## Components

### MatchDataTable

Wraps the `DataTable` component from `matchdb-component-library`. Adds flash animation props (`flashIds` for yellow new/changed rows, `deleteFlashIds` for red removed rows) and server-side pagination support (`serverTotal`, `serverPage`, `serverPageSize`, `onPageChange`).

### DetailModal

Generic detail viewer for jobs and candidate profiles. Shows formatted field data in a modal overlay with a "Download PDF" feature that opens a print-friendly window.

### ResumeModal

Profile create/edit modal for candidates. Loads existing profile data, allows editing (name, email, phone, location, company, role, resume sections, bio), and saves via `upsertProfile` thunk.

### JobPostingModal

Job detail viewer for vendors with close/reopen actions. Displays full job metadata including pay rate, type, sub-type labels (C2C/C2H/W2/1099/Direct Hire/Salary), and work mode. Includes confirmation flow for close/reopen operations.

### PokeEmailModal

Poke email composer for sending poke notifications to candidates or vendors.

---

## Inter-MFE Events (CustomEvent)

| Event Name              | Direction    | Purpose                                              |
| ----------------------- | ------------ | ---------------------------------------------------- |
| `matchdb:subnav`        | Jobs → Shell | Send subnav groups to shell sidebar                  |
| `matchdb:breadcrumb`    | Jobs → Shell | Send breadcrumb label to shell header                |
| `matchdb:openLogin`     | Jobs → Shell | Request login modal from shell                       |
| `matchdb:jobTypeFilter` | Shell → Jobs | Filter jobs by type in dashboards                    |
| `matchdb:loginContext`  | Shell → Jobs | Tell PublicJobsView which login type is active       |
| `matchdb:dashMode`      | Shell → Jobs | Switch employer dashboard mode (postings/operations) |

---

## Global Styles (`src/styles/`)

The Windows 97 theme CSS has been extracted to the **matchdb-component-library** package. The Jobs UI imports theme, base, and component styles from the library:

```css
/* src/styles/index.css */
@import "matchdb-component-library/src/styles/w97-theme.css";
@import "matchdb-component-library/src/styles/w97-base.css";
@import "matchdb-component-library/src/styles/components.css";
```

| File             | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `w97-theme.css`  | 50+ `--w97-*` CSS custom properties for light & dark mode (`[data-theme]`) |
| `w97-base.css`   | Shared utility classes: `.w97-raised`, `.w97-sunken`, `.w97-scroll`, etc.  |
| `components.css` | Component-level styles (DataTable, Panel, Toolbar, etc.)                   |

When running inside the shell host, the shell's own CSS variables override these defaults.

---

## Utilities (`src/utils/`)

Shared utility functions (`fmtCurrency`, `fmtDate`, `authHeader`, `downloadBlob`, `TYPE_LABELS`, `SUB_LABELS`, etc.) have been extracted to the **matchdb-component-library** package. The remaining local utility is:

| Export                | Description                           |
| --------------------- | ------------------------------------- |
| `generateResumePDF()` | Resume PDF generation utility (jsPDF) |

---

## Hooks (`src/hooks/`)

| Hook                  | Description                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useDraftCache`       | Persists form draft state to localStorage                                                                                                                                                        |
| `useAutoRefreshFlash` | Tracks data diffs on a 30 s interval, produces `flashIds` (yellow) and `deleteFlashIds` (red) sets                                                                                               |
| `useLiveRefresh`      | Polling-based live data refresh with configurable interval                                                                                                                                       |
| `useCompanyContext`   | RBAC context via `CompanyContext` — provides `role`, `department`, `permissions`, `hasPermission()`, `hasRole()`, `companyUser`, `companyAdmin`, and seat availability from `/api/jobs/admin/me` |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- `matchdb-jobs-services` running on port 8001 (backend API)
- `matchdb-shell-ui` running on port 3000 (to load this remote inside the shell)

### Environment Variables

Create `env/.env.development`:

```env
JOBS_SERVICES_URL=http://localhost:8001
```

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (webpack dev server)
npm run dev
```

The MFE dev server runs at **http://localhost:3001**.

> **First time?** Make sure you've seeded both backend databases before launching the UI:
>
> ```bash
> cd ../matchdb-shell-services && npm run seed
> cd ../matchdb-jobs-services  && npm run seed
> ```
>
> See the [root README](../README.md) for full setup steps and test account credentials. The remote entry is served at `http://localhost:3001/remoteEntry.js`.

When running standalone (not inside the shell), the app renders with its own `bootstrap.tsx` entry point.

---

## Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Start webpack dev server (port 3001)          |
| `npm run dev:standalone` | Webpack dev server only (port 3001, no proxy) |
| `npm run build`          | Production build to `dist/`                   |

---

## Full Platform Startup Order

To run the entire MatchDB platform locally, start services in this order:

```
1. matchdb-shell-services        →  port 8000  (auth + payments API + gateway — MongoDB Atlas)
2. matchdb-jobs-services         →  port 8001  (jobs + profiles API — MongoDB Atlas)
3. matchdb-jobs-ui               →  port 3001  (remote MFE)
4. matchdb-shell-ui              →  port 3000  (host shell)
```

Then open **http://localhost:3000** in your browser.

---

## License

MIT
