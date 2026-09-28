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

const BACKEND_URL =
  process.env.BACKEND_URL;

/**
 * ============================================
 * GET AVAILABLE INTERVIEW SLOTS
 * ============================================
 *
 * GET /api/student/slots
 *
 * Flow:
 *
 * Browser
 *    ↓
 * Next.js /api/student/slots
 *    ↓
 * Read candidate_session
 *    ↓
 * Backend /api/student/slots
 *    ↓
 * Validate student session
 *    ↓
 * Find available slots
 *    ↓
 * Return slots
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
     * GET STUDENT SESSION COOKIE
     * ==========================================
     */

    const candidateSession =
      request.cookies.get(
        "candidate_session"
      )?.value;

    /**
     * Candidate is not authenticated.
     */

    if (!candidateSession) {
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
     * Forward the candidate session to the
     * backend.
     */

    const response = await fetch(
      `${BACKEND_URL}/api/student/slots`,
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
      "STUDENT SLOTS RESPONSE:",
      response.status,
      data
    );

    /**
     * ==========================================
     * RETURN BACKEND RESPONSE
     * ==========================================
     */

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error(
      "Student slots proxy error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to load interview slots.",
      },
      {
        status: 500,
      }
    );
  }
}