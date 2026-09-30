import Slot from "./slot.model.js";
import SlotTemplate from "./slotTemplate.model.js";
import Candidate from "../candidate/candidate.model.js";
import logger from "../../utils/logger.js";

/**
 * Enhanced Slot Service
 * 
 * Provides advanced slot management functionality including:
 * - Recurring slot creation
 * - Batch slot generation
 * - Advanced filtering and search
 * - Conflict detection
 * - Slot template management
 */

class EnhancedSlotService {
  constructor() {
    this.timezoneUtils = this.getTimezoneUtils();
  }

  /**
   * Create single slot with enhanced validation
   */
  async createSlot(slotData, adminId) {
    try {
      logger.info(`Creating slot for admin ${adminId}`);
      
      // Validate slot data
      await this.validateSlotData(slotData);
      
      // Add metadata
      const enhancedSlotData = {
        ...slotData,
        createdBy: adminId,
        metadata: {
          ...slotData.metadata,
          source: slotData.metadata?.source || "manual",
          syncStatus: "pending"
        }
      };
      
      // Handle recurring slots
      if (slotData.slotType === "recurring" && slotData.recurrencePattern) {
        return await this.createRecurringSlots(enhancedSlotData, adminId);
      }
      
      // Handle batch slots
      if (slotData.slotType === "batch") {
        return await this.createBatchSlots(enhancedSlotData, adminId);
      }
      
      // Create single slot
      const slot = new Slot(enhancedSlotData);
      await slot.save();
      
      logger.info(`Created single slot ${slot._id}`);
      
      return {
        success: true,
        slot,
        message: "Slot created successfully"
      };
      
    } catch (error) {
      logger.error(`Failed to create slot:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create recurring slots based on pattern
   */
  async createRecurringSlots(baseSlotData, adminId) {
    try {
      const { recurrencePattern, ...slotData } = baseSlotData;
      const { frequency, interval, daysOfWeek, endDate, occurrences } = recurrencePattern;
      
      const slots = [];
      const parentSlot = new Slot({
        ...slotData,
        slotType: "recurring",
        recurrencePattern: {
          ...recurrencePattern,
          parentSlotId: null,
          isRecurringInstance: false
        }
      });
      
      await parentSlot.save();
      
      // Generate recurring instances
      const instances = this.generateRecurringInstances(
        parentSlot.startTime,
        frequency,
        interval,
        daysOfWeek,
        endDate,
        occurrences
      );
      
      for (const instanceStartTime of instances) {
        const instanceSlot = new Slot({
          ...slotData,
          startTime: instanceStartTime,
          endTime: new Date(instanceStartTime.getTime() + 
            (parentSlot.endTime - parentSlot.startTime)),
          slotType: "recurring",
          recurrencePattern: {
            ...recurrencePattern,
            parentSlotId: parentSlot._id,
            isRecurringInstance: true
          }
        });
        
        await instanceSlot.save();
        slots.push(instanceSlot);
      }
      
      logger.info(`Created ${slots.length} recurring slots from parent ${parentSlot._id}`);
      
      return {
        success: true,
        parentSlot,
        instances: slots,
        totalCreated: slots.length + 1
      };
      
    } catch (error) {
      logger.error(`Failed to create recurring slots:`, error);
      throw error;
    }
  }

  /**
   * Create batch interview slots
   */
  async createBatchSlots(batchData, adminId) {
    try {
      const { batchInfo, ...slotData } = batchData;
      
      // Create batch slots based on group size and duration
      const slots = [];
      const groupSize = batchInfo.groupSize || 1;
      const totalCandidates = slotData.capacity || 1;
      const groups = Math.ceil(totalCandidates / groupSize);
      
      // Calculate slot duration per group
      const baseDuration = slotData.endTime - slotData.startTime;
      const groupDuration = baseDuration / groups;
      
      for (let i = 0; i < groups; i++) {
        const groupStartTime = new Date(slotData.startTime.getTime() + (groupDuration * i));
        const groupEndTime = new Date(groupStartTime.getTime() + groupDuration);
        
        const batchSlot = new Slot({
          ...slotData,
          startTime: groupStartTime,
          endTime: groupEndTime,
          slotType: "batch",
          capacity: Math.min(groupSize, totalCandidates - (i * groupSize)),
          batchInfo: {
            ...batchInfo,
            batchIndex: i + 1,
            totalBatches: groups
          }
        });
        
        await batchSlot.save();
        slots.push(batchSlot);
      }
      
      logger.info(`Created ${slots.length} batch slots`);
      
      return {
        success: true,
        slots,
        batchInfo: {
          totalBatches: groups,
          totalCapacity: totalCandidates,
          groupSize
        }
      };
      
    } catch (error) {
      logger.error(`Failed to create batch slots:`, error);
      throw error;
    }
  }

  /**
   * Generate slots from template
   */
  async generateSlotsFromTemplate(templateId, startDate, endDate, timezone, adminId) {
    try {
      const template = await SlotTemplate.findById(templateId);
      
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      // Generate slots using template method
      const slotDataArray = template.generateSlots(startDate, endDate, timezone);
      
      const slots = [];
      for (const slotData of slotDataArray) {
        const slot = new Slot({
          ...slotData,
          createdBy: adminId,
          metadata: {
            source: "template",
            templateId: template._id,
            syncStatus: "pending"
          }
        });
        
        await slot.save();
        slots.push(slot);
      }
      
      // Update template usage stats
      await SlotTemplate.findByIdAndUpdate(templateId, {
        $inc: {
          "usageStats.timesUsed": 1,
          "usageStats.totalSlotsGenerated": slots.length
        },
        $set: {
          "usageStats.lastUsed": new Date()
        }
      });
      
      logger.info(`Generated ${slots.length} slots from template ${templateId}`);
      
      return {
        success: true,
        template,
        slots,
        totalGenerated: slots.length
      };
      
    } catch (error) {
      logger.error(`Failed to generate slots from template:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available slots with advanced filtering
   */
  async getAvailableSlots(filters = {}) {
    try {
      const {
        candidateRole,
        startDate,
        endDate,
        timezone,
        tags,
        minDuration,
        maxDuration,
        location,
        slotType,
        excludeTags,
        limit = 50,
        offset = 0
      } = filters;
      
      const now = new Date();
      
      // Build query
      const query = {
        status: "open",
        startTime: { $gt: now },
        $expr: { $lt: ["$bookedCount", "$capacity"] }
      };
      
      // Date range filtering
      if (startDate || endDate) {
        query.startTime = { ...query.startTime };
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }
      
      // Role filtering
      if (candidateRole && candidateRole.trim()) {
        query.$or = [
          { applicableRoles: [] },
          { applicableRoles: candidateRole }
        ];
      }
      
      // Tags filtering
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }
      
      // Exclude tags
      if (excludeTags && excludeTags.length > 0) {
        query.tags = query.tags || {};
        query.tags.$nin = excludeTags;
      }
      
      // Location filtering
      if (location) {
        query.location = new RegExp(location, "i");
      }
      
      // Slot type filtering
      if (slotType) {
        query.slotType = slotType;
      }
      
      // Duration filtering (virtual field calculation)
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            duration: {
              $divide: [
                { $subtract: ["$endTime", "$startTime"] },
                1000 * 60 // Convert to minutes
              ]
            },
            availableSeats: { $subtract: ["$capacity", "$bookedCount"] },
            isAvailable: {
              $and: [
                { $eq: ["$status", "open"] },
                { $lt: ["$bookedCount", "$capacity"] },
                { $gt: ["$startTime", now] }
              ]
            }
          }
        }
      ];
      
      // Duration filters
      const durationFilters = [];
      if (minDuration) {
        durationFilters.push({ $gte: ["$duration", minDuration] });
      }
      if (maxDuration) {
        durationFilters.push({ $lte: ["$duration", maxDuration] });
      }
      
      if (durationFilters.length > 0) {
        pipeline.push({
          $match: {
            $expr: {
              $and: durationFilters
            }
          }
        });
      }
      
      // Add booking window check
      pipeline.push({
        $addFields: {
          hoursUntilStart: {
            $divide: [
              { $subtract: ["$startTime", now] },
              1000 * 60 * 60
            ]
          },
          bookingWindowStatus: {
            $switch: {
              branches: [
                {
                  case: { $gt: ["$hoursUntilStart", "$bookingWindow.maxHoursBefore"] },
                  then: "too_early"
                },
                {
                  case: { $lt: ["$hoursUntilStart", "$bookingWindow.minHoursBefore"] },
                  then: "too_late"
                }
              ],
              default: "within_window"
            }
          }
        }
      });
      
      // Only include slots within booking window
      pipeline.push({
        $match: {
          bookingWindowStatus: "within_window"
        }
      });
      
      // Sort and paginate
      pipeline.push(
        { $sort: { startTime: 1 } },
        { $skip: offset },
        { $limit: limit },
        {
          $project: {
            id: "$_id",
            _id: 0,
            startTime: 1,
            endTime: 1,
            duration: 1,
            timezone: 1,
            capacity: 1,
            bookedCount: 1,
            availableSeats: 1,
            location: 1,
            meetLink: 1,
            tags: 1,
            slotType: 1,
            preparationTime: 1,
            bufferTime: 1,
            requirements: 1,
            applicableRoles: 1,
            isAvailable: 1,
            bookingWindowStatus: 1,
            hoursUntilStart: { $round: ["$hoursUntilStart", 1] }
          }
        }
      );
      
      const slots = await Slot.aggregate(pipeline);
      
      // Apply timezone conversion if specified
      const timezoneSlots = timezone 
        ? this.convertSlotsToTimezone(slots, timezone)
        : slots;
      
      return {
        success: true,
        slots: timezoneSlots,
        total: slots.length,
        filtersApplied: Object.keys(filters).filter(k => filters[k] !== undefined)
      };
      
    } catch (error) {
      logger.error("Error getting available slots:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check slot availability for specific candidate
   */
  async checkCandidateEligibility(slotId, candidateId) {
    try {
      const slot = await Slot.findById(slotId);
      const candidate = await Candidate.findById(candidateId);
      
      if (!slot) {
        return { eligible: false, reason: "Slot not found" };
      }
      
      if (!candidate) {
        return { eligible: false, reason: "Candidate not found" };
      }
      
      const eligibilityChecks = [];
      
      // 1. Check slot availability
      if (slot.status !== "open") {
        eligibilityChecks.push({ passed: false, reason: "Slot not available" });
      }
      
      if (slot.bookedCount >= slot.capacity) {
        eligibilityChecks.push({ passed: false, reason: "Slot is full" });
      }
      
      // 2. Check booking window
      const now = new Date();
      const hoursUntilStart = (slot.startTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilStart > slot.bookingWindow.maxHoursBefore) {
        eligibilityChecks.push({ passed: false, reason: "Booking too early" });
      }
      
      if (hoursUntilStart < slot.bookingWindow.minHoursBefore) {
        eligibilityChecks.push({ passed: false, reason: "Booking too late" });
      }
      
      // 3. Check role eligibility
      if (slot.applicableRoles.length > 0 && !slot.applicableRoles.includes(candidate.role)) {
        eligibilityChecks.push({ passed: false, reason: "Role not eligible" });
      }
      
      // 4. Check requirements
      if (slot.requirements.verifiedProject && 
          !["verified", "needs_admin_review"].includes(candidate.projectSubmissionStatus)) {
        eligibilityChecks.push({ passed: false, reason: "Project not verified" });
      }
      
      if (slot.requirements.completedProfile && !candidate.profileComplete) {
        eligibilityChecks.push({ passed: false, reason: "Profile incomplete" });
      }
      
      // 5. Check if already booked
      if (candidate.bookedSlotId) {
        eligibilityChecks.push({ passed: false, reason: "Already has booked slot" });
      }
      
      // 6. Check verification score
      if (slot.requirements.minVerificationScore > 0 &&
          candidate.projectSubmission?.aiVerificationResult?.confidence < 
          slot.requirements.minVerificationScore) {
        eligibilityChecks.push({ passed: false, reason: "Verification score too low" });
      }
      
      // Determine overall eligibility
      const failedChecks = eligibilityChecks.filter(check => !check.passed);
      const eligible = failedChecks.length === 0;
      
      return {
        eligible,
        checks: eligibilityChecks,
        failedChecks: failedChecks.map(check => check.reason),
        slotDetails: {
          id: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          available: slot.capacity - slot.bookedCount
        },
        candidateDetails: {
          id: candidate._id,
          role: candidate.role,
          projectStatus: candidate.projectSubmissionStatus,
          profileComplete: candidate.profileComplete,
          verificationScore: candidate.projectSubmission?.aiVerificationResult?.confidence || 0
        }
      };
      
    } catch (error) {
      logger.error(`Error checking eligibility:`, error);
      return {
        eligible: false,
        error: error.message
      };
    }
  }

  /**
   * Detect scheduling conflicts
   */
  async detectConflicts(slotId, candidateId) {
    try {
      const slot = await Slot.findById(slotId);
      const candidate = await Candidate.findById(candidateId);
      
      if (!slot || !candidate) {
        return { hasConflicts: true, conflicts: ["Invalid slot or candidate"] };
      }
      
      const conflicts = [];
      
      // Check for overlapping slots the candidate might have
      const overlappingSlots = await Slot.find({
        _id: { $ne: slotId },
        bookedBy: candidateId,
        status: { $in: ["booked", "scheduled"] },
        $or: [
          {
            startTime: { $lt: slot.endTime },
            endTime: { $gt: slot.startTime }
          }
        ]
      });
      
      if (overlappingSlots.length > 0) {
        conflicts.push({
          type: "TIME_OVERLAP",
          message: "Candidate has overlapping interview",
          overlappingSlots: overlappingSlots.map(s => ({
            id: s._id,
            startTime: s.startTime,
            endTime: s.endTime
          }))
        });
      }
      
      // Check for role conflicts
      if (slot.applicableRoles.length > 0 && !slot.applicableRoles.includes(candidate.role)) {
        conflicts.push({
          type: "ROLE_MISMATCH",
          message: `Candidate role "${candidate.role}" not in allowed roles: ${slot.applicableRoles.join(", ")}`
        });
      }
      
      // Check for double booking attempt
      const existingBooking = await Slot.findOne({
        bookedBy: candidateId,
        status: "booked",
        startTime: { $gt: new Date() }
      });
      
      if (existingBooking) {
        conflicts.push({
          type: "DOUBLE_BOOKING",
          message: "Candidate already has a booked slot",
          existingSlot: {
            id: existingBooking._id,
            startTime: existingBooking.startTime
          }
        });
      }
      
      // Check capacity conflicts
      if (slot.bookedCount >= slot.capacity) {
        conflicts.push({
          type: "CAPACITY_EXCEEDED",
          message: `Slot at capacity (${slot.bookedCount}/${slot.capacity})`
        });
      }
      
      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        conflictCount: conflicts.length
      };
      
    } catch (error) {
      logger.error(`Error detecting conflicts:`, error);
      return {
        hasConflicts: true,
        error: error.message
      };
    }
  }

  /**
   * Generate recurring slot instances
   */
  generateRecurringInstances(startTime, frequency, interval, daysOfWeek, endDate, maxOccurrences) {
    const instances = [];
    let currentDate = new Date(startTime);
    let occurrenceCount = 0;
    
    const maxDate = endDate ? new Date(endDate) : null;
    const maxCount = maxOccurrences || 365; // Safety limit
    
    while (occurrenceCount < maxCount) {
      if (maxDate && currentDate > maxDate) {
        break;
      }
      
      // Check if current date matches pattern
      if (this.matchesRecurrencePattern(currentDate, frequency, interval, daysOfWeek)) {
        instances.push(new Date(currentDate));
        occurrenceCount++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return instances;
  }

  /**
   * Check if date matches recurrence pattern
   */
  matchesRecurrencePattern(date, frequency, interval, daysOfWeek) {
    const dayOfWeek = date.getDay();
    
    switch (frequency) {
      case "daily":
        // Check interval
        const daysSinceEpoch = Math.floor(date / (1000 * 60 * 60 * 24));
        return daysSinceEpoch % interval === 0;
        
      case "weekly":
        // Check day of week
        if (daysOfWeek.length === 0) {
          // All days, check interval
          const weeksSinceEpoch = Math.floor(daysSinceEpoch / 7);
          return weeksSinceEpoch % interval === 0;
        }
        return daysOfWeek.includes(dayOfWeek);
        
      case "monthly":
        // Check day of month
        const dayOfMonth = date.getDate();
        return dayOfMonth % interval === 0;
        
      default:
        return false;
    }
  }

  /**
   * Convert slots to different timezone
   */
  convertSlotsToTimezone(slots, targetTimezone) {
    // In a real implementation, this would use a timezone library like moment-timezone
    // For now, return the slots as-is with timezone info
    return slots.map(slot => ({
      ...slot,
      displayTimezone: targetTimezone,
      localStartTime: this.convertToTimezone(slot.startTime, targetTimezone),
      localEndTime: this.convertToTimezone(slot.endTime, targetTimezone)
    }));
  }

  /**
   * Validate slot data
   */
  async validateSlotData(slotData) {
    const errors = [];
    
    // Check required fields
    if (!slotData.startTime || !slotData.endTime) {
      errors.push("startTime and endTime are required");
    }
    
    if (slotData.startTime >= slotData.endTime) {
      errors.push("endTime must be after startTime");
    }
    
    // Check capacity
    if (slotData.capacity < 1) {
      errors.push("capacity must be at least 1");
    }
    
    // Check buffer times
    const slotDuration = (slotData.endTime - slotData.startTime) / (1000 * 60);
    if (slotData.bufferTime) {
      const totalBuffer = (slotData.bufferTime.before || 0) + (slotData.bufferTime.after || 0);
      if (totalBuffer >= slotDuration) {
        errors.push("Buffer times cannot exceed slot duration");
      }
    }
    
    // Check booking window
    if (slotData.bookingWindow) {
      if (slotData.bookingWindow.maxHoursBefore <= slotData.bookingWindow.minHoursBefore) {
        errors.push("maxHoursBefore must be greater than minHoursBefore");
      }
    }
    
    // Check recurrence pattern if recurring
    if (slotData.slotType === "recurring" && slotData.recurrencePattern) {
      const { frequency, daysOfWeek } = slotData.recurrencePattern;
      
      if (frequency === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
        const invalidDays = daysOfWeek.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          errors.push("daysOfWeek must be 0-6 (Sunday-Saturday)");
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Slot validation failed: ${errors.join(", ")}`);
    }
  }

  /**
   * Get timezone utilities
   */
  getTimezoneUtils() {
    // In a real implementation, this would return timezone utility functions
    return {
      convertToTimezone: (date, timezone) => date,
      getTimezoneOffset: (timezone) => 0,
      getSupportedTimezones: () => ["Asia/Kolkata", "UTC", "America/New_York"]
    };
  }
}

// Create singleton instance
const enhancedSlotService = new EnhancedSlotService();

export default enhancedSlotService;

// Export individual functions for backward compatibility
export {
  EnhancedSlotService,
  enhancedSlotService
};