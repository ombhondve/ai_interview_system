const { safeMessage } = require("../../interview/interview.booking.integration.js");
const {
  isPlaceholderToken,
  hasValidEnvCalendarConfig,
} = require("../../calendar/googleCalendar.connection.service.js");

describe("Interview Booking & Google Calendar Integration Regressions", () => {
  describe("Token validation & placeholder detection", () => {
    test("detects placeholder refresh tokens", () => {
      expect(isPlaceholderToken("your-refresh-token")).toBe(true);
      expect(isPlaceholderToken("your-google-refresh-token")).toBe(true);
      expect(isPlaceholderToken("example_token_dummy")).toBe(true);
      expect(isPlaceholderToken("test-token-123")).toBe(true);
      expect(isPlaceholderToken("short")).toBe(true);
      expect(isPlaceholderToken("")).toBe(true);
      expect(isPlaceholderToken(null)).toBe(true);
      expect(isPlaceholderToken(undefined)).toBe(true);
    });

    test("accepts realistic refresh tokens", () => {
      expect(isPlaceholderToken("1//04abcdefghijklmnopqrstuvwxyz_0123456789ABCDEF")).toBe(false);
    });
  });

  describe("Safe Error Message Mapping (safeMessage)", () => {
    test("maps invalid_grant / revoked token to clear auth expired message", () => {
      const msg = safeMessage({ code: "invalid_grant" });
      expect(msg).toContain("authorization has expired or is invalid");
      expect(msg).toContain("reconnect");

      const msgAuthFailed = safeMessage({ code: "GOOGLE_CALENDAR_AUTH_FAILED" });
      expect(msgAuthFailed).toContain("authorization has expired or is invalid");

      const msg401 = safeMessage({ status: 401 });
      expect(msg401).toContain("authorization has expired or is invalid");
    });

    test("maps unconfigured calendar to clean availability message", () => {
      const msg = safeMessage({ code: "GOOGLE_CALENDAR_NOT_CONNECTED" });
      expect(msg).toContain("calendar has not been connected");

      const msgNotConfig = safeMessage({ code: "GOOGLE_CALENDAR_NOT_CONFIGURED" });
      expect(msgNotConfig).toContain("has not been configured");
    });

    test("maps ambiguous calendar connection", () => {
      const msg = safeMessage({ code: "GOOGLE_CALENDAR_CONNECTION_AMBIGUOUS" });
      expect(msg).toContain("Multiple company calendars are connected");
    });

    test("maps forbidden permissions (403)", () => {
      const msg = safeMessage({ status: 403 });
      expect(msg).toContain("sufficient permissions");
    });

    test("maps rate limiting (429)", () => {
      const msg = safeMessage({ status: 429 });
      expect(msg).toContain("temporarily rate limited");
    });

    test("maps missing Meet link (MEET_LINK_UNAVAILABLE)", () => {
      const msg = safeMessage({ code: "MEET_LINK_UNAVAILABLE" });
      expect(msg).toContain("Google Meet link could not be generated");
    });

    test("maps Google Calendar service outage (503)", () => {
      const msg = safeMessage({ status: 503 });
      expect(msg).toContain("temporarily unavailable");
    });

    test("never leaks raw secrets, stacks, or tokens in safe message", () => {
      const msg = safeMessage({
        code: "invalid_grant",
        refreshToken: "secret_token_12345",
        clientSecret: "secret_client_xyz",
      });
      expect(msg).not.toContain("secret_token");
      expect(msg).not.toContain("secret_client");
    });
  });

  describe("Environment Variable Support", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("hasValidEnvCalendarConfig returns true only with full non-placeholder vars", () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = "valid-client-id.apps.googleusercontent.com";
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "valid-secret";
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "1//04validRealRefreshToken1234567890ABCDEF";

      expect(hasValidEnvCalendarConfig()).toBe(true);

      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "your-google-refresh-token";
      expect(hasValidEnvCalendarConfig()).toBe(false);

      delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
      expect(hasValidEnvCalendarConfig()).toBe(false);
    });
  });
});
