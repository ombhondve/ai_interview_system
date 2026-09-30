/**
 * Slot controller for student-facing operations
 */

/**
 * Get available slots for authenticated candidate
 * 
 * GET /api/student/slots
 */
export async function getAvailableSlotsController(req, res) {
  try {
    const candidate = req.candidate;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Import service
    const { getAvailableSlots } = await import("./slot.service.js");
    const { canBookInterviewSlot } = await import("../projects/deadline.service.js");
    
    // Check eligibility
    const eligibility = canBookInterviewSlot(candidate);
    
    if (!eligibility.eligible) {
      return res.status(403).json({
        message: eligibility.message,
        eligible: false,
        reason: eligibility.reason
      });
    }
    
    // Get available slots
    const slots = await getAvailableSlots(candidate.role);
    
    return res.status(200).json({
      data: slots,
      eligible: true,
      candidate: {
        id: candidate._id,
        name: candidate.name,
        role: candidate.role
      }
    });
  } catch (error) {
    console.error("Error getting available slots:", error);
    return res.status(500).json({
      message: "Unable to load interview slots."
    });
  }
}

/**
 * Book a slot
 * 
 * POST /api/student/book-slot
 */
export async function bookSlotController(req, res) {
  try {
    const candidate = req.candidate;
    const { slotId } = req.body;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Validate request
    if (!slotId || typeof slotId !== "string") {
      return res.status(400).json({
        message: "Slot ID is required."
      });
    }
    
    // Import services
    const { bookSlot } = await import("./slot.service.js");
    const { canBookInterviewSlot } = await import("../projects/deadline.service.js");
    
    // Check eligibility
    const eligibility = canBookInterviewSlot(candidate);
    
    if (!eligibility.eligible) {
      return res.status(403).json({
        message: eligibility.message,
        eligible: false,
        reason: eligibility.reason
      });
    }
    
    // Book the slot
    const result = await bookSlot(slotId, candidate._id);
    
    // Format response
    const response = {
      slot: {
        id: result.slot._id,
        date: formatDate(result.slot.startTime),
        startTime: formatTime(result.slot.startTime),
        endTime: formatTime(result.slot.endTime),
        timezone: result.slot.timezone,
        location: result.slot.location,
        meetLink: result.slot.meetLink
      },
      interview: {
        id: result.interview._id,
        status: result.interview.status
      },
      candidate: result.candidate,
      message: "Interview slot booked successfully."
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error booking slot:", error);
    
    // Handle specific errors
    const errorMessages = {
      "Candidate not found": "Candidate not found.",
      "Project must be verified before booking interview": "Project must be verified before booking interview.",
      "Candidate already has a booked slot": "You already have a booked slot.",
      "Slot not available or already booked": "This slot is no longer available.",
      "Booking not found or not owned by candidate": "Booking not found."
    };
    
    const message = errorMessages[error.message] || "Unable to book interview slot.";
    const status = error.message.includes("not available") ? 409 : 400;
    
    return res.status(status).json({
      message
    });
  }
}

/**
 * Get booked slot for authenticated candidate
 * 
 * GET /api/student/booked-slot
 */
export async function getBookedSlotController(req, res) {
  try {
    const candidate = req.candidate;
    
    if (!candidate) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }
    
    // Import service
    const { getBookedSlot } = await import("./slot.service.js");
    
    const bookedSlot = await getBookedSlot(candidate._id);
    
    if (!bookedSlot) {
      return res.status(404).json({
        message: "No interview slot booked.",
        booked: false
      });
    }
    
    return res.status(200).json({
      booked: true,
      slot: bookedSlot.slot,
      interview: bookedSlot.interview,
      candidate: {
        id: candidate._id,
        name: candidate.name
      }
    });
  } catch (error) {
    console.error("Error getting booked slot:", error);
    return res.status(500).json({
      message: "Unable to load booking details."
    });
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