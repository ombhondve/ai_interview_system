"use strict";

/**
 * Route-level integration tests for the interview scheduling API.
 *
 * These exercise the real Express router with supertest, mocking only the
 * Mongoose models and the two auth middlewares. They cover:
 *   - student authorization (401 / 403)
 *   - admin authorization on the schedule endpoint (TEST 12)
 *   - duplicate booking -> 409 with a controlled code (TEST 6)
 *   - no admin mutation endpoints exist at all (TEST 11)
 *   - the student availability payload never leaks another student's identity
 *
 * HOW TO RUN:
 *   cd backend
 *   npx jest --testPathPatterns=interviewScheduling.routes
 */

// ---------------------------------------------------------------
// Auth middlewares: replaced with controllable stubs.
// ---------------------------------------------------------------

/**
 * A VERIFIED candidate. The booking API reads the PERSISTED verification
 * state, so the fixture must carry it.
 */
const verifiedCandidate = {
  _id: "candidate-1",
  name: "Student One",
  status: "approved",
  projectSubmissionStatus: "verified",
  projectSubmission: {
    url: "https://github.com/student/repo",
    aiVerificationStatus: "verified",
    aiVerificationResult: { verificationStatus: "VERIFIED" },
  },
};

jest.mock("../../../middleware/requireVerifiedSession.js", () => ({
  requireVerifiedSession: (req, res, next) => {
    if (req.headers["x-no-session"] === "1") {
      return res.status(401).json({
        message: "Authentication required. Please verify your identity.",
      });
    }

    if (req.headers["x-rejected"] === "1") {
      req.candidate = {
        _id: "candidate-rejected",
        name: "Rejected Student",
        status: "approved",
        projectSubmissionStatus: "rejected",
        rejectionReason: "Database layer is missing.",
        projectSubmission: { aiVerificationStatus: "rejected" },
      };
      return next();
    }

    req.candidate = verifiedCandidate;
    next();
  },
}));

jest.mock("../../auth/auth.middleware.js", () => ({
  requireAuth: (req, res, next) => {
    if (req.headers["x-admin-token"] !== "admin-jwt") {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }
    next();
  },
}));

jest.mock("../../candidate/candidate.model.js", () => ({
  __esModule: true,
  default: { findByIdAndUpdate: jest.fn(async () => ({})), findById: jest.fn() },
}));

jest.mock("../../verification/verificationSession.model.js", () => ({
  __esModule: true,
  default: {},
}));

/**
 * In-memory InterviewBooking that ENFORCES the same unique constraints as the
 * partial unique indexes declared on the real schema. This is what makes the
 * concurrency assertions meaningful.
 */
jest.mock("../interviewBooking.model.js", () => {
  const store = [];
  let nextId = 1;

  const uniqueCheck = (candidateId, startAt) => {
    const clash = store.find(
      (row) =>
        row.status === "scheduled" &&
        (row.candidateId === candidateId ||
          row.startAt.getTime() === startAt.getTime())
    );

    if (clash) {
      const error = new Error("E11000 duplicate key error");
      error.code = 11000;
      throw error;
    }
  };

  return {
    __esModule: true,
    ACTIVE_BOOKING_STATUSES: ["scheduled"],
    default: {
      __store: store,
      __reset: () => {
        store.length = 0;
        nextId = 1;
      },
      create: async (doc) => {
        uniqueCheck(doc.candidateId, doc.startAt);

        const row = { ...doc, _id: `booking-${nextId++}` };
        store.push(row);
        return { ...row, toObject: () => row };
      },
      findOne: (query) => {
        const row = store.find(
          (r) =>
            (!query.candidateId || r.candidateId === query.candidateId) &&
            r.status === "scheduled"
        );

        const chain = {
          sort: () => chain,
          lean: async () => row,
          then: (resolve) => resolve(row),
        };

        return chain;
      },
      find: (query = {}) => {
        let rows = store.filter((r) => r.status === "scheduled");

        // Mirror Mongo semantics: each bound is optional on its own.
        const bounds = query.startAt || {};
        if (bounds.$gte || bounds.$lt) {
          rows = rows.filter((r) => {
            const time = r.startAt.getTime();
            if (bounds.$gte && time < bounds.$gte.getTime()) return false;
            if (bounds.$lt && time >= bounds.$lt.getTime()) return false;
            return true;
          });
        }

        const populated = rows.map((row) => ({
          ...row,
          candidateId: {
            _id: row.candidateId,
            name: row.candidateName || "Student",
            email: row.candidateEmail || "student@example.com",
            phone: row.candidatePhone || "+91 90000 00000",
            role: "Developer",
          },
          projectId: { title: row.projectTitle || "Demo Project" },
        }));

        const chain = {
          select: () => chain,
          populate: () => chain,
          sort: () => chain,
          lean: async () => populated,
        };

        return chain;
      },
    },
  };
});

jest.mock("../interviewConfig.model.js", () => ({
  __esModule: true,
  default: {
    findOne: async () => ({
      timezone: "Asia/Kolkata",
      interviewDurationMinutes: 30,
      workingHours: { startHour: 9, endHour: 18 },
      allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      schedulingHorizonDays: 3650,
      minLeadHours: 0,
      mode: "online",
      location: "Online",
    }),
    create: async () => ({}),
  },
}));

const request = require("supertest");
const express = require("express");

const InterviewBookingModel = require("../interviewBooking.model.js").default;
const {
  zonedWallClockToUtc,
  addDaysToDateString,
  todayInTimezone,
} = require("../interviewConfig.service.js");

const routes = require("../interviewBooking.routes.js").default;

const TZ = "Asia/Kolkata";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", routes);
  return app;
}

/** A generated, future, in-window interview time. */
function futureSlot(hour = 10, minute = 30) {
  const base = addDaysToDateString(todayInTimezone(TZ), 3);
  return zonedWallClockToUtc(base, hour, minute, TZ);
}

beforeEach(() => {
  InterviewBookingModel.__reset();
  delete verifiedCandidate.bookedSlotId;
});

describe("GET /api/student/interview/config", () => {
  test("TEST 1: returns config and eligibility for a verified student", async () => {
    const response = await request(buildApp())
      .get("/api/student/interview/config")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.config.timezone).toBe(TZ);
    expect(response.body.config.interviewDurationMinutes).toBe(30);
    expect(response.body.interviewEligible).toBe(true);
    expect(Array.isArray(response.body.availableDates)).toBe(true);
  });

  test("requires a student session", async () => {
    await request(buildApp())
      .get("/api/student/interview/config")
      .set("x-no-session", "1")
      .expect(401);
  });

  test("TEST 2: a rejected student is not eligible and sees the real reason", async () => {
    const response = await request(buildApp())
      .get("/api/student/interview/config")
      .set("x-rejected", "1")
      .expect(200);

    expect(response.body.interviewEligible).toBe(false);
    expect(response.body.eligibilityMessage).toBe("Database layer is missing.");
  });
});

describe("GET /api/student/interview/availability", () => {
  test("TEST 3: available times are returned as selectable", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);

    const response = await request(buildApp())
      .get(`/api/student/interview/availability?date=${date}`)
      .expect(200);

    expect(response.body.slots.length).toBeGreaterThan(0);
    expect(response.body.slots[0].status).toBe("available");
  });

  test("TEST 4/15: a booked time is reported as already_taken but still listed", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);
    const target = futureSlot(10, 30);

    InterviewBookingModel.__store.push({
      _id: "existing",
      candidateId: "someone-else",
      startAt: target,
      endAt: new Date(target.getTime() + 30 * 60000),
      status: "scheduled",
    });

    const response = await request(buildApp())
      .get(`/api/student/interview/availability?date=${date}`)
      .expect(200);

    const slot = response.body.slots.find(
      (s) => new Date(s.startAt).getTime() === target.getTime()
    );

    expect(slot).toBeDefined();
    expect(slot.status).toBe("already_taken");
  });

  test("never leaks the identity of the student who booked a time", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);

    const response = await request(buildApp())
      .get(`/api/student/interview/availability?date=${date}`)
      .expect(200);

    const serialised = JSON.stringify(response.body);

    expect(serialised).not.toContain("candidateId");
    expect(serialised).not.toContain("someone-else");
    expect(serialised).not.toContain("bookedBy");
  });

  test("TEST 13: a rejected student cannot read availability", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);

    const response = await request(buildApp())
      .get(`/api/student/interview/availability?date=${date}`)
      .set("x-rejected", "1")
      .expect(403);

    expect(response.body.code).toBe("INTERVIEW_NOT_ELIGIBLE");
  });

  test("rejects a malformed date", async () => {
    await request(buildApp())
      .get("/api/student/interview/availability?date=not-a-date")
      .expect(400);
  });

  test("requires a student session", async () => {
    await request(buildApp())
      .get("/api/student/interview/availability")
      .set("x-no-session", "1")
      .expect(401);
  });
});

describe("POST /api/student/interview/book", () => {
  test("TEST 5: booking an available time succeeds", async () => {
    const target = futureSlot(10, 30);

    const response = await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: target.toISOString() })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.booking.time).toBe("10:30 am");
    expect(response.body.booking.durationMinutes).toBe(30);
    expect(response.body.booking.timezone).toBe(TZ);
    expect(response.body.booking.status).toBe("scheduled");
  });

  test("TEST 15: the booked time then reports as already_taken", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);
    const target = futureSlot(10, 30);

    await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: target.toISOString() })
      .expect(201);

    const availability = await request(buildApp())
      .get(`/api/student/interview/availability?date=${date}`)
      .expect(200);

    const slot = availability.body.slots.find(
      (s) => new Date(s.startAt).getTime() === target.getTime()
    );

    expect(slot.status).toBe("already_taken");
  });

  test("TEST 6: a second student taking the same time gets a controlled 409", async () => {
    const target = futureSlot(11, 0);

    await InterviewBookingModel.create({
      candidateId: "student-a",
      startAt: target,
      endAt: new Date(target.getTime() + 30 * 60000),
      status: "scheduled",
    });

    const response = await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: target.toISOString() })
      .expect(409);

    expect(response.body.code).toBe("INTERVIEW_TIME_ALREADY_BOOKED");
    expect(response.body.message).toBe(
      "This interview time was just booked by another student."
    );
  });

  test("TEST 7: simultaneous requests - exactly one succeeds", async () => {
    const target = futureSlot(14, 0);

    const [first, second] = await Promise.all([
      request(buildApp())
        .post("/api/student/interview/book")
        .send({ startAt: target.toISOString() }),
      request(buildApp())
        .post("/api/student/interview/book")
        .send({ startAt: target.toISOString() }),
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([201, 409]);
    expect(
      InterviewBookingModel.__store.filter(
        (row) => row.startAt.getTime() === target.getTime()
      )
    ).toHaveLength(1);
  });

  test("TEST 8: a second booking by the same student is rejected", async () => {
    await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: futureSlot(9, 0).toISOString() })
      .expect(201);

    const response = await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: futureSlot(15, 0).toISOString() })
      .expect(409);

    expect(response.body.code).toBe("INTERVIEW_ALREADY_BOOKED");
  });

  test("TEST 13: a rejected student cannot book", async () => {
    const response = await request(buildApp())
      .post("/api/student/interview/book")
      .set("x-rejected", "1")
      .send({ startAt: futureSlot(10, 30).toISOString() })
      .expect(403);

    expect(response.body.code).toBe("INTERVIEW_NOT_ELIGIBLE");
    expect(response.body.message).toBe("Database layer is missing.");
  });

  test("TEST 14: an arbitrary off-grid time is rejected", async () => {
    const bogus = new Date(
      zonedWallClockToUtc(
        addDaysToDateString(todayInTimezone(TZ), 3),
        10,
        7,
        TZ
      ).toISOString()
    );

    const response = await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: bogus.toISOString() })
      .expect(400);

    expect(response.body.code).toBe("INVALID_INTERVIEW_TIME");
  });

  test("rejects a missing or malformed startAt", async () => {
    await request(buildApp())
      .post("/api/student/interview/book")
      .send({})
      .expect(400);

    await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: "tomorrow" })
      .expect(400);
  });

  test("requires a student session", async () => {
    await request(buildApp())
      .post("/api/student/interview/book")
      .set("x-no-session", "1")
      .send({ startAt: futureSlot().toISOString() })
      .expect(401);
  });
});

describe("GET /api/student/interview/booking", () => {
  test("returns the student's own booking", async () => {
    await request(buildApp())
      .post("/api/student/interview/book")
      .send({ startAt: futureSlot(16, 0).toISOString() })
      .expect(201);

    const response = await request(buildApp())
      .get("/api/student/interview/booking")
      .expect(200);

    expect(response.body.booking.time).toBe("04:00 pm");
  });

  test("returns null when nothing is booked", async () => {
    const response = await request(buildApp())
      .get("/api/student/interview/booking")
      .expect(200);

    expect(response.body.booking).toBeNull();
  });

  test("requires a student session", async () => {
    await request(buildApp())
      .get("/api/student/interview/booking")
      .set("x-no-session", "1")
      .expect(401);
  });
});

describe("GET /api/admin/interviews/schedule", () => {
  test("TEST 9: an admin sees available AND booked times", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);
    const target = futureSlot(10, 30);

    await InterviewBookingModel.create({
      candidateId: "student-a",
      startAt: target,
      endAt: new Date(target.getTime() + 30 * 60000),
      status: "scheduled",
    });

    const response = await request(buildApp())
      .get(`/api/admin/interviews/schedule?date=${date}`)
      .set("x-admin-token", "admin-jwt")
      .expect(200);

    expect(response.body.readOnly).toBe(true);
    expect(response.body.entries.some((e) => e.status === "available")).toBe(true);
    expect(response.body.entries.some((e) => e.status === "booked")).toBe(true);
  });

  test("TEST 10: an admin sees student details for a booked time", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);
    const target = futureSlot(10, 30);

    await InterviewBookingModel.create({
      candidateId: "student-a",
      startAt: target,
      endAt: new Date(target.getTime() + 30 * 60000),
      status: "scheduled",
      bookedAt: new Date(),
    });

    const response = await request(buildApp())
      .get(`/api/admin/interviews/schedule?date=${date}`)
      .set("x-admin-token", "admin-jwt")
      .expect(200);

    const booked = response.body.entries.find((e) => e.status === "booked");

    expect(booked.booking.candidate.email).toBe("student@example.com");
    expect(booked.booking.candidate.phone).toBeTruthy();
    expect(booked.booking.project).toBe("Demo Project");
    expect(booked.booking.status).toBe("scheduled");
    expect(booked.booking.bookedAt).toBeTruthy();
  });

  test("TEST 12: a student calling the admin schedule API is rejected", async () => {
    const date = addDaysToDateString(todayInTimezone(TZ), 3);

    await request(buildApp())
      .get(`/api/admin/interviews/schedule?date=${date}`)
      .set("x-no-session", "1")
      .expect(401);
  });

  test("TEST 12b: an unauthenticated caller is rejected", async () => {
    await request(buildApp())
      .get("/api/admin/interviews/schedule")
      .expect(401);
  });

  test("TEST 11: the router exposes NO admin mutation endpoint", () => {
    // Inspect the REAL router's registered route table. This is a stronger
    // guarantee than probing URLs: no mutation verb on any admin interview
    // path can exist, so an admin physically cannot modify the schedule.
    const registered = routes.stack.map((layer) => ({
      path: layer.route?.path,
      methods: layer.route ? Object.keys(layer.route.methods) : [],
    }));

    const adminMutations = registered.filter(
      (route) =>
        route.path &&
        route.path.startsWith("/admin") &&
        route.methods.some((m) => m !== "get")
    );

    expect(adminMutations).toEqual([]);
  });

  test("TEST 11b: the only admin interview routes are read-only GETs", () => {
    const adminRoutes = routes.stack
      .map((layer) => layer.route)
      .filter((route) => route && route.path.startsWith("/admin"))
      .map((route) => ({ path: route.path, methods: Object.keys(route.methods) }));

    expect(adminRoutes).toEqual([
      { path: "/admin/interviews/schedule", methods: ["get"] },
      { path: "/admin/interviews/upcoming", methods: ["get"] },
    ]);
  });

  test("TEST 11c: the only booking write endpoint is the student's POST", () => {
    const writeRoutes = routes.stack
      .map((layer) => layer.route)
      .filter(
        (route) =>
          route &&
          Object.keys(route.methods).some((m) => m !== "get" && m !== "head")
      )
      .map((route) => ({ path: route.path, methods: Object.keys(route.methods) }));

    expect(writeRoutes).toEqual([
      { path: "/student/interview/book", methods: ["post"] },
    ]);
  });

  test("TEST 11d: probing the admin schedule with a write verb is refused", async () => {
    const app = buildApp();

    for (const method of ["post", "put", "patch", "delete"]) {
      const response = await request(app)[method](
        "/api/admin/interviews/schedule"
      )
        .set("x-admin-token", "admin-jwt")
        .send({});

      expect([404, 405]).toContain(response.status);
    }

    expect(InterviewBookingModel.__store).toHaveLength(0);
  });

  test("TEST 11b: students cannot create or edit slots", async () => {
    await request(buildApp())
      .post("/api/admin/interviews/schedule")
      .set("x-admin-token", "admin-jwt")
      .send({ startAt: futureSlot().toISOString() })
      .expect(404);
  });
});

describe("GET /api/admin/interviews/upcoming", () => {
  test("an admin sees future student bookings with candidate details (read-only)", async () => {
    const target = futureSlot(11, 0);

    await InterviewBookingModel.create({
      candidateId: "student-upcoming",
      candidateName: "Upcoming Student",
      candidateEmail: "upcoming@example.com",
      startAt: target,
      endAt: new Date(target.getTime() + 30 * 60000),
      status: "scheduled",
      bookedAt: new Date(),
    });

    const response = await request(buildApp())
      .get("/api/admin/interviews/upcoming")
      .set("x-admin-token", "admin-jwt")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.readOnly).toBe(true);
    expect(response.body.timezone).toBe(TZ);
    expect(response.body.interviews).toHaveLength(1);

    const [interview] = response.body.interviews;
    expect(interview.candidate.name).toBe("Upcoming Student");
    expect(interview.candidate.email).toBe("upcoming@example.com");
    expect(interview.candidate.phone).toBeTruthy();
    expect(interview.date).toBeTruthy();
    expect(interview.time).toBeTruthy();
    expect(interview.startAt).toBe(target.toISOString());
    expect(interview.status).toBe("scheduled");
  });

  test("bookings are returned soonest-first and past bookings are excluded", async () => {
    const later = futureSlot(15, 0);
    const sooner = futureSlot(12, 0);

    await InterviewBookingModel.create({
      candidateId: "student-later",
      startAt: later,
      endAt: new Date(later.getTime() + 30 * 60000),
      status: "scheduled",
    });
    await InterviewBookingModel.create({
      candidateId: "student-sooner",
      startAt: sooner,
      endAt: new Date(sooner.getTime() + 30 * 60000),
      status: "scheduled",
    });
    // A booking in the past must never appear in "upcoming".
    await InterviewBookingModel.create({
      candidateId: "student-past",
      startAt: new Date(Date.now() - 60 * 60000),
      endAt: new Date(Date.now() - 30 * 60000),
      status: "scheduled",
    });

    const response = await request(buildApp())
      .get("/api/admin/interviews/upcoming")
      .set("x-admin-token", "admin-jwt")
      .expect(200);

    expect(response.body.interviews).toHaveLength(2);
    expect(response.body.interviews[0].startAt).toBe(sooner.toISOString());
    expect(response.body.interviews[1].startAt).toBe(later.toISOString());
  });

  test("the limit option caps the returned list", async () => {
    for (const hour of [10, 11, 12, 13]) {
      const target = futureSlot(hour, 0);
      await InterviewBookingModel.create({
        candidateId: `student-${hour}`,
        startAt: target,
        endAt: new Date(target.getTime() + 30 * 60000),
        status: "scheduled",
      });
    }

    const response = await request(buildApp())
      .get("/api/admin/interviews/upcoming?limit=2")
      .set("x-admin-token", "admin-jwt")
      .expect(200);

    expect(response.body.interviews).toHaveLength(2);
  });

  test("an unauthenticated caller is rejected", async () => {
    await request(buildApp())
      .get("/api/admin/interviews/upcoming")
      .expect(401);
  });

  test("there is no write verb on the upcoming endpoint", async () => {
    const app = buildApp();

    for (const method of ["post", "put", "patch", "delete"]) {
      const response = await request(app)
        [method]("/api/admin/interviews/upcoming")
        .set("x-admin-token", "admin-jwt")
        .send({});

      expect([404, 405]).toContain(response.status);
    }

    expect(InterviewBookingModel.__store).toHaveLength(0);
  });
});

describe("legacy slot endpoints", () => {
  test("return a controlled 410 pointing at the replacement API", async () => {
    const app = buildApp();

    // Mount the legacy router alongside the new one, as app.js does.
    app.use("/api", require("../slot.routes.js").default);

    for (const path of [
      "/api/student/slots",
      "/api/student/booked-slot",
    ]) {
      const response = await request(app).get(path).expect(410);

      expect(response.body.code).toBe("ENDPOINT_RETIRED");
      expect(response.body.replacements.book).toBe(
        "/api/student/interview/book"
      );
    }

    await request(app)
      .post("/api/student/book-slot")
      .send({ slotId: "x" })
      .expect(410);
  });
});
