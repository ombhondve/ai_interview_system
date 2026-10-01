import { NextResponse } from "next/server";

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof Error) {
    if (
      error.message === "Unauthorized" ||
      error.message === "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Internal server error" },
    { status: 500 }
  );
}
