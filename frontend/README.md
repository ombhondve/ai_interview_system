# RecruitAI Frontend

A cleaned and consolidated Next.js recruitment frontend with a small local demo API so the complete UI flow can be exercised without a separate backend.

## What was fixed

- One admin dashboard route (`/admin`); `/admin/dashboard` redirects to it.
- One interview-slot system (`/admin/schedule`); `/admin/slots` redirects to it.
- Removed duplicate in-page team management from Settings.
- Candidate search/filter/approve/reject flow is API-backed.
- Approval generates a secure, expiring student invitation token and a WhatsApp compose link.
- Student verification uses a short-lived, attempt-limited OTP and HttpOnly student cookie.
- Student flow includes status, slot booking, interview submission, project submission and result.
- Interview decisions persist through the demo API and create audit events.
- Reports, analytics, notifications, audit log, team and batches use API data instead of hardcoded page state.
- Admin pages are server-protected by the demo session cookie.
- Auth token is not stored in localStorage.
- Removed automatic fallback from failed API requests to fake data.
- Added security response headers.
- Fixed Select wrapper sizing so horizontal filters work correctly.
- Added `.gitignore` and removed build/dependency artifacts from the deliverable.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Development demo credentials:

- Email: `admin@example.com`
- Password: `Admin@123`

Set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` to change them.

## External backend

Set `NEXT_PUBLIC_API_URL` to the backend API base URL. The client services are structured around `/candidates`, `/interviews`, `/slots`, `/projects`, `/reports`, `/analytics`, `/notifications`, `/audit-log`, `/team`, `/batches`, `/verification/*`, and `/student/*` resources.

For production, use a real backend for authentication, database persistence, RBAC, OTP delivery, WhatsApp/email delivery, file storage, rate limiting and audit-log persistence. The local demo API is intended for development/testing and stores state in server memory.

## Verification performed

- TypeScript: `npx tsc --noEmit` — passed.
- ESLint: `npm run lint` — passed with no warnings/errors.
- Import-resolution scan: passed.
- Production `next build` could not be completed in the audit container because the supplied dependency tree does not contain the Linux SWC binary and the container cannot download packages from npm. This is an environment limitation, not a TypeScript/ESLint error.



1 install this - npm install jose