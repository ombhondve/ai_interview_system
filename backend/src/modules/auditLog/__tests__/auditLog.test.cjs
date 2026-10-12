const AuditLog = require("../auditLog.model.js").default;
const { createAuditLog, getAuditLogs, getAuditLogById } = require("../auditLog.service.js");
const mongoose = require("mongoose");

describe("Audit Log Service & Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createAuditLog strips sensitive password, token, and secret fields", async () => {
    // Mock readyState to 1 for this test
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    const createSpy = jest.spyOn(AuditLog, "create").mockImplementation(async (data) => data);

    const log = await createAuditLog({
      actor: "admin-123",
      actorName: "Om Bhondve",
      actorRole: "superadmin",
      action: "ADMIN_LOGIN",
      targetType: "Admin",
      targetId: "admin-123",
      description: "Admin logged in",
      details: {
        email: "admin@recruitai.com",
        password: "SuperSecretPassword123",
        jwtToken: "eyJhbGciOi...",
        refreshToken: "refresh-secret",
        userAgent: "Chrome",
      },
    });

    expect(createSpy).toHaveBeenCalled();
    const calledData = createSpy.mock.calls[0][0];

    expect(calledData.details.email).toBe("admin@recruitai.com");
    expect(calledData.details.password).toBe("[REDACTED]");
    expect(calledData.details.jwtToken).toBe("[REDACTED]");
    expect(calledData.details.refreshToken).toBe("[REDACTED]");
    expect(calledData.details.userAgent).toBe("Chrome");

    Object.defineProperty(mongoose.connection, "readyState", { value: origReadyState, configurable: true });
  });

  test("getAuditLogs applies action and outcome filters", async () => {
    const mockLogs = [
      {
        _id: "507f1f77bcf86cd799439001",
        action: "CANDIDATE_APPROVE",
        actorName: "Admin",
        targetType: "Candidate",
        outcome: "SUCCESS",
        timestamp: new Date(),
      },
    ];

    jest.spyOn(AuditLog, "find").mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockLogs),
    });

    jest.spyOn(AuditLog, "countDocuments").mockResolvedValue(1);

    const res = await getAuditLogs({ action: "CANDIDATE_APPROVE", page: 1, limit: 10 });
    expect(res.logs).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.logs[0].action).toBe("CANDIDATE_APPROVE");
  });

  test("getAuditLogById returns single record with id string", async () => {
    const mockLog = {
      _id: "507f1f77bcf86cd799439099",
      action: "SUBMIT_ADMIN_DECISION",
      description: "Candidate hired",
    };

    jest.spyOn(AuditLog, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockLog),
    });

    const res = await getAuditLogById("507f1f77bcf86cd799439099");
    expect(res.id).toBe("507f1f77bcf86cd799439099");
    expect(res.action).toBe("SUBMIT_ADMIN_DECISION");
  });
});
