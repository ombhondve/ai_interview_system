import nodemailer from "nodemailer";
import twilio from "twilio";

/**
 * ============================================
 * EMAIL CONFIGURATION
 * ============================================
 */

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * ============================================
 * TWILIO CONFIGURATION
 * ============================================
 */

const twilioConfigured =
  Boolean(process.env.TWILIO_ACCOUNT_SID) &&
  Boolean(process.env.TWILIO_AUTH_TOKEN);

const twilioClient = twilioConfigured
  ? twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  : null;

/**
 * ============================================
 * VALIDATION
 * ============================================
 */

/**
 * Check whether identifier is an email address.
 */
export function isEmail(identifier) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    identifier.trim()
  );
}

/**
 * Check whether identifier is an international
 * phone number in E.164 format.
 *
 * Example:
 * +918999857354
 */
export function isPhone(identifier) {
  return /^\+[1-9]\d{7,14}$/.test(
    identifier.trim()
  );
}

/**
 * ============================================
 * EMAIL OTP
 * ============================================
 */

export async function sendOtpByEmail(email, otp) {
  if (!process.env.SMTP_HOST) {
    throw new Error(
      "SMTP_HOST is not configured."
    );
  }

  if (!process.env.SMTP_USER) {
    throw new Error(
      "SMTP_USER is not configured."
    );
  }

  if (!process.env.SMTP_PASSWORD) {
    throw new Error(
      "SMTP_PASSWORD is not configured."
    );
  }

  await emailTransporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to: email,

    subject:
      "RecruitAI - Your Verification OTP",

    text: `Your RecruitAI verification OTP is ${otp}. This OTP will expire in 10 minutes. Do not share this OTP with anyone.`,

    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        "
      >
        <h2>RecruitAI Verification</h2>

        <p>
          Your verification OTP is:
        </p>

        <div
          style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 20px 0;
          "
        >
          ${otp}
        </div>

        <p>
          This OTP will expire in 10 minutes.
        </p>

        <p>
          Do not share this OTP with anyone.
        </p>

        <p>
          If you did not request this OTP,
          you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

/**
 * ============================================
 * SMS OTP
 * ============================================
 */

export async function sendOtpBySms(phone, otp) {
  if (!twilioClient) {
    throw new Error(
      "Twilio is not configured. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
    );
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is not configured."
    );
  }

  const message =
    await twilioClient.messages.create({
      body: `Your RecruitAI verification OTP is ${otp}. It expires in 10 minutes. Do not share this OTP with anyone.`,

      from:
        process.env.TWILIO_PHONE_NUMBER,

      to: phone,
    });

  return {
    messageSid: message.sid,
    status: message.status,
  };
}

/**
 * ============================================
 * MAIN OTP DELIVERY FUNCTION
 * ============================================
 *
 * Automatically decides whether to send
 * the OTP through email or SMS.
 */

export async function sendOtp(identifier, otp) {
  const value = identifier.trim();

  if (!value) {
    throw new Error(
      "Email address or phone number is required."
    );
  }

  /**
   * Email
   */
  if (isEmail(value)) {
    await sendOtpByEmail(value, otp);

    return {
      channel: "email",
    };
  }

  /**
   * SMS
   */
  if (isPhone(value)) {
    await sendOtpBySms(value, otp);

    return {
      channel: "sms",
    };
  }

  /**
   * Invalid identifier
   */
  throw new Error(
    "Please enter a valid email address or phone number."
  );
}