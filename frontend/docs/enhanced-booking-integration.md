# Enhanced Booking Frontend Integration

## Overview
This document describes the frontend integration for the enhanced booking workflow implemented in Phase 3.

## Components Created

### 1. API Service (`services/enhancedBooking.api.ts`)
- TypeScript interfaces for enhanced booking types
- Service methods for all booking operations
- Helper functions for date formatting and progress calculation

### 2. UI Components (`components/booking/`)
- **`SlotCalendar.tsx`**: Calendar view for selecting interview slots with eligibility checking
- **`BookingConfirmation.tsx`**: Modal for confirming booking details and interview configuration
- **`PreparationWorkflow.tsx`**: Multi-step preparation workflow with progress tracking

### 3. Pages (`app/student/enhanced-book-slot/`)
- **`page.tsx`**: Enhanced booking page integrating all components
- Supports three views: slot selection, booking confirmation, preparation workflow

### 4. API Routes (`app/api/interviews/`)
- **`route.ts`**: Proxy for fetching slots and booking interviews
- **`[interviewId]/[action]/route.ts`**: Dynamic routes for interview actions
- **`history/route.ts`**: Route for fetching interview history

## Integration Points

### Backend API Mapping
The frontend communicates with the backend through Next.js API routes that proxy requests:

```
Frontend → Next.js API Route → Backend (localhost:3001)
```

### Environment Configuration
Add to `.env.local`:
```env
BACKEND_URL=http://localhost:3001
```

### Authentication
The integration assumes:
- User authentication is handled via cookies/sessions
- Candidate ID is available via `/api/student/me` endpoint
- Authorization headers are forwarded to backend

## Usage Examples

### 1. Booking an Interview
```typescript
import { enhancedBookingService } from "@/services/enhancedBooking.api";

// Get available slots
const slots = await enhancedBookingService.getAvailableSlots({
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  timezone: "UTC",
});

// Book a slot
const confirmation = await enhancedBookingService.bookInterview(
  candidateId,
  slotId,
  {
    source: "portal",
    interviewType: "ai",
    aiConfig: {
      difficulty: "intermediate",
      duration: 30,
    },
  }
);
```

### 2. Preparation Workflow
```typescript
// Start preparation
const preparation = await enhancedBookingService.startPreparation(
  interviewId,
  candidateId
);

// Update preparation status
const update = await enhancedBookingService.updatePreparation(
  interviewId,
  candidateId,
  {
    profileComplete: true,
    testCompleted: true,
    readinessScore: 85,
  }
);

// Confirm readiness
const readiness = await enhancedBookingService.confirmReadiness(
  interviewId,
  candidateId
);
```

### 3. Interview Management
```typescript
// Get interview status
const status = await enhancedBookingService.getInterviewStatus(
  interviewId,
  candidateId
);

// Reschedule interview
const reschedule = await enhancedBookingService.rescheduleInterview(
  interviewId,
  candidateId,
  newSlotId,
  "Schedule conflict"
);

// Cancel interview
const cancel = await enhancedBookingService.cancelInterview(
  interviewId,
  candidateId,
  "Unexpected emergency"
);
```

## Component Props

### SlotCalendar
```typescript
interface SlotCalendarProps {
  candidateId: string;
  onSlotSelect?: (slot: EnhancedSlot) => void;
  filters?: {
    startDate?: string;
    endDate?: string;
    timezone?: string;
    role?: string;
    includeBooked?: boolean;
    limit?: number;
    offset?: number;
  };
}
```

### BookingConfirmationModal
```typescript
interface BookingConfirmationProps {
  candidateId: string;
  selectedSlot: EnhancedSlot;
  onBookingComplete: (confirmation: BookingConfirmation) => void;
  onCancel: () => void;
}
```

### PreparationWorkflow
```typescript
interface PreparationWorkflowProps {
  candidateId: string;
  interviewId: string;
  onPreparationComplete?: () => void;
  onReadyToConfirm?: () => void;
}
```

## Styling
All components use:
- Tailwind CSS for styling
- Existing UI components (`Card`, `Button`, `Badge`, etc.)
- Consistent color scheme with the existing application

## Testing the Integration

### 1. Start Backend Server
```bash
cd backend
npm run dev
```

### 2. Start Frontend Server
```bash
cd frontend
npm run dev
```

### 3. Access Enhanced Booking
Navigate to: `http://localhost:3000/student/enhanced-book-slot`

### 4. Test Workflow
1. View available slots in calendar
2. Select a slot and check eligibility
3. Configure interview type and settings
4. Complete booking
5. Go through preparation workflow
6. Confirm readiness

## Next Steps

### 1. Production Configuration
- Set up environment variables for production backend
- Configure CORS on backend
- Add error monitoring

### 2. Enhanced Features
- Real-time updates using WebSocket
- File upload for document requirements
- Calendar integration UI
- Email/SMS notification preferences

### 3. Testing
- Unit tests for API service
- Integration tests for booking workflow
- E2E tests for complete user journey

### 4. Accessibility
- Screen reader support
- Keyboard navigation
- ARIA labels
- Color contrast compliance

## Dependencies
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Axios (for API calls)
- Existing UI component library

## File Structure
```
frontend/
├── app/
│   ├── api/
│   │   └── interviews/
│   │       ├── route.ts
│   │       ├── [interviewId]/[action]/route.ts
│   │       └── history/route.ts
│   └── student/
│       └── enhanced-book-slot/
│           └── page.tsx
├── components/
│   └── booking/
│       ├── SlotCalendar.tsx
│       ├── BookingConfirmation.tsx
│       └── PreparationWorkflow.tsx
├── services/
│   └── enhancedBooking.api.ts
├── types/
│   └── index.ts (updated)
└── lib/
    └── client.ts
```

## Notes
- The integration assumes the backend is running on `localhost:3001`
- All API calls are proxied through Next.js for security
- Authentication is handled via cookies/sessions
- Error handling includes user-friendly messages
- Loading states are implemented for all async operations
