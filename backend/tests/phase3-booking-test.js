#!/usr/bin/env node

/**
 * Phase 3: Enhanced Interview Booking Workflow Test
 * 
 * Tests the complete interview booking workflow including:
 * - Enhanced slot management
 * - Booking workflow with validation
 * - Calendar integration
 * - Notification system
 * - Interview lifecycle management
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add project root to path
const projectRoot = join(__dirname, '..');

// Import models and services
import Interview from '../src/modules/interview/interview.model.js';
import Slot from '../src/modules/scheduling/slot.model.js';
import Candidate from '../src/modules/candidate/candidate.model.js';
import { EnhancedBookingService } from '../src/modules/interview/enhancedBooking.service.js';
import { CalendarIntegrationService } from '../src/modules/interview/calendar.integration.service.js';
import { InterviewNotificationService } from '../src/modules/interview/notification.service.js';

// Test configuration
const TEST_CONFIG = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai_interview_test',
  testCandidate: {
    name: 'Test Candidate',
    email: 'test.candidate@example.com',
    phone: '+1234567890',
    role: 'developer'
  },
  testSlot: {
    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes duration
    timezone: 'UTC',
    capacity: 1,
    status: 'open'
  }
};

class BookingWorkflowTest {
  constructor() {
    this.bookingService = new EnhancedBookingService();
    this.calendarService = new CalendarIntegrationService({ enabled: false }); // Disable for tests
    this.notificationService = new InterviewNotificationService({ 
      emailEnabled: false, 
      smsEnabled: false,
      pushEnabled: false 
    });
    
    this.testCandidate = null;
    this.testSlot = null;
    this.testInterview = null;
  }

  async setup() {
    console.log('Setting up test environment...');
    
    // Connect to test database
    await mongoose.connect(TEST_CONFIG.mongoUri);
    console.log('Connected to test database');
    
    // Clean up any existing test data
    await this.cleanup();
    
    // Create test candidate
    this.testCandidate = new Candidate(TEST_CONFIG.testCandidate);
    await this.testCandidate.save();
    console.log(`Created test candidate: ${this.testCandidate._id}`);
    
    // Create test slot
    this.testSlot = new Slot(TEST_CONFIG.testSlot);
    await this.testSlot.save();
    console.log(`Created test slot: ${this.testSlot._id}`);
    
    console.log('Test setup complete\n');
  }

  async cleanup() {
    console.log('Cleaning up test data...');
    
    // Delete test data
    await Candidate.deleteMany({ email: TEST_CONFIG.testCandidate.email });
    await Slot.deleteMany({ 
      startTime: { $gte: TEST_CONFIG.testSlot.startTime } 
    });
    await Interview.deleteMany({ 
      'bookingMetadata.bookingSource': 'test' 
    });
    
    console.log('Cleanup complete\n');
  }

  async testBookingWorkflow() {
    console.log('=== Testing Complete Booking Workflow ===\n');
    
    let passed = 0;
    let failed = 0;
    
    try {
      // Test 1: Book interview
      console.log('Test 1: Booking an interview');
      const bookingResult = await this.bookingService.bookInterview(
        this.testCandidate._id,
        this.testSlot._id,
        {
          source: 'test',
          interviewType: 'ai',
          aiConfig: { difficulty: 'intermediate', duration: 30 }
        }
      );
      
      if (bookingResult.success) {
        console.log('✓ Booking successful');
        this.testInterview = bookingResult.interview;
        passed++;
      } else {
        console.log(`✗ Booking failed: ${bookingResult.error}`);
        failed++;
        return { passed, failed };
      }
      
      // Test 2: Start preparation
      console.log('\nTest 2: Starting preparation workflow');
      const preparationResult = await this.bookingService.startPreparation(
        this.testInterview._id,
        this.testCandidate._id
      );
      
      if (preparationResult.success) {
        console.log('✓ Preparation started successfully');
        console.log(`  Requirements: ${JSON.stringify(preparationResult.requirements)}`);
        passed++;
      } else {
        console.log(`✗ Preparation start failed: ${preparationResult.error}`);
        failed++;
      }
      
      // Test 3: Update preparation status
      console.log('\nTest 3: Updating preparation status');
      const updateResult = await this.bookingService.updatePreparation(
        this.testInterview._id,
        this.testCandidate._id,
        {
          profileComplete: true,
          testCompleted: true,
          readinessScore: 85,
          documentsSubmitted: ['resume.pdf', 'id.jpg']
        }
      );
      
      if (updateResult.success) {
        console.log('✓ Preparation updated successfully');
        console.log(`  Completion: ${updateResult.completionPercentage}%`);
        console.log(`  Next action: ${updateResult.nextAction}`);
        passed++;
      } else {
        console.log(`✗ Preparation update failed: ${updateResult.error}`);
        failed++;
      }
      
      // Test 4: Confirm readiness
      console.log('\nTest 4: Confirming interview readiness');
      const readinessResult = await this.bookingService.confirmReadiness(
        this.testInterview._id,
        this.testCandidate._id
      );
      
      if (readinessResult.success) {
        console.log('✓ Readiness confirmed successfully');
        console.log(`  Next action: ${readinessResult.nextAction}`);
        passed++;
      } else {
        console.log(`✗ Readiness confirmation failed: ${readinessResult.error}`);
        failed++;
      }
      
      // Test 5: Get interview status
      console.log('\nTest 5: Getting interview status');
      const statusResult = await this.bookingService.getInterviewStatus(
        this.testInterview._id,
        this.testCandidate._id
      );
      
      if (statusResult.success) {
        console.log('✓ Status retrieved successfully');
        console.log(`  Phase: ${statusResult.phase}`);
        console.log(`  Preparation progress: ${statusResult.preparation.progress}%`);
        console.log(`  Next actions: ${statusResult.nextActions.length}`);
        passed++;
      } else {
        console.log(`✗ Status retrieval failed: ${statusResult.error}`);
        failed++;
      }
      
      // Test 6: Get interview history
      console.log('\nTest 6: Getting interview history');
      const historyResult = await this.bookingService.getCandidateInterviewHistory(
        this.testCandidate._id
      );
      
      if (historyResult.success) {
        console.log('✓ History retrieved successfully');
        console.log(`  Total interviews: ${historyResult.pagination.total}`);
        console.log(`  Statistics: ${JSON.stringify(historyResult.statistics)}`);
        passed++;
      } else {
        console.log(`✗ History retrieval failed: ${historyResult.error}`);
        failed++;
      }
      
      // Test 7: Reschedule interview
      console.log('\nTest 7: Testing rescheduling (creating new slot first)');
      
      // Create another slot for rescheduling
      const newSlot = new Slot({
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        timezone: 'UTC',
        capacity: 1,
        status: 'open'
      });
      await newSlot.save();
      
      const rescheduleResult = await this.bookingService.rescheduleInterview(
        this.testInterview._id,
        this.testCandidate._id,
        newSlot._id,
        'Test rescheduling'
      );
      
      if (rescheduleResult.success) {
        console.log('✓ Rescheduling successful');
        console.log(`  Message: ${rescheduleResult.message}`);
        passed++;
      } else {
        console.log(`✗ Rescheduling failed: ${rescheduleResult.error}`);
        failed++;
      }
      
      // Test 8: Cancel interview
      console.log('\nTest 8: Testing cancellation');
      const cancelResult = await this.bookingService.cancelInterview(
        this.testInterview._id,
        this.testCandidate._id,
        'Test cancellation'
      );
      
      if (cancelResult.success) {
        console.log('✓ Cancellation successful');
        console.log(`  Message: ${cancelResult.message}`);
        passed++;
      } else {
        console.log(`✗ Cancellation failed: ${cancelResult.error}`);
        failed++;
      }
      
      // Test 9: Calendar integration (mock)
      console.log('\nTest 9: Testing calendar integration (mock)');
      const calendarResult = await this.calendarService.createInterviewEvent(
        this.testInterview,
        this.testSlot,
        this.testCandidate
      );
      
      if (calendarResult.success) {
        console.log('✓ Calendar integration working (mock mode)');
        passed++;
      } else {
        console.log(`✗ Calendar integration failed: ${calendarResult.error}`);
        failed++;
      }
      
      // Test 10: Notification service (mock)
      console.log('\nTest 10: Testing notification service (mock)');
      const notificationResult = await this.notificationService.sendBookingConfirmation(
        this.testInterview,
        this.testSlot,
        this.testCandidate
      );
      
      if (notificationResult.success) {
        console.log('✓ Notification service working (mock mode)');
        passed++;
      } else {
        console.log(`✗ Notification service failed: ${notificationResult.error}`);
        failed++;
      }
      
    } catch (error) {
      console.error('Test error:', error);
      failed++;
    }
    
    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    return { passed, failed };
  }

  async run() {
    try {
      await this.setup();
      const results = await this.testBookingWorkflow();
      await this.cleanup();
      
      console.log('\n=== Test Complete ===');
      if (results.failed === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
      } else {
        console.log(`❌ ${results.failed} test(s) failed`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Test runner error:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new BookingWorkflowTest();
  test.run();
}

export default BookingWorkflowTest;
