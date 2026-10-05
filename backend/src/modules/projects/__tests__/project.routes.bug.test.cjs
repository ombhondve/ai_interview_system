/**
 * Bug 5 — Duplicate PUT Route: Regression (Bug Condition Exploration) Test
 *
 * Property 1: Bug Condition
 * PUT /api/projects/:id must NOT be registered in the router (updates go
 * through PATCH /:id only; a stray PUT would route to updateProject instead
 * of returning 404).
 *
 * CRITICAL: This "BUG CONDITION" test asserts the FIXED state. On the original
 * unfixed code (router.put("/:id", ...) present) it FAILS, confirming the bug.
 * On fixed code (the PUT line removed) it PASSES, confirming the fix.
 *
 * HOW TO RUN:
 *   cd backend
 *   npm run test:bug5
 *
 * EXPECTED OUTCOME (unfixed code):
 *   "BUG CONDITION" test FAILS — PUT /:id route IS found → bug present.
 *
 * EXPECTED OUTCOME (fixed code — router.put("/:id", ...) removed):
 *   All tests PASS — PUT /:id route NOT found → fix confirmed.
 *   Preservation tests continue to PASS — no regressions.
 *
 * Requirements: 5.2, 5.3
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Resolve path to the route file under test
const ROUTE_FILE = path.resolve(
  __dirname,
  "../project.route.js"
);

// -----------------------------------------------------------------------
// HELPER: parse registered router method calls from source
// -----------------------------------------------------------------------

/**
 * Extracts all router.<method>(...) registrations from source text.
 * Returns an array of { method, path } objects.
 *
 * Example match: router.put("/:id", updateProject) → { method: "put", path: "/:id" }
 */
function extractRoutes(source) {
  const routeRegex =
    /router\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  const routes = [];
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    routes.push({ method: match[1], path: match[2] });
  }
  return routes;
}

// -----------------------------------------------------------------------
// BUG CONDITION EXPLORATION TEST — Property 1
// Requirements: 5.2, 5.3
// -----------------------------------------------------------------------

describe("Bug 5 — Duplicate PUT Route (Bug Condition Exploration)", () => {
  let source;
  let routes;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE_FILE, "utf8");
    routes = extractRoutes(source);
  });

  /**
   * BUG CONDITION TEST
   *
   * On UNFIXED code: FAILS — router.put("/:id", updateProject) is present.
   * Counterexample: PUT /api/projects/:id routes to updateProject instead of 404.
   *
   * On fixed code: PASSES — confirming the duplicate PUT route is gone.
   *
   * Validates: Requirements 5.2, 5.3
   */
  test('BUG CONDITION: router.put("/:id") is NOT registered — confirms fix on fixed code', () => {
    const putIdRoutes = routes.filter(
      (r) => r.method === "put" && r.path === "/:id"
    );

    // UNFIXED: putIdRoutes.length === 1  → FAILS → bug present
    // FIXED:   putIdRoutes.length === 0  → PASSES → fix confirmed
    expect(putIdRoutes.length).toBe(0);

    console.log(
      'Confirmed: router.put("/:id", updateProject) is absent from project.route.js'
    );
    console.log(
      "Updates go through PATCH /:id only; PUT /api/projects/:id returns 404."
    );
  });

  /**
   * SUPPLEMENTARY: PATCH /:id is registered while PUT /:id is NOT,
   * confirming the ambiguous duplicate route was removed.
   *
   * Validates: Requirements 5.2, 5.3
   */
  test("SUPPLEMENTARY: PATCH /:id is registered and PUT /:id is absent (no ambiguous duplicate)", () => {
    const patchRoutes = routes.filter(
      (r) => r.method === "patch" && r.path === "/:id"
    );
    const putRoutes = routes.filter(
      (r) => r.method === "put" && r.path === "/:id"
    );

    expect(patchRoutes.length).toBeGreaterThanOrEqual(1);
    expect(putRoutes.length).toBe(0);

    console.log(
      "All registered project routes: " +
        routes.map((r) => `${r.method.toUpperCase()} ${r.path}`).join(", ")
    );
  });
});

// -----------------------------------------------------------------------
// PRESERVATION PROPERTY TESTS — Property 2
// Requirements: 5.3.1–5.3.7
// -----------------------------------------------------------------------

describe("Bug 5 — Project Route Preservation (should always pass — no regressions)", () => {
  let source;
  let routes;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE_FILE, "utf8");
    routes = extractRoutes(source);
  });

  /**
   * These tests assert that all legitimate project routes remain registered
   * BOTH on unfixed code AND after the fix. Any failure here indicates a
   * regression introduced while removing the duplicate PUT route.
   *
   * Validates: Requirements 5.3.1–5.3.7
   */

  test("PRESERVATION: GET / (list projects) is registered", () => {
    expect(routes.some((r) => r.method === "get" && r.path === "/")).toBe(true);
  });

  test("PRESERVATION: GET /:id (get project by id) is registered", () => {
    expect(routes.some((r) => r.method === "get" && r.path === "/:id")).toBe(
      true
    );
  });

  test("PRESERVATION: POST / (create project) is registered", () => {
    expect(routes.some((r) => r.method === "post" && r.path === "/")).toBe(
      true
    );
  });

  test("PRESERVATION: POST /generate (generate project) is registered", () => {
    expect(
      routes.some((r) => r.method === "post" && r.path === "/generate")
    ).toBe(true);
  });

  test("PRESERVATION: POST /:id/regenerate (regenerate project) is registered", () => {
    expect(
      routes.some((r) => r.method === "post" && r.path === "/:id/regenerate")
    ).toBe(true);
  });

  test("PRESERVATION: PATCH /:id (update project via PATCH) is registered", () => {
    expect(
      routes.some((r) => r.method === "patch" && r.path === "/:id")
    ).toBe(true);
  });

  test("PRESERVATION: PATCH /:id/archive (archive project) is registered", () => {
    expect(
      routes.some((r) => r.method === "patch" && r.path === "/:id/archive")
    ).toBe(true);
  });

  test("PRESERVATION: DELETE /:id (delete project) is registered", () => {
    expect(
      routes.some((r) => r.method === "delete" && r.path === "/:id")
    ).toBe(true);
  });

  test("PRESERVATION: GET /:id/candidates (get assigned candidates) is registered", () => {
    expect(
      routes.some((r) => r.method === "get" && r.path === "/:id/candidates")
    ).toBe(true);
  });

  test("PRESERVATION: POST /:id/admin-pdf (upload admin PDF) is registered", () => {
    expect(
      routes.some((r) => r.method === "post" && r.path === "/:id/admin-pdf")
    ).toBe(true);
  });
});
