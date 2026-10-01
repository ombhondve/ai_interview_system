# Frontend Calendar Integration Examples

## Overview
This document provides frontend code examples for integrating Google Calendar functionality into the student portal.

## React/Next.js Examples

### 1. Calendar Event Creation Component

```jsx
// components/CalendarEventButton.jsx
import React, { useState } from 'react';
import axios from 'axios';

const CalendarEventButton = ({ interviewId, interviewStatus, hasCalendarEvent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [eventData, setEventData] = useState(null);

  const createCalendarEvent = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/interview/${interviewId}/create-event`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSuccess(true);
        setEventData(response.data.data);
        
        // Show success notification
        alert('✅ Calendar event created successfully! Check your Google Calendar.');
        
        // Optionally refresh the page or update state
        window.location.reload();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create calendar event');
      console.error('Error creating calendar event:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/interview/${interviewId}/event-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error getting event status:', error);
      return null;
    }
  };

  const openCalendarEvent = () => {
    if (eventData?.eventLink) {
      window.open(eventData.eventLink, '_blank');
    } else {
      // Try to get event link from backend
      getEventStatus().then(status => {
        if (status.exists && status.htmlLink) {
          window.open(status.htmlLink, '_blank');
        }
      });
    }
  };

  const openGoogleMeet = () => {
    if (eventData?.meetLink) {
      window.open(eventData.meetLink, '_blank');
    }
  };

  // Don't show button if interview is cancelled or already has calendar event
  if (interviewStatus === 'cancelled' || hasCalendarEvent) {
    return null;
  }

  return (
    <div className="calendar-event-section">
      <div className="flex flex-col gap-4">
        {success && eventData && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 font-medium">✅ Calendar Event Created</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Event added to your Google Calendar. You'll receive email reminders.
            </p>
            <div className="flex gap-2">
              <button
                onClick={openCalendarEvent}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Open in Google Calendar
              </button>
              {eventData.meetLink && (
                <button
                  onClick={openGoogleMeet}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Join Google Meet
                </button>
              )}
            </div>
          </div>
        )}

        {!success && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">📅 Add to Google Calendar</h3>
            <p className="text-sm text-gray-600 mb-3">
              Create a Google Calendar event with Google Meet link for this interview.
              You'll receive reminders and can easily join from your calendar.
            </p>
            
            <button
              onClick={createCalendarEvent}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Creating Event...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                  </svg>
                  Add to Google Calendar
                </>
              )}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  ⚠️ {error}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  Make sure Google Calendar integration is properly configured.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEventButton;
```

### 2. Student Calendar Events List Page

```jsx
// pages/student/calendar.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';

const StudentCalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/student/events`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setEvents(response.data.data.events || []);
      }
    } catch (error) {
      setError('Failed to load calendar events');
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openEventInCalendar = (eventLink) => {
    window.open(eventLink, '_blank');
  };

  const joinMeet = (meetLink) => {
    if (meetLink) {
      window.open(meetLink, '_blank');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Calendar Events</h1>
          <p className="text-gray-600 mt-2">
            All your scheduled interviews in Google Calendar
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 text-gray-300 mb-4">
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No calendar events yet</h3>
            <p className="text-gray-600 mb-6">
              Schedule an interview and add it to your Google Calendar to see it here.
            </p>
            <a
              href="/student/interviews"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Schedule Interview
            </a>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {events.map((event) => (
                <li key={event.eventId} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className={`h-3 w-3 rounded-full ${
                            event.status === 'scheduled' ? 'bg-blue-500' :
                            event.status === 'confirmed' ? 'bg-green-500' :
                            event.status === 'cancelled' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {event.interviewType === 'ai' ? '🤖 AI Interview' : 
                             event.interviewType === 'human' ? '👤 Human Interview' :
                             '📋 Interview'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {formatDateTime(event.startTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {event.meetLink && (
                        <button
                          onClick={() => joinMeet(event.meetLink)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700"
                        >
                          Join Meet
                        </button>
                      )}
                      
                      <button
                        onClick={() => openEventInCalendar(event.eventLink)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50"
                      >
                        View in Calendar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Google Calendar Integration</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  • Events are added to your Google Calendar automatically<br/>
                  • You'll receive email reminders before the interview<br/>
                  • Google Meet links are included for easy joining<br/>
                  • You can manage events directly in Google Calendar
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default StudentCalendarPage;
```

### 3. Interview Detail Page with Calendar Integration

```jsx
// components/InterviewDetail.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CalendarEventButton from './CalendarEventButton';

const InterviewDetail = ({ interviewId }) => {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventStatus, setEventStatus] = useState(null);

  useEffect(() => {
    fetchInterviewDetails();
    fetchCalendarEventStatus();
  }, [interviewId]);

  const fetchInterviewDetails = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/interviews/${interviewId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setInterview(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarEventStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/interview/${interviewId}/event-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setEventStatus(response.data.data);
      }
    } catch (error) {
      // Event might not exist yet, that's okay
      console.log('No calendar event found for this interview');
    }
  };

  const deleteCalendarEvent = async () => {
    if (!window.confirm('Are you sure you want to remove this event from your Google Calendar?')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/interview/${interviewId}/delete-event`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          data: {
            reason: 'Removed by student'
          }
        }
      );

      if (response.data.success) {
        alert('✅ Calendar event removed successfully');
        fetchCalendarEventStatus(); // Refresh status
      }
    } catch (error) {
      alert('Failed to remove calendar event');
      console.error('Error deleting calendar event:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Interview not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Interview Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Interview Details
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Scheduled for {new Date(interview.slot.startTime).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              interview.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
              interview.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              interview.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {interview.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Interview Details */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Date & Time</h3>
              <p className="text-gray-900">
                {new Date(interview.slot.startTime).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Duration: {interview.slot.duration} minutes
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
              <p className="text-gray-900">
                {interview.slot.location || 'Online'}
              </p>
              {interview.meetLink && (
                <a
                  href={interview.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                >
                  Join Google Meet →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Integration Section */}
        <div className="px-6 py-4 border-t border-gray-200">
          <CalendarEventButton
            interviewId={interviewId}
            interviewStatus={interview.status}
            hasCalendarEvent={interview.metadata?.calendarEventId}
          />

          {/* Calendar Event Status */}
          {eventStatus && eventStatus.exists && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">
                    ✅ Calendar Event Created
                  </h4>
                  <p className="text-sm text-gray-600">
                    Added to your Google Calendar
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={eventStatus.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View in Calendar
                  </a>
                  <button
                    onClick={deleteCalendarEvent}
                    className="px-3 py-1.5 text-sm bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interview Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between">
            <div>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Reschedule
              </button>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Prepare for Interview
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Join Interview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewDetail;
```

## API Integration Notes

### Environment Variables for Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:5000  # Development
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app  # Production
```

### Authentication
All calendar API calls require JWT authentication:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Error Handling
```javascript
try {
  // API call
} catch (error) {
  if (error.response?.status === 403) {
    // No permission
  } else if (error.response?.status === 404) {
    // Not found
  } else if (error.response?.status === 500) {
    // Server error
  }
}
```

## Testing the Integration

1. **Development Testing:**
   ```bash
   # Start backend
   cd backend
   npm run dev

   # Start frontend
   cd frontend
   npm run dev
   ```

2. **Test Calendar Integration:**
   - Login as student
   - Schedule an interview
   - Click "Add to Google Calendar"
   - Verify event appears in Google Calendar

3. **Test Without Real Credentials:**
   The system will show appropriate messages when Google Calendar is not configured.

## Styling Recommendations

Use Tailwind CSS classes as shown in the examples. Key styling:
- Success states: green colors
- Error states: red colors
- Information: blue colors
- Buttons: consistent padding and hover states

## Mobile Responsiveness

All components are responsive using Tailwind's grid and flex utilities.

## Security Considerations

1. **JWT Tokens**: Store in localStorage or httpOnly cookies
2. **API Calls**: Use HTTPS in production
3. **Error Messages**: Don't expose sensitive information
4. **User Permissions**: Verify user owns the interview before calendar operations

## Browser Compatibility

Tested in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Optimization

1. **Lazy Loading**: Load calendar components only when needed
2. **Caching**: Cache calendar event status
3. **Optimistic Updates**: Update UI immediately, handle errors gracefully
4. **Debouncing**: Prevent multiple rapid API calls

## Accessibility

- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Provide text alternatives for icons

---

**Last Updated**: September 30, 2026  
**Version**: 1.0