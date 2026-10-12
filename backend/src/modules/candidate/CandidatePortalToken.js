import mongoose from "mongoose";

const CandidatePortalTokenSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    purpose: {
      type: String,
      enum: ["candidate_portal"],
      default: "candidate_portal",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * TTL index to automatically remove portal tokens 30 days after expiration.
 * This preserves a 30-day diagnostics window while preventing infinite accumulation.
 */
CandidatePortalTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 30 * 24 * 3600 }
);

const CandidatePortalToken =
  mongoose.models.CandidatePortalToken ||
  mongoose.model("CandidatePortalToken", CandidatePortalTokenSchema);

export default CandidatePortalToken;