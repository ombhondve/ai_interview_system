import verificationTracker from "./verification.tracker.service.js";
import logger from "../../utils/logger.js";

/**
 * Verification Events Service
 * 
 * Example event handlers for verification status tracking
 * Demonstrates how to use the verification tracker with event listeners
 */

/**
 * WebSocket Event Handler
 * Sends verification events to connected clients
 */
class WebSocketEventHandler {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map(); // candidateId -> socketId[]
  }

  /**
   * Register with verification tracker
   */
  register() {
    verificationTracker.addStatusListener(this.handleStatusEvent.bind(this));
    logger.info("WebSocket event handler registered with verification tracker");
  }

  /**
   * Handle verification status events
   */
  handleStatusEvent(event) {
    const { candidateId, status, data, timestamp } = event;

    // Broadcast to all connected clients for this candidate
    const clientSockets = this.connectedClients.get(candidateId) || [];
    
    clientSockets.forEach(socketId => {
      try {
        this.io.to(socketId).emit('verification-status', {
          candidateId,
          status,
          data,
          timestamp
        });
      } catch (error) {
        logger.error(`Failed to send WebSocket event to socket ${socketId}:`, error);
      }
    });

    // Also broadcast to admin dashboard
    this.io.to('admin-dashboard').emit('verification-update', {
      candidateId,
      status,
      data,
      timestamp
    });

    logger.debug(`WebSocket event broadcast: ${status} for candidate ${candidateId}`);
  }

  /**
   * Register client connection
   */
  registerClient(candidateId, socketId) {
    if (!this.connectedClients.has(candidateId)) {
      this.connectedClients.set(candidateId, []);
    }
    
    const sockets = this.connectedClients.get(candidateId);
    if (!sockets.includes(socketId)) {
      sockets.push(socketId);
    }

    logger.debug(`Client registered: candidate ${candidateId}, socket ${socketId}`);
  }

  /**
   * Remove client connection
   */
  removeClient(socketId) {
    for (const [candidateId, sockets] of this.connectedClients.entries()) {
      const index = sockets.indexOf(socketId);
      if (index !== -1) {
        sockets.splice(index, 1);
        
        if (sockets.length === 0) {
          this.connectedClients.delete(candidateId);
        }
        
        logger.debug(`Client removed: candidate ${candidateId}, socket ${socketId}`);
        break;
      }
    }
  }
}

/**
 * Database Event Handler
 * Logs verification events to audit log
 */
class DatabaseEventHandler {
  constructor(dbClient) {
    this.dbClient = dbClient;
  }

  register() {
    verificationTracker.addStatusListener(this.handleStatusEvent.bind(this));
    logger.info("Database event handler registered with verification tracker");
  }

  async handleStatusEvent(event) {
    const { candidateId, status, data, timestamp } = event;

    try {
      // Log to audit collection
      await this.dbClient.collection('verification_audit_log').insertOne({
        candidateId,
        eventType: status,
        eventData: data,
        timestamp: new Date(timestamp),
        createdAt: new Date()
      });

      logger.debug(`Database event logged: ${status} for candidate ${candidateId}`);

      // Update candidate activity timeline
      if (status === 'VERIFICATION_COMPLETED' || status === 'VERIFICATION_FINAL_FAILURE') {
        await this.updateCandidateActivity(candidateId, status, data);
      }

    } catch (error) {
      logger.error(`Failed to log database event for candidate ${candidateId}:`, error);
    }
  }

  async updateCandidateActivity(candidateId, status, data) {
    try {
      const activityEntry = {
        id: `verification_${Date.now()}`,
        label: 'Project Verification',
        description: `Verification ${status.toLowerCase().replace('_', ' ')}`,
        timestamp: new Date(),
        state: 'complete',
        metadata: data
      };

      await this.dbClient.collection('candidates').updateOne(
        { _id: candidateId },
        { $push: { activity: activityEntry } }
      );

    } catch (error) {
      logger.error(`Failed to update candidate activity for ${candidateId}:`, error);
    }
  }
}

/**
 * Notification Event Handler
 * Sends email/WhatsApp notifications for important events
 */
class NotificationEventHandler {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  register() {
    verificationTracker.addStatusListener(this.handleStatusEvent.bind(this));
    logger.info("Notification event handler registered with verification tracker");
  }

  async handleStatusEvent(event) {
    const { candidateId, status, data } = event;

    // Only send notifications for certain events
    const notificationEvents = [
      'VERIFICATION_COMPLETED',
      'VERIFICATION_FINAL_FAILURE',
      'ADMIN_REVIEW_DECISION'
    ];

    if (!notificationEvents.includes(status)) {
      return;
    }

    try {
      let notificationType;
      let message;

      switch (status) {
        case 'VERIFICATION_COMPLETED':
          notificationType = 'verification_completed';
          message = this.getVerificationCompletedMessage(data);
          break;

        case 'VERIFICATION_FINAL_FAILURE':
          notificationType = 'verification_failed';
          message = this.getVerificationFailedMessage(data);
          break;

        case 'ADMIN_REVIEW_DECISION':
          notificationType = 'admin_review_decision';
          message = this.getAdminDecisionMessage(data);
          break;
      }

      if (message) {
        await this.notificationService.sendNotification(candidateId, notificationType, message);
        logger.debug(`Notification sent for ${status} to candidate ${candidateId}`);
      }

    } catch (error) {
      logger.error(`Failed to send notification for candidate ${candidateId}:`, error);
    }
  }

  getVerificationCompletedMessage(data) {
    const { status, confidence, requiresAdminReview } = data;
    
    if (status === 'VERIFIED') {
      return {
        subject: 'Project Verification Complete - Approved!',
        body: `Your project submission has been verified and approved. Confidence score: ${Math.round(confidence * 100)}%.`
      };
    } else if (status === 'NEEDS_ADMIN_REVIEW') {
      return {
        subject: 'Project Verification Complete - Under Review',
        body: 'Your project submission has been processed and is now under admin review. You will be notified of the final decision.'
      };
    } else if (status === 'REJECTED') {
      return {
        subject: 'Project Verification Complete - Needs Improvement',
        body: 'Your project submission did not meet the requirements. Please review the feedback and resubmit.'
      };
    }

    return null;
  }

  getVerificationFailedMessage(data) {
    return {
      subject: 'Project Verification Failed',
      body: 'There was an error during project verification. Please try again or contact support.'
    };
  }

  getAdminDecisionMessage(data) {
    const { decision } = data;
    
    if (decision === 'approved') {
      return {
        subject: 'Admin Review Complete - Approved!',
        body: 'Your project submission has been approved after admin review.'
      };
    } else if (decision === 'rejected') {
      return {
        subject: 'Admin Review Complete - Needs Improvement',
        body: 'Your project submission was not approved after admin review. Please review the feedback and resubmit.'
      };
    } else if (decision === 'needs_resubmission') {
      return {
        subject: 'Admin Review Complete - Resubmission Required',
        body: 'The admin has requested some changes to your submission. Please review and resubmit.'
      };
    }

    return null;
  }
}

/**
 * Analytics Event Handler
 * Tracks verification metrics for analytics
 */
class AnalyticsEventHandler {
  constructor(analyticsClient) {
    this.analyticsClient = analyticsClient;
  }

  register() {
    verificationTracker.addStatusListener(this.handleStatusEvent.bind(this));
    logger.info("Analytics event handler registered with verification tracker");
  }

  async handleStatusEvent(event) {
    const { candidateId, status, data, timestamp } = event;

    try {
      // Track event in analytics system
      await this.analyticsClient.trackEvent('verification_status', {
        candidate_id: candidateId,
        status,
        timestamp: new Date(timestamp),
        metadata: {
          attempt: data.attempt,
          confidence: data.confidence,
          requires_admin_review: data.requiresAdminReview
        }
      });

      // Update verification metrics
      if (status === 'VERIFICATION_COMPLETED') {
        await this.updateVerificationMetrics(data);
      }

    } catch (error) {
      logger.error(`Failed to track analytics event for candidate ${candidateId}:`, error);
    }
  }

  async updateVerificationMetrics(data) {
    try {
      const { status, confidence, attempt } = data;
      
      await this.analyticsClient.increment(`verification.${status.toLowerCase()}`);
      await this.analyticsClient.histogram('verification.confidence', confidence);
      await this.analyticsClient.histogram('verification.attempts', attempt);

    } catch (error) {
      logger.error('Failed to update verification metrics:', error);
    }
  }
}

/**
 * Example of setting up all event handlers
 */
export function setupVerificationEventHandlers(options = {}) {
  const handlers = [];

  // Setup WebSocket handler if WebSocket server is provided
  if (options.io) {
    const wsHandler = new WebSocketEventHandler(options.io);
    wsHandler.register();
    handlers.push(wsHandler);
    logger.info("WebSocket event handler setup complete");
  }

  // Setup Database handler if DB client is provided
  if (options.dbClient) {
    const dbHandler = new DatabaseEventHandler(options.dbClient);
    dbHandler.register();
    handlers.push(dbHandler);
    logger.info("Database event handler setup complete");
  }

  // Setup Notification handler if notification service is provided
  if (options.notificationService) {
    const notificationHandler = new NotificationEventHandler(options.notificationService);
    notificationHandler.register();
    handlers.push(notificationHandler);
    logger.info("Notification event handler setup complete");
  }

  // Setup Analytics handler if analytics client is provided
  if (options.analyticsClient) {
    const analyticsHandler = new AnalyticsEventHandler(options.analyticsClient);
    analyticsHandler.register();
    handlers.push(analyticsHandler);
    logger.info("Analytics event handler setup complete");
  }

  // Simple console logger for development
  const consoleHandler = {
    handleStatusEvent: (event) => {
      console.log(`[Verification Event] ${event.status} - Candidate: ${event.candidateId}`, event.data);
    }
  };
  verificationTracker.addStatusListener(consoleHandler.handleStatusEvent.bind(consoleHandler));
  handlers.push(consoleHandler);

  logger.info(`Setup ${handlers.length} verification event handlers`);

  return handlers;
}

// Export event handler classes for custom implementations
export {
  WebSocketEventHandler,
  DatabaseEventHandler,
  NotificationEventHandler,
  AnalyticsEventHandler
};