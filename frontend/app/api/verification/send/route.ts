import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      candidateId,
      identifier,
    } = body;

    if (!candidateId) {
      return NextResponse.json(
        {
          message:
            "Candidate ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !identifier ||
      typeof identifier !== "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Email or phone number is required.",
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/verification/send`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          candidateId,
          identifier: identifier.trim(),
        }),

        cache: "no-store",
      }
    );

    const data = await response.json();

    console.log(
      "BACKEND SEND OTP RESPONSE:",
      response.status,
      data
    );

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(
      "Verification send proxy error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to connect to verification service.",
      },
      { status: 500 }
    );
  }
}