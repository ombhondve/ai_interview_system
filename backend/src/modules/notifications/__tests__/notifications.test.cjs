"use strict";

const notificationService = require("../notification.service.js");
const Notification = require("../notification.model.js").default;
const Admin = require("../../admin/admin.model.js").default;

describe("Notification Service & Integration Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Notification Creation and Deduplication", () => {
    test("creates notification with required fields and defaults", async () => {
      const mockDoc = {
        _id: "notif_1",
        recipientId: "admin_123",
        recipientRole: "admin",
        type: "interview_scheduled",
        title: "Interview Scheduled",
        message: "Candidate booked slot",
        read: false,
        createdAt: new Date(),
      };

      jest.spyOn(Notification, "create").mockResolvedValue(mockDoc);

      const result = await notificationService.createNotification({
        recipientId: "admin_123",
        recipientRole: "admin",
        type: "interview_scheduled",
        title: "Interview Scheduled",
        message: "Candidate booked slot",
      });

      expect(result).toBeDefined();
      expect(result.recipientId).toBe("admin_123");
      expect(result.read).toBe(false);
      expect(Notification.create).toHaveBeenCalled();
    });

    test("prevents duplicate notifications when dedupKey already exists", async () => {
      const existing = {
        _id: "notif_existing",
        recipientId: "admin_123",
        dedupKey: "booking_session_456_admin_123",
        title: "Interview Scheduled",
      };

      jest.spyOn(Notification, "findOne").mockResolvedValue(existing);
      const createSpy = jest.spyOn(Notification, "create");

      const result = await notificationService.createNotification({
        recipientId: "admin_123",
        type: "interview_scheduled",
        title: "Interview Scheduled",
        message: "Candidate booked slot",
        dedupKey: "booking_session_456_admin_123",
      });

      expect(result._id).toBe("notif_existing");
      expect(createSpy).not.toHaveBeenCalled();
    });

    test("throws error if required fields are missing", async () => {
      await expect(
        notificationService.createNotification({
          recipientId: "",
          type: "",
          title: "",
          message: "",
        })
      ).rejects.toThrow("Missing required notification fields");
    });
  });

  describe("2. Broadcast Dispatch to Active Admins", () => {
    test("dispatches notifications to all active administrators", async () => {
      const mockAdmins = [
        { _id: "admin_1", role: "superadmin", email: "sa@test.com" },
        { _id: "admin_2", role: "recruiter", email: "rec@test.com" },
      ];

      jest.spyOn(Admin, "find").mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmins),
      });

      const createSpy = jest.spyOn(Notification, "create").mockImplementation((doc) =>
        Promise.resolve({ _id: `notif_${doc.recipientId}`, ...doc })
      );
      jest.spyOn(Notification, "findOne").mockResolvedValue(null);

      const dispatched = await notificationService.notifyAdmins({
        type: "candidate_status_updated",
        title: "Candidate Approved",
        message: "Candidate Sarah Connor was approved",
        dedupKeyPrefix: "cand_appr_123",
      });

      expect(dispatched.length).toBe(2);
      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("3. Query, Unread Count & Filtering", () => {
    test("retrieves unread count for user", async () => {
      jest.spyOn(Notification, "countDocuments").mockResolvedValue(5);

      const count = await notificationService.getUnreadCount("admin_123");
      expect(count).toBe(5);
      expect(Notification.countDocuments).toHaveBeenCalledWith({
        $or: [{ recipientId: "admin_123" }, { recipientId: "all_admins" }],
        read: false,
      });
    });

    test("applies read and type filters and pagination correctly", async () => {
      const mockNotifications = [
        { _id: "n1", title: "Alert 1", read: false },
        { _id: "n2", title: "Alert 2", read: false },
      ];

      const findMock = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockNotifications),
      };

      jest.spyOn(Notification, "find").mockReturnValue(findMock);
      jest.spyOn(Notification, "countDocuments").mockResolvedValueOnce(2).mockResolvedValueOnce(2);

      const result = await notificationService.getNotifications({
        userId: "admin_123",
        read: false,
        type: "interview_scheduled",
        page: 1,
        limit: 10,
      });

      expect(result.notifications.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(2);
    });
  });

  describe("4. Mark Read & Delete Operations", () => {
    test("marks a single notification as read", async () => {
      const updated = {
        _id: "notif_1",
        read: true,
        readAt: new Date(),
      };

      jest.spyOn(Notification, "findOneAndUpdate").mockResolvedValue(updated);

      const result = await notificationService.markAsRead("admin_123", "notif_1");
      expect(result.read).toBe(true);
      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: "notif_1",
          $or: [{ recipientId: "admin_123" }, { recipientId: "all_admins" }],
        },
        expect.objectContaining({
          $set: expect.objectContaining({ read: true }),
        }),
        { new: true }
      );
    });

    test("marks all notifications as read for current user", async () => {
      jest.spyOn(Notification, "updateMany").mockResolvedValue({ modifiedCount: 4 });

      const result = await notificationService.markAllAsRead("admin_123");
      expect(result.success).toBe(true);
      expect(result.modifiedCount).toBe(4);
    });

    test("deletes notification restricted to authorized recipient", async () => {
      jest.spyOn(Notification, "findOneAndDelete").mockResolvedValue({ _id: "notif_1" });

      const deleted = await notificationService.deleteNotification("admin_123", "notif_1");
      expect(deleted).toBe(true);
      expect(Notification.findOneAndDelete).toHaveBeenCalledWith({
        _id: "notif_1",
        $or: [{ recipientId: "admin_123" }, { recipientId: "all_admins" }],
      });
    });
  });
});
