import Slot from "./slot.model.js";
import Candidate from "../candidate/candidate.model.js";
import Interview from "../interview/interview.model.js";

/**
 * Get available slots for a candidate
 * 
 * Filters slots by:
 * - Status: "open"
 * - Start time: future
 * - Capacity: not full
 * - Role: applicable to candidate's role (if specified)
 */
export async function getAvailableSlots(candidateRole) {
  try {
    const now = new Date();
    
    // Base query for available slots
    const query = {
      status: "open",
      startTime: { $gt: now }, // Future slots only
      bookedCount: { $lt: "$capacity" } // Not full
    };
    
    // If candidate has a specific role and slot has role restrictions
    if (candidateRole && candidateRole.trim()) {
      query.$or = [
        { applicableRoles: [] }, // Slots open to all roles
        { applicableRoles: candidateRole } // Slots specifically for this role
      ];
    }
    
    const slots = await Slot.aggregate([
      { $match: query },
      {
        $addFields: {
          available: { $subtract: ["$capacity", "$bookedCount"] }
        }
      },
      { $sort: { startTime: 1 } },
      {
        $project: {
          id: "$_id",
          _id: 0,
          startTime: 1,
          endTime: 1,
          timezone: 1,
          capacity: 1,
          bookedCount: 1,
          available: 1,
          location: 1,
          meetLink: 1,
          notes: 1,
          applicableRoles: 1
        }
      }
    ]);
    
    // Format for frontend
    return slots.map(slot => ({
      id: slot.id,
      date: formatDate(slot.startTime),
      startTime: formatTime(slot.startTime),
      endTime: formatTime(slot.endTime),
      timezone: slot.timezone,
      capacity: slot.capacity,
      available: slot.available,
      location: slot.location,
      meetLink: slot.meetLink,
      role: slot.applicableRoles.length > 0 ? slot.applicableRoles[0] : null,
      notes: slot.notes
    }));
  } catch (error) {
    console.error("Error getting available slots:", error);
    throw error;
  }
}

/**
 * Book a slot for a candidate
 * 
 * Atomic operation to prevent double-booking:
 * 1. Check slot availability
 * 2. Check candidate eligibility
 * 3. Update slot bookedCount
 * 4. Create interview record
 * 5. Update candidate
 * 
 * Uses MongoDB transactions for consistency
 */
export async function bookSlot(slotId, candidateId) {
  const session = await Slot.startSession();
  
  try {
    session.startTransaction();
    
    // 1. Get candidate and validate eligibility
    const candidate = await Candidate.findById(candidateId).session(session);
    
    if (!candidate) {
      throw new Error("Candidate not found");
    }
    
    // Check project verification status
    const allowedStatuses = [
      "verified",
      "ai_verification",
      "needs_admin_review"
    ];
    
    if (!allowedStatuses.includes(candidate.projectSubmissionStatus)) {
      throw new Error("Project must be verified before booking interview");
    }
    
    // Check if already booked
    if (candidate.bookedSlotId) {
      throw new Error("Candidate already has a booked slot");
    }
    
    // 2. Get slot with atomic update
    const slot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        status: "open",
        startTime: { $gt: new Date() },
        $expr: { $lt: ["$bookedCount", "$capacity"] }
      },
      {
        $inc: { bookedCount: 1 },
        $set: { 
          status: "booked",
          bookedBy: candidateId 
        }
      },
      { 
        new: true,
        session 
      }
    );
    
    if (!slot) {
      throw new Error("Slot not available or already booked");
    }
    
    // 3. Create interview record
    const interview = new Interview({
      candidateId,
      slotId,
      status: "scheduled"
    });
    
    await interview.save({ session });
    
    // 4. Update candidate with booked slot
    await Candidate.findByIdAndUpdate(
      candidateId,
      {
        bookedSlotId: slotId,
        interviewBookedAt: new Date(),
        interviewStatus: "scheduled",
        interviewDate: slot.startTime
      },
      { session }
    );
    
    // 5. Commit transaction
    await session.commitTransaction();
    
    return {
      slot,
      interview,
      candidate: {
        id: candidate._id,
        name: candidate.name
      }
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get booked slot for a candidate
 */
export async function getBookedSlot(candidateId) {
  try {
    const candidate = await Candidate.findById(candidateId)
      .populate('bookedSlotId')
      .lean();
    
    if (!candidate || !candidate.bookedSlotId) {
      return null;
    }
    
    // Get interview details
    const interview = await Interview.findOne({
      candidateId,
      slotId: candidate.bookedSlotId._id
    });
    
    return {
      slot: formatSlotForDisplay(candidate.bookedSlotId),
      interview: interview ? {
        id: interview._id,
        status: interview.status,
        meetLink: interview.meetLink
      } : null
    };
  } catch (error) {
    console.error("Error getting booked slot:", error);
    throw error;
  }
}

/**
 * Cancel a booking (admin only)
 */
export async function cancelBooking(slotId, candidateId, adminId) {
  const session = await Slot.startSession();
  
  try {
    session.startTransaction();
    
    // 1. Get slot and verify it's booked by this candidate
    const slot = await Slot.findOne({
      _id: slotId,
      bookedBy: candidateId,
      status: "booked"
    }).session(session);
    
    if (!slot) {
      throw new Error("Booking not found or not owned by candidate");
    }
    
    // 2. Update slot
    slot.status = "open";
    slot.bookedBy = null;
    slot.bookedCount = Math.max(0, slot.bookedCount - 1);
    await slot.save({ session });
    
    // 3. Update interview status
    await Interview.findOneAndUpdate(
      { candidateId, slotId },
      { status: "cancelled" },
      { session }
    );
    
    // 4. Update candidate
    await Candidate.findByIdAndUpdate(
      candidateId,
      {
        bookedSlotId: null,
        interviewBookedAt: null,
        interviewStatus: "pending",
        interviewDate: null
      },
      { session }
    );
    
    await session.commitTransaction();
    
    return {
      success: true,
      message: "Booking cancelled successfully"
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Create slot (admin only)
 */
export async function createSlot(slotData, adminId) {
  try {
    // Validate required fields
    if (!slotData.startTime || !slotData.endTime) {
      throw new Error("Start time and end time are required");
    }
    
    if (slotData.startTime >= slotData.endTime) {
      throw new Error("End time must be after start time");
    }
    
    const slot = new Slot({
      ...slotData,
      createdBy: adminId,
      status: "open",
      bookedCount: 0
    });
    
    await slot.save();
    
    return slot;
  } catch (error) {
    console.error("Error creating slot:", error);
    throw error;
  }
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Format slot for display
 */
function formatSlotForDisplay(slot) {
  return {
    id: slot._id,
    date: formatDate(slot.startTime),
    startTime: formatTime(slot.startTime),
    endTime: formatTime(slot.endTime),
    timezone: slot.timezone,
    location: slot.location,
    meetLink: slot.meetLink,
    status: slot.status
  };
}