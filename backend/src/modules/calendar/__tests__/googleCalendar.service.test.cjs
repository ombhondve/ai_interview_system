
const path = require("node:path");

describe("Google Calendar service wiring", () => {
  const sourcePath = path.resolve(__dirname, "../../../services/googleCalendar.service.js");
  test("creates Meet through Calendar event insert and waits for pending conference", () => {
    const source = require("node:fs").readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/conferenceDataVersion: 1/);
    expect(source).toMatch(/conferenceData:\s*\{\s*createRequest:/);
    expect(source).toMatch(/conferenceSolutionKey: \{ type: 'hangoutsMeet' \}/);
    expect(source).toMatch(/events\.insert/);
    expect(source).toMatch(/conferenceStatus === "pending"/);
    expect(source).toMatch(/conferenceId: eventData\.conferenceData\?\.conferenceId/);
  });

  test("Calendar operations resolve per-admin credentials rather than relying on global mutable client", () => {
    const source = require("node:fs").readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/async getCalendarContext\(adminId\)/);
    expect(source).toMatch(/GoogleCalendarConnection\.findOne\(\{ adminId: key, status: 'connected' \}\)/);
    expect(source).toMatch(/const context = await this\.getCalendarContext\(interview\.adminId\)/);
  });
});
