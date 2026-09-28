import {
  NextRequest,
  NextResponse,
} from "next/server";

/**
 * ============================================
 * BACKEND CONFIGURATION
 * ============================================
 *
 * The backend URL is stored in:
 *
 * frontend/.env
 *
 * Example:
 *
 * BACKEND_URL=https://your-ngrok-url.ngrok-free.app
 */

const BACKEND_URL =process.env.BACKEND_URL;

/**
 * ============================================
 * GET CURRENT STUDENT
 * ============================================
 *
 * GET /api/student/me
 *
 * This is a Next.js server-side proxy.
 *
 * Flow:
 *
 * Browser
 *    ↓
 * /api/student/me
 *    ↓
 * Read candidate_session cookie
 *    ↓
 * Send cookie to backend
 *    ↓
 * Backend /api/student/me
 *    ↓
 * Validate session
 *    ↓
 * Return candidate
 */

export async function GET(
  request: NextRequest
) {
  try {
    /**
     * ==========================================
     * CHECK BACKEND URL
     * ==========================================
     */

    if (!BACKEND_URL) {
      console.error(
        "BACKEND_URL is not configured."
      );

      return NextResponse.json(
        {
          message:
            "Backend URL is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /**
     * ==========================================
     * GET CANDIDATE SESSION COOKIE
     * ==========================================
     *
     * The OTP verification endpoint creates:
     *
     * candidate_session
     *
     * We read that cookie from the browser.
     */

    const candidateSession =
      request.cookies.get(
        "candidate_session"
      )?.value;

    /**
     * No session cookie means the candidate
     * has not completed verification or the
     * session has expired.
     */

    if (!candidateSession) {
      console.log(
        "No candidate_session cookie found."
      );

      return NextResponse.json(
        {
          message:
            "Student session expired.",
        },
        {
          status: 401,
        }
      );
    }

    /**
     * ==========================================
     * CALL BACKEND
     * ==========================================
     *
     * Forward the candidate_session cookie
     * to the Express backend.
     */

    const response = await fetch(
      `${BACKEND_URL}/api/student/me`,
      {
        method: "GET",

        headers: {
          Cookie: `candidate_session=${candidateSession}`,
        },

        cache: "no-store",
      }
    );

    /**
     * ==========================================
     * READ BACKEND RESPONSE
     * ==========================================
     */

    const data =
      await response.json();

    console.log(
      "STUDENT ME RESPONSE:",
      response.status,
      data
    );

    /**
     * ==========================================
     * RETURN BACKEND RESPONSE
     * ==========================================
     *
     * Keep the same HTTP status returned by
     * the backend.
     */

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    /**
     * ==========================================
     * ERROR HANDLING
     * ==========================================
     */

    console.error(
      "Student session proxy error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to verify student session.",
      },
      {
        status: 500,
      }
    );
  }
}