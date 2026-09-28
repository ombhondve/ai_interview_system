import { cookies } from "next/headers";

import {
  getAdminById,
  getStudentCandidate,
} from "./server-store";

import { verifyAdminJWT } from "./auth";


// =====================================================
// ADMIN AUTHENTICATION
// =====================================================

export async function requireAdmin() {
  try {
    // ---------------------------------------------------
    // Get admin cookie
    // ---------------------------------------------------

    const cookieStore = await cookies();

    const token =
      cookieStore.get(
        "recruitai_admin"
      )?.value;

    // ---------------------------------------------------
    // Check whether token exists
    // ---------------------------------------------------

    if (!token) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Verify JWT
    // ---------------------------------------------------

    const payload =
      await verifyAdminJWT(token);

    if (!payload) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Find admin using JWT adminId
    // ---------------------------------------------------

    const admin =
      getAdminById(
        payload.adminId
      );

    // ---------------------------------------------------
    // Check admin exists
    // ---------------------------------------------------

    if (!admin) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Check admin is active
    // ---------------------------------------------------

    if (!admin.active) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Return authenticated admin
    // ---------------------------------------------------

    return admin;

  } catch (error) {

    // ---------------------------------------------------
    // Preserve authentication errors
    // ---------------------------------------------------

    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHORIZED"
    ) {
      throw error;
    }

    // ---------------------------------------------------
    // Log unexpected errors
    // ---------------------------------------------------

    console.error(
      "requireAdmin error:",
      error
    );

    throw new Error(
      "UNAUTHORIZED"
    );
  }
}


// =====================================================
// STUDENT AUTHENTICATION
// =====================================================

export async function requireStudent() {
  try {
    // ---------------------------------------------------
    // Get student cookie
    // ---------------------------------------------------

    const cookieStore = await cookies();

    const token =
      cookieStore.get(
        "recruitai_student"
      )?.value;

    // ---------------------------------------------------
    // Check whether token exists
    // ---------------------------------------------------

    if (!token) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Validate student session
    // ---------------------------------------------------

    const candidate =
      getStudentCandidate(
        token
      );

    // ---------------------------------------------------
    // Check candidate
    // ---------------------------------------------------

    if (!candidate) {
      throw new Error(
        "UNAUTHORIZED"
      );
    }

    // ---------------------------------------------------
    // Return authenticated candidate
    // ---------------------------------------------------

    return candidate;

  } catch (error) {

    // ---------------------------------------------------
    // Preserve authentication errors
    // ---------------------------------------------------

    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHORIZED"
    ) {
      throw error;
    }

    // ---------------------------------------------------
    // Log unexpected errors
    // ---------------------------------------------------

    console.error(
      "requireStudent error:",
      error
    );

    throw new Error(
      "UNAUTHORIZED"
    );
  }
}