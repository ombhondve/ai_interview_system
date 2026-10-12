import { getRecruitmentAnalytics } from "./analytics.service.js";

export async function getAnalytics(req, res) {
  try {
    const {
      range = "30d",
      startDate = "",
      endDate = "",
      role = "",
      status = "",
      projectStatus = "",
      interviewStatus = "",
      decision = "",
    } = req.query;

    const data = await getRecruitmentAnalytics({
      range,
      startDate,
      endDate,
      role,
      status,
      projectStatus,
      interviewStatus,
      decision,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to compute analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate recruitment analytics.",
    });
  }
}

export default {
  getAnalytics,
};
