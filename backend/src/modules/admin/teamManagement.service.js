import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Admin from "./admin.model.js";
import { createAuditLog } from "../auditLog/auditLog.service.js";
import { notifyAdmins } from "../notifications/notification.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeAdmin(admin) {
  if (!admin) return null;
  const obj = admin.toObject ? admin.toObject() : { ...admin };
  delete obj.passwordHash;
  return {
    id: String(obj._id || obj.id),
    name: obj.name,
    email: obj.email,
    role: obj.role,
    status: obj.status || "active",
    lastLogin: obj.lastLogin || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

/**
 * List team members with filters, pagination, and overview metrics
 */
export async function getTeamMembers({
  search,
  role,
  status,
  page = 1,
  limit = 20,
}) {
  const query = {};

  if (role && role !== "all" && role !== "All") {
    query.role = role.toLowerCase() === "super admin" ? "superadmin" : role.toLowerCase();
  }

  if (status && status !== "all" && status !== "All") {
    query.status = status.toLowerCase();
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [members, total, totalAdmins, activeAdmins, superAdminCount, recruiterCount] =
    await Promise.all([
      Admin.find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Admin.countDocuments(query),
      Admin.countDocuments(),
      Admin.countDocuments({ status: { $ne: "inactive" } }),
      Admin.countDocuments({ role: "superadmin" }),
      Admin.countDocuments({ role: "recruiter" }),
    ]);

  // If no DB admins exist yet, provide the configured env-admin in the list
  const sanitizedMembers = members.map((m) => ({
    id: String(m._id),
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status || "active",
    lastLogin: m.lastLogin || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

  return {
    members: sanitizedMembers,
    total: Math.max(total, sanitizedMembers.length),
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((Math.max(total, sanitizedMembers.length)) / limitNum) || 1,
    overview: {
      totalAdmins: Math.max(totalAdmins, sanitizedMembers.length),
      activeAdmins: Math.max(activeAdmins, sanitizedMembers.filter((m) => m.status === "active").length),
      superAdminCount: Math.max(superAdminCount, sanitizedMembers.filter((m) => m.role === "superadmin").length),
      recruiterCount: Math.max(recruiterCount, sanitizedMembers.filter((m) => m.role === "recruiter").length),
    },
  };
}

/**
 * Create a new team member with validation and audit logging
 */
export async function createTeamMember({
  actor,
  name,
  email,
  role = "recruiter",
  password,
  ipAddress = null,
}) {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = role === "Super Admin" || role === "superadmin" ? "superadmin" : "recruiter";

  if (!trimmedName || trimmedName.length < 2) {
    const error = new Error("Name must be at least 2 characters.");
    error.statusCode = 400;
    throw error;
  }

  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!password || String(password).length < 8) {
    const error = new Error("Password must be at least 8 characters long.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await Admin.findOne({ email: trimmedEmail });
  if (existing) {
    const error = new Error("An administrator with this email address already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(String(password), 12);

  const newAdmin = await Admin.create({
    name: trimmedName,
    email: trimmedEmail,
    role: normalizedRole,
    passwordHash,
    status: "active",
  });

  const sanitized = sanitizeAdmin(newAdmin);

  // Audit log
  await createAuditLog({
    actor: actor?.id || "system",
    action: "TEAM_MEMBER_CREATED",
    targetId: newAdmin._id,
    afterState: sanitized,
    details: { createdBy: actor?.email },
    ipAddress,
  });

  // Notification to admins
  await notifyAdmins({
    type: "team_member_added",
    title: "New Team Member Added",
    message: `${trimmedName} (${trimmedEmail}) was added as ${normalizedRole === "superadmin" ? "Super Admin" : "Recruiter"}.`,
    entityType: "team",
    entityId: String(newAdmin._id),
    actionUrl: "/admin/settings",
    dedupKeyPrefix: `team_add_${newAdmin._id}`,
  });

  return sanitized;
}

/**
 * Update an existing team member with role safeguards
 */
export async function updateTeamMember({
  actor,
  adminId,
  name,
  role,
  status,
  password,
  ipAddress = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    const error = new Error("Invalid team member ID.");
    error.statusCode = 400;
    throw error;
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    const error = new Error("Team member not found.");
    error.statusCode = 404;
    throw error;
  }

  const beforeState = sanitizeAdmin(admin);

  // Safeguard: Demoting the last superadmin
  if (role) {
    const targetRole = role === "Super Admin" || role === "superadmin" ? "superadmin" : "recruiter";
    if (admin.role === "superadmin" && targetRole === "recruiter") {
      const activeSuperAdmins = await Admin.countDocuments({
        role: "superadmin",
        status: { $ne: "inactive" },
      });
      if (activeSuperAdmins <= 1) {
        const error = new Error("Cannot demote the last active Super Admin. Assign another Super Admin first.");
        error.statusCode = 400;
        throw error;
      }
    }
    admin.role = targetRole;
  }

  // Safeguard: Deactivating self or last superadmin
  if (status) {
    const targetStatus = status.toLowerCase();
    if (targetStatus === "inactive" && admin.status === "active") {
      if (String(actor?.id) === String(admin._id)) {
        const error = new Error("You cannot deactivate your own account.");
        error.statusCode = 400;
        throw error;
      }
      if (admin.role === "superadmin") {
        const activeSuperAdmins = await Admin.countDocuments({
          role: "superadmin",
          status: "active",
        });
        if (activeSuperAdmins <= 1) {
          const error = new Error("Cannot deactivate the last active Super Admin.");
          error.statusCode = 400;
          throw error;
        }
      }
    }
    if (["active", "inactive"].includes(targetStatus)) {
      admin.status = targetStatus;
    }
  }

  if (name && typeof name === "string" && name.trim().length >= 2) {
    admin.name = name.trim();
  }

  if (password && String(password).length >= 8) {
    admin.passwordHash = await bcrypt.hash(String(password), 12);
  }

  await admin.save();
  const afterState = sanitizeAdmin(admin);

  // Audit log
  await createAuditLog({
    actor: actor?.id || "system",
    action: "TEAM_MEMBER_UPDATED",
    targetId: admin._id,
    beforeState,
    afterState,
    details: { updatedBy: actor?.email },
    ipAddress,
  });

  // Notification
  await notifyAdmins({
    type: "team_member_updated",
    title: "Team Member Updated",
    message: `${admin.name}'s account details were updated by ${actor?.email || "an administrator"}.`,
    entityType: "team",
    entityId: String(admin._id),
    actionUrl: "/admin/settings",
    dedupKeyPrefix: `team_update_${admin._id}_${Date.now()}`,
  });

  return afterState;
}

/**
 * Toggle team member active/inactive status
 */
export async function toggleTeamMemberStatus({
  actor,
  adminId,
  status,
  ipAddress = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    const error = new Error("Invalid team member ID.");
    error.statusCode = 400;
    throw error;
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    const error = new Error("Team member not found.");
    error.statusCode = 404;
    throw error;
  }

  const newStatus = status ? status.toLowerCase() : admin.status === "active" ? "inactive" : "active";

  // Safeguards when deactivating
  if (newStatus === "inactive") {
    if (String(actor?.id) === String(admin._id)) {
      const error = new Error("You cannot deactivate your own account.");
      error.statusCode = 400;
      throw error;
    }

    if (admin.role === "superadmin") {
      const activeSuperAdmins = await Admin.countDocuments({
        role: "superadmin",
        status: "active",
      });
      if (activeSuperAdmins <= 1) {
        const error = new Error("Cannot deactivate the last active Super Admin.");
        error.statusCode = 400;
        throw error;
      }
    }
  }

  const beforeState = sanitizeAdmin(admin);
  admin.status = newStatus;
  await admin.save();
  const afterState = sanitizeAdmin(admin);

  await createAuditLog({
    actor: actor?.id || "system",
    action: newStatus === "active" ? "TEAM_MEMBER_ACTIVATED" : "TEAM_MEMBER_DEACTIVATED",
    targetId: admin._id,
    beforeState,
    afterState,
    details: { toggledBy: actor?.email },
    ipAddress,
  });

  await notifyAdmins({
    type: "team_member_updated",
    title: `Team Member ${newStatus === "active" ? "Activated" : "Deactivated"}`,
    message: `${admin.name} was ${newStatus === "active" ? "reactivated" : "deactivated"} by ${actor?.email || "an administrator"}.`,
    entityType: "team",
    entityId: String(admin._id),
    actionUrl: "/admin/settings",
  });

  return afterState;
}

/**
 * Delete a team member with safeguards
 */
export async function deleteTeamMember({
  actor,
  adminId,
  ipAddress = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    const error = new Error("Invalid team member ID.");
    error.statusCode = 400;
    throw error;
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    const error = new Error("Team member not found.");
    error.statusCode = 404;
    throw error;
  }

  // Safeguard: Cannot delete self
  if (String(actor?.id) === String(admin._id)) {
    const error = new Error("You cannot delete your own account.");
    error.statusCode = 400;
    throw error;
  }

  // Safeguard: Cannot delete last superadmin
  if (admin.role === "superadmin") {
    const superAdminCount = await Admin.countDocuments({
      role: "superadmin",
    });
    if (superAdminCount <= 1) {
      const error = new Error("Cannot delete the last Super Admin.");
      error.statusCode = 400;
      throw error;
    }
  }

  const beforeState = sanitizeAdmin(admin);
  await Admin.findByIdAndDelete(adminId);

  await createAuditLog({
    actor: actor?.id || "system",
    action: "TEAM_MEMBER_DELETED",
    targetId: admin._id,
    beforeState,
    afterState: null,
    details: { deletedBy: actor?.email },
    ipAddress,
  });

  await notifyAdmins({
    type: "team_member_updated",
    title: "Team Member Removed",
    message: `${admin.name} (${admin.email}) was removed by ${actor?.email || "an administrator"}.`,
    entityType: "team",
    entityId: String(admin._id),
    actionUrl: "/admin/settings",
  });

  return { success: true, message: "Team member removed successfully." };
}

export default {
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  toggleTeamMemberStatus,
  deleteTeamMember,
};
