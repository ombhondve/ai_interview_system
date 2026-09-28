import express from "express";

import {
  sendOtpController,
  verifyOtpController,
} from "./verification.controller.js";

const router = express.Router();

/*
 * Generate and send OTP
 */
router.post(
  "/send",
  sendOtpController
);

/*
 * Verify OTP
 */
router.post(
  "/verify",
  verifyOtpController
);

export default router;