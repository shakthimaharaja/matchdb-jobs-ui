# matchdb-jobs-ui

Remote microfrontend for the MatchDB staffing platform. Exposes the Jobs application module (`./JobsApp`) via Webpack 5 Module Federation and is consumed by the shell host at runtime.

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Runtime      | React 18 + TypeScript                                 |
| Bundler      | Webpack 5 (Module Federation — remote: `matchdbJobs`) |
| State        | Redux Toolkit (`jobsSlice`)                           |
| Routing      | React Router v6                                       |
| UI Libraries | MUI 5, PrimeReact 10, Tailwind CSS 3                  |
| HTTP         | Axios                                                 |
| Proxy Server | Express + http-proxy-middleware (port 4001)           |
| Theme        | Inherits Windows 97 theme from the shell              |

## Project Structure

```
matchdb-jobs-ui/
├── public/
│   └── index.html               # HTML template (standalone fallback)
├── server/
│   ├── index.ts                 # Express proxy server (port 4001)
│   └── index.js                 # Compiled proxy (fallback)
├── src/
│   ├── index.ts                 # Webpack entry point
│   ├── bootstrap.tsx            # React root render (standalone mode)
│   ├── JobsApp.tsx              # ★ Exposed MFE component — routing entry
│   ├── components/
│   │   ├── DBLayout.tsx         # phpMyAdmin-style panel with subnav events
│   │   ├── DBLayout.css         # Panel styling
│   │   ├── MatchDataTable.tsx   # Data table with sort, checkbox, poke
│   │   └── MatchDataTable.css   # Table styling
│   ├── pages/
│   │   ├── PublicLanding.tsx    # Pre-login view — single table + title-bar auth
│   │   ├── PublicLanding.css    # Public landing styling
│   │   ├── CandidateDashboard.tsx  # Candidate view — profile, jobs, applications
│   │   ├── VendorDashboard.tsx     # Vendor view — post jobs, browse candidates
│   │   ├── CandidateProfile.tsx    # Candidate profile edit form
│   │   ├── PostJobPage.tsx         # Vendor job posting form
│   │   └── LegacyForms.css        # Form styling shared between pages
│   └── store/
│       ├── index.ts             # Redux store config
│       └── jobsSlice.ts         # Jobs state, CRUD thunks
├── env/
│   └── .env.development         # Local env vars
├── webpack.config.js            # Webpack + Module Federation config
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── tsconfig.json
```

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

## Routing (JobsApp.tsx)

| Condition                  | Component Rendered   |
| -------------------------- | -------------------- |
| Not logged in              | `PublicLanding`      |
| Logged in as **candidate** | `CandidateDashboard` |
| Logged in as **vendor**    | `VendorDashboard`    |

## Inter-MFE Events (CustomEvent)

| Event Name              | Direction    | Purpose                                       |
| ----------------------- | ------------ | --------------------------------------------- |
| `matchdb:subnav`        | Jobs → Shell | Send subnav groups to shell sidebar           |
| `matchdb:openLogin`     | Jobs → Shell | Request login modal from shell                |
| `matchdb:jobTypeFilter` | Shell → Jobs | Filter jobs by type in dashboards             |
| `matchdb:loginContext`  | Shell → Jobs | Tell PublicLanding which login type is active |

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- `matchdb-jobs-services` running on port 8001 (backend API)
- `matchdb-shell-ui` running on port 3000 (to load this remote inside the shell)

## Environment Variables

Create `env/.env.development`:

```env
JOBS_SERVICES_URL=http://localhost:8001
NODE_SERVER_PORT=4001
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the proxy server (port 4001)
npm run server

# 3. Start webpack dev server (port 3001) — in a second terminal
npm start

# Or run both concurrently:
npm run dev
```

The MFE dev server runs at **http://localhost:3001**. The remote entry is served at `http://localhost:3001/remoteEntry.js`.

When running standalone (not inside the shell), the app renders with its own `bootstrap.tsx` entry point.

## Available Scripts

| Script           | Description                       |
| ---------------- | --------------------------------- |
| `npm start`      | Webpack dev server on port 3001   |
| `npm run server` | Express proxy server on port 4001 |
| `npm run dev`    | Both webpack + proxy concurrently |
| `npm run build`  | Production build to `dist/`       |

## Full Platform Startup Order

To run the entire MatchDB platform locally, start services in this order:

```
1. matchdb-shell-services   →  port 8000  (auth + payments API)
2. matchdb-jobs-services     →  port 8001  (jobs + profiles API)
3. matchdb-jobs-ui           →  port 3001  (remote MFE) + proxy 4001
4. matchdb-shell-ui          →  port 3000  (host shell) + proxy 4000
```

Then open **http://localhost:3000** in your browser.
