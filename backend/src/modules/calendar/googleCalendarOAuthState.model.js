import mongoose from "mongoose";

const googleCalendarOAuthStateSchema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true, index: true },
  adminId: { type: String, required: true, index: true },

  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

const GoogleCalendarOAuthState = mongoose.models.GoogleCalendarOAuthState || mongoose.model("GoogleCalendarOAuthState", googleCalendarOAuthStateSchema);
export default GoogleCalendarOAuthState;
