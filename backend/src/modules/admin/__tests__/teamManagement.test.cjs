"use strict";

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const teamService = require("../teamManagement.service.js");
const Admin = require("../admin.model.js").default;
const AuditLog = require("../../auditLog/auditLog.model.js").default;
const { requireRole } = require("../../auth/auth.middleware.js");
const notificationService = require("../../notifications/notification.service.js");

describe("Team & Admin Management Security & RBAC Tests", () => {
  const superAdminActor = {
    id: "507f1f77bcf86cd799439011",
    email: "superadmin@recruitai.com",
    role: "superadmin",
  };

  const recruiterActor = {
    id: "507f1f77bcf86cd799439022",
    email: "recruiter@recruitai.com",
    role: "recruiter",
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    if (notificationService.notifyAdmins) {
      jest.spyOn(notificationService, "notifyAdmins").mockResolvedValue([]);
    }
  });

  describe("1. Listing & Overview Stats", () => {
    test("returns formatted team roster and overview counts", async () => {
      const mockAdmins = [
        {
          _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
          name: "Super Admin User",
          email: "superadmin@recruitai.com",
          role: "superadmin",
          status: "active",
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439022"),
          name: "Recruiter User",
          email: "recruiter@recruitai.com",
          role: "recruiter",
          status: "active",
          createdAt: new Date(),
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAdmins),
      };

      jest.spyOn(Admin, "find").mockReturnValue(findMock);
      jest.spyOn(Admin, "countDocuments")
        .mockResolvedValueOnce(2) // query count
        .mockResolvedValueOnce(2) // totalAdmins
        .mockResolvedValueOnce(2) // activeAdmins
        .mockResolvedValueOnce(1) // superAdminCount
        .mockResolvedValueOnce(1); // recruiterCount

      const result = await teamService.getTeamMembers({});

      expect(result.members.length).toBe(2);
      expect(result.overview.totalAdmins).toBe(2);
      expect(result.overview.superAdminCount).toBe(1);
      expect(result.overview.recruiterCount).toBe(1);
    });
  });

  describe("2. Creating Team Members & Validations", () => {
    test("hashes password, creates admin, and writes audit log", async () => {
      jest.spyOn(Admin, "findOne").mockResolvedValue(null);
      const newAdminId = new mongoose.Types.ObjectId();
      const mockCreated = {
        _id: newAdminId,
        name: "New Recruiter",
        email: "newrecruiter@test.com",
        role: "recruiter",
        status: "active",
        createdAt: new Date(),
        toObject() {
          return { ...this };
        },
      };

      jest.spyOn(Admin, "create").mockResolvedValue(mockCreated);
      const auditSpy = jest.spyOn(AuditLog, "create").mockResolvedValue({});

      const created = await teamService.createTeamMember({
        actor: superAdminActor,
        name: "New Recruiter",
        email: "newrecruiter@test.com",
        role: "recruiter",
        password: "securePassword123!",
      });

      expect(created).toBeDefined();
      expect(created.name).toBe("New Recruiter");
      expect(created.passwordHash).toBeUndefined(); // Never expose password hash
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TEAM_MEMBER_CREATED",
          actor: superAdminActor.id,
        })
      );
    });

    test("rejects creation if password is shorter than 8 characters", async () => {
      await expect(
        teamService.createTeamMember({
          actor: superAdminActor,
          name: "Test User",
          email: "test@test.com",
          role: "recruiter",
          password: "short",
        })
      ).rejects.toThrow("Password must be at least 8 characters long.");
    });

    test("rejects creation if email is already registered", async () => {
      jest.spyOn(Admin, "findOne").mockResolvedValue({ _id: "existing_1" });

      await expect(
        teamService.createTeamMember({
          actor: superAdminActor,
          name: "Test User",
          email: "duplicate@test.com",
          role: "recruiter",
          password: "securePassword123!",
        })
      ).rejects.toThrow("An administrator with this email address already exists.");
    });
  });

  describe("3. Safeguards on Privileged Roles & Deactivations", () => {
    test("prevents demoting the last active Super Admin", async () => {
      const superAdminId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
      const targetAdmin = {
        _id: superAdminId,
        name: "Only Super Admin",
        email: "onlysa@recruitai.com",
        role: "superadmin",
        status: "active",
        toObject() {
          return { ...this };
        },
      };

      jest.spyOn(Admin, "findById").mockResolvedValue(targetAdmin);
      jest.spyOn(Admin, "countDocuments").mockResolvedValue(1); // Only 1 active superadmin

      await expect(
        teamService.updateTeamMember({
          actor: superAdminActor,
          adminId: String(superAdminId),
          role: "recruiter",
        })
      ).rejects.toThrow("Cannot demote the last active Super Admin.");
    });

    test("prevents deactivating one's own account", async () => {
      const selfId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
      const selfAdmin = {
        _id: selfId,
        name: "Self Admin",
        email: superAdminActor.email,
        role: "superadmin",
        status: "active",
        toObject() {
          return { ...this };
        },
      };

      jest.spyOn(Admin, "findById").mockResolvedValue(selfAdmin);

      await expect(
        teamService.toggleTeamMemberStatus({
          actor: superAdminActor,
          adminId: String(selfId),
          status: "inactive",
        })
      ).rejects.toThrow("You cannot deactivate your own account.");
    });

    test("prevents deleting one's own account", async () => {
      const selfId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
      const selfAdmin = {
        _id: selfId,
        name: "Self Admin",
        email: superAdminActor.email,
        role: "superadmin",
        toObject() {
          return { ...this };
        },
      };

      jest.spyOn(Admin, "findById").mockResolvedValue(selfAdmin);

      await expect(
        teamService.deleteTeamMember({
          actor: superAdminActor,
          adminId: String(selfId),
        })
      ).rejects.toThrow("You cannot delete your own account.");
    });

    test("prevents deleting the last Super Admin in the system", async () => {
      const targetSuperId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439099");
      const targetAdmin = {
        _id: targetSuperId,
        name: "Last Super Admin",
        email: "last@recruitai.com",
        role: "superadmin",
        toObject() {
          return { ...this };
        },
      };

      jest.spyOn(Admin, "findById").mockResolvedValue(targetAdmin);
      jest.spyOn(Admin, "countDocuments").mockResolvedValue(1); // Only 1 superadmin

      await expect(
        teamService.deleteTeamMember({
          actor: superAdminActor,
          adminId: String(targetSuperId),
        })
      ).rejects.toThrow("Cannot delete the last Super Admin.");
    });
  });

  describe("4. Role-Based Access Control (RBAC) Middleware", () => {
    test("rejects recruiter attempting superadmin-only operations", () => {
      const req = { user: recruiterActor };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = requireRole("superadmin");
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Insufficient permissions"),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("allows superadmin access to superadmin operations", () => {
      const req = { user: superAdminActor };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireRole("superadmin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
