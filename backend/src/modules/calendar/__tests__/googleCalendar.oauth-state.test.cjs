const crypto = require("node:crypto");

const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../googleCalendar.connection.service.js");

describe("Google Calendar OAuth state and token exchange", () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "calendar-client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "calendar-client-secret";
    process.env.GOOGLE_CALENDAR_CALLBACK_URL = "http://localhost:5000/api/admin/google-calendar/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  });

  test("uses cryptographically random state and requests offline Calendar access", () => {
    const source = require("node:fs").readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/randomBytes\(32\)\.toString\("base64url"\)/);
    expect(source).toMatch(/access_type: "offline"/);
    expect(source).toMatch(/GOOGLE_CALENDAR_SCOPE, "openid", "email"/);
  });

  test("state consume logic is an atomic expiry/single-use database query and returns the stored admin owner", () => {
    const source = require("node:fs").readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/findOneAndUpdate\([\s\S]*stateHash,[\s\S]*consumedAt: null,[\s\S]*expiresAt: \{ \$gt: new Date\(\) \}/);
    expect(source).toMatch(/return record \? \{ adminId: record\.adminId \} : null/);
  });

  test("refresh tokens are encrypted before persistence and omitted from status selection", () => {
    const source = require("node:fs").readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/encryptedRefreshToken: encryptGoogleToken\(tokens\.refresh_token\)/);
    expect(source).toMatch(/select\("-refreshTokenEncrypted"\)/);
    expect(source).toMatch(/\$unset: \{ refreshTokenEncrypted: 1 \}/);
  });
});
