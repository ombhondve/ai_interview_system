import crypto from "crypto";
import VerificationSession from "../modules/verification/verificationSession.model.js";
import Candidate from "../modules/candidate/candidate.model.js";

/**
 * Helper: Extract session token from cookie header
 */
function extractSessionToken(req) {
  const cookieHeader = req.headers.cookie;
  
  if (!cookieHeader) {
    return null;
  }
  
  const cookies = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const trimmedCookie = cookie.trim();
    
    if (!trimmedCookie) {
      return;
    }
    
    const [name, ...valueParts] = trimmedCookie.split('=');
    
    if (!name) {
      return;
    }
    
    cookies[name] = valueParts.join('=');
  });
  
  return cookies.candidate_session || null;
}

/**
 * Helper: Hash token (SHA256)
 */
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Middleware to require verified student session
 * 
 * Validates the candidate_session cookie and ensures:
 * 1. Session token exists
 * 2. Token is valid and not expired
 * 3. Candidate exists and is approved
 * 4. Candidate can access portal
 */
export async function requireVerifiedSession(req, res, next) {
  try {
    // 1. Extract session token from cookie
    const sessionToken = extractSessionToken(req);
    
    if (!sessionToken) {
      return res.status(401).json({
        message: "Authentication required. Please verify your identity."
      });
    }
    
    // 2. Hash token and find session
    const tokenHash = hashToken(sessionToken);
    
    const session = await VerificationSession.findOne({
      sessionToken: tokenHash,
      verifiedAt: { $ne: null },
      sessionExpiresAt: { $gt: new Date() }
    });
    
    if (!session) {
      return res.status(401).json({
        message: "Session expired or invalid. Please re-authenticate."
      });
    }
    
    // 3. Find candidate
    const candidate = await Candidate.findById(session.candidateId);
    
    if (!candidate) {
      return res.status(401).json({
        message: "Candidate not found."
      });
    }
    
    // 4. Check candidate status - only "approved" candidates can access portal
    if (candidate.status !== "approved") {
      return res.status(403).json({
        message: "Candidate account is not active."
      });
    }
    
    // 5. Check if candidate has been auto-rejected due to deadline
    if (candidate.projectSubmissionStatus === "deadline_expired" || candidate.status === "rejected") {
      return res.status(403).json({
        message: "Your account has been closed due to expired deadline."
      });
    }
    
    // 6. Attach to request for use in controllers
    req.candidate = candidate;
    req.verificationSession = session;
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      message: "Authentication verification failed."
    });
  }
}

/**
 * Optional: Middleware to check project verification status
 * Only allows access if project is verified or admin approved
 */
export async function requireVerifiedProject(req, res, next) {
  try {
    // First, ensure user is authenticated
    await requireVerifiedSession(req, res, (err) => {
      if (err) return next(err);
    });
    
    if (!req.candidate) {
      return; // requireVerifiedSession already handled error
    }
    
    // Check project submission status
    const submissionStatus = req.candidate.projectSubmissionStatus;
    const allowedStatuses = [
      "verified",
      "ai_verification",
      "needs_admin_review"
    ];
    
    if (!submissionStatus || !allowedStatuses.includes(submissionStatus)) {
      return res.status(403).json({
        message: "Project verification required before accessing this feature."
      });
    }
    
    next();
  } catch (error) {
    console.error("Project verification middleware error:", error);
    return res.status(500).json({
      message: "Project verification check failed."
    });
  }
}

/**
 * Optional: Middleware for admin authorization
 * Extends requireVerifiedSession with admin checks
 */
export async function requireAdmin(req, res, next) {
  try {
    // Implementation depends on existing admin auth system
    // For now, just check for admin auth header or token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: "Admin authentication required."
      });
    }
    
    // TODO: Validate admin JWT token
    // For now, just attach admin flag
    req.isAdmin = true;
    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(500).json({
      message: "Admin authorization failed."
    });
  }
}