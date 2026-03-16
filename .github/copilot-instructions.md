# MatchDB Jobs UI — Copilot Rules

## Project Overview

This is the **Jobs remote micro-frontend** for the MatchDB staffing platform. It runs on **port 3001** (webpack dev server) + **port 4001** (proxy server). It exposes `./JobsApp` via Webpack 5 Module Federation, which the Shell UI loads dynamically. Contains role-based dashboards for Candidates, Vendors, and Marketers.

**Stack:** React 18, TypeScript, Webpack 5 Module Federation, Redux Toolkit (RTK Query), Tailwind CSS, jsPDF, matchdb-component-library

---

## Scripts

| Command            | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start webpack dev server + proxy concurrently |
| `npm run build`    | Production webpack build                      |
| `npm start`        | Proxy server only                             |
| `npm run lint`     | ESLint check                                  |
| `npm run lint:fix` | ESLint auto-fix                               |

## Running the Application

```powershell
.\start-matchdb.ps1
```

> Start this **before** Shell UI — the shell fetches `remoteEntry.js` from port 3001.

## Committing & Pushing

```powershell
.\push-all.ps1
```

---

## Code Conventions

### File Structure

```
src/
  JobsApp.tsx         # Root component (role-based routing)
  bootstrap.tsx       # Dynamic import entry point
  index.ts            # Webpack entry + Module Federation expose
  api/                # RTK Query API slices (jobsApi.ts)
  components/         # Shared components (DataTable wrappers, modals)
    DBLayout.tsx        # Dashboard layout shell
    DetailModal.tsx     # Job/candidate detail modal
    MatchDataTable.tsx  # Match results table
    PokeEmailModal.tsx  # Email compose modal
    ResumeModal.tsx     # Resume preview/PDF
  hooks/              # Custom hooks (useAutoRefreshFlash, useLiveRefresh)
  pages/              # Dashboard pages per role
    CandidateDashboard.tsx
    VendorDashboard.tsx
    MarketerDashboard.tsx
    PostJobPage.tsx
    PublicJobsView.tsx
  shared/             # Shared utilities, constants
  store/              # Redux store configuration
  styles/             # Global CSS (index.css)
  utils/              # Helper functions (csv, excel, pdf, formatting)
```

### Naming

- Components: `PascalCase.tsx`
- CSS files: Co-located with component (e.g., `DetailModal.css`)
- Hooks: `use{Name}.ts` in `hooks/`
- API slices: `{domain}Api.ts`
- Utilities: `{name}.ts` in `utils/`

### Styling Rules

- **Never use inline `style={{}}` in JSX** — extract to CSS classes
- Import component library CSS globally in bootstrap
- Use CSS custom properties: `var(--w97-blue)`, `var(--w97-green)`, etc.
- Component-specific CSS in co-located `.css` files
- Use `matchdb-` prefix for CSS class names in this repo

### Component Library

- Import all UI primitives from `matchdb-component-library`:
  ```ts
  import {
    Button,
    Input,
    Select,
    DataTable,
    Toolbar,
    Panel,
    Tabs,
    TypePill,
    Alert,
  } from "matchdb-component-library";
  ```

### RTK Query

- Single API slice in `api/jobsApi.ts`
- Endpoints use builder pattern: `builder.query` / `builder.mutation`
- Cache invalidation via tags
- Poke/email tracking via `getPokesSent` / `getPokesReceived`
- Live refresh: SSE + polling via `useAutoRefreshFlash` hook

### Dashboard Pages

- **CandidateDashboard** — matched jobs, pokes, mails, forwarded openings, my-detail
- **VendorDashboard** — posted jobs, candidate profiles, applications
- **MarketerDashboard** — company candidates, financials, projects, immigration, timesheets
- Each dashboard uses URL-driven state via `useSearchParams`

### Module Federation

- This is the **remote** — exposes `./JobsApp`
- Shell is the **host** — consumes this remote
- Dev server on port 3001, proxy on port 4001

---

## Do NOT

- Use inline `style={{}}` — use CSS classes from component library or co-located CSS
- Create new components that duplicate component library exports
- Use `any` type — define proper interfaces in `types/`
- Add non-null assertions (`!`) — use proper type guards or nullish coalescing
- Skip SonarQube rule compliance (no S4325 unnecessary assertions)
- Put business logic in components — extract to hooks or utils
