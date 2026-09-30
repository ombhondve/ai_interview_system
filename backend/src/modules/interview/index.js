import enhancedBookingService from "./enhancedBooking.service.js";
import enhancedBookingController from "./enhancedBooking.controller.js";
import enhancedBookingRoutes from "./enhancedBooking.routes.js";
import calendarIntegrationService from "./calendar.integration.service.js";
import interviewNotificationService from "./notification.service.js";
import aiInterviewerService from "./aiInterviewer.service.js";
import googleMeetService from "./googleMeet.service.js";
import mockInterviewService from "./mockInterview.service.js";
import proctoringService from "./proctoring.service.js";
import translationService from "./translation.service.js";

// Export services
export {
  enhancedBookingService,
  calendarIntegrationService,
  interviewNotificationService,
  aiInterviewerService,
  googleMeetService,
  mockInterviewService,
  proctoringService,
  translationService,
  enhancedBookingController
};

// Export routes
export { enhancedBookingRoutes };

// Default exports for easy imports
export default {
  enhancedBookingService,
  calendarIntegrationService,
  interviewNotificationService,
  aiInterviewerService,
  googleMeetService,
  mockInterviewService,
  proctoringService,
  translationService,
  enhancedBookingController,
  enhancedBookingRoutes
};
