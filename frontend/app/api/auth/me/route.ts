import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminById } from "@/lib/server-store";
import { verifyAdminJWT } from "@/lib/auth";

export async function GET() {
  try {
    // ==================================================
    // GET AUTH COOKIE
    // ==================================================

    const cookieStore = await cookies();

    const token =
      cookieStore.get("recruitai_admin")?.value;

    // ==================================================
    // CHECK COOKIE
    // ==================================================

    if (!token) {
      return NextResponse.json(
        {
          message: "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // VERIFY JWT
    // ==================================================

    const payload =
      await verifyAdminJWT(token);

    if (!payload) {
      return NextResponse.json(
        {
          message: "Invalid or expired session",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // FIND ADMIN
    // ==================================================

    const admin =
      getAdminById(payload.adminId);

    if (!admin) {
      return NextResponse.json(
        {
          message: "Admin account not found",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // CHECK ADMIN STATUS
    // ==================================================

    if (!admin.active) {
      return NextResponse.json(
        {
          message: "Admin account is inactive",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // RETURN AUTHENTICATED ADMIN
    // ==================================================

    return NextResponse.json(
      {
        user: admin,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Auth check error:",
      error
    );

    return NextResponse.json(
      {
        message: "Authentication failed",
      },
      {
        status: 401,
      }
    );
  }
}