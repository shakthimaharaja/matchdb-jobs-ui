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
| Realtime     | WebSocket (native browser API) — live data feeds      |
| PDF          | jsPDF                                                 |
| Proxy Server | Express + http-proxy-middleware (port 4001)           |
| Theme        | Inherits Windows 97 theme from the shell              |

---

## Project Structure

```
matchdb-jobs-ui/
├── public/
│   └── index.html               # HTML template (standalone fallback)
├── server/
│   └── index.ts                 # Express proxy server (port 4001)
├── src/
│   ├── index.ts                 # Webpack entry point
│   ├── bootstrap.tsx            # React root render (standalone mode)
│   ├── JobsApp.tsx              # Exposed MFE component — routing entry
│   ├── components/
│   │   ├── index.ts             # Barrel export (all components + types)
│   │   ├── DBLayout.tsx         # phpMyAdmin-style panel with subnav + breadcrumb events
│   │   ├── MatchDataTable.tsx   # DataTable wrapper with flash animations & server-side pagination
│   │   ├── DetailModal.tsx      # Job/profile detail viewer with PDF download
│   │   ├── DetailModal.css
│   │   ├── ResumeModal.tsx      # Candidate profile create/edit modal
│   │   ├── ResumeModal.css
│   │   ├── JobPostingModal.tsx  # Vendor job detail viewer with close/reopen
│   │   ├── JobPostingModal.css
│   │   └── PokeEmailModal.tsx   # Poke email composer modal
│   ├── pages/
│   │   ├── PublicJobsView.tsx   # Pre-login view — live WebSocket tables (jobs & profiles)
│   │   ├── PublicJobsView.css
│   │   ├── CandidateDashboard.tsx  # Candidate view — profile, matched jobs, visibility
│   │   ├── VendorDashboard.tsx     # Vendor view — post jobs, browse candidates
│   │   ├── CandidateProfile.tsx    # Candidate profile edit form
│   │   ├── PostJobPage.tsx         # Vendor job posting form
│   │   ├── PostJobPage.css
│   │   └── LegacyForms.css        # Form styling shared between pages
│   ├── store/
│   │   ├── index.ts             # Redux store config
│   │   └── jobsSlice.ts         # Jobs state, CRUD thunks, poke thunks
│   ├── hooks/
│   │   ├── useDraftCache.ts     # Draft form persistence hook
│   │   └── useAutoRefreshFlash.ts # Auto-refresh + row flash animation hook
│   ├── shared/
│   │   ├── index.ts             # Re-exports DataTable & types from component library
│   │   └── PokesTable.tsx       # Poke interactions table
│   ├── styles/
│   │   └── index.css            # Barrel — imports theme, base & component styles from library
│   └── utils/
│       └── generateResumePDF.ts # Resume PDF generation utility
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
| `userType`               | `string \| undefined`             | `candidate` or `vendor`        |
| `userId`                 | `string \| undefined`             | User ID                        |
| `userEmail`              | `string \| undefined`             | User email                     |
| `username`               | `string \| undefined`             | Username slug for profile URLs |
| `plan`                   | `string \| undefined`             | Subscription plan              |
| `membershipConfig`       | `Record<string,string[]> \| null` | Purchased visibility domains   |
| `hasPurchasedVisibility` | `boolean \| undefined`            | Unlocks matched jobs view      |

---

## Routing (JobsApp.tsx)

| Condition                  | Component Rendered   | URL Paths                                  |
| -------------------------- | -------------------- | ------------------------------------------ |
| Not logged in              | `PublicJobsView`     | `/jobs`, `/jobs/candidate`, `/jobs/vendor` |
| Logged in as **candidate** | `CandidateDashboard` |                                            |
| Logged in as **vendor**    | `VendorDashboard`    |                                            |

---

## Candidate Dashboard Features

- **Locked state (🔒):** When `hasPurchasedVisibility` is `false`, shows a blurred/locked panel prompting the candidate to purchase a Visibility Package (starting at $13, one-time). CTA button opens the shell's Pricing modal.
- **Unlocked state:** When visibility is purchased, shows:
  - **Visibility coverage alert** — displays purchased domains/subdomains (e.g., "contract (C2C, C2H) · full_time (W2)") with an "Add More" button
  - **Matched jobs table** — ranked job matches with auto-refresh flash animations (yellow for new/changed, red for removed)
  - **Shareable profile URL** — displays `{origin}/resume/{username}` with a "Copy" button (clipboard integration)
  - Plan badge + poke counter

---

## PublicJobsView (Pre-login)

Replaces the previous `PublicLanding` component. Three sub-views by URL path (`/jobs`, `/jobs/candidate`, `/jobs/vendor`). Connects to two WebSocket endpoints:

- `/ws/public-data` — receives full job + profile snapshots every 30 s with diff tracking (changedIds, deletedIds). Drives row flash animations (yellow for changed, red for deleted).
- `/ws/counts` — receives live job and profile counts for the status bar.

No HTTP polling is used — all data is pushed via WebSocket.

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

| Event Name              | Direction    | Purpose                                        |
| ----------------------- | ------------ | ---------------------------------------------- |
| `matchdb:subnav`        | Jobs → Shell | Send subnav groups to shell sidebar            |
| `matchdb:breadcrumb`    | Jobs → Shell | Send breadcrumb label to shell header          |
| `matchdb:openLogin`     | Jobs → Shell | Request login modal from shell                 |
| `matchdb:jobTypeFilter` | Shell → Jobs | Filter jobs by type in dashboards              |
| `matchdb:loginContext`  | Shell → Jobs | Tell PublicJobsView which login type is active |

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

| Hook                  | Description                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `useDraftCache`       | Persists form draft state to localStorage                                                          |
| `useAutoRefreshFlash` | Tracks data diffs on a 30 s interval, produces `flashIds` (yellow) and `deleteFlashIds` (red) Sets |

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
NODE_SERVER_PORT=4001
```

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start both webpack dev server + proxy server concurrently
npm run dev
```

The MFE dev server runs at **http://localhost:3001**. The remote entry is served at `http://localhost:3001/remoteEntry.js`.

When running standalone (not inside the shell), the app renders with its own `bootstrap.tsx` entry point.

---

## Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Both webpack + proxy concurrently             |
| `npm run dev:standalone` | Webpack dev server only (port 3001, no proxy) |
| `npm start`              | Proxy server only (port 4001)                 |
| `npm run build`          | Production build to `dist/`                   |

---

## Full Platform Startup Order

To run the entire MatchDB platform locally, start services in this order:

```
1. matchdb-shell-services   →  port 8000  (auth + payments API)
2. matchdb-jobs-services     →  port 8001  (jobs + profiles API)
3. matchdb-jobs-ui           →  port 3001  (remote MFE) + proxy 4001
4. matchdb-shell-ui          →  port 3000  (host shell) + proxy 4000
```

Then open **http://localhost:3000** in your browser.

---

## License

MIT
