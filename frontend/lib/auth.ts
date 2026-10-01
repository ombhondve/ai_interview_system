import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * =========================================================
 * JWT CONFIGURATION
 * =========================================================
 */

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    "JWT_SECRET is not configured. Add JWT_SECRET to your .env.local file."
  );
}

const JWT_SECRET = new TextEncoder().encode(secret);

const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRES_IN = "8h";

/**
 * =========================================================
 * ADMIN JWT PAYLOAD
 * =========================================================
 */

export type AdminJwtPayload = {
  adminId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

/**
 * =========================================================
 * CREATE ADMIN JWT
 * =========================================================
 */

export async function createAdminJWT(admin: {
  id: string;
  email: string;
  role: string;
}): Promise<string> {
  if (!admin.id) {
    throw new Error("Admin ID is required.");
  }

  if (!admin.email) {
    throw new Error("Admin email is required.");
  }

  if (!admin.role) {
    throw new Error("Admin role is required.");
  }

  const token = await new SignJWT({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  })
    .setProtectedHeader({
      alg: JWT_ALGORITHM,
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  return token;
}

/**
 * =========================================================
 * VERIFY ADMIN JWT
 * =========================================================
 */

export async function verifyAdminJWT(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    if (!token) {
      return null;
    }

    const result = await jwtVerify(
      token,
      JWT_SECRET,
      {
        algorithms: [JWT_ALGORITHM],
      }
    );

    const payload: JWTPayload = result.payload;

    /**
     * Validate the custom payload fields.
     * Do not trust a JWT only because its signature is valid.
     */
    if (
      typeof payload.adminId !== "string" ||
      !payload.adminId
    ) {
      return null;
    }

    if (
      typeof payload.email !== "string" ||
      !payload.email
    ) {
      return null;
    }

    if (
      typeof payload.role !== "string" ||
      !payload.role
    ) {
      return null;
    }

    return {
      adminId: payload.adminId,
      email: payload.email,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error(
      "Admin JWT verification failed:",
      error
    );

    return null;
  }
}
