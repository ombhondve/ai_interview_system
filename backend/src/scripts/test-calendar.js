/**
 * Test script for Google Calendar integration
 * 
 * This script tests the Google Calendar service without requiring
 * actual Google credentials. It demonstrates the fallback behavior
 * and shows how the calendar events would work.
 */

import googleCalendarService from '../services/googleCalendar.service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testCalendarService() {
  console.log('🔧 Testing Google Calendar Service...\n');
  
  // Test 1: Initialize service
  console.log('Test 1: Service Initialization');
  console.log('-'.repeat(50));
  
  const isInitialized = await googleCalendarService.initialize();
  
  if (isInitialized) {
    console.log('✅ Google Calendar service initialized successfully');
    console.log(`Calendar ID: ${googleCalendarService.calendarId}`);
  } else {
    console.log('⚠️  Google Calendar service not initialized (credentials missing)');
    console.log('   This is expected in development without real Google credentials\n');
  }
  
  // Test 2: Connection test
  console.log('Test 2: Connection Test');
  console.log('-'.repeat(50));
  
  const connectionResult = await googleCalendarService.testConnection();
  console.log('Connection result:', JSON.stringify(connectionResult, null, 2));
  console.log();
  
  // Test 3: Mock calendar event creation (shows what would happen)
  console.log('Test 3: Mock Calendar Event Creation');
  console.log('-'.repeat(50));
  
  const mockInterview = {
    _id: '65f8a7b3c1d9e4a5b6c7d8e9',
    interviewType: 'ai',
    candidateId: {
      _id: '65f8a7b3c1d9e4a5b6c7d8f0',
      email: 'student@example.com',
      name: 'John Doe'
    },
    metadata: {}
  };
  
  const mockSlot = {
    _id: '65f8a7b3c1d9e4a5b6c7d8f1',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
    duration: 30,
    timezone: 'UTC',
    location: 'Online'
  };
  
  const mockCandidate = {
    _id: '65f8a7b3c1d9e4a5b6c7d8f0',
    email: 'student@example.com',
    name: 'John Doe'
  };
  
  console.log('Mock interview data:');
  console.log(`- Interview ID: ${mockInterview._id}`);
  console.log(`- Candidate: ${mockCandidate.name} (${mockCandidate.email})`);
  console.log(`- Start Time: ${mockSlot.startTime.toISOString()}`);
  console.log(`- Duration: ${mockSlot.duration} minutes`);
  console.log();
  
  // Try to create calendar event (will fail without credentials, but shows error handling)
  try {
    if (googleCalendarService.initialized) {
      console.log('Creating calendar event...');
      const result = await googleCalendarService.createInterviewEvent(
        mockInterview,
        mockSlot,
        mockCandidate
      );
      console.log('✅ Calendar event created:', result.eventId);
      console.log('Event Link:', result.eventLink);
      console.log('Meet Link:', result.meetLink);
    } else {
      console.log('⚠️  Skipping event creation - calendar service not initialized');
      console.log('   To enable calendar events, add Google Calendar credentials to .env file:');
      console.log('   GOOGLE_CALENDAR_CLIENT_ID=your-client-id');
      console.log('   GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret');
      console.log('   GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token');
      console.log('   See GOOGLE_CALENDAR_SETUP.md for instructions');
    }
  } catch (error) {
    console.log('❌ Error creating calendar event:', error.message);
    console.log('   This is expected without proper credentials');
  }
  
  console.log('\n'.repeat(2));
  console.log('Test 4: Event Description Preview');
  console.log('-'.repeat(50));
  
  // Show what the calendar event description would look like
  const eventDescription = googleCalendarService.buildEventDescription(
    mockInterview,
    mockSlot,
    mockCandidate
  );
  
  console.log('Calendar Event Description Preview:');
  console.log('-'.repeat(40));
  console.log(eventDescription);
  console.log('-'.repeat(40));
  
  console.log('\n'.repeat(2));
  console.log('🎯 Testing Complete!');
  console.log('\nNext Steps:');
  console.log('1. Follow GOOGLE_CALENDAR_SETUP.md to configure real credentials');
  console.log('2. Test with real Google Calendar API');
  console.log('3. Integrate with student portal frontend');
}

// Run the test
testCalendarService().catch(console.error);