import enhancedSlotService from "./enhancedSlot.service.js";
import SlotTemplate from "./slotTemplate.model.js";
import logger from "../../utils/logger.js";

/**
 * Enhanced Slot Controller
 * 
 * API endpoints for advanced slot management
 */

/**
 * Create slot (admin only)
 */
export const createSlot = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    const slotData = req.body;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    // Validate required fields
    if (!slotData.startTime || !slotData.endTime) {
      return res.status(400).json({
        success: false,
        error: "startTime and endTime are required"
      });
    }
    
    // Convert string dates to Date objects
    slotData.startTime = new Date(slotData.startTime);
    slotData.endTime = new Date(slotData.endTime);
    
    const result = await enhancedSlotService.createSlot(slotData, adminId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      message: result.message || "Slot created successfully",
      data: result.slot || result.parentSlot || result.slots,
      metadata: {
        totalCreated: result.totalCreated || 1,
        slotType: slotData.slotType || "single"
      }
    });
    
  } catch (error) {
    logger.error("Failed to create slot:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get available slots with advanced filtering
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const filters = {
      candidateRole: req.query.role,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      timezone: req.query.timezone,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      minDuration: req.query.minDuration ? parseInt(req.query.minDuration) : undefined,
      maxDuration: req.query.maxDuration ? parseInt(req.query.maxDuration) : undefined,
      location: req.query.location,
      slotType: req.query.slotType,
      excludeTags: req.query.excludeTags ? req.query.excludeTags.split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    const result = await enhancedSlotService.getAvailableSlots(filters);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      data: {
        slots: result.slots,
        total: result.total,
        filtersApplied: result.filtersApplied
      },
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.slots.length === filters.limit
      }
    });
    
  } catch (error) {
    logger.error("Failed to get available slots:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Check candidate eligibility for a slot
 */
export const checkEligibility = async (req, res) => {
  try {
    const { slotId } = req.params;
    const candidateId = req.query.candidateId || req.candidate?._id;
    
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: "candidateId is required"
      });
    }
    
    if (!slotId) {
      return res.status(400).json({
        success: false,
        error: "slotId is required"
      });
    }
    
    const result = await enhancedSlotService.checkCandidateEligibility(slotId, candidateId);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error("Failed to check eligibility:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Detect conflicts for slot booking
 */
export const detectConflicts = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { candidateId } = req.body;
    
    if (!candidateId || !slotId) {
      return res.status(400).json({
        success: false,
        error: "slotId and candidateId are required"
      });
    }
    
    const result = await enhancedSlotService.detectConflicts(slotId, candidateId);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error("Failed to detect conflicts:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Create slot template (admin only)
 */
export const createSlotTemplate = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    const templateData = req.body;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    // Add creator and organization info
    const enhancedTemplateData = {
      ...templateData,
      createdBy: adminId
    };
    
    const template = new SlotTemplate(enhancedTemplateData);
    await template.save();
    
    res.status(201).json({
      success: true,
      message: "Slot template created successfully",
      data: template
    });
    
  } catch (error) {
    logger.error("Failed to create slot template:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Generate slots from template (admin only)
 */
export const generateSlotsFromTemplate = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    const { templateId, startDate, endDate, timezone } = req.body;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    if (!templateId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "templateId, startDate, and endDate are required"
      });
    }
    
    const result = await enhancedSlotService.generateSlotsFromTemplate(
      templateId,
      new Date(startDate),
      new Date(endDate),
      timezone || "Asia/Kolkata",
      adminId
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      message: `Generated ${result.totalGenerated} slots from template`,
      data: {
        template: result.template,
        slots: result.slots,
        totalGenerated: result.totalGenerated
      }
    });
    
  } catch (error) {
    logger.error("Failed to generate slots from template:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get slot templates (admin only)
 */
export const getSlotTemplates = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    const { status, limit = 20, offset = 0 } = req.query;
    
    const query = { createdBy: adminId };
    if (status) query.status = status;
    
    const templates = await SlotTemplate.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    const total = await SlotTemplate.countDocuments(query);
    
    res.json({
      success: true,
      data: templates,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + templates.length < total
      }
    });
    
  } catch (error) {
    logger.error("Failed to get slot templates:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Update slot template (admin only)
 */
export const updateSlotTemplate = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    const { templateId } = req.params;
    const updates = req.body;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    // Check ownership
    const template = await SlotTemplate.findOne({
      _id: templateId,
      createdBy: adminId
    });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found or access denied"
      });
    }
    
    // Update template
    Object.assign(template, updates);
    await template.save();
    
    res.json({
      success: true,
      message: "Slot template updated successfully",
      data: template
    });
    
  } catch (error) {
    logger.error("Failed to update slot template:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Delete slot template (admin only)
 */
export const deleteSlotTemplate = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    const { templateId } = req.params;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    // Check ownership and delete
    const result = await SlotTemplate.findOneAndDelete({
      _id: templateId,
      createdBy: adminId
    });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Template not found or access denied"
      });
    }
    
    res.json({
      success: true,
      message: "Slot template deleted successfully"
    });
    
  } catch (error) {
    logger.error("Failed to delete slot template:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Get slot statistics (admin only)
 */
export const getSlotStatistics = async (req, res) => {
  try {
    const adminId = req.user?.id || req.headers['x-admin-id'];
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required"
      });
    }
    
    const { startDate, endDate } = req.query;
    
    const match = { createdBy: adminId };
    
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    // Aggregate statistics
    const stats = await SlotTemplate.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSlotsGenerated: { $sum: "$usageStats.totalSlotsGenerated" },
          avgUsage: { $avg: "$usageStats.timesUsed" }
        }
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          totalSlotsGenerated: 1,
          avgUsage: { $round: ["$avgUsage", 2] }
        }
      }
    ]);
    
    // Get total counts
    const totalTemplates = await SlotTemplate.countDocuments(match);
    const activeTemplates = await SlotTemplate.countDocuments({ ...match, status: "active" });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTemplates,
          activeTemplates,
          inactiveTemplates: totalTemplates - activeTemplates
        },
        statusBreakdown: stats,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error("Failed to get slot statistics:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

/**
 * Health check for slot management system
 */
export const slotHealthCheck = async (req, res) => {
  try {
    // Check database connection
    const slotCount = await SlotTemplate.countDocuments();
    const templateCount = await SlotTemplate.countDocuments();
    
    const health = {
      service: "enhanced-slot-management",
      status: "healthy",
      timestamp: new Date().toISOString(),
      stats: {
        slotsInSystem: slotCount,
        templatesInSystem: templateCount,
        memoryUsage: process.memoryUsage()
      },
      checks: {
        database: "connected",
        service: "operational",
        cache: "enabled"
      }
    };
    
    res.json({
      success: true,
      data: health
    });
    
  } catch (error) {
    logger.error("Slot health check failed:", error);
    res.status(500).json({
      success: false,
      service: "enhanced-slot-management",
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};