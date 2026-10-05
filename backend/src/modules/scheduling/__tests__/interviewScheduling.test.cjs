"use strict";

/**
 * Unit tests for the interview scheduling system.
 *
 * These cover the pure, deterministic logic:
 *   - timezone-correct time generation
 *   - booking-window validation
 *   - interview eligibility from the PERSISTED verification state
 *   - the database-level double-booking guarantees declared on the model
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPattern=interviewScheduling
 */

const {
  zonedWallClockToUtc,
  getWeekdayForDate,
  isValidDateString,
  addDaysToDateString,
  generateInterviewTimesForDate,
  listSchedulableDates,
  validateStartInstant,
  todayInTimezone,
} = require("../interviewConfig.service.js");

const {
  canBookInterviewSlot,
  isProjectVerified,
  getIneligibilityReason,
} = require("../../projects/deadline.service.js");

const {
  isInterviewEligible,
  deriveVerificationState,
  getPersistedRejectionReason,
  getPersistedReviewReason,
  getReviewCause,
} = require("../../projects/verificationState.js");

const InterviewBooking = require("../interviewBooking.model.js").default;

const TZ = "Asia/Kolkata";

const config = {
  timezone: TZ,
  interviewDurationMinutes: 30,
  workingHours: { startHour: 9, endHour: 18 },
  allowedWeekdays: [1, 2, 3, 4, 5],
  schedulingHorizonDays: 30,
  minLeadHours: 2,
  mode: "online",
  location: "Online",
};

const VERIFIED_CANDIDATE = {
  _id: "candidate-1",
  status: "approved",
  projectSubmissionStatus: "verified",
  projectSubmission: {
    url: "https://github.com/student/repo",
    aiVerificationStatus: "verified",
    aiVerificationResult: { verificationStatus: "VERIFIED" },
  },
};

describe("interviewConfig.service", () => {
  describe("isValidDateString", () => {
    test("accepts a real date", () => {
      expect(isValidDateString("2026-10-08")).toBe(true);
    });

    test("rejects malformed input", () => {
      expect(isValidDateString("08-10-2026")).toBe(false);
      expect(isValidDateString("2026/10/08")).toBe(false);
      expect(isValidDateString("")).toBe(false);
      expect(isValidDateString(undefined)).toBe(false);
    });

    test("rejects impossible dates", () => {
      expect(isValidDateString("2026-02-30")).toBe(false);
      expect(isValidDateString("2026-13-01")).toBe(false);
    });
  });

  describe("zonedWallClockToUtc", () => {
    test("converts IST wall clock to the correct UTC instant", () => {
      // 09:00 IST (+05:30) === 03:30 UTC
      expect(
        zonedWallClockToUtc("2026-10-08", 9, 0, TZ).toISOString()
      ).toBe("2026-10-08T03:30:00.000Z");
    });

    test("10:30 IST === 05:00 UTC", () => {
      expect(
        zonedWallClockToUtc("2026-10-08", 10, 30, TZ).toISOString()
      ).toBe("2026-10-08T05:00:00.000Z");
    });

    test("handles midnight correctly (date does not shift)", () => {
      expect(
        zonedWallClockToUtc("2026-10-08", 0, 0, TZ).toISOString()
      ).toBe("2026-10-07T18:30:00.000Z");
    });

    test("round trips through the timezone", () => {
      const utc = zonedWallClockToUtc("2026-10-08", 14, 15, TZ);

      expect(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(utc)
          .replace(",", "")
      ).toBe("2026-10-08 14:15");
    });

    test("is correct for a DST timezone (America/New_York, summer)", () => {
      // 09:00 EDT (-04:00) === 13:00 UTC
      expect(
        zonedWallClockToUtc("2026-07-15", 9, 0, "America/New_York").toISOString()
      ).toBe("2026-07-15T13:00:00.000Z");
    });
  });

  describe("getWeekdayForDate", () => {
    test("identifies weekdays", () => {
      expect(getWeekdayForDate("2026-10-08", TZ)).toBe(4); // Thursday
      expect(getWeekdayForDate("2026-10-09", TZ)).toBe(5); // Friday
    });

    test("identifies the weekend", () => {
      expect(getWeekdayForDate("2026-10-10", TZ)).toBe(6); // Saturday
      expect(getWeekdayForDate("2026-10-11", TZ)).toBe(0); // Sunday
    });
  });

  describe("addDaysToDateString", () => {
    test("rolls over month and year boundaries", () => {
      expect(addDaysToDateString("2026-10-31", 1)).toBe("2026-11-01");
      expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    });
  });
});

describe("interview time generation", () => {
  // 2026-10-08 is a Thursday (an allowed weekday).
  const DATE = "2026-10-08";

  describe("generateInterviewTimesForDate", () => {
    test("generates times on the configured grid", () => {
      const times = generateInterviewTimesForDate(config, DATE);

      // 09:00 -> 17:30 start, every 30 min = 18 slots
      expect(times).toHaveLength(18);
      expect(times[0].startAt.toISOString()).toBe("2026-10-08T03:30:00.000Z");
      expect(times[1].startAt.toISOString()).toBe("2026-10-08T04:00:00.000Z");
      expect(times[2].startAt.toISOString()).toBe("2026-10-08T04:30:00.000Z");
    });

    test("TEST 3/5: every slot spans exactly the configured duration", () => {
      generateInterviewTimesForDate(config, DATE).forEach(({ startAt, endAt }) => {
        expect(endAt.getTime() - startAt.getTime()).toBe(30 * 60 * 1000);
      });
    });

    test("no slot starts outside working hours", () => {
      generateInterviewTimesForDate(config, DATE).forEach(({ startAt }) => {
        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: TZ,
            hour: "2-digit",
            hour12: false,
          }).format(startAt)
        );
        expect(hour).toBeGreaterThanOrEqual(9);
        expect(hour).toBeLessThan(18);
      });
    });

    test("last slot still ends within the working day", () => {
      const times = generateInterviewTimesForDate(config, DATE);
      const last = times[times.length - 1];

      const endTime = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(last.endAt);

      expect(endTime).toBe("18:00");
    });

    test("returns nothing for a disallowed day (weekend)", () => {
      expect(generateInterviewTimesForDate(config, "2026-10-10")).toEqual([]);
    });

    test("returns nothing for an invalid date", () => {
      expect(generateInterviewTimesForDate(config, "nope")).toEqual([]);
    });

    test("respects a 45 minute duration", () => {
      const slots = generateInterviewTimesForDate(
        { ...config, interviewDurationMinutes: 45 },
        DATE
      );

      slots.forEach(({ startAt, endAt }) => {
        expect(endAt.getTime() - startAt.getTime()).toBe(45 * 60 * 1000);
      });
      expect(slots[0].startAt.toISOString()).toBe("2026-10-08T03:30:00.000Z");
      expect(slots[1].startAt.toISOString()).toBe("2026-10-08T04:15:00.000Z");
    });
  });

  describe("listSchedulableDates", () => {
    test("only lists allowed weekdays within the horizon", () => {
      const dates = listSchedulableDates({ ...config, schedulingHorizonDays: 20 });

      expect(dates.length).toBeGreaterThan(0);
      expect(dates.length).toBeLessThanOrEqual(21);

      dates.forEach((date) => {
        expect([1, 2, 3, 4, 5]).toContain(getWeekdayForDate(date, TZ));
      });
    });
  });

  describe("validateStartInstant", () => {
    const target = zonedWallClockToUtc("2026-10-08", 10, 30, TZ);
    const earlyNow = new Date("2026-10-01T00:00:00.000Z");

    test("accepts a genuinely generated time", () => {
      const result = validateStartInstant(config, target, earlyNow);

      expect(result.valid).toBe(true);
      expect(result.endAt.toISOString()).toBe("2026-10-08T05:30:00.000Z");
    });

    test("TEST 14a: rejects an invalid Date", () => {
      const result = validateStartInstant(config, new Date("nonsense"), earlyNow);

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_START_AT");
    });

    test("TEST 14b: rejects an off-grid time", () => {
      const odd = zonedWallClockToUtc("2026-10-08", 9, 7, TZ);
      const result = validateStartInstant(config, odd, earlyNow);

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_INTERVIEW_TIME");
    });

    test("TEST 14c: rejects a time outside working hours", () => {
      const early = zonedWallClockToUtc("2026-10-08", 6, 0, TZ);
      const result = validateStartInstant(config, early, earlyNow);

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_INTERVIEW_TIME");
    });

    test("TEST 14d: rejects a weekend date", () => {
      const saturday = zonedWallClockToUtc("2026-10-10", 10, 0, TZ);
      const result = validateStartInstant(config, saturday, earlyNow);

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_INTERVIEW_TIME");
    });

    test("rejects a time in the past", () => {
      const result = validateStartInstant(
        config,
        target,
        new Date("2026-10-08T06:00:00.000Z")
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INTERVIEW_TIME_IN_PAST");
    });

    test("rejects a booking inside the minimum lead time", () => {
      const result = validateStartInstant(
        config,
        target,
        new Date(target.getTime() - 30 * 60 * 1000)
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INSUFFICIENT_LEAD_TIME");
    });

    test("rejects a date beyond the scheduling horizon", () => {
      const far = zonedWallClockToUtc(todayInTimezone(TZ), 10, 0, TZ);
      far.setUTCDate(far.getUTCDate() + 400);

      const result = validateStartInstant(
        { ...config, allowedWeekdays: [0, 1, 2, 3, 4, 5, 6] },
        far,
        earlyNow
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("OUT_OF_RANGE");
    });
  });
});

describe("interview eligibility (persisted verification state)", () => {
  describe("isProjectVerified", () => {
    test("true for a persisted VERIFIED verdict", () => {
      expect(isProjectVerified(VERIFIED_CANDIDATE)).toBe(true);
    });

    test("true when only aiVerificationResult says VERIFIED", () => {
      expect(
        isProjectVerified({
          projectSubmissionStatus: "verification_completed",
          projectSubmission: {
            aiVerificationResult: { verificationStatus: "VERIFIED" },
          },
        })
      ).toBe(true);
    });

    test("false for a rejected project", () => {
      expect(
        isProjectVerified({
          projectSubmissionStatus: "rejected",
          projectSubmission: { aiVerificationStatus: "rejected" },
        })
      ).toBe(false);
    });

    test("false when verification has not reached a verdict", () => {
      expect(
        isProjectVerified({
          projectSubmissionStatus: "ai_verification",
          projectSubmission: { aiVerificationStatus: "pending" },
        })
      ).toBe(false);
    });

    test("false when there is no submission at all", () => {
      expect(isProjectVerified({ projectSubmissionStatus: "not_started" })).toBe(
        false
      );
    });
  });

  describe("canBookInterviewSlot", () => {
    test("TEST 1: a VERIFIED student is eligible", () => {
      expect(canBookInterviewSlot(VERIFIED_CANDIDATE).eligible).toBe(true);
    });

    test("TEST 2: a REJECTED student is not eligible", () => {
      const result = canBookInterviewSlot({
        status: "approved",
        projectSubmissionStatus: "rejected",
        rejectionReason: "Core module was not implemented.",
        projectSubmission: { aiVerificationStatus: "rejected" },
      });

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("project_not_verified");
    });

    test("TEST 2b: the persisted rejection reason reaches the student", () => {
      const result = canBookInterviewSlot({
        status: "approved",
        projectSubmissionStatus: "rejected",
        rejectionReason: "Core module was not implemented.",
        projectSubmission: { aiVerificationStatus: "rejected" },
      });

      expect(result.message).toBe("Core module was not implemented.");
    });

    test("needs_admin_review does NOT grant eligibility", () => {
      const result = canBookInterviewSlot({
        status: "approved",
        projectSubmissionStatus: "needs_admin_review",
        projectSubmission: { aiVerificationStatus: "needs_admin_review" },
      });

      expect(result.eligible).toBe(false);
    });

    test("ai_verification alone does NOT grant eligibility", () => {
      const result = canBookInterviewSlot({
        status: "approved",
        projectSubmissionStatus: "ai_verification",
        projectSubmission: { aiVerificationStatus: "pending" },
      });

      expect(result.eligible).toBe(false);
    });

    test("TEST 8: a student with an existing booking is blocked", () => {
      const result = canBookInterviewSlot({
        ...VERIFIED_CANDIDATE,
        bookedSlotId: "slot-1",
      });

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("already_booked");
    });

    test("a missing candidate is handled safely", () => {
      expect(canBookInterviewSlot(null).eligible).toBe(false);
    });
  });

  describe("getIneligibilityReason", () => {
    test("prefers the persisted candidate rejectionReason", () => {
      expect(
        getIneligibilityReason({
          rejectionReason: "Admin rejection reason.",
          projectSubmission: { aiVerificationResult: { summary: "AI summary" } },
        })
      ).toBe("Admin rejection reason.");
    });

    test("falls back to the AI summary", () => {
      expect(
        getIneligibilityReason({
          projectSubmission: {
            aiVerificationResult: { summary: "Requirements not met." },
          },
        })
      ).toBe("Requirements not met.");
    });
  });

  describe("deriveVerificationState", () => {
    test("VERIFIED => accepted + interviewEligible, never Under Review", () => {
      const state = deriveVerificationState(VERIFIED_CANDIDATE);

      expect(state.state).toBe("accepted");
      expect(state.label).toBe("Accepted");
      expect(state.interviewEligible).toBe(true);
      expect(state.label).not.toBe("Under Review");
    });

    test("REJECTED => rejected with the real persisted reason", () => {
      const state = deriveVerificationState({
        status: "approved",
        projectSubmissionStatus: "rejected",
        rejectionReason: "Database layer is missing.",
        projectSubmission: {
          url: "https://github.com/student/repo",
          aiVerificationStatus: "rejected",
          aiVerificationResult: { verificationStatus: "REJECTED" },
        },
      });

      expect(state.state).toBe("rejected");
      expect(state.interviewEligible).toBe(false);
      expect(state.rejectionReason).toBe("Database layer is missing.");
    });

    test("no submission => not_submitted and not eligible", () => {
      const state = deriveVerificationState({
        projectSubmissionStatus: "not_started",
      });

      expect(state.state).toBe("not_submitted");
      expect(state.interviewEligible).toBe(false);
    });

    test("isInterviewEligible mirrors the persisted verdict", () => {
      expect(isInterviewEligible(VERIFIED_CANDIDATE)).toBe(true);
      expect(
        isInterviewEligible({ projectSubmissionStatus: "needs_admin_review" })
      ).toBe(false);
      expect(isInterviewEligible(undefined)).toBe(false);
    });

    test("getPersistedRejectionReason returns null when there is none", () => {
      expect(getPersistedRejectionReason(VERIFIED_CANDIDATE)).toBeNull();
    });
  });

  /**
   * These tests lock in the ROOT CAUSE of the production "Under Review"
   * incident: a GitHub fetch failure (rate limit / timeout) is routed to
   * NEEDS_ADMIN_REVIEW and must be clearly distinguishable from genuine AI
   * uncertainty, both in the persisted data and in what the student sees.
   */
  describe("review cause reporting", () => {
    const repositoryFetchFailure = {
      status: "approved",
      projectSubmissionStatus: "needs_admin_review",
      projectSubmission: {
        url: "https://github.com/student/repo",
        aiVerificationStatus: "needs_admin_review",
        aiVerificationResult: {
          verificationStatus: "NEEDS_ADMIN_REVIEW",
          confidence: 0.3,
          summary:
            "Repository could not be fetched, so automated verification could not obtain sufficient evidence. (GitHub API rate limit exceeded)",
          verificationMetadata: {
            repositoryFetchFailed: true,
            errorType: "rate_limit",
            filesAnalyzed: 0,
          },
        },
      },
    };

    test("a fetch failure is reported as repository_fetch_failed", () => {
      expect(getReviewCause(repositoryFetchFailure)).toBe(
        "repository_fetch_failed"
      );
    });

    test("insufficient content is reported separately", () => {
      expect(
        getReviewCause({
          projectSubmissionStatus: "needs_admin_review",
          projectSubmission: {
            aiVerificationResult: {
              verificationStatus: "NEEDS_ADMIN_REVIEW",
              verificationMetadata: { insufficientContent: true },
            },
          },
        })
      ).toBe("insufficient_content");
    });

    test("genuine AI uncertainty is the fallback cause", () => {
      expect(
        getReviewCause({
          projectSubmissionStatus: "needs_admin_review",
          projectSubmission: {
            aiVerificationResult: {
              verificationStatus: "NEEDS_ADMIN_REVIEW",
              verificationMetadata: { filesAnalyzed: 12 },
            },
          },
        })
      ).toBe("ai_uncertainty");
    });

    test("the PERSISTED summary is surfaced as the review reason", () => {
      expect(getPersistedReviewReason(repositoryFetchFailure)).toContain(
        "rate limit exceeded"
      );
    });

    test("deriveVerificationState exposes reason + cause for under_review", () => {
      const state = deriveVerificationState(repositoryFetchFailure);

      expect(state.state).toBe("under_review");
      expect(state.reviewCause).toBe("repository_fetch_failed");
      expect(state.reviewReason).toContain("rate limit exceeded");
    });

    test("a fetch failure never grants interview eligibility", () => {
      expect(
        deriveVerificationState(repositoryFetchFailure).interviewEligible
      ).toBe(false);
      expect(canBookInterviewSlot(repositoryFetchFailure).eligible).toBe(false);
    });

    test("a VERIFIED candidate never reports a review reason", () => {
      const state = deriveVerificationState(VERIFIED_CANDIDATE);

      expect(state.reviewReason).toBeNull();
      expect(state.reviewCause).toBeNull();
      expect(state.interviewEligible).toBe(true);
    });
  });
});

describe("interviewBooking model - double booking guarantees", () => {
  const indexFor = (name) =>
    InterviewBooking.schema.indexes().find((entry) => entry[1]?.name === name);

  test("TEST 6/7: a UNIQUE index exists on startAt for active bookings", () => {
    const index = indexFor("uniq_active_booking_startAt");

    expect(index).toBeDefined();
    expect(index[1].unique).toBe(true);
    expect(index[0]).toEqual({ startAt: 1 });
    expect(index[1].partialFilterExpression).toEqual({
      status: { $in: ["scheduled"] },
    });
  });

  test("TEST 8: a UNIQUE index exists on candidateId for active bookings", () => {
    const index = indexFor("uniq_active_booking_candidate");

    expect(index).toBeDefined();
    expect(index[1].unique).toBe(true);
    expect(index[0]).toEqual({ candidateId: 1 });
    expect(index[1].partialFilterExpression).toEqual({
      status: { $in: ["scheduled"] },
    });
  });

  test("bookings store a canonical startAt and endAt", () => {
    const schema = InterviewBooking.schema;

    expect(schema.path("startAt").instance).toBe("Date");
    expect(schema.path("endAt").instance).toBe("Date");
    expect(schema.path("startAt").options.required).toBe(true);
    expect(schema.path("endAt").options.required).toBe(true);
    expect(schema.path("candidateId").options.required).toBe(true);
    expect(schema.path("candidateId").options.ref).toBe("Candidate");
    expect(schema.path("projectId").options.ref).toBe("Project");
  });

  test("bookedAt is recorded automatically", () => {
    const defaultValue =
      InterviewBooking.schema.path("bookedAt").defaultValue;

    // Mongoose stores `default: Date.now` as a thunk returning a ms number.
    const resolved =
      typeof defaultValue === "function" ? defaultValue() : defaultValue;

    expect(typeof resolved).toBe("number");
    expect(resolved).toBeGreaterThan(0);
  });

  test("status defaults to scheduled", () => {
    expect(InterviewBooking.schema.path("status").defaultValue).toBe(
      "scheduled"
    );
  });

  test("createdAt / updatedAt timestamps are enabled", () => {
    expect(InterviewBooking.schema.path("createdAt")).toBeDefined();
    expect(InterviewBooking.schema.path("updatedAt")).toBeDefined();
  });
});