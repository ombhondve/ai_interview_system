import { getAuditLogs, getAuditLogById } from "./auditLog.service.js";

export async function listLogs(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      action = "",
      actor = "",
      targetType = "",
      outcome = "",
      startDate = "",
      endDate = "",
    } = req.query;

    const result = await getAuditLogs({
      page,
      limit,
      search,
      action,
      actor,
      targetType,
      outcome,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Failed to list audit logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs.",
    });
  }
}

export async function getLog(req, res) {
  try {
    const { id } = req.params;
    const log = await getAuditLogById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log entry not found.",
      });
    }

    return res.status(200).json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("Failed to get audit log:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit log entry.",
    });
  }
}

export default {
  listLogs,
  getLog,
};
