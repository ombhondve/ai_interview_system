import express from 'express';
import { requireAuth } from '../auth/auth.middleware.js';

const router = express.Router();
const legacyResponse = (_req, res) => res.status(410).json({
  success: false,
  code: 'LEGACY_CALENDAR_FLOW_DISABLED',
  message: 'Use the active interview booking and Google Calendar connection flow.',
});

router.post('/interview/:interviewId/create-event', requireAuth, legacyResponse);
router.get('/interview/:interviewId/event-status', requireAuth, legacyResponse);
router.put('/interview/:interviewId/update-event', requireAuth, legacyResponse);
router.delete('/interview/:interviewId/delete-event', requireAuth, legacyResponse);
router.get('/test-connection', requireAuth, legacyResponse);
router.get('/student/events', requireAuth, legacyResponse);

export default router;
