import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =process.env.BACKEND_URL;// Replace with your backend URL

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { message: "Invitation token is required." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/student/invite?token=${encodeURIComponent(token)}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Student invite proxy error:", error);

    return NextResponse.json(
      {
        message: "Unable to connect to backend.",
      },
      { status: 500 }
    );
  }
}