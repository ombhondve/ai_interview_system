import mongoose from "mongoose";

const googleCalendarConnectionSchema = new mongoose.Schema({
  adminId: { type: String, required: true, unique: true, index: true },
  googleAccountEmail: { type: String, required: true, trim: true, lowercase: true },
  refreshTokenEncrypted: { type: String, select: false },
  calendarId: { type: String, required: true, trim: true, default: "primary" },
  scope: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["connected", "disconnected"], default: "connected", index: true },
  connectedAt: { type: Date, default: Date.now },
  lastValidatedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 1 },
}, { timestamps: true });

googleCalendarConnectionSchema.index({ status: 1, updatedAt: -1 });

googleCalendarConnectionSchema.pre("validate", function ensureCredentialWhenConnected(next) {
  if (this.status === "connected" && !this.refreshTokenEncrypted) {
    this.invalidate("refreshTokenEncrypted", "Connected calendar requires an encrypted credential.");
  }
  next();
});

const GoogleCalendarConnection = mongoose.models.GoogleCalendarConnection || mongoose.model("GoogleCalendarConnection", googleCalendarConnectionSchema);
export default GoogleCalendarConnection;
