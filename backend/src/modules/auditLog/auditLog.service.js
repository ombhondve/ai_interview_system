import AuditLog from "./auditLog.model.js";

/**
 * Record an administrative audit log event
 */
export async function createAuditLog({
  actor,
  action,
  targetId,
  beforeState = null,
  afterState = null,
  details = null,
  ipAddress = null,
}) {
  try {
    const log = await AuditLog.create({
      actor: actor || "system",
      action,
      targetId,
      beforeState,
      afterState,
      details,
      ipAddress,
      timestamp: new Date(),
    });
    return log;
  } catch (error) {
    console.error("Failed to create audit log:", error.message);
    return null;
  }
}

/**
 * Get audit logs with pagination and filtering
 */
export async function getAuditLogs({
  action,
  actor,
  page = 1,
  limit = 20,
} = {}) {
  const query = {};
  if (action) query.action = action;
  if (actor) query.actor = actor;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / safeLimit),
  };
}

export default {
  createAuditLog,
  getAuditLogs,
};
