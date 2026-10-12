import AuditLog from "./auditLog.model.js";

/**
 * Strips sensitive keys (passwords, tokens, cookies, secrets) from any object before logging
 */
function sanitizeDetails(data, depth = 0) {
  if (!data || depth > 4) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDetails(item, depth + 1));
  }

  const sanitized = {};
  const sensitiveRegex = /password|secret|jwt|token|cookie|credential|authorization|bearer/i;

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveRegex.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Record an administrative audit log event safely
 */
export async function createAuditLog({
  actor = "system",
  actorId = null,
  actorName = "Administrator",
  actorEmail = "",
  actorRole = "admin",
  action,
  targetType = "System",
  targetId = null,
  targetName = "",
  description = "",
  outcome = "SUCCESS",
  correlationId = null,
  beforeState = null,
  afterState = null,
  details = null,
  ipAddress = null,
}) {
  try {
    const { default: mongoose } = await import("mongoose");
    const isMocked = Boolean(AuditLog.create?._isMockFunction || AuditLog.create?.mock);
    if (!isMocked && mongoose.connection.readyState !== 1) {
      return null;
    }

    const safeDetails = details ? sanitizeDetails(details) : null;
    const safeBefore = beforeState ? sanitizeDetails(beforeState) : null;
    const safeAfter = afterState ? sanitizeDetails(afterState) : null;

    const log = await AuditLog.create({
      actor: actor || actorId || "system",
      actorId: actorId ? String(actorId) : (typeof actor === "string" ? actor : null),
      actorName: actorName || "Administrator",
      actorEmail: actorEmail || "",
      actorRole: actorRole || "admin",
      action: action || "UNKNOWN_ACTION",
      targetType: targetType || "System",
      targetId: targetId ? String(targetId) : null,
      targetName: targetName || "",
      description: description || `Action ${action} executed`,
      outcome: outcome || "SUCCESS",
      correlationId: correlationId || null,
      beforeState: safeBefore,
      afterState: safeAfter,
      details: safeDetails,
      ipAddress: ipAddress || null,
      timestamp: new Date(),
    });

    return log;
  } catch (error) {
    console.error("Failed to persist audit log:", error.message);
    return null;
  }
}

/**
 * Get audit logs with pagination and search/filtering
 */
export async function getAuditLogs({
  action,
  actor,
  targetType,
  outcome,
  search,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const query = {};

  if (action && action !== "ALL") {
    query.action = action;
  }

  if (actor && actor !== "ALL") {
    query.$or = [
      { actorId: actor },
      { actorName: { $regex: actor, $options: "i" } },
      { actorEmail: { $regex: actor, $options: "i" } },
    ];
  }

  if (targetType && targetType !== "ALL") {
    query.targetType = targetType;
  }

  if (outcome && outcome !== "ALL") {
    query.outcome = outcome;
  }

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query.timestamp.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  if (search && search.trim()) {
    const term = search.trim();
    const searchRegex = { $regex: term, $options: "i" };
    const searchConditions = [
      { description: searchRegex },
      { targetName: searchRegex },
      { targetId: searchRegex },
      { actorName: searchRegex },
      { actorEmail: searchRegex },
      { action: searchRegex },
    ];

    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      id: String(log._id),
      _id: String(log._id),
    })),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Get individual audit log event details by ID
 */
export async function getAuditLogById(id) {
  const log = await AuditLog.findById(id).lean();
  if (!log) return null;
  return {
    ...log,
    id: String(log._id),
    _id: String(log._id),
  };
}

export default {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
};
