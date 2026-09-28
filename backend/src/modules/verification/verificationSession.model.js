import mongoose from "mongoose";

const verificationSessionSchema =
  new mongoose.Schema(
    {
      /**
       * Candidate being verified.
       */
      candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: true,
        index: true,
      },

      /**
       * Email address or phone number
       * to which the OTP was sent.
       */
      identifier: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /**
       * Hashed OTP.
       *
       * The actual OTP is never stored
       * in MongoDB.
       */
      otpHash: {
        type: String,
        required: true,
      },

      /**
       * OTP expiration time.
       *
       * Usually 10 minutes after creation.
       */
      otpExpiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      /**
       * Number of incorrect OTP attempts.
       */
      attempts: {
        type: Number,
        default: 0,
      },

      /**
       * Hashed candidate session token.
       *
       * Before OTP verification:
       * null
       *
       * After successful verification:
       * hashed session token
       */
      sessionToken: {
        type: String,
        unique: true,
        sparse: true,
        default: null,
        index: true,
      },

      /**
       * Candidate session expiration time.
       *
       * Before OTP verification:
       * null
       *
       * After successful verification:
       * usually 24 hours from verification.
       */
      sessionExpiresAt: {
        type: Date,
        default: null,
      },

      /**
       * Time at which OTP was successfully verified.
       */
      verifiedAt: {
        type: Date,
        default: null,
      },
    },

    {
      timestamps: true,
    }
  );

/**
 * TTL index.
 *
 * Once sessionExpiresAt is reached,
 * MongoDB automatically removes the document.
 */
verificationSessionSchema.index(
  { sessionExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

const VerificationSession =
  mongoose.models.VerificationSession ||
  mongoose.model(
    "VerificationSession",
    verificationSessionSchema
  );

export default VerificationSession;