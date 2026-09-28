import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =process.env.BACKEND_URL;

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      identifier,
      otp,
    } = body;

    /**
     * Validate identifier.
     */
    if (
      !identifier ||
      typeof identifier !== "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Email or phone number is required.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Validate OTP.
     */
    if (
      !otp ||
      typeof otp !== "string"
    ) {
      return NextResponse.json(
        {
          message: "OTP is required.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanIdentifier =
      identifier.trim();

    const cleanOtp = otp.trim();

    /**
     * OTP must contain exactly
     * 6 digits.
     */
    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        {
          message:
            "OTP must be a 6-digit number.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Forward request to Express backend.
     */
    const response = await fetch(
      `${BACKEND_URL}/api/verification/verify`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          identifier: cleanIdentifier,
          otp: cleanOtp,
        }),

        cache: "no-store",
      }
    );

    const data =
      await response.json();

    console.log(
      "BACKEND VERIFY OTP RESPONSE:",
      response.status,
      data
    );

    /**
     * Create Next.js response.
     */
    const nextResponse =
      NextResponse.json(data, {
        status: response.status,
      });

    /**
     * Forward the candidate_session
     * cookie from Express to the browser.
     */
    const setCookie =
      response.headers.get(
        "set-cookie"
      );

    if (setCookie) {
      nextResponse.headers.set(
        "set-cookie",
        setCookie
      );
    }

    return nextResponse;
  } catch (error) {
    console.error(
      "Verification proxy error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to connect to verification service.",
      },
      {
        status: 500,
      }
    );
  }
}