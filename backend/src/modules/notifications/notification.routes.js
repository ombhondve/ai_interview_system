import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController,
} from "./notification.controller.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getNotificationsController);
router.get("/unread-count", getUnreadCountController);
router.patch("/read-all", markAllAsReadController);
router.patch("/:notificationId/read", markAsReadController);
router.delete("/:notificationId", deleteNotificationController);

export default router;
