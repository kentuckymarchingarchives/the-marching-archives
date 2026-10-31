The Marching Archives (TMA)
The Marching Archives is a research-focused archive of competitive marching arts history. It organizes historical competition results, placements, scores, classification information, awards, sources, and statistics, with Kentucky/KMEA as a priority and room for other organizations and regions.
> **Project status:** Active development. The public archive and staff tools are implemented across numerous routes, but production-readiness depends on validating the full database migration chain, role permissions, and build against the current deployment. This README documents the repository structure in the project snapshot reviewed on October 30, 2026, plus known follow-up installation steps.
Stack
Layer	Technology
Web application	Next.js 16.4.3 App Router, React 19, TypeScript
Styling	Tailwind CSS v4
Database and authentication	Supabase (PostgreSQL, Auth, Row Level Security)
Supabase web clients	`@supabase/ssr`, `@supabase/supabase-js`
Deployment	Vercel, connected to GitHub
Brand colors: Navy `#002144`, maroon `#861F41`, white `#FFFFFF`.
Local setup
Requirements: Node.js and npm supported by the project's installed Next.js version, access to the correct Supabase project, and a local clone of this repository.
```powershell
# From the repository root
npm ci
```
Create `.env.local` at the repository root (do not commit it):
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```
Get both values from your Supabase project's API settings. These are the public browser-client credentials; never substitute a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable. The project's actual web client and server client both use these two environment variables. Database operations are subject to Supabase authorization and RLS.
Start locally:
```powershell
npm run dev
```
Open http://localhost:3000. Staff login is at `/staff/login` and the staff dashboard is at `/staff/dashboard`; access requires a valid, active staff record and the appropriate permissions.
Repository map
```text
app/                       Next.js public and staff routes
  staff/                   Staff login, administration, research, verification
    competitions/[id]/     Competition editor, rounds, sources, notes, history
    research/              Assignments, approvals, my work, analytics, history
components/                Shared UI components
lib/                       Validation, archive logic, navigation, Supabase clients
  supabase/client.ts       Browser Supabase client
  supabase/server.ts       Server Supabase client
  supabase/proxy.ts        Supabase session refresh support
public/                    Images and other static assets
supabase/migrations/       SQL schema and feature migrations
proxy.ts                   Next.js request proxy; session and maintenance handling
next.config.ts             Next.js configuration
package.json               Commands and dependencies
```
Public pages include archive exploration, competitions, bands, statistics, records, and other historical views. Staff pages include competition management, source and verification tools, document management, activity logs, research workflows, site sections, and archive controls. Consult the actual `app/` route folders for the authoritative list; routes evolve frequently.
Database setup and migrations
A fresh database cannot be configured by running only the latest migration. The Supabase SQL files in `supabase/migrations/` form a dependency chain. On a new Supabase project, review and apply them in filename order, using a consistent migration process and recording what was applied. Do not rerun arbitrary migrations against production without checking whether they are safe to repeat.
Important research-related migrations in the reviewed snapshot:
Migration	Feature
`20261030_022_research_assignments.sql`	Staff research assignments
`20261030_033_competition_research_tasks.sql`	Assignments tied to competitions
`20261030_034_competition_research_notes.sql`	Private competition research notes
`20261030_035_competition_revision_history.sql`	Competition revision history
`20261030_036_research_approval_workflow.sql`	Submission and approval workflow
Important version note: The uploaded snapshot ends at migration `036`. A later project improvement introduced `20261030_037_research_analytics_counts.sql`, which is required by the database-backed Research Analytics page from Fix #3. Confirm migration 037 is installed and applied, along with any subsequent migrations, before testing the latest analytics page. Do not treat the ZIP snapshot as the definitive current migration inventory.
To apply a migration through the Supabase dashboard: select the correct project, open SQL Editor, carefully inspect the file and dependencies, execute it once, then verify the relevant tables/functions/policies. Record the execution. For ongoing work, a consistent managed migration workflow is preferable to repeatedly pasting SQL manually.
Never use a privileged service-role client in public browser code. Keep RLS enabled for data exposed through Supabase APIs, and protect administrative functions with role checks and restricted grants. Apply security changes to a test project before production when possible.
Staff roles and review workflow
The code uses `staff_members` and checks that the authenticated user is active. Supported roles include `owner`, `admin`, and `editor`. Different tasks have different permissions: for example, research approval decisions are restricted to Owners and Administrators, and a user cannot review their own submission.
Common research pages:
`/staff/research` — assignments
`/staff/research/mine` — assigned research
`/staff/research/approvals` — submit/review assignments
`/staff/research/analytics` — research statistics
`/staff/research/review-history` — approval decisions
Competition-specific tools use `/staff/competitions/[id]/...`, where `[id]` is a competition UUID, including `research`, `notes`, and `history` routes when their feature files are installed.
Research approval is not competition publication or verification. Approval records track review of a research task; they do not automatically alter a result, verify a source, or publish a competition.
Checks before every push
```powershell
npx tsc --noEmit
npm run lint
npm run build
```
For a production-style local smoke test after the build:
```powershell
npm run start
```
Also test the affected routes manually, including empty states and invalid input. For staff changes, test at least the appropriate Owner/Admin/Editor roles, an inactive or unauthorized account, and an anonymous session. For database changes, check both allowed and denied operations using RLS, not only whether a page renders.
The Next.js config enables `cacheComponents: true`. Avoid relying on legacy `export const dynamic = 'force-dynamic'` with Cache Components; follow the project's established request-time rendering patterns and Suspense where necessary. A TypeScript pass alone does not establish production build success.
Deployment
This project is intended to deploy to Vercel from GitHub's `main` branch.
Configure the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the appropriate Vercel environment.
Apply and verify necessary Supabase migrations before deploying application code that relies on new tables or RPC functions.
Test locally, then commit and push to `main` using the established direct-push workflow.
Review the Vercel deployment logs and load public and staff routes afterward.
```powershell
git status
git add README.md
git commit -m "Document TMA development and maintenance"
git push origin main
```
Routine changes can go directly to `main` after local testing. For schema, authorization, or destructive changes, use additional precautions: backup, staging validation, and a reviewed rollback plan. A successful Git push does not by itself guarantee the deployment passed.
Security and data integrity checklist
Keep `.env.local`, secret keys, downloaded credentials, personal data, and private database exports out of Git and shared review ZIPs.
The repository's `.gitignore` ignores `.env*`, `.next`, `node_modules`, and `.vercel`; this is not a substitute for checking all subfolders or the ZIP contents.
Avoid displaying draft/private staff records in public routes.
Confirm that database policies and RPC grants enforce permissions independently of hidden UI buttons.
Retain links to original source materials when recording historical results; log corrections rather than silently rewriting provenance.
Never assume a research-task approval automatically certifies a score or result.
Do not assume an automated backup/recovery solution exists; configure one explicitly if needed.
Troubleshooting
Problem	First checks
Supabase URL/key errors	Confirm `.env.local` names, values and project; restart dev server after changes
`relation does not exist` / missing RPC	Check migration installation and correct Supabase project
Staff login succeeds but page redirects	Confirm active `staff_members` record and the user's role
Public page shows maintenance	Check section-maintenance settings and role-appropriate restoration path
Build failure in server rendering	Check Next.js 16 Cache Components, request-time data, and Suspense boundaries
404 on staff feature	Confirm its route file was copied to the exact `app/` path
New research analytics doesn't load	Confirm migration 037 is present and applied and the replacement analytics page is installed
Vercel deploy is older than local edits	Confirm commit was pushed to the connected branch and deployment completed successfully
Development principles
Prioritize historical accuracy, citations, and traceability over adding more features.
Prefer shared navigation/components to duplicate competing interfaces.
Keep public archive browsing separate from privileged staff actions.
Preserve existing working code when installing new features; review replacements against current files.
Test changed routes, TypeScript, lint, and production build before pushing.
---
Maintainer note: This README describes the reviewed repository structure and the following known fixes through research navigation and analytics. If a later feature changes environment variables, migrations, commands, or staff roles, update this document in the same commit.