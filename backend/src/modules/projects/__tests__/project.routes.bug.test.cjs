/**
 * Bug 5 — Duplicate PUT Route: Bug Condition Exploration Test
 *
 * Property 1: Bug Condition
 * PUT /api/projects/:id is registered in the router (routes to updateProject
 * instead of returning 404).
 *
 * CRITICAL: The "BUG CONDITION" test is EXPECTED TO PASS on UNFIXED code —
 * passing confirms the bug exists (the PUT route IS registered).
 * After the fix (line removed), the "BUG CONDITION" test will FAIL,
 * which signals the duplicate route has been removed.
 *
 * HOW TO RUN:
 *   cd backend
 *   npm run test:bug5
 *
 * EXPECTED OUTCOME (unfixed code):
 *   All tests PASS — PUT /:id route IS found → bug confirmed.
 *   Counterexample: router.put("/:id", updateProject) exists in project.route.js
 *
 * EXPECTED OUTCOME (after fix — remove router.put("/:id", ...)):
 *   "BUG CONDITION" test FAILS — PUT /:id route NOT found → fix confirmed.
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
   * On UNFIXED code: PASSES — router.put("/:id", updateProject) is present.
   * Counterexample: PUT /api/projects/:id routes to updateProject instead of 404.
   *
   * After fix (line removed): FAILS — confirming the bug is gone.
   *
   * Validates: Requirements 5.2, 5.3
   */
  test('BUG CONDITION: router.put("/:id") is registered — confirms bug exists on unfixed code', () => {
    const putIdRoutes = routes.filter(
      (r) => r.method === "put" && r.path === "/:id"
    );

    // UNFIXED: putIdRoutes.length === 1  → PASSES → bug confirmed
    // FIXED:   putIdRoutes.length === 0  → FAILS  → fix confirmed
    expect(putIdRoutes.length).toBe(1);

    console.log(
      'Counterexample: router.put("/:id", updateProject) is present in project.route.js'
    );
    console.log(
      "This means PUT /api/projects/:id resolves to updateProject (200) instead of 404."
    );
  });

  /**
   * SUPPLEMENTARY: both PATCH /:id AND PUT /:id exist simultaneously,
   * confirming the ambiguous duplicate route.
   *
   * Validates: Requirements 5.2, 5.3
   */
  test("SUPPLEMENTARY: both PATCH /:id and PUT /:id are registered simultaneously (confirms ambiguous duplicate)", () => {
    const patchRoutes = routes.filter(
      (r) => r.method === "patch" && r.path === "/:id"
    );
    const putRoutes = routes.filter(
      (r) => r.method === "put" && r.path === "/:id"
    );

    expect(patchRoutes.length).toBeGreaterThanOrEqual(1);
    expect(putRoutes.length).toBe(1);

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
