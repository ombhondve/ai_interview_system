import { NextResponse } from "next/server";

import {
  admins,
  addAudit,
} from "@/lib/server-store";

import { createAdminJWT } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // ==================================================
    // READ REQUEST BODY
    // ==================================================

    const body = await req.json().catch(() => ({}));

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    const password = String(body.password ?? "");

    // ==================================================
    // VALIDATE INPUT
    // ==================================================

    if (!email || !password) {
      return NextResponse.json(
        {
          message: "Email and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // DEMO ADMIN CREDENTIALS
    // ==================================================

    const demoEmail = (
      process.env.DEMO_ADMIN_EMAIL ||
      "admin@example.com"
    )
      .trim()
      .toLowerCase();

    const demoPassword =
      process.env.DEMO_ADMIN_PASSWORD ||
      "Admin@123";

    // ==================================================
    // FIND ADMIN
    // ==================================================

    const admin = admins.find(
      (item) =>
        item.email.toLowerCase() === email &&
        item.active === true
    );

    // ==================================================
    // VALIDATE ADMIN + PASSWORD
    // ==================================================

    if (!admin) {
      return NextResponse.json(
        {
          message: "Invalid email or password.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      email !== demoEmail ||
      password !== demoPassword
    ) {
      return NextResponse.json(
        {
          message: "Invalid email or password.",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // CREATE JWT
    // ==================================================

    const token = await createAdminJWT({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // ==================================================
    // ADD AUDIT LOG
    // ==================================================

    addAudit(
      admin.name,
      "login",
      admin.email,
      "auth",
      "info"
    );

    // ==================================================
    // CREATE RESPONSE
    // ==================================================

    const response = NextResponse.json(
      {
        user: admin,
      },
      {
        status: 200,
      }
    );

    // ==================================================
    // SET ADMIN AUTH COOKIE
    // ==================================================

    response.cookies.set(
      "recruitai_admin",
      token,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV === "production",

        sameSite: "lax",

        maxAge: 8 * 60 * 60,

        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Admin login error:",
      error
    );

    return NextResponse.json(
      {
        message: "Unable to login.",
      },
      {
        status: 500,
      }
    );
  }
}