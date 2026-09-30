#!/usr/bin/env node

/**
 * Simple verification script for booking workflow
 * Checks that all components can be imported and initialized
 */

console.log('Verifying booking workflow components...\n');

try {
  // Try to import all components
  console.log('1. Importing enhanced booking service...');
  const { EnhancedBookingService } = await import('../src/modules/interview/enhancedBooking.service.js');
  console.log('   ✓ EnhancedBookingService imported');
  
  console.log('\n2. Importing calendar integration service...');
  const { CalendarIntegrationService } = await import('../src/modules/interview/calendar.integration.service.js');
  console.log('   ✓ CalendarIntegrationService imported');
  
  console.log('\n3. Importing notification service...');
  const { InterviewNotificationService } = await import('../src/modules/interview/notification.service.js');
  console.log('   ✓ InterviewNotificationService imported');
  
  console.log('\n4. Importing controller...');
  const { EnhancedBookingController } = await import('../src/modules/interview/enhancedBooking.controller.js');
  console.log('   ✓ EnhancedBookingController imported');
  
  console.log('\n5. Importing routes...');
  const enhancedBookingRoutes = await import('../src/modules/interview/enhancedBooking.routes.js');
  console.log('   ✓ EnhancedBookingRoutes imported');
  
  console.log('\n6. Importing models...');
  const Interview = await import('../src/modules/interview/interview.model.js');
  const Slot = await import('../src/modules/scheduling/slot.model.js');
  const Candidate = await import('../src/modules/candidate/candidate.model.js');
  console.log('   ✓ All models imported');
  
  // Create instances
  console.log('\n7. Creating service instances...');
  const bookingService = new EnhancedBookingService();
  const calendarService = new CalendarIntegrationService({ enabled: false });
  const notificationService = new InterviewNotificationService({
    emailEnabled: false,
    smsEnabled: false,
    pushEnabled: false
  });
  const bookingController = new EnhancedBookingController();
  
  console.log('   ✓ All service instances created');
  
  // Check service methods
  console.log('\n8. Checking service methods...');
  
  const bookingMethods = [
    'bookInterview',
    'startPreparation',
    'updatePreparation',
    'confirmReadiness',
    'rescheduleInterview',
    'cancelInterview',
    'getInterviewStatus',
    'getCandidateInterviewHistory'
  ];
  
  bookingMethods.forEach(method => {
    if (typeof bookingService[method] === 'function') {
      console.log(`   ✓ ${method} method exists`);
    } else {
      console.log(`   ✗ ${method} method missing`);
    }
  });
  
  console.log('\n9. Checking calendar service methods...');
  const calendarMethods = [
    'createInterviewEvent',
    'updateInterviewEvent',
    'deleteInterviewEvent',
    'sendCalendarInvite'
  ];
  
  calendarMethods.forEach(method => {
    if (typeof calendarService[method] === 'function') {
      console.log(`   ✓ ${method} method exists`);
    } else {
      console.log(`   ✗ ${method} method missing`);
    }
  });
  
  console.log('\n10. Checking notification service methods...');
  const notificationMethods = [
    'sendBookingConfirmation',
    'sendPreparationStarted',
    'sendPreparationComplete',
    'sendReadinessConfirmed',
    'sendInterviewReminder',
    'sendReschedulingNotification',
    'sendCancellationNotification'
  ];
  
  notificationMethods.forEach(method => {
    if (typeof notificationService[method] === 'function') {
      console.log(`   ✓ ${method} method exists`);
    } else {
      console.log(`   ✗ ${method} method missing`);
    }
  });
  
  console.log('\n=== Verification Complete ===');
  console.log('✅ All components imported successfully!');
  console.log('\nBooking workflow includes:');
  console.log('- Enhanced booking service with validation');
  console.log('- Calendar integration (Google Calendar)');
  console.log('- Notification system (email/SMS/in-app)');
  console.log('- REST API endpoints via controller/routes');
  console.log('- Interview lifecycle management');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Verification failed:', error.message);
  console.error('\nError details:', error.stack ? error.stack.split('\n')[1] : '');
  process.exit(1);
}
