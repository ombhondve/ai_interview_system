# Google Calendar Integration Setup Guide

## Overview
This guide explains how to set up Google Calendar API integration for the AI Interview System. This allows students to automatically create Google Calendar events for their scheduled interviews, including Google Meet links.

## Prerequisites
1. Google Cloud Console account
2. A Google account with Calendar API access
3. Backend server running (local or deployed)

## Setup Steps

### Step 1: Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Library**
4. Search for "Google Calendar API"
5. Click **Enable**

### Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Configure OAuth consent screen:
   - Application type: **Web application**
   - Name: `AI Interview System Calendar`
   - User support email: Your email
   - Developer contact information: Your email
   - Scopes to add:
     - `https://www.googleapis.com/auth/calendar` (Full calendar access)
     - `https://www.googleapis.com/auth/calendar.events` (Manage events)

4. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: `AI Interview Calendar Integration`
   - Authorized redirect URIs (for refresh token generation):
     - `http://localhost:5000/api/calendar/callback` (development)
     - `https://your-backend.vercel.app/api/calendar/callback` (production)
     - `http://localhost:3000` (for OAuth playground)
   - Click **Create**

5. Save the **Client ID** and **Client Secret**

### Step 3: Generate Refresh Token

Since this is a server-to-server integration (no user interaction), we need a refresh token:

#### Method A: Using OAuth 2.0 Playground (Recommended)
1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the gear icon (⚙️) in top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1: Select and authorize APIs
   - Enter `https://www.googleapis.com/auth/calendar`
   - Click "Authorize APIs"
   - Grant permission to your Google account
6. In Step 2: Exchange authorization code for tokens
   - Click "Exchange authorization code for tokens"
   - You'll get an **access token** and **refresh token**
7. Copy the **refresh token** (save it securely)

#### Method B: Programmatic Approach
1. Create an authorization URL:
   ```
   https://accounts.google.com/o/oauth2/auth?
   client_id=YOUR_CLIENT_ID&
   redirect_uri=http://localhost:3000&
   scope=https://www.googleapis.com/auth/calendar&
   access_type=offline&
   response_type=code
   ```

2. Open the URL in browser, authorize, get the code from redirect URL
3. Exchange code for refresh token:
   ```bash
   curl \
   --request POST \
   --data "code=CODE_FROM_REDIRECT&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=http://localhost:3000&grant_type=authorization_code" \
   https://oauth2.googleapis.com/token
   ```

### Step 4: Get Calendar ID

1. Go to [Google Calendar](https://calendar.google.com/)
2. Click the gear icon → Settings
3. Find your calendar under "Settings for my calendars"
4. Click your calendar name
5. Find "Calendar ID" section
6. Copy the calendar ID (usually your email or a special ID)

### Step 5: Configure Environment Variables

Add these to your `.env` file:

```env
# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token
GOOGLE_CALENDAR_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

For development, add to `backend/.env`:
```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token
GOOGLE_CALENDAR_CALENDAR_ID=primary  # or your specific calendar ID
```

### Step 6: Test the Integration

#### Test 1: Connection Test (Admin Only)
```bash
# Start the backend
cd backend
npm run dev

# Test API endpoint (requires admin authentication)
GET /api/calendar/test-connection
```

Expected response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Google Calendar connection successful",
    "calendarId": "primary",
    "calendarSummary": "Your Calendar",
    "timeZone": "America/Los_Angeles",
    "accessRole": "owner"
  }
}
```

#### Test 2: Create Calendar Event
1. Schedule an interview through the system
2. As a student, call:
   ```
   POST /api/calendar/interview/{interviewId}/create-event
   ```

### Step 7: API Endpoints for Students

Students can use these endpoints:

#### 1. Create Calendar Event
```http
POST /api/calendar/interview/{interviewId}/create-event
Authorization: Bearer {student_jwt_token}
```

Response:
```json
{
  "success": true,
  "message": "Calendar event created successfully",
  "data": {
    "interviewId": "65f8a7b3c1d9e4a5b6c7d8e9",
    "eventId": "abc123def456",
    "eventLink": "https://calendar.google.com/event?eid=abc123",
    "meetLink": "https://meet.google.com/abc-def-ghi",
    "htmlLink": "https://www.google.com/calendar/event?eid=abc123",
    "startTime": "2024-12-01T10:00:00.000Z",
    "endTime": "2024-12-01T10:30:00.000Z"
  }
}
```

#### 2. Get Event Status
```http
GET /api/calendar/interview/{interviewId}/event-status
Authorization: Bearer {student_jwt_token}
```

#### 3. Update Event (Reschedule)
```http
PUT /api/calendar/interview/{interviewId}/update-event
Authorization: Bearer {student_jwt_token}
Content-Type: application/json

{
  "newSlotId": "65f8a7b3c1d9e4a5b6c7d8e0"
}
```

#### 4. Delete Event (Cancel)
```http
DELETE /api/calendar/interview/{interviewId}/delete-event
Authorization: Bearer {student_jwt_token}
Content-Type: application/json

{
  "reason": "Interview cancelled by student"
}
```

#### 5. List Student's Calendar Events
```http
GET /api/calendar/student/events
Authorization: Bearer {student_jwt_token}
```

### Step 8: Integration with Interview Flow

The system automatically:
1. Creates calendar event when interview is scheduled
2. Updates event when interview is rescheduled
3. Deletes event when interview is cancelled
4. Includes Google Meet link automatically

### Step 9: Security Considerations

1. **Service Account vs OAuth**: We use OAuth with refresh token for simplicity
2. **Calendar Permissions**: The service account needs full calendar access
3. **Refresh Token Security**: Keep refresh token secure in environment variables
4. **Scope Limitation**: Only calendar scope is requested
5. **Audit Logging**: All calendar operations are logged

### Step 10: Production Deployment

#### Vercel Configuration:
1. Set environment variables:
   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `GOOGLE_CALENDAR_REFRESH_TOKEN`
   - `GOOGLE_CALENDAR_CALENDAR_ID`

2. Update redirect URI in Google Cloud Console:
   - Add: `https://your-backend.vercel.app/api/calendar/callback`

3. Use dedicated calendar:
   - Create a new calendar in Google Calendar
   - Share it with the service account email
   - Use that calendar ID for `GOOGLE_CALENDAR_CALENDAR_ID`

### Step 11: Troubleshooting

#### Common Issues:

1. **"Invalid credentials"**
   - Check Client ID and Client Secret
   - Verify refresh token is valid
   - Regenerate refresh token if needed

2. **"Calendar not found"**
   - Verify calendar ID is correct
   - Check service account has access to calendar
   - Use "primary" for user's primary calendar

3. **"Insufficient permissions"**
   - Verify OAuth consent screen is configured
   - Check scopes are properly set
   - Re-authorize with full calendar scope

4. **Refresh token expired**
   - Generate new refresh token
   - Update environment variable
   - Tokens expire after 7 days of inactivity (unless set to offline)

#### Testing Without Real Credentials:
The system will work without Google Calendar credentials but will show warnings and calendar functions will be disabled.

### Step 12: Development Workflow

For development, you can:
1. Use mock calendar service (already implemented fallback)
2. Use test Google account
3. Use "primary" as calendar ID for personal testing

### Step 13: Files Created

```
backend/
├── src/services/googleCalendar.service.js    # Calendar service implementation
├── src/modules/calendar/calendar.routes.js   # Calendar API routes
├── src/modules/calendar/index.js            # Calendar module exports
└── src/app.js                               # Added calendar routes
```

### Step 14: Quick Start Commands

```bash
# 1. Start backend with calendar support
cd backend
npm run dev

# 2. Test calendar connection (admin only)
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:5000/api/calendar/test-connection

# 3. Create calendar event for interview
curl -X POST -H "Authorization: Bearer STUDENT_TOKEN" http://localhost:5000/api/calendar/interview/INTERVIEW_ID/create-event
```

## Support

For issues:
1. Check Google Cloud Console configuration
2. Verify OAuth credentials and scopes
3. Test with OAuth Playground first
4. Check backend logs for detailed errors
5. Verify environment variables are properly set

---

**Last Updated**: September 30, 2026  
**Version**: 1.0