# Google Calendar OAuth setup

RecruitAI uses a dedicated backend OAuth connection for Google Calendar. This is separate from Google Sign-In, which continues to use `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` for identity only.

## Google Cloud configuration

1. Create/select a Google Cloud project and enable **Google Calendar API**.
2. Configure the OAuth consent screen, app name, support email, developer contact and audience. Add test user emails while the app is in Testing; publish/complete verification as required for production use.
3. Create an OAuth client of type **Web application**.
4. Add the backend callback URI exactly to Authorized redirect URIs:
   - Local (default backend port): `http://localhost:5000/api/admin/google-calendar/callback`
   - Production: `https://<BACKEND_DOMAIN>/api/admin/google-calendar/callback`
5. No JavaScript origin is required for this backend authorization-code flow. Do not add the frontend URL as the redirect URI.
6. The app requests `https://www.googleapis.com/auth/calendar.events` plus `openid` and `email` to identify the connected account. Calendar event creation requests Google Meet via Calendar `conferenceData`; a separate Meet REST API is not used.

## Backend environment

```env
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_CALLBACK_URL=http://localhost:5000/api/admin/google-calendar/callback
GOOGLE_CALENDAR_CALENDAR_ID=primary
GOOGLE_TOKEN_ENCRYPTION_KEY=<base64-encoded 32-byte random key>
FRONTEND_URL=http://localhost:3000
```

Generate a key independently for each deployment, for example with Node: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it in backend-only secret configuration. Do not configure `GOOGLE_CALENDAR_REFRESH_TOKEN`; refresh tokens are encrypted with AES-256-GCM and stored server-side per admin. Keep these variables distinct from the Google Sign-In variables above.

The callback URL must match `GOOGLE_CALENDAR_CALLBACK_URL` byte-for-byte and be registered in Google Cloud Console. Production must use HTTPS.

## Admin connect/disconnect

A signed-in admin opens **Settings → Google Calendar** and selects Connect. The backend creates a random, short-lived, single-use OAuth state bound to that admin and stores its hash in MongoDB. Google redirects to the backend callback. After validating state and exchanging the authorization code, the backend verifies the granted Calendar credential, encrypts the refresh token and stores connection metadata. Only safe status fields are returned; tokens are never sent to the browser or included in redirects/logs. Reconnect repeats OAuth. Disconnect revokes the token best-effort and deletes the local encrypted credential; existing interview events remain untouched.

Endpoints:

- `GET /api/admin/google-calendar/connect` (admin auth; returns authorization URL)
- `GET /api/admin/google-calendar/callback` (OAuth callback, same admin auth cookie and state validation)
- `GET /api/admin/google-calendar/status` (safe metadata only)
- `POST /api/admin/google-calendar/disconnect`

The callback does not depend on a browser session cookie: Google returns a bearer state that is cryptographically random, hashed in MongoDB, short-lived, and single-use; the record is associated server-side with the admin who initiated the flow. The callback exchanges the code only for that recorded admin and sends no tokens through the redirect.

## Interview booking

The active flow remains `POST /api/student/interview/book` → verified candidate/slot validation → booking/session creation → connected company Calendar lookup → `events.insert` with `conferenceDataVersion=1` and `conferenceData.createRequest` → poll pending conference → save event ID, conference ID, Meet URL and connection owner to both active booking/session records. If Calendar or Meet creation fails, the booking endpoint compensates by removing the newly created booking/session. A Meet URL is returned only when Google actually supplies one. If there is more than one connected admin account, booking fails with `GOOGLE_CALENDAR_CONNECTION_AMBIGUOUS`; configure exactly one connected company Calendar until a deliberate company-calendar selection setting is added.

Calendar/Meet scheduling is not live AI participation: the AI interview voice room remains separate, and the AI does not join Google Meet.

## Storage and operations

The MongoDB `GoogleCalendarConnection` record is per admin and stores account email, calendar ID, scopes, connection timestamps, status and an AES-256-GCM encrypted refresh token (`select: false`). `GoogleCalendarOAuthState` stores only a hash of the random state plus admin and expiry/consumption fields. Back up the encryption key securely alongside the database backup; losing it requires admins to reconnect. Never log tokens or expose OAuth secrets, and rotate OAuth credentials/keys if disclosed.

Automated tests mock `googleapis`; a successful test does not replace configuring a real OAuth client, consent screen and calendar in each environment.
