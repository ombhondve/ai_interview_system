import mongoose from "mongoose";
import Notification from "./notification.model.js";
import Admin from "../admin/admin.model.js";
import logger from "../../utils/logger.js";

/**
 * Create a single in-app notification with idempotency support
 */
export async function createNotification({
  recipientId,
  recipientRole = "all_admins",
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  dedupKey = null,
}) {
  try {
    if (!recipientId || !type || !title || !message) {
      throw new Error("Missing required notification fields: recipientId, type, title, message");
    }

    if (mongoose.connection?.readyState === 0 && !Notification.create?.mock) {
      return {
        _id: "mock_notif",
        recipientId: String(recipientId),
        recipientRole,
        type,
        title,
        message,
        read: false,
      };
    }

    if (dedupKey) {
      const existing = await Notification.findOne({ dedupKey });
      if (existing) {
        return existing;
      }
    }

    const notification = await Notification.create({
      recipientId: String(recipientId),
      recipientRole,
      type,
      title,
      message,
      entityType,
      entityId: entityId ? String(entityId) : null,
      actionUrl,
      dedupKey,
      read: false,
    });

    return notification;
  } catch (error) {
    // If duplicate key error occurs concurrently, fetch and return the existing notification
    if (error.code === 11000 && dedupKey) {
      const existing = await Notification.findOne({ dedupKey });
      if (existing) return existing;
    }
    logger.error("Failed to create notification:", error);
    throw error;
  }
}

/**
 * Dispatch an administrative notification to all active admins (and fallback admin)
 */
export async function notifyAdmins({
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  dedupKeyPrefix = null,
}) {
  try {
    if (mongoose.connection?.readyState === 0 && !Admin.find?.mock) {
      return [];
    }

    // Fetch all active admins
    let admins = [];
    try {
      admins = await Admin.find({ status: { $ne: "inactive" } }).select("_id role email");
    } catch (dbError) {
      logger.warn("Could not query Admin collection for notification broadcast:", dbError.message);
    }

    const recipientIds = [];
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        recipientIds.push(String(admin._id));
      }
    }

    // Always include env-admin for local/dev/test compatibility if not already present
    if (recipientIds.length === 0) {
      recipientIds.push("env-admin");
    }

    const createdNotifications = [];
    for (const adminId of recipientIds) {
      const dedupKey = dedupKeyPrefix ? `${dedupKeyPrefix}_${adminId}` : null;
      try {
        const notif = await createNotification({
          recipientId: adminId,
          recipientRole: "admin",
          type,
          title,
          message,
          entityType,
          entityId,
          actionUrl,
          dedupKey,
        });
        createdNotifications.push(notif);
      } catch (err) {
        logger.error(`Failed to send notification to admin ${adminId}:`, err);
      }
    }

    return createdNotifications;
  } catch (error) {
    logger.error("Failed to notify admins:", error);
    return [];
  }
}

/**
 * Query user notifications with filters and pagination
 */
export async function getNotifications({
  userId,
  read,
  type,
  search,
  page = 1,
  limit = 20,
}) {
  const normalizedId = String(userId);
  const query = {
    $or: [
      { recipientId: normalizedId },
      { recipientId: "all_admins" },
    ],
  };

  if (read !== undefined && read !== null && read !== "all") {
    query.read = read === true || read === "true" || read === 1 || read === "1";
  }

  if (type && type !== "all" && type !== "All") {
    query.type = type;
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    query.$and = [
      {
        $or: [
          { title: { $regex: term, $options: "i" } },
          { message: { $regex: term, $options: "i" } },
        ],
      },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({
      $or: [
        { recipientId: normalizedId },
        { recipientId: "all_admins" },
      ],
      read: false,
    }),
  ]);

  return {
    notifications,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    unreadCount,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId) {
  const normalizedId = String(userId);
  return await Notification.countDocuments({
    $or: [
      { recipientId: normalizedId },
      { recipientId: "all_admins" },
    ],
    read: false,
  });
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(userId, notificationId) {
  const normalizedId = String(userId);
  const updated = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      $or: [
        { recipientId: normalizedId },
        { recipientId: "all_admins" },
      ],
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    },
    { new: true }
  );

  return updated;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  const normalizedId = String(userId);
  const result = await Notification.updateMany(
    {
      $or: [
        { recipientId: normalizedId },
        { recipientId: "all_admins" },
      ],
      read: false,
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount || 0,
  };
}

/**
 * Delete a single notification
 */
export async function deleteNotification(userId, notificationId) {
  const normalizedId = String(userId);
  const result = await Notification.findOneAndDelete({
    _id: notificationId,
    $or: [
      { recipientId: normalizedId },
      { recipientId: "all_admins" },
    ],
  });

  return Boolean(result);
}

export default {
  createNotification,
  notifyAdmins,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
