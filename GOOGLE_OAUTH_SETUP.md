# Google OAuth Authentication Setup

## Overview
This guide explains how to set up Google OAuth authentication for your AI Interview System. The system now supports Google OAuth 2.0 for candidate/student authentication.

## Setup Steps

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen (if not already done):
   - Application type: **Web application**
   - Name: `AI Interview System`
   - Authorized domains: `your-domain.com` (and `localhost` for development)
   - Save and continue

6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: `AI Interview System Backend`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://your-frontend.vercel.app` (production)
   - Authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback` (development)
     - `https://YOUR-BACKEND.vercel.app/api/auth/google/callback` (production)

7. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to your `.env` file (development) or Vercel environment variables (production):

```env
# Google OAuth Authentication
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=https://YOUR-BACKEND.vercel.app/api/auth/google/callback
```

### 3. Install Dependencies

The required packages have been added to `package.json`:
```json
"passport": "^0.7.0",
"passport-google-oauth20": "^2.0.0",
"express-session": "^1.18.0"
```

Install them:
```bash
cd backend
npm install
```

### 4. API Endpoints

#### Google OAuth Flow:
1. **Initiate Login**: `GET /api/auth/google`
   - Redirects to Google login page
   - User authenticates with Google

2. **Callback**: `GET /api/auth/google/callback`
   - Google redirects here after authentication
   - Processes user data
   - Returns JWT token or redirects to frontend

#### Example Flow:
```
Frontend → /api/auth/google → Google Login → /api/auth/google/callback → Frontend with token
```

### 5. Testing Google OAuth

#### Development Testing:
1. Start backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Test Google OAuth initiation:
   ```
   GET http://localhost:5000/api/auth/google
   ```

3. For production testing, you'll need:
   - Valid Google OAuth credentials
   - Proper callback URL configured in Google Cloud Console

#### Quick Test (without real credentials):
The system will work in "demo mode" without Google credentials but will show warnings.

### 6. Frontend Integration

#### React/Next.js Example:
```javascript
// Redirect to Google OAuth
const loginWithGoogle = () => {
  window.location.href = `${API_BASE_URL}/api/auth/google`;
};

// Handle callback (frontend route)
// Example: /auth/callback page
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    // Store token and redirect
    localStorage.setItem('auth_token', token);
    router.push('/dashboard');
  }
}, []);
```

#### Cookie-based Authentication:
After successful Google OAuth, the backend sets:
- JWT token in cookie: `recruitai_user`
- Token valid for 8 hours

### 7. Production Deployment

#### Vercel Configuration:
1. Set environment variables in Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET` 
   - `GOOGLE_CALLBACK_URL`

2. Update callback URL in Google Cloud Console:
   ```
   https://your-backend-api.vercel.app/api/auth/google/callback
   ```

3. Update frontend URL in CORS configuration:
   ```javascript
   // In backend CORS config
   FRONTEND_URL=https://your-frontend-app.vercel.app
   ```

### 8. User Data Flow

When a user authenticates with Google:

1. Google returns user profile (email, name, picture)
2. Backend creates/updates user in database (to be implemented)
3. JWT token generated with user info
4. Token returned to frontend via cookie or redirect

### 9. Security Considerations

1. **HTTPS Required**: OAuth requires HTTPS in production
2. **State Parameter**: Passport automatically handles CSRF protection
3. **Token Storage**: JWT tokens stored in httpOnly cookies
4. **Session Management**: Express-session with secure cookies
5. **Scope Limitation**: Only requesting `profile` and `email` scopes

### 10. Troubleshooting

#### Common Issues:

1. **"Invalid redirect_uri"**
   - Check Google Cloud Console redirect URIs
   - Ensure exact match with `GOOGLE_CALLBACK_URL`

2. **CORS Errors**
   - Verify frontend URL in CORS configuration
   - Check `FRONTEND_URL` environment variable

3. **Session Not Persisting**
   - Check cookie settings (secure, httpOnly)
   - Verify session secret is set

4. **Development vs Production**
   - Use `localhost` URLs for development
   - Use production domains for deployment

#### Debug Mode:
Set environment variable for verbose logging:
```env
DEBUG=passport*
```

### 11. Next Steps

To complete Google OAuth integration:

1. **Database Integration**: Store/fetch users in MongoDB
2. **User Registration Flow**: Handle new vs returning users
3. **Profile Completion**: Additional profile setup after OAuth
4. **Multiple Providers**: Add GitHub, LinkedIn OAuth options
5. **Email Verification**: Optional email verification

### 12. Files Created

```
backend/
├── src/config/googleOAuth.js          # Google OAuth configuration
├── src/modules/auth/auth.controller.js # Updated with Google callback
├── src/modules/auth/auth.routes.js    # Updated with Google routes
├── src/app.js                         # Added passport/session middleware
├── .env.production.example            # Updated with Google OAuth vars
└── package.json                       # Added passport dependencies
```

### 13. Testing the Setup

Run the backend and verify:
```bash
cd backend
npm run dev
```

Check console output for:
```
✅ Google OAuth configured
   Callback URL: https://YOUR-BACKEND.vercel.app/api/auth/google/callback
```

If credentials are not set, you'll see:
```
⚠️  Google OAuth credentials not configured. Google authentication will be disabled.
```

## Support

For issues:
1. Check Google Cloud Console configuration
2. Verify environment variables
3. Check CORS and redirect URIs
4. Review console logs for errors

---

**Last Updated**: September 30, 2026  
**Version**: 1.0