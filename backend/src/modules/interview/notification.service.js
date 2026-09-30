import logger from "../../utils/logger.js";
import Candidate from "../candidate/candidate.model.js";

/**
 * Notification Service for Interview Booking
 * 
 * Handles email, SMS, and in-app notifications for:
 * - Booking confirmations
 * - Interview reminders
 * - Preparation updates
 * - Rescheduling notifications
 * - Cancellation confirmations
 */
class InterviewNotificationService {
  constructor(config = {}) {
    this.emailEnabled = config.emailEnabled !== false;
    this.smsEnabled = config.smsEnabled !== false;
    this.pushEnabled = config.pushEnabled !== false;
    this.templates = this.loadTemplates();
  }

  /**
   * Load notification templates
   */
  loadTemplates() {
    return {
      booking_confirmation: {
        email: {
          subject: "Interview Booking Confirmation - AI Interview System",
          template: "booking_confirmation_email"
        },
        sms: {
          template: "booking_confirmation_sms"
        }
      },
      preparation_started: {
        email: {
          subject: "Start Your Interview Preparation",
          template: "preparation_started_email"
        }
      },
      preparation_complete: {
        email: {
          subject: "Interview Preparation Complete - Ready to Confirm",
          template: "preparation_complete_email"
        }
      },
      readiness_confirmed: {
        email: {
          subject: "Interview Readiness Confirmed",
          template: "readiness_confirmed_email"
        },
        sms: {
          template: "readiness_confirmed_sms"
        }
      },
      interview_reminder_24h: {
        email: {
          subject: "Interview Reminder: Tomorrow at {time}",
          template: "interview_reminder_24h_email"
        },
        sms: {
          template: "interview_reminder_24h_sms"
        }
      },
      interview_reminder_1h: {
        email: {
          subject: "Interview Starting Soon: In 1 Hour",
          template: "interview_reminder_1h_email"
        },
        sms: {
          template: "interview_reminder_1h_sms"
        }
      },
      interview_rescheduled: {
        email: {
          subject: "Interview Rescheduled - New Time: {time}",
          template: "interview_rescheduled_email"
        },
        sms: {
          template: "interview_rescheduled_sms"
        }
      },
      interview_cancelled: {
        email: {
          subject: "Interview Cancellation Confirmation",
          template: "interview_cancelled_email"
        },
        sms: {
          template: "interview_cancelled_sms"
        }
      },
      interview_starting: {
        email: {
          subject: "Join Your Interview Now",
          template: "interview_starting_email"
        },
        sms: {
          template: "interview_starting_sms"
        }
      }
    };
  }

  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(interview, slot, candidate) {
    try {
      const context = this.buildBookingContext(interview, slot, candidate);
      const notifications = [];
      
      // Email notification
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "booking_confirmation",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      // SMS notification
      if (this.smsEnabled && candidate.phone) {
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          "booking_confirmation",
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "booking_confirmation",
          title: "Interview Booked Successfully",
          message: `Your interview is scheduled for ${this.formatDateTime(slot.startTime)}`,
          data: {
            interviewId: interview._id,
            slotId: slot._id,
            action: "view_interview"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Booking confirmation sent to candidate ${candidate._id} for interview ${interview._id}`);
      
      return {
        success: true,
        notifications,
        context
      };
      
    } catch (error) {
      logger.error("Failed to send booking confirmation:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send preparation started notification
   */
  async sendPreparationStarted(interview, candidate, requirements) {
    try {
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        requirements: requirements,
        preparationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        interviewDate: interview.slotId?.startTime || "N/A"
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "preparation_started",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "preparation_started",
          title: "Start Your Interview Preparation",
          message: "Complete your preparation steps to get ready for the interview",
          data: {
            interviewId: interview._id,
            action: "start_preparation"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Preparation started notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send preparation started notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send preparation complete notification
   */
  async sendPreparationComplete(interview, candidate, readinessScore) {
    try {
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        readinessScore: readinessScore || interview.preparationStatus?.readinessScore || 0,
        interviewDate: interview.slotId?.startTime || "N/A",
        nextStep: "Confirm your readiness to proceed"
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "preparation_complete",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "preparation_complete",
          title: "Preparation Complete!",
          message: `Your preparation is complete with a readiness score of ${context.readinessScore}%`,
          data: {
            interviewId: interview._id,
            action: "confirm_readiness"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Preparation complete notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send preparation complete notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send readiness confirmed notification
   */
  async sendReadinessConfirmed(interview, candidate, joinWindow) {
    try {
      const slot = interview.slotId;
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        interviewDate: slot?.startTime || "N/A",
        interviewTime: slot?.startTime ? this.formatTime(slot.startTime) : "N/A",
        joinWindow: joinWindow || {},
        meetLink: slot?.meetLink || "Will be provided before interview",
        preparationTips: [
          "Test your camera and microphone",
          "Find a quiet, well-lit space",
          "Have your ID ready for verification",
          "Join 5-10 minutes early"
        ]
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "readiness_confirmed",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      if (this.smsEnabled && candidate.phone) {
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          "readiness_confirmed",
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "readiness_confirmed",
          title: "Ready for Interview!",
          message: `Your interview is confirmed for ${this.formatDateTime(slot.startTime)}`,
          data: {
            interviewId: interview._id,
            action: "view_join_instructions"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Readiness confirmed notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send readiness confirmed notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send interview reminder
   */
  async sendInterviewReminder(interview, candidate, hoursUntilStart) {
    try {
      const slot = interview.slotId;
      const reminderType = hoursUntilStart <= 1 ? "interview_reminder_1h" : "interview_reminder_24h";
      
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        interviewDate: slot?.startTime || "N/A",
        interviewTime: slot?.startTime ? this.formatTime(slot.startTime) : "N/A",
        hoursUntilStart: Math.round(hoursUntilStart * 10) / 10,
        meetLink: slot?.meetLink || "Will be provided before interview",
        joinInstructions: "Join 5-10 minutes early with your ID ready"
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          reminderType,
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      if (this.smsEnabled && candidate.phone && hoursUntilStart <= 1) {
        // Only send SMS for 1-hour reminder
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          reminderType,
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: reminderType,
          title: hoursUntilStart <= 1 ? "Interview in 1 Hour!" : "Interview Tomorrow",
          message: `Your interview is ${hoursUntilStart <= 1 ? 'starting in 1 hour' : 'tomorrow'} at ${this.formatTime(slot.startTime)}`,
          data: {
            interviewId: interview._id,
            action: "view_join_instructions"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`${reminderType} sent for interview ${interview._id} (${hoursUntilStart} hours until start)`);
      
      return {
        success: true,
        notifications,
        reminderType
      };
      
    } catch (error) {
      logger.error("Failed to send interview reminder:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send rescheduling notification
   */
  async sendReschedulingNotification(interview, candidate, previousSlot, newSlot, reason) {
    try {
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        previousTime: previousSlot?.startTime ? this.formatDateTime(previousSlot.startTime) : "N/A",
        newTime: newSlot?.startTime ? this.formatDateTime(newSlot.startTime) : "N/A",
        reason: reason || "Schedule adjustment",
        newMeetLink: newSlot?.meetLink || "Will be provided before interview"
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "interview_rescheduled",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      if (this.smsEnabled && candidate.phone) {
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          "interview_rescheduled",
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "interview_rescheduled",
          title: "Interview Rescheduled",
          message: `Your interview has been rescheduled to ${this.formatDateTime(newSlot.startTime)}`,
          data: {
            interviewId: interview._id,
            action: "view_interview"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Rescheduling notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send rescheduling notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotification(interview, candidate, reason) {
    try {
      const slot = interview.slotId;
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        cancelledTime: slot?.startTime ? this.formatDateTime(slot.startTime) : "N/A",
        reason: reason || "Candidate requested",
        nextSteps: "You can book a new interview slot at any time"
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "interview_cancelled",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      if (this.smsEnabled && candidate.phone) {
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          "interview_cancelled",
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // In-app notification
      const inAppResult = await this.createInAppNotification(
        candidate._id,
        {
          type: "interview_cancelled",
          title: "Interview Cancelled",
          message: "Your interview has been cancelled as requested",
          data: {
            interviewId: interview._id,
            action: "book_new_interview"
          }
        }
      );
      notifications.push({ type: "in_app", result: inAppResult });
      
      logger.info(`Cancellation notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send cancellation notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send interview starting notification
   */
  async sendInterviewStarting(interview, candidate) {
    try {
      const slot = interview.slotId;
      const context = {
        candidateName: candidate.name || candidate.email,
        interviewId: interview._id,
        interviewTime: "Now",
        meetLink: slot?.meetLink || "Check your interview dashboard",
        joinNowMessage: "Your interview is ready to start. Please join now."
      };
      
      const notifications = [];
      
      if (this.emailEnabled && candidate.email) {
        const emailResult = await this.sendEmailNotification(
          candidate.email,
          "interview_starting",
          context
        );
        notifications.push({ type: "email", result: emailResult });
      }
      
      if (this.smsEnabled && candidate.phone) {
        const smsResult = await this.sendSmsNotification(
          candidate.phone,
          "interview_starting",
          context
        );
        notifications.push({ type: "sms", result: smsResult });
      }
      
      // Push notification (if enabled)
      if (this.pushEnabled) {
        const pushResult = await this.sendPushNotification(
          candidate._id,
          {
            title: "Join Your Interview Now",
            body: "Your interview is ready to start",
            data: {
              interviewId: interview._id,
              action: "join_interview"
            }
          }
        );
        notifications.push({ type: "push", result: pushResult });
      }
      
      logger.info(`Interview starting notification sent for interview ${interview._id}`);
      
      return {
        success: true,
        notifications
      };
      
    } catch (error) {
      logger.error("Failed to send interview starting notification:", error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  
  buildBookingContext(interview, slot, candidate) {
    return {
      candidateName: candidate.name || candidate.email,
      interviewId: interview._id,
      interviewDate: slot.startTime ? this.formatDate(slot.startTime) : "N/A",
      interviewTime: slot.startTime ? this.formatTime(slot.startTime) : "N/A",
      interviewDateTime: slot.startTime ? this.formatDateTime(slot.startTime) : "N/A",
      duration: slot.duration || 30,
      timezone: slot.timezone || "UTC",
      location: slot.location || "Online",
      meetLink: slot.meetLink || "Will be provided before interview",
      preparationSteps: [
        "Complete your profile",
        "Upload required documents",
        "Take preparation test",
        "Review interview guidelines"
      ],
      supportEmail: "support@ai-interview-system.com",
      bookingReference: interview.bookingMetadata?.bookingSessionId || interview._id.toString()
    };
  }
  
  async sendEmailNotification(to, templateType, context) {
    // In a real implementation, this would integrate with an email service
    // For now, we'll simulate the email sending
    
    const template = this.templates[templateType]?.email;
    if (!template) {
      throw new Error(`Email template not found for type: ${templateType}`);
    }
    
    logger.info(`Sending email to ${to} with template ${template.template}`);
    
    // Simulate email sending
    return {
      success: true,
      messageId: `email_${Date.now()}_${to}`,
      template: template.template,
      sentAt: new Date()
    };
  }
  
  async sendSmsNotification(to, templateType, context) {
    // In a real implementation, this would integrate with an SMS service
    // For now, we'll simulate the SMS sending
    
    const template = this.templates[templateType]?.sms;
    if (!template) {
      throw new Error(`SMS template not found for type: ${templateType}`);
    }
    
    logger.info(`Sending SMS to ${to} with template ${template.template}`);
    
    // Simulate SMS sending
    return {
      success: true,
      messageId: `sms_${Date.now()}_${to}`,
      template: template.template,
      sentAt: new Date()
    };
  }
  
  async sendPushNotification(userId, notification) {
    // In a real implementation, this would send push notifications
    // For now, we'll simulate push notification
    
    logger.info(`Sending push notification to user ${userId}`);
    
    return {
      success: true,
      notificationId: `push_${Date.now()}_${userId}`,
      sentAt: new Date()
    };
  }
  
  async createInAppNotification(userId, notification) {
    try {
      // Store notification in candidate's activity/notification feed
      await Candidate.findByIdAndUpdate(userId, {
        $push: {
          notifications: {
            id: `notification_${Date.now()}`,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            read: false,
            createdAt: new Date()
          }
        }
      });
      
      return {
        success: true,
        notificationId: `inapp_${Date.now()}_${userId}`
      };
      
    } catch (error) {
      logger.error("Failed to create in-app notification:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  formatDate(date) {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  formatTime(date) {
    if (!date) return "N/A";
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }
  
  formatDateTime(date) {
    if (!date) return "N/A";
    return `${this.formatDate(date)} at ${this.formatTime(date)}`;
  }
}

// Create singleton instance
const interviewNotificationService = new InterviewNotificationService();

export default interviewNotificationService;
export { InterviewNotificationService };
