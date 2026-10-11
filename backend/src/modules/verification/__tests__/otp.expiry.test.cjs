"use strict";

const mongoose = require("mongoose");
const { getOtpExpiry, hashOtp, verifyOtpHash, generateOtp } = require("../otp.service.js");
const {
  createVerificationSession,
  verifyCandidateOtp,
} = require("../verification.service.js");
const Candidate = require("../../candidate/candidate.model.js").default;
const VerificationSession = require("../verificationSession.model.js").default;
const otpDelivery = require("../otp.delivery.service.js");

describe("OTP 60-Second Validity and Security Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(otpDelivery, "sendOtp").mockResolvedValue({
      success: true,
      channel: "email",
    });
  });

  describe("1. OTP Expiry Calculation", () => {
    test("getOtpExpiry defaults to 60 seconds from current time", () => {
      const before = Date.now();
      const expiry = getOtpExpiry();
      const after = Date.now();

      expect(expiry).toBeInstanceOf(Date);
      const diffMs = expiry.getTime() - before;
      expect(diffMs).toBeGreaterThanOrEqual(59900);
      expect(diffMs).toBeLessThanOrEqual(60100);
    });

    test("getOtpExpiry handles custom second parameter", () => {
      const now = Date.now();
      const expiry = getOtpExpiry(30);
      const diffMs = expiry.getTime() - now;
      expect(diffMs).toBeGreaterThanOrEqual(29900);
      expect(diffMs).toBeLessThanOrEqual(30100);
    });
  });

  describe("2. createVerificationSession Expiry & Payload", () => {
    test("sets otpExpiresAt to exactly 60 seconds and returns expiresAt", async () => {
      const mockCandidateId = new mongoose.Types.ObjectId();
      const mockCandidate = {
        _id: mockCandidateId,
        name: "Test Candidate",
        email: "candidate@example.com",
        status: "approved",
      };

      jest.spyOn(Candidate, "findById").mockResolvedValue(mockCandidate);
      jest.spyOn(VerificationSession, "deleteMany").mockResolvedValue({ deletedCount: 1 });

      let createdSessionData = null;
      jest.spyOn(VerificationSession, "create").mockImplementation(async (data) => {
        createdSessionData = data;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...data,
        };
      });

      const before = Date.now();
      const result = await createVerificationSession(mockCandidateId, "candidate@example.com");

      expect(createdSessionData).toBeDefined();
      expect(createdSessionData.otpExpiresAt).toBeInstanceOf(Date);

      const diffMs = createdSessionData.otpExpiresAt.getTime() - before;
      expect(diffMs).toBeGreaterThanOrEqual(59000);
      expect(diffMs).toBeLessThanOrEqual(61000);

      expect(result.expiresInSeconds).toBe(60);
      expect(result.expiresAt).toEqual(createdSessionData.otpExpiresAt);
      expect(result.channel).toBe("email");
    });

    test("rejects if candidate is not approved", async () => {
      const mockCandidateId = new mongoose.Types.ObjectId();
      jest.spyOn(Candidate, "findById").mockResolvedValue({
        _id: mockCandidateId,
        status: "pending",
      });

      await expect(
        createVerificationSession(mockCandidateId, "candidate@example.com")
      ).rejects.toThrow("Candidate is not approved.");
    });
  });

  describe("3. verifyCandidateOtp 60-Second Enforcement", () => {
    test("accepts valid OTP before 60 seconds expiry", async () => {
      const testOtp = "123456";
      const hashed = hashOtp(testOtp);
      const mockCandidateId = new mongoose.Types.ObjectId();

      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        identifier: "candidate@example.com",
        candidateId: mockCandidateId,
        otpHash: hashed,
        otpExpiresAt: new Date(Date.now() + 45 * 1000), // 45 seconds remaining
        attempts: 0,
        verifiedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(VerificationSession, "findOne").mockResolvedValue(mockSession);
      jest.spyOn(Candidate, "findById").mockResolvedValue({
        _id: mockCandidateId,
        name: "Test Candidate",
        email: "candidate@example.com",
      });

      const result = await verifyCandidateOtp("candidate@example.com", testOtp);

      expect(result.candidate).toBeDefined();
      expect(mockSession.verifiedAt).toBeInstanceOf(Date);
      expect(mockSession.sessionToken).toBeDefined();
      expect(mockSession.save).toHaveBeenCalled();
    });

    test("rejects valid OTP after 60 seconds expiry", async () => {
      const testOtp = "123456";
      const hashed = hashOtp(testOtp);

      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        identifier: "candidate@example.com",
        otpHash: hashed,
        otpExpiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        attempts: 0,
        verifiedAt: null,
        save: jest.fn(),
      };

      jest.spyOn(VerificationSession, "findOne").mockResolvedValue(mockSession);

      await expect(
        verifyCandidateOtp("candidate@example.com", testOtp)
      ).rejects.toThrow("OTP has expired. Please request a new OTP.");
    });

    test("rejects incorrect OTP and increments attempts counter", async () => {
      const correctOtp = "123456";
      const wrongOtp = "654321";
      const hashed = hashOtp(correctOtp);

      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        identifier: "candidate@example.com",
        otpHash: hashed,
        otpExpiresAt: new Date(Date.now() + 30 * 1000),
        attempts: 1,
        verifiedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(VerificationSession, "findOne").mockResolvedValue(mockSession);

      await expect(
        verifyCandidateOtp("candidate@example.com", wrongOtp)
      ).rejects.toThrow("Invalid OTP.");

      expect(mockSession.attempts).toBe(2);
      expect(mockSession.save).toHaveBeenCalled();
    });

    test("locks out and rejects when max attempts (5) exceeded", async () => {
      const testOtp = "123456";
      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        identifier: "candidate@example.com",
        otpHash: hashOtp(testOtp),
        otpExpiresAt: new Date(Date.now() + 30 * 1000),
        attempts: 5,
        verifiedAt: null,
        save: jest.fn(),
      };

      jest.spyOn(VerificationSession, "findOne").mockResolvedValue(mockSession);

      await expect(
        verifyCandidateOtp("candidate@example.com", testOtp)
      ).rejects.toThrow("Too many incorrect attempts. Please request a new OTP.");
    });

    test("prevents reuse of already verified session", async () => {
      // findOne checks verifiedAt: null, so an already-verified session returns null
      jest.spyOn(VerificationSession, "findOne").mockResolvedValue(null);

      await expect(
        verifyCandidateOtp("candidate@example.com", "123456")
      ).rejects.toThrow("No active verification request. Please request a new OTP.");
    });
  });
});
