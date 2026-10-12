import express from "express";
import passport from "passport";
import { login, me, logout, getProfile, updateProfile, googleAuthCallback } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

const router = express.Router();

// Admin authentication
router.post("/login", login);
router.get("/me", me);
router.post("/logout", logout);

// Admin profile management
router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, updateProfile);
router.put("/profile", requireAuth, updateProfile);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  googleAuthCallback
);

export default router;
