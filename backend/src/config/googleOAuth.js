/**
 * Google OAuth Configuration
 * 
 * Setup for Google OAuth 2.0 authentication
 * Required for candidate/student authentication via Google
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

/**
 * Initialize Google OAuth strategy
 */
export function initializeGoogleOAuth() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "https://ai-interview-system-eewl.vercel.app/api/auth/google/callback";

  if (!clientID || !clientSecret) {
    console.warn("⚠️  Google OAuth credentials not configured. Google authentication will be disabled.");
    console.warn("   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable.");
    return false;
  }

  console.log("✅ Google OAuth configured");
  console.log(`   Callback URL: ${callbackURL}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ["profile", "email"],
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user information from Google profile
          const user = {
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            picture: profile.photos?.[0]?.value,
            accessToken,
            refreshToken,
          };

          // Here you would typically:
          // 1. Check if user exists in your database
          // 2. Create new user if not exists
          // 3. Update existing user with new tokens
          // 4. Return user object

          return done(null, user);
        } catch (error) {
          console.error("Google OAuth error:", error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  return true;
}

/**
 * Get Google OAuth configuration
 */
export function getGoogleOAuthConfig() {
  return {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://ai-interview-system-eewl.vercel.app/api/auth/google/callback",
    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export default {
  initializeGoogleOAuth,
  getGoogleOAuthConfig,
};