import * as teamService from "./teamManagement.service.js";

export async function listTeamMembers(req, res) {
  try {
    const { search, role, status, page, limit } = req.query;
    const result = await teamService.getTeamMembers({
      search,
      role,
      status,
      page,
      limit,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error listing team members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list team members.",
      error: error.message,
    });
  }
}

export async function addTeamMember(req, res) {
  try {
    const { name, email, role, password } = req.body;
    const result = await teamService.createTeamMember({
      actor: req.user,
      name,
      email,
      role,
      password,
      ipAddress: req.ip,
    });
    return res.status(201).json({
      success: true,
      message: "Team member created successfully.",
      member: result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create team member.",
    });
  }
}

export async function editTeamMember(req, res) {
  try {
    const { id } = req.params;
    const { name, role, status, password } = req.body;
    const result = await teamService.updateTeamMember({
      actor: req.user,
      adminId: id,
      name,
      role,
      status,
      password,
      ipAddress: req.ip,
    });
    return res.status(200).json({
      success: true,
      message: "Team member updated successfully.",
      member: result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update team member.",
    });
  }
}

export async function changeTeamMemberStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await teamService.toggleTeamMemberStatus({
      actor: req.user,
      adminId: id,
      status,
      ipAddress: req.ip,
    });
    return res.status(200).json({
      success: true,
      message: `Team member ${result.status === "active" ? "activated" : "deactivated"} successfully.`,
      member: result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update team member status.",
    });
  }
}

export async function removeTeamMember(req, res) {
  try {
    const { id } = req.params;
    const result = await teamService.deleteTeamMember({
      actor: req.user,
      adminId: id,
      ipAddress: req.ip,
    });
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to remove team member.",
    });
  }
}
