import express from "express";
import passport from "passport";
import { login, me, logout, googleAuthCallback } from "./auth.controller.js";

const router = express.Router();

// Admin authentication
router.post("/login", login);
router.get("/me", me);
router.post("/logout", logout);

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
