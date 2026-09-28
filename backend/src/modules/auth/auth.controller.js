import jwt from "jsonwebtoken";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

function getCredentials() {
  return {
    email: (process.env.DEMO_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase(),
    password: process.env.DEMO_ADMIN_PASSWORD || "Admin@123",
  };
}

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

function getAdmin() {
  const credentials = getCredentials();
  return {
    id: process.env.DEMO_ADMIN_ID || "env-admin",
    name: process.env.DEMO_ADMIN_NAME || "Admin User",
    email: credentials.email,
    role: process.env.DEMO_ADMIN_ROLE || "superadmin",
    active: true,
  };
}

export async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const credentials = getCredentials();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (email !== credentials.email || password !== credentials.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const admin = getAdmin();
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      getSecret(),
      { expiresIn: "8h" }
    );

    res.cookie("recruitai_admin", token, cookieOptions);
    return res.status(200).json({ user: admin });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Unable to login." });
  }
}

export async function me(req, res) {
  try {
    const token = req.cookies?.recruitai_admin;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, getSecret());
    if (!payload || typeof payload !== "object" || !payload.adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({ user: getAdmin() });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export async function logout(req, res) {
  res.clearCookie("recruitai_admin", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully" });
}
